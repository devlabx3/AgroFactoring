import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isContractLocked } from "@/features/dashboard/types";

export const dynamic = "force-dynamic";

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
      .select("id, crop_id, current_phase, status")
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
        { success: false, error: "El contrato está congelado" },
        { status: 409 }
      );
    }

    const newPhaseNum = (contract.current_phase ?? 0) + 1;

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

    return NextResponse.json(
      {
        success: true,
        crop_id_num: crop.crop_id_num,
        new_phase_num: newPhaseNum,
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
