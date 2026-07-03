# Diagramas (fuentes Mermaid)

> Volver a: [README](../README.md) · Las imágenes renderizadas (`.png`) viven en [`./images/`](./images/); aquí están los **scripts `.mmd`** editables.

Para regenerar una imagen, instala `@mermaid-js/mermaid-cli` y ejecuta:

```bash
npm install -g @mermaid-js/mermaid-cli
# si chromium no descarga: export PUPPETEER_SKIP_DOWNLOAD=true
#   y apunta a un chrome-headless-shell existente con PUPPETEER_EXECUTABLE_PATH=...
mmdc -i images/<nombre>.mmd -o images/<nombre>.png -b transparent -w 1600
```

> Alternativa online: pega el contenido del `.mmd` en https://mermaid.live y exporta como PNG/SVG.

---

## 1. Arquitectura de alto nivel — `architecture.mmd` → `architecture.png`

```mermaid
graph TD
    Exp[Exportador Miami/Brasil]
    Agr[Agricultor Colombia]
    SC["Smart Contract Soroban<br/>AgroFactoring"]
    ApiSat["Oráculo Satelital API<br/>Sentinel Hub / NDVI"]
    ApiClima["Oráculo Climático API<br/>IDEAM / OpenWeather"]
    Gateway["Anchor / Fiat Gateway<br/>Bitso, Airtm, Transak"]
    Nequi["Cuenta Agricultor<br/>Nequi / Banco / COP"]
    Rescue["Fondo de Rescate Paramétrico<br/>Reembolso Exportador / Quema Deuda"]
    DB[("Supabase Postgres<br/>perfiles, cultivos, contratos,<br/>fases, lecturas clima/IoT, ledger")]
    Web["Frontend Web<br/>Next.js + Freighter"]

    Exp -->|1. Deposita USDC total en escrow| SC
    SC -->|2. Libera Fase 1 inmediata| Agr
    ApiSat -->|3. Verifica avance de fase| SC
    SC -->|4. Desbloquea siguiente fase| Agr
    ApiClima -->|5. Detecta helada/sequía| SC
    SC -->|6. Congela escrow de fases futuras| Rescue
    Agr -->|7. Retira USDC desbloqueado| Gateway
    Gateway -->|8. Conversión y transferencia| Nequi
    Web -->|REST / Soroban RPC| SC
    Web -->|Supabase JS| DB
    ApiSat -.->|lecturas| DB
    ApiClima -.->|lecturas| DB
```

## 2. Máquina de estados del escrow — `escrow-state-machine.mmd` → `escrow-state-machine.png`

```mermaid
graph TD
    A([init: exportador deposita USDC total])
    B[Activo<br/>current_phase = 0]
    C[Activo - Fase 1 Liberada<br/>Adecuación]
    D[Activo - Fase 2 Liberada<br/>Siembra]
    E[Activo - Fase 3 Liberada<br/>Levante]
    F[Activo - Fase 4 Liberada<br/>Cosecha]
    G[Activo - Fase 5 Liberada<br/>Despacho]
    H([Completado<br/>todas las fases liberadas])
    I([Congelado<br/>desastre climático])

    A -->|release_phase 1| C
    B -->|release_phase 1| C
    C -->|release_phase 2| D
    D -->|release_phase 3| E
    E -->|release_phase 4| F
    F -->|release_phase 5| G
    G -->|última fase| H
    B -->|trigger_disaster| I
    C -->|trigger_disaster| I
    D -->|trigger_disaster| I
    E -->|trigger_disaster| I
    F -->|trigger_disaster| I
    G -->|trigger_disaster| I
```

## 3. Flujo de liberación por fase — `flow-release-phase.mmd` → `flow-release-phase.png`

```mermaid
sequenceDiagram
    participant E as Exportador
    participant SC as Smart Contract<br/>Soroban
    participant O as Oráculo Satelital<br/>(NDVI)
    participant A as Agricultor
    participant DB as Supabase

    E->>SC: init(farmer, crop_id, total, per_phase)
    SC->>SC: transfiere USDC total a custodia<br/>status = Active, phase = 0
    SC->>A: libera Fase 1 (Adecuación)
    SC->>DB: phase_ledger.insert(tx_hash, 1)

    O->>SC: verificación avance de fase
    SC->>A: libera Fase 2 (Siembra)
    SC->>DB: phase_ledger.insert(tx_hash, 2)

    O->>SC: verificación avance de fase
    SC->>A: libera Fase 3 (Levante)
    SC->>DB: phase_ledger.insert(tx_hash, 3)

    O->>SC: verificación avance de fase
    SC->>A: libera Fase 4 (Cosecha)
    SC->>DB: phase_ledger.insert(tx_hash, 4)

    O->>SC: verificación avance de fase
    SC->>A: libera Fase 5 (Despacho)
    SC->>SC: released == total<br/>status = Completed
    SC->>E: exportador recibe pago con intereses
    SC->>DB: phase_ledger.insert(tx_hash, 5)
```

## 4. Flujo de desastre climático — `flow-disaster.mmd` → `flow-disaster.png`

```mermaid
sequenceDiagram
    participant A as Agricultor<br/>(Dashboard)
    participant W as Web API<br/>(Node.js)
    participant O as Oráculo Climático<br/>(OpenWeather/IDEAM)
    participant DB as Supabase
    participant SC as Smart Contract<br/>Soroban
    participant E as Exportador

    A->>W: POST /api/data/weather<br/>{ temperature_c, contract_id }
    W->>DB: weather_readings.insert
    W->>W: detecta temp < 2°C por > 4h<br/>= TRIGGER de helada

    A->>W: "Simular Desastre Climático"
    W->>SC: trigger_disaster(exporter, farmer, crop_id)
    Note over SC: Firma oráculo (admin)<br/>+ simulation + sendTransaction
    SC-->>W: SUCCESS, tx_hash
    SC->>SC: status = FROZEN<br/>fases 3,4,5 congeladas
    SC->>SC: quema 30% deuda generada
    SC->>SC: libera Fondo de Rescate
    W->>DB: contracts.update(status='frozen')

    par impactos simultaneos
        Note over A: Deuda baja, Fondo activado,<br/>Fases 3-5 congeladas
    and
        Note over E: En Escrow -> Reembolso,<br/>Retorno recalculado
    end
```

## 5. Diagrama entidad-relación — `er-diagram.mmd` → `er-diagram.png`

```mermaid
erDiagram
    profiles ||--o{ crops : "farmer_id"
    profiles ||--o{ contracts : "exporter_id"
    crops ||--o{ contracts : "crop_id"
    crops ||--o{ crop_phases_budget : "crop_id"
    contracts ||--o{ phase_ledger : "contract_id"
    contracts ||--o{ weather_readings : "contract_id"
    contracts ||--o{ iot_readings : "contract_id"

    profiles { uuid id PK; text role; text username; text password; text wallet_address }
    crops { uuid id PK; uuid farmer_id FK; text crop_type; text variety; numeric estimated_tons; numeric total_funding_requested; text status; bigint crop_id_num }
    crop_phases_budget { uuid id PK; uuid crop_id FK; integer phase_number; text phase_name; numeric amount_requested }
    contracts { uuid id PK; uuid crop_id FK; uuid exporter_id FK; numeric total_amount; integer current_phase; text status; text stellar_contract_id; bool emulator_active }
    phase_ledger { uuid id PK; uuid contract_id FK; integer phase_number; text tx_hash; numeric amount_released; timestamptz timestamp }
    weather_readings { uuid id PK; uuid contract_id FK; timestamptz timestamp; float8 temperature_c; float8 rainfall_mm }
    iot_readings { uuid id PK; uuid contract_id FK; timestamptz timestamp; float8 ndvi_index; float8 soil_moisture }
```

## 6. Diagrama de componentes — `components.mmd` → `components.png`

```mermaid
graph TD
    subgraph Cliente[Capa Cliente]
        FE[Web Frontend<br/>Next.js 16 + React 19<br/>Tailwind v4]
        FW[Freighter Wallet<br/>Firma del exportador]
    end
    subgraph Blockchain[Capa Blockchain - Stellar]
        SC[Smart Contract Soroban<br/>Agro_Factoring.rs]
        USDC[USDC Stellar Asset<br/>Testnet]
    end
    subgraph Oraculos[Capa Oraculos - Backend]
        WEATHER[API OpenWeatherMap + IDEAM]
        SAT[API Sentinel Hub NDVI]
        PHOTO[Evidencia Fotografica Georef]
    end
    subgraph Datos[Capa Datos - Supabase]
        PG[(Postgres)]
        AUTH[Auth jose JWT]
    end
    subgraph Fiat[Capa Fiat - Ultima Milla]
        TRANSAK[Transak Widget MVP]
        BITSO[Bitso API Produccion v1]
        ANCHOR[Anchor SEP-24 Escala]
    end
    subgraph Agricola[Capa Agricola]
        FARM[Finca Agricultor GPS]
    end

    FE -->|Soroban RPC| SC
    FE --> FW
    FW -->|firma tx| SC
    SC --> USDC
    WEATHER -->|API pull| PG
    SAT -->|API pull| PG
    PHOTO -->|upload| PG
    WEATHER -->|trigger helada| FE
    SAT -->|trigger avance fase| FE
    FE -->|supabase-js| PG
    FE --> AUTH
    FE --> TRANSAK
    FE --> BITSO
    FE --> ANCHOR
    TRANSAK -->|USDC -> COP| FARM
    BITSO -->|USDC -> COP PSE/ACH| FARM
    ANCHOR -->|SEP-24 COP automatico| FARM
```

---

Los archivos `.mmd` fuente (con `config: layout: elk`) están en [`./images/`](./images/) junto a sus PNGs renderizados.