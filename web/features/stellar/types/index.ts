export type TxStep =
  | "idle"
  | "preparing"
  | "simulating"
  | "signing"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "error";

export interface TxStatus {
  step: TxStep;
  message: string;
  txHash?: string;
  error?: string;
  errorAtStep?: TxStep;
}

export const TX_STEPS_ORDER: TxStep[] = [
  "preparing",
  "simulating",
  "signing",
  "submitting",
  "confirming",
  "confirmed",
];
