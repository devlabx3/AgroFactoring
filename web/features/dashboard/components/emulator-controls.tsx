"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiPost } from "@/lib/api-client";
import { isContractLocked, type Contract } from "@/features/dashboard/types";
import { Play, Stop, Timer, SpinnerGap, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";

interface EmulatorControlsProps {
  contract: Contract;
}

export function EmulatorControls({ contract }: EmulatorControlsProps) {
  const t = useTranslations("emulator");
  const queryClient = useQueryClient();

  const isFrozen = isContractLocked(contract.status);
  const isActive = contract.emulator_active;

  // Client-side countdown
  const [timeLeft, setTimeLeft] = useState(contract.emulator_time_left_minutes);

  useEffect(() => {
    setTimeLeft(contract.emulator_time_left_minutes);
  }, [contract.emulator_time_left_minutes]);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 60_000);
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const controlMutation = useMutation({
    mutationFn: (action: "start" | "stop") =>
      apiPost<{ success: boolean; action: string; auto_stopped: boolean }>(
        "/api/emulator/control",
        { action, contract_id: contract.id }
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (data.auto_stopped) {
        toast.info(t("autoStopped"));
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("error"));
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">
          {t("title")}
        </CardTitle>
        <Timer className="h-4 w-4 text-text-muted" weight="duotone" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <Badge
            variant={isFrozen ? "danger" : isActive ? "warning" : "outline"}
          >
            {isFrozen
              ? t("status.disabled")
              : isActive
                ? t("status.active")
                : t("status.inactive")}
          </Badge>

          {isActive && timeLeft > 0 && (
            <span className="text-sm tabular-nums text-text-secondary">
              {t("timeLeft", { minutes: timeLeft })}
            </span>
          )}
        </div>

        {/* Frozen warning */}
        {isFrozen && (
          <div className="flex items-start gap-2 rounded-md bg-danger/5 p-3">
            <Warning className="h-4 w-4 text-danger mt-0.5 flex-shrink-0" weight="duotone" />
            <p className="text-xs text-danger">{t("frozenWarning")}</p>
          </div>
        )}

        {/* Controls */}
        {!isFrozen && (
          <Button
            variant={isActive ? "outline" : "default"}
            size="sm"
            className="w-full"
            disabled={controlMutation.isPending}
            onClick={() =>
              controlMutation.mutate(isActive ? "stop" : "start")
            }
          >
            {controlMutation.isPending ? (
              <>
                <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
                {isActive ? t("actions.stopping") : t("actions.starting")}
              </>
            ) : isActive ? (
              <>
                <Stop className="mr-2 h-4 w-4" weight="fill" />
                {t("actions.stop")}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" weight="fill" />
                {t("actions.start")}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
