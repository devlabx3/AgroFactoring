"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SquaresFour,
  FileText,
  Pulse,
  Database,
  Plant,
  Wallet,
  UserCircle,
  SignOut,
  X,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/hooks/use-auth";

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const exporterNavItems = [
  { key: "profile", href: "/exporter/profile", icon: UserCircle },
  { key: "dashboard", href: "/exporter", icon: SquaresFour },
  { key: "contract", href: "/exporter/contract", icon: FileText },
  { key: "emulator", href: "/exporter/emulator", icon: Pulse },
  { key: "data", href: "/exporter/data", icon: Database },
];

const farmerNavItems = [
  { key: "profile", href: "/farmer/profile", icon: UserCircle },
  { key: "dashboard", href: "/farmer", icon: SquaresFour },
  { key: "myCrop", href: "/farmer/crop", icon: Plant },
  { key: "withdrawal", href: "/farmer/withdrawal", icon: Wallet },
  { key: "data", href: "/farmer/data", icon: Database },
];

export function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const { user, logout } = useAuth();

  const navItems =
    user?.role === "exporter" ? exporterNavItems : farmerNavItems;

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // handled by mutation
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white p-1">
          <Image
            src="/logo-mark.png"
            alt="AgroFactoring"
            width={32}
            height={32}
            className="h-7 w-7"
          />
        </div>
        <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
          <span>Agro</span>
          <span className="text-sidebar-accent">Factoring</span>
        </span>

        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="ml-auto text-sidebar-muted hover:text-sidebar-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role badge */}
      {user && (
        <div className="px-6 pb-4">
          <Badge
            variant={user.role === "exporter" ? "default" : "success"}
            className="text-xs"
          >
            {t(`roles.${user.role}`)}
          </Badge>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent/10 text-sidebar-accent"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" weight="duotone" />
              {t(`nav.${item.key}`)}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-white/10 p-4">
        {user && (
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent/20 text-sm font-semibold text-sidebar-accent">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user.username}
              </p>
              <p className="truncate text-xs text-sidebar-muted">
                {t(`roles.${user.role}`)}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={logout.isPending}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
        >
          <SignOut className="h-4 w-4" weight="duotone" />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onMobileClose}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
