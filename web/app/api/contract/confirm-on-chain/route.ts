import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { sendCopToFarmer } from "@/lib/stellar";
import { DEFAULT_FARMER_WALLET } from "@/features/stellar/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contractId = body?.contract_id;
    const txType = body?.tx_type;
    const txHash = body?.tx_hash;
    const newPhase = body?.new_phase;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Falta contract_id" },
        { status: 400 }
      );
    }
    if (txType !== "init" && txType !== "release") {
      return NextResponse.json(
        { success: false, error: "tx_type debe ser 'init' o 'release'" },
        { status: 400 }
      );
    }
    if (!txHash) {
      return NextResponse.json(
        { success: false, error: "Falta tx_hash" },
        { status: 400 }
      );
    }

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, crop_id, exporter_id, onchain_farmer_wallet")
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

    if (txType === "init") {
      const { error: updateError } = await supabase
        .from("contracts")
        .update({ stellar_contract_id: txHash })
        .eq("id", contractId);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: "Error al confirmar la inicialización" },
          { status: 500 }
        );
      }

      // Save the exporter's Freighter wallet address to their profile so that
      // server-side operations (trigger_disaster, etc.) use the same address
      // that was stored on-chain during init.
      const exporterAddress = body?.exporter_address;
      if (exporterAddress && contract.exporter_id) {
        await supabase
          .from("profiles")
          .update({ wallet_address: exporterAddress })
          .eq("id", contract.exporter_id);
      }

      // Save the on-chain farmer wallet (the one used in the init tx) so that
      // trigger_disaster and other server-side calls use the exact address
      // stored in the on-chain EscrowData — even if the farmer later changes
      // their wallet in the profile.
      const farmerAddress = body?.farmer_address;
      if (farmerAddress) {
        await supabase
          .from("contracts")
          .update({ onchain_farmer_wallet: farmerAddress })
          .eq("id", contractId);
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (typeof newPhase !== "number") {
      return NextResponse.json(
        { success: false, error: "Falta new_phase para tx_type 'release'" },
        { status: 400 }
      );
    }

    const { data: phase } = await supabase
      .from("crop_phases_budget")
      .select("amount_requested")
      .eq("crop_id", contract.crop_id)
      .eq("phase_number", newPhase)
      .maybeSingle();

    const amountReleased = phase?.amount_requested ?? null;

    const { data: allPhases } = await supabase
      .from("crop_phases_budget")
      .select("phase_number")
      .eq("crop_id", contract.crop_id)
      .order("phase_number", { ascending: false });

    const maxPhase = allPhases && allPhases.length > 0 ? allPhases[0].phase_number : newPhase;
    const newStatus = newPhase >= maxPhase ? "completed" : "active";

    const { error: updateError } = await supabase
      .from("contracts")
      .update({ current_phase: newPhase, status: newStatus })
      .eq("id", contractId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Error al avanzar la fase" },
        { status: 500 }
      );
    }

    const { error: ledgerError } = await supabase
      .from("phase_ledger")
      .insert({
        contract_id: contractId,
        phase_number: newPhase,
        tx_hash: txHash,
        amount_released: amountReleased,
      });

    if (ledgerError) {
      return NextResponse.json(
        { success: false, error: "Error al registrar en el ledger" },
        { status: 500 }
      );
    }

    // Swap emulado USDC -> COP: el exportador liberó dólares (release_phase),
    // ahora el oráculo entrega al agricultor el equivalente en pesos desde su
    // reserva de COPD3. Es un paso off-chain independiente: si falla, la fase
    // ya quedó liberada y confirmada, así que devolvemos éxito con un aviso en
    // lugar de revertir el ledger.
    let copTxHash: string | null = null;
    let copAmount: number | null = null;
    let copWarning: string | null = null;

    if (amountReleased && amountReleased > 0) {
      // Resolver la wallet del agricultor: la registrada on-chain en el init
      // es la fuente de verdad; si falta, caer al perfil o al valor por defecto.
      let farmerWallet: string | null = contract.onchain_farmer_wallet ?? null;
      if (!farmerWallet) {
        const { data: crop } = await supabase
          .from("crops")
          .select("farmer_id")
          .eq("id", contract.crop_id)
          .maybeSingle();
        if (crop?.farmer_id) {
          const { data: farmer } = await supabase
            .from("profiles")
            .select("wallet_address")
            .eq("id", crop.farmer_id)
            .maybeSingle();
          farmerWallet = farmer?.wallet_address ?? null;
        }
      }
      farmerWallet = farmerWallet || DEFAULT_FARMER_WALLET;

      try {
        const swap = await sendCopToFarmer({
          farmerAddress: farmerWallet,
          usdcAmount: amountReleased,
        });
        copTxHash = swap.txHash;
        copAmount = swap.copAmount;
      } catch (swapErr) {
        copWarning =
          swapErr instanceof Error ? swapErr.message : String(swapErr);
        console.error("[confirm-on-chain] swap COP falló:", copWarning);
      }
    }

    return NextResponse.json(
      {
        success: true,
        cop_tx_hash: copTxHash,
        cop_amount: copAmount,
        cop_warning: copWarning,
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
