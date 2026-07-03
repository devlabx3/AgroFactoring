import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { enforceAutoStop, computeTimeLeftMinutes } from "@/lib/emulator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const contractId = request.nextUrl.searchParams.get("contract_id");

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Falta contract_id" },
        { status: 400 }
      );
    }

    const autoStop = await enforceAutoStop(contractId);

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select(
        "id, crop_id, exporter_id, total_amount, current_phase, status, stellar_contract_id, emulator_active, emulator_started_at, created_at"
      )
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

    const cropId = contract.crop_id;
    const farmerId: string | null = null;
    const exporterId = contract.exporter_id;

    const cropPromise = supabase
      .from("crops")
      .select(
        "id, farmer_id, crop_type, variety, estimated_tons, total_funding_requested, status, created_at"
      )
      .eq("id", cropId)
      .maybeSingle();

    const phasesPromise = supabase
      .from("crop_phases_budget")
      .select("id, phase_number, phase_name, amount_requested")
      .eq("crop_id", cropId)
      .order("phase_number", { ascending: true });

    const ledgerPromise = supabase
      .from("phase_ledger")
      .select("id, phase_number, tx_hash, amount_released, timestamp")
      .eq("contract_id", contractId)
      .order("phase_number", { ascending: true });

    const withdrawalsPromise = supabase
      .from("withdrawals")
      .select("id, amount, bank_name, account_last4, tx_hash, status, timestamp")
      .eq("contract_id", contractId)
      .order("timestamp", { ascending: false });

    const [cropResult, phasesResult, ledgerResult, withdrawalsResult] = await Promise.all([
      cropPromise,
      phasesPromise,
      ledgerPromise,
      withdrawalsPromise,
    ]);

    const crop = cropResult.data;
    const resolvedFarmerId = crop?.farmer_id ?? farmerId;

    let farmer = null;
    if (resolvedFarmerId) {
      const { data: farmerRow } = await supabase
        .from("profiles")
        .select("id, role, username, wallet_address")
        .eq("id", resolvedFarmerId)
        .maybeSingle();
      farmer = farmerRow;
    }

    let exporter = null;
    if (exporterId) {
      const { data: exporterRow } = await supabase
        .from("profiles")
        .select("id, role, username, wallet_address")
        .eq("id", exporterId)
        .maybeSingle();
      exporter = exporterRow;
    }

    const timeLeftMinutes = computeTimeLeftMinutes({
      emulator_active: contract.emulator_active,
      emulator_started_at: contract.emulator_started_at,
    });

    return NextResponse.json(
      {
        success: true,
        auto_stopped: autoStop.stopped,
        contract: {
          ...contract,
          emulator_active: contract.emulator_active ?? false,
          emulator_started_at: contract.emulator_started_at,
          emulator_time_left_minutes: timeLeftMinutes,
        },
        crop,
        farmer,
        exporter,
        phases: phasesResult.data ?? [],
        ledger: ledgerResult.data ?? [],
        withdrawals: withdrawalsResult.data ?? [],
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
