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
import { formatUSDC, formatTxHash } from "@/lib/format";
import type { Phase, Profile } from "@/features/dashboard/types";
import { SpinnerGap } from "@phosphor-icons/react";

interface PhaseReleaseModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  phase: Phase;
  farmer: Profile | null;
  isPending: boolean;
}

export function PhaseReleaseModal({
  open,
  onClose,
  onConfirm,
  phase,
  farmer,
  isPending,
}: PhaseReleaseModalProps) {
  const t = useTranslations("contract");
  const tCommon = useTranslations("common");
  const tPhases = useTranslations("phases");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("release.title", { phase: phase.phase_number })}
          </DialogTitle>
          <DialogDescription>{t("release.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-surface-alt p-4 space-y-3">
            {/* Phase name */}
            <div className="text-center">
              <p className="text-sm text-text-muted">
                {tPhases(`names.${phase.phase_number}`)}
              </p>
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs text-text-muted">{t("release.amount")}</p>
              <p className="text-2xl font-bold tabular-nums text-accent">
                {formatUSDC(phase.amount_requested)}
              </p>
            </div>

            {/* Recipient */}
            {farmer && (
              <div>
                <p className="text-xs text-text-muted">
                  {t("release.recipient")}
                </p>
                <p className="font-medium">{farmer.username}</p>
                <p className="text-xs text-text-muted font-mono mt-0.5">
                  {formatTxHash(farmer.wallet_address)}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
                {t("release.confirming")}
              </>
            ) : (
              t("release.confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
