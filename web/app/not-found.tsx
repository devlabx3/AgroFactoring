"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("errors");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <p className="text-[8rem] font-extrabold leading-none text-accent/20 sm:text-[12rem]">
        404
      </p>
      <h1 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">
        {t("notFound.title")}
      </h1>
      <p className="mt-3 text-base text-text-secondary">
        {t("notFound.description")}
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex items-center rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        {t("notFound.backToDashboard")}
      </Link>
    </main>
  );
}
