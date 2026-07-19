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

## Propuesta

A y C son no-fiscales: los resuelvo **de verdad** junto con el tipado de
`contracts`/`properties` (migrar lecturas legacy→canónico, defaults en el
normalizador). B y D tocan cálculo fiscal declarable → **no los toco sin tu OK**.
El fix de ambos es mecánico y está avalado por el patrón que ya usa fiscal v2
(leer canónico con fallback legacy). Con tu visto bueno, cierro los 2 stores en
una tanda 1b y sigo.
