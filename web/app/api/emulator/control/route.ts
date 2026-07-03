import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { enforceAutoStop } from "@/lib/emulator";
import { isContractLocked } from "@/features/dashboard/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action;
    const contractId = body?.contract_id;

    if (!action || (action !== "start" && action !== "stop")) {
      return NextResponse.json(
        { success: false, error: "action debe ser 'start' o 'stop'" },
        { status: 400 }
      );
    }
    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Falta contract_id" },
        { status: 400 }
      );
    }

    const autoStop = await enforceAutoStop(contractId);

    if (action === "start") {
      const { data: contract } = await supabase
        .from("contracts")
        .select("id, status")
        .eq("id", contractId)
        .maybeSingle();

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

      const { error } = await supabase
        .from("contracts")
        .update({
          emulator_active: true,
          emulator_started_at: new Date().toISOString(),
        })
        .eq("id", contractId);

      if (error) {
        return NextResponse.json(
          { success: false, error: "Error al iniciar el emulador" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          action,
          auto_stopped: autoStop.stopped,
        },
        { status: 200 }
      );
    }

    const { error } = await supabase
      .from("contracts")
      .update({ emulator_active: false })
      .eq("id", contractId);

    if (error) {
      return NextResponse.json(
        { success: false, error: "Error al detener el emulador" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, action, auto_stopped: autoStop.stopped },
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
