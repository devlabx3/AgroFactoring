// --- Supabase table row types ---

export interface Contract {
  id: string;
  crop_id: string;
  exporter_id: string;
  total_amount: number;
  current_phase: number;
  status: ContractStatus;
  stellar_contract_id: string | null;
  emulator_active: boolean;
  emulator_started_at: string | null;
  emulator_time_left_minutes: number;
  created_at: string;
}

export type ContractStatus = "active" | "frozen" | "resolved" | "completed";

/**
 * A contract is "locked" when it's frozen OR has been resolved after a
 * disaster. In both states the UI shows the frozen banner, blocks phase
 * releases, and hides the disaster trigger — the only difference is that a
 * resolved contract no longer offers the "Resolve Disaster" button.
 *
 * Use this instead of `status === "frozen"` in any UI/API that should treat
 * the post-resolve state as visually still frozen.
 */
export function isContractLocked(status: ContractStatus): boolean {
  return status === "frozen" || status === "resolved";
}

export interface Crop {
  id: string;
  farmer_id: string;
  crop_type: string;
  variety: string;
  estimated_tons: number;
  total_funding_requested: number;
  status: string;
  created_at: string;
}

export interface Profile {
  id: string;
  role: string;
  username: string;
  wallet_address: string;
}

export interface Phase {
  id: string;
  phase_number: number;
  phase_name: string;
  amount_requested: number;
}

export interface LedgerEntry {
  id: string;
  phase_number: number;
  tx_hash: string;
  amount_released: number;
  timestamp: string;
}

export interface WithdrawalEntry {
  id: string;
  amount: number;
  bank_name: string | null;
  account_last4: string | null;
  tx_hash: string;
  status: "completed" | "failed";
  timestamp: string;
}

// --- API response types ---

export interface DashboardState {
  success: boolean;
  auto_stopped: boolean;
  contract: Contract;
  crop: Crop | null;
  farmer: Profile | null;
  exporter: Profile | null;
  phases: Phase[];
  ledger: LedgerEntry[];
  withdrawals: WithdrawalEntry[];
}

export interface ContractListResponse {
  success: boolean;
  contracts: ContractListItem[];
}

export interface ContractListItem {
  id: string;
  crop_id: string;
  exporter_id: string;
  total_amount: number;
  current_phase: number;
  status: ContractStatus;
  stellar_contract_id: string | null;
  created_at: string;
}

export interface InitDataResponse {
  success: boolean;
  contract_id: string;
  farmer_address: string;
  crop_id_num: number;
  total_amount_stroops: string;
  phase_amount_stroops: string;
}

export interface ReleaseDataResponse {
  success: boolean;
  crop_id_num: number;
  new_phase_num: number;
}

export interface DisasterResponse {
  success: boolean;
  tx_hash: string;
  warning?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  detail?: string;
}

export const DEMO_CONTRACT_PLACEHOLDER = "CONTRATO_DEMO_AQUI_SE_CAMBIARA_DESPUES";
