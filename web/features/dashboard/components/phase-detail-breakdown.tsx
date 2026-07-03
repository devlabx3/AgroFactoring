"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatUSDC, formatDate, formatTxHash, getStellarExplorerUrl } from "@/lib/format";
import { CaretDown, ArrowSquareOut, Calendar, Info } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import type { Phase, LedgerEntry, Contract } from "@/features/dashboard/types";

/* ── Financial Summary Bar ──── */

interface FinancialSummaryProps {
  ledger: LedgerEntry[];
  isFrozen: boolean;
  totalAmount: number;
}

export function PhaseFinancialSummary({
  ledger,
  isFrozen,
  totalAmount,
}: FinancialSummaryProps) {
  const tPhases = useTranslations("phases");
  const totalReleased = ledger.reduce((sum, e) => sum + e.amount_released, 0);
  const remaining = totalAmount - totalReleased;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-semibold">
            {tPhases("detail.cumulative")}
          </span>
          <span className="text-sm tabular-nums font-semibold">
            {formatUSDC(totalReleased)}{" "}
            <span className="text-text-muted font-normal">
              / {formatUSDC(totalAmount)}
            </span>
          </span>
        </div>
        <Progress
          value={totalAmount > 0 ? (totalReleased / totalAmount) * 100 : 0}
          className="h-2.5"
          indicatorClassName={
            totalReleased >= totalAmount
              ? "bg-success"
              : isFrozen
                ? "bg-danger"
                : undefined
          }
        />
        <div className="flex justify-between mt-2">
          <span className="text-xs text-text-muted">
            {Math.round(
              totalAmount > 0 ? (totalReleased / totalAmount) * 100 : 0
            )}
            % {tPhases("detail.ofTotal")}
          </span>
          <span className="text-xs text-text-muted tabular-nums">
            {tPhases("detail.remaining")}: {formatUSDC(remaining)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Phase Accordion ──── */

interface PhaseAccordionProps {
  phases: Phase[];
  ledger: LedgerEntry[];
  contract: Contract;
  isFrozen: boolean;
  totalAmount: number;
}

export function PhaseAccordion({
  phases,
  ledger,
  contract,
  isFrozen,
  totalAmount,
}: PhaseAccordionProps) {
  const tPhases = useTranslations("phases");
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (phaseNum: number) =>
    setExpanded((prev) => (prev === phaseNum ? null : phaseNum));

  const cumulativeAt = (upToPhase: number) =>
    ledger
      .filter((e) => e.phase_number <= upToPhase)
      .reduce((sum, e) => sum + e.amount_released, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {tPhases("detail.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {phases.map((phase) => {
          const released = ledger.find(
            (e) => e.phase_number === phase.phase_number
          );
          const isComplete = !!released;
          const isCurrent = phase.phase_number === contract.current_phase;
          const isOpen = expanded === phase.phase_number;
          const cumulative = cumulativeAt(phase.phase_number);
          const cumulativePct =
            totalAmount > 0
              ? Math.round((cumulative / totalAmount) * 100)
              : 0;

          return (
            <div
              key={phase.id}
              className={cn(
                "rounded-lg border transition-colors",
                isOpen
                  ? "border-accent/30 bg-accent/[0.03]"
                  : "border-transparent hover:bg-surface-alt/60"
              )}
            >
              {/* Row header — clickable */}
              <button
                onClick={() => toggle(phase.phase_number)}
                className="flex w-full items-center justify-between gap-4 p-3 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      isComplete
                        ? "bg-success text-white"
                        : isCurrent
                          ? "bg-accent text-white"
                          : isFrozen && !isComplete
                            ? "bg-danger/20 text-danger border border-danger/30"
                            : "border-2 border-border text-text-muted"
                    )}
                  >
                    {phase.phase_number}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {tPhases(`names.${phase.phase_number}`)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm tabular-nums font-medium">
                    {formatUSDC(phase.amount_requested)}
                  </span>
                  {isComplete ? (
                    <Badge variant="success" className="text-[10px]">
                      {tPhases("status.completed")}
                    </Badge>
                  ) : isFrozen ? (
                    <Badge variant="danger" className="text-[10px]">
                      {tPhases("status.frozen")}
                    </Badge>
                  ) : isCurrent ? (
                    <Badge className="text-[10px]">
                      {tPhases("status.current")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {tPhases("status.pending")}
                    </Badge>
                  )}
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CaretDown weight="duotone" className="h-4 w-4 text-text-muted" />
                  </motion.div>
                </div>
              </button>

              {/* Expandable detail */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-0 space-y-3">
                      {/* Description */}
                      <div className="flex gap-2 rounded-md bg-surface-alt/80 p-3">
                        <Info weight="duotone" className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {tPhases(
                            `descriptions.${phase.phase_number}`
                          )}
                        </p>
                      </div>

                      {/* Release details or pending message */}
                      {isComplete && released ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <Calendar weight="duotone" className="h-3.5 w-3.5 text-text-muted" />
                            <span>
                              {tPhases("detail.releasedOn")}:{" "}
                              <span className="font-medium text-foreground">
                                {formatDate(released.timestamp)}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <ArrowSquareOut weight="duotone" className="h-3.5 w-3.5 text-text-muted" />
                            <span>{tPhases("detail.txHash")}: </span>
                            <a
                              href={getStellarExplorerUrl(released.tx_hash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-accent hover:text-accent-hover transition-colors"
                            >
                              {formatTxHash(released.tx_hash)}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted italic">
                          {tPhases("detail.noDetails")}
                        </p>
                      )}

                      {/* Cumulative progress up to this phase */}
                      {isComplete && (
                        <div>
                          <div className="flex justify-between text-xs text-text-muted mb-1">
                            <span>{tPhases("detail.cumulative")}</span>
                            <span className="tabular-nums">
                              {formatUSDC(cumulative)} ({cumulativePct}%)
                            </span>
                          </div>
                          <Progress
                            value={cumulativePct}
                            className="h-1.5"
                            indicatorClassName="bg-success/70"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
