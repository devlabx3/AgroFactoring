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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, username, wallet_address, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json(
        { success: false, error: "Perfil no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, profile }, { status: 200 });
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