import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { signToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body?.username;
    const password = body?.password;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Faltan username o password" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, username, password")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Error de base de datos" },
        { status: 500 }
      );
    }

    if (!data || data.password !== password) {
      return NextResponse.json(
        { success: false, error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const token = await signToken({
      role: data.role,
      username: data.username,
      id: data.id,
    });

    const isProduction = process.env.NODE_ENV === "production";
    const maxAge = 60 * 60 * 24 * 7;

    const cookieValue = [
      `token=${token}`,
      "Path=/",
      "HttpOnly",
      `Max-Age=${maxAge}`,
      "SameSite=Lax",
      isProduction ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    return NextResponse.json(
      { success: true, role: data.role, username: data.username },
      {
        status: 200,
        headers: { "Set-Cookie": cookieValue },
      }
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
