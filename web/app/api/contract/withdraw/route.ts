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
const STROOPS_PER_UNIT = 10_000_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toStroops(amount: string | number | null | undefined): bigint {
  if (amount === null || amount === undefined) return BigInt(0);
  return BigInt(Math.round(Number(amount) * STROOPS_PER_UNIT));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contractId = body?.contract_id;
    const amount = Number(body?.amount);
    const bankName = body?.bank_name ?? null;
    const accountLast4 = body?.account_last4 ?? null;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Falta contract_id" },
        { status: 400 }
      );
    }
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    // Load the contract row.
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

    // Load the crop to get crop_id_num and farmer_id.
    const { data: crop, error: cropError } = await supabase
      .from("crops")
      .select("crop_id_num, farmer_id")
      .eq("id", contract.crop_id)
      .maybeSingle();

    if (cropError || !crop) {
      return NextResponse.json(
        { success: false, error: "No se pudo resolver el cultivo" },
        { status: 500 }
      );
    }

    // The contract's withdraw function uses escrow.farmer (the on-chain
    // address from init) for the transfer — it does not take a farmer
    // address parameter. So we don't need the DB wallet here; the contract
    // handles the transfer to the correct on-chain farmer automatically.
    // We only need crop.farmer_id to record the withdrawal in the DB.

    // Compute the available balance:
    //   totalReleased (from phase_ledger) - totalWithdrawn (from withdrawals)
    const { data: ledgerRows } = await supabase
      .from("phase_ledger")
      .select("amount_released")
      .eq("contract_id", contractId);

    const totalReleased =
      ledgerRows?.reduce(
        (sum, row) => sum + (row.amount_released ?? 0),
        0
      ) ?? 0;

    const { data: withdrawalRows } = await supabase
      .from("withdrawals")
      .select("amount")
      .eq("contract_id", contractId)
      .eq("status", "completed");

    const totalWithdrawn =
      withdrawalRows?.reduce((sum, row) => sum + row.amount, 0) ?? 0;

    const availableBalance = totalReleased - totalWithdrawn;

    if (amount > availableBalance) {
      return NextResponse.json(
        {
          success: false,
          error: `Saldo insuficiente. Disponible: ${availableBalance} USDC`,
        },
        { status: 400 }
      );
    }

    // Build the on-chain withdraw(crop_id, amount) call.
    const cropIdScVal = StellarSdk.nativeToScVal(BigInt(crop.crop_id_num), {
      type: "u64",
    });
    const amountStroops = toStroops(amount);
    const amountScVal = StellarSdk.nativeToScVal(amountStroops, {
      type: "i128",
    });

    const oracleKeypair = getOracleKeypair();
    const oracleAccount = await rpc.getAccount(oracleKeypair.publicKey());
    const contractInstance = getContract();

    const transaction = new StellarSdk.TransactionBuilder(oracleAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contractInstance.call("withdraw", cropIdScVal, amountScVal)
      )
      .setTimeout(180)
      .build();

    const simulation = await rpc.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
      return NextResponse.json(
        {
          success: false,
          error: parseSimulationError(simulation.error, "withdraw"),
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
          error: "Envio de transaccion fallido",
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
      // Record a failed withdrawal so the balance stays consistent.
      await supabase.from("withdrawals").insert({
        contract_id: contractId,
        farmer_id: crop.farmer_id,
        amount,
        bank_name: bankName,
        account_last4: accountLast4,
        tx_hash: txHash,
        status: "failed",
      });

      return NextResponse.json(
        {
          success: false,
          error: "Timeout esperando confirmacion de la transaccion",
          tx_hash: txHash,
        },
        { status: 504 }
      );
    }

    if (getResponse.status !== "SUCCESS") {
      await supabase.from("withdrawals").insert({
        contract_id: contractId,
        farmer_id: crop.farmer_id,
        amount,
        bank_name: bankName,
        account_last4: accountLast4,
        tx_hash: txHash,
        status: "failed",
      });

      return NextResponse.json(
        {
          success: false,
          error: `Transaccion finalizada con estado: ${getResponse.status}`,
          tx_hash: txHash,
        },
        { status: 400 }
      );
    }

    // On-chain success: record the completed withdrawal in Supabase.
    const { error: insertError } = await supabase
      .from("withdrawals")
      .insert({
        contract_id: contractId,
        farmer_id: crop.farmer_id,
        amount,
        bank_name: bankName,
        account_last4: accountLast4,
        tx_hash: txHash,
        status: "completed",
      });

    if (insertError) {
      return NextResponse.json(
        {
          success: true,
          tx_hash: txHash,
          warning: "On-chain exitoso pero fallo al registrar en Supabase",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        tx_hash: txHash,
        amount,
      },
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
