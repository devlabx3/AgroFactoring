"use client";

import { useTranslations } from "next-intl";
import { List, Globe } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { setLocale } from "@/i18n/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { WalletStatus } from "@/features/stellar/components/wallet-status";

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentLang, setCurrentLang] = useState<"es" | "en">("es");
  const { user } = useAuth();

  const toggleLanguage = () => {
    const newLocale = currentLang === "es" ? "en" : "es";
    setCurrentLang(newLocale);
    startTransition(async () => {
      await setLocale(newLocale);
      router.refresh();
    });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-surface px-4 sm:px-6">
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <List className="h-5 w-5" weight="duotone" />
        <span className="sr-only">Menu</span>
      </Button>

      {/* Page title */}
      {title && (
        <h1 className="text-lg font-semibold text-primary">{title}</h1>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Wallet status - exporter only */}
      {user?.role === "exporter" && <WalletStatus />}

      {/* Language switcher */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        disabled={isPending}
        className="gap-1.5 text-text-secondary"
      >
        <Globe className="h-4 w-4" weight="duotone" />
        <span className="text-xs font-semibold">
          {t(`language.${currentLang === "es" ? "en" : "es"}`)}
        </span>
      </Button>
    </header>
  );
}
