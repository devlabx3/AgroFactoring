import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  rpc,
  networkPassphrase,
  getContract,
  getOracleKeypair,
  StellarSdk,
} from "@/lib/stellar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MAX_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  let contractId: string | null = null;
  let contract: { id: string; crop_id: string; stellar_contract_id: string | null } | null = null;

  try {
    const body = await request.json();
    contractId = body?.contract_id;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Falta contract_id" },
        { status: 400 }
      );
    }

    const { data: contractRow, error: fetchError } = await supabase
      .from("contracts")
      .select("id, crop_id, stellar_contract_id")
      .eq("id", contractId)
      .maybeSingle();

    if (fetchError || !contractRow) {
      return NextResponse.json(
        { success: false, error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    contract = contractRow;

    // Always attempt on-chain reset_escrow — the DB flag may have been
    // cleared by a previous (DB-only) reset while the escrow still lives
    // on-chain. If the escrow doesn't exist, the simulation fails with
    // EscrowNotFound (#4) and we silently continue with the DB cleanup.
    const { data: crop } = await supabase
      .from("crops")
      .select("crop_id_num")
      .eq("id", contract.crop_id)
      .maybeSingle();

    if (crop) {
      try {
        const cropIdScVal = StellarSdk.nativeToScVal(BigInt(crop.crop_id_num), {
          type: "u64",
        });

        const oracleKeypair = getOracleKeypair();
        const oracleAccount = await rpc.getAccount(oracleKeypair.publicKey());
        const contractInstance = getContract();

        const transaction = new StellarSdk.TransactionBuilder(oracleAccount, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase,
        })
          .addOperation(contractInstance.call("reset_escrow", cropIdScVal))
          .setTimeout(180)
          .build();

        const simulation = await rpc.simulateTransaction(transaction);

        if (!StellarSdk.rpc.Api.isSimulationError(simulation)) {
          const preparedTx = StellarSdk.rpc.assembleTransaction(
            transaction,
            simulation
          ).build();

          preparedTx.sign(oracleKeypair);

          const sendResponse = await rpc.sendTransaction(preparedTx);

          if (sendResponse.status !== "ERROR") {
            let getResponse = await rpc.getTransaction(sendResponse.hash);
            let attempts = 0;

            while (getResponse.status === "NOT_FOUND" && attempts < POLL_MAX_ATTEMPTS) {
              await sleep(POLL_INTERVAL_MS);
              getResponse = await rpc.getTransaction(sendResponse.hash);
              attempts++;
            }
          }
        }
        // If simulation fails (e.g. EscrowNotFound), we skip silently —
        // the escrow doesn't exist on-chain, nothing to reset.
      } catch (onChainErr) {
        // On-chain reset failed (network, auth, etc.) — log and continue
        // with the DB cleanup so the UI is always reset consistently.
        console.error("reset_escrow on-chain failed:", onChainErr);
      }
    }
  } catch (err) {
    // Body parse or DB fetch failed before we could identify the contract.
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // --- DB cleanup: always run, even if the on-chain reset failed ---
  if (!contractId) {
    return NextResponse.json(
      { success: false, error: "Falta contract_id" },
      { status: 400 }
    );
  }

  // Delete withdrawal entries.
  const { error: withdrawalDeleteError } = await supabase
    .from("withdrawals")
    .delete()
    .eq("contract_id", contractId);

  // Delete ledger entries.
  const { error: ledgerDeleteError } = await supabase
    .from("phase_ledger")
    .delete()
    .eq("contract_id", contractId);

  // Reset contract to initial state.
  const { error: updateError } = await supabase
    .from("contracts")
    .update({
      stellar_contract_id: null,
      current_phase: 0,
      status: "active",
      emulator_active: false,
      emulator_started_at: null,
    })
    .eq("id", contractId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "Error al resetear el contrato" },
      { status: 500 }
    );
  }

  if (ledgerDeleteError || withdrawalDeleteError) {
    return NextResponse.json(
      {
        success: true,
        warning:
          "Contrato reseteado pero hubo errores al limpiar el historial de liberaciones/retiros",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
