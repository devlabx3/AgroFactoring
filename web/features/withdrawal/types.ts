export interface Withdrawal {
  id: string;
  amount: number;
  bankName: string | null;
  accountLast4: string | null;
  txHash: string;
  status: "completed" | "failed";
  timestamp: string;
}

export interface WithdrawalResponse {
  success: boolean;
  tx_hash: string;
  amount: number;
  warning?: string;
  error?: string;
}
