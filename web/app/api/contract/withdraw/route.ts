import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
      .select("id, crop_id")
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

    // Load the crop to get farmer_id.
    const { data: crop, error: cropError } = await supabase
      .from("crops")
      .select("farmer_id")
      .eq("id", contract.crop_id)
      .maybeSingle();

    if (cropError || !crop) {
      return NextResponse.json(
        { success: false, error: "No se pudo resolver el cultivo" },
        { status: 500 }
      );
    }

    // Compute the available balance:
    //   totalReleased (phase_ledger) - totalConverted (withdrawals completed)
    // release_phase now sends USDC directly to the farmer's wallet on-chain,
    // so this endpoint only records the fiat-conversion request — no on-chain
    // transaction is needed.
    const { data: ledgerRows } = await supabase
      .from("phase_ledger")
      .select("amount_released")
      .eq("contract_id", contractId);

    const totalReleased =
      ledgerRows?.reduce((sum, row) => sum + (row.amount_released ?? 0), 0) ?? 0;

    const { data: withdrawalRows } = await supabaseAdmin
      .from("withdrawals")
      .select("amount")
      .eq("contract_id", contractId)
      .eq("status", "completed");

    const totalConverted =
      withdrawalRows?.reduce((sum, row) => sum + row.amount, 0) ?? 0;

    const availableToConvert = totalReleased - totalConverted;

    if (amount > availableToConvert) {
      return NextResponse.json(
        {
          success: false,
          error: `Saldo insuficiente. Disponible: ${availableToConvert} USDC`,
        },
        { status: 400 }
      );
    }

    // Generate a unique reference for this fiat-conversion record.
    const ref = `FIAT-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    const { error: insertError } = await supabaseAdmin
      .from("withdrawals")
      .insert({
        contract_id: contractId,
        farmer_id: crop.farmer_id,
        amount,
        bank_name: bankName,
        account_last4: accountLast4,
        tx_hash: ref,
        status: "completed",
      });

    if (insertError) {
      console.error("[withdraw] Supabase insert failed:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo registrar el retiro",
          detail: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, tx_hash: ref, amount },
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
