"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP, formatUSDC } from "@/lib/format";
import { USDC_TO_COP_RATE } from "@/features/stellar/config";
import type { LedgerEntry } from "@/features/dashboard/types";
import { Wallet } from "@phosphor-icons/react";

interface ReceivedCardProps {
  ledger: LedgerEntry[];
}

/**
 * Tarjeta de solo lectura del agricultor: los fondos llegan directamente a su
 * billetera en pesos cuando el exportador autoriza cada fase, así que no hay
 * acción de retiro — solo se muestra el total recibido en COP.
 */
export function ReceivedCard({ ledger }: ReceivedCardProps) {
  const t = useTranslations("dashboard.farmer.received");

  // USDC liberado por el exportador = equivalente en COP ya enviado a la wallet.
  const totalReleasedUsdc = ledger.reduce((sum, e) => sum + e.amount_released, 0);
  const totalReceivedCop = totalReleasedUsdc * USDC_TO_COP_RATE;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">
          {t("title")}
        </CardTitle>
        <Wallet weight="duotone" className="h-4 w-4 text-text-muted" />
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-bold tabular-nums text-accent">
          {formatCOP(totalReceivedCop)}
        </p>
        <p className="text-xs text-text-muted">{t("subtitle")}</p>
        <p className="text-xs text-text-muted">
          {t("rate", { rate: String(USDC_TO_COP_RATE) })} · {formatUSDC(totalReleasedUsdc)}
        </p>
      </CardContent>
    </Card>
  );
}
