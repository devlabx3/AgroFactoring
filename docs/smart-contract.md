# Smart Contract (Soroban)

> Volver a: [README](../README.md) · Ver también: [Arquitectura](./architecture.md) · Fuente: [`../Stellar/contracts/Agro_Factoring/src/lib.rs`](../Stellar/contracts/Agro_Factoring/src/lib.rs)

El contrato `Agro_Factoring` es la fuente de verdad on-chain del escrow por fases. Está escrito en Rust con `soroban-sdk` 26, compila a WASM y se ejecuta en el entorno Soroban de Stellar.

![Máquina de estados del escrow](./images/escrow-state-machine.png)

---

## 1. Estados del ciclo de vida (enum `EscrowStatus`)

| Estado | Significado | Transiciones permitidas |
|---|---|---|
| `Active` | El escrow está operativo; se pueden habilitar fases y el agricultor puede retirar. | → `Active` (siguiente fase), `Completed`, `Frozen` |
| `Completed` | Todas las fases habilitadas; el exportador recibió de vuelta su pago con intereses. | (terminal) |
| `Frozen` | El oráculo/admin declaró desastre; no se habilitan más fases. El agricultor aún puede retirar fondos ya habilitados. | → `withdraw` (fondos habilitados), `resolve_disaster` (redistribución), `reset_escrow` (devolución al exportador) |

`Frozen` **no es terminal**: el agricultor puede retirar lo ya habilitado, y el admin puede ejecutar `resolve_disaster` (redistribuir 30/70) o `reset_escrow` (devolver el saldo al exportador).

---

## 2. Estructura de datos (`EscrowData`)

```rust
pub struct EscrowData {
    pub exporter: Address,        // funder que deposita el USDC
    pub farmer: Address,          // beneficiario que retira los USDC habilitados
    pub crop_id: u64,             // identificador off-chain del cultivo
    pub total_amount: i128,       // USDC total depositado por adelantado
    pub current_phase: u32,       // última fase habilitada (0 = ninguna aún)
    pub amount_per_phase: i128,   // USDC habilitado en cada fase
    pub released_amount: i128,     // USDC acumulado habilitado para retiro (no transferido)
    pub withdrawn_amount: i128,   // USDC acumulado retirado por el agricultor
    pub status: EscrowStatus,     // estado del ciclo de vida
    pub usdc_address: Address,    // contrato USDC usado para los transfer
}
```

Dos contadores independientes:
- `released_amount`: USDC **habilitado** para retiro (incrementado por `release_phase`, no transfiere).
- `withdrawn_amount`: USDC efectivamente **retirado** por el agricultor (incrementado por `withdraw`).

Balance disponible para retiro = `released_amount - withdrawn_amount`.

Cada escrow se almacena en *persistent storage* bajo la clave `DataKey::Escrow(crop_id)`, de modo que sobrevive al archivado y se mantiene con TTL extendido.

## 3. Storage keys (enum `DataKey`)

| Key | Tipo de almacenamiento | Contenido |
|---|---|---|
| `Admin` | instance | Dirección del admin/oráculo fijada en el constructor. |
| `Usdc` | instance | Dirección del contrato USDC fijada con `set_usdc`. |
| `Escrow(u64)` | persistent | El `EscrowData` de cada cultivo, indexado por `crop_id`. |

## 4. Funciones expuestas (9)

### `__constructor(env, admin)`
Se ejecuta una sola vez al desplegar. Fija el admin/oráculo en instance storage. Aprovecha el patrón constructor de Protocol 22+, evitando una tx de `initialize` separada y el riesgo de *front-running* de inicialización.

### `set_usdc(env, usdc_address) -> Result<(), ContractError>`
Requiere `admin.require_auth()`. Registra la dirección del contrato USDC. Debe llamarse una vez antes de cualquier `init`.

### `init(env, exporter, farmer, crop_id, total_amount, amount_per_phase) -> Result<(), ContractError>`
- Requiere `exporter.require_auth()` (el exportador firma el depósito).
- Valida `total_amount > 0`, `amount_per_phase > 0` y `total_amount % amount_per_phase == 0` (montos parejos por fase).
- Rechaza re-inicialización con `AlreadyInitialized` si ya existe la clave para ese `crop_id`.
- Usa `TokenClient::new(&env, &usdc_address).transfer(&exporter, &env.current_contract_address(), &total_amount)` para tomar custodia total del USDC.
- Persiste el escrow en `Active`, `current_phase = 0`, `released_amount = 0`, `withdrawn_amount = 0`, y extiende el TTL.

### `release_phase(env, crop_id, phase_number) -> Result<(), ContractError>`
- Solo el exportador (`escrow.exporter.require_auth()`).
- Bloquea si `status == Frozen` (`EscrowFrozen`) o `status == Completed` (`InvalidPhase`).
- Exige orden estricto ascendente: `phase_number == current_phase + 1` (con `checked_add` para evitar overflow).
- Verifica `phase_number <= total_amount / amount_per_phase`.
- **Habilita** `amount_per_phase` para retiro (incrementa `released_amount`). **No transfiere USDC**: los fondos quedan en custodia del contrato hasta que el agricultor llame `withdraw`.
- Si `released_amount == total_amount`, el estado pasa a `Completed`.
- Refresca TTL del escrow.

### `withdraw(env, crop_id, amount) -> Result<(), ContractError>`
- Solo el admin/oráculo (`require_admin`). El agricultor se autentica off-chain vía el backend.
- Valida `amount > 0` (`InvalidAmount`).
- Verifica `amount <= released_amount - withdrawn_amount` (el agricultor solo puede retirar lo habilitado y no retirado; `InvalidAmount` si excede).
- Transfiere `amount` USDC del contrato al agricultor vía `TokenClient::transfer`.
- Incrementa `withdrawn_amount` (con `checked_add`).
- Funciona en escrows `Active`, `Completed` y `Frozen` (el agricultor puede retirar lo ya habilitado incluso después de un desastre).
- Refresca TTL del escrow.

### `trigger_disaster(env, exporter, farmer, crop_id) -> Result<(), ContractError>`
- Solo el admin/oráculo (`require_admin`).
- Valida que `exporter` y `farmer` coincidan con los del escrow (`PartyMismatch` si no).
- Pone `status = Frozen` y persiste. No mueve fondos: el escrow simplemente queda no-habilitable para nuevas fases. El agricultor aún puede retirar lo ya habilitado.

### `resolve_disaster(env, crop_id, rescue_bps) -> Result<(), ContractError>`
- Solo el admin/oráculo (`require_admin`).
- Valida `rescue_bps <= 10_000` (`InvalidAmount`).
- Requiere `status == Frozen` (`EscrowNotFrozen` si no).
- Calcula `remaining = total_amount - withdrawn_amount` (saldo real en el contrato).
- `rescue_amount = (remaining * rescue_bps) / 10_000` → transfiere al agricultor (fondo de rescate).
- `exporter_refund = remaining - rescue_amount` → transfiere al exportador (reembolso).
- Elimina el escrow del storage (el `crop_id` puede reusarse).
- **No quema tokens**: redistribuye el saldo entre agricultor y exportador. El frontend siempre pasa `rescue_bps = 3000` (30 % rescate / 70 % reembolso).

### `reset_escrow(env, crop_id) -> Result<(), ContractError>`
- Solo el admin/oráculo (`require_admin`).
- Calcula `remaining = total_amount - withdrawn_amount` (saldo real en el contrato, descontando lo ya retirado).
- Si `remaining > 0`, transfiere al exportador (devolución total de lo no retirado).
- Elimina el escrow del storage (el `crop_id` puede reusarse).
- Útil para reiniciar el flujo desde cero (e.g. desde el emulador).

### `get_escrow_state(env, exporter, farmer, crop_id) -> Result<EscrowData, ContractError>`
Lector de solo lectura que devuelve el `EscrowData` completo. Requiere que las partes coincidan, de modo que un tercero arbitrario no puede inspeccionar escrows ajenos.

## 5. Errores (`ContractError`)

| Código | Nombre | Cuándo |
|---|---|---|
| 1 | `NotInitialized` | No hay admin configurado (constructor no corrido). |
| 2 | `AlreadyInitialized` | Ya existe un escrow para ese `crop_id`. |
| 3 | `Unauthorized` | El caller no es el admin/exportador requerido. |
| 4 | `EscrowNotFound` | No hay escrow bajo ese `crop_id`. |
| 5 | `InvalidAmount` | Monto ≤ 0, no divisible, excede lo habilitado, o desbordaría el acumulado. |
| 6 | `EscrowFrozen` | Operación bloqueada porque el escrow está `Frozen`. |
| 7 | `InvalidPhase` | Número de fase fuera de orden o fuera de rango. |
| 8 | `UsdcNotConfigured` | No se llamó `set_usdc` aún. |
| 9 | `PartyMismatch` | `exporter`/`farmer` no coinciden con el escrow almacenado. |
| 11 | `EscrowNotFrozen` | `resolve_disaster` requiere un escrow `Frozen`. (El código 10 se reserva para errores del SAC token.) |

## 6. Gestión de TTL (anti-archivado)

```rust
const TTL_THRESHOLD: u32 = 100;       // ~8 minutos (ledgers de 5 s)
const TTL_EXTEND_TO: u32 = 518400;    // ~30 días
```

Cada acceso mutador (`init`, `release_phase`, `withdraw`, `trigger_disaster`) llama a `persistent.extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO)`, previniendo que un escrow inactivo durante semanas sea archivado y deje de ser legible.

## 7. Tests y snapshots

El contrato trae **47 tests** bajo [`../Stellar/contracts/Agro_Factoring/test_snapshots/test/`](../Stellar/contracts/Agro_Factoring/test_snapshots/test/), escritos automáticamente por `cargo test`:

- `test_set_usdc_works`, `test_set_usdc_unauthorized`
- `test_init_success`, `test_init_invalid_amount_zero`, `test_init_invalid_amount_negative`, `test_init_not_divisible`, `test_init_already_initialized`, `test_init_usdc_not_configured`, `test_init_unauthorized`
- `test_release_phase_success`, `test_release_all_phases_completes`, `test_release_phase_when_frozen`, `test_release_phase_out_of_order`, `test_release_when_completed`, `test_release_phase_not_found`, `test_release_phase_unauthorized`
- `test_withdraw_success`, `test_withdraw_full_enabled`, `test_withdraw_partial_then_rest`, `test_withdraw_exceeds_enabled`, `test_withdraw_without_release`, `test_withdraw_zero_or_negative`, `test_withdraw_not_found`, `test_withdraw_unauthorized`, `test_withdraw_after_freeze`, `test_withdraw_after_partial_withdraw_then_resolve`, `test_withdraw_after_partial_withdraw_then_reset`
- `test_trigger_disaster_success`, `test_trigger_disaster_unauthorized`, `test_trigger_disaster_party_mismatch`, `test_trigger_disaster_not_found`
- `test_reset_escrow_full_refund`, `test_reset_escrow_partial_refund`, `test_reset_escrow_allows_reinit`, `test_reset_escrow_when_frozen`, `test_reset_escrow_not_found`, `test_reset_escrow_unauthorized`
- `test_resolve_disaster_success`, `test_resolve_disaster_partial_release`, `test_resolve_disaster_not_frozen`, `test_resolve_disaster_not_found`, `test_resolve_disaster_unauthorized`, `test_resolve_disaster_allows_reinit`, `test_resolve_disaster_invalid_bps`
- `test_get_escrow_state_success`, `test_get_escrow_state_party_mismatch`, `test_get_escrow_state_not_found`

Los snapshots se diferencian contra cambios conductuales no intencionados (testing diferencial): un `git diff` en un `.json` de snapshot revela un cambio de comportamiento del contrato.

Para reproducirlos:

```bash
cd Stellar
cargo test -- --nocapture
```

## 8. Seguridad aplicada

- **Autorización explícita** con `require_auth()` en cada función privilegiada.
- **Anti-reinicialización** con `has(&DataKey::Escrow(crop_id))` en `init`.
- **Aritmética verificada** con `checked_add` en `release_phase` y `withdraw`.
- **Validación de parties** (`PartyMismatch`) en `trigger_disaster` y `get_escrow_state`.
- **Validación de saldo** en `withdraw`: el monto no puede exceder `released_amount - withdrawn_amount`.
- **TTL proactivo** en cada acceso mutador (previene archivado).
- **Storage keys tipados** (`enum DataKey`) evitan colisiones.
- **Sin trust en entradas:** los montos se validan (`> 0`, divisible, no excede habilitado) antes de cualquier transfer.
- **`resolve_disaster` solo en `Frozen`:** el admin no puede redistribuir un escrow activo sin haberlo congelado primero.
