import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { enforceAutoStop } from "@/lib/emulator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contractId = body?.contract_id;
    const temperatureC = body?.temperature_c;
    const rainfallMm = body?.rainfall_mm;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Falta contract_id" },
        { status: 400 }
      );
    }

    const autoStop = await enforceAutoStop(contractId);

    const { data: contract } = await supabase
      .from("contracts")
      .select("id, emulator_active")
      .eq("id", contractId)
      .maybeSingle();

    if (!contract) {
      return NextResponse.json(
        { success: false, error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    if (contract.emulator_active !== true) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Emulador detenido automáticamente por tiempo",
          auto_stopped: autoStop.stopped,
        },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("weather_readings").insert({
      contract_id: contractId,
      temperature_c: temperatureC ?? null,
      rainfall_mm: rainfallMm ?? null,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: "Error al insertar lectura meteorológica" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
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
