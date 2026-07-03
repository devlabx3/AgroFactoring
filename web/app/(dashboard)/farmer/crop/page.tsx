"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useContracts, useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { PhaseTimeline } from "@/features/dashboard/components/phase-timeline";
import { DashboardSkeleton } from "@/features/dashboard/components/skeletons/dashboard-skeleton";
import { FrozenBanner } from "@/features/dashboard/components/frozen-banner";
import { PhaseAccordion, PhaseFinancialSummary } from "@/features/dashboard/components/phase-detail-breakdown";
import { formatUSDC } from "@/lib/format";
import { isContractLocked } from "@/features/dashboard/types";
import { Plant, Scales, CurrencyDollar, Stack, Warning, ArrowsClockwise } from "@phosphor-icons/react";

export default function FarmerCropPage() {
  const t = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const tPhases = useTranslations("phases");

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
        <h1 className="text-2xl font-bold">{t("nav.myCrop")}</h1>
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
        <h1 className="text-2xl font-bold">{t("nav.myCrop")}</h1>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12 text-text-muted">
            {tDash("contract.noContract")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contract, crop, phases, ledger } = dashboardQuery.data;
  const isFrozen = isContractLocked(contract.status);
  const totalPhases = phases.length || 5;
  const completedPhases = contract.current_phase - 1;
  const progressPercent = (completedPhases / totalPhases) * 100;

  const totalReleased = ledger.reduce((sum, e) => sum + e.amount_released, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t("nav.myCrop")}</h1>
        <Badge variant="success">{t("roles.farmer")}</Badge>
      </div>

      {isFrozen && <FrozenBanner />}

      {/* Crop Info */}
      {crop && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {tDash("metrics.cropType")}
              </CardTitle>
              <Plant weight="duotone" className="h-4 w-4 text-text-muted" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{crop.crop_type}</p>
              <p className="mt-1 text-xs text-text-muted">{tDash("metrics.variety")}: {crop.variety}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {tDash("metrics.estimatedTons")}
              </CardTitle>
              <Scales weight="duotone" className="h-4 w-4 text-text-muted" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{crop.estimated_tons}</p>
              <p className="mt-1 text-xs text-text-muted">ton</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {tDash("metrics.fundsReceived")}
              </CardTitle>
              <CurrencyDollar weight="duotone" className="h-4 w-4 text-text-muted" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatUSDC(totalReleased)}</p>
              <p className="mt-1 text-xs text-text-muted">
                {tDash("metrics.ofTotal", { total: formatUSDC(contract.total_amount) })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {tDash("metrics.currentPhase")}
              </CardTitle>
              <Stack weight="duotone" className="h-4 w-4 text-text-muted" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums">{contract.current_phase}</span>
                <span className="text-sm text-text-muted">{tDash("metrics.ofPhases", { total: totalPhases })}</span>
              </div>
              <Progress value={progressPercent} className="mt-3 h-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Phase detail */}
      <Card className={isFrozen ? "border-danger/20" : undefined}>
        <CardContent className="p-6">
          <PhaseTimeline
            phases={phases}
            ledger={ledger}
            currentPhase={contract.current_phase}
            contractStatus={contract.status}
          />
        </CardContent>
      </Card>

      {/* Phase detail accordion */}
      <PhaseAccordion
        phases={phases}
        ledger={ledger}
        contract={contract}
        isFrozen={isFrozen}
        totalAmount={contract.total_amount}
      />

      {/* Cumulative financial summary */}
      <PhaseFinancialSummary
        ledger={ledger}
        isFrozen={isFrozen}
        totalAmount={contract.total_amount}
      />
    </div>
  );
}
