import * as StellarSdk from "@stellar/stellar-sdk";

const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID_RAW = process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID;
const ORACLE_SECRET_RAW = process.env.NEXT_STELLAR_SECRET_KEY;
const USDC_CONTRACT_ID_RAW = process.env.NEXT_STELLAR_USDC_CONTRACT_ID;
const COP_CONTRACT_ID_RAW = process.env.NEXT_PUBLIC_STELLAR_CONTRACT_COPD3;

if (!CONTRACT_ID_RAW) {
  throw new Error(
    "Falta NEXT_PUBLIC_STELLAR_CONTRACT_ID en las variables de entorno"
  );
}
if (!ORACLE_SECRET_RAW) {
  throw new Error(
    "Falta NEXT_STELLAR_SECRET_KEY en las variables de entorno (clave del oráculo/admin)"
  );
}
if (!USDC_CONTRACT_ID_RAW) {
  throw new Error(
    "Falta NEXT_STELLAR_USDC_CONTRACT_ID en las variables de entorno"
  );
}

const CONTRACT_ID: string = CONTRACT_ID_RAW;
const ORACLE_SECRET: string = ORACLE_SECRET_RAW;
const USDC_CONTRACT_ID: string = USDC_CONTRACT_ID_RAW;

export const rpc = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
export const networkPassphrase = StellarSdk.Networks.TESTNET;
export const contractId = CONTRACT_ID;
export const usdcContractId = USDC_CONTRACT_ID;

export function getOracleKeypair(): StellarSdk.Keypair {
  return StellarSdk.Keypair.fromSecret(ORACLE_SECRET);
}

export function getContract(): StellarSdk.Contract {
  return new StellarSdk.Contract(contractId);
}

export function getUsdcContract(): StellarSdk.Contract {
  return new StellarSdk.Contract(USDC_CONTRACT_ID);
}

// --- Swap emulado USDC -> COP (pesos colombianos) -------------------------
//
// El exportador financia el escrow en USDC, pero el agricultor recibe pesos.
// El oráculo/admin custodia una reserva del token COP (COPD3) y, cuando el
// exportador autoriza la liberación de una fase, transfiere al agricultor el
// equivalente en pesos usando una tasa fija. No se toca el contrato de escrow:
// la USDC liberada por `release_phase` es solo el respaldo del swap.

/** Tasa fija del swap: 1 USDC = 3300 COP. */
export const USDC_TO_COP_RATE = 3300;

// El token COP (COPD3) usa 2 decimales (verificado on-chain con decimals()),
// a diferencia de USDC que usa 7. La conversión se hace a la unidad mínima
// del token COP: usdcAmount (USDC) * tasa * 10^2.
const COP_DECIMALS = 2;

// Valida y devuelve el contract id del token COP. Lanza un error claro si la
// variable falta o no es un StrKey de contrato válido (debe empezar por 'C' y
// medir 56 caracteres). No se valida en el import para no romper el resto de
// rutas que importan este módulo sin necesitar COP.
function getCopContractId(): string {
  if (!COP_CONTRACT_ID_RAW) {
    throw new Error(
      "Falta NEXT_PUBLIC_STELLAR_CONTRACT_COPD3 (contract id del token COP)"
    );
  }
  if (!/^C[A-Z2-7]{55}$/.test(COP_CONTRACT_ID_RAW)) {
    throw new Error(
      `NEXT_PUBLIC_STELLAR_CONTRACT_COPD3 no es un contract id Stellar válido ` +
        `(debe empezar por 'C' y tener 56 caracteres): ${COP_CONTRACT_ID_RAW}`
    );
  }
  return COP_CONTRACT_ID_RAW;
}

export function getCopContract(): StellarSdk.Contract {
  return new StellarSdk.Contract(getCopContractId());
}

export interface CopSwapResult {
  txHash: string;
  copAmount: number; // pesos entregados (usdcAmount * tasa)
}

/**
 * Emula el swap USDC -> COP: el oráculo transfiere al agricultor
 * `usdcAmount * USDC_TO_COP_RATE` pesos desde su reserva de COPD3.
 * Firma con la clave del oráculo (admin) y espera confirmación on-chain.
 */
export async function sendCopToFarmer(params: {
  farmerAddress: string;
  usdcAmount: number;
}): Promise<CopSwapResult> {
  const { farmerAddress, usdcAmount } = params;

  if (!/^G[A-Z2-7]{55}$/.test(farmerAddress)) {
    throw new Error(`Wallet del agricultor inválida para el swap COP: ${farmerAddress}`);
  }
  if (!(usdcAmount > 0)) {
    throw new Error("El monto USDC a convertir debe ser mayor a 0");
  }

  const copContract = getCopContract();
  const oracleKeypair = getOracleKeypair();

  // Pesos entregados y su expresión en la unidad mínima del token COP (2 dec).
  const copAmount = usdcAmount * USDC_TO_COP_RATE;
  const copUnits = BigInt(Math.round(copAmount * 10 ** COP_DECIMALS));

  const oracleAccount = await rpc.getAccount(oracleKeypair.publicKey());

  const transferOp = copContract.call(
    "transfer",
    StellarSdk.Address.fromString(oracleKeypair.publicKey()).toScVal(),
    StellarSdk.Address.fromString(farmerAddress).toScVal(),
    StellarSdk.nativeToScVal(copUnits, { type: "i128" })
  );

  const tx = new StellarSdk.TransactionBuilder(oracleAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(transferOp)
    .setTimeout(180)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Fallo simulando la transferencia COP: ${simulation.error}`);
  }

  const prepared = StellarSdk.rpc.assembleTransaction(tx, simulation).build();
  prepared.sign(oracleKeypair);

  const sendResponse = await rpc.sendTransaction(prepared);
  if (sendResponse.status === "ERROR") {
    throw new Error(
      `Envío de la transferencia COP fallido: ${JSON.stringify(sendResponse.errorResult)}`
    );
  }

  const txHash = sendResponse.hash;
  let getResponse = await rpc.getTransaction(txHash);
  let attempts = 0;
  while (getResponse.status === "NOT_FOUND" && attempts < 60) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResponse = await rpc.getTransaction(txHash);
    attempts++;
  }

  if (getResponse.status !== "SUCCESS") {
    throw new Error(`Transferencia COP finalizada con estado: ${getResponse.status}`);
  }

  return { txHash, copAmount };
}

export { StellarSdk };
