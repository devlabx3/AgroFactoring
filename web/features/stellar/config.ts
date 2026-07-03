// Constants that don't require the Stellar SDK
export const STELLAR_NETWORK = "TESTNET" as const;
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
