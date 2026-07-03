"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import { formatUSDC } from "@/lib/format";
import type { DisasterResponse } from "@/features/dashboard/types";
import { ShieldCheck, SpinnerGap, CheckCircle, ArrowFatLinesDown, ArrowFatLinesUp } from "@phosphor-icons/react";
import { toast } from "sonner";

interface ResolveDisasterProps {
  contractId: string;
  remaining: number;
}

export function ResolveDisaster({ contractId, remaining }: ResolveDisasterProps) {
  const t = useTranslations("disaster");
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [countdownActive, setCountdownActive] = useState(false);

  // Compute the split in stroops (1 USDC = 10^7 stroops). Doing the math in
  // USDC units truncates the 30% to zero for small balances — e.g.
  // Math.floor(3 * 3000 / 10_000) = Math.floor(0.9) = 0, which made the UI
  // show "0 USDC rescue / 3 USDC refund" instead of 0.9 / 2.1.
  const STROOPS_PER_UNIT = 10_000_000;
  const rescueStroops = Math.floor(
    (Math.round(remaining * STROOPS_PER_UNIT) * 3000) / 10_000
  );
  const rescueAmount = rescueStroops / STROOPS_PER_UNIT;
  const exporterRefund = remaining - rescueAmount;

  // 3-second countdown for confirm button (same pattern as disaster trigger).
  useEffect(() => {
    if (!showModal) {
      setCountdown(3);
      setCountdownActive(false);
      return;
    }
    setCountdownActive(true);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCountdownActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showModal]);

  const resolveMutation = useMutation({
    mutationFn: () =>
      apiPost<DisasterResponse>("/api/contract/resolve-disaster", {
        contract_id: contractId,
      }),
    onSuccess: () => {
      setShowModal(false);
      toast.success(t("resolve.success"));
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : t("error");
      const detail =
        err instanceof Error && "detail" in err
          ? (err as { detail?: string }).detail
          : undefined;
      toast.error(detail ? `${message}: ${detail}` : message);
    },
  });

  const handleConfirm = useCallback(() => {
    resolveMutation.mutate();
  }, [resolveMutation]);

  return (
    <>
      {/* Resolve Card */}
      <Card className="border-success/30 bg-success/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-success">
            {t("resolve.title")}
          </CardTitle>
          <ShieldCheck className="h-4 w-4 text-success" weight="duotone" />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-text-muted">{t("resolve.description")}</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-text-muted">
              <span>{t("resolve.rescueAmount")}</span>
              <span className="font-medium text-success">
                {formatUSDC(rescueAmount)} USDC
              </span>
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>{t("resolve.exporterRefund")}</span>
              <span className="font-medium text-text">
                {formatUSDC(exporterRefund)} USDC
              </span>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            className="w-full bg-success text-success-foreground hover:bg-success/90"
            disabled={remaining <= 0}
            onClick={() => setShowModal(true)}
          >
            <ShieldCheck className="mr-2 h-4 w-4" weight="duotone" />
            {t("resolve.buttonLabel")}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!resolveMutation.isPending) setShowModal(open);
        }}
      >
        <DialogContent
          className="max-w-md border-success/50"
          showCloseButton={!resolveMutation.isPending}
          onPointerDownOutside={
            resolveMutation.isPending
              ? (e) => e.preventDefault()
              : undefined
          }
        >
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4">
              <ShieldCheck
                className="h-16 w-16 text-success mx-auto"
                weight="duotone"
              />
            </div>
            <DialogTitle className="text-xl text-success">
              {t("resolve.title")}
            </DialogTitle>
            <DialogDescription>{t("resolve.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <div className="flex items-center justify-between rounded-md bg-muted/40 p-3">
              <span className="text-sm text-text-muted">
                {t("resolve.remaining")}
              </span>
              <span className="text-sm font-semibold">
                {formatUSDC(remaining)} USDC
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-success/5 p-3">
              <span className="flex items-center gap-2 text-sm text-success">
                <ArrowFatLinesDown className="h-4 w-4" weight="duotone" />
                {t("resolve.rescueAmount")}
              </span>
              <span className="text-sm font-semibold text-success">
                {formatUSDC(rescueAmount)} USDC
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 p-3">
              <span className="flex items-center gap-2 text-sm text-text-muted">
                <ArrowFatLinesUp className="h-4 w-4" weight="duotone" />
                {t("resolve.exporterRefund")}
              </span>
              <span className="text-sm font-semibold">
                {formatUSDC(exporterRefund)} USDC
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              disabled={resolveMutation.isPending}
            >
              {t("resolve.cancel")}
            </Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              disabled={countdownActive || resolveMutation.isPending}
              onClick={handleConfirm}
            >
              {resolveMutation.isPending ? (
                <>
                  <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
                  {t("progress.confirming")}
                </>
              ) : countdownActive ? (
                t("resolve.confirmCountdown", { seconds: countdown })
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" weight="duotone" />
                  {t("resolve.confirm")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
