#![no_std]

// Soroban phase-based escrow contract for AgroFactoring.
// The exporter funds the full crop amount upfront; the contract holds custody
// of the USDC and releases it to the farmer phase by phase. An admin/oracle can
// freeze the escrow in case of disaster.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token::Client as TokenClient, Address,
    Env,
};

// Lifecycle status of an escrow.
// Active   -> escrow is operational, phases can be released.
// Frozen   -> disaster triggered by admin/oracle, no further releases allowed.
// Completed-> all phases released, full amount disbursed to the farmer.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Active,
    Frozen,
    Completed,
}

// On-chain representation of a single escrow agreement (one per crop).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowData {
    pub exporter: Address,        // funder who deposits the USDC
    pub farmer: Address,          // beneficiary who receives phase payments
    pub crop_id: u64,             // off-chain crop identifier
    pub total_amount: i128,       // total USDC deposited upfront
    pub current_phase: u32,       // last successfully released phase (0 = none yet)
    pub amount_per_phase: i128,   // USDC released on each phase
    pub released_amount: i128,    // cumulative USDC enabled (habilitado) for withdrawal
    pub withdrawn_amount: i128,   // cumulative USDC actually withdrawn by the farmer
    pub status: EscrowStatus,     // current lifecycle status
    pub usdc_address: Address,    // USDC token contract used for transfers
}

// Storage keys. Admin and Usdc live in instance storage; escrows live in
// persistent storage keyed by crop_id so they survive archival.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Usdc,
    Escrow(u64),
}

// Custom error codes returned by the contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    NotInitialized = 1,    // admin not set via constructor
    AlreadyInitialized = 2, // escrow for this crop_id already exists
    Unauthorized = 3,       // caller is not authorized for this action
    EscrowNotFound = 4,     // no escrow stored under the given crop_id
    InvalidAmount = 5,      // amount is zero, negative, or not divisible
    EscrowFrozen = 6,       // operation blocked because escrow is Frozen
    InvalidPhase = 7,       // phase number out of order or out of range
    UsdcNotConfigured = 8,  // set_usdc has not been called yet
    PartyMismatch = 9,      // provided exporter/farmer do not match the stored escrow
    EscrowNotFrozen = 11,   // resolve_disaster requires a Frozen escrow (skip 10 — used by SAC token errors)
}

#[contract]
pub struct Contract;

// TTL management constants (~5s ledgers): extend to ~30 days once the TTL drops
// below the threshold. Applied on every mutating access to an escrow key.
const TTL_THRESHOLD: u32 = 100;
const TTL_EXTEND_TO: u32 = 518400;

// Helper: require the caller to be the admin stored in instance storage.
fn require_admin(env: &Env) -> Result<(), ContractError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(ContractError::NotInitialized)?;
    admin.require_auth();
    Ok(())
}

// Helper: read the configured USDC token address from instance storage.
fn get_usdc(env: &Env) -> Result<Address, ContractError> {
    env.storage()
        .instance()
        .get(&DataKey::Usdc)
        .ok_or(ContractError::UsdcNotConfigured)
}

#[contractimpl]
impl Contract {
    // Runs once at deployment time. Sets the admin/oracle that can configure
    // USDC and trigger disaster freezes.
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // Set the USDC token contract address used for all escrow transfers.
    // Admin-only; must be called once before any escrow is initialized.
    pub fn set_usdc(env: Env, usdc_address: Address) -> Result<(), ContractError> {
        require_admin(&env)?;
        env.storage().instance().set(&DataKey::Usdc, &usdc_address);
        Ok(())
    }

    // Create a new escrow for a crop. The exporter authorizes the call and must
    // approve the USDC transfer of `total_amount` from their account into the
    // contract (contract takes full custody upfront). The amount must be evenly
    // divisible by `amount_per_phase` so that each phase releases the same USDC.
    pub fn init(
        env: Env,
        exporter: Address,
        farmer: Address,
        crop_id: u64,
        total_amount: i128,
        amount_per_phase: i128,
    ) -> Result<(), ContractError> {
        // The exporter must authorize the deposit.
        exporter.require_auth();

        // Validate amounts: must be positive and evenly divisible.
        if total_amount <= 0 || amount_per_phase <= 0 {
            return Err(ContractError::InvalidAmount);
        }
        if total_amount % amount_per_phase != 0 {
            return Err(ContractError::InvalidAmount);
        }

        // Prevent re-initialization for the same crop.
        if env.storage().persistent().has(&DataKey::Escrow(crop_id)) {
            return Err(ContractError::AlreadyInitialized);
        }

        // USDC must be configured before any escrow can be created.
        let usdc_address = get_usdc(&env)?;

        // Transfer the full amount from the exporter into the contract custody.
        let token = TokenClient::new(&env, &usdc_address);
        token.transfer(&exporter, &env.current_contract_address(), &total_amount);

        // Build the escrow record in Active status with no phases released yet.
        let escrow = EscrowData {
            exporter,
            farmer,
            crop_id,
            total_amount,
            current_phase: 0,
            amount_per_phase,
            released_amount: 0,
            withdrawn_amount: 0,
            status: EscrowStatus::Active,
            usdc_address,
        };

        // Persist the escrow and extend its TTL to avoid archival.
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(crop_id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(crop_id), TTL_THRESHOLD, TTL_EXTEND_TO);

        Ok(())
    }

    // Release a single phase: enables `amount_per_phase` USDC for the farmer
    // to withdraw. Only the exporter can authorize releases, phases must be
    // released in strict ascending order, and the escrow must be Active.
    // Funds stay in the contract until the farmer calls `withdraw`. When the
    // last phase is released the status flips to Completed.
    pub fn release_phase(
        env: Env,
        crop_id: u64,
        phase_number: u32,
    ) -> Result<(), ContractError> {
        // Load the escrow; error if it does not exist.
        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(crop_id))
            .ok_or(ContractError::EscrowNotFound)?;

        // Only the exporter may release phases.
        escrow.exporter.require_auth();

        // A frozen escrow cannot release any more funds.
        if escrow.status == EscrowStatus::Frozen {
            return Err(ContractError::EscrowFrozen);
        }
        // A completed escrow has nothing left to release.
        if escrow.status == EscrowStatus::Completed {
            return Err(ContractError::InvalidPhase);
        }

        // Phases must be released in order: current_phase + 1.
        let expected_phase = escrow.current_phase.checked_add(1).ok_or(ContractError::InvalidPhase)?;
        if phase_number != expected_phase {
            return Err(ContractError::InvalidPhase);
        }

        // The phase number cannot exceed the total number of phases.
        let total_phases = (escrow.total_amount / escrow.amount_per_phase) as u32;
        if phase_number > total_phases {
            return Err(ContractError::InvalidPhase);
        }

        // Compute the release amount and check it does not exceed the deposit.
        let amount = escrow.amount_per_phase;
        let new_released = escrow
            .released_amount
            .checked_add(amount)
            .ok_or(ContractError::InvalidAmount)?;
        if new_released > escrow.total_amount {
            return Err(ContractError::InvalidAmount);
        }

        // Update progress tracking. Funds remain in the contract custody
        // until the farmer explicitly withdraws them.
        escrow.current_phase = phase_number;
        escrow.released_amount = new_released;

        // If everything has been enabled, mark the escrow as Completed.
        if new_released == escrow.total_amount {
            escrow.status = EscrowStatus::Completed;
        }

        // Persist the updated escrow and refresh its TTL.
        env.storage()
            .persistent()
            .set(&DataKey::Escrow(crop_id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(crop_id), TTL_THRESHOLD, TTL_EXTEND_TO);

        Ok(())
    }

    // Freeze an escrow in response to a disaster event. Only the admin/oracle
    // can trigger this. The provided exporter and farmer must match the
    // parties stored in the escrow; otherwise the call is rejected. Funds are
    // not moved — the escrow simply becomes non-releasable.
    pub fn trigger_disaster(
        env: Env,
        exporter: Address,
        farmer: Address,
        crop_id: u64,
    ) -> Result<(), ContractError> {
        // Only the admin/oracle can declare a disaster.
        require_admin(&env)?;

        // Load the escrow; error if it does not exist.
        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(crop_id))
            .ok_or(ContractError::EscrowNotFound)?;

        // Verify the provided parties match the stored escrow.
        if escrow.exporter != exporter || escrow.farmer != farmer {
            return Err(ContractError::PartyMismatch);
        }

        // Set the status to Frozen and persist.
        escrow.status = EscrowStatus::Frozen;

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(crop_id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(crop_id), TTL_THRESHOLD, TTL_EXTEND_TO);

        Ok(())
    }

    // Reset an escrow: returns any remaining USDC to the exporter and removes
    // the escrow entry from persistent storage. Admin-only so that resets are
    // controlled (e.g. from the emulator). After a reset, `init` can be called
    // again with the same crop_id.
    pub fn reset_escrow(
        env: Env,
        crop_id: u64,
    ) -> Result<(), ContractError> {
        require_admin(&env)?;

        let escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(crop_id))
            .ok_or(ContractError::EscrowNotFound)?;

        // Return unreleased funds to the exporter.
        let remaining = escrow.total_amount - escrow.withdrawn_amount;
        if remaining > 0 {
            let token = TokenClient::new(&env, &escrow.usdc_address);
            token.transfer(&env.current_contract_address(), &escrow.exporter, &remaining);
        }

        // Remove the escrow so the crop_id can be reused.
        env.storage().persistent().remove(&DataKey::Escrow(crop_id));

        Ok(())
    }

    // Resolve a frozen escrow after a disaster: distribute the remaining USDC
    // between the farmer (rescue fund) and the exporter (refund), then remove
    // the escrow. Admin-only; the escrow must be Frozen. `rescue_bps` is the
    // fraction of the remaining balance (in basis points) sent to the farmer.
    // Example: rescue_bps = 3000 -> 30% rescue to farmer, 70% refund to exporter.
    pub fn resolve_disaster(
        env: Env,
        crop_id: u64,
        rescue_bps: u32,
    ) -> Result<(), ContractError> {
        require_admin(&env)?;

        // Validate basis points range (0..=10_000).
        if rescue_bps > 10_000 {
            return Err(ContractError::InvalidAmount);
        }

        let escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(crop_id))
            .ok_or(ContractError::EscrowNotFound)?;

        // Only frozen escrows can be resolved.
        if escrow.status != EscrowStatus::Frozen {
            return Err(ContractError::EscrowNotFrozen);
        }

        // Compute the remaining balance still held by the contract.
        let remaining = escrow.total_amount - escrow.withdrawn_amount;

        // Split: rescue_amount -> farmer, exporter_refund -> exporter.
        let rescue_amount = (remaining * rescue_bps as i128) / 10_000;
        let exporter_refund = remaining - rescue_amount;

        let token = TokenClient::new(&env, &escrow.usdc_address);
        if rescue_amount > 0 {
            token.transfer(&env.current_contract_address(), &escrow.farmer, &rescue_amount);
        }
        if exporter_refund > 0 {
            token.transfer(&env.current_contract_address(), &escrow.exporter, &exporter_refund);
        }

        // Remove the escrow so the crop_id can be reused (e.g. re-init).
        env.storage().persistent().remove(&DataKey::Escrow(crop_id));

        Ok(())
    }

    // Withdraw USDC from the contract to the farmer's wallet. Admin/oracle
    // only (the farmer authenticates off-chain via the backend). The amount
    // must not exceed `released_amount - withdrawn_amount` (the balance
    // enabled but not yet withdrawn). Works on Active and Completed escrows;
    // a Frozen escrow still allows withdrawing already-enabled funds.
    pub fn withdraw(
        env: Env,
        crop_id: u64,
        amount: i128,
    ) -> Result<(), ContractError> {
        require_admin(&env)?;

        let mut escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(crop_id))
            .ok_or(ContractError::EscrowNotFound)?;

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        // The farmer can only withdraw what has been enabled but not yet taken.
        let available = escrow
            .released_amount
            .checked_sub(escrow.withdrawn_amount)
            .ok_or(ContractError::InvalidAmount)?;
        if amount > available {
            return Err(ContractError::InvalidAmount);
        }

        // Transfer USDC from the contract custody to the farmer.
        let token = TokenClient::new(&env, &escrow.usdc_address);
        token.transfer(&env.current_contract_address(), &escrow.farmer, &amount);

        escrow.withdrawn_amount = escrow
            .withdrawn_amount
            .checked_add(amount)
            .ok_or(ContractError::InvalidAmount)?;

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(crop_id), &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Escrow(crop_id), TTL_THRESHOLD, TTL_EXTEND_TO);

        Ok(())
    }

    // Read-only accessor that returns the full escrow state for a crop. The
    // caller must provide the matching exporter and farmer; mismatched parties
    // receive a PartyMismatch error so arbitrary callers cannot inspect other
    // people's escrows.
    pub fn get_escrow_state(
        env: Env,
        exporter: Address,
        farmer: Address,
        crop_id: u64,
    ) -> Result<EscrowData, ContractError> {
        // Load the escrow; error if it does not exist.
        let escrow: EscrowData = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(crop_id))
            .ok_or(ContractError::EscrowNotFound)?;

        // Verify the provided parties match the stored escrow.
        if escrow.exporter != exporter || escrow.farmer != farmer {
            return Err(ContractError::PartyMismatch);
        }

        Ok(escrow)
    }
}

mod test;