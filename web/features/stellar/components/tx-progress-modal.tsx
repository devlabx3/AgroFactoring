"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTxHash, getStellarExplorerUrl } from "@/lib/format";
import type { TxStatus, TxStep } from "@/features/stellar/types";
import { TX_STEPS_ORDER } from "@/features/stellar/types";
import {
  Check,
  X,
  SpinnerGap,
  ArrowSquareOut,
} from "@phosphor-icons/react";

interface TxProgressModalProps {
  open: boolean;
  onClose: () => void;
  status: TxStatus;
  onRetry?: () => void;
}

const stepMessageKeys: Record<string, string> = {
  preparing: "tx.preparing",
  simulating: "tx.simulating",
  signing: "tx.signing",
  submitting: "tx.submitting",
  confirming: "tx.confirming",
  confirmed: "tx.confirmed",
};

function getStepState(
  step: TxStep,
  currentStep: TxStep,
  errorAtStep?: TxStep
): "completed" | "active" | "pending" | "error" {
  if (currentStep === "error" && errorAtStep) {
    const stepIdx = TX_STEPS_ORDER.indexOf(step);
    const errorIdx = TX_STEPS_ORDER.indexOf(errorAtStep);

    if (stepIdx < errorIdx) return "completed";
    if (stepIdx === errorIdx) return "error";
    return "pending";
  }

  // "confirmed" is the terminal success state — all steps are done.
  if (currentStep === "confirmed") return "completed";

  const stepIdx = TX_STEPS_ORDER.indexOf(step);
  const currentIdx = TX_STEPS_ORDER.indexOf(currentStep);

  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export function TxProgressModal({
  open,
  onClose,
  status,
  onRetry,
}: TxProgressModalProps) {
  const t = useTranslations("wallet");

  const isInProgress =
    status.step !== "idle" &&
    status.step !== "confirmed" &&
    status.step !== "error";

  return (
    <Dialog open={open} onOpenChange={isInProgress ? undefined : onClose}>
      <DialogContent
        showCloseButton={!isInProgress}
        onPointerDownOutside={isInProgress ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isInProgress ? (e) => e.preventDefault() : undefined}
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            {status.step === "error"
              ? t("tx.error")
              : stepMessageKeys[status.step]
                ? t(stepMessageKeys[status.step])
                : status.message}
          </DialogTitle>
        </DialogHeader>

        {/* Steps */}
        <div className="space-y-3 py-4">
          {TX_STEPS_ORDER.map((step) => {
            const state = getStepState(step, status.step, status.errorAtStep);
            const key = stepMessageKeys[step];

            return (
              <div
                key={step}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                  state === "active" && "bg-accent/5",
                  state === "error" && "bg-danger/5"
                )}
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {state === "completed" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success">
                      <Check weight="bold" className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  {state === "active" && (
                    <div className="flex h-6 w-6 items-center justify-center">
                      <SpinnerGap className="h-5 w-5 animate-spin text-accent" />
                    </div>
                  )}
                  {state === "pending" && (
                    <div className="h-6 w-6 rounded-full border-2 border-border" />
                  )}
                  {state === "error" && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-danger">
                      <X weight="duotone" className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-sm",
                    state === "completed" && "text-text-secondary",
                    state === "active" && "font-medium text-accent",
                    state === "pending" && "text-text-muted",
                    state === "error" && "font-medium text-danger"
                  )}
                >
                  {key ? t(key) : step}
                </span>
              </div>
            );
          })}
        </div>

        {/* Success: show tx hash */}
        {status.step === "confirmed" && status.txHash && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
            <p className="text-xs text-text-muted mb-1">{t("tx.hash")}</p>
            <a
              href={getStellarExplorerUrl(status.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-sm text-accent hover:text-accent-hover transition-colors"
            >
              {formatTxHash(status.txHash)}
              <ArrowSquareOut weight="duotone" className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Error message */}
        {status.step === "error" && status.error && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
            <p className="text-sm text-danger text-center line-clamp-3">
              {status.error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-3 pt-2">
          {status.step === "confirmed" && (
            <Button onClick={onClose}>{t("tx.close")}</Button>
          )}
          {status.step === "error" && (
            <>
              {onRetry && (
                <Button onClick={onRetry}>{t("tx.retry")}</Button>
              )}
              <Button variant="outline" onClick={onClose}>
                {t("tx.close")}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
