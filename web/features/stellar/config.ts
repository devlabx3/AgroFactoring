// Constants that don't require the Stellar SDK
export const STELLAR_NETWORK = "TESTNET" as const;

/**
 * Tasa fija del swap USDC -> COP para mostrar valores en el cliente.
 * Debe coincidir con USDC_TO_COP_RATE en lib/stellar.ts, que ejecuta el swap
 * real on-chain (aquí no se puede importar por traer la clave del oráculo).
 */
export const USDC_TO_COP_RATE = 3300;

/** Wallet por defecto del exportador cuando no tiene una configurada en su perfil */
export const DEFAULT_EXPORTER_WALLET = "GAQHX34PBWXW2JOAMX2EFRGLJDZDKP64HDQI2QE3NAPRQTBKHNO7TFZ2";

/** Wallet por defecto del agricultor cuando no tiene una configurada en su perfil */
export const DEFAULT_FARMER_WALLET = "GAOKAL4LEARYBRQ644KYZACR2TPG72ERKRUDMS6Z6WU4537NXC6JGRF5";
export const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

const CONTRACT_ID = process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID;
if (!CONTRACT_ID) {
  throw new Error("Missing NEXT_PUBLIC_STELLAR_CONTRACT_ID");
}
export const contractId = CONTRACT_ID;

// Lazy-loaded SDK instances — only imported when tx building is needed
let _sdkModule: typeof import("@stellar/stellar-sdk") | null = null;

export async function getStellarSdk() {
  if (!_sdkModule) {
    _sdkModule = await import("@stellar/stellar-sdk");
  }
  return _sdkModule;
}

export async function getRpc() {
  const StellarSdk = await getStellarSdk();
  return new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
}

export async function getContract() {
  const StellarSdk = await getStellarSdk();
  return new StellarSdk.Contract(contractId);
}
