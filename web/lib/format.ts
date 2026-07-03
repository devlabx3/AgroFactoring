const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUSDC(amount: number): string {
  return usdFormatter.format(amount);
}

const dateFormatOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export function formatDate(isoDate: string, locale: string = "es"): string {
  const resolvedLocale = locale === "en" ? "en-US" : "es-CO";
  return new Intl.DateTimeFormat(resolvedLocale, dateFormatOptions).format(
    new Date(isoDate)
  );
}

export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

export function getStellarExplorerUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
