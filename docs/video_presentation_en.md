# Gamma Pitch — AgroFactoring

**Total target time: 4:30–5:00 min** (≈2:00 slides + ≈2:30 demo)

---

## PART 1 — SLIDES (≈2:00)

### Slide 1 — The Problem

**Slide description:**
- Large title: "Latin American agriculture loses billions of dollars a year"
- Three short bullets with icons:
  1. Banks won't lend to small farmers (climate risk)
  2. When they do, they hand over all the money at once with no control
  3. A climate disaster bankrupts both the farmer and the exporter
- Background photo of frost-damaged crop

**What to say:**

> "In LatAm, agriculture loses billions every year. Banks won't lend to small farmers because of climate risk. And when they do via traditional factoring, they hand over all the money at once, with no way to verify it's used correctly at each stage of planting. When frost or drought hits, the farmer loses everything and so does the exporter. Today, without blockchain, resolving this takes 6 months of paperwork."

---

### Slide 2 — The Solution

**Slide description:**
- Title: "Parametric AgroFactoring by Cycle"
- Simple diagram: Exporter → Smart Contract (escrow) → Farmer
  - Arrow "enables phase by phase"
  - Arrow "withdraws USDC whenever"
- Stellar + Soroban badge
- Three bullets: "Phase by phase · Withdraw at will · Automatic parametric rescue"

**What to say:**

> "We built on Stellar the first parametric AgroFactoring by cycle. An exporter funds the planting through a smart contract that acts as an intelligent escrow. The farmer does NOT receive all the money at once: the contract releases liquidity phase by phase of the agronomic cycle. The farmer withdraws USDC to their wallet whenever they decide. And if a weather oracle detects frost or drought, the contract freezes future phases and redistributes the balance: 30% rescue to the farmer, 70% refund to the exporter. No intermediaries, no insurance adjusters."

---

### Slide 3 — The Potential

**Slide description:**
- Title: "The potential"
- Three columns with large number + text:
  1. **Scalable** — climate oracles + IoT (NDVI, soil moisture)
  2. **Replicable** — any crop, any country
  3. **Transparent** — every move on-chain, traceable on Stellar Expert
- Stellar logo and mention: "Functional MVP on testnet, 47 tests passing"

**What to say:**

> "The potential is huge. It's scalable: we integrate climate oracles and IoT with NDVI and soil moisture. It's replicable: it works for any crop in any country. And it's transparent: every withdrawal and every redistribution is on-chain, auditable on Stellar Expert. Today it's already a functional MVP on testnet with 47 tests passing. Now let's go to the live demo."

---

## PART 2 — LIVE DEMO (≈2:30)

> **App:** https://webagro-factory.vercel.app/
> **Credentials:** exporter/expo2024 · farmer/agro2024

---

### Step 1 — Exporter login (0:00–0:15)

**Action:** Open the app, log in as `exportador` / `expo2024`.

**Presenter dialogue:**

> "We log in as the exporter. We see the dashboard with the contract ready to initialize."

---

### Step 2 — Exporter creates the escrow (0:15–0:45)

**Action:**
- Click **"Initialize Contract"**
- Modal opens with summary:
  - Café Caturra in Salento, Quindío
  - Total **5,000 USDC**
  - 5 phases of **1,000 USDC** each (Preparation, Sowing, Growing, Harvest, Dispatch)
- Confirm with Freighter

**Presenter dialogue:**

> "The exporter funds the escrow with 5,000 USDC across 5 phases: Preparation, Sowing, Growing, Harvest and Dispatch, 1,000 each. We sign with Freighter... the contract goes live on Stellar testnet. Note: the farmer does NOT have the money yet — it's only in custody."

---

### Step 3 — Launch the simulators (0:45–1:05)

**Action:**
- Go to the **"Emulator"** tab
- Click **"Start Emulator"**
- Watch the weather panel (temperature/rainfall) and the IoT panel (NDVI/soil moisture) auto-generating readings every 60s

**Presenter dialogue:**

> "We launch the emulator: it simulates IoT sensors and a weather station. Every 60 seconds it logs temperature, rainfall, NDVI and soil moisture — the data that in production would come from satellite and physical sensors."

---

### Step 4 — Advance to the first stage (1:05–1:30)

**Action:**
- Click **"Release Phase 1"**
- Modal shows: "Preparation · 1,000.00 USDC · recipient: farmer"
- Confirm
- Watch the timeline: Phase 1 turns green
- A tx hash appears in the ledger with a link to Stellar Expert

**Presenter dialogue:**

> "We release Phase 1 — Preparation. 1,000 USDC are now enabled for the farmer. Note: the contract does NOT transfer automatically — it only **enables**. The farmer decides when to withdraw. We see the on-chain transaction on Stellar Expert."

---

### Step 5 — The farmer makes a withdrawal (1:30–1:55)

**Action:**
- Switch to the farmer session (`agricultor` / `agro2024`)
- On the dashboard, see the BalanceCard with **1,000 USDC** available
- Click **"Withdraw Funds"**
- Modal: amount 500 USDC, bank Davivienda, account ****1234
- Confirm
- Green check animation + link to Stellar Expert

**Presenter dialogue:**

> "Now we log in as the farmer. We see 1,000 USDC available. We withdraw 500 to their bank account — a real on-chain USDC transfer from the contract to the farmer's wallet. In seconds, not months."

---

### Step 6 — Weather inclemency and redistribution (1:55–2:30)

**Action:**
- Switch back to exporter → emulator → **"Simulate Climate Disaster"** panel
- Click **"Simulate Disaster"** → 3-2-1 countdown → confirm
- Red banner "CONTRACT FROZEN" appears on both dashboards
- Emulator gets disabled
- Green panel **"Parametric Rescue Fund"** appears with preview:
  - Farmer rescue 30%
  - Exporter refund 70%
- Click **"Resolve Disaster"** → confirm
- Watch the on-chain redistribution

**Presenter dialogue:**

> "We simulate a frost. The climate oracle detects the disaster and the contract freezes instantly: future phases are locked, protecting the exporter. Now the Parametric Rescue Fund activates automatically. We resolve: the remaining balance is redistributed — 30% as rescue to the farmer so they don't go bankrupt, and 70% refunded to the exporter. All on-chain, no adjusters, no paperwork. In 3 seconds."

---

### Closing (2:30)

**Presenter dialogue:**

> "Without blockchain this takes 6 months and the farmer loses everything. Here, in seconds, the code protects both. This is AgroFactoring on Stellar. Thank you."

---

## Timing notes

| Block | Time |
|---|---|
| 3 slides | ~2:00 |
| Login + init escrow | ~0:45 |
| Emulator + release phase 1 | ~0:45 |
| Farmer withdrawal | ~0:25 |
| Disaster + redistribution | ~0:35 |
| Closing | ~0:10 |
| **Total** | **~4:40** |

---

## Rehearsal tips

- Keep **two browsers/sessions** open (exporter and farmer) to avoid losing time on the mid-demo login at step 5.
- Pre-connect Freighter to the exporter before starting.
- If anything fails on-chain (congested testnet), have a screenshot/video backup of the flow ready.