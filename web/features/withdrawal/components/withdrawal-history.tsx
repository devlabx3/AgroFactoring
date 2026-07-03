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
import { Badge } from "@/components/ui/badge";
import { formatUSDC, formatDate, getStellarExplorerUrl } from "@/lib/format";
import Image from "next/image";
import { ArrowUpRight } from "@phosphor-icons/react";
import type { WithdrawalEntry } from "@/features/dashboard/types";

interface WithdrawalHistoryProps {
  withdrawals: WithdrawalEntry[];
}

export function WithdrawalHistory({ withdrawals }: WithdrawalHistoryProps) {
  const t = useTranslations("withdrawal");

  if (withdrawals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Image src="/wallet.png" alt="" width={80} height={80} className="object-contain mb-1" />
          <p className="text-sm text-text-muted">{t("history.empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{t("history.title")}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("history.date")}</TableHead>
            <TableHead className="text-right">{t("history.amount")}</TableHead>
            <TableHead>{t("history.bank")}</TableHead>
            <TableHead>{t("history.account")}</TableHead>
            <TableHead>{t("history.txHash")}</TableHead>
            <TableHead>{t("history.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals.map((w) => (
            <TableRow key={w.id}>
              <TableCell className="text-text-secondary text-sm">
                {formatDate(w.timestamp)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatUSDC(w.amount)}
              </TableCell>
              <TableCell>{w.bank_name ?? "—"}</TableCell>
              <TableCell className="font-mono text-sm">
                {w.account_last4 ? `****${w.account_last4}` : "—"}
              </TableCell>
              <TableCell>
                <a
                  href={getStellarExplorerUrl(w.tx_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  {w.tx_hash.slice(0, 8)}...
                  <ArrowUpRight weight="bold" className="h-3 w-3" />
                </a>
              </TableCell>
              <TableCell>
                <Badge
                  variant={w.status === "completed" ? "success" : "danger"}
                  className="text-xs"
                >
                  {w.status === "completed"
                    ? t("history.completed")
                    : t("history.failed")}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
