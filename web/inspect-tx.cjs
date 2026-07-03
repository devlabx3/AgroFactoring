const { rpc: { Server }, xdr } = require("@stellar/stellar-sdk");

async function main() {
  const cid = process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID;
  const usdc = process.env.NEXT_STELLAR_USDC_CONTRACT_ID;
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";

  if (!cid) {
    console.error("Falta NEXT_PUBLIC_STELLAR_CONTRACT_ID en .env");
    process.exit(1);
  }
  if (!usdc) {
    console.error("Falta NEXT_STELLAR_USDC_CONTRACT_ID en .env");
    process.exit(1);
  }

  const server = new Server(rpcUrl);

  const latest = await server.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - 5000);
  const resp = await server.getTransactions({
    startLedger,
    limit: 200,
    filters: [{ type: "contract", contractIds: [cid] }],
  });
  const txs = resp.transactions || [];
  const succ = txs.filter((t) => t.successful);
  const fail = txs.filter((t) => !t.successful);
  console.log(`=== ${txs.length} txs (${succ.length} OK, ${fail.length} FAIL) ===`);
  console.log(`\n--- TXS EXITOSAS ---`);
  for (const tx of succ) {
    // Parse resultMetaXdr to find transfers
    const meta = xdr.TransactionMeta.fromXDR(tx.resultMetaXdr, "base64");
    const events = meta.v3()?.sorobanMeta()?.diagnosticEvents() || [];
    const fns = [];
    let transfers = [];
    for (const de of events) {
      const topics = de.event().body().v0().topics();
      const data = de.event().body().v0().data();
      const t0 = topics[0];
      if (t0 && t0.switch().name === "scvSymbol") {
        const sym = t0.sym().toString();
        if (sym === "fn_call") {
          const fnName = topics[2]?.sym()?.toString();
          fns.push(fnName);
        }
        if (sym === "transfer") {
          // token transfer: topics = [transfer, from, to], data = amount
          const from = topics[1]?.address()?.toString();
          const to = topics[2]?.address()?.toString();
          const amount = data.i128()?.toBigInt();
          transfers.push({ from: from?.slice(0,8), to: to?.slice(0,8), amount: amount?.toString() });
        }
      }
    }
    console.log(`ledger ${tx.ledger} OK hash ${tx.txHash.slice(0,10)} fns:[${fns.join(",")}]`);
    for (const t of transfers) {
      console.log(`    TRANSFER ${t.amount} from ${t.from}... to ${t.to}...`);
    }
  }
}

main().catch((e) => console.error("ERR:", e.message, e.stack));
