# AgroFactoring

> Parametric agricultural factoring by crop cycle on Stellar. A Soroban smart contract acts as a phase-based escrow between an exporter and a farmer, with weather insurance: when an oracle detects frost or drought, the contract freezes the funds and redistributes the balance in real time, without intermediaries.

---

## 🌐 Idiomas / Languages

> **English** (this file) · [Español](./README.md)

---

## 🔑 Demo users and credentials

| Role | Username | Password |
|---|---|---|
| Exporter | `exportador` | `expo2024` |
| Farmer | `agricultor` | `agro2024` |

**Application:** <https://agro-factoring.vercel.app/>

**Explainer video:** <https://www.youtube.com/watch?v=rHV3MJyaP30>

**Pitch:**
- [English (PDF)](./docs/Pitch%20AgroFactoring-EN.pdf)
- [Spanish (PDF)](./docs/Pitch%20AgroFactoring-ES.pdf)

---

![Stellar](https://img.shields.io/badge/Stellar-Testnet-7d3cff)
![Soroban](https://img.shields.io/badge/Soroban-Rust%2FWASM-dea584)
![Next.js](https://img.shields.io/badge/Next.js-16-000)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e)
![License](https://img.shields.io/badge/License-MIT-green)

---

**TL;DR (60 seconds).** Latin American agriculture loses billions of dollars a year because banks don't lend to small farmers due to climate risk, and when they do via traditional factoring they hand over all the money at once with no control over whether the farmer uses it correctly at each stage of planting. We built on Stellar the first **Parametric AgroFactoring by Cycle**: an exporter funds the planting through a smart contract that acts as an intelligent escrow. The farmer doesn't receive all the money at once; the contract **enables** liquidity phase by phase of the agronomic cycle. The farmer **withdraws** the USDC to their Stellar wallet whenever they decide. If a weather oracle detects frost or drought, the contract **freezes** future phases (protecting the exporter) and, upon resolution, **redistributes** the remaining balance: 30% to the farmer as a rescue fund and 70% refunded to the exporter. No intermediaries, no insurance adjusters. IoT sensors constantly monitor the crop (simulated in the MVP, physical in production). Immediate, code-enforced liquidity on Stellar.

---

## Table of contents

1. [What is it?](#1-what-is-it)
2. [The problem](#2-the-problem)
3. [The solution](#3-the-solution)
4. [Why Stellar](#4-why-stellar)
5. [Potential of the solution](#5-potential-of-the-solution)
6. [Solution architecture](#6-solution-architecture)
7. [Smart Contract (Soroban)](#7-smart-contract-soroban)
8. [Data schema (Supabase)](#8-data-schema-supabase)
9. [Key flows](#9-key-flows)
10. [Tech stack](#10-tech-stack)
11. [Prerequisites](#11-prerequisites)
12. [Installation and execution](#12-installation-and-execution)
13. [Roadmap](#13-roadmap)
14. [Feature status](#14-feature-status)
15. [Resources](#15-resources)
16. [License and credits](#16-license-and-credits)

---

## 1. What is it?

AgroFactoring is a **parametric agricultural factoring by cycle** system built on Stellar. A Soroban smart contract holds custody of the capital (USDC) deposited by an exporter and **enables** it to the farmer **phase by phase**, as the agronomic cycle advances (Land Preparation → Sowing → Vegetative Growth → Harvest → Dispatch). The farmer **withdraws** the enabled USDC to their Stellar wallet whenever they decide. A software oracle (satellite and weather APIs + IoT devices that constantly monitor the crop, simulated in the MVP and physical in production) triggers two automatic events:

- **Phase verification:** the satellite confirms crop advance (NDVI index) → the contract **enables** the next USDC tranche for withdrawal.
- **Parametric insurance:** the weather oracle detects frost (`temp < 2 °C` for more than 4 h) or drought → the contract **freezes** the escrow of future phases (protecting the exporter). Upon resolution, it **redistributes** the remaining balance: 30% to the farmer (rescue fund) and 70% to the exporter (refund). No tokens are burned.

The farmer withdraws USDC directly to their Stellar wallet. Conversion to COP via a fiat gateway (Bitso API / SEP-24 Anchor) is a future production stage.

## 2. The problem

- Latin American banks don't lend to small farmers because climate and operational risk is too high.
- Traditional insurance takes ~6 months to pay, by which time the farmer has already gone bankrupt.
- The exporter loses its supply chain when a frost destroys the harvest.
- Traditional factoring hands over all the money at once, with no control over whether the farmer uses it correctly at each planting stage.

## 3. The solution

**Phased agricultural factoring with parametric insurance embedded in Stellar.** The contradiction of *"immediate cash vs. escrow"* is resolved by enabling capital strictly as the agronomic cycle advances:

1. **Onboarding and pre-studies.** The farmer submits a validated technical plan: crop type, variety, soil studies, and a budget broken down across 5 phases.
2. **The intelligent escrow by phases.** The exporter deposits the total USDC into the Soroban smart contract. Only the first tranche is **enabled** instantly; the rest stays locked in escrow.
3. **The weather/agricultural oracle.** A Node.js backend consumes public APIs linked to the farm's GPS coordinates to verify crop state (satellite NDVI imagery) and weather (OpenWeatherMap / IDEAM). Additionally, **IoT devices constantly monitor the crop** (soil moisture, local NDVI, canopy temperature) — in the MVP these sensors are **simulated** by an emulator with auto-stop; in production they will be **physical**, reporting to Supabase Edge Functions that evaluate parametric thresholds and trigger on-chain actions automatically (24/7, no human intervention).
4. **Scenarios.**
   - **Success per phase:** the satellite oracle confirms advance → the contract **enables** the next phase → the farmer **withdraws** USDC to their wallet → on Dispatch completion the escrow becomes `Completed` and the exporter receives payment with interest.
   - **Climate disaster:** the oracle detects frost/drought → the contract **freezes** the escrow of future phases → upon resolution, it **redistributes** the remaining balance: 30% to the farmer (rescue) and 70% to the exporter (refund).

## 4. Why Stellar

| Reason | Detail |
|---|---|
| **Native USDC + EURC** | The Miami exporter pays in USDC, the Rotterdam buyer receives EURC, on the same chain where the contract lives. |
| **LATAM Anchors** | Bitso (Colombia, Brazil, Mexico), MoneyGram (Colombia), Conduit (B2B). The farmer receives COP in Nequi without knowing they used blockchain. |
| **ISO 20022** | Institutional credibility for European banks and commodity traders. |
| **SEP-24 / SEP-31** | Native protocols for fiat deposit/withdrawal and cross-border payments. |
| **Soroban** | Complex logic (multi-tranche escrow + parametric logic) in Rust/WASM. Fees ~$0.003/tx. |

### Colombian peso settlement (last mile)

| Option | Time | How |
|---|---|---|
| On-chain USDC withdrawal (current MVP) | instant | The farmer withdraws USDC from the contract to their Stellar wallet via `withdraw`. Available balance = total enabled − total withdrawn. |
| LATAM exchange API (production v1) | 1 day | Backend calls Bitso or Airtm: sells USDC, sends COP via PSE/ACH to the farmer's account. |
| Native Stellar Anchor (scale) | months | Partnership with a regulated Colombian exchange registered as a SEP-24 Anchor; the contract pays the Anchor, which auto-credits COP. |

## 5. Potential of the solution

- **Market.** Rural credit in LATAM is an underserved multi-billion-USD market; small Colombian coffee farmers are the flagship use case.
- **Competitive advantage.** *IoT sensors that constantly monitor the crop* (simulated in the MVP, physical in production) combined with satellite and weather APIs, pure software. *Tranche escrow* protects the investor from fund misuse — something traditional factoring doesn't do. *Legally viable*: it's factoring with parametric insurance, not a futures market (no CFTC regulation required).
- **Real impact.** Solves credit access for small farmers, preventing them from being indebted for life if a frost hits: the exporter doesn't lose future money and the farmer doesn't go bankrupt, in seconds rather than months.
- **Scalability.** The same pattern applies to coffee, cocoa, rice, corn, fruit trees and any crop with an agronomic cycle measurable by NDVI. Multi-crop, multi-country, multi-currency on the same Stellar infrastructure.
- **Geographic expansion.** Once established in Colombia, we plan to expand into large markets such as **Brazil and Mexico**, leveraging the same Stellar infrastructure, Bitso anchors in those countries, and adapting local agronomic cycles (coffee, cocoa, soy, corn).
- **Business model.** Escrow deployment fee + parametric insurance spread + fiat last-mile fee. Aligned incentives: everyone wins if the cycle completes, nobody loses everything if there's a disaster.

## 6. Solution architecture

![High-level architecture](./docs/images/architecture.png)

The solution is composed of five cooperating layers:

1. **Blockchain layer — Stellar / Soroban (Rust → WASM).** The `Agro_Factoring` smart contract holds custody of USDC, **enables** phase releases (without transferring until the farmer withdraws), executes the parametric freeze and balance redistribution in `resolve_disaster`. Full detail in [`docs/smart-contract.md`](./docs/smart-contract.md).
2. **Client layer — Next.js 16 + React 19 + Tailwind v4 + Freighter.** The role-aware dashboard (exporter / farmer) that signs transactions and shows escrow state in real time.
3. **Oracle layer — Node.js backend.** Consumes OpenWeatherMap/IDEAM (weather) and Sentinel Hub (NDVI satellite) or georeferenced photo evidence uploaded from the farmer's phone. The oracle signs as the contract's *admin* for parametric triggers and for `withdraw` (farmer withdrawals).
4. **Data layer — Supabase (Postgres + Auth).** Persists profiles, crops, contracts, phase budgets, the on-chain tx hash *ledger*, farmer withdrawals and weather/IoT readings. Full detail in [`docs/database.md`](./docs/database.md).
5. **Fiat layer — last mile.** On-chain USDC withdrawal direct to the farmer's wallet (current MVP); Bitso API (production v1) / SEP-24 Anchor (scale) to convert USDC → COP.

The full components diagram is in [`docs/architecture.md`](./docs/architecture.md).

## 7. Smart Contract (Soroban)

The `Agro_Factoring` contract lives in [`Stellar/contracts/Agro_Factoring/src/lib.rs`](./Stellar/contracts/Agro_Factoring/src/lib.rs) and exposes **nine functions**:

| Function | Caller | What it does |
|---|---|---|
| `__constructor(admin)` | deploy | Sets the contract's admin/oracle (instance storage). |
| `set_usdc(usdc_address)` | admin | Registers the USDC contract address used for all transfers. |
| `init(exporter, farmer, crop_id, total, per_phase)` | exporter | Transfers the total USDC into the contract's custody and creates the escrow in `Active`, `current_phase = 0`. |
| `release_phase(crop_id, phase_number)` | exporter | **Enables** one tranche for withdrawal (does not transfer USDC) in strict ascending order; on the last phase the escrow becomes `Completed`. |
| `withdraw(crop_id, amount)` | admin/oracle | Transfers USDC from the contract to the farmer (up to `released_amount - withdrawn_amount`). |
| `trigger_disaster(exporter, farmer, crop_id)` | admin/oracle | Freezes the escrow: `Frozen` status, no further releases. |
| `resolve_disaster(crop_id, rescue_bps)` | admin/oracle | Redistributes the remaining balance: `rescue_bps`% to the farmer (rescue) and the rest to the exporter (refund). Removes the escrow. |
| `reset_escrow(crop_id)` | admin/oracle | Returns the remaining balance (`total_amount - withdrawn_amount`) to the exporter and removes the escrow. |
| `get_escrow_state(exporter, farmer, crop_id)` | parties | Read-only accessor (requires matching parties). |

`EscrowData` tracks two independent counters: `released_amount` (USDC enabled for withdrawal) and `withdrawn_amount` (USDC actually withdrawn by the farmer). The available withdrawal balance = `released_amount - withdrawn_amount`.

Escrow states (`EscrowStatus` enum): `Active` → `Completed` (success) or `Active` → `Frozen` (disaster). `Frozen` is not terminal: the farmer can withdraw already-enabled funds, and `resolve_disaster`/`reset_escrow` can act on a frozen escrow. TTL management (~30 days) prevents archival. State machine:

![Escrow state machine](./docs/images/escrow-state-machine.png)

Full technical reference (types, storage keys, errors, TTL) in [`docs/smart-contract.md`](./docs/smart-contract.md).

## 8. Data schema (Supabase)

![Entity-relationship diagram](./docs/images/er-diagram.png)

**Eight tables** coordinate the *off-chain* state that complements the on-chain state:

| Table | Purpose |
|---|---|
| `profiles` | Users (exporter/farmer) with `wallet_address` and demo credentials (`jose`/JWT auth). |
| `crops` | Crop catalog (type, variety, tons, requested funding, `status`, `crop_id_num` maps to the on-chain id). |
| `crop_phases_budget` | Budget broken down across the 5 agronomic phases. |
| `contracts` | The on-chain escrow instance: maps to `crop_id`, `exporter_id`, `total_amount`, `current_phase`, `status`, `stellar_contract_id`, emulator flags. |
| `phase_ledger` | Audit: each `release_phase` records `tx_hash`, `phase_number`, `amount_released` (amount **enabled**, not transferred). The `resolve_disaster` rescue is recorded with `phase_number = 0`. |
| `withdrawals` | Farmer withdrawals: each `withdraw` records `amount`, `bank_name`, `account_last4`, `tx_hash`, `status` (`completed`/`failed`). |
| `weather_readings` | Temperature and precipitation readings fed by the weather oracle. |
| `iot_readings` | Reserved for IoT sensor readings (in-situ NDVI, soil moisture). |

Full detail, migrations and security notes in [`docs/database.md`](./docs/database.md).

## 9. Key flows

### Scenario A — Success per phase (progressive enabling + withdrawal)

![Phase release flow](./docs/images/flow-release-phase.png)

The exporter deposits the total → the contract **enables** phase 1 → the satellite oracle confirms each phase's NDVI → the contract enables the next → the farmer **withdraws** USDC to their wallet whenever they decide → on enabling the last phase the escrow becomes `Completed`. Each `release_phase` is recorded in `phase_ledger` with its `tx_hash`; each `withdraw` is recorded in `withdrawals` with its `tx_hash`.

### Scenario B — Climate disaster (the "wow moment")

![Disaster flow](./docs/images/flow-disaster.png)

The farmer presses "Simulate Climate Disaster" → the oracle (admin) signs and sends `trigger_disaster` on-chain → the contract **freezes** future phases (protecting the exporter's balance) → the farmer can still withdraw what was already enabled → on pressing "Resolve Disaster", the oracle signs `resolve_disaster` with `rescue_bps=3000` → the contract **redistributes** the remaining balance: **30% to the farmer** (rescue fund) and **70% to the exporter** (refund). No tokens are burned. The impact is simultaneous on both views (exporter and farmer).

> *Without blockchain, this takes 6 months of paperwork and the farmer loses everything. Here the exporter doesn't lose their future money and the farmer doesn't go bankrupt — in 3 seconds.*

The editable Mermaid scripts for all diagrams are in [`docs/diagrams.md`](./docs/diagrams.md).

## 10. Tech stack

| Component | Technology |
|---|---|
| Smart contract | Soroban (Rust/WASM) — phase-based state logic + withdrawal + redistribution |
| Frontend | React 19 + Next.js 16 (App Router) + Tailwind v4 + Freighter wallet |
| Backend / oracles | Node.js — integrates OpenWeatherMap, IDEAM, Sentinel Hub (NDVI) |
| Soroban client | `@stellar/stellar-sdk` 16 (RPC + `TransactionBuilder` + `assembleTransaction`) |
| Authentication | `jose` (JWT) over Supabase |
| Database | Supabase (Postgres + Auth) |
| Stablecoin | USDC on Stellar testnet |
| USDC withdrawal | On-chain transfer from the contract to the farmer's wallet (MVP); Bitso API (prod v1); SEP-24 Anchor (scale) |
| Network | Stellar testnet (hackathon) / mainnet (prod) |

## 11. Prerequisites

- **Rust** (stable) + `wasm32-unknown-unknown` target and **`stellar-cli`** (with `soroban-cli`) to build, test and deploy the contract.
- **Node.js 20+** and **npm** for the frontend (Stellar SDK requires Node ≥ 20).
- A **Stellar testnet** account funded via Friendbot, with a USDC testnet trustline for the exporter, farmer and oracle.
- A **Supabase** project (URL + anon key) with migrations applied (see section 12).
- **Freighter** (browser extension) configured on Testnet to sign as the exporter.
- Optional: API keys for OpenWeatherMap and Sentinel Hub in production.

## 12. Installation and execution

### 12.1 Smart contract (Soroban)

```bash
# from the repo root
cd Stellar

# build the optimized WASM
stellar contract build
# -> target/wasm32v1-none/release/Agro_Factoring.wasm

# run the tests (47 tests with snapshots)
cargo test

# generate a testnet identity and fund it
stellar keys generate --global oracle --network testnet --fund

# deploy the contract
stellar contract deploy \
  --wasm target/wasm32v1-none/release/Agro_Factoring.wasm \
  --source oracle \
  --network testnet \
  -- \
  --admin <oracle-public-address>

# configure the USDC testnet address
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source oracle \
  --network testnet \
  -- \
  set_usdc \
  --usdc_address <USDC_TESTNET_CONTRACT_ID>

# initialize a sample escrow (5000 USDC, 1000 per phase)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <exporter> \
  --network testnet \
  -- \
  init \
  --exporter <exporter> --farmer <farmer> \
  --crop_id 1 --total_amount 5000000000 --amount_per_phase 1000000000

# enable phase 1 (does not transfer USDC, only enables for withdrawal)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <exporter> \
  --network testnet \
  -- \
  release_phase --crop_id 1 --phase_number 1

# the farmer withdraws 500 USDC from the contract to their wallet
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source oracle \
  --network testnet \
  -- \
  withdraw --crop_id 1 --amount 5000000000
```

> USDC uses 7 decimals on Stellar, so `5000 USDC` = `5000000000` stroops. The 47 test snapshots under `Stellar/contracts/Agro_Factoring/test_snapshots/` document the expected behavior of `init`, `release_phase`, `withdraw`, `trigger_disaster`, `resolve_disaster` and `reset_escrow` (written by `cargo test`, auditable diffs).

### 12.2 Backend / Oracles and Web (Next.js)

```bash
# from the repo root
cd web
cp .env.example .env
# fill .env with:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
#   NEXT_PUBLIC_STELLAR_CONTRACT_ID, NEXT_STELLAR_SECRET_KEY (oracle)
#   NEXT_STELLAR_USDC_CONTRACT_ID (SAC USDC testnet contract)
#   NEXT_PUBLIC_STELLAR_RPC_URL (Soroban RPC; defaults to testnet)
#   NEXT_PUBLIC_EXPORTER_PUBLIC_KEY, NEXT_PUBLIC_FARMER_PUBLIC_KEY
#   SUPER_SECRET_KEY (32 hex bytes to sign JWTs)

npm install
npm run dev
# -> http://localhost:3000
```

### 12.3 Supabase (schema + seed)

Migrations are already applied to the linked Supabase project (10 migrations listed in [`docs/database.md`](./docs/database.md)). To reproduce the schema in a new project, apply migrations in order from the Supabase dashboard or with `supabase db push`. The demo seed includes a crop (Café Caturra in Salento, Quindío), its 5-phase budget and the demo contract.

## 13. Roadmap

### Current stage — Hackathon MVP (API oracles)

- Operative Soroban smart contract on testnet with **9 functions**: `__constructor`, `set_usdc`, `init`, `release_phase`, `withdraw`, `trigger_disaster`, `resolve_disaster`, `reset_escrow`, `get_escrow_state`. **47 tests** (36 original + 11 for `withdraw`).
- `release_phase` **enables** USDC for withdrawal (does not transfer); `withdraw` transfers from the contract to the farmer.
- `resolve_disaster` **redistributes** the remaining balance (30% rescue / 70% refund), no tokens burned.
- Weather oracle via **API** (OpenWeatherMap / IDEAM Colombia): frost detection (`temp < 2 °C` > 4 h). Readings persisted in `weather_readings`.
- Phase verification via **satellite API** (Sentinel Hub NDVI) or georeferenced photo evidence.
- Role-aware dashboard (exporter / farmer) with the climate-disaster "wow moment".
- On-chain USDC withdrawal from the contract to the farmer's wallet; on-chain tx hash ledger in Supabase (`phase_ledger` + `withdrawals`).
- **8 tables** in Supabase + **10 migrations** applied.

### Next stage — Real weather data + real IoT

The next phase incorporates **real-time weather data** from official stations and physical IoT sensors deployed on the farm, complementing remote APIs with *in situ* measurements (soil moisture, local NDVI, canopy temperature). Each farm will have its IoT device(s) reporting to Supabase Edge Functions that evaluate parametric thresholds and trigger on-chain actions automatically — removing the MVP's "Simulate" button and replacing it with autonomous 24/7 detection. The `iot_readings` table is already reserved in the schema for this purpose. Full roadmap detail (including a native SEP-24 anchor and mainnet) in [`docs/roadmap.md`](./docs/roadmap.md).

### Geographic expansion — Brazil and Mexico

Once established and validated in Colombia, we plan to expand into large markets such as **Brazil and Mexico**, leveraging the same Stellar infrastructure, Bitso anchors in those countries, and adapting local agronomic cycles (coffee, cocoa, soy, corn). The multi-crop, multi-country and multi-currency pattern on the same blockchain is the structural advantage of the design.

## 14. Feature status

All features described in this document are **implemented and operational**: the smart contract compiles (9 functions, 47 tests) and deploys to Stellar testnet; the frontend signs and sends real on-chain transactions via `@stellar/stellar-sdk` 16; the Supabase schema is applied (8 tables, 10 migrations) with demo data loaded; the oracle signs as admin and the emulator inserts weather readings with auto-stop; USDC withdrawal from the contract to the farmer's wallet is real and on-chain. The hackathon MVP fulfills the end-to-end phase-enabling, withdrawal, climate-disaster and redistribution flows. Items pending for production hardening (Supabase RLS, password hashing, native SEP-24 anchor, physical IoT sensors) are documented specifically in [`docs/database.md`](./docs/database.md) and [`docs/roadmap.md`](./docs/roadmap.md).

## 15. Resources

- **System explainer video:** [https://www.youtube.com/watch?v=rHV3MJyaP30](https://www.youtube.com/watch?v=rHV3MJyaP30)
- **Pitch AgroFactoring (English):** [`docs/Pitch AgroFactoring-EN.pdf`](./docs/Pitch%20AgroFactoring-EN.pdf)
- **Pitch AgroFactoring (Spanish):** [`docs/Pitch AgroFactoring-ES.pdf`](./docs/Pitch%20AgroFactoring-ES.pdf)

## 16. License and credits

MIT license. Built for a hackathon on Stellar / Soroban, Next.js and Supabase. Diagrams generated with Mermaid (`.mmd` sources and PNGs in `docs/images/`).
