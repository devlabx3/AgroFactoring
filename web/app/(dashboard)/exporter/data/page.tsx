"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useContracts, useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { PhaseLedger } from "@/features/dashboard/components/phase-ledger";
import { DashboardSkeleton } from "@/features/dashboard/components/skeletons/dashboard-skeleton";
import { formatUSDC, formatDate } from "@/lib/format";
import { Warning, ArrowsClockwise, Database, Calendar, Hash, CurrencyDollar } from "@phosphor-icons/react";

export default function ExporterDataPage() {
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
        <h1 className="text-2xl font-bold">{t("nav.data")}</h1>
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
        <h1 className="text-2xl font-bold">{t("nav.data")}</h1>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12 text-text-muted">
            {tDash("contract.noContract")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contract, phases, ledger } = dashboardQuery.data;
  const totalReleased = ledger.reduce((sum, e) => sum + e.amount_released, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t("nav.data")}</h1>
        <Badge>{t("roles.exporter")}</Badge>
      </div>

      {/* Contract summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              {tDash("metrics.contractId")}
            </CardTitle>
            <Hash weight="duotone" className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono truncate">{contract.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              {tDash("metrics.totalInCustody")}
            </CardTitle>
            <CurrencyDollar weight="duotone" className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatUSDC(contract.total_amount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              {tDash("metrics.totalReleased")}
            </CardTitle>
            <Database weight="duotone" className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatUSDC(totalReleased)}</p>
            <p className="mt-1 text-xs text-text-muted">{tDash("metrics.ofTotal", { total: formatUSDC(contract.total_amount) })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              {tDash("metrics.createdAt")}
            </CardTitle>
            <Calendar weight="duotone" className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{formatDate(contract.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger */}
      <PhaseLedger ledger={ledger} phases={phases} />
    </div>
  );
}
