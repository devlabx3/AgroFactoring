"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFreighter } from "@/features/stellar/hooks/use-freighter";
import { formatTxHash } from "@/lib/format";
import { Wallet, Warning, ArrowSquareOut } from "@phosphor-icons/react";
import { useState } from "react";

export function WalletStatus() {
  const t = useTranslations("wallet");
  const {
    connected,
    address,
    isCorrectNetwork,
    isInstalled,
    connect,
    disconnect,
  } = useFreighter();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connect();
    } catch {
      // silently handle — user can see state
    } finally {
      setConnecting(false);
    }
  };

  // Extension not installed
  if (isInstalled === false) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/20"
          >
            <Wallet weight="duotone" className="h-3.5 w-3.5" />
            {t("installLink")}
            <ArrowSquareOut weight="duotone" className="h-3 w-3" />
          </a>
        </TooltipTrigger>
        <TooltipContent>{t("notInstalledDesc")}</TooltipContent>
      </Tooltip>
    );
  }

  // Connected but wrong network
  if (connected && !isCorrectNetwork) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5">
        <Warning weight="duotone" className="h-3.5 w-3.5 text-warning" />
        <span className="text-xs font-medium text-warning">
          {t("wrongNetwork")}
        </span>
      </div>
    );
  }

  // Connected
  if (connected && address) {
    return (
      <div className="inline-flex items-center gap-2">
        <Badge variant="success" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {formatTxHash(address)}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          className="h-7 px-2 text-xs text-text-muted"
        >
          {t("disconnect")}
        </Button>
      </div>
    );
  }

  // Disconnected — show connect button
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleConnect}
      disabled={connecting}
      className="gap-1.5 border-accent/40 text-accent hover:bg-accent/5"
    >
      <Wallet weight="duotone" className="h-3.5 w-3.5" />
      {connecting ? t("connecting") : t("connect")}
    </Button>
  );
}
