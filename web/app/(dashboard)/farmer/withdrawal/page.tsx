"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useContracts, useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { DashboardSkeleton } from "@/features/dashboard/components/skeletons/dashboard-skeleton";
import { FrozenBanner } from "@/features/dashboard/components/frozen-banner";
import { BalanceCard } from "@/features/withdrawal/components/balance-card";
import { WithdrawalHistory } from "@/features/withdrawal/components/withdrawal-history";
import { isContractLocked } from "@/features/dashboard/types";
import { Warning, ArrowsClockwise } from "@phosphor-icons/react";

export default function FarmerWithdrawalPage() {
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
        <h1 className="text-2xl font-bold">{t("nav.withdrawal")}</h1>
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
        <h1 className="text-2xl font-bold">{t("nav.withdrawal")}</h1>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12 text-text-muted">
            {tDash("contract.noContract")}
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
        <h1 className="text-2xl font-bold">{t("nav.withdrawal")}</h1>
        <Badge variant="success">{t("roles.farmer")}</Badge>
      </div>

      {isFrozen && <FrozenBanner />}

      {/* Balance Card */}
      <BalanceCard
        contractId={contractId}
        ledger={data.ledger}
        withdrawals={data.withdrawals}
        isFrozen={isFrozen}
      />

      {/* Withdrawal History */}
      <WithdrawalHistory withdrawals={data.withdrawals} />
    </div>
  );
}
