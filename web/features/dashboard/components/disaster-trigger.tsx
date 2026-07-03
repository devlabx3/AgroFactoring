"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import type { DisasterResponse } from "@/features/dashboard/types";
import { motion } from "motion/react";
import { Warning, Snowflake, SpinnerGap } from "@phosphor-icons/react";
import { toast } from "sonner";

interface DisasterTriggerProps {
  contractId: string;
  disabled?: boolean;
  onDisasterConfirmed?: () => void;
}

export function DisasterTrigger({
  contractId,
  disabled,
  onDisasterConfirmed,
}: DisasterTriggerProps) {
  const t = useTranslations("disaster");
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [countdownActive, setCountdownActive] = useState(false);

  // 3-second countdown for confirm button
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

  const disasterMutation = useMutation({
    mutationFn: () =>
      apiPost<DisasterResponse>("/api/contract/trigger-disaster", {
        contract_id: contractId,
      }),
    onSuccess: () => {
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      onDisasterConfirmed?.();
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : t("error");
      const detail = err instanceof Error && "detail" in err ? (err as { detail?: string }).detail : undefined;
      toast.error(detail ? `${message}: ${detail}` : message);
    },
  });

  const handleConfirm = useCallback(() => {
    disasterMutation.mutate();
  }, [disasterMutation]);

  return (
    <>
      {/* Trigger Card */}
      <Card className="border-danger/30 bg-danger/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-danger">
            {t("trigger.title")}
          </CardTitle>
          <Snowflake className="h-4 w-4 text-danger" />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-text-muted">{t("trigger.description")}</p>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            disabled={disabled}
            onClick={() => setShowModal(true)}
          >
            <Warning className="mr-2 h-4 w-4" weight="duotone" />
            {t("trigger.buttonLabel")}
          </Button>
        </CardContent>
      </Card>

      {/* Dramatic Warning Modal */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!disasterMutation.isPending) setShowModal(open);
        }}
      >
        <DialogContent
          className="max-w-md border-danger/50"
          showCloseButton={!disasterMutation.isPending}
          onPointerDownOutside={
            disasterMutation.isPending
              ? (e) => e.preventDefault()
              : undefined
          }
        >
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4">
              <motion.div
                animate={{ rotate: [0, -3, 3, -3, 3, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              >
                <Image src="/disaster.png" alt="" width={180} height={180} className="object-contain mx-auto drop-shadow-lg" />
              </motion.div>
            </div>
            <DialogTitle className="text-xl text-danger">
              {t("modal.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {(["warning1", "warning2", "warning3", "warning4"] as const).map(
              (key) => (
                <div
                  key={key}
                  className="flex items-start gap-3 rounded-md bg-danger/5 p-3"
                >
                  <Snowflake className="h-4 w-4 text-danger mt-0.5 flex-shrink-0" weight="duotone" />
                  <p className="text-sm text-danger/90">{t(`modal.${key}`)}</p>
                </div>
              )
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              disabled={disasterMutation.isPending}
            >
              {t("modal.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={countdownActive || disasterMutation.isPending}
              onClick={handleConfirm}
            >
              {disasterMutation.isPending ? (
                <>
                  <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
                  {t("progress.confirming")}
                </>
              ) : countdownActive ? (
                t("modal.confirmCountdown", { seconds: countdown })
              ) : (
                t("modal.confirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
