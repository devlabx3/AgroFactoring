"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useContracts, useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { ContractOverview } from "@/features/dashboard/components/contract-overview";
import { PhaseTimeline } from "@/features/dashboard/components/phase-timeline";
import { PhaseLedger } from "@/features/dashboard/components/phase-ledger";
import { DashboardSkeleton } from "@/features/dashboard/components/skeletons/dashboard-skeleton";
import { FrozenBanner } from "@/features/dashboard/components/frozen-banner";
import { BalanceCard } from "@/features/withdrawal/components/balance-card";
import { WithdrawalHistory } from "@/features/withdrawal/components/withdrawal-history";
import { isContractLocked } from "@/features/dashboard/types";
import Image from "next/image";
import { Warning, ArrowsClockwise } from "@phosphor-icons/react";

export default function FarmerPage() {
  const t = useTranslations("common");
  const tDash = useTranslations("dashboard");

  const contractsQuery = useContracts();
  const contractId = contractsQuery.data?.contracts?.[0]?.id ?? null;
  const dashboardQuery = useDashboard(contractId);

  // Loading state
  if (contractsQuery.isLoading || dashboardQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (contractsQuery.isError || dashboardQuery.isError) {
    const error = contractsQuery.error || dashboardQuery.error;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>
          <Badge variant="success">{t("roles.farmer")}</Badge>
        </div>
        <Card className="border-danger/30">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <Warning weight="duotone" className="h-10 w-10 text-danger" />
            <div className="text-center">
              <p className="font-semibold text-foreground">{tDash("error.title")}</p>
              <p className="mt-1 text-sm text-text-muted">
                {error instanceof Error ? error.message : tDash("error.description")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                contractsQuery.refetch();
                dashboardQuery.refetch();
              }}
            >
              <ArrowsClockwise weight="duotone" className="mr-2 h-4 w-4" />
              {tDash("error.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No contracts
  if (!contractId || !dashboardQuery.data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>
          <Badge variant="success">{t("roles.farmer")}</Badge>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-text-muted">
            <Image src="/empty-field.png" alt="" width={96} height={96} className="object-contain mb-2" />
            <p className="font-medium">{tDash("contract.noContract")}</p>
            <p className="text-sm">{tDash("contract.noContractDesc")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = dashboardQuery.data;
  const isFrozen = isContractLocked(data.contract.status);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>
        <Badge variant="success">{t("roles.farmer")}</Badge>
      </div>

      {/* Frozen Banner */}
      {isFrozen && <FrozenBanner />}

      {/* Metrics Grid */}
      <ContractOverview data={data} role="farmer" />

      {/* Withdrawal Balance */}
      <BalanceCard
        contractId={contractId}
        ledger={data.ledger}
        withdrawals={data.withdrawals}
        isFrozen={isFrozen}
      />

      {/* Phase Timeline (read-only) */}
      <Card className={isFrozen ? "border-danger/20" : undefined}>
        <CardContent className="p-6">
          <PhaseTimeline
            phases={data.phases}
            ledger={data.ledger}
            currentPhase={data.contract.current_phase}
            contractStatus={data.contract.status}
          />
        </CardContent>
      </Card>

      {/* Phase Ledger (read-only) */}
      <PhaseLedger ledger={data.ledger} phases={data.phases} />

      {/* Withdrawal History */}
      <WithdrawalHistory withdrawals={data.withdrawals} />
    </div>
  );
}
