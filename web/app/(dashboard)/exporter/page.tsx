"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useContracts, useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { ContractOverview } from "@/features/dashboard/components/contract-overview";
import { PhaseTimeline } from "@/features/dashboard/components/phase-timeline";
import { PhaseLedger } from "@/features/dashboard/components/phase-ledger";
import { DashboardSkeleton } from "@/features/dashboard/components/skeletons/dashboard-skeleton";
import { ContractInitModal } from "@/features/dashboard/components/contract-init-modal";
import { PhaseReleaseModal } from "@/features/dashboard/components/phase-release-modal";
import { FrozenBanner } from "@/features/dashboard/components/frozen-banner";
import { TxProgressModal } from "@/features/stellar/components/tx-progress-modal";
import {
  useInitContract,
  useReleasePhase,
} from "@/features/dashboard/hooks/use-contract-actions";
import { DEMO_CONTRACT_PLACEHOLDER, isContractLocked } from "@/features/dashboard/types";
import Image from "next/image";
import { Warning, ArrowsClockwise, RocketLaunch, PaperPlaneTilt } from "@phosphor-icons/react";

export default function ExporterPage() {
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
          <Badge>{t("roles.exporter")}</Badge>
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
          <Badge>{t("roles.exporter")}</Badge>
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
  const contract = data.contract;
  const isFrozen = isContractLocked(contract.status);
  const needsInit =
    contract.stellar_contract_id === null ||
    contract.stellar_contract_id === DEMO_CONTRACT_PLACEHOLDER;
  const canRelease = !needsInit && contract.status === "active";
  const nextPhaseNum = contract.current_phase + 1;
  const currentPhaseData = data.phases.find(
    (p) => p.phase_number === nextPhaseNum
  );

  const handleInitConfirm = () => {
    setShowInitModal(false);
    if (contractId && data.crop) {
      initContract.execute(contractId, data.crop.id, contract.exporter_id);
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>
        <Badge>{t("roles.exporter")}</Badge>
      </div>

      {/* Frozen Banner */}
      {isFrozen && <FrozenBanner />}

      {/* Metrics Grid */}
      <ContractOverview data={data} role="exporter" />

      {/* Phase Timeline */}
      <Card className={isFrozen ? "border-danger/20" : undefined}>
        <CardContent className="p-6">
          <PhaseTimeline
            phases={data.phases}
            ledger={data.ledger}
            currentPhase={contract.current_phase}
            contractStatus={contract.status}
          />

          {/* Action buttons — hidden when frozen */}
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
                  {tPhases("actions.releasePhase", {
                    number: nextPhaseNum,
                  })}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase Ledger */}
      <PhaseLedger ledger={data.ledger} phases={data.phases} />


      {/* Init Modal */}
      <ContractInitModal
        open={showInitModal}
        onClose={() => setShowInitModal(false)}
        onConfirm={handleInitConfirm}
        data={data}
        isPending={initContract.status.step !== "idle"}
      />

      {/* Release Modal */}
      {currentPhaseData && (
        <PhaseReleaseModal
          open={showReleaseModal}
          onClose={() => setShowReleaseModal(false)}
          onConfirm={handleReleaseConfirm}
          phase={currentPhaseData}
          farmer={data.farmer}
          isPending={releasePhase.status.step !== "idle"}
        />
      )}

      {/* Tx Progress Modals */}
      <TxProgressModal
        open={initContract.showModal}
        onClose={initContract.reset}
        status={initContract.status}
        onRetry={() => {
          if (contractId && data.crop) {
            initContract.execute(contractId, data.crop.id, contract.exporter_id);
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
