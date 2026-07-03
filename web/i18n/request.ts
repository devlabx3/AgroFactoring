import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { type Locale, locales, defaultLocale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = locales.includes(raw as Locale)
    ? (raw as Locale)
    : defaultLocale;

  const messages = {
    common: (await import(`../messages/${locale}/common.json`)).default,
    login: (await import(`../messages/${locale}/login.json`)).default,
    errors: (await import(`../messages/${locale}/errors.json`)).default,
    dashboard: (await import(`../messages/${locale}/dashboard.json`)).default,
    phases: (await import(`../messages/${locale}/phases.json`)).default,
    contract: (await import(`../messages/${locale}/contract.json`)).default,
    wallet: (await import(`../messages/${locale}/wallet.json`)).default,
    emulator: (await import(`../messages/${locale}/emulator.json`)).default,
    disaster: (await import(`../messages/${locale}/disaster.json`)).default,
    withdrawal: (await import(`../messages/${locale}/withdrawal.json`)).default,
    profile: (await import(`../messages/${locale}/profile.json`)).default,
  };

  return { locale, messages };
});
