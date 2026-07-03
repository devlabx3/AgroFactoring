import { getStellarSdk, getRpc, getContract, NETWORK_PASSPHRASE } from "../config";
import { parseSimulationError } from "@/lib/contract-errors";

/**
 * Build the "init" transaction for the escrow contract.
 * contract.call("init", exporter, farmer, crop_id, total_amount, amount_per_phase)
 */
export async function buildInitTx(
  sourceAddress: string,
  params: {
    farmerAddress: string;
    cropIdNum: number;
    totalAmountStroops: string;
    phaseAmountStroops: string;
  }
): Promise<string> {
  const StellarSdk = await getStellarSdk();
  const rpc = await getRpc();
  const contract = await getContract();
  const account = await rpc.getAccount(sourceAddress);

  let farmerScVal: InstanceType<typeof StellarSdk.xdr.ScVal>;
  try {
    farmerScVal = StellarSdk.Address.fromString(params.farmerAddress).toScVal();
  } catch {
    throw new Error(
      `La dirección del agricultor no es válida: ${params.farmerAddress.slice(0, 8)}... — actualice la wallet_address en el perfil del agricultor.`
    );
  }

  const args: InstanceType<typeof StellarSdk.xdr.ScVal>[] = [
    StellarSdk.Address.fromString(sourceAddress).toScVal(),
    farmerScVal,
    StellarSdk.nativeToScVal(BigInt(params.cropIdNum), { type: "u64" }),
    StellarSdk.nativeToScVal(BigInt(params.totalAmountStroops), { type: "i128" }),
    StellarSdk.nativeToScVal(BigInt(params.phaseAmountStroops), { type: "i128" }),
  ];

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("init", ...args))
    .setTimeout(180)
    .build();

  const simulation = await rpc.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(parseSimulationError(simulation.error, "init"));
  }

  tx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();

  return tx.toXDR();
}

/**
 * Build the "release_phase" transaction.
 * contract.call("release_phase", crop_id, phase_number)
 */
export async function buildReleasePhaseTx(
  sourceAddress: string,
  params: {
    cropIdNum: number;
    newPhaseNum: number;
  }
): Promise<string> {
  const StellarSdk = await getStellarSdk();
  const rpc = await getRpc();
  const contract = await getContract();
  const account = await rpc.getAccount(sourceAddress);

  const args: InstanceType<typeof StellarSdk.xdr.ScVal>[] = [
    StellarSdk.nativeToScVal(BigInt(params.cropIdNum), { type: "u64" }),
    StellarSdk.nativeToScVal(params.newPhaseNum, { type: "u32" }),
  ];

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("release_phase", ...args))
    .setTimeout(180)
    .build();

  const simulation = await rpc.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(parseSimulationError(simulation.error, "release_phase"));
  }

  tx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();

  return tx.toXDR();
}

/**
 * Submit a signed transaction and poll for confirmation.
 */
export async function submitAndConfirm(signedXdr: string): Promise<string> {
  const StellarSdk = await getStellarSdk();
  const rpc = await getRpc();

  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE
  ) as InstanceType<typeof StellarSdk.Transaction>;

  const response = await rpc.sendTransaction(tx);

  if (response.status === "ERROR") {
    throw new Error(
      `Transaction send failed: ${response.errorResult?.toXDR("base64") ?? "unknown error"}`
    );
  }

  const txHash = response.hash;
  let getResponse = await rpc.getTransaction(txHash);

  const MAX_POLL_ATTEMPTS = 30;
  let attempts = 0;
  while (getResponse.status === "NOT_FOUND") {
    if (++attempts > MAX_POLL_ATTEMPTS) {
      throw new Error("Transaction confirmation timed out after 60 seconds");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    getResponse = await rpc.getTransaction(txHash);
  }

  if (getResponse.status === "SUCCESS") {
    return txHash;
  }

  throw new Error(`Transaction failed with status: ${getResponse.status}`);
}
