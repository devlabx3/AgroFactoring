"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatUSDC } from "@/lib/format";
import type { ContractStatus, LedgerEntry } from "@/features/dashboard/types";
import { CurrencyDollar, ArrowFatLinesDown, ArrowFatLinesUp, Vault, ShieldCheck } from "@phosphor-icons/react";

interface ExporterBalanceCardProps {
  totalAmount: number;
  ledger: LedgerEntry[];
  contractStatus: ContractStatus;
}

export function ExporterBalanceCard({
  totalAmount,
  ledger,
  contractStatus,
}: ExporterBalanceCardProps) {
  const t = useTranslations("dashboard.exporter.balance");

  // Regular phase releases (phases 1+)
  const releasedToFarmer = ledger
    .filter((e) => e.phase_number > 0)
    .reduce((sum, e) => sum + e.amount_released, 0);

  // Rescue to farmer (phase_number = 0, inserted on resolve_disaster)
  const rescueToFarmer = ledger
    .filter((e) => e.phase_number === 0)
    .reduce((sum, e) => sum + e.amount_released, 0);

  const remaining = Math.max(0, totalAmount - releasedToFarmer);
  const exporterRefund = contractStatus === "resolved" ? remaining - rescueToFarmer : 0;
  const inEscrow = contractStatus === "resolved" ? 0 : remaining;
  const netCost = totalAmount - exporterRefund;

  const releasedPercent = totalAmount > 0 ? ((releasedToFarmer + rescueToFarmer) / totalAmount) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">
          {t("title")}
        </CardTitle>
        <CurrencyDollar weight="duotone" className="h-4 w-4 text-text-muted" />
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-text-muted">
            <span>{t("releasedToFarmer")}</span>
            <span className="tabular-nums font-medium text-foreground">
              {formatUSDC(releasedToFarmer + rescueToFarmer)}
            </span>
          </div>
          <Progress value={releasedPercent} className="h-2" />
          <div className="flex justify-between text-xs text-text-muted">
            <span>{t("committed")}</span>
            <span className="tabular-nums">{formatUSDC(totalAmount)}</span>
          </div>
        </div>

        {/* Breakdown rows */}
        <div className="divide-y divide-border rounded-md border border-border text-xs">

          {/* Phases released to farmer */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-2 text-text-secondary">
              <ArrowFatLinesDown className="h-3.5 w-3.5 text-accent" weight="duotone" />
              {t("releasedToFarmer")}
            </span>
            <span className="tabular-nums font-medium">{formatUSDC(releasedToFarmer)}</span>
          </div>

          {/* Rescue to farmer — only when resolved */}
          {contractStatus === "resolved" && rescueToFarmer > 0 && (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="flex items-center gap-2 text-success">
                <ShieldCheck className="h-3.5 w-3.5" weight="duotone" />
                {t("rescueToFarmer")}
              </span>
              <span className="tabular-nums font-medium text-success">{formatUSDC(rescueToFarmer)}</span>
            </div>
          )}

          {/* Refund to exporter — only when resolved */}
          {contractStatus === "resolved" && exporterRefund > 0 && (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="flex items-center gap-2 text-accent">
                <ArrowFatLinesUp className="h-3.5 w-3.5" weight="duotone" />
                {t("refundToExporter")}
              </span>
              <span className="tabular-nums font-medium text-accent">{formatUSDC(exporterRefund)}</span>
            </div>
          )}

          {/* In escrow — only when active/frozen */}
          {contractStatus !== "resolved" && (
            <div className="flex items-center justify-between px-3 py-2">
              <span className="flex items-center gap-2 text-text-muted">
                <Vault className="h-3.5 w-3.5" weight="duotone" />
                {t("inEscrow")}
              </span>
              <span className="tabular-nums font-medium">{formatUSDC(inEscrow)}</span>
            </div>
          )}

          {/* Net cost — always */}
          <div className="flex items-center justify-between bg-muted/30 px-3 py-2 font-semibold">
            <span className="text-text-secondary">{t("netCost")}</span>
            <span className="tabular-nums">{formatUSDC(netCost)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
