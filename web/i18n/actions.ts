"use server";

import { cookies } from "next/headers";
import { type Locale, locales, defaultLocale } from "./config";

export async function setLocale(locale: Locale) {
  if (!locales.includes(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;
  return locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;
}
