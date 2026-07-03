"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUSDC } from "@/lib/format";
import { useFreighter } from "@/features/stellar/hooks/use-freighter";
import { WalletStatus } from "@/features/stellar/components/wallet-status";
import type { DashboardState } from "@/features/dashboard/types";
import { SpinnerGap } from "@phosphor-icons/react";

interface ContractInitModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: DashboardState;
  isPending: boolean;
}

export function ContractInitModal({
  open,
  onClose,
  onConfirm,
  data,
  isPending,
}: ContractInitModalProps) {
  const t = useTranslations("contract");
  const tCommon = useTranslations("common");
  const tPhases = useTranslations("phases");
  const { connected, isCorrectNetwork } = useFreighter();

  const canSubmit = connected && isCorrectNetwork && !isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("init.title")}</DialogTitle>
          <DialogDescription>{t("init.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("init.summary")}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-text-muted">{t("init.cropType")}</span>
              <span className="font-medium">{data.crop?.crop_type}</span>
              <span className="text-text-muted">{t("init.variety")}</span>
              <span className="font-medium">{data.crop?.variety}</span>
              <span className="text-text-muted">{t("init.totalAmount")}</span>
              <span className="font-bold tabular-nums">
                {formatUSDC(data.contract.total_amount)}
              </span>
            </div>
          </div>

          <Separator />

          {/* Phase breakdown table */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              {t("init.phaseBreakdown")}
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("init.phase")}</TableHead>
                  <TableHead className="text-right">
                    {t("init.amount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.phases.map((phase) => (
                  <TableRow key={phase.id}>
                    <TableCell className="text-sm">
                      {phase.phase_number}. {tPhases(`names.${phase.phase_number}`)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-sm">
                      {formatUSDC(phase.amount_requested)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Wallet status */}
          {!connected && (
            <div className="rounded-lg border border-border bg-surface-alt p-4 text-center">
              <p className="mb-3 text-sm text-text-muted">
                {t("init.connectWalletFirst")}
              </p>
              <WalletStatus />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={!canSubmit}>
            {isPending ? (
              <>
                <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
                {t("init.confirming")}
              </>
            ) : (
              t("init.confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
