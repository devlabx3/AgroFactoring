import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STROOPS_PER_UNIT = 10_000_000;

function toStroops(amount: string | number | null | undefined): bigint {
  if (amount === null || amount === undefined) return BigInt(0);
  return BigInt(Math.round(Number(amount) * STROOPS_PER_UNIT));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cropId = body?.crop_id;
    const exporterId = body?.exporter_id;

    if (!cropId || !exporterId) {
      return NextResponse.json(
        { success: false, error: "Faltan crop_id o exporter_id" },
        { status: 400 }
      );
    }

    const { data: crop, error: cropError } = await supabase
      .from("crops")
      .select("id, farmer_id, total_funding_requested, crop_id_num")
      .eq("id", cropId)
      .maybeSingle();

    if (cropError) {
      return NextResponse.json(
        { success: false, error: "Error al consultar el cultivo" },
        { status: 500 }
      );
    }
    if (!crop) {
      return NextResponse.json(
        { success: false, error: "Cultivo no encontrado" },
        { status: 404 }
      );
    }

    const { data: farmer, error: farmerError } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", crop.farmer_id)
      .maybeSingle();

    if (farmerError) {
      return NextResponse.json(
        { success: false, error: "Error al consultar el agricultor" },
        { status: 500 }
      );
    }
    if (!farmer || !farmer.wallet_address) {
      return NextResponse.json(
        { success: false, error: "Agricultor sin wallet_address" },
        { status: 404 }
      );
    }

    // Basic Stellar public key format: G + 55 base32 chars = 56 total
    if (!/^G[A-Z2-7]{55}$/.test(farmer.wallet_address)) {
      return NextResponse.json(
        {
          success: false,
          error: "La wallet del agricultor no es una dirección Stellar válida. Actualice el perfil con una dirección real.",
        },
        { status: 422 }
      );
    }

    // Reject placeholder wallets (e.g. GAAAAAAA...) — they burn funds on
    // resolve_disaster / release_phase. Detect via a run of 6+ 'A's right
    // after the leading 'G', which never appears in real ed25519 keys.
    if (/^GA{6,}/.test(farmer.wallet_address)) {
      return NextResponse.json(
        {
          success: false,
          error: "La wallet del agricultor es un placeholder (GAAAA...). Actualice el perfil con la wallet real del agricultor antes de inicializar el escrow.",
        },
        { status: 422 }
      );
    }

    // Load the exporter's wallet to guard against duplicate addresses. The
    // escrow transfers USDC to both parties; if they are the same address,
    // the "split" collapses and all funds go to one wallet (the bug we just
    // diagnosed on-chain).
    const { data: exporterProfile, error: exporterProfileError } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", exporterId)
      .maybeSingle();

    if (exporterProfileError) {
      return NextResponse.json(
        { success: false, error: "Error al consultar el exportador" },
        { status: 500 }
      );
    }

    const exporterWallet = exporterProfile?.wallet_address ?? null;
    if (
      exporterWallet &&
      /^G[A-Z2-7]{55}$/.test(exporterWallet) &&
      !/^GA{6,}/.test(exporterWallet) &&
      exporterWallet === farmer.wallet_address
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "El agricultor y el exportador comparten la misma wallet_address. Use wallets distintas para que los fondos se distribuyan correctamente.",
        },
        { status: 409 }
      );
    }

    const { data: phase1, error: phaseError } = await supabase
      .from("crop_phases_budget")
      .select("amount_requested")
      .eq("crop_id", cropId)
      .eq("phase_number", 1)
      .maybeSingle();

    if (phaseError) {
      return NextResponse.json(
        { success: false, error: "Error al consultar la fase 1" },
        { status: 500 }
      );
    }
    if (!phase1) {
      return NextResponse.json(
        { success: false, error: "El cultivo no tiene fase 1 definida" },
        { status: 404 }
      );
    }

    const { data: existing } = await supabase
      .from("contracts")
      .select("id, stellar_contract_id")
      .eq("crop_id", cropId)
      .eq("exporter_id", exporterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let contractIdDb: string;

    if (existing) {
      if (existing.stellar_contract_id) {
        return NextResponse.json(
          {
            success: false,
            error: "El contrato ya fue inicializado on-chain",
          },
          { status: 409 }
        );
      }
      contractIdDb = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("contracts")
        .insert({
          crop_id: cropId,
          exporter_id: exporterId,
          total_amount: crop.total_funding_requested,
          current_phase: 0,
          status: "active",
          stellar_contract_id: null,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        return NextResponse.json(
          { success: false, error: "Error al crear el contrato en base de datos" },
          { status: 500 }
        );
      }
      contractIdDb = inserted.id;
    }

    return NextResponse.json(
      {
        success: true,
        contract_id: contractIdDb,
        farmer_address: farmer.wallet_address,
        crop_id_num: crop.crop_id_num,
        total_amount_stroops: toStroops(crop.total_funding_requested).toString(),
        phase_amount_stroops: toStroops(phase1.amount_requested).toString(),
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
