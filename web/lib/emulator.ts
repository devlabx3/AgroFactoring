import { supabase } from "./supabase";

export const EMULATOR_MAX_SECONDS = 1800;

export type ContractEmulatorRow = {
  id: string;
  emulator_active: boolean | null;
  emulator_started_at: string | null;
  status: string | null;
};

export type EnforceAutoStopResult = {
  stopped: boolean;
  row: ContractEmulatorRow | null;
};

export async function enforceAutoStop(
  contractId: string
): Promise<EnforceAutoStopResult> {
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id, emulator_active, emulator_started_at, status"
    )
    .eq("id", contractId)
    .maybeSingle();

  if (error || !data) {
    return { stopped: false, row: null };
  }

  const row = data as ContractEmulatorRow;

  if (
    row.emulator_active === true &&
    row.emulator_started_at !== null
  ) {
    const startedAtMs = new Date(row.emulator_started_at).getTime();
    const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
    if (elapsedSeconds > EMULATOR_MAX_SECONDS) {
      await supabase
        .from("contracts")
        .update({ emulator_active: false })
        .eq("id", contractId);
      return { stopped: true, row: { ...row, emulator_active: false } };
    }
  }

  return { stopped: false, row };
}

export function computeTimeLeftMinutes(
  row: { emulator_active: boolean | null; emulator_started_at: string | null }
): number {
  if (row.emulator_active !== true || row.emulator_started_at === null) {
    return 0;
  }
  const startedAtMs = new Date(row.emulator_started_at).getTime();
  const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
  const remaining = EMULATOR_MAX_SECONDS - elapsedSeconds;
  if (remaining <= 0) return 0;
  return Math.floor(remaining / 60);
}
