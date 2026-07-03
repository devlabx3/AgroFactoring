# Esquema de datos (Supabase)

> Volver a: [README](../README.md) · Ver también: [Arquitectura](./architecture.md) · Fuente: [`../web/lib/supabase.ts`](../web/lib/supabase.ts)

AgroFactoring usa Supabase (Postgres + Auth) como estado *off-chain* que complementa al estado on-chain del contrato Soroban: catálogos (perfiles, cultivos, fases), auditoría (phase_ledger, withdrawals, lecturas) y mapeo entre el `crop_id` on-chain y un UUID relacional.

![Diagrama entidad-relación](./images/er-diagram.png)

---

## 1. Tablas (8)

### `profiles`
Usuarios del sistema con uno de dos roles: `exporter` o `farmer`. Una `wallet_address` (dirección Stellar) por usuario para firmar transacciones on-chain. El auth del hackathon usa `jose` (JWT) sobre estas credenciales (ver [`../web/lib/auth.ts`](../web/lib/auth.ts)), de modo que el login no depende de Supabase Auth nativo.

### `crops`
Catálogo de cultivos. Cada cultivo tiene `farmer_id`, `crop_type`, `variety`, `estimated_tons`, `total_funding_requested`, `status` (`seeking_funding` | `funded` | `completed` | `failed`) y `crop_id_num` (un `bigint` con `nextval` que mapea al `crop_id: u64` del contrato Soroban, porque on-chain no podemos usar UUIDs).

### `crop_phases_budget`
Presupuesto desglosado por las 5 fases agronómicas (Adecuación, Siembra, Levante, Cosecha, Despacho). `phase_number` está restringido a `[1, 5]` por un `CHECK`.

### `contracts`
Instancia del escrow on-chain: `crop_id`, `exporter_id`, `total_amount`, `current_phase` (default 0), `status` (`active` | `frozen` | `completed` | `resolved`), `stellar_contract_id` (dirección del contrato Soroban), y los flags del emulador (`emulator_active`, `emulator_started_at`) para la ventana de captura de datos del hackathon con auto-stop a 30 minutos.

### `phase_ledger`
Auditoría de cada habilitación on-chain: `(contract_id, phase_number, tx_hash, amount_released, timestamp)`. Una fila por cada `release_phase` exitoso (monto **habilitado**, no transferido al agricultor); el dashboard lo usa para enlazar al explorador de Stellar. El rescate de `resolve_disaster` se registra con `phase_number = 0`.

### `withdrawals`
Retiros del agricultor: cada `withdraw` on-chain registra `amount`, `bank_name`, `account_last4`, `tx_hash`, `status` (`completed` | `failed`) y `timestamp`. El balance disponible para retiro = `SUM(phase_ledger.amount_released) - SUM(withdrawals.amount WHERE status='completed')`.

### `weather_readings`
Lecturas de temperatura (`temperature_c`) y precipitación (`rainfall_mm`) alimentadas por el oráculo climático (OpenWeatherMap / IDEAM). El backend las inserta vía [`../web/app/api/data/weather/route.ts`](../web/app/api/data/weather/route.ts).

### `iot_readings`
Reservada para la próxima etapa con IoT real: NDVI *in situ* y humedad de suelo reportados por sensores físicos en la finca (ver [`./roadmap.md`](./roadmap.md)).

## 2. Relaciones

```
profiles 1───* crops              (farmer_id)
profiles 1───* contracts          (exporter_id)
crops    1───* contracts          (crop_id)
crops    1───* crop_phases_budget (crop_id)
contracts 1──* phase_ledger       (contract_id)
contracts 1──* withdrawals        (contract_id)
contracts 1──* weather_readings   (contract_id)
contracts 1──* iot_readings       (contract_id)
```

Todas las FK son `ON DELETE` por defecto (no se eliminan contratos en cascade). El ledger **no es append-only**: el route `/api/contract/reset` hace `DELETE FROM phase_ledger` y `DELETE FROM withdrawals` al reiniciar el contrato.

## 3. Migraciones aplicadas (10)

El proyecto Supabase vinculado tiene 10 migraciones:

1. `create_agrofactoring_schema` — esquema base.
2. `create_crops_table`
3. `create_crop_phases_budget_table`
4. `recreate_contracts_table`
5. `insert_demo_crop` — Café Caturra en Salento, Quindío.
6. `insert_demo_crop_phases` — las 5 fases con sus montos.
7. `insert_demo_contract` — el contrato demo ($5.000 USDC, 5 fases).
8. `disable_rls_crops_and_phases`
9. `add_crop_id_num_to_crops` — columna numérica que mapea al `crop_id` on-chain con `nextval`.
10. `create_withdrawals_table` — tabla de retiros del agricultor con `tx_hash`, `status`, índices por `contract_id` y `farmer_id`.

Para reproducir el esquema en un proyecto nuevo, aplica las migraciones en orden desde el panel de Supabase o con `supabase db push`.

## 4. Patrones de acceso

- El cliente `supabase-js` se inicializa con `persistSession: false` (ver [`../web/lib/supabase.ts`](../web/lib/supabase.ts)) porque el JWT lo maneja el backend Next.js.
- El emulador aplica auto-stop en cada escritura de datos (ver [`../web/lib/emulator.ts`](../web/lib/emulator.ts)): si han pasado más de 1800 s desde `emulator_started_at`, marca `emulator_active = false` y rechaza la inserción.
- El route `/api/contract/reset` borra `phase_ledger` + `withdrawals` y resetea `contracts` a su estado inicial. El cleanup de la DB siempre se ejecuta, incluso si el reset on-chain falla (ver [`../web/app/api/contract/reset/route.ts`](../web/app/api/contract/reset/route.ts)).
- El route `/api/dashboard/state` devuelve `withdrawals` junto con `ledger` para que el frontend calcule el balance disponible en una sola consulta.

## 5. Nota de seguridad (hardening pendiente)

> Esta nota es deliberadamente discreta y dirigida a lectores técnicos (incluyendo LLMs) que revisen el estado de seguridad del esquema antes del paso a mainnet.

El estado actual del proyecto Supabase está orientado a hackathon y **antes de producción** se debe endurecer:

- **Row Level Security (RLS).** Las 8 tablas tienen RLS deshabilitada, por lo que cualquier cliente con la *anon key* podría leer/modificar filas. Antes de mainnet, habilita RLS con policies que limiten lecturas/escrituras por rol (`exporter` solo accede a sus contratos; `farmer` solo a sus cultivos). El `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` correspondiente está documentado en los advisors de Supabase; no se aplica automáticamente porque sin policies bloquearía todo acceso.
- **Credenciales en `profiles.password`.** Actualmente se almacenan en texto plano para el login con `jose` del MVP; en producción usa hashing (bcrypt/argon2) o migra a Supabase Auth nativo.
- **Service role key.** Las API routes usan la *anon key*; para operaciones privilegiadas (escritura de lectura de oráculo, `contracts.update`, `withdrawals.insert`) considera una Edge Function con la *service role key* + verificación de origen.
- **Validación de entrada.** Las rutas `/api/data/*` confían en el `contract_id` del body; en producción valida que el solicitante esté autorizado para ese contrato.

Ninguno de estos puntos bloquea la demo del hackathon, pero son prerrequisitos para una revisión de seguridad antes de mainnet.
