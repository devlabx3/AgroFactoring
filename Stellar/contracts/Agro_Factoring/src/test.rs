#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    token::{self, TokenClient},
    Address, Env,
};

use super::{Contract, ContractClient, ContractError, EscrowData, EscrowStatus};

// ------------------------------------------------------------------
// Test harness - registers the escrow contract and a real Stellar Asset
// Contract (SAC) used as the USDC stand-in. The escrow takes custody of
// the full crop amount during init and releases it phase by phase.
// ------------------------------------------------------------------

#[allow(dead_code)]
struct TestEnv {
    env: Env,
    contract_addr: Address,
    token_addr: Address,
    admin: Address,
    exporter: Address,
    farmer: Address,
    crop_id: u64,
    total: i128,
    per_phase: i128,
}

impl TestEnv {
    // Client for the escrow contract.
    fn escrow(&self) -> ContractClient<'_> {
        ContractClient::new(&self.env, &self.contract_addr)
    }

    // SEP-41 token client (balance / transfer) for the USDC stand-in.
    fn token(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.token_addr)
    }

    // Admin client (mint) for the USDC stand-in.
    fn token_admin(&self) -> token::StellarAssetClient<'_> {
        token::StellarAssetClient::new(&self.env, &self.token_addr)
    }
}

// Build a fully initialized escrow: admin set, USDC configured, `total`
// minted to the exporter, and init() called so the contract holds custody.
fn setup(total: i128, per_phase: i128, crop_id: u64) -> TestEnv {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let exporter = Address::generate(&env);
    let farmer = Address::generate(&env);

    // Deploy escrow contract with admin as constructor argument.
    let contract_addr = env.register(Contract, (&admin,));

    // Deploy a Stellar Asset Contract to act as USDC.
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();

    let t = TestEnv {
        env,
        contract_addr,
        token_addr,
        admin,
        exporter,
        farmer,
        crop_id,
        total,
        per_phase,
    };

    // Configure USDC on the escrow and fund the exporter.
    t.escrow().set_usdc(&t.token_addr);
    t.token_admin().mint(&t.exporter, &total);

    // Initialize the escrow (takes custody of `total` from the exporter).
    let _ = t.escrow().init(&t.exporter, &t.farmer, &t.crop_id, &total, &per_phase);

    t
}

// Deploy escrow + token and configure USDC, but do NOT call init.
// Useful for exercising init error paths.
fn setup_no_init() -> TestEnv {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let exporter = Address::generate(&env);
    let farmer = Address::generate(&env);

    let contract_addr = env.register(Contract, (&admin,));
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();

    let t = TestEnv {
        env,
        contract_addr,
        token_addr,
        admin,
        exporter,
        farmer,
        crop_id: 1,
        total: 5000,
        per_phase: 1000,
    };

    t.escrow().set_usdc(&t.token_addr);
    t.token_admin().mint(&t.exporter, &t.total);
    t
}

// ==================================================================
// Constructor / set_usdc tests
// ==================================================================

#[test]
fn test_set_usdc_works() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_addr = env.register(Contract, (&admin,));
    let client = ContractClient::new(&env, &contract_addr);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();

    // Admin is mocked, so set_usdc should succeed.
    let res = client.try_set_usdc(&token_addr);
    assert!(res.is_ok());
}

#[test]
fn test_set_usdc_unauthorized() {
    let env = Env::default();
    // No mock_all_auths -> require_auth will fail (panic).

    let admin = Address::generate(&env);
    let contract_addr = env.register(Contract, (&admin,));
    let client = ContractClient::new(&env, &contract_addr);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();

    // set_usdc -> require_admin -> admin.require_auth() -> panic.
    let res = client.try_set_usdc(&token_addr);
    assert!(res.is_err());
}

// ==================================================================
// init tests
// ==================================================================

#[test]
fn test_init_success() {
    let t = setup(5000, 1000, 1);

    // Contract took custody of the full amount from the exporter.
    assert_eq!(t.token().balance(&t.contract_addr), 5000);
    assert_eq!(t.token().balance(&t.exporter), 0);

    // Escrow state should be Active with no phases released yet.
    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.status, EscrowStatus::Active);
    assert_eq!(state.current_phase, 0);
    assert_eq!(state.released_amount, 0);
    assert_eq!(state.withdrawn_amount, 0);
    assert_eq!(state.total_amount, 5000);
    assert_eq!(state.amount_per_phase, 1000);
}

#[test]
fn test_init_invalid_amount_zero() {
    let t = setup_no_init();
    let res = t.escrow().try_init(&t.exporter, &t.farmer, &1, &0, &1000);
    assert_eq!(res, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn test_init_invalid_amount_negative() {
    let t = setup_no_init();
    let res = t
        .escrow()
        .try_init(&t.exporter, &t.farmer, &1, &5000, &(-1));
    assert_eq!(res, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn test_init_not_divisible() {
    let t = setup_no_init();
    let res = t
        .escrow()
        .try_init(&t.exporter, &t.farmer, &1, &5000, &3000);
    assert_eq!(res, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn test_init_already_initialized() {
    let t = setup(5000, 1000, 1);

    // Crop 1 already exists; a second init for the same id must fail.
    let res = t
        .escrow()
        .try_init(&t.exporter, &t.farmer, &1, &5000, &1000);
    assert_eq!(res, Err(Ok(ContractError::AlreadyInitialized)));
}

#[test]
fn test_init_usdc_not_configured() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let exporter = Address::generate(&env);
    let farmer = Address::generate(&env);

    // Deploy escrow but do NOT call set_usdc.
    let contract_addr = env.register(Contract, (&admin,));
    let client = ContractClient::new(&env, &contract_addr);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = token::StellarAssetClient::new(&env, &token_addr);
    token_admin.mint(&exporter, &5000);

    let res = client.try_init(&exporter, &farmer, &1, &5000, &1000);
    assert_eq!(res, Err(Ok(ContractError::UsdcNotConfigured)));
}

#[test]
fn test_init_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let exporter = Address::generate(&env);
    let farmer = Address::generate(&env);

    let contract_addr = env.register(Contract, (&admin,));
    let client = ContractClient::new(&env, &contract_addr);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = token::StellarAssetClient::new(&env, &token_addr);

    // Configure USDC and fund the exporter while auth is still mocked.
    client.set_usdc(&token_addr);
    token_admin.mint(&exporter, &5000);

    // Disable auth mocking so exporter.require_auth() inside init will fail.
    env.set_auths(&[]);

    let res = client.try_init(&exporter, &farmer, &1, &5000, &1000);
    assert!(res.is_err());
}

// ==================================================================
// release_phase tests
// ==================================================================

#[test]
fn test_release_phase_success() {
    let t = setup(5000, 1000, 1);

    // Release phase 1 -> enables 1000 for withdrawal, funds stay in contract.
    t.escrow().release_phase(&1, &1);

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.current_phase, 1);
    assert_eq!(state.released_amount, 1000);
    assert_eq!(state.withdrawn_amount, 0);
    assert_eq!(state.status, EscrowStatus::Active);

    // Funds remain in the contract until the farmer withdraws.
    assert_eq!(t.token().balance(&t.farmer), 0);
    assert_eq!(t.token().balance(&t.contract_addr), 5000);
}

#[test]
fn test_release_all_phases_completes() {
    let t = setup(5000, 1000, 1);

    for phase in 1..=5u32 {
        t.escrow().release_phase(&1, &phase);
    }

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.current_phase, 5);
    assert_eq!(state.released_amount, 5000);
    assert_eq!(state.withdrawn_amount, 0);
    assert_eq!(state.status, EscrowStatus::Completed);

    // All funds enabled but none withdrawn; contract still holds everything.
    assert_eq!(t.token().balance(&t.farmer), 0);
    assert_eq!(t.token().balance(&t.contract_addr), 5000);
}

#[test]
fn test_release_phase_when_frozen() {
    let t = setup(5000, 1000, 1);

    // Freeze the escrow via admin (auth mocked).
    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);

    let res = t.escrow().try_release_phase(&1, &1);
    assert_eq!(res, Err(Ok(ContractError::EscrowFrozen)));

    // Farmer should have received nothing.
    assert_eq!(t.token().balance(&t.farmer), 0);
}

#[test]
fn test_release_phase_out_of_order() {
    let t = setup(5000, 1000, 1);

    // Try to release phase 2 before phase 1.
    let res = t.escrow().try_release_phase(&1, &2);
    assert_eq!(res, Err(Ok(ContractError::InvalidPhase)));
}

#[test]
fn test_release_when_completed() {
    let t = setup(5000, 1000, 1);

    for phase in 1..=5u32 {
        t.escrow().release_phase(&1, &phase);
    }

    // Try to release a 6th phase once Completed.
    let res = t.escrow().try_release_phase(&1, &6);
    assert_eq!(res, Err(Ok(ContractError::InvalidPhase)));
}

#[test]
fn test_release_phase_not_found() {
    let t = setup(5000, 1000, 1);

    // crop_id 999 has no escrow.
    let res = t.escrow().try_release_phase(&999, &1);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}

#[test]
fn test_release_phase_unauthorized() {
    let t = setup(5000, 1000, 1);

    // Disable auth mocking so exporter.require_auth() inside release fails.
    t.env.set_auths(&[]);

    let res = t.escrow().try_release_phase(&1, &1);
    assert!(res.is_err());
}

// ==================================================================
// trigger_disaster tests
// ==================================================================

#[test]
fn test_trigger_disaster_success() {
    let t = setup(5000, 1000, 1);

    // Contract still holds all funds before the disaster.
    assert_eq!(t.token().balance(&t.contract_addr), 5000);

    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.status, EscrowStatus::Frozen);

    // A frozen escrow cannot release funds; verify nothing moved.
    assert_eq!(t.token().balance(&t.contract_addr), 5000);
    assert_eq!(t.token().balance(&t.farmer), 0);
}

#[test]
fn test_trigger_disaster_party_mismatch() {
    let t = setup(5000, 1000, 1);

    let wrong_farmer = Address::generate(&t.env);

    let res = t
        .escrow()
        .try_trigger_disaster(&t.exporter, &wrong_farmer, &1);
    assert_eq!(res, Err(Ok(ContractError::PartyMismatch)));
}

#[test]
fn test_trigger_disaster_not_found() {
    let t = setup(5000, 1000, 1);

    let res = t
        .escrow()
        .try_trigger_disaster(&t.exporter, &t.farmer, &999);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}

#[test]
fn test_trigger_disaster_unauthorized() {
    let t = setup(5000, 1000, 1);

    // Disable auth mocking so admin.require_auth() inside trigger fails.
    t.env.set_auths(&[]);

    let res = t
        .escrow()
        .try_trigger_disaster(&t.exporter, &t.farmer, &1);
    assert!(res.is_err());
}

// ==================================================================
// reset_escrow tests
// ==================================================================

#[test]
fn test_reset_escrow_full_refund() {
    let t = setup(5000, 1000, 1);

    // No phases released yet -> full 5000 should return to exporter.
    assert_eq!(t.token().balance(&t.contract_addr), 5000);
    assert_eq!(t.token().balance(&t.exporter), 0);

    t.escrow().reset_escrow(&1);

    // Exporter got all funds back, contract holds nothing.
    assert_eq!(t.token().balance(&t.exporter), 5000);
    assert_eq!(t.token().balance(&t.contract_addr), 0);

    // Escrow no longer exists.
    let res = t.escrow().try_get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}

#[test]
fn test_reset_escrow_partial_refund() {
    let t = setup(5000, 1000, 1);

    // Release 2 phases (enables 2000), then reset. Funds never left the contract.
    t.escrow().release_phase(&1, &1);
    t.escrow().release_phase(&1, &2);

    assert_eq!(t.token().balance(&t.farmer), 0);
    assert_eq!(t.token().balance(&t.contract_addr), 5000);

    t.escrow().reset_escrow(&1);

    // Nothing was withdrawn, so full 5000 returns to exporter.
    assert_eq!(t.token().balance(&t.exporter), 5000);
    assert_eq!(t.token().balance(&t.contract_addr), 0);
    // Farmer keeps nothing (no withdrawals were made).
    assert_eq!(t.token().balance(&t.farmer), 0);
}

#[test]
fn test_reset_escrow_allows_reinit() {
    let t = setup(5000, 1000, 1);

    t.escrow().reset_escrow(&1);

    // Exporter now has 5000 back; re-init with same crop_id should work.
    let res = t.escrow().try_init(&t.exporter, &t.farmer, &1, &5000, &1000);
    assert!(res.is_ok());

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.current_phase, 0);
    assert_eq!(state.status, EscrowStatus::Active);
}

#[test]
fn test_reset_escrow_when_frozen() {
    let t = setup(5000, 1000, 1);

    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);

    // Reset should still work on frozen escrows.
    t.escrow().reset_escrow(&1);

    assert_eq!(t.token().balance(&t.exporter), 5000);

    let res = t.escrow().try_get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}

#[test]
fn test_reset_escrow_not_found() {
    let t = setup(5000, 1000, 1);

    let res = t.escrow().try_reset_escrow(&999);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}

#[test]
fn test_reset_escrow_unauthorized() {
    let t = setup(5000, 1000, 1);

    // Disable auth mocking so admin.require_auth() fails.
    t.env.set_auths(&[]);

    let res = t.escrow().try_reset_escrow(&1);
    assert!(res.is_err());
}

// ==================================================================
// resolve_disaster tests
// ==================================================================

#[test]
fn test_resolve_disaster_success() {
    let t = setup(5000, 1000, 1);

    // Freeze the escrow with full funds still in the contract.
    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);

    // Resolve: 30% rescue to farmer, 70% refund to exporter.
    t.escrow().resolve_disaster(&1, &3000);

    // Farmer gets 30% rescue: 5000 * 30% = 1500.
    assert_eq!(t.token().balance(&t.farmer), 1500);
    // Exporter gets 70% refund: 5000 * 70% = 3500.
    assert_eq!(t.token().balance(&t.exporter), 3500);
    // Contract is fully drained.
    assert_eq!(t.token().balance(&t.contract_addr), 0);

    // Escrow no longer exists.
    let res = t.escrow().try_get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}

#[test]
fn test_resolve_disaster_partial_release() {
    let t = setup(5000, 1000, 1);

    // Release 2 phases (enables 2000, funds stay in contract), then freeze.
    t.escrow().release_phase(&1, &1);
    t.escrow().release_phase(&1, &2);
    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);

    // Nothing withdrawn, contract still holds full 5000.
    // 30% rescue = 1500, 70% refund = 3500.
    t.escrow().resolve_disaster(&1, &3000);

    // Farmer gets 30% rescue of the full 5000 (nothing was withdrawn).
    assert_eq!(t.token().balance(&t.farmer), 1500);
    // Exporter gets 70% refund of the full 5000.
    assert_eq!(t.token().balance(&t.exporter), 3500);
    assert_eq!(t.token().balance(&t.contract_addr), 0);
}

#[test]
fn test_resolve_disaster_not_frozen() {
    let t = setup(5000, 1000, 1);

    // Active escrow cannot be resolved.
    let res = t.escrow().try_resolve_disaster(&1, &3000);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFrozen)));
}

#[test]
fn test_resolve_disaster_not_found() {
    let t = setup(5000, 1000, 1);

    let res = t.escrow().try_resolve_disaster(&999, &3000);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}

#[test]
fn test_resolve_disaster_unauthorized() {
    let t = setup(5000, 1000, 1);

    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);

    // Disable auth mocking so admin.require_auth() fails.
    t.env.set_auths(&[]);

    let res = t.escrow().try_resolve_disaster(&1, &3000);
    assert!(res.is_err());
}

#[test]
fn test_resolve_disaster_allows_reinit() {
    let t = setup(5000, 1000, 1);

    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);
    t.escrow().resolve_disaster(&1, &3000);

    // After resolve, exporter has 3500 back; re-init with 3000 (3 phases).
    let res = t.escrow().try_init(&t.exporter, &t.farmer, &1, &3000, &1000);
    assert!(res.is_ok());

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.current_phase, 0);
    assert_eq!(state.status, EscrowStatus::Active);
}

#[test]
fn test_resolve_disaster_invalid_bps() {
    let t = setup(5000, 1000, 1);

    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);

    // bps > 10_000 is invalid.
    let res = t.escrow().try_resolve_disaster(&1, &10_001);
    assert_eq!(res, Err(Ok(ContractError::InvalidAmount)));
}

// ==================================================================
// withdraw tests
// ==================================================================

#[test]
fn test_withdraw_success() {
    let t = setup(5000, 1000, 1);

    // Release phase 1 -> enables 1000 for withdrawal.
    t.escrow().release_phase(&1, &1);

    // Farmer withdraws 600.
    t.escrow().withdraw(&1, &600);

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.released_amount, 1000);
    assert_eq!(state.withdrawn_amount, 600);

    // Farmer received 600, contract dropped by 600.
    assert_eq!(t.token().balance(&t.farmer), 600);
    assert_eq!(t.token().balance(&t.contract_addr), 4400);
}

#[test]
fn test_withdraw_full_enabled() {
    let t = setup(5000, 1000, 1);

    // Release all 5 phases -> 5000 enabled.
    for phase in 1..=5u32 {
        t.escrow().release_phase(&1, &phase);
    }

    // Withdraw everything that was enabled.
    t.escrow().withdraw(&1, &5000);

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.status, EscrowStatus::Completed);
    assert_eq!(state.withdrawn_amount, 5000);

    assert_eq!(t.token().balance(&t.farmer), 5000);
    assert_eq!(t.token().balance(&t.contract_addr), 0);
}

#[test]
fn test_withdraw_partial_then_rest() {
    let t = setup(5000, 1000, 1);

    t.escrow().release_phase(&1, &1);
    t.escrow().withdraw(&1, &400);

    // Remaining enabled = 600.
    t.escrow().withdraw(&1, &600);

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.withdrawn_amount, 1000);

    assert_eq!(t.token().balance(&t.farmer), 1000);
    assert_eq!(t.token().balance(&t.contract_addr), 4000);
}

#[test]
fn test_withdraw_exceeds_enabled() {
    let t = setup(5000, 1000, 1);

    // Release 1 phase -> 1000 enabled.
    t.escrow().release_phase(&1, &1);

    // Try to withdraw more than enabled.
    let res = t.escrow().try_withdraw(&1, &1001);
    assert_eq!(res, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn test_withdraw_without_release() {
    let t = setup(5000, 1000, 1);

    // Nothing released yet -> nothing to withdraw.
    let res = t.escrow().try_withdraw(&1, &1);
    assert_eq!(res, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn test_withdraw_zero_or_negative() {
    let t = setup(5000, 1000, 1);

    t.escrow().release_phase(&1, &1);

    let res = t.escrow().try_withdraw(&1, &0);
    assert_eq!(res, Err(Ok(ContractError::InvalidAmount)));

    let res = t.escrow().try_withdraw(&1, &(-1));
    assert_eq!(res, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn test_withdraw_not_found() {
    let t = setup(5000, 1000, 1);

    let res = t.escrow().try_withdraw(&999, &100);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}

#[test]
fn test_withdraw_unauthorized() {
    let t = setup(5000, 1000, 1);

    t.escrow().release_phase(&1, &1);

    // Disable auth mocking so admin.require_auth() fails.
    t.env.set_auths(&[]);

    let res = t.escrow().try_withdraw(&1, &100);
    assert!(res.is_err());
}

#[test]
fn test_withdraw_after_freeze() {
    let t = setup(5000, 1000, 1);

    // Release 1 phase, then freeze.
    t.escrow().release_phase(&1, &1);
    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);

    // The farmer can still withdraw what was already enabled before the freeze.
    t.escrow().withdraw(&1, &1000);

    let state = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &1);
    assert_eq!(state.status, EscrowStatus::Frozen);
    assert_eq!(state.withdrawn_amount, 1000);

    assert_eq!(t.token().balance(&t.farmer), 1000);
    assert_eq!(t.token().balance(&t.contract_addr), 4000);
}

#[test]
fn test_withdraw_after_partial_withdraw_then_resolve() {
    let t = setup(5000, 1000, 1);

    // Release 2 phases (2000 enabled), withdraw 500.
    t.escrow().release_phase(&1, &1);
    t.escrow().release_phase(&1, &2);
    t.escrow().withdraw(&1, &500);

    assert_eq!(t.token().balance(&t.contract_addr), 4500);

    // Freeze and resolve: remaining in contract = 5000 - 500 = 4500.
    t.escrow().trigger_disaster(&t.exporter, &t.farmer, &1);
    t.escrow().resolve_disaster(&1, &3000);

    // Farmer: 500 (withdrawn) + 30% of 4500 (1350 rescue) = 1850.
    assert_eq!(t.token().balance(&t.farmer), 1850);
    // Exporter: 70% of 4500 = 3150.
    assert_eq!(t.token().balance(&t.exporter), 3150);
    assert_eq!(t.token().balance(&t.contract_addr), 0);
}

#[test]
fn test_withdraw_after_partial_withdraw_then_reset() {
    let t = setup(5000, 1000, 1);

    // Release 1 phase (1000 enabled), withdraw 300.
    t.escrow().release_phase(&1, &1);
    t.escrow().withdraw(&1, &300);

    assert_eq!(t.token().balance(&t.contract_addr), 4700);

    // Reset: remaining = 5000 - 300 = 4700 returns to exporter.
    t.escrow().reset_escrow(&1);

    assert_eq!(t.token().balance(&t.exporter), 4700);
    assert_eq!(t.token().balance(&t.farmer), 300);
    assert_eq!(t.token().balance(&t.contract_addr), 0);
}

// ==================================================================
// get_escrow_state tests
// ==================================================================

#[test]
fn test_get_escrow_state_success() {
    let t = setup(5000, 1000, 42);

    let state: EscrowData = t.escrow().get_escrow_state(&t.exporter, &t.farmer, &42);

    assert_eq!(state.exporter, t.exporter);
    assert_eq!(state.farmer, t.farmer);
    assert_eq!(state.crop_id, 42);
    assert_eq!(state.total_amount, 5000);
    assert_eq!(state.amount_per_phase, 1000);
    assert_eq!(state.current_phase, 0);
    assert_eq!(state.released_amount, 0);
    assert_eq!(state.withdrawn_amount, 0);
    assert_eq!(state.status, EscrowStatus::Active);
}

#[test]
fn test_get_escrow_state_party_mismatch() {
    let t = setup(5000, 1000, 1);

    let wrong_exporter = Address::generate(&t.env);

    let res = t
        .escrow()
        .try_get_escrow_state(&wrong_exporter, &t.farmer, &1);
    assert_eq!(res, Err(Ok(ContractError::PartyMismatch)));
}

#[test]
fn test_get_escrow_state_not_found() {
    let t = setup(5000, 1000, 1);

    let res = t
        .escrow()
        .try_get_escrow_state(&t.exporter, &t.farmer, &999);
    assert_eq!(res, Err(Ok(ContractError::EscrowNotFound)));
}