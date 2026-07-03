"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { ShieldWarning } from "@phosphor-icons/react";

export function FrozenBanner() {
  const t = useTranslations("disaster");

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 200 }}
      className="rounded-lg border border-danger/40 bg-gradient-to-r from-danger/10 via-danger/5 to-danger/10 p-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center flex-shrink-0">
          <Image src="/disaster.png" alt="" width={72} height={72} className="object-contain drop-shadow-md" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-danger text-sm tracking-wide">
              {t("frozen.bannerTitle")}
            </h3>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
            </span>
          </div>
          <p className="mt-0.5 text-xs text-danger/80">
            {t("frozen.bannerDescription")}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1.5">
          <ShieldWarning className="h-3.5 w-3.5 text-danger" weight="duotone" />
          <span className="text-xs font-medium text-danger">
            {t("frozen.rescueFund")}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
