import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: { "Set-Cookie": "token=; Path=/; HttpOnly; Max-Age=0" },
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
