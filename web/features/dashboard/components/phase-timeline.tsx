"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatUSDC } from "@/lib/format";
import { isContractLocked, type Phase, type LedgerEntry, type ContractStatus } from "@/features/dashboard/types";
import { Check, Snowflake } from "@phosphor-icons/react";
import { motion } from "motion/react";

interface PhaseTimelineProps {
  phases: Phase[];
  ledger: LedgerEntry[];
  currentPhase: number;
  contractStatus: ContractStatus;
}

type PhaseState = "completed" | "current" | "pending" | "frozen";

/* ── State logic ───────────────────────────────────────── */

function getPhaseState(
  phaseNumber: number,
  currentPhase: number,
  ledger: LedgerEntry[],
  contractStatus: ContractStatus
): PhaseState {
  const hasRelease = ledger.some((e) => e.phase_number === phaseNumber);
  if (hasRelease) return "completed";
  if (isContractLocked(contractStatus)) return "frozen";
  if (phaseNumber === currentPhase) return "current";
  return "pending";
}

/* ── Animated connector line ───────────────────────────── */

function ConnectorLine({
  completed,
  direction,
}: {
  completed: boolean;
  direction: "horizontal" | "vertical";
}) {
  if (direction === "horizontal") {
    return (
      <div className="h-1 w-full overflow-hidden rounded-full relative">
        <motion.div
          className={cn(
            "h-full w-full rounded-full",
            completed
              ? "bg-gradient-to-r from-success via-success/70 to-accent"
              : "bg-border"
          )}
          initial={completed ? { scaleX: 0 } : { scaleX: 1 }}
          animate={{ scaleX: 1 }}
          transition={
            completed
              ? { duration: 0.6, ease: "easeOut", delay: 0.3 }
              : undefined
          }
          style={{ transformOrigin: "left" }}
        />
        {completed && (
          <motion.div
            className="absolute inset-0 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              repeatDelay: 4,
              ease: "easeInOut",
            }}
          />
        )}
      </div>
    );
  }

  // vertical
  return (
    <div className="w-1 flex-1 min-h-4 overflow-hidden rounded-full">
      <motion.div
        className={cn(
          "h-full w-full rounded-full",
          completed
            ? "bg-gradient-to-b from-success via-success/70 to-accent"
            : "bg-border"
        )}
        initial={completed ? { scaleY: 0 } : { scaleY: 1 }}
        animate={{ scaleY: 1 }}
        transition={
          completed
            ? { duration: 0.6, ease: "easeOut", delay: 0.3 }
            : undefined
        }
        style={{ transformOrigin: "top" }}
      />
    </div>
  );
}

/* ── Phase image with state overlays ───────────────────── */

function PhaseImage({
  phaseNumber,
  state,
  size,
}: {
  phaseNumber: number;
  state: PhaseState;
  size: "sm" | "lg";
}) {
  const px = size === "lg" ? 112 : 72;
  const containerClass = size === "lg" ? "h-28 w-28" : "h-18 w-18";

  return (
    <div className={cn("group relative", containerClass)}>
      {/* Phase image */}
      <Image
        src={`/phases/phase-${phaseNumber}.png`}
        alt={`Phase ${phaseNumber}`}
        width={px}
        height={px}
        className={cn(
          "rounded-xl object-contain transition-all duration-300 group-hover:brightness-110 group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_rgba(99,102,241,0.35)]",
          state === "pending" && "opacity-40 grayscale group-hover:opacity-70 group-hover:grayscale-0",
          state === "frozen" && "opacity-50 saturate-50"
        )}
      />

      {/* Completed overlay: checkmark badge */}
      {state === "completed" && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.2 }}
          className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-success text-white shadow-[0_0_10px_rgba(20,184,166,0.4)]"
        >
          <Check className="h-3.5 w-3.5" weight="bold" />
        </motion.div>
      )}

      {/* Current: breathing ring */}
      {state === "current" && (
        <>
          <motion.div
            className="absolute -inset-1 rounded-xl border-2 border-accent/50"
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.7, 0.2, 0.7],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -inset-0.5 rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.15), transparent, rgba(99,102,241,0.15))",
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </>
      )}

      {/* Frozen overlay: snowflake + red tint */}
      {state === "frozen" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-danger/20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <Snowflake className="h-6 w-6 text-danger drop-shadow-md" weight="duotone" />
          </motion.div>
        </div>
      )}

    </div>
  );
}

/* ── Status badge ──────────────────────────────────────── */

function StatusBadge({ state, label }: { state: PhaseState; label: string }) {
  const badgeStyles = {
    completed: "bg-success/10 text-success border-success/20",
    current: "bg-accent/10 text-accent border-accent/20",
    pending: "bg-border/50 text-text-muted border-border",
    frozen: "bg-danger/10 text-danger border-danger/20",
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        badgeStyles[state]
      )}
    >
      {label}
    </motion.span>
  );
}

/* ── Main component ────────────────────────────────────── */

export function PhaseTimeline({
  phases,
  ledger,
  currentPhase,
  contractStatus,
}: PhaseTimelineProps) {
  const t = useTranslations("phases");

  return (
    <div className="w-full">
      <h2 className="mb-6 text-lg font-semibold">{t("timeline.title")}</h2>

      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start justify-center">
        {phases.map((phase, i) => {
          const state = getPhaseState(
            phase.phase_number,
            currentPhase,
            ledger,
            contractStatus
          );
          const isLast = i === phases.length - 1;

          return (
            <div key={phase.id} className={cn("flex items-start", !isLast && "flex-1")}>
              {/* Phase node */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="flex flex-col items-center shrink-0"
                style={{ width: 112 }}
              >
                <PhaseImage
                  phaseNumber={phase.phase_number}
                  state={state}
                  size="lg"
                />
                <div className="mt-3 text-center space-y-1">
                  <p className={cn(
                    "text-xs font-semibold",
                    state === "completed" ? "text-foreground" :
                    state === "current" ? "text-accent" :
                    state === "frozen" ? "text-danger" :
                    "text-text-muted"
                  )}>
                    {t(`names.${phase.phase_number}`)}
                  </p>
                  <p className="text-xs text-text-muted tabular-nums">
                    {formatUSDC(phase.amount_requested)}
                  </p>
                  <StatusBadge state={state} label={t(`status.${state}`)} />
                </div>
              </motion.div>

              {/* Connector line between nodes */}
              {!isLast && (
                <div className="flex-1 flex items-center pt-14">
                  <ConnectorLine completed={state === "completed"} direction="horizontal" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="flex flex-col gap-0 sm:hidden">
        {phases.map((phase, i) => {
          const state = getPhaseState(
            phase.phase_number,
            currentPhase,
            ledger,
            contractStatus
          );
          const isLast = i === phases.length - 1;

          return (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.1 }}
              className="flex items-start gap-4"
            >
              {/* Column: image + line */}
              <div className="flex flex-col items-center">
                <PhaseImage
                  phaseNumber={phase.phase_number}
                  state={state}
                  size="sm"
                />
                {!isLast && (
                  <ConnectorLine
                    completed={state === "completed"}
                    direction="vertical"
                  />
                )}
              </div>

              {/* Content */}
              <div className="pb-6 pt-2 space-y-1">
                <p className={cn(
                  "text-sm font-semibold",
                  state === "completed" ? "text-foreground" :
                  state === "current" ? "text-accent" :
                  state === "frozen" ? "text-danger" :
                  "text-text-muted"
                )}>
                  {t(`names.${phase.phase_number}`)}
                </p>
                <p className="text-xs text-text-muted tabular-nums">
                  {formatUSDC(phase.amount_requested)}
                </p>
                <StatusBadge state={state} label={t(`status.${state}`)} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
