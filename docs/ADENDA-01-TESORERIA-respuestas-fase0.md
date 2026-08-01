# ADENDA 01 · TESORERÍA · respuestas a la fase 0

**Fecha:** 1 agosto 2026
**Sustituye a:** §3 completo de `TAREA-CC-TESORERIA-V5.md` · y matiza §2, §4.5, §4.7
**El resto de la tarea sigue vigente.**

> Informe de fase 0 aceptado íntegro. Hizo exactamente lo que se le pidió: verificar y parar.
> Los nombres de componentes de §3 venían de documentación obsoleta (`ATLAS-mapa-stores-VIGENTE.md`, v53)
> y de un histórico anterior a T20. La verificación manda.

---

## 0 · NOMBRE

La tarea pasa a llamarse **TESORERÍA V6**. En código, comentarios y PR: `tesoreria-v6`.
Rama: **`feat/tesoreria-v6`**.
La "Tesorería v5" de T20 Fase 2 (mockup `atlas-tesoreria-v8.html`) es **lo que esta tarea sustituye**.

---

## 1 · DECISIONES · las 5 que bloqueaban

### D1 · Estado descartado → **BUMP a v84** (opción 1 de CC)

Aprobado. `descartar` **no es borrar** y no puede serlo: el motor de previsiones tiene que saber que
eso no va a ocurrir, y el usuario tiene que poder deshacerlo.

Campos opcionales en `TreasuryEvent`, sin stores nuevos y sin migración de datos:

```ts
descartado?: boolean;
descartadoAt?: string;   // ISO
motivoDescarte?: string; // opcional, libre
```

**Reglas:**
- Un evento con `descartado: true` **no se muestra** en Pendientes, **no entra** en los KPIs de
  pendiente entrar/salir, **no afecta** al Cierre y **no vuelve a proponerse** por el motor de
  previsiones. No toca ningún saldo (nunca ocurrió).
- Reversible mientras dure el toast (Deshacer) y también desde un filtro "descartados" si es barato
  de añadir; si no lo es, con el Deshacer basta para esta entrega.
- `deleteTreasuryEventCompletely()` **queda reservado** para borrado real, que no es lo que hace la ✕.

**Ignorar líneas de extracto (§4.7):** primero **verifica** si el mecanismo de deduplicación por hash
que ya existe (`enhancedDeduplicationService` / `batchHashUtils`) permite que una línea ignorada no
reaparezca al reimportar el mismo extracto.
- Si lo permite → úsalo, sin campos nuevos.
- Si no → **reporta antes de inventar nada**. No metas el estado en `keyval`.

### D2 · Se construye **SOBRE `PunteoList`** (recomendación de CC, aceptada)

No se tira el trabajo de #1499–#1503. `PunteoList` + `punteoAdapter` + `punteoModel` son la base de
las pestañas Pendientes / Todo {mes} de §4.4.

**Lo que hay que hacer es adaptar, no sustituir:**
- Vestir `PunteoList` con el lenguaje visual del mockup: tarjetas de grupo con subtotal en cabecera,
  filas alineadas sin sangría, anidamiento piso → habitación en rentas, título = texto del banco y
  subtítulo = traducción de ATLAS, lápiz y ✕ al hover.
- Si algo del mockup no cabe en `PunteoList` sin romperlo, **reporta**: se decide entonces, no por tu
  cuenta.
- El modelo `previsto/confirmado/conciliado` de `punteoModel.ts` **no se toca**.

### D3 · Catálogos → **mapeo explícito ahora + unificación en tarea aparte**

Los dos catálogos son capas distintas y el problema real es que ambos se declaran "fuente única":
- `TIPOS_GASTO_INMUEBLE_V2` → **capa de presentación** (familia → concepto). Es la que dibuja el mockup.
- `categoryCatalog.ts` → **capa de persistencia** (`categoryKey`). Es la que manda en DB y **alimenta
  el tratamiento fiscal**.

Para esta entrega: la ficha de §4.5 **muestra** familia/concepto de `TIPOS_GASTO_INMUEBLE_V2` y
**guarda** `categoryKey` de `categoryCatalog.ts`, con un mapeo explícito.

**Condiciones no negociables del mapeo:**
1. Vive en **un solo fichero nuevo**, declarado como tabla de traducción presentación→persistencia
   (no como tercer catálogo), y las cabeceras de los otros dos se corrigen para decir de qué son
   fuente única cada uno.
2. **Ninguna entrada se adivina.** Como `categoryKey` alimenta lo fiscal, un mapeo mal hecho contamina
   la declaración. Genera la tabla completa con las ~40 entradas y **los casos sin destino claro
   márcalos `PENDIENTE-JOSE`** en una lista aparte, en el PR, para que Jose los resuelva uno a uno.
   No inventes destino "razonable" para ninguno.
3. **Fuera "Financiación" del selector de familia** de §4.5 — tienes razón: no es categoría, es
   `sourceType` con selector de préstamo propio. Corrección del mockup asumida. Lo mismo aplica a
   Traspaso, que ya se resuelve con el tipo Transferencia.
4. La unificación real de los dos catálogos se hace en **tarea aparte**, no aquí.

### D4 · "A resolver" = **estado de la sesión de importación** (recomendación de CC, aceptada)

`punteoModel.ts` recién mergeado **no se toca**. `conciliado` sigue derivándose de
`source === 'import'`.

§4.7 se lee así: "cuadran" / "a resolver" / "ignoradas" describen **líneas del fichero durante la
sesión**, no estados del movimiento. Una vez guardado, lo que se materializa es un `Movement` con
`source: 'import'` y por tanto conciliado. Lo que quedó sin resolver **no se materializa**: sigue
pendiente en la sesión de importación hasta que se asigne, se cree o se ignore.

### D5 · `conciliado` no reversible desde UI

Confirmado tal como lo dejaste por escrito. `confirmado` sí (`revertTreasuryConfirmation()`).

### D6 · `/conciliacion` → **SE RETIRA en esta entrega**

Decisión de Jose. La V6 absorbe su función: conciliar es subir extracto por cuenta (§4.7) y
confirmar es la pestaña Pendientes (§4.4). Mantener dos pantallas que hacen lo mismo con distinto
lenguaje es la deuda que esta tarea viene a cerrar.

**Antes de borrar nada, verifica y reporta:**

```bash
# qué hace hoy /conciliacion y qué cuelga de ella
grep -rn "ConciliacionPage\|/conciliacion" src/
grep -rn "AddMovementModal" src/          # su alta de movimiento
# ¿algún servicio o vista depende de componentes que solo viven ahí?
```

Reporta en el PR una tabla **función de `/conciliacion` → dónde queda en la V6**. Reglas:

- Si toda función tiene destino en la V6 → retira la ruta y elimina los componentes que queden
  huérfanos (sin dejar código muerto ni imports rotos).
- **Si alguna función NO tiene destino en la V6 → PARA y reporta.** No la retires "casi" ni la dejes
  medio enrutada, y no improvises dónde meterla.
- Enlaces internos o accesos directos a `/conciliacion` → redirigen a `/tesoreria`.
- `AddMovementModal` se unifica en la ficha de §4.5 (ya previsto en §3).

Criterio de aceptación adicional: **no queda ninguna ruta, enlace ni componente de `/conciliacion`
accesible**, y ninguna función perdida por el camino.

---

## 2 · §3 REESCRITO · alcance con los nombres reales

| Real hoy | Acción |
|---|---|
| `modules/tesoreria/TesoreriaPage.tsx` + `tabs/VistaGeneralTab.tsx` + `tabs/MovimientosTab.tsx` | **SUSTITUIR** por la nueva página única |
| `pages/VistaCuentaPage.tsx` (`/tesoreria/cuenta/:accountId`) | **CONVERTIR en drawer** (§4.4). Si la ruta debe sobrevivir para enlaces directos, que renderice el mismo drawer sobre la página |
| `shared/components/Punteo/PunteoList.tsx` + `punteoAdapter` + `punteoModel` | **REUTILIZAR y vestir** (D2). No sustituir |
| `components/cuenta/CuentaWizard.tsx` | **REUTILIZAR** para §4.8 · añadir color de punto y orden. Ya cubre tipo, tarjeta, `openingBalance`/`openingBalanceDate` |
| `MovimientoDrawer` / `AddMovementModal` | **UNIFICAR** en la ficha única de §4.5 |
| `bankStatementOrchestrator.ts` + `universalBankImporter/` + `movementMatchingService.ts` | **REUTILIZAR el servicio**; la UI pasa a ser el drawer de §4.7. `BankStatementUploadPage` y `/tesoreria/importar` se absorben |
| `components/treasury/CalendarioMes12.tsx` + `MesDetalleDrawer.tsx` | **REUTILIZAR y vestir** para §4.3 y §4.9 |
| `modules/tesoreria/components/BankAccountCard.tsx` | **REUTILIZAR y vestir** para §4.2 |
| `accountBalanceService.recalculateBalance()` | **VÍA ÚNICA** del saldo vivo (§4.6). `Account.balance` es cache derivada, nunca fuente de verdad |
| `/conciliacion` (ConciliacionPage v2) | **RETIRAR en esta entrega** · ver D6 |
| `treasuryForecastService`, `treasurySyncService`, `loanSettlementService`, `propertySaleService`, `inversionesService`, `ejercicioLifecycleService`, `fiscalConciliationService` | **NO TOCAR** |
| `RadarPanel` / `treasuryRecommendations` / `matchingConfiguration` | Nada que hacer (no existen / retirados) |

**Rutas resultantes:** `/tesoreria` sirve la pantalla nueva. `/tesoreria/importar` y
`/tesoreria/importar-cuentas` quedan absorbidas o redirigen. `/configuracion/cuentas` y
`/configuracion/bancos-cuentas` siguen redirigiendo a `/tesoreria`.

---

## 3 · MOCKUP · defectos corregidos en origen

Los dos que reportaste eran reales y **ya están arreglados en el mockup**. Descárgalo de nuevo:

1. **`.pager` duplicado** — eliminado el bloque muerto. Manda el que describe §4.2: flechas
   circulares superpuestas (`position:absolute`, `border-radius:50%`), fuera del flujo, invisibles
   cuando están deshabilitadas.
2. **`--gold-ink` sobre cifras** — corregido a `--gold` en los cuatro sitios (escritorio: Neto de
   "Cómo va {mes}", Cierre del drawer de calendario, cifra de la desviación; móvil: cierre
   proyectado). Los usos de `--gold-ink` en hovers, fondos e iconos son legítimos y se quedan.

Tenías razón en las dos y en no tocarlas por tu cuenta.

---

## 4 · PENDIENTES DE HIGIENE · fuera de esta tarea

Anotados, no los hagas aquí:
- `ATLAS-mapa-stores-VIGENTE.md` duplicado y 30 versiones por detrás → renombrar a histórico y dejar
  una sola copia.
- Unificación real de `TIPOS_GASTO_INMUEBLE_V2` ↔ `categoryCatalog.ts`.

---

## 5 · ARRANQUE

Con D1–D5 respondidas, reescribe tu plan sobre §3 nuevo y **abre PR sin merge**. En la descripción:
el plan de mapeo de catálogos con la lista `PENDIENTE-JOSE`, y cualquier punto donde el mockup no
encaje en `PunteoList`.

Sigue vigente: **cualquier contradicción nueva → para y reporta.** La fase 0 ha demostrado que era
la parte más valiosa de la tarea.
