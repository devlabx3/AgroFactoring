"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useContracts, useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { PhaseTimeline } from "@/features/dashboard/components/phase-timeline";
import { PhaseLedger } from "@/features/dashboard/components/phase-ledger";
import { PhaseAccordion, PhaseFinancialSummary } from "@/features/dashboard/components/phase-detail-breakdown";
import { DashboardSkeleton } from "@/features/dashboard/components/skeletons/dashboard-skeleton";
import { FrozenBanner } from "@/features/dashboard/components/frozen-banner";
import { ContractInitModal } from "@/features/dashboard/components/contract-init-modal";
import { PhaseReleaseModal } from "@/features/dashboard/components/phase-release-modal";
import { TxProgressModal } from "@/features/stellar/components/tx-progress-modal";
import {
  useInitContract,
  useReleasePhase,
} from "@/features/dashboard/hooks/use-contract-actions";
import { DEMO_CONTRACT_PLACEHOLDER, isContractLocked } from "@/features/dashboard/types";
import { formatUSDC, formatDate } from "@/lib/format";
import {
  Warning,
  ArrowsClockwise,
  RocketLaunch,
  PaperPlaneTilt,
  Hash,
  CurrencyDollar,
  Stack,
  ShieldCheck,
  Calendar,
  Users,
} from "@phosphor-icons/react";

const statusVariant = {
  notInitialized: "warning",
  active: "success",
  frozen: "danger",
  resolved: "danger",
  completed: "default",
} as const;

export default function ExporterContractPage() {
  const t = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const tPhases = useTranslations("phases");

  const contractsQuery = useContracts();
  const contractId = contractsQuery.data?.contracts?.[0]?.id ?? null;
  const dashboardQuery = useDashboard(contractId);

  const initContract = useInitContract();
  const releasePhase = useReleasePhase();

  const [showInitModal, setShowInitModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);

  if (contractsQuery.isLoading || dashboardQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (contractsQuery.isError || dashboardQuery.isError) {
    const error = contractsQuery.error || dashboardQuery.error;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("nav.contract")}</h1>
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
        <h1 className="text-2xl font-bold">{t("nav.contract")}</h1>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12 text-text-muted">
            {tDash("contract.noContract")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = dashboardQuery.data;
  const { contract, crop, farmer, phases, ledger } = data;
  const isFrozen = isContractLocked(contract.status);
  const needsInit =
    contract.stellar_contract_id === null ||
    contract.stellar_contract_id === DEMO_CONTRACT_PLACEHOLDER;
  const canRelease = !needsInit && contract.status === "active";
  const nextPhaseNum = contract.current_phase + 1;
  const currentPhaseData = phases.find(
    (p) => p.phase_number === nextPhaseNum
  );
  const totalReleased = ledger.reduce((sum, e) => sum + e.amount_released, 0);
  const totalPhases = phases.length || 5;
  const completedPhases = contract.current_phase - 1;
  const progressPercent = (completedPhases / totalPhases) * 100;

  const handleInitConfirm = () => {
    setShowInitModal(false);
    if (contractId && crop) {
      initContract.execute(contractId, crop.id, contract.exporter_id);
    }
  };

  const handleReleaseConfirm = () => {
    setShowReleaseModal(false);
    if (contractId) {
      releasePhase.execute(contractId);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t("nav.contract")}</h1>
        <Badge>{t("roles.exporter")}</Badge>
      </div>

      {isFrozen && <FrozenBanner />}

      {/* Contract detail cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="mt-1 text-xs text-text-muted">
              {formatUSDC(totalReleased)} {tDash("metrics.released")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">
              {tDash("metrics.status")}
            </CardTitle>
            <ShieldCheck weight="duotone" className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <Badge variant={statusVariant[needsInit ? "notInitialized" : contract.status]}>
              {t(`status.${needsInit ? "notInitialized" : contract.status}`)}
            </Badge>
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

        {farmer && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {tDash("metrics.counterpart")}
              </CardTitle>
              <Users weight="duotone" className="h-4 w-4 text-text-muted" />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{farmer.username}</p>
              <p className="mt-1 text-xs text-text-muted font-mono truncate">
                {farmer.wallet_address}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Phase Timeline */}
      <Card className={isFrozen ? "border-danger/20" : undefined}>
        <CardContent className="p-6">
          <PhaseTimeline
            phases={phases}
            ledger={ledger}
            currentPhase={contract.current_phase}
            contractStatus={contract.status}
          />

          {!isFrozen && (
            <div className="mt-6 flex justify-center">
              {needsInit && (
                <Button onClick={() => setShowInitModal(true)} className="gap-2">
                  <RocketLaunch weight="duotone" className="h-4 w-4" />
                  {tDash("contract.initializeContract")}
                </Button>
              )}
              {canRelease && currentPhaseData && (
                <Button onClick={() => setShowReleaseModal(true)} className="gap-2">
                  <PaperPlaneTilt weight="duotone" className="h-4 w-4" />
                  {tPhases("actions.releasePhase", { number: nextPhaseNum })}
                </Button>
              )}
            </div>
          )}
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

      {/* Registered releases */}
      <PhaseLedger ledger={ledger} phases={phases} />

      {/* Modals */}
      <ContractInitModal
        open={showInitModal}
        onClose={() => setShowInitModal(false)}
        onConfirm={handleInitConfirm}
        data={data}
        isPending={initContract.status.step !== "idle"}
      />

      {currentPhaseData && (
        <PhaseReleaseModal
          open={showReleaseModal}
          onClose={() => setShowReleaseModal(false)}
          onConfirm={handleReleaseConfirm}
          phase={currentPhaseData}
          farmer={farmer}
          isPending={releasePhase.status.step !== "idle"}
        />
      )}

      <TxProgressModal
        open={initContract.showModal}
        onClose={initContract.reset}
        status={initContract.status}
        onRetry={() => {
          if (contractId && crop) {
            initContract.execute(contractId, crop.id, contract.exporter_id);
          }
        }}
      />
      <TxProgressModal
        open={releasePhase.showModal}
        onClose={releasePhase.reset}
        status={releasePhase.status}
        onRetry={() => {
          if (contractId) {
            releasePhase.execute(contractId);
          }
        }}
      />
    </div>
  );
}
