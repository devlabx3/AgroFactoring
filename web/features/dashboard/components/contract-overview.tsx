"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatUSDC } from "@/lib/format";
import { DEMO_CONTRACT_PLACEHOLDER } from "@/features/dashboard/types";
import type { DashboardState } from "@/features/dashboard/types";
import {
  CurrencyDollar,
  Stack,
  ShieldCheck,
  Plant,
  Scales,
  UsersThree,
} from "@phosphor-icons/react";
import { motion } from "motion/react";

interface ContractOverviewProps {
  data: DashboardState;
  role: "exporter" | "farmer";
}

const statusVariant = {
  notInitialized: "warning",
  active: "success",
  frozen: "danger",
  resolved: "danger",
  completed: "default",
} as const;

export function ContractOverview({ data, role }: ContractOverviewProps) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("common.status");

  const { contract, crop, farmer, exporter, phases } = data;
  const totalPhases = phases.length || 5;
  const progressPercent = Math.max(
    0,
    ((contract.current_phase - 1) / totalPhases) * 100
  );

  const counterpart = role === "exporter" ? farmer : exporter;
  const needsInit =
    contract.stellar_contract_id === null ||
    contract.stellar_contract_id === DEMO_CONTRACT_PLACEHOLDER;
  const displayStatus = needsInit ? "notInitialized" : contract.status;

  const cards = [
    // Total in Custody / Funds Received
    <Card key="total">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">
          {role === "exporter"
            ? t("metrics.totalInCustody")
            : t("metrics.fundsReceived")}
        </CardTitle>
        <CurrencyDollar className="h-4 w-4 text-text-muted" weight="duotone" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">
          {formatUSDC(contract.total_amount)}
        </p>
        <p className="mt-1 text-xs text-text-muted">USDC</p>
      </CardContent>
    </Card>,

    // Current Phase
    <Card key="phase">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">
          {t("metrics.currentPhase")}
        </CardTitle>
        <Stack className="h-4 w-4 text-text-muted" weight="duotone" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">
            {contract.current_phase}
          </span>
          <span className="text-sm text-text-muted">
            {t("metrics.ofPhases", { total: totalPhases })}
          </span>
        </div>
        <Progress value={progressPercent} className="mt-3 h-2" />
      </CardContent>
    </Card>,

    // Status
    <Card key="status">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-text-secondary">
          {t("metrics.status")}
        </CardTitle>
        <ShieldCheck className="h-4 w-4 text-text-muted" weight="duotone" />
      </CardHeader>
      <CardContent>
        <Badge variant={statusVariant[displayStatus]}>
          {tStatus(displayStatus)}
        </Badge>
      </CardContent>
    </Card>,

    // Crop Type
    ...(crop
      ? [
          <Card key="crop">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {role === "farmer"
                  ? t("metrics.myCrop")
                  : t("metrics.cropType")}
              </CardTitle>
              <Plant className="h-4 w-4 text-text-muted" weight="duotone" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{crop.crop_type}</p>
              <p className="mt-1 text-xs text-text-muted">
                {t("metrics.variety")}: {crop.variety}
              </p>
            </CardContent>
          </Card>,
        ]
      : []),

    // Estimated Tons
    ...(crop
      ? [
          <Card key="tons">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {t("metrics.estimatedTons")}
              </CardTitle>
              <Scales className="h-4 w-4 text-text-muted" weight="duotone" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {crop.estimated_tons}
              </p>
              <p className="mt-1 text-xs text-text-muted">ton</p>
            </CardContent>
          </Card>,
        ]
      : []),

    // Counterpart
    ...(counterpart
      ? [
          <Card key="counterpart">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">
                {t("metrics.counterpart")}
              </CardTitle>
              <UsersThree className="h-4 w-4 text-text-muted" weight="duotone" />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{counterpart.username}</p>
              <p className="mt-1 text-xs text-text-muted font-mono truncate">
                {counterpart.wallet_address}
              </p>
            </CardContent>
          </Card>,
        ]
      : []),
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.key}
          className="h-full [&>*]:h-full"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06 }}
        >
          {card}
        </motion.div>
      ))}
    </div>
  );
}
