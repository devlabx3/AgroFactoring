import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AgroFactoring",
    template: "%s | AgroFactoring",
  },
  description:
    "Factoring agricola parametrico por ciclo en Stellar. Escrow inteligente por fases con seguro climatico automatico.",
  openGraph: {
    title: "AgroFactoring",
    description:
      "Plataforma de factoring agricola con smart contracts en Stellar/Soroban",
    type: "website",
    locale: "es_CO",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
