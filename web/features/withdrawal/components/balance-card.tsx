"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatUSDC } from "@/lib/format";
import { useWithdraw } from "../hooks/use-withdrawals";
import { WithdrawalModal } from "./withdrawal-modal";
import type { WithdrawalResponse } from "../types";
import type { ContractStatus, LedgerEntry, WithdrawalEntry } from "@/features/dashboard/types";
import { Wallet, ArrowLineDown, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";

interface BalanceCardProps {
  contractId: string;
  ledger: LedgerEntry[];
  withdrawals: WithdrawalEntry[];
  contractStatus: ContractStatus;
}

export function BalanceCard({
  contractId,
  ledger,
  withdrawals,
  contractStatus,
}: BalanceCardProps) {
  const t = useTranslations("withdrawal");
  const [showModal, setShowModal] = useState(false);

  // totalReleased = USDC already sent to the farmer's Stellar wallet (per phase)
  const totalReleased = ledger.reduce((sum, e) => sum + e.amount_released, 0);
  // totalConverted = USDC the farmer has explicitly declared as used/converted to fiat
  const totalConverted = withdrawals
    .filter((w) => w.status === "completed")
    .reduce((sum, w) => sum + w.amount, 0);
  const availableToConvert = Math.max(0, totalReleased - totalConverted);
  const convertedPercent = totalReleased > 0 ? (totalConverted / totalReleased) * 100 : 0;

  const withdrawMutation = useWithdraw();

  const handleWithdraw = async (
    amount: number,
    bankName: string,
    accountLast4: string
  ): Promise<WithdrawalResponse> => {
    return withdrawMutation.mutateAsync({
      contract_id: contractId,
      amount,
      bank_name: bankName,
      account_last4: accountLast4,
    });
  };

  const handleOpenModal = () => {
    if (availableToConvert <= 0) {
      toast.error(t("errors.noFunds"));
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-text-secondary">
            {t("balance.title")}
          </CardTitle>
          <Wallet weight="duotone" className="h-4 w-4 text-text-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Available to convert */}
          <div>
            <p className="text-3xl font-bold tabular-nums text-accent">
              {formatUSDC(availableToConvert)}
            </p>
            <p className="mt-1 text-xs text-text-muted">{t("balance.available")}</p>
          </div>

          {/* Received vs Converted */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">{t("balance.withdrawn")}</span>
              <span className="tabular-nums font-medium">
                {formatUSDC(totalConverted)}
              </span>
            </div>
            <Progress value={convertedPercent} className="h-2" />
            <div className="flex justify-between text-xs text-text-muted">
              <span>{t("balance.released")}</span>
              <span className="tabular-nums">{formatUSDC(totalReleased)}</span>
            </div>
          </div>

          {/* Positive notice when rescue fund was disbursed */}
          {contractStatus === "resolved" && (
            <div className="flex items-center gap-2 rounded-md bg-success/10 p-2 text-xs text-success">
              <ShieldCheck weight="duotone" className="h-3.5 w-3.5 shrink-0" />
              {t("balance.rescueAvailable")}
            </div>
          )}

          {/* Withdraw button — never blocked by contract frozen state */}
          <Button
            className="w-full gap-2"
            onClick={handleOpenModal}
            disabled={availableToConvert <= 0}
          >
            <ArrowLineDown weight="duotone" className="h-4 w-4" />
            {availableToConvert <= 0 ? t("balance.noFunds") : t("balance.withdraw")}
          </Button>
        </CardContent>
      </Card>

      <WithdrawalModal
        open={showModal}
        onClose={() => setShowModal(false)}
        availableBalance={availableToConvert}
        onWithdraw={handleWithdraw}
      />
    </>
  );
}
