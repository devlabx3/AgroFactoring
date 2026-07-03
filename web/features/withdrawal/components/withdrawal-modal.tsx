"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatUSDC, getStellarExplorerUrl } from "@/lib/format";
import { SpinnerGap, Check, ArrowLineDown, ArrowUpRight, Warning } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { ApiError } from "@/lib/api-client";
import type { WithdrawalResponse } from "../types";

const BANK_OPTIONS = [
  "Bancolombia",
  "Davivienda",
  "BBVA",
  "Nequi",
  "Banco de Bogota",
  "Scotiabank",
];

interface WithdrawalModalProps {
  open: boolean;
  onClose: () => void;
  availableBalance: number;
  onWithdraw: (
    amount: number,
    bankName: string,
    accountLast4: string
  ) => Promise<WithdrawalResponse>;
}

export function WithdrawalModal({
  open,
  onClose,
  availableBalance,
  onWithdraw,
}: WithdrawalModalProps) {
  const t = useTranslations("withdrawal");
  const [step, setStep] = useState<"form" | "processing" | "success" | "error">("form");
  const [successData, setSuccessData] = useState<{
    amount: string;
    bank: string;
    last4: string;
    txHash: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const schema = z.object({
    amount: z.coerce
      .number({ error: t("validation.amountRequired") })
      .min(1, t("validation.amountMin"))
      .max(availableBalance, t("validation.amountMax")),
    bankName: z.string().min(1, t("validation.bankRequired")),
    accountLast4: z
      .string()
      .min(1, t("validation.accountRequired"))
      .regex(/^\d{4}$/, t("validation.accountLength")),
  });

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
  });

  const handleClose = () => {
    setStep("form");
    setSuccessData(null);
    setErrorMsg("");
    resetForm();
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    setStep("processing");
    setErrorMsg("");

    try {
      const result = await onWithdraw(data.amount, data.bankName, data.accountLast4);

      setSuccessData({
        amount: formatUSDC(data.amount),
        bank: data.bankName,
        last4: data.accountLast4,
        txHash: result.tx_hash,
      });
      setStep("success");
      resetForm();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("errors.txFailed");
      setErrorMsg(message);
      setStep("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={step === "processing" ? undefined : handleClose}>
      <DialogContent
        showCloseButton={step !== "processing"}
        onPointerDownOutside={step === "processing" ? (e) => e.preventDefault() : undefined}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-center">{t("modal.title")}</DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4 pt-2"
            >
              {/* USDC transfer notice */}
              <div className="flex justify-center">
                <Badge variant="success" className="text-xs">
                  {t("modal.transferNotice")}
                </Badge>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">{t("modal.amount")}</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder={t("modal.amountPlaceholder")}
                  error={!!errors.amount}
                  {...register("amount")}
                />
                <p className="text-xs text-text-muted">
                  {t("modal.amountMax", { max: formatUSDC(availableBalance) })}
                </p>
                {errors.amount && (
                  <p className="text-xs text-danger">{errors.amount.message}</p>
                )}
              </div>

              {/* Bank */}
              <div className="space-y-2">
                <Label htmlFor="bankName">{t("modal.bank")}</Label>
                <select
                  id="bankName"
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  defaultValue=""
                  {...register("bankName")}
                >
                  <option value="" disabled>
                    {t("modal.bankPlaceholder")}
                  </option>
                  {BANK_OPTIONS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
                {errors.bankName && (
                  <p className="text-xs text-danger">{errors.bankName.message}</p>
                )}
              </div>

              {/* Account last 4 */}
              <div className="space-y-2">
                <Label htmlFor="accountLast4">{t("modal.accountLast4")}</Label>
                <Input
                  id="accountLast4"
                  maxLength={4}
                  placeholder={t("modal.accountLast4Placeholder")}
                  error={!!errors.accountLast4}
                  {...register("accountLast4")}
                />
                {errors.accountLast4 && (
                  <p className="text-xs text-danger">{errors.accountLast4.message}</p>
                )}
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full gap-2">
                <ArrowLineDown weight="duotone" className="h-4 w-4" />
                {t("modal.confirm")}
              </Button>
            </motion.form>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <SpinnerGap className="h-10 w-10 animate-spin text-accent" />
              <p className="text-sm font-medium text-text-secondary">
                {t("modal.processing")}
              </p>
              <p className="text-xs text-text-muted text-center max-w-xs">
                {t("modal.processingDesc")}
              </p>
            </motion.div>
          )}

          {step === "success" && successData && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-success"
              >
                <Check weight="bold" className="h-7 w-7 text-white" />
              </motion.div>
              <div className="text-center">
                <p className="text-lg font-semibold">{t("modal.success")}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {t("modal.successDesc", {
                    amount: successData.amount,
                    bank: successData.bank,
                    last4: successData.last4,
                  })}
                </p>
              </div>
              <a
                href={getStellarExplorerUrl(successData.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                {t("modal.viewOnExplorer")}
                <ArrowUpRight weight="bold" className="h-3 w-3" />
              </a>
              <Button onClick={handleClose} className="mt-2">
                OK
              </Button>
            </motion.div>
          )}

          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-danger"
              >
                <Warning weight="bold" className="h-7 w-7 text-white" />
              </motion.div>
              <div className="text-center">
                <p className="text-lg font-semibold">{t("modal.error")}</p>
                <p className="mt-1 text-sm text-text-muted max-w-xs">{errorMsg}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setStep("form")}
                className="mt-2"
              >
                {t("modal.retry")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
