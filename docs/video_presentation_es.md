# Pitch Gamma — AgroFactoring

**Tiempo total objetivo: 4:30–5:00 min** (≈2:00 slides + ≈2:30 demo)

---

## PARTE 1 — SLIDES (≈2:00)

### Slide 1 — El problema

**Descripción para la diapositiva:**
- Título grande: "El agro latinoamericano pierde miles de millones al año"
- Tres bullets cortos con íconos:
  1. Los bancos no prestan a pequeños agricultores (riesgo climático)
  2. Cuando lo hacen, entregan todo el dinero de golpe sin control de uso
  3. Un desastre climático quiebra al agricultor y al exportador
- Foto de fondo de cultivo afectado por helada

**Lo que se dice:**

> "En LatAm, el agro pierde miles de millones anuales. Los bancos no prestan a pequeños agricultores por el riesgo climático. Y cuando lo hacen vía factoring tradicional, entregan todo el dinero de golpe, sin saber si se usa bien en cada etapa de la siembra. Si llega una helada o sequía, el agricultor pierde todo y el exportador también. Hoy, sin blockchain, resolver esto toma 6 meses de papeleo."

---

### Slide 2 — La solución

**Descripción para la diapositiva:**
- Título: "AgroFactoring Paramétrico por Ciclo"
- Diagrama simple: Exportador → Smart Contract (escrow) → Agricultor
  - Flecha "habilita fase por fase"
  - Flecha "retira USDC cuando quiere"
- Badge Stellar + Soroban
- Tres bullets: "Fase por fase · Retiro a voluntad · Rescate paramétrico automático"

**Lo que se dice:**

> "Construimos sobre Stellar el primer AgroFactoring paramétrico por ciclo. Un exportador financia la siembra a través de un smart contract que actúa como escrow inteligente. El agricultor NO recibe todo de golpe: el contrato libera liquidez fase por fase del ciclo agronómico. El agricultor retira USDC a su wallet cuando lo decide. Y si el oráculo climático detecta helada o sequía, el contrato congela fases futuras y redistribuye el saldo: 30% rescate al agricultor, 70% reembolso al exportador. Sin intermediarios, sin ajustadores."

---

### Slide 3 — El potencial

**Descripción para la diapositiva:**
- Título: "El potencial"
- Tres columnas con número grande + texto:
  1. **Escalable** — oráculos climáticos + IoT (NDVI, humedad suelo)
  2. **Replicable** — cualquier cultivo, cualquier país
  3. **Transparente** — cada movimiento on-chain, trazable en Stellar Expert
- Logo Stellar y mención: "MVP funcional en testnet, 47 tests pasando"

**Lo que se dice:**

> "El potencial es enorme. Es escalable: integramos oráculos climáticos e IoT con NDVI y humedad de suelo. Es replicable: sirve para cualquier cultivo en cualquier país. Y es transparente: cada retiro y cada redistribución queda on-chain, auditable en Stellar Expert. Hoy ya es un MVP funcional en testnet con 47 tests pasando. Ahora vamos al demo en vivo."

---

## PARTE 2 — DEMO EN VIVO (≈2:30)

> **App:** https://webagro-factory.vercel.app/
> **Credenciales:** exportador/expo2024 · agricultor/agro2024

---

### Paso 1 — Login del exportador (0:00–0:15)

**Acción:** Abrir la app, iniciar sesión como `exportador` / `expo2024`.

**Diálogo (presentador):**

> "Ingresamos como exportador. Vemos el dashboard con el contrato listo para inicializar."

---

### Paso 2 — El exportador crea el escrow (0:15–0:45)

**Acción:**
- Click en **"Initialize Contract"**
- Se abre el modal con resumen:
  - Café Caturra en Salento, Quindío
  - Total **5.000 USDC**
  - 5 fases de **1.000 USDC** cada una (Preparación, Siembra, Levante, Cosecha, Despacho)
- Confirmar con Freighter

**Diálogo (presentador):**

> "El exportador fondea el escrow con 5.000 USDC distribuidos en 5 fases: Preparación, Siembra, Levante, Cosecha y Despacho, 1.000 cada una. Firmamos con Freighter... el contrato queda activo en Stellar testnet. Noten: el agricultor aún NO tiene el dinero — solo está custodiado."

---

### Paso 3 — Lanzar simuladores (0:45–1:05)

**Acción:**
- Ir a la pestaña **"Emulador"**
- Click **"Iniciar Emulador"**
- Ver el panel climático (temperatura/lluvia) y el panel IoT (NDVI/humedad suelo) generando lecturas automáticas cada 60s

**Diálogo (presentador):**

> "Lanzamos el emulador: simula sensores IoT y estación climática. Cada 60 segundos registra temperatura, lluvia, NDVI y humedad de suelo — son los datos que en producción vendrían de satélite y sensores físicos."

---

### Paso 4 — Avanzar a la primera etapa (1:05–1:30)

**Acción:**
- Click en **"Liberar Fase 1"**
- Modal muestra: "Preparación · 1.000,00 USDC · destinatario: agricultor"
- Confirmar
- Ver la línea de tiempo: Fase 1 en verde
- Aparece tx hash en el ledger con link a Stellar Expert

**Diálogo (presentador):**

> "Liberamos la Fase 1 — Preparación. 1.000 USDC quedan habilitados para el agricultor. Ojo: el contrato NO transfiere automáticamente; solo **habilita**. El agricultor decide cuándo retirar. Vemos la transacción on-chain en Stellar Expert."

---

### Paso 5 — El agricultor hace el retiro (1:30–1:55)

**Acción:**
- Cambiar a sesión del agricultor (`agricultor` / `agro2024`)
- En el dashboard ver la BalanceCard con saldo disponible **1.000 USDC**
- Click **"Retirar Fondos"**
- Modal: monto 500 USDC, banco Davivienda, cuenta ****1234
- Confirmar
- Animación de check verde + link a Stellar Expert

**Diálogo (presentador):**

> "Ahora entramos como agricultor. Vemos 1.000 USDC disponibles. Retiramos 500 a su cuenta bancaria — una transferencia real de USDC on-chain del contrato a la wallet del agricultor. En segundos, no en meses."

---

### Paso 6 — Inclemencia climática y redistribución (1:55–2:30)

**Acción:**
- Volver al exportador → emulador → panel **"Simular Desastre Climático"**
- Click **"Simular Desastre"** → cuenta regresiva 3-2-1 → confirmar
- Aparece el banner rojo "CONTRATO CONGELADO" en ambos dashboards
- El emulador se deshabilita
- Aparece el panel verde **"Parametric Rescue Fund"** con preview:
  - Rescate agricultor 30%
  - Reembolso exportador 70%
- Click **"Resolver Desastre"** → confirmar
- Ver la redistribución on-chain

**Diálogo (presentador):**

> "Simulamos una helada. El oráculo climático detecta el desastre y el contrato se congela al instante: las fases futuras se bloquean, protegiendo al exportador. Ahora el Fondo de Rescate Paramétrico se activa automáticamente. Resolvemos: el saldo restante se redistribuye — 30% como rescate al agricultor para que no se quiebre, y 70% de reembolso al exportador. Todo on-chain, sin ajustadores, sin papeleo. En 3 segundos."

---

### Cierre (2:30)

**Diálogo (presentador):**

> "Sin blockchain esto toma 6 meses y el agricultor pierde todo. Aquí, en segundos, el código protege a ambos. Esto es AgroFactoring en Stellar. Gracias."

---

## Notas de tiempo

| Bloque | Tiempo |
|---|---|
| 3 slides | ~2:00 |
| Login + init escrow | ~0:45 |
| Emulador + liberar fase 1 | ~0:45 |
| Retiro del agricultor | ~0:25 |
| Desastre + redistribución | ~0:35 |
| Cierre | ~0:10 |
| **Total** | **~4:40** |

---

## Recomendaciones de ensayo

- Tener **dos navegadores/sesiones** abiertos (exportador y agricultor) para no perder tiempo en login intermedio del paso 5.
- Pre-conectar Freighter al exportador antes de empezar.
- Si algo falla on-chain (testnet congestionada), tener screenshot/video de respaldo del flujo.