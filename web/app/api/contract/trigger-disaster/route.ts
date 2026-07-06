import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import {
  rpc,
  networkPassphrase,
  getContract,
  getOracleKeypair,
  StellarSdk,
} from "@/lib/stellar";
import { parseSimulationError } from "@/lib/contract-errors";
import { isContractLocked } from "@/features/dashboard/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MAX_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 1000;

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
      .select("id, crop_id, exporter_id, status, onchain_farmer_wallet")
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
    if (isContractLocked(contract.status)) {
      return NextResponse.json(
        { success: false, error: "El contrato ya está congelado" },
        { status: 409 }
      );
    }

    const { data: crop, error: cropError } = await supabase
      .from("crops")
      .select("crop_id_num, farmer_id")
      .eq("id", contract.crop_id)
      .maybeSingle();

    if (cropError || !crop) {
      return NextResponse.json(
        { success: false, error: "No se pudo resolver crop_id_num" },
        { status: 500 }
      );
    }

    // Load the exporter's wallet from their profile (saved at init from Freighter).
    const { data: exporterRow } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", contract.exporter_id)
      .maybeSingle();

    // Use the on-chain farmer wallet (saved at init confirm) so that
    // trigger_disaster matches the EscrowData on-chain even if the farmer
    // later changes their profile wallet. Fallback to profiles.wallet_address
    // for contracts initialized before onchain_farmer_wallet was added.
    const farmerWallet = contract.onchain_farmer_wallet ?? null;

    // If no on-chain wallet saved, try profiles as fallback.
    let farmerWalletFinal = farmerWallet;
    if (!farmerWalletFinal) {
      const { data: farmerRow } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", crop.farmer_id)
        .maybeSingle();
      farmerWalletFinal = farmerRow?.wallet_address ?? null;
    }

    if (!exporterRow?.wallet_address || !farmerWalletFinal) {
      return NextResponse.json(
        { success: false, error: "Falta wallet_address del exporter o farmer" },
        { status: 404 }
      );
    }

    const exporterScVal = StellarSdk.Address.fromString(
      exporterRow.wallet_address
    ).toScVal();
    const farmerScVal = StellarSdk.Address.fromString(
      farmerWalletFinal
    ).toScVal();
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
      .addOperation(
        contractInstance.call(
          "trigger_disaster",
          exporterScVal,
          farmerScVal,
          cropIdScVal
        )
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
            "trigger_disaster"
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

    const { error: updateError } = await supabase
      .from("contracts")
      .update({ status: "frozen" })
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
