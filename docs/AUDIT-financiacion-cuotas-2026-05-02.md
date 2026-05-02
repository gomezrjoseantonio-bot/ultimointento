# AUDITORÍA · módulo Financiación · estado real cuotas · propagación · imputación

> Fecha · 2026-05-02
> Repo · main · post-T27.1 mergeada
> Síntomas observados · ver §0
> NO modifica código · solo lectura

---

## 0 · Síntomas observados por Jose

Jose abre `https://ultimointentohoy.netlify.app/financiacion/listado` con 8 préstamos creados (FA32 firmada 26/09/2022 · TIN 3,13% · 25 años · vence sept 2047 · ya 41 cuotas pagadas según cuadro de amortización · etc) y observa:

- **Listado de préstamos** · todos muestran `Amortizado · 0/300 cuotas · 0,0%` aunque algunos llevan años activos
- **Capital vivo** · muestra el `capitalInicial` completo · NO se ha decrementado
- **Vista detalle del préstamo · tab Cuadro de amortización** · pinta correctamente cuotas pasadas (#41-43 con badge `Pagada`) · cuota en curso (#44 badge `En curso`) · pendientes (#45+ badge `Pendiente`)
- **Panel** · `DEUDA VIVA · -637.775 €` · cifra parece la suma de capitales iniciales · sin amortización
- **Intereses deducibles 2026** en listado · sí aparecen calculados (FA32 · +1.643 €)

---

## 1 · Modelo de datos

### Tipo `Prestamo`

**Path**: `src/types/prestamos.ts:41`

Interface completa (campos relevantes):

```typescript
export interface Prestamo {
  id: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  destinos?: DestinoCapital[];         // v2 – determina fiscalidad
  garantias?: Garantia[];
  // legacy deprecated
  inmuebleId?: string;
  afectacionesInmueble?: AfectacionInmueblePrestamo[];
  finalidad?: 'ADQUISICION' | 'REFORMA' | 'INVERSION' | 'PERSONAL' | 'OTRA';

  nombre: string;
  principalInicial: number;
  principalVivo: number;               // CAMPO CACHEADO – nunca actualizado automáticamente

  fechaFirma: string;
  fechaPrimerCargo: string;
  plazoMesesTotal: number;
  diaCargoMes: number;
  esquemaPrimerRecibo: 'NORMAL' | 'SOLO_INTERESES' | 'PRORRATA';

  tipo: 'FIJO' | 'VARIABLE' | 'MIXTO';
  sistema: 'FRANCES';
  tipoNominalAnualFijo?: number;
  indice?: 'EURIBOR' | 'OTRO';
  valorIndiceActual?: number;
  diferencial?: number;
  tramoFijoMeses?: number;
  tipoNominalAnualMixtoFijo?: number;

  carencia: 'NINGUNA' | 'CAPITAL' | 'TOTAL';
  carenciaMeses?: number;
  mesesSoloIntereses?: number;
  diferirPrimeraCuotaMeses?: number;
  prorratearPrimerPeriodo?: boolean;
  cobroMesVencido?: boolean;

  cuentaCargoId: string;
  bonificaciones?: Bonificacion[];

  cuotasPagadas: number;               // CAMPO CACHEADO – nunca actualizado automáticamente
  fechaUltimaCuotaPagada?: string;
  estado?: 'vivo' | 'cancelado' | 'pendiente_cancelacion_venta' | 'pendiente_completar';
  fechaCancelacion?: string;

  interesesAnualesDeclarados?: Record<number, number>;
  origenCreacion: 'MANUAL' | 'FEIN' | 'IMPORTACION';
  cuotasPagadasAlImportar?: number;
  capitalVivoAlImportar?: number;

  liquidacion?: unknown | null;        // absorbe loan_settlements (T7 sub-tarea 4 V63)
  planPagos?: PlanPagos;               // T15.3 – migrado desde keyval[planpagos_${id}]

  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Campos cacheados que NO se actualizan automáticamente al crear**:
- `principalVivo` – se inicializa a `principalInicial` en el wizard (`src/modules/horizon/financiacion/components/PrestamosWizard.tsx:45`)
- `cuotasPagadas` – se inicializa a `0` en el wizard (`PrestamosWizard.tsx:72`)

### Tipo `PeriodoPago` (cuota individual)

**Path**: `src/types/prestamos.ts:232`

```typescript
export interface PeriodoPago {
  periodo: number;
  devengoDesde: string;
  devengoHasta: string;
  fechaCargo: string;
  cuota: number;
  interes: number;
  amortizacion: number;
  principalFinal: number;
  esProrrateado?: boolean;
  esSoloIntereses?: boolean;
  diasDevengo?: number;
  pagado: boolean;
  fechaPagoReal?: string;
  movimientoTesoreriaId?: string;      // enlace a movements (campo existe, uso muy parcial)
}
```

No existe un tipo independiente `Cuota`. La cuota individual se llama `PeriodoPago`. Existe también una interface `CuotaPrestamo` en `src/types/loans.ts:34` (archivo legacy, no usado en el módulo activo).

### Almacenamiento de cuotas

**Las cuotas NO se almacenan como tabla aparte**. Se almacenan como array embebido dentro de `Prestamo.planPagos.periodos[]` (tipo `PlanPagos`). Toda la estructura `PlanPagos` vive en el campo `planPagos` del propio documento prestamo en el store `prestamos`.

```typescript
export interface PlanPagos {
  prestamoId: string;
  fechaGeneracion: string;
  periodos: PeriodoPago[];
  resumen: {
    totalIntereses: number;
    totalCuotas: number;
    fechaFinalizacion: string;
  };
  metadata?: { source?: 'generated' | 'property_sale' | 'loan_settlement'; ... };
}
```

### Store en IndexedDB

**Store `prestamos`** creado en `src/services/db.ts:2693`:
```javascript
const prestamosStore = db.createObjectStore('prestamos', { keyPath: 'id' });
prestamosStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
prestamosStore.createIndex('tipo', 'tipo', { unique: false });
prestamosStore.createIndex('createdAt', 'createdAt', { unique: false });
```

**NO existe store dedicado** `cuadroAmortizacion` ni `cuotasPrestamo`. Todo vive en el store `prestamos` como campo embebido. El store `keyval` tenía entradas `planpagos_${id}` que fueron migradas a `prestamos.planPagos` en T15.3.

### Relación con `gastosInmueble`

**No localizado**. No existe campo `prestamoId` en el tipo `gastosInmueble` ni en sus servicios. Los intereses de financiación en `gastosInmueble` tienen un campo `interesesFinanciacion` en el store `properties` (no en el store `gastosInmueble`), y se calculan en runtime; no se crean registros `gastosInmueble` a partir de préstamos automáticamente.

```bash
grep -rn "prestamoId\|prestamo_id\|relatedLoanId" src/types/gastosInmueble* src/services/gastosInmueble*
# → sin resultados
```

---

## 2 · Generación cuadro de amortización

### Función generadora

**`PrestamosCalculationService.generatePaymentSchedule(prestamo: Prestamo): PlanPagos`**

Path: `src/services/prestamosCalculationService.ts` (aprox. línea 280 en la clase, total 633 líneas)

**Es una función pura** (no accede a DB). Recibe el objeto `Prestamo` completo y devuelve `PlanPagos` con todos los `PeriodoPago[]`.

Firma efectiva:
```typescript
generatePaymentSchedule(prestamo: Prestamo): PlanPagos
```

Instancia exportada: `export const prestamosCalculationService = new PrestamosCalculationService()`.

### Determinación de fechas de cada cuota

Usa `prestamo.fechaPrimerCargo` (ISO date) como fecha de la primera cuota. Si el campo no es válido, calcula desde `fechaFirma + (mesesDiferimiento > 0 ? mesesDiferimiento : 1)` meses. Para meses siguientes aplica `addMonthsWithClampedDay(fechaActual, 1, paymentDay)` que preserva `diaCargoMes` con clamp al último día del mes cuando el mes es más corto (evita overflow). Día fijo configurable vía `prestamo.diaCargoMes`.

### Soporte de cambios de TIN (préstamos variables)

**Parcial/incompleto**. En `calculateBaseRate()`, los préstamos VARIABLE usan `valorIndiceActual + diferencial` como tasa constante para todo el cuadro. No modela revisiones futuras del Euríbor. Un cambio real del índice requiere regenerar el cuadro manualmente (el servicio sí tiene `hasAmortizationParametersChanged()` que detecta el cambio y regenera al actualizar el préstamo, pero prospectivamente el cuadro usa el índice actual congelado).

### Soporte de amortizaciones parciales anticipadas

**Solo simulación**. `prestamosCalculationService.simulateAmortization()` calcula el escenario hipotético (REDUCIR_PLAZO o REDUCIR_CUOTA) pero no modifica el cuadro. No hay función que aplique una amortización anticipada y regenere el cuadro inline. La UI en `LoanSettlementModal.tsx` existe pero no localizo conexión completa.

### Inconsistencia: dos lógicas de cuadro de amortización

Existen **dos implementaciones distintas** del cálculo francés:

1. **`PrestamosCalculationService.generatePaymentSchedule()`** · `src/services/prestamosCalculationService.ts` · cálculo en centavos, soporta prorrata, solo-intereses, día clamped, etc. Es la implementación autoritativa.

2. **`CuadroAmortizacion.tsx`** · `src/modules/horizon/financiacion/components/CuadroAmortizacion.tsx` · tiene su propia lógica de cálculo francés inline (líneas 76-120). Se usa cuando no se le pasan `periodos` precalculados. Simplificada (sin prorrata/soloIntereses). Se activa en el wizard y en la vista de bonificaciones.

Inconsistencia: si `CuadroAmortizacion` no recibe `periodos` precalculados, usa su propia lógica que puede diferir del cuadro real guardado.

### Consumidor del cuadro en la vista detalle

**`src/modules/financiacion/pages/DetallePage.tsx`** (nuevo módulo v5). Lee `plan = planes.get(id)` del contexto `FinanciacionOutletContext` que carga `FinanciacionPage.tsx` (llama `prestamosService.getPaymentPlan(p.id)` para cada préstamo). NO calcula el cuadro en el componente: lo recibe del service.

El viejo `PrestamoDetailPage.tsx` en `src/modules/horizon/financiacion/components/PrestamoDetailPage.tsx` también carga el plan con `prestamosService.getPaymentPlan(prestamoId)`.

---

## 3 · Cálculo de KPIs agregados

### Path del componente listado

**`src/modules/financiacion/pages/ListadoPage.tsx`** (nuevo módulo v5, ruta `/financiacion/listado`).
Ruta antigua (no visible en la URL observada por Jose): `src/modules/horizon/financiacion/Financiacion.tsx`.

### Origen de `cuotasPagadas` y `%amortizado` en el listado

`ListadoPage.tsx:40`:
```typescript
const cuotasPagadas = row.raw.cuotasPagadas ?? 0;
// ...
Amortizado · {cuotasPagadas}/{row.raw.plazoMesesTotal} cuotas
```

Lee directamente del campo `prestamo.cuotasPagadas` (**campo almacenado**, no calculado en runtime).

El porcentaje amortizado viene de `loanRowFromPrestamo()` en `src/modules/financiacion/helpers.ts:153-187`:

```typescript
const vivo = p.principalVivo || 0;                          // campo almacenado
const amort = Math.max(0, principal - vivo);
const porc = principal > 0 ? (amort / principal) * 100 : 0;
```

**No hay función `computePrestamoEstado` ni similar**. El estado se deriva de los campos almacenados.

### Origen de DEUDA VIVA en el Panel

**`src/modules/panel/PanelPage.tsx:188-191`**:

```typescript
const deudaViva = useMemo(
  () => prestamos.reduce((s, p) => s + (p.principalVivo ?? 0), 0),
  [prestamos],
);
```

Lee `prestamo.principalVivo` del store `prestamos` directamente (sin consultar planPagos). Si `principalVivo` no ha sido actualizado, suma los capitales iniciales.

El `dashboardService.ts:608-625` tiene una implementación alternativa que sí intenta leer `ultimaCuotaPagada.principalFinal` del plan, pero es el service del dashboard legacy, no el del Panel v5.

### Cómo el cuadro detalle determina estado Pagada/En curso/Pendiente

**`src/modules/financiacion/pages/DetallePage.tsx:478-482`**:

```typescript
const isCurrent =
  fecha.getFullYear() === referencia.getFullYear() &&
  fecha.getMonth() === referencia.getMonth();
const badgeLab = per.pagado ? 'Pagada' : isCurrent ? 'En curso' : 'Pendiente';
```

Lógica:
- `per.pagado === true` → **Pagada** (viene del flag `PeriodoPago.pagado` persistido en el plan)
- `per.pagado === false && fechaCargo en el mes actual` → **En curso**
- `per.pagado === false && fechaCargo en el futuro` → **Pendiente**

El estado se lee del flag `pagado` dentro del `planPagos` persistido, **no del campo `prestamo.cuotasPagadas`**. Por eso el detalle muestra correctamente aunque el listado muestre 0.

---

## 4 · Propagación a Tesorería

### ¿`createPrestamo` genera movements/treasuryEvents?

**NO**. `prestamosService.createPrestamo()` (`src/services/prestamosService.ts:242-280`) genera el plan de pagos y lo guarda, pero **no crea ningún `treasuryEvent` ni `movement`**.

### Generación de treasuryEvents para cuotas

La generación se hace en `generateMonthlyForecasts(year, month)` de `src/modules/horizon/tesoreria/services/treasurySyncService.ts:511-570`. Genera un `treasuryEvent` con `sourceType: 'hipoteca' | 'prestamo'` para el **mes concreto solicitado** si existe un periodo no pagado en ese mes.

**No existe backfill automático**. `generateMonthlyForecasts(year, month)` puede invocarse para cualquier mes (la UI de Tesorería permite navegar a meses anteriores), pero solo crea un evento cuando encuentra un `PeriodoPago` con `fechaCargo` en ese mes **y `!p.pagado`**. Por tanto, si las cuotas pasadas ya están marcadas como `pagado=true` en el plan (lo que hace `createPrestamo`), no genera ningún evento para ellas. No existe función que genere eventos confirmados para cuotas pasadas ya marcadas como pagadas.

### Campo origen en movements/treasuryEvents

`TreasuryEvent` define los campos dedicados `prestamoId?: string` y `numeroCuota?: number` (`src/services/db.ts:1188-1189`) para el enlace con cuotas de préstamo. `sourceType: 'hipoteca' | 'prestamo'` identifica el tipo. El campo `sourceId` se deja como `undefined` para eventos de préstamo/hipoteca (comentario en `treasurySyncService.ts:574`: "string UUID – incompatible with numeric sourceId field").

### Relación `prestamoId` en treasuryEvents

`treasurySyncService.ts:562-563` y `577-578` persiste:
```typescript
prestamoId: prestamo.id,
numeroCuota: currentPeriodo?.periodo,
sourceId: undefined,  // UUID string incompatible con el campo numeric sourceId
```

La conciliación inversa: `TreasuryReconciliationView.tsx:346` y `TesoreriaV4.tsx:543` leen `ev.prestamoId` y `ev.numeroCuota` directamente del treasury event para llamar `prestamosService.marcarCuotaManual(ev.prestamoId, ev.numeroCuota, ...)`.

---

## 5 · Imputación a gastosInmueble

### ¿Existe función que calcule intereses deducibles?

Sí, dos:

1. **`interesesTotalDeducible(prestamo, interesesTotalAño)`** · `src/services/prestamosService.ts:78-102`
   - Pura, sin DB
   - Calcula qué fracción de los intereses anuales es deducible según destinos (ADQUISICION/REFORMA vinculados a inmueble)

2. **`interesesDeduciblesInmueble(prestamo, inmuebleId, interesesTotalAño)`** · `src/services/financiacionImputacionService.ts:65-88`
   - Pura, sin DB
   - Igual pero desglosada por inmueble concreto

Ambas son **puras**: calculan en runtime, **no crean registros en `gastosInmueble`**.

### ¿Crea registros en `gastosInmueble`?

**NO**. No existe función que persista intereses de préstamo como `gastosInmueble`. Los intereses deducibles se calculan en runtime al renderizar el listado/dashboard de financiación.

### Cómo identifica si un préstamo es deducible

Regla (v2): `destinos[].tipo === 'ADQUISICION' | 'REFORMA'` con `destinos[].inmuebleId` definido → deducible. El factor es `sum(importesDeducibles) / principalInicial`.

Fallback legacy (si no hay destinos): usa `inmuebleId` (100%) o `afectacionesInmueble[].porcentaje`.

Préstamos de tipo `PERSONAL`, `INVERSION` u `OTRA` sin inmueble asociado → **no deducibles**.

### Tratamiento interés vs comisión

No localizado un tratamiento diferenciado automático. El interés se calcula desde `PeriodoPago.interes`. Las comisiones (`comisionApertura`, `comisionMantenimiento`) están en el modelo pero no se distribuyen como intereses deducibles.

### Cómo se calcula "Intereses deducibles 2026 +1.643 €"

**`src/modules/financiacion/FinanciacionPage.tsx:93-100`**:

```typescript
// Aproximación · intereses anuales = capitalVivo · TIN efectivo.
const interesesAnualEstim = (p.principalVivo * effectiveTIN(p)) / 100;
let intDed = interesesTotalDeducible(p, interesesAnualEstim);
return loanRowFromPrestamo(p, intDed);
```

**Es un cálculo runtime, no cacheado, no desde gastosInmueble**. Usa `p.principalVivo` (almacenado) × TIN efectivo como proxy del interés anual. Si `principalVivo` es incorrecto (igual al inicial), el cálculo sobreestima los intereses reales de la cuota 44 vs la cuota 1.

La cifra "+1.643 €" es plausible si FA32 tiene una fracción deducible pequeña (ej: 3% de ~54.000€ anual en intereses × fracción afectación).

---

## 6 · Punteado mensual

### ¿Existe función de matching movimiento ↔ cuota?

Sí. **`buscarCandidatosConciliacion(movimiento, prestamos)`** en `src/services/conciliacionService.ts:56-101`.

Criterios de matching:
- Importe: tolerancia ±1% (max score), ±5% (score medio), descarta si >5%
- Fecha: ±0 días (max), ±2 días, ±5 días, ±10 días (descarta si >10)
- Concepto: keywords `['hipoteca', 'préstamo', 'prestamo', 'recibo']` o nombre del préstamo (+20 puntos)
- Score mínimo para aparecer: 50 puntos

Confirmar una conciliación: `confirmarConciliacion(candidato, movimientoId)` llama `prestamosService.marcarCuotaManual()` que actualiza `PeriodoPago.pagado = true`, `movimientoTesoreriaId`, y recalcula `prestamo.cuotasPagadas` + `prestamo.principalVivo`.

### UI de punteado

- `src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx` · botón "Puntear" (`CheckCircle` component)
- `src/components/treasury/TreasuryReconciliationView.tsx:346` · también llama `marcarCuotaManual`
- `src/components/treasury/TesoreriaV4.tsx:543` · ídem

**La UI de punteado existe y está conectada** a través del servicio de conciliación. Funciona sobre el módulo de Tesorería, no desde el módulo Financiación directamente.

### Si NO existe punteado, ¿cómo se marca como pagada?

Hay tres formas:
1. **Automático por fecha**: `autoMarcarCuotasPagadas()` marca como pagadas todas las cuotas con `fechaCargo <= today`. Llamado desde el wizard (`PrestamosWizard.tsx:257·262`) al guardar el préstamo.
2. **Manual vía CalendarioPagosSection**: click en fila de cuota → `window.confirm` → `onCuotaPagada(periodo, !pagado)` → llama `marcarCuotaManual()`.
3. **Punteado de movimiento bancario** contra evento de tesorería vía `ConciliacionPageV2` o `TreasuryReconciliationView`.

---

## 7 · Cruce con backlog T7/T8/T9/T22.x

### T7 (Limpieza V60 · sub-tareas 1-8)

**Estado**: ✅ cerradas (pre-V6)

Sub-tareas relacionadas con préstamos:
- **T7 sub-tarea 1**: añadió campo `liquidacion` al tipo `Prestamo` para absorber el store `loan_settlements`. Campos creados "esperando uso real" según HANDOFF-V8 §8.2.
- **T7 sub-tarea 4**: eliminó el store `loan_settlements` en V63 y migró registros a `prestamos[id].liquidacion`.
- **T7 sub-tarea 3-5** (cierre pendiente en T10): no iniciado.

### T8 (refactor schemas restantes)

**Estado**: 🟠 desbloqueado tras T9 cierre (2026-05-01) · **NO iniciado**

Según HANDOFF-V8 §8.2:
> "Cache balance · histórico rentas activado · liquidación préstamo UI · backfill metadata documents · campos ya creados en T7 sub1 esperando uso real"

T8 incluye explícitamente "liquidación préstamo UI" y "cache balance" (probablemente se refiere a conectar `cuotasPagadas` / `principalVivo` correctamente). Está señalado como T31 en el backlog re-priorizado (tras T27·T28·T29·T30).

### T9 (bootstrap compromisos recurrentes)

**Estado**: ✅ cerrada 2026-05-01

T9 generó `compromisosRecurrentes` desde patrones de `gastosInmueble` histórico (IBI, comunidad, seguros). **No incluyó cuotas de préstamo**. El scope fue gastos de inmueble históricos, no cuotas de deuda.

### T22.x (Panel V5)

**Estado**: ✅ cerrada 2026-05-01

T22.3 creó la card "Financiación" del Panel que muestra `deudaViva`. El Panel V5 **lee `prestamo.principalVivo` directamente** (campo almacenado) sin consultar planPagos. Esto fue implementado así intencionalmente como placeholder "rápido" – ver 32 TODOs en Panel mencionados en HANDOFF-V8 §3.4.

### T7-bis auditoría

No localizado en docs un documento "T7-bis auditoría". No existe `docs/AUDIT-T7-*` en el repositorio.

### TODOs activos en código que tocan préstamos

```
src/services/dashboardService.ts:1678 · TODO: "EURIBOR reviews (when prestamos integrated)"
src/services/dashboardService.ts:1827 · TODO: "Add hipoteca type alerts when prestamos are integrated"
src/modules/financiacion/pages/DetallePage.tsx (tab movimientos) · "Movimientos vinculados en Tesorería · sub-tarea follow-up · enlazaremos los pagos recibidos en cuenta"
src/modules/financiacion/pages/DetallePage.tsx (tab documentos) · "Documentos del préstamo · escritura · condiciones · sellos · sub-tarea follow-up"
src/modules/horizon/financiacion/components/PrestamoDetailDrawer.tsx:141·146 · PDF + Excel export
```

El comentario "sub-tarea follow-up" en los tabs vacíos de DetallePage confirma que son stubs pendientes de implementación.

### ¿T8 tenía "liquidación préstamo UI" pendiente?

**Sí**. Confirmado en HANDOFF-V8 §8.2. No está implementado: `LoanSettlementModal.tsx` existe (`src/modules/horizon/financiacion/components/LoanSettlementModal.tsx`) pero no se localizó conexión activa de simulación + aplicación completa. El campo `prestamo.liquidacion` existe en el modelo pero no hay UI completa de creación de liquidación total/parcial.

---

## 8 · Vista detalle del préstamo · estado real

### Componente

**`src/modules/financiacion/pages/DetallePage.tsx`** (nuevo módulo v5).

También existe `src/modules/horizon/financiacion/components/PrestamoDetailPage.tsx` (versión legacy) que carga el plan del mismo servicio.

### Función que pinta cada fila

El componente `DetallePage.tsx` no delega a una función separada. La lógica inline en el `return`:

```typescript
// ventana = periodos filtrados según cuadroFilter (mes/trimestre/año/completo)
{ventana.map((per) => {
  const fecha = new Date(per.fechaCargo);
  const isCurrent =
    fecha.getFullYear() === referencia.getFullYear() &&
    fecha.getMonth() === referencia.getMonth();
  const badgeLab = per.pagado ? 'Pagada' : isCurrent ? 'En curso' : 'Pendiente';
  // ...
})}
```

`referencia = useMemo(() => new Date(), [])` → fecha actual sin dependencias (se calcula una vez al montar).

### De dónde sale el estado Pagada/En curso/Pendiente

- **Pagada**: `per.pagado === true` · flag booleano persistido en `PlanPagos.periodos[n].pagado`
- **En curso**: `per.pagado === false && fechaCargo.year === hoy.year && fechaCargo.month === hoy.month`
- **Pendiente**: todo lo demás (fecha futura y sin pagar)

**La lógica NO consulta movements**. Solo lee el flag `pagado` del plan persistido. Cuando `createPrestamo` marca periodos pasados como `pagado=true`, el detalle los muestra correctamente como "Pagada". Esto explica la asimetría: detalle funciona porque lee del plan; listado falla porque lee del campo cacheado.

### Cómo se carga el plan en DetallePage

`DetallePage` consume `planes.get(id)` del contexto `FinanciacionOutletContext`. Ese mapa lo construye `FinanciacionPage.tsx:57-66`:

```typescript
const planEntries = await Promise.all(
  list.map(async (p) => {
    const plan = await prestamosService.getPaymentPlan(p.id);
    return [p.id, plan] as const;
  }),
);
setPlanes(new Map(planEntries));
```

`getPaymentPlan` devuelve el plan persistido (con `pagado=true` en periodos pasados). Por eso el detalle funciona.

---

## 9 · Diagnóstico (8 preguntas)

### 1. ¿El cuadro de amortización derivado existe? ¿Funciona?

✅ **Existe y funciona** · `src/services/prestamosCalculationService.ts`

`generatePaymentSchedule(prestamo)` genera el cuadro completo (sistema francés, prorrata, solo-intereses, día clamped). Se llama en `createPrestamo` y `updatePrestamo` (cuando parámetros cambian). El cuadro se persiste en `prestamo.planPagos` en IndexedDB.

### 2. ¿Los KPIs agregados (capitalVivo · cuotasPagadas · %) son derivados o cacheados?

🟠 **Cacheados y rotos** · `src/modules/financiacion/helpers.ts:158-163` · `src/modules/panel/PanelPage.tsx:188`

`capitalVivo = p.principalVivo`, `cuotasPagadas = p.cuotasPagadas`, `%amortizado = (principalInicial - principalVivo) / principalInicial * 100`. Todos leen campos almacenados en el documento `Prestamo` en IndexedDB.

### 3. Si son cacheados · ¿qué los recalcula?

🟠 **Existe pero roto** · `src/services/prestamosService.ts:649` (función `autoMarcarCuotasPagadas`)

La función debería recalcular `cuotasPagadas` y `principalVivo` desde el plan. Se llama desde `PrestamosWizard.tsx:257·262` tras crear/editar un préstamo. **Bug identificado**:

```typescript
// prestamosService.ts:649 — autoMarcarCuotasPagadas
let changed = false;
for (const periodo of plan.periodos) {
  if (!periodo.pagado && new Date(periodo.fechaCargo) <= today) {
    periodo.pagado = true;
    periodo.fechaPagoReal = periodo.fechaCargo;
    changed = true;
  }
}
if (!changed) return prestamo;  // ← RETORNO TEMPRANO
// ...actualiza cuotasPagadas y principalVivo solo si changed === true
```

`createPrestamo` **ya marca los periodos pasados como `pagado=true` antes de llamar a `autoMarcarCuotasPagadas`** (líneas 265-273). Por tanto cuando el wizard llama a `autoMarcarCuotasPagadas`, todos los periodos pasados ya tienen `pagado=true`, `changed = false`, y la función retorna sin actualizar `prestamo.cuotasPagadas` ni `prestamo.principalVivo`.

Resultado: tras la creación, los campos quedan en sus valores iniciales (`cuotasPagadas = 0`, `principalVivo = principalInicial`) indefinidamente.

Los campos sí se actualizarían correctamente si el usuario luego:
- Hace click en una cuota desde `CalendarioPagosSection` (llama `marcarCuotaManual`)
- Confirma un punteado desde la conciliación de Tesorería (llama `marcarCuotaManual`)
- Edita y vuelve a guardar el préstamo (wizard llama `autoMarcarCuotasPagadas` de nuevo, pero el bug persiste)

El hook `useAutoMarcarCuotas` (`src/hooks/useAutoMarcarCuotas.ts`) existe pero **no se usa en ningún componente activo**.

### 4. ¿Las cuotas se propagan automáticamente a Tesorería al crear un préstamo?

❌ **No existe** · trabajo a construir

`createPrestamo` no genera `treasuryEvents`. La generación mensual de `generateMonthlyForecasts` solo actúa sobre el mes solicitado y no backfill. Al crear un préstamo con historia, no se generan eventos de tesorería para los meses pasados.

### 5. ¿Las cuotas pasadas se marcan automáticamente como pagadas?

🟠 **Existe pero roto** · `src/services/prestamosService.ts:265-273`

`createPrestamo` sí marca los `PeriodoPago.pagado = true` en el plan para fechas pasadas (antes de guardar el plan). El plan refleja el estado correcto. El problema es que el campo agregado `prestamo.cuotasPagadas` no se sincroniza por el bug descrito en §9.3.

### 6. ¿El interés se imputa automáticamente a `gastosInmueble`?

❌ **No existe** · trabajo a construir

`interesesTotalDeducible()` y `interesesDeduciblesInmueble()` son funciones puras runtime. No crean registros en `gastosInmueble`. La imputación de intereses al inmueble es solo de lectura / cálculo. El campo `properties.interesesFinanciacion` existe pero se actualiza manualmente (desde importación declaración AEAT histórica o edición directa).

### 7. ¿Existe matching/punteado entre movimiento real y cuota?

🟡 **Existe pero parcial** · `src/services/conciliacionService.ts:56-101`

La función `buscarCandidatosConciliacion()` hace matching por importe+fecha+concepto. La UI de punteado existe en Tesorería (ConciliacionPageV2, TreasuryReconciliationView, TesoreriaV4). El matching solo funciona sobre `treasuryEvents` existentes. Si no se han generado eventos de cuotas pasadas, no hay candidatos contra los que puntear desde la UI de Tesorería.

Desde el `CalendarioPagosSection` (detalle del préstamo) sí se puede marcar cuotas manualmente sin pasar por tesorería.

### 8. ¿La cifra "Intereses deducibles 2026" del listado funciona correctamente?

🟡 **Existe pero parcial** · `src/modules/financiacion/FinanciacionPage.tsx:93`

El cálculo runtime funciona correctamente en su lógica (fiscalidad por destino). El defecto es que usa `p.principalVivo` (campo cacheado incorrecto = capital inicial) para estimar los intereses anuales. Para un préstamo de 25 años con 41 cuotas pagadas, `principalVivo` debería ser ~40k€ menos que el inicial. El error relativo en el cálculo de intereses es proporcional al error en `principalVivo`. La cifra que ve Jose (~1.643 €) está sobrestimada en un porcentaje equivalente al capital ya amortizado.

---

## 10 · Tabla síntoma → causa raíz

| Síntoma observado | Causa raíz (de la auditoría) | Severidad | Archivo principal |
|---|---|---|---|
| Listado · 0/300 cuotas en todos | `autoMarcarCuotasPagadas` retorna early cuando `createPrestamo` ya marcó periodos como pagados; `prestamo.cuotasPagadas` nunca se actualiza | Alto | `src/services/prestamosService.ts:649` |
| Listado · 0,0% amortizado | `prestamo.principalVivo` nunca actualizado; `loanRowFromPrestamo` deriva porcentaje de `principalInicial - principalVivo = 0` | Alto | `src/modules/financiacion/helpers.ts:159-161` |
| Panel · DEUDA VIVA = suma capital inicial sin decrementar | Panel v5 lee `prestamo.principalVivo` directamente del store; campo nunca actualizado por el mismo bug | Alto | `src/modules/panel/PanelPage.tsx:188-191` |
| Detalle · cuadro pinta bien estados Pagada/En curso/Pendiente | `DetallePage` lee `per.pagado` del `PlanPagos` persistido (sí actualizado por `createPrestamo`) · no del campo `prestamo.cuotasPagadas`; lógica independiente del campo cacheado | — (correcto por diseño) | `src/modules/financiacion/pages/DetallePage.tsx:478-482` |
| Listado · "Intereses deducibles 2026 +1.643 €" funciona | El cálculo usa `principalVivo * effectiveTIN / 100` como proxy; dado que `principalVivo = principalInicial` (incorrecto), el valor está ligeramente sobreestimado pero el cálculo no es null/cero — funciona porque la fórmula no depende del estado real del plan | — (parcialmente correcto) | `src/modules/financiacion/FinanciacionPage.tsx:93-100` |
| Crear préstamo no propaga cuotas pasadas a movements | `createPrestamo` no llama `generateMonthlyForecasts` ni crea `treasuryEvents` para meses pasados; `treasurySyncService` solo opera sobre meses solicitados explícitamente | Alto | `src/services/prestamosService.ts:242` |

---

## 11 · Recomendación de continuación

El cuello de botella principal es un **bug de cableado de 1-2 líneas en `autoMarcarCuotasPagadas`**: la función retorna early cuando los periodos ya están marcados, sin ejecutar la sincronización de los campos agregados. Corregir eso (`if (!changed) { /* calcular pagados y actualizar */ }`) y llamar al método también al cargar la vista de listado (o en `FinanciacionPage.load()`) resolvería los síntomas del listado y el Panel de inmediato.

La propagación hacia Tesorería (cuotas pasadas como movements confirmados) y la imputación automática a `gastosInmueble` son **feature nuevas** que no existen en ninguna forma: requieren diseñar el flujo de backfill, decidir si las cuotas pasadas se imputan como gastos declarados o solo como previsiones, y conectar el punteado de Tesorería con el módulo de Financiación de forma bidireccional.

El trabajo estimado total varía mucho: el bug del campo cacheado es minutos de arreglo; el resto (backfill tesorería, imputación automática, tabs movimientos/documentos del detalle) es scope nuevo no trivial.

---

*Generated by Claude Code (auditoría T28-pre)*
