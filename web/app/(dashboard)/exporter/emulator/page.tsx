"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useContracts, useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { EmulatorControls } from "@/features/dashboard/components/emulator-controls";
import { WeatherPanel } from "@/features/dashboard/components/weather-panel";
import { IoTPanel } from "@/features/dashboard/components/iot-panel";
import { DisasterTrigger } from "@/features/dashboard/components/disaster-trigger";
import { ResolveDisaster } from "@/features/dashboard/components/resolve-disaster";
import { FrozenBanner } from "@/features/dashboard/components/frozen-banner";
import { DashboardSkeleton } from "@/features/dashboard/components/skeletons/dashboard-skeleton";
import { DEMO_CONTRACT_PLACEHOLDER, isContractLocked } from "@/features/dashboard/types";
import { apiPost } from "@/lib/api-client";
import Image from "next/image";
import { Warning, ArrowsClockwise, ArrowCounterClockwise, SpinnerGap } from "@phosphor-icons/react";
import { toast } from "sonner";

function ResetButton({ contractId }: { contractId: string }) {
  const t = useTranslations("emulator");
  const queryClient = useQueryClient();
  const [countdown, setCountdown] = useState(0);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [armed]);

  const resetMutation = useMutation({
    mutationFn: () =>
      apiPost("/api/contract/reset", { contract_id: contractId }),
    onSuccess: () => {
      toast.success(t("reset.success"));
      setArmed(false);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("error"));
      setArmed(false);
    },
  });

  const handleClick = useCallback(() => {
    if (!armed) {
      setArmed(true);
      return;
    }
    if (countdown === 0) {
      resetMutation.mutate();
    }
  }, [armed, countdown, resetMutation]);

  return (
    <Card className="border-warning/30 bg-warning/[0.02]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-warning">
          {t("reset.button")}
        </CardTitle>
        <ArrowCounterClockwise className="h-4 w-4 text-warning" weight="duotone" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-text-muted">{t("reset.description")}</p>
        <Button
          size="sm"
          className="w-full bg-warning text-black font-semibold hover:bg-warning/90"
          disabled={resetMutation.isPending}
          onClick={handleClick}
        >
          {resetMutation.isPending ? (
            <>
              <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
              {t("reset.resetting")}
            </>
          ) : armed && countdown > 0 ? (
            t("reset.confirmCountdown", { seconds: countdown })
          ) : armed ? (
            <>
              <ArrowCounterClockwise className="mr-2 h-4 w-4" weight="duotone" />
              {t("reset.confirm")}
            </>
          ) : (
            <>
              <ArrowCounterClockwise className="mr-2 h-4 w-4" weight="duotone" />
              {t("reset.button")}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ExporterEmulatorPage() {
  const t = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const contractsQuery = useContracts();
  const contractId = contractsQuery.data?.contracts?.[0]?.id ?? null;
  const dashboardQuery = useDashboard(contractId);

  if (contractsQuery.isLoading || dashboardQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (contractsQuery.isError || dashboardQuery.isError) {
    const error = contractsQuery.error || dashboardQuery.error;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("nav.emulator")}</h1>
        <Card className="border-danger/30">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <Warning weight="duotone" className="h-10 w-10 text-danger" />
            <p className="text-sm text-text-muted">
              {error instanceof Error ? error.message : tDash("error.description")}
            </p>
            <Button variant="outline" size="sm" onClick={() => { contractsQuery.refetch(); dashboardQuery.refetch(); }}>
              <ArrowsClockwise weight="duotone" className="mr-2 h-4 w-4" />
              {tDash("error.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contractId || !dashboardQuery.data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("nav.emulator")}</h1>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12 text-text-muted">
            {tDash("contract.noContract")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contract, ledger } = dashboardQuery.data;
  const isFrozen = isContractLocked(contract.status);
  // The escrow must exist on-chain before the disaster trigger can be invoked.
  // DB rows start in "active" status with stellar_contract_id = null, so we
  // can't rely on status alone — checking the on-chain id gates the trigger.
  const needsInit =
    contract.stellar_contract_id === null ||
    contract.stellar_contract_id === DEMO_CONTRACT_PLACEHOLDER;
  const releasedAmount =
    ledger?.reduce((sum, l) => sum + l.amount_released, 0) ?? 0;
  const remaining = contract.total_amount - releasedAmount;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Image src="/emulator.png" alt="" width={108} height={108} className="object-contain drop-shadow-md" />
        <div>
          <h1 className="text-2xl font-bold">{t("nav.emulator")}</h1>
          <Badge className="mt-1">{t("roles.exporter")}</Badge>
        </div>
      </div>

      {isFrozen && <FrozenBanner />}

      {/* Emulator Controls — full width */}
      <EmulatorControls contract={contract} />

      {/* Data Input Panels */}
      <div className="grid gap-4 sm:grid-cols-2">
        <WeatherPanel contractId={contractId} disabled={isFrozen} emulatorActive={contract.emulator_active} />
        <IoTPanel contractId={contractId} disabled={isFrozen} emulatorActive={contract.emulator_active} />
      </div>

      {/* Disaster Trigger / Resolve & Reset */}
      <div className="grid gap-4 sm:grid-cols-2">
        {!isFrozen && contract.status === "active" && !needsInit && (
          <DisasterTrigger contractId={contractId} />
        )}
        {/* Resolve only while strictly "frozen" — once resolved the contract
            stays visually locked (isFrozen) but the resolve button disappears
            so it can't be invoked twice. */}
        {contract.status === "frozen" && (
          <ResolveDisaster contractId={contractId} remaining={remaining} />
        )}
        <ResetButton contractId={contractId} />
      </div>

    </div>
  );
}
