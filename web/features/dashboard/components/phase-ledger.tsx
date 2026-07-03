"use client";

import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUSDC, formatDate, formatTxHash, getStellarExplorerUrl } from "@/lib/format";
import type { LedgerEntry, Phase } from "@/features/dashboard/types";
import Image from "next/image";
import { ArrowSquareOut } from "@phosphor-icons/react";

interface PhaseLedgerProps {
  ledger: LedgerEntry[];
  phases: Phase[];
}

export function PhaseLedger({ ledger, phases }: PhaseLedgerProps) {
  const t = useTranslations("phases");

  const phaseName = (num: number) => {
    const phase = phases.find((p) => p.phase_number === num);
    return phase?.phase_name ?? t(`names.${num}`);
  };

  if (ledger.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Image src="/empty-field.png" alt="" width={80} height={80} className="object-contain mb-1" />
          <p className="text-sm text-text-muted">{t("ledger.empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{t("ledger.title")}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("ledger.phase")}</TableHead>
            <TableHead>{t("ledger.name")}</TableHead>
            <TableHead className="text-right">{t("ledger.amountReleased")}</TableHead>
            <TableHead>{t("ledger.date")}</TableHead>
            <TableHead>{t("ledger.txHash")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ledger.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium tabular-nums">
                {entry.phase_number}
              </TableCell>
              <TableCell>{phaseName(entry.phase_number)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatUSDC(entry.amount_released)}
              </TableCell>
              <TableCell className="text-text-secondary text-sm">
                {formatDate(entry.timestamp)}
              </TableCell>
              <TableCell>
                <a
                  href={getStellarExplorerUrl(entry.tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:text-accent-hover font-mono text-sm transition-colors"
                  aria-label={t("ledger.viewOnExplorer")}
                >
                  {formatTxHash(entry.tx_hash)}
                  <ArrowSquareOut className="h-3 w-3" weight="duotone" />
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
