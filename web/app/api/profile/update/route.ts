import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const updates: Record<string, string | null> = {};

    if (typeof body?.full_name === "string") {
      updates.full_name = body.full_name.trim() || null;
    }
    if (typeof body?.email === "string") {
      const email = body.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { success: false, error: "Email invalido" },
          { status: 422 }
        );
      }
      updates.email = email || null;
    }
    if (typeof body?.wallet_address === "string") {
      const wallet = body.wallet_address.trim();
      if (wallet) {
        if (!/^G[A-Z2-7]{55}$/.test(wallet)) {
          return NextResponse.json(
            { success: false, error: "La wallet no es una direccion Stellar valida" },
            { status: 422 }
          );
        }
        if (/^GA{6,}/.test(wallet)) {
          return NextResponse.json(
            { success: false, error: "La wallet es un placeholder (GAAAA...)" },
            { status: 422 }
          );
        }
      }
      updates.wallet_address = wallet || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select("id, role, username, wallet_address, full_name, email")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { success: false, error: "Error al actualizar el perfil" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, profile: updated }, { status: 200 });
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