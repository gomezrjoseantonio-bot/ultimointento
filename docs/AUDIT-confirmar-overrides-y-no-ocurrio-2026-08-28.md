# AUDITORÍA · Confirmar treasury event: overrides guardados + "no ocurrió"

> Solo lectura · 2026-08-28 · base `main` @ `7eaf6e5` (#1810).
> Mapea qué hace HOY el código. No propone diseño.

---

## BLOQUE 1 · Qué se puede corregir al confirmar y qué se guarda

### 1.1 · Forma exacta de `ConfirmOverrides`

`src/services/treasuryConfirmationService.ts:57-69`

```ts
export interface ConfirmOverrides {
  amount?, date?, accountId?, description?, counterparty?,
  providerName?, providerNif?, invoiceNumber?, notes?
}
```

**No existe override de familia/subfamilia/categoryKey/conceptoId, ni de ámbito ni de
inmueble.** La reclasificación no viaja por aquí: va por `updateTreasuryEventFields`
(`treasuryConfirmationService.ts:1290-1364`), una llamada **previa y separada**.

### 1.2 · Tabla campo a campo — qué escribe `confirmTreasuryEvent`

| Override | → `Movement` | → línea `gastosInmueble` | → `treasuryEvent` |
|---|---|---|---|
| `amount` | ✅ `amount` con signo `:270,276` | ✅ `importe` `:408` | ✅ `actualAmount` `:509` — ❌ **`amount` (el previsto) NO se toca** |
| `date` | ✅ `date` + `valueDate` `:274-275` | ✅ `fecha` `:399` + `ejercicio` `:384` | ✅ `actualDate` `:505` — ❌ **`predictedDate` NO se toca** |
| `accountId` | ✅ `accountId` `:273` | ✅ `cuentaBancaria` `:418-419` | ❌ **NO se persiste** — `updatedEvent` `:500-515` no incluye `accountId` |
| `description` | ✅ `description` `:277` | ✅ `concepto` `:400` | ❌ **NO se persiste** |
| `counterparty` | ✅ `counterparty` `:278` | ✅ vía `proveedorNombre` (fallback) `:376-379,415` | ❌ **NO se persiste** |
| `providerName` / `providerNif` | ✅ `:280-281` | ✅ `proveedorNombre` / `proveedorNIF` `:415-416` | ❌ **NO se persiste** |
| `invoiceNumber` | ✅ `:282` | ✅ `:417` | ❌ **NO se persiste** |
| `notes` | ❌ no existe en `Movement` | ❌ | ✅ `notes` `:512` |
| **familia / subfamilia** | (del evento) `categoryKey`/`subtypeKey` `:298-299`, `category.tipo` `:288` | (del evento) `categoria` `:403`, `casillaAEAT` `:404-407`, `categoryKey`/`subtypeKey` `:423-424` | — **no hay override** |
| **conceptoId** | ✅ (del evento) `:302` | ❌ **la línea NO recibe `conceptoId`** | — |

**Respuesta directa a la pregunta clave:**

- **Importe → sí**, en los tres sitios (movement, línea, `actualAmount`).
- **Fecha de cargo → sí** en movement y línea (incluido `ejercicio`, que decide el año
  fiscal); en el evento solo como `actualDate`. `predictedDate` sigue diciendo el 27/8
  aunque el cargo fuera el 3/9.
- **Cuenta → sí** en movement (`accountId`) y en la línea (`cuentaBancaria`); **NO** en el
  evento. El `treasuryEvent` queda apuntando a la cuenta vieja para siempre. Solo se salva
  porque `scheduleAccountBalanceRecalc` `:575-578` recalcula las **dos** cuentas.
- **Familia/subfamilia → no se puede corregir en el override.** No es que se acepte y se
  ignore: **el campo no existe**. Sí se corrige, pero por otra vía y solo desde un camino
  de UI (ver 1.3).

### 1.3 · Cuál de los tres caminos de UI manda overrides

| Camino | Código | Qué manda |
|---|---|---|
| Ficha §4.5 (lápiz → Guardar) | `TesoreriaV6Page.tsx:783-796` | `updateTreasuryEventFields({categoryKey, subtypeKey, conceptoId, inmuebleId})` **y luego** `confirmTreasuryEvent({amount, date, accountId, description})` |
| Punteo de un clic (círculo) | `TesoreriaV6Page.tsx:571-581` | `confirmTreasuryEvent(id)` — **sin overrides** |
| "Confirmar el día" | `TesoreriaV6Page.tsx:662` | `confirmTreasuryEvent(id, {})` — **sin overrides** |
| Bulk | `treasuryConfirmationService.ts:1391` | sin overrides |

La reclasificación funciona porque `confirmTreasuryEvent` **relee el evento de la base**
(`:322`) después de que `updateTreasuryEventFields` lo haya escrito. Es decir:
**familia/subfamilia sí acaban en la línea y en el movimiento, pero solo si se pasa por la
ficha**, y por un acoplamiento de orden entre dos llamadas, no por el override.

### 1.4 · Punteo manual vs importación de extracto — **NO guardan lo mismo**

Importación: `bankStatementOrchestrator.ts:339-389` (`approvedMatches`).

| | Punteo manual | Importación de extracto |
|---|---|---|
| Crea `Movement` | ✅ nuevo, `source:'manual'`, `reference:'treasury_event:{id}'` | ❌ el movimiento **ya existe** (viene del banco); solo se le inyecta clasificación `:359-370` |
| Evento → `executed` | ✅ `:502-504` | ✅ `:345-352` |
| `actualAmount` | `Math.abs(...)` `:509-511` | **`movement.amount` sin `abs`** `:351` → **negativo en gastos**. Divergencia real de signo entre los dos caminos. |
| Línea de inmueble: **crea si falta** | ✅ `:436` | ❌ **nunca crea** — `cierreLineaInmueble.ts:91-95` lo dice explícitamente |
| Línea: qué campos escribe | ~18 campos: `importe`, `fecha`, `ejercicio`, `categoria`, `casillaAEAT`, `cuentaBancaria`, proveedor, `categoryKey`… `:396-427` | **4 campos**: `estado`, `estadoTesoreria`, `movimientoId`, `treasuryEventId` (`camposDeCierre`, `cierreLineaInmueble.ts:62-72`) |
| Enlace de la línea | por `treasuryEventId` | por `treasuryEventId` **o** por `origen-origenId` del recurrente `:139-152` |
| Respeta ejercicio declarado | ❌ no comprueba | ✅ `aceptaCierre` salta `estado:'declarado'` `:83-86` |

**Consecuencia práctica de #1810:** unificó *el cierre* (que la línea pase a deducible), no
*los datos*. Si el banco carga 87,40 € el 3/9 y la línea recurrente decía 82,00 € el 27/8,
**la importación deja la línea con el importe y la fecha previstos** y solo la marca como
confirmada. El punteo manual con override sí la corrige. La declaración deduce, en ese
caso, el importe equivocado.

---

## BLOQUE 2 · Cuando un previsto NO ocurre

### 2.1 · Sí existe la acción: `descartarPrevisto`

`src/services/treasuryDiscardService.ts:20-43`

Efecto: **NO borra**. Marca sobre el propio evento:

```ts
{ descartado: true, descartadoAt, motivoDescarte?, updatedAt }
```

`status` sigue siendo `'predicted'`. Rechaza descartar un `executed` (`:31-33`). Idempotente
(`:34`). Reversible con `recuperarPrevisto` (`:46-62`), que **elimina** las propiedades en vez
de ponerlas a `false`.

**No toca la línea de `gastosInmueble`.** La línea del recurrente se queda en
`estado:'previsto'` para siempre. Fiscalmente es correcto (`yaOcurrio` → `false`,
`gastoDeducible.ts:43-45`, no se deduce), pero la línea queda indistinguible de "aún no ha
pasado".

**Dónde está en UI:** botón ✕ "Descartar" en `PunteoList.tsx:389-401`, solo si
`it.estado === 'previsto'`. Cableado desde `DrawerCuenta:327,357,398`,
`DrawerCalendario:453`, `DrawerTarjeta:266` (piezas) → `TesoreriaV6Page.tsx:622-647`.
También automático al reclasificar una derrama como mejora: `TesoreriaV6Page.tsx:743`.

Consumidores del flag `descartado` (queda fuera de todo): `tesoreriaV6Metrics.ts:65,589`
(KPIs y cierre), `calendarioDias`, `movilAgrupacion`, `PanelPage.tsx:562`,
`gastoPorTarjeta.ts:85`, `estadoCobroContratoService.ts:40`, `DrawerCuenta:185,205`,
`DrawerTarjeta:109`.

### 2.2 · ¿Distingue 2a (este mes) de 2b (nunca)? **No.**

Hay **una sola acción**, y es **siempre puntual (2a)**: marca *ese* evento. La serie no se
toca:

- `previsionesIdempotencia.ts:59-65` — `esPrevisionIntocable` incluye `descartado`, así que
  al regenerar **ni se borra ni se reemite ese periodo**
  (`compromisosRecurrentesService.ts:663-710`).
- `treasurySyncService.ts:233` — `insertEvent` salta un `currentMonthEvent.descartado === true`.
- `treasuryBootstrapService.ts:151` — el wipe forward excluye descartados.

Los demás meses siguen generándose con normalidad. El compromiso no cambia de estado, ni de
`fechaFin`, ni de importe.

Para **2b (definitivo)** la única vía es dar de baja el compromiso, que vive en otro módulo
(Gastos/Compromisos, no Tesorería): `darDeBajaCompromiso(id, fechaUltimoCobro, motivo)`
`compromisosRecurrentesService.ts:251-278` → `estado:'baja'`, `fechaFin`, y
`borrarEventosFuturosCompromiso` retira las previsiones vivas. **Desde el punteo de
Tesorería no hay ningún gesto que lleve ahí**: descartar 12 meses seguidos es lo más cerca
que se puede estar de "esto no va a pasar nunca".

### 2.3 · El purgado del día 1 — confirmado, y peor de lo que se pensaba

`treasuryBootstrapService.ts:237-263`, paso 4:

```ts
if (ev.status === 'predicted' &&
    ev.executedMovementId == null &&
    ev.predictedDate < desdeIso) {
  await cursor.delete();
}
```

**Este filtro NO comprueba `descartado`.** El wipe forward del paso 0 sí lo hace (`:151`), la
purga retroactiva no. Como `descartarPrevisto` deja `status:'predicted'`, un descartado con
fecha del mes pasado **también se borra**.

Las dos consecuencias:

1. **Un predicted sin validar de agosto se borra sin dejar rastro** el primer día de
   septiembre. No queda registro de que se preveía un cargo que no llegó.
2. **Marcar "no ocurrió" tampoco lo salva.** Si el 28/8 descartas el recibo con motivo, la
   purga se lo lleva igual. **Hoy no existe ninguna forma de dejar constancia duradera de
   "este mes no hubo cargo".** La marca sobrevive mientras el evento esté en el mes en curso
   o en el futuro; en cuanto el mes pasa, se borra con todo lo demás.

**Matiz importante sobre el disparo:** no hay ningún cron ni tarea de "día 1".
`regenerateForecastsForward` se invoca desde acciones de usuario — `GastosPage.tsx:18`,
`DetallePage.tsx:156`, `NuevoContratoWizard.tsx:163`, `NominaPage.tsx:36`,
`onboardingRevealService.ts`, `inversionesTesoreriaSync.ts`. El borrado ocurre la **primera
vez que se abre una de esas pantallas ya entrado el mes nuevo**, no a las 00:00 del día 1.
El efecto es el mismo, solo que impredecible en el momento.

**Ventana de recuperación:** la V6 sí deja retroceder a un mes pasado mientras quede trabajo
— `limiteMeses.ts:33-60`, `mesMinimo` abre el mes del pendiente vencido más antiguo. Pero usa
`esPendiente` (`tesoreriaV6Metrics.ts:64-71`), que devuelve `false` para `descartado`: en
cuanto descartas el último pendiente de agosto, **el mes deja de ser accesible**. Y el
purgado, cuando llegue, borra el rastro.

---

## Entrega

**(1) Tabla campo-por-campo del override** — §1.2. Resumen: `ConfirmOverrides` acepta 9
campos (`treasuryConfirmationService.ts:57-69`); **familia/subfamilia/categoryKey/conceptoId
no están entre ellos**. De los que sí están: **importe** se guarda en movement + línea +
`actualAmount`; **fecha** en movement + línea (+`ejercicio`) + `actualDate`, pero **no en
`predictedDate`**; **cuenta** en movement + `cuentaBancaria` de la línea pero **NO en el
`treasuryEvent`** (`:500-515`); descripción/contraparte/proveedor/factura llegan a movement y
línea pero **tampoco al evento**. La familia sí se acaba guardando, pero por
`updateTreasuryEventFields` en una llamada aparte y solo desde la ficha
(`TesoreriaV6Page.tsx:783-790`); los tres punteos rápidos no mandan override ninguno.

**(2) Punteo manual vs importación: NO guardan lo mismo.** El manual escribe ~18 campos en la
línea y la **crea si no existe**; la importación escribe **4** (`estado`, `estadoTesoreria`,
`movimientoId`, `treasuryEventId` — `cierreLineaInmueble.ts:62-72`) y **nunca crea**. Importe,
fecha, cuenta, categoría y proveedor de la línea **no se actualizan al conciliar por
extracto**: se quedan con lo previsto. Además `actualAmount` queda con signo en la importación
(`bankStatementOrchestrator.ts:351`) y sin signo en el manual (`:509`).

**(3) "No ocurrió": una sola acción, siempre puntual.** `descartarPrevisto`
(`treasuryDiscardService.ts:20-43`) marca el evento `descartado:true` + `descartadoAt` +
`motivoDescarte`, sin borrarlo y sin tocar saldos; sale de KPIs, cierre, calendario y panel;
es reversible. **Afecta solo a ese evento** — la serie sigue viva y el motor no vuelve a
proponer ese mes (`previsionesIdempotencia.ts:59-65`, `treasurySyncService.ts:233`).
**ATLAS no distingue 2a de 2b**: para "nunca más" hay que dar de baja el compromiso desde
otro módulo (`compromisosRecurrentesService.ts:251-278`), y desde el punteo de Tesorería no
hay camino a esa acción.

**(4) Qué pasa con un predicted no validado al llegar el purgado.** Se **borra sin rastro**
(`treasuryBootstrapService.ts:247-254`), disparado por la primera navegación a
Gastos/Detalle/wizards ya entrado el mes nuevo, no por un cron. Y —hallazgo central de esta
auditoría— **el descarte no protege**: ese filtro es el único de los dos que omite la
comprobación `ev.descartado !== true` que sí tiene el wipe forward de `:151`. Hoy **no hay
ninguna forma de dejar constancia permanente de que un cargo previsto no ocurrió**.
