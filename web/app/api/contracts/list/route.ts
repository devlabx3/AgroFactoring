import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Token invalido" },
        { status: 401 }
      );
    }

    let contracts;

    if (user.role === "exporter") {
      const { data, error } = await supabase
        .from("contracts")
        .select(
          "id, crop_id, exporter_id, total_amount, current_phase, status, stellar_contract_id, created_at"
        )
        .eq("exporter_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json(
          { success: false, error: "Error al consultar contratos", detail: error.message },
          { status: 500 }
        );
      }
      contracts = data;
    } else {
      // farmer: find contracts through crops
      const { data: crops, error: cropsError } = await supabase
        .from("crops")
        .select("id")
        .eq("farmer_id", user.id);

      if (cropsError) {
        return NextResponse.json(
          { success: false, error: "Error al consultar cultivos", detail: cropsError.message },
          { status: 500 }
        );
      }

      const cropIds = (crops || []).map((c) => c.id);

      if (cropIds.length === 0) {
        return NextResponse.json({ success: true, contracts: [] });
      }

      const { data, error } = await supabase
        .from("contracts")
        .select(
          "id, crop_id, exporter_id, total_amount, current_phase, status, stellar_contract_id, created_at"
        )
        .in("crop_id", cropIds)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json(
          { success: false, error: "Error al consultar contratos", detail: error.message },
          { status: 500 }
        );
      }
      contracts = data;
    }

    return NextResponse.json({ success: true, contracts: contracts || [] });
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
