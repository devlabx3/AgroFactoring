import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  rpc,
  networkPassphrase,
  getContract,
  getOracleKeypair,
  StellarSdk,
} from "@/lib/stellar";
import { parseSimulationError } from "@/lib/contract-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MAX_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 1000;

// 30% of the remaining balance goes to the farmer as a rescue fund; the
// remaining 70% is refunded to the exporter. Matches the README spec.
const RESCUE_BPS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contractId = body?.contract_id;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Falta contract_id" },
        { status: 400 }
      );
    }

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, crop_id, exporter_id, status, total_amount")
      .eq("id", contractId)
      .maybeSingle();

    if (contractError) {
      return NextResponse.json(
        { success: false, error: "Error al consultar el contrato" },
        { status: 500 }
      );
    }
    if (!contract) {
      return NextResponse.json(
        { success: false, error: "Contrato no encontrado" },
        { status: 404 }
      );
    }
    if (contract.status !== "frozen") {
      return NextResponse.json(
        {
          success: false,
          error: "El contrato no está congelado — solo se puede resolver un escrow congelado",
        },
        { status: 409 }
      );
    }

    const { data: crop, error: cropError } = await supabase
      .from("crops")
      .select("crop_id_num")
      .eq("id", contract.crop_id)
      .maybeSingle();

    if (cropError || !crop) {
      return NextResponse.json(
        { success: false, error: "No se pudo resolver crop_id_num" },
        { status: 500 }
      );
    }

    const cropIdScVal = StellarSdk.nativeToScVal(BigInt(crop.crop_id_num), {
      type: "u64",
    });
    const rescueBpsScVal = StellarSdk.nativeToScVal(RESCUE_BPS, {
      type: "u32",
    });

    const oracleKeypair = getOracleKeypair();
    const oracleAccount = await rpc.getAccount(oracleKeypair.publicKey());
    const contractInstance = getContract();

    const transaction = new StellarSdk.TransactionBuilder(oracleAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contractInstance.call("resolve_disaster", cropIdScVal, rescueBpsScVal)
      )
      .setTimeout(180)
      .build();

    const simulation = await rpc.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
      return NextResponse.json(
        {
          success: false,
          error: parseSimulationError(
            simulation.error,
            "resolve_disaster"
          ),
        },
        { status: 400 }
      );
    }

    const preparedTx = StellarSdk.rpc.assembleTransaction(
      transaction,
      simulation
    ).build();

    preparedTx.sign(oracleKeypair);

    const sendResponse = await rpc.sendTransaction(preparedTx);

    if (sendResponse.status === "ERROR") {
      return NextResponse.json(
        {
          success: false,
          error: "Envío de transacción fallido",
          detail: sendResponse.errorResult,
        },
        { status: 400 }
      );
    }

    const txHash = sendResponse.hash;
    let getResponse = await rpc.getTransaction(txHash);
    let attempts = 0;

    while (getResponse.status === "NOT_FOUND" && attempts < POLL_MAX_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
      getResponse = await rpc.getTransaction(txHash);
      attempts++;
    }

    if (getResponse.status === "NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          error: "Timeout esperando confirmación de la transacción",
          tx_hash: txHash,
        },
        { status: 504 }
      );
    }

    if (getResponse.status !== "SUCCESS") {
      return NextResponse.json(
        {
          success: false,
          error: `Transacción finalizada con estado: ${getResponse.status}`,
          tx_hash: txHash,
        },
        { status: 400 }
      );
    }

    // Compute the rescue amount (30% of remaining) to record in the ledger.
    // Use stroops (1 USDC = 10^7 stroops) so the 30% is not truncated to
    // zero for small balances (Math.floor in USDC units loses the fraction).
    const STROOPS_PER_UNIT = 10_000_000;
    const { data: ledgerRows } = await supabase
      .from("phase_ledger")
      .select("amount_released")
      .eq("contract_id", contractId);

    const released =
      ledgerRows?.reduce(
        (sum, row) => sum + (row.amount_released ?? 0),
        0
      ) ?? 0;
    const remainingStroops = Math.round(
      ((contract.total_amount ?? 0) - released) * STROOPS_PER_UNIT
    );
    const rescueStroops = Math.floor(
      (remainingStroops * RESCUE_BPS) / 10_000
    );
    const rescueAmount = rescueStroops / STROOPS_PER_UNIT;

    const { error: updateError } = await supabase
      .from("contracts")
      .update({ status: "resolved" })
      .eq("id", contractId);

    if (updateError) {
      return NextResponse.json(
        {
          success: true,
          tx_hash: txHash,
          warning: "On-chain exitoso pero fallo al actualizar Supabase",
        },
        { status: 200 }
      );
    }

    // Record the rescue payout in the ledger.
    if (rescueAmount > 0) {
      await supabase.from("phase_ledger").insert({
        contract_id: contractId,
        phase_number: 0,
        tx_hash: txHash,
        amount_released: rescueAmount,
      });
    }

    return NextResponse.json(
      { success: true, tx_hash: txHash },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
