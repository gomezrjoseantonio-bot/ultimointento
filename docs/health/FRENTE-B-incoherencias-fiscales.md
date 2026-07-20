# FRENTE B · Incoherencias fiscales al tipar `contracts` y `properties`

> **Qué** · al tipar el `value` de los stores `contracts` (→ `Contract`) y
> `properties` (→ `Property`) en `AtlasHorizonDB`, `tsc` destapa 4 incoherencias.
> Dos tocan **cálculo fiscal de ejercicios declarables** (amortización AEAT y
> rendimiento del capital inmobiliario). Por protocolo VINCULANTE: **STOP y
> reporto antes de tocar nada.** Este documento es el reporte; no se ha
> modificado ningún cálculo fiscal.
>
> **Bloqueo** · `contracts` y `properties` son 2 de los 45 stores del frente. No
> se pueden tipar sin resolver estas 4 lecturas (prohibido `any`/`as`/silenciar).
> Resolver B y D implica editar código fiscal → el frente queda bloqueado en
> estos 2 stores hasta el visto bueno de Jose.

## Raíz común · legacy ↔ canónico

El modelo `Contract`/`Property` tiene campos **canónicos** (los que escribe hoy
la app) y campos **legacy opcionales** (español-antes / ubicación antigua) que
el trazado de escritura actual **ya no rellena**. Varios consumidores leen los
legacy → obtienen `undefined` sobre datos reales.

`contractService.ts` escribe **solo canónico**: valida `inmuebleId` (:554),
`inquilino` (:558-575), `fechaInicio`/`fechaFin` (:578,:608); **nunca** escribe
`propertyId`, `tenant`, `startDate`, `endDate`. → esos legacy son `undefined` en
todo contrato creado por la app. No son bugs latentes: son **activos**.

## Los 4 hallazgos (path:línea)

### 🔴 B · FISCAL · `aeatAmortizationService.ts:304,321`
```ts
const startYear = new Date(contract.startDate).getFullYear();       // :304
const endYear = contract.endDate ? new Date(contract.endDate)...    // :305
const contractStart = new Date(contract.startDate);                  // :321
```
Lee `contract.startDate`/`endDate` (legacy, `undefined`) en lugar de
`fechaInicio`/`fechaFin` (canónico). `new Date(undefined)` = *Invalid Date* →
`.getFullYear()` = `NaN` → `NaN <= exerciseYear` = `false` → **todo contrato se
descarta del filtro de activos** → el fallback de "días de alquiler" devuelve 0.
- **Función**: `getDiasAlquiler` (fallback cuando no hay `propertyDays`).
- **Impacto fiscal**: días de alquiler = 0 → base de amortización prorrateada mal
  → **amortización AEAT infravalorada** en ejercicios sin ocupación registrada.
- **Fix propuesto** (blessed): `contract.fechaInicio` / `contract.fechaFin`.

### 🔴 D · FISCAL · `rendimientoActivoService.ts:175,178`
```ts
const baseAmortizacion = property?.fiscalData?.baseAmortizacion ?? 0;          // :175
... : (property?.fiscalData?.amortizacionAnualInmueble ?? 0);                  // :178
```
Lee `fiscalData.baseAmortizacion` / `fiscalData.amortizacionAnualInmueble`, pero
esos campos **viven en `aeatAmortization`** (`db.ts:141,:143`), no en `fiscalData`
(`db.ts:45-61`, que no los declara). Lo hace **al revés** que el patrón canónico
ya establecido en fiscal v2:
```ts
// amortizacionAcumuladaService.ts:80-82 (canónico · aeatAmortization PRIMARO)
getPositiveNumber(property.aeatAmortization?.baseAmortizacion)
  ?? getPositiveNumber((property as any).fiscalData?.baseAmortizacion);
```
- **Impacto fiscal**: para toda propiedad con amortización en la ubicación
  canónica (`aeatAmortization`, el caso normal hoy) → `undefined → 0` →
  **amortización del inmueble = 0 en el rendimiento neto** → deducción
  infravalorada.
- **Fix propuesto** (blessed): copiar el coalescing de v2 →
  `property.aeatAmortization?.baseAmortizacion ?? property.fiscalData?.baseAmortizacion`.

### 🟡 A · NO fiscal (presupuesto) · `presupuestoService.ts:306,318,320,328`
```ts
inmuebleIds.includes(contract.propertyId.toString())   // :306
inmuebleId: contract.propertyId.toString(),            // :318
label: `Alquiler - ${contract.tenant.name}`,           // :320,:328
```
Lee `propertyId`/`tenant` (legacy `undefined`) → `undefined.toString()` /
`undefined.name` = **TypeError en runtime** al generar presupuesto desde
contratos. No es dato fiscal declarado (proyección de presupuesto).
- **Fix propuesto**: `contract.inmuebleId` / `contract.inquilino.nombre`.

### 🟡 C · NO fiscal (tipos) · `contractService.ts:142,150`
`normaliseDocumentMetadata` / `normaliseSignatureMetadata` devuelven objetos con
`plantilla?`/`metodo?` opcionales, pero `Contract.documentoContrato.plantilla` y
`Contract.firma.metodo` son **requeridos**. Mismatch de tipo, no de dato.
- **Fix propuesto**: default en el normalizador (`plantilla ?? 'habitual'`,
  `metodo ?? 'manual'`) o hacer opcionales los campos en `Contract` si de
  verdad lo son. A decidir al tipar.

## Resolución (aprobada por Jose · "aplica B+D (+A+C) y tipa")

- **B** · `aeatAmortizationService.ts` · lecturas `startDate/endDate` →
  `fechaInicio/fechaFin`. **Además** se descubrió que la query usaba el índice
  `'propertyId'` (keyPath legacy, muerto): se cambió a `getAll('contracts')` +
  filtro por `inmuebleId` (patrón de `getContractsByProperty`/`presupuestoService`).
  Ahora el fallback de días de alquiler funciona sobre datos canónicos.
- **D** · `rendimientoActivoService.ts` · coalescing canónico
  `aeatAmortization?.baseAmortizacion ?? fiscalData?.baseAmortizacion` (patrón
  fiscal v2). Se declararon `baseAmortizacion?`/`amortizacionAnualInmueble?` como
  ubicación LEGACY en `Property.fiscalData` (db.ts) para leer el fallback sin `as any`.
- **A** · `presupuestoService.ts` · lecturas de campos →
  `inmuebleId/inquilino/rentaMensual/diaPago`. El **gate `status === 'active'`
  NO se tocó** (lee campo legacy `status`, hoy el bucle está inactivo). Migrar
  el gate activaría generación de líneas de presupuesto de forma silenciosa →
  se deja como decisión explícita (ver "para la lista").
- **C** · `contractService.ts` · nuevo tipo `ContractMetadataInput` (Partial
  anidado) para los normalizadores → el merge `existing+updates` type-checkea
  sin `as`. Los normalizadores ya rellenaban `plantilla`/`metodo`.

`contracts` y `properties` quedan tipados. tsc 0. 18/45 stores tipados.

## `ingresos` · investigación (Tanda final) · ¿el write de tesorería es un bug? → NO

El store `ingresos` es **deliberadamente heterogéneo**: conviven dos familias de
registro y cada lector estrecha a la suya, sin contaminación cruzada.

- **Personal** `Ingreso = IngresoNomina | IngresoAutonomo | IngresoPension |
  IngresoOtro` (`types/personal.ts:468`) · discriminado por `tipo`, con
  `personalDataId`. Son los índices del store (`tipo`, `personalDataId`,
  `fechaActualizacion`).
- **Tesorería** `Ingreso` (`db.ts:1725`) · `origen`/`contraparte`/`fecha_emision`/
  `fecha_prevista_cobro`/`importe`/`destino`/`estado`. Sin `tipo` ni
  `personalDataId`. Lo escribe `treasuryCreationService` (rentas de contratos, nóminas).

Cómo conviven sin pisarse (verificado sitio a sitio):
- `budgetProjection:288` estrecha por `.tipo` → solo personal.
- `limitesFiscalesPlanesService:70` estrecha por `.personalDataId`+`.tipo` → solo personal.
- lectores IRPF/conciliación/declaración usan `getAllFromIndex('tipo',…)` → solo personal.
- **`fiscalSummaryService:366`** (excesos deducibles / carryforward · FISCAL) estrecha por
  `.destino==='inmueble_id' && .estado==='cobrado'` y suma `.importe` → **solo tesorería**.
- `treasuryForecastService:91,114` lee por id lo que escribió → solo tesorería.

**Conclusión**: el write de tesorería NO es un bug. Es más, `fiscalSummaryService`
(carryforward) LO NECESITA para leer las rentas de alquiler cobradas. Quitarlo
rompería ese cálculo fiscal declarable.

**Tipado** (DB_VERSION congelado → no se puede escindir): `value: unknown` (como
`keyval`). Los 15 lectores de tesorería (`treasuryCreationService`,
`treasuryForecastService`) que acceden a campos de tesorería sin estrechar se
narrowean a `Ingreso` en el `get`/`getAll` (una aserción por fetch). Los lectores
personales ya casteaban. Behavior-preserving (tests fiscales verdes).

## Para la lista (hallazgos · no son tareas)

1. **`presupuestoService` · bucle de ingresos por contrato DORMIDO**: gate
   `status === 'active'` sobre campo legacy que `contractService` no escribe
   (canónico `estadoContrato === 'activo'`). Decidir si activar (¿genera líneas
   duplicadas con otras fuentes?).
2. **Índice `contracts.propertyId` muerto**: keyPath = campo legacy `propertyId`
   nunca escrito. Cualquier `getAllFromIndex('contracts','propertyId',…)` devuelve
   vacío. Candidato a retirar en un futuro bump de versión (DB_VERSION congelado en 79).
3. **2 tests rojos pre-existentes** (ajenos a este cambio, ya rojos en main):
   `aeatAmortizationService.test.ts` (0 tests · "suite must contain at least one
   test") y `aeatAmortizationService.fallback.test.ts` (`improvementsAmortization`
   espera 106.36 = full-year 3%, el código prorratea por días desde la fecha de
   mejora → 0.29 para una mejora de 31-dic). Revisar cuál es el criterio correcto.
