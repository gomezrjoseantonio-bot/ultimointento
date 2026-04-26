# ATLAS-mapa-stores-VIGENTE · 25 abril 2026

> **Auditoría de solo lectura** · AtlasHorizonDB · DB_VERSION = 53 (V5.3) · `src/services/db.ts`
>
> Generado: 25 abril 2026 · Pre-reset v3 · Rama `copilot/auditstores-25abril`
>
> **Reglas**: Cero asunciones · Cero invenciones · Cada hecho cita archivo + línea · Si ambiguo se documenta la ambigüedad.

---

## 1. RESUMEN EJECUTIVO

| Métrica | Valor |
|---|---|
| **DB Name** | `AtlasHorizonDB` |
| **DB Version** | `53` (V5.3) |
| **Archivo de definición** | `src/services/db.ts` (3256 líneas) |
| **Total stores activos** | **56** |
| **Stores ACTIVO** | 53 |
| **Stores INERTE** (solo escritura) | 1 (`reconciliationAuditLogs`) |
| **Stores ACTIVO/DEPRECATED** | 1 (`opexRules`) |
| **Stores SEMI-INERTE** (solo 2 lecturas, 0 escrituras directas halladas) | 1 (`configuracion_fiscal`) → corregido: ACTIVO vía `fiscalPaymentsService` |
| **Stores eliminados desde última versión conocida** | 12 (V4.2 + V4.4 + V4.5) |
| **Stores nuevos en V5.3** | 2 (`compromisosRecurrentes`, `viviendaHabitual`) |
| **BUGs históricos abiertos** | 4 de 9 (BUG-07, BUG-08, GAP-D2, GAP-D6) |
| **BUGs históricos cerrados** | 2 (GAP-P2, GAP-D1 parcialmente) |
| **BUGs históricos mutados/redefinidos** | 3 (GAP-P1, GAP-P3, GAP-P6) |
| **Refactors completos** | 2 (gastosInmueble, tesorería) |
| **Refactors parciales** | 2 (opexRules/compromisosRecurrentes, inversiones) |
| **Documento histórico de referencia** | `ATLAS-mapa-54-stores-9abril-historico.md` (reconstruido — original no encontrado en repo) |

### Hallazgos críticos

1. **DUAL-WRITE en opexRules**: El store `opexRules` fue oficialmente deprecado en V5.3 y su contenido migrado a `compromisosRecurrentes`, pero `opexService.ts:35` y los consumidores fiscales (`propertyExpenses.ts:116`, `operacionFiscalService.ts:177`) siguen escribiendo/leyendo de `opexRules`. Los registros nuevos creados post-upgrade V5.3 NO se replican a `compromisosRecurrentes`.

2. **`reconciliationAuditLogs` INERTE**: Datos de auditoría nunca consultados. Append-only sin consumidor.

3. **BUG-07 ABIERTO**: `rentaMensual` no es consumida por el motor de proyección mensual (`proyeccionMensualService`). La proyección usa `presupuestoLineas` y `treasuryEvents`, no `rentaMensual`.

4. **GAP-D6 ABIERTO**: `store/taxSlice.ts:326` fija `cuotaLiquida = cuotaIntegra` con comentario `// sin deducciones adicionales por ahora`. La UI de ResumenDeclaracion muestra 0 para cuotaLiquidaEstatal/Autonómica.

5. **`importSnapshot` solo restaura 3 stores** de 56 (`properties`, `documents`, `contracts`). Gap crítico de backup.

---

## 2. INVENTARIO POR BLOQUE TEMÁTICO

> Fuente única: `src/services/db.ts` · Versión DB = 53

### BLOQUE 1 — INMUEBLES

---

#### Store 1 · `properties`
- **Archivo**: `src/services/db.ts:2049`
- **Condición creación**: siempre (sin restricción de versión)
- **keyPath**: `id` · autoIncrement: true
- **Índices**:
  - `alias` → `alias` `{ unique: false }`
  - `address` → `address` `{ unique: false }`
- **Interface** (`db.ts:60`):
```typescript
export interface Property {
  id?: number;
  alias: string;
  globalAlias?: string;
  address: string;
  postalCode: string;
  province: string;
  municipality: string;
  ccaa: string;
  purchaseDate: string;
  cadastralReference?: string;
  squareMeters: number;
  bedrooms: number;
  bathrooms?: number;
  transmissionRegime: 'usada' | 'obra-nueva';
  state: 'activo' | 'vendido' | 'baja';
  notes?: string;
  porcentajePropiedad?: number;
  esUrbana?: boolean;
  acquisitionCosts: { price: number; itp?: number; itpIsManual?: boolean; iva?: number; ivaIsManual?: boolean; notary?: number; registry?: number; management?: number; psi?: number; realEstate?: number; other?: Array<{concept: string; amount: number}>; };
  documents: number[];
  fiscalData?: { cadastralValue?: number; constructionCadastralValue?: number; constructionPercentage?: number; cadastralRevised?: boolean; acquisitionDate?: string; contractUse?: 'vivienda-habitual'|'turistico'|'otros'; housingReduction?: boolean; isAccessory?: boolean; mainPropertyId?: number; accessoryData?: {...}; };
  aeatAmortization?: { acquisitionType: 'onerosa'|'lucrativa'|'mixta'; firstAcquisitionDate: string; transmissionDate?: string; cadastralValue: number; constructionCadastralValue: number; constructionPercentage: number; onerosoAcquisition?: {...}; lucrativoAcquisition?: {...}; baseAmortizacion?: number; mejorasAnteriores?: number; amortizacionAnualInmueble?: number; specialCase?: {...}; };
}
```
- **Versión DB introducida**: inicial (always)
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `components/fiscalidad/AmortizationDetail.tsx:36`, `components/kpi/KpiBuilder.tsx:162`, `services/tax/taxHydrationMapper.ts:133`, `pages/account/migracion/ImportarInmuebles.tsx:184,287`, +10 más
- **Escrituras**: `components/inmuebles/InmuebleFormCompact.tsx:423,427`, `pages/account/migracion/ImportarInmuebles.tsx:324,328`

---

#### Store 2 · `property_sales`
- **Archivo**: `src/services/db.ts:2055`
- **Condición creación**: siempre
- **keyPath**: `id` · autoIncrement: true
- **Índices**:
  - `propertyId` → `propertyId` `{ unique: false }`
  - `saleDate` → `saleDate` `{ unique: false }`
  - `status` → `status` `{ unique: false }`
  - `property-status` → `['propertyId','status']` `{ unique: false }`
- **Interface** (`db.ts:159`): `PropertySale` — id, propertyId, saleDate, salePrice, acquisitionCosts, capitalGain, status, notes, etc.
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `pages/GestionInmuebles/tabs/FichaTab.tsx:63`, `services/treasuryOverviewService.ts:172`, `services/propertySaleService.ts:1062,1279`
- **Escrituras**: `services/propertySaleService.ts:841,1034,1330`

---

#### Store 3 · `loan_settlements`
- **Archivo**: `src/services/db.ts:2063`
- **Condición creación**: siempre
- **keyPath**: `id` · autoIncrement: true
- **Índices**:
  - `loanId` → `loanId` `{ unique: false }`
  - `operationDate` → `operationDate` `{ unique: false }`
  - `status` → `status` `{ unique: false }`
  - `loan-status` → `['loanId','status']` `{ unique: false }`
- **Interface** (`db.ts:206`): `LoanSettlement` — id, loanId, operationDate, amount, principal, interest, status, notes
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/treasuryOverviewService.ts:175`, `services/loanSettlementService.ts:662`
- **Escrituras**: `services/loanSettlementService.ts:592`

---

#### Store 4 · `prestamos`
- **Archivo**: `src/services/db.ts:2409`
- **Condición creación**: siempre (Financiacion)
- **keyPath**: `id` (string UUID, no autoIncrement)
- **Índices**:
  - `inmuebleId` → `inmuebleId` `{ unique: false }`
  - `tipo` → `tipo` `{ unique: false }`
  - `createdAt` → `createdAt` `{ unique: false }`
- **Interface**: Tipo `Prestamo` en `src/types/prestamos.ts` (no definida en db.ts — `db.ts:2409` usa `{ keyPath: 'id' }` sin tipado explícito en AtlasHorizonDB schema)
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/migrations/migrateOrphanedInmuebleIds.ts:359`, `services/historicalCashflowCalculator.ts:133`, `services/reconciliacionService.ts:643`
- **Escrituras**: `services/migrations/migrateOrphanedInmuebleIds.ts:365`, `services/migrations/migrateFinanciacionV2.ts:108`, `services/migrations/migratePrestamos.ts:75`

---

#### Store 5 · `aeatCarryForwards`
- **Archivo**: `src/services/db.ts:2092`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `propertyId`, `taxYear`, `expirationYear`
- **Interface** (`db.ts:827`):
```typescript
export interface AEATCarryForward {
  id?: number;
  propertyId: number;
  taxYear: number;
  expirationYear: number;
  // campos adicionales unknown sin inspección completa
}
```
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/fiscalSummaryService.ts:158`, `services/alertasFiscalesService.ts:62`
- **Escrituras**: `services/fiscalSummaryService.ts:161,163`, `services/carryForwardService.ts:64,75,110`

---

#### Store 6 · `propertyDays`
- **Archivo**: `src/services/db.ts:2100`
- **keyPath**: `id` · autoIncrement: true
- **Índices**:
  - `propertyId` `{ unique: false }`
  - `taxYear` `{ unique: false }`
  - `property-year` → `['propertyId','taxYear']` `{ unique: true }`
- **Interface** (`db.ts:842`): `PropertyDays` — id, propertyId, taxYear, daysRented, daysFreeUse, daysOwnerUse
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/irpfCalculationService.ts:600`, `services/propertyOccupancyService.ts:10`, `services/aeatAmortizationService.ts:298`
- **Escrituras**: `services/propertyOccupancyService.ts:34,64`

---

#### Store 7 · `proveedores`
- **Archivo**: `src/services/db.ts:2110`
- **Condición**: siempre (V3.8)
- **keyPath**: `nif` (string — no autoIncrement)
- **Índices**: ninguno (keyPath es la PK)
- **Interface** (`db.ts:421`):
```typescript
export interface Proveedor {
  nif: string; // PK
  nombre: string;
  tipos: string[];
  createdAt: string;
  updatedAt: string;
}
```
- **Veredicto**: ✅ ACTIVO (uso ligero)
- **Lecturas**: `services/declaracionDistributorService.ts:1539`
- **Escrituras**: `services/declaracionDistributorService.ts:1544,1547`

---

#### Store 8 · `operacionesProveedor`
- **Archivo**: `src/services/db.ts:2115`
- **keyPath**: `id` · autoIncrement: true
- **Índices**:
  - `proveedorNif` `{ unique: false }`
  - `inmuebleId` `{ unique: false }`
  - `ejercicio` `{ unique: false }`
  - `prov-inmueble-ejercicio-tipo` → `['proveedorNif','inmuebleId','ejercicio','tipo']` `{ unique: true }`
- **Interface** (`db.ts:429`): `OperacionProveedor` — id, proveedorNif, inmuebleId, ejercicio, tipo, importe
- **Veredicto**: ✅ ACTIVO (uso ligero)
- **Lecturas**: `services/migrations/migrateOrphanedInmuebleIds.ts:322`
- **Escrituras**: `services/migrations/migrateOrphanedInmuebleIds.ts:328`, `services/declaracionDistributorService.ts:1557`

---

#### Store 9 · `gastosInmueble`
- **Archivo**: `src/services/db.ts:2123`
- **keyPath**: `id` · autoIncrement: true
- **Índices** (todos creados/garantizados):
  - `inmuebleId` `{ unique: false }`
  - `ejercicio` `{ unique: false }`
  - `inmueble-ejercicio` → `['inmuebleId','ejercicio']` `{ unique: false }`
  - `casillaAEAT` `{ unique: false }`
  - `origen` `{ unique: false }`
  - `estado` `{ unique: false }`
  - `origen-origenId` → `['origen','origenId']` `{ unique: false }`
  - `movimientoId` `{ unique: false }` (ensureIndex, PR3)
  - `treasuryEventId` `{ unique: false }` (ensureIndex, PR3)
- **Interface** (`db.ts:326`):
```typescript
export interface GastoInmueble {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  fecha: string;
  concepto: string;
  categoria: GastoCategoria;
  casillaAEAT: AEATBox;
  importe: number;
  importeBruto?: number;
  origen: GastoOrigen;
  origenId?: string;
  estado: GastoEstadoNuevo;
  proveedorNombre?: string;
  proveedorNIF?: string;
  invoiceNumber?: string;
  cuentaBancaria?: string;
  documentId?: number;
  movimientoId?: string;
  estadoTesoreria?: 'predicted' | 'confirmed';
  treasuryEventId?: number;
  facturaId?: number;
  facturaNoAplica?: boolean;
  justificanteId?: number;
  justificanteNoAplica?: boolean;
  categoryKey?: string;
  subtypeKey?: string;
  createdAt: string;
  updatedAt: string;
}
```
- **Veredicto**: ✅ ACTIVO (uso intensivo — store central del módulo inmuebles)
- **Lecturas**: `services/gastosInmuebleService.ts:25,54,59,64,69,74`, `services/historicalCashflowCalculator.ts:151`, `services/treasuryOverviewService.ts:170`, `services/operacionFiscalService.ts:115`
- **Escrituras**: `services/gastosInmuebleService.ts:28,38`, `services/migrations/migrateOrphanedInmuebleIds.ts:127`

---

#### Store 10 · `mejorasInmueble`
- **Archivo**: `src/services/db.ts:2143`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `inmuebleId`, `ejercicio`, `inmueble-ejercicio` (compuesto), `movimientoId` (ensureIndex), `treasuryEventId` (ensureIndex)
- **Interface** (`db.ts:363`): `MejoraInmueble` — id, inmuebleId, ejercicio, descripcion, tipo ('mejora'|'ampliacion'|'reparacion'), importe, fecha, proveedorNIF, proveedorNombre, invoiceNumber, documentId, movimientoId, estadoTesoreria, treasuryEventId, facturaId, facturaNoAplica, justificanteId, justificanteNoAplica, categoryKey, createdAt, updatedAt
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/mejorasInmuebleService.ts:27,33`, `services/gananciaPatrimonialService.ts:64`, `services/documentMatchingService.ts:96,202`
- **Escrituras**: `services/mejorasInmuebleService.ts:12`, `services/migracionGastosService.ts:81`

---

#### Store 11 · `mueblesInmueble`
- **Archivo**: `src/services/db.ts:2157`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `inmuebleId`, `ejercicio`, `inmueble-ejercicio`, `movimientoId` (ensureIndex), `treasuryEventId` (ensureIndex)
- **Interface** (`db.ts:391`): `MuebleInmueble` — id, inmuebleId, ejercicio, descripcion, fechaAlta, importe, vidaUtil, activo, fechaBaja, proveedorNIF, proveedorNombre, invoiceNumber, documentId, movimientoId, estadoTesoreria, treasuryEventId, facturaId, facturaNoAplica, justificanteId, justificanteNoAplica, categoryKey, createdAt, updatedAt
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/mueblesInmuebleService.ts:29,35`, `services/documentMatchingService.ts:97,225`
- **Escrituras**: `services/mueblesInmuebleService.ts:14`, `services/migracionGastosService.ts:115`

---

#### Store 12 · `vinculosAccesorio`
- **Archivo**: `src/services/db.ts:2542`
- **Condición**: siempre (V3.9)
- **keyPath**: `id` · autoIncrement: true
- **Índices**:
  - `inmueblePrincipalId` `{ unique: false }`
  - `inmuebleAccesorioId` `{ unique: false }`
  - `principal-accesorio-ejercicio` → `['inmueblePrincipalId','inmuebleAccesorioId','ejercicio']` `{ unique: true }`
- **Interface** (`db.ts:1956`):
```typescript
export interface VinculoAccesorio {
  id?: number;
  inmueblePrincipalId: number;
  inmuebleAccesorioId: number;
  ejercicio: number;
  fechaInicio: string;
  fechaFin?: string;
  estado: 'activo' | 'inactivo';
  origenCreacion: 'XML' | 'manual';
  createdAt: string;
  updatedAt: string;
}
```
- **Veredicto**: ✅ ACTIVO (uso ligero)
- **Lecturas**: `services/migrations/migrateOrphanedInmuebleIds.ts:376`
- **Escrituras**: `services/migrations/migrateOrphanedInmuebleIds.ts:383`, `services/declaracionDistributorService.ts:983`

---

#### Store 13 · `contracts`
- **Archivo**: `src/services/db.ts:2084`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `propertyId` `{ unique: false }`
- **Interface** (`db.ts:593`): `Contract` — id, propertyId, tenantName, tenantDNI, rentaMensual, startDate, endDate, estado, fianza, depositDays, contractType, incrementoAnual, etc. (extensa, ~160 líneas)
- **Veredicto**: ✅ ACTIVO (uso extenso)
- **Lecturas**: `services/fiscalSummaryService.ts:119`, `services/irpfCalculationService.ts:548`, `services/treasuryOverviewService.ts:169`, `services/informesDataService.ts:495`, +8 más
- **Escrituras**: `services/migrations/migrateOrphanedInmuebleIds.ts:348`, `services/documentIngestionService.ts:334`

---

#### Store 14 · `rentaMensual`
- **Archivo**: `src/services/db.ts:2201`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `contratoId`, `periodo`, `estado`
- **Interface** (`db.ts:757`):
```typescript
export interface RentaMensual {
  id?: number;
  contratoId: number;
  periodo: string; // YYYY-MM
  importePrevisto: number;
  importeCobradoAcum: number;
  estado: 'pendiente' | 'parcial' | 'cobrada' | 'impago' | 'revision';
  movimientosVinculados: number[];
  createdAt: string;
  updatedAt: string;
}
```
- **Veredicto**: ✅ ACTIVO — ⚠️ ver BUG-07: la proyección mensual NO consume este store
- **Lecturas**: `services/estimacionFiscalEnCursoService.ts:74`, `services/rendimientoActivoService.ts:133`, `services/contractService.ts:190,277,290`, `modules/horizon/tesoreria/components/MonthlyCalendar.tsx:43`
- **Escrituras**: `services/contractService.ts:193,266,281`

---

### BLOQUE 2 — INGRESOS / PERSONAL

---

#### Store 15 · `personalData`
- **Archivo**: `src/services/db.ts:2337`
- **Condición**: siempre (V1.2)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `dni` `{ unique: true }`, `fechaActualizacion` `{ unique: false }`
- **Interface**: `PersonalData` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/declaracionDistributorService.ts:1004`, `services/personalOnboardingService.ts:307`, `services/personalDataService.ts:27`
- **Escrituras**: `services/personalOnboardingService.ts:209,244`, `services/personalDataService.ts:54`

---

#### Store 16 · `personalModuleConfig`
- **Archivo**: `src/services/db.ts:2343`
- **keyPath**: `personalDataId` (no autoIncrement — FK a personalData)
- **Índices**: `fechaActualizacion` `{ unique: false }`
- **Interface**: `PersonalModuleConfig` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO (acceso solo via IDBTransaction, no via db.get directamente)
- **Lecturas**: `services/personalDataService.ts:75` (via transaction `['personalModuleConfig']`)
- **Escrituras**: `services/personalDataService.ts:108` (via transaction)

---

#### Store 17 · `nominas`
- **Archivo**: `src/services/db.ts:2348`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `personalDataId`, `activa`, `fechaActualizacion`
- **Interface**: `Nomina` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/nominaService.ts:94,110,141`, `services/ejercicioFiscalMigration.ts:335`
- **Escrituras**: `services/nominaService.ts:166,202,224`

---

#### Store 18 · `autonomos`
- **Archivo**: `src/services/db.ts:2355`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `personalDataId`, `activo`, `fechaActualizacion`
- **Interface**: `Autonomo` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/irpfCalculationService.ts:420`, `services/fiscalConciliationService.ts:385`, `services/declaracionOnboardingService.ts:1370`, `services/ejercicioFiscalMigration.ts:380`
- **Escrituras**: `autonomoService.ts` (via transaction pattern — no capturado en grep store-name, pero el servicio existe)

---

#### Store 19 · `pensiones`
- **Archivo**: `src/services/db.ts:2438`
- **Condición**: siempre (V2.5)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `personalDataId`, `activa`
- **Interface**: `PensionIngreso` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO (acceso solo via IDBTransaction)
- **Lecturas**: `services/pensionService.ts:20-23` (via transaction)
- **Escrituras**: `services/pensionService.ts:37-47,65-79,95-97` (via transaction)

---

#### Store 20 · `planesPensionInversion`
- **Archivo**: `src/services/db.ts:2362`
- **Condición**: siempre (V1.2)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `personalDataId`, `tipo`, `titularidad`, `esHistorico`, `fechaActualizacion`
- **Interface**: `PlanPensionInversion` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO (uso extenso)
- **Lecturas**: `services/inversionesService.ts:266`, `services/traspasosPlanesService.ts:87,132,164,196,231`, `services/declaracionDistributorService.ts:1014`, `services/valoracionesService.ts:70,221,319`, `services/planesInversionService.ts:23`
- **Escrituras**: `services/declaracionDistributorService.ts:1060,1064`, `services/db.ts:2843,2847` (migrarPlanesDuplicados)

---

#### Store 21 · `traspasosPlanes`
- **Archivo**: `src/services/db.ts:2372`
- **Condición**: siempre (V5.2)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `personalDataId`, `planOrigenId`, `planDestinoId`, `fecha`
- **Interface**: `TraspasoPlan` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/traspasosPlanesService.ts:388,405`
- **Escrituras**: `services/traspasosPlanesService.ts:356`, (delete) `services/traspasosPlanesService.ts:419`

---

#### Store 22 · `otrosIngresos`
- **Archivo**: `src/services/db.ts:2380`
- **Condición**: siempre (V1.2)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `personalDataId`, `tipo`, `activo`, `fechaActualizacion`
- **Interface**: `OtrosIngresos` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO (acceso via transaction)
- **Lecturas**: `services/otrosIngresosService.ts:22-23` (via transaction)
- **Escrituras**: `services/otrosIngresosService.ts:52-53,80-81,110-111` (via transaction)

---

#### Store 23 · `patronGastosPersonales`
- **Archivo**: `src/services/db.ts:2560`
- **Condición**: siempre (V4.3)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `personalDataId`, `categoria`, `origen`
- **Interface**: `PatronGastoPersonal` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/patronGastosPersonalesService.ts:33`
- **Escrituras**: `services/patronGastosPersonalesService.ts:27,36,142,158,212`, (delete) `services/patronGastosPersonalesService.ts:42,201`

---

#### Store 24 · `gastosPersonalesReal`
- **Archivo**: `src/services/db.ts:2568`
- **Condición**: siempre (V4.3)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `personalDataId`, `patronId`, `ejercicio`, `mes`, `ejercicio-mes` (compuesto), `tesoreriaEventoId`
- **Interface**: `GastoPersonalReal` — importada de `../types/personal`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `components/treasury/TesoreriaV4.tsx:545`, `services/treasuryOverviewService.ts:177`
- **Escrituras**: `services/gastosPersonalesRealService.ts:54`

---

#### Store 25 · `viviendaHabitual` *(nuevo V5.3)*
- **Archivo**: `src/services/db.ts:2646`
- **Condición**: siempre (V5.3) — nuevo en esta versión
- **keyPath**: `id` · autoIncrement: true
- **Índices** (todos via ensureIndex): `personalDataId`, `activa`, `vigenciaDesde`
- **Interface**: `ViviendaHabitual` — importada de `../types/viviendaHabitual`
- **Veredicto**: ✅ ACTIVO (nuevo — servicio completamente implementado)
- **Lecturas**: `services/personal/viviendaHabitualService.ts:41,49,63,85`
- **Escrituras**: `services/personal/viviendaHabitualService.ts:72,79,88,103`

---

### BLOQUE 3 — GASTOS / COMPROMISOS

---

#### Store 26 · `opexRules` *(⚠️ DEPRECATED en V5.3)*
- **Archivo**: `src/services/db.ts:2432`
- **Condición**: siempre (V2.2)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `propertyId` `{ unique: false }`
- **Interface** (`db.ts:1810`): `OpexRule` — id, propertyId, concepto, importe, frecuencia, categoria, cuentaCargo, fechaInicio, fechaFin, estado, etc.
- **⚠️ NOTA** (`db.ts:2624`): *"opexRules se mantiene en lectura por ahora para no romper la UI legacy de Inmuebles — futuras PRs deprecarán"*
- **Veredicto**: ✅ ACTIVO/DEPRECATED — ver Sección 5 (Refactors)
- **Lecturas**: `services/propertyExpenses.ts:116`, `services/operacionFiscalService.ts:177`, `services/opexService.ts:30,105`, `pages/inmuebles/InmueblesAnalisis.tsx:1201`
- **Escrituras**: `services/opexService.ts:35`

---

#### Store 27 · `compromisosRecurrentes` *(nuevo V5.3)*
- **Archivo**: `src/services/db.ts:2631`
- **Condición**: siempre (V5.3) — nuevo en esta versión
- **keyPath**: `id` · autoIncrement: true
- **Índices** (todos via ensureIndex): `ambito`, `personalDataId`, `inmuebleId`, `tipo`, `categoria`, `cuentaCargo`, `estado`, `fechaInicio`
- **Interface**: `CompromisoRecurrente` — importada de `../types/compromisosRecurrentes`; discriminador `ambito: 'personal' | 'inmueble'`
- **V5.3 Migración**: `db.ts:2658–2753` — al upgrade desde `oldVersion < 53`, copia registros de `opexRules` a `compromisosRecurrentes` con `ambito='inmueble'`
- **Veredicto**: ✅ ACTIVO (nuevo — servicio completamente implementado)
- **Lecturas**: `services/personal/compromisosRecurrentesService.ts:42,54,89,119`
- **Escrituras**: `services/personal/compromisosRecurrentesService.ts:73,106,125`

---

#### Store 28 · `presupuestos`
- **Archivo**: `src/services/db.ts:2275`
- **Condición**: siempre (H9)
- **keyPath**: `id` (UUID string — no autoIncrement)
- **Índices**: `year`, `estado`
- **Interface** (`db.ts:1667`): `Presupuesto` — id (UUID), year, nombre, estado, createdAt, updatedAt
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/budgetMatchingService.ts:111`, `modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:25,50,109,136,390`
- **Escrituras**: `presupuestoService.ts:43,59`, (delete) `presupuestoService.ts:83`

---

#### Store 29 · `presupuestoLineas`
- **Archivo**: `src/services/db.ts:2282`
- **keyPath**: `id` (UUID string)
- **Índices**: `presupuestoId`, `inmuebleId`, `tipo`, `categoria`, `frecuencia`, `origen`, `cuentaId`, `contratoId`, `prestamoId`
- **Interface** (`db.ts:1680`): `PresupuestoLinea` — id, presupuestoId, inmuebleId, tipo, categoria, concepto, importe, frecuencia, origen, etc.
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/budgetReclassificationService.ts:157`, `services/budgetMatchingService.ts:120`, `presupuestoService.ts:79,124`
- **Escrituras**: `presupuestoService.ts:105,132,149,414`

---

### BLOQUE 4 — TESORERÍA

---

#### Store 30 · `accounts`
- **Archivo**: `src/services/db.ts:2209`
- **Condición**: siempre (H8)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `destination`, `bank`, `isActive`
- **Interface** (`db.ts:864`): `Account` — id, alias, iban, bank, balance, isActive, destination, currency, type, lastImportDate, etc. (extensa)
- **Veredicto**: ✅ ACTIVO (uso intensivo — store central de tesorería)
- **Lecturas**: múltiples componentes — BankStatementWizard, BalancesBancariosView, OpexRuleForm, TabGastos, etc. · `services/bankStatementImportService.ts:233`, `services/enhancedTreasuryCreationService.ts:138,151,366`
- **Escrituras**: `pages/account/migracion/ImportarCuentas.tsx`, múltiples servicios de tesorería

---

#### Store 31 · `movements`
- **Archivo**: `src/services/db.ts:2217`
- **Condición**: siempre (H8)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `accountId`, `date`, `status`, `importBatch`, `duplicate-key` → `['accountId','date','amount','description']`
- **Interface** (`db.ts:942`): `Movement` — id, accountId, date, amount, description, category, status, importBatch, reconciled, matchedEventId, etc. (extensa, ~100 campos)
- **Veredicto**: ✅ ACTIVO (uso intensivo)
- **Lecturas**: `pages/GestionInmuebles/tabs/LineasAnualesTab.tsx:130,953`, `services/bankStatementImportService.ts:205`, `services/enhancedDeduplicationService.ts:100,268,322`
- **Escrituras**: `components/inbox/BankStatementWizard.tsx:183`, `services/bankStatementImportService.ts:311`, `services/budgetReclassificationService.ts:192`

---

#### Store 32 · `importBatches`
- **Archivo**: `src/services/db.ts:2228`
- **keyPath**: `id` (UUID string)
- **Índices**: `accountId`, `createdAt`
- **Interface** (`db.ts:1552`): `ImportBatch` — id, accountId, fileName, rowCount, status, createdAt
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `utils/batchHashUtils.ts:56`
- **Escrituras**: `services/treasuryApiService.ts:753`

---

#### Store 33 · `treasuryEvents`
- **Archivo**: `src/services/db.ts:2235`
- **Condición**: siempre (H9); else-branch garantiza índices GAP-3
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `type`, `predictedDate`, `accountId`, `status`, `sourceType`, `sourceId`, `año` (ensureIndex), `generadoPor` (ensureIndex), `certeza` (ensureIndex), `ambito` (ensureIndex, PR3), `inmuebleId` (ensureIndex, PR3)
- **Interface** (`db.ts:1096`): `TreasuryEvent` — extensa, ver líneas 1096-1162 en db.ts; incluye type, amount, predictedDate, status, sourceType/Id, ambito, categoryKey/Label, transferMetadata, providerName/Nif, facturaId, executedMovementId, etc.
- **Veredicto**: ✅ ACTIVO (store más activamente escrito del sistema)
- **Lecturas**: `components/treasury/TreasuryReconciliationView.tsx:329,430,471`, `components/treasury/TesoreriaV4.tsx:497,602,640`, múltiples servicios treasury
- **Escrituras**: `components/treasury/TreasuryReconciliationView.tsx:331,432,473,478,526,527,541`, `components/treasury/TesoreriaV4.tsx:510,529,604,642,647,702,703`, todos los treasury sync services

---

#### Store 34 · `treasuryRecommendations`
- **Archivo**: `src/services/db.ts:2262`
- **keyPath**: `id` (UUID string)
- **Índices**: `type`, `status`, `severity`, `createdAt`
- **Interface** (`db.ts:1208`): `TreasuryRecommendation` — id, type, status, severity, title, description, actions, createdAt
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/treasuryForecastService.ts:253`, `modules/horizon/tesoreria/components/RadarPanel.tsx:133`
- **Escrituras**: `services/treasuryForecastService.ts:256,307`

---

#### Store 35 · `matchingConfiguration`
- **Archivo**: `src/services/db.ts:2301`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `createdAt`
- **Interface** (`db.ts:1045`): `MatchingConfiguration` — id, rules, thresholds, createdAt
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/budgetMatchingService.ts:56`, `services/transferDetectionService.ts:147,342`
- **Escrituras**: `services/budgetMatchingService.ts:69,91`

---

#### Store 36 · `reconciliationAuditLogs`
- **Archivo**: `src/services/db.ts:2307`
- **Condición**: siempre (V1.1)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `action`, `movimientoId`, `timestamp`, `categoria`
- **Interface** (`db.ts:1165`): `ReconciliationAuditLog` — id, action, movimientoId, categoria, ambito, timestamp, details
- **Veredicto**: ⚠️ INERTE — append-only sin consumidor
- **Lecturas**: **NINGUNA** en código de producción
- **Escrituras**: `services/budgetReclassificationService.ts:203`, `services/movementLearningService.ts:544`

---

#### Store 37 · `movementLearningRules`
- **Archivo**: `src/services/db.ts:2316`
- **Condición**: siempre (V1.1)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `learnKey` `{ unique: true }`, `categoria`, `ambito`, `createdAt`, `appliedCount`
- **Interface** (`db.ts:1178`): `MovementLearningRule` — id, learnKey, categoria, ambito, pattern, appliedCount, createdAt
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/movementLearningService.ts:137,222,277,374,585`
- **Escrituras**: `services/movementLearningService.ts:149,183,232,251,353,422`

---

#### Store 38 · `learningLogs`
- **Archivo**: `src/services/db.ts:2325`
- **Condición**: siempre (V1.1)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `action`, `learnKey`, `categoria`, `ts`, `movimientoId`, `ruleId`
- **Interface** (`db.ts:1195`): `LearningLog` — id, action, learnKey, categoria, ts, movimientoId, ruleId
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/movementLearningService.ts:613`
- **Escrituras**: `services/movementLearningService.ts:162,197,339,434`

---

#### Store 39 · `kpiConfigurations`
- **Archivo**: `src/services/db.ts:2194`
- **Condición**: siempre (H6)
- **keyPath**: `id` — valor esperado: `'horizon'` o `'pulse'` (singleton por módulo)
- **Índices**: ninguno
- **Interface**: `any` (generic — tipado en uso como configuración específica de KPI por módulo)
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/kpiService.ts:271`
- **Escrituras**: `services/kpiService.ts:256`

---

### BLOQUE 5 — DOCUMENTOS / INBOX

---

#### Store 40 · `documents`
- **Archivo**: `src/services/db.ts:2076`
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `type`, `entityType` (→ `metadata.entityType`), `entityId` (→ `metadata.entityId`)
- **Interface** (`db.ts:493`): `Document` — id, type, name, mimeType, size, blob/url, metadata (entityType, entityId, taxYear, ...), ocrStatus, ocrResult, extractedData, createdAt, updatedAt (extensa, ~90 campos)
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `components/inbox/InboxV3ExtractedPanel.tsx:177,301,326`, `services/fiscalSummaryService.ts:222`, `services/emailIngestService.ts:449`, `services/declaracionDistributorService.ts:428`
- **Escrituras**: `components/inbox/InboxV3ExtractedPanel.tsx:180,304,329`, `services/emailIngestService.ts:243`, `services/documentIngestionService.ts:241`, `src/services/db.ts:2926,2929` (saveDocumentWithBlob)

---

### BLOQUE 6 — FISCALIDAD

---

#### Store 41 · `ejerciciosFiscales` *(⚠️ LEGACY — siendo sustituido)*
- **Archivo**: `src/services/db.ts:2450`
- **Condición**: siempre (V3.6); else-branch garantiza nuevos índices
- **keyPath**: `ejercicio` (año fiscal como número)
- **Índices** (todos via ensureIndex): `estado`, `año` (alias de `ejercicio`), `ejercicio` (alias), `origen`, `snapshotId`
- **Interface** (`db.ts:1230`): `EjercicioFiscal` — ejercicio, estado, origen, fechaCierre, snapshotId, resultadoEjercicioId, calculoAtlas, declaracionAeat, validacionDeclaracion, cierreAtlasMetadata, casillasRaw, arrastresRecibidos, arrastresGenerados, declaracionInmuebles, resumen, notas, createdAt, updatedAt
- **⚠️ NOTA**: Store LEGACY — el modelo activo es `ejerciciosFiscalesCoord`. `ejercicioResolverService.ts` migra y borra registros de este store hacia `ejerciciosFiscalesCoord`. Sin embargo, `ejercicioLifecycleService.ts` aún escribe aquí — ver BUG-08.
- **Veredicto**: ✅ ACTIVO (legacy, escritura dual — ver BUG-08)
- **Lecturas**: `services/ejercicioResolverService.ts:390,437`, `services/ejercicioLifecycleService.ts:32,73,128,141`, `services/fiscalResolverService.ts:360`
- **Escrituras**: `services/ejercicioLifecycleService.ts:36,89,130,143`, (delete) `services/ejercicioResolverService.ts:394,442`

---

#### Store 42 · `ejerciciosFiscalesCoord` *(store primario fiscal)*
- **Archivo**: `src/services/db.ts:2536`
- **Condición**: siempre (V3.7)
- **keyPath**: `año` (año fiscal como número)
- **Índices**: `estado` (sin options explícitas → `{ unique: false }`)
- **Interface** (`db.ts:1859`):
```typescript
export interface EjercicioFiscalCoord {
  año: number; // keyPath — 2020, 2021, ..., 2026
  estado: 'en_curso' | 'pendiente' | 'declarado' | 'prescrito';
  fechaPrescripcion?: string;
  aeat?: { snapshot: Record<string,number>; resumen: ResumenFiscal; pdfDocumentId?: string; fechaImportacion: string; fuenteImportacion?: 'xml'|'pdf'|'manual'; declaracionCompleta?: DeclaracionCompleta; };
  atlas?: { snapshot: Record<string,number>; resumen: ResumenFiscal; fechaCalculo: string; hashInputs: string; };
  arrastresIn: ArrastresEjercicioCoord;
  arrastresOut?: ArrastresOutEjercicioCoord;
  inmuebleIds: number[];
  createdAt: string;
  updatedAt: string;
}
```
- **Veredicto**: ✅ ACTIVO (store primario del modelo fiscal — uso intensivo)
- **Lecturas**: `services/ejercicioResolverService.ts:52,91,321,328,337,384,423`, `services/treasuryOverviewService.ts:139`, `services/declaracionDistributorService.ts:322,347`, `pages/inmuebles/InmueblesAnalisis.tsx:1205,1287,1291`
- **Escrituras**: `services/ejercicioResolverService.ts:82,323,332,384,429,502`, `services/declaracionDistributorService.ts:329`

---

#### Store 43 · `documentosFiscales`
- **Archivo**: `src/services/db.ts:2471`
- **Condición**: siempre (V3.6)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `ejercicio`, `concepto`, `inmuebleId`, `ejercicio-concepto` (compuesto), `ejercicio-inmuebleId` (compuesto)
- **Interface**: `DocumentoFiscal` — importada de `../types/fiscal`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/migrations/migrateOrphanedInmuebleIds.ts:402`, `services/ejercicioFiscalService.ts:509,515`
- **Escrituras**: `services/ejercicioFiscalService.ts:503,521`, `services/migrations/migrateOrphanedInmuebleIds.ts:411`

---

#### Store 44 · `arrastresManual`
- **Archivo**: `src/services/db.ts:2484`
- **Condición**: siempre (V3.6)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `tipo`, `ejercicioOrigen`
- **Interface**: `ArrastreManual` — importada de `../types/fiscal`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/ejercicioFiscalService.ts:205,478,486`
- **Escrituras**: `services/ejercicioFiscalService.ts:472`

---

#### Store 45 · `resultadosEjercicio`
- **Archivo**: `src/services/db.ts:2494`
- **Condición**: siempre (V2.9)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `ejercicio`, `estadoEjercicio`, `origen`, `ejercicio-estado` (compuesto)
- **Interface** (`db.ts:1297`): `ResultadoEjercicio` — id, ejercicio, origen, estadoEjercicio, baseImponibleGeneral, baseImponibleAhorro, cuotaIntegra, cuotaLiquida, resultado, resumenCasillas, etc.
- **⚠️ NOTA**: La única lectura encontrada (`fiscalHistoryService.ts:119`) ocurre justo antes de un delete. No se encontró ruta de UI que muestre estos datos al usuario.
- **Veredicto**: ✅ ACTIVO (snapshots inmutables — archivados, no visualizados)
- **Lecturas**: `services/fiscalHistoryService.ts:119`
- **Escrituras**: `services/fiscalHistoryService.ts:129` (delete), `services/fiscalLifecycleService.ts` (writes via RESULTADOS_STORE const)

---

#### Store 46 · `arrastresIRPF`
- **Archivo**: `src/services/db.ts:2503`
- **Condición**: siempre (V2.7)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `ejercicioOrigen`, `tipo`, `estado`, `ejercicioCaducidad`, `inmuebleId`, `ejercicioOrigen-tipo` (compuesto)
- **Interface** (`db.ts:1373`): `ArrastreIRPF` — id, ejercicioOrigen, tipo, estado, ejercicioCaducidad, inmuebleId, importePendiente
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/fiscalLifecycleService.ts:172`, `services/compensacionAhorroService.ts:140,376`
- **Escrituras**: `services/compensacionAhorroService.ts:268,278,291,356,382`, (delete) `services/fiscalHistoryService.ts:126`

---

#### Store 47 · `perdidasPatrimonialesAhorro`
- **Archivo**: `src/services/db.ts:2513`
- **Condición**: siempre (V3.4)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `ejercicioOrigen`, `estado`, `ejercicioCaducidad`
- **Interface** (`db.ts:1355`): `PerdidaPatrimonialAhorro` — id, ejercicioOrigen, estado, ejercicioCaducidad, importePendiente, tipo
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/compensacionAhorroService.ts:97,341`
- **Escrituras**: `services/fiscalLifecycleService.ts:204`, `services/compensacionAhorroService.ts:268,278,291,356,382`

---

#### Store 48 · `snapshotsDeclaracion`
- **Archivo**: `src/services/db.ts:2521`
- **Condición**: siempre (V2.7); V2.8 elimina índice único `ejercicio` y lo recrea como no-único
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `ejercicio` (fue único antes V2.8, ahora no único), `origen`, `fechaSnapshot`
- **Interface** (`db.ts:1414`): `SnapshotDeclaracion` — id, ejercicio, origen, fechaSnapshot, casillasAeat, declaracion, calculoAtlas, notes
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/fiscalResolverService.ts:342`, `services/declaracionResolverService.ts:19`
- **Escrituras**: via `snapshotDeclaracionService.ts` (ejercitado por tests)

---

#### Store 49 · `entidadesAtribucion`
- **Archivo**: `src/services/db.ts:2528`
- **Condición**: siempre (V3.4)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `nif`, `tipoRenta`
- **Interface** (`db.ts:1400`): `EntidadAtribucionRentas` — id, nif, tipoEntidad ('CB'|'SC'|'HY'|'otra'), tipoRenta, denominacion, participacion, etc.
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/entidadAtribucionService.ts:20,26,35,54`
- **Escrituras**: `services/entidadAtribucionService.ts:14,42,62`

---

#### Store 50 · `configuracion_fiscal`
- **Archivo**: `src/services/db.ts:2445`
- **Condición**: siempre (V2.6)
- **keyPath**: `id` — singleton con valor `'default'`
- **Índices**: ninguno
- **Interface** (`db.ts:1842`): `ConfiguracionFiscal` — id, pagosAplazados, fraccionarPago, pagosDomiciliados, configuracionPagos, etc.
- **⚠️ NOTA**: Las escrituras vía `db.get`/`db.put` no aparecen en grep por store name porque se accede via `fiscalPaymentsService.ts` que usa el alias `CONFIG_STORE = 'configuracion_fiscal'` (`fiscalPaymentsService.ts:22`). Las funciones `getConfiguracionFiscal` y `saveConfiguracionFiscal` son el API de acceso.
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/fiscalPaymentsService.ts:46` (getConfiguracionFiscal), `services/ejercicioFiscalMigration.ts:411`, `modules/horizon/tesoreria/services/treasurySyncService.ts:1007`, +más via `getConfiguracionFiscal` en otros servicios
- **Escrituras**: `services/fiscalPaymentsService.ts:85` (saveConfiguracionFiscal), `modules/horizon/fiscalidad/pagos/PagosPage.tsx:49,69`

---

### BLOQUE 7 — INVERSIONES / PATRIMONIO

---

#### Store 51 · `inversiones`
- **Archivo**: `src/services/db.ts:2389`
- **Condición**: siempre (V1.3)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `tipo`, `activo`, `entidad`
- **Interface**: `PosicionInversion` — importada de `../types/inversiones`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/inversionesService.ts:52,64,74,129,144,180,206,223`, `services/irpfCalculationService.ts:863`, `services/treasuryOverviewService.ts:174,450`, `services/valoracionesService.ts:70,221,319`
- **Escrituras**: `services/inversionesService.ts:122,137,250`, `services/migrations/migrateInversiones.ts:37`

---

#### Store 52 · `valoraciones_historicas`
- **Archivo**: `src/services/db.ts:2417`
- **Condición**: siempre (V2.1)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `tipo_activo`, `activo_id`, `fecha_valoracion`, `tipo-activo-fecha` → `['tipo_activo','activo_id','fecha_valoracion']`
- **Interface**: Tipo `ValoracionHistorica` en uso pero no definido en db.ts — AtlasHorizonDB schema (`db.ts:2028`) lo tipea como `any`
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/valoracionesService.ts:94,108,120,190,374`, `services/informesDataService.ts:494`, `modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts:862`
- **Escrituras**: `services/valoracionesService.ts:211,213,394,396`, (delete) `services/inversionesService.ts:245`

---

#### Store 53 · `valoraciones_mensuales`
- **Archivo**: `src/services/db.ts:2426`
- **Condición**: siempre (V2.1)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `fecha_cierre` `{ unique: true }`
- **Interface**: Tipo `ValoracionesMensuales` en uso — no definido en db.ts
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/valoracionesService.ts:257,286,293`
- **Escrituras**: `services/valoracionesService.ts:274,276`

---

#### Store 54 · `patrimonioSnapshots`
- **Archivo**: `src/services/db.ts:2397`
- **Condición**: siempre (Dashboard refactor)
- **keyPath**: `id` · autoIncrement: true
- **Índices**: `fecha` `{ unique: true }` (YYYY-MM), `createdAt`
- **Interface** (`db.ts:1789`): `PatrimonioSnapshot` — id, fecha (YYYY-MM), total, desglose (inmuebles, inversiones, cuentas, deuda), createdAt
- **⚠️ NOTA**: `fecha` con `unique: true` → solo 1 snapshot por mes. Posible ConstraintError si dos tabs actualizan simultáneamente.
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/dashboardService.ts:625,695`
- **Escrituras**: `services/dashboardService.ts:699`

---

#### Store 55 · `objetivos_financieros`
- **Archivo**: `src/services/db.ts:2071`
- **Condición**: `if (oldVersion < 32 && !db.objectStoreNames.contains(...))`
- **keyPath**: `id` — singleton con id=1
- **Índices**: ninguno
- **Interface** (inline en `AtlasHorizonDB` schema, `db.ts:2013-2023`): id, rentaPasivaObjetivo, patrimonioNetoObjetivo, cajaMinima, dtiMaximo, ltvMaximo, yieldMinimaCartera, tasaAhorroMinima, updatedAt
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `services/objetivosService.ts:30`, `modules/horizon/informes/generators/generateLibertad.ts:38`
- **Escrituras**: `services/objetivosService.ts:49,56`

---

### BLOQUE 8 — CONFIGURACIÓN / MISC

---

#### Store 56 · `keyval`
- **Archivo**: `src/services/db.ts:2404`
- **keyPath**: ninguno (out-of-line keys — `db.createObjectStore('keyval')`)
- **Índices**: ninguno
- **Interface**: `any` — clave-valor genérico. Usos conocidos:
  - `planpagos_{id}` → objetos `PlanPagos` (plan de cuotas de préstamo)
  - flags de migración (`migrateOrphanedInmuebleIds`)
  - caches de datos calculados
- **Veredicto**: ✅ ACTIVO
- **Lecturas**: `pages/inmuebles/InmueblesAnalisis.tsx:1203,1232`, `services/historicalCashflowCalculator.ts:66`, `services/prestamosService.ts:507`, `services/propertySaleService.ts:390,626,891`
- **Escrituras**: `services/migrations/migrateOrphanedInmuebleIds.ts:90,144`, `services/prestamosService.ts:631`, `services/loanSettlementService.ts:611,636`

---

### STORES ELIMINADOS (referencia)

Los siguientes stores fueron eliminados en migraciones de la DB:

**V4.2 cleanup** (`src/services/db.ts:2171–2188`):
- `fiscalSummaries` — reemplazado por `gastosInmueble` / `ejerciciosFiscalesCoord`
- `operacionesFiscales` — reemplazado por `gastosInmueble`
- `gastos` — reemplazado por `gastosInmueble`
- `propertyImprovements` — reemplazado por `mejorasInmueble`
- `mejorasActivo` — reemplazado por `mejorasInmueble`
- `mobiliarioActivo` — reemplazado por `mueblesInmueble`
- `expensesH5` — legacy
- `reforms` — legacy
- `reformLineItems` — legacy
- `capex` — legacy
- `gastosRecurrentes` — reemplazado por `opexRules`/`compromisosRecurrentes`
- `gastosPuntuales` — legacy

**V4.4 cleanup** (`src/services/db.ts:2583–2601`): `capex`, `gastosRecurrentes`, `gastosPuntuales`, `expenses`, `mejorasActivo`, `mobiliarioActivo`, `personalExpenses` (→`patronGastosPersonales`), `movimientosPersonales`, `ingresos`, `budgetLines`, `budgets`

**V4.5 cleanup** (`src/services/db.ts:2606–2611`): `rentCalendar`, `rentPayments` (→ `rentaMensual`)

**V4.7 cleanup** (`src/services/db.ts:2295–2297`): `importLogs` (huérfano)

---

## 3. DIFF CONTRA 9 ABRIL

> **⚠️ ADVERTENCIA**: El archivo `ATLAS-mapa-54-stores.md` **no existe en el repositorio** (ni en el historial git disponible — el clone es shallow con solo 2 commits). El diff se ha reconstruido a partir de los comentarios de versión en `src/services/db.ts` y la información del briefing de auditoría.

### Stores NUEVOS desde 9 abril (V5.3 — DB_VERSION 53)

| Store | Introducido | Evidencia |
|---|---|---|
| `compromisosRecurrentes` | V5.3 | `db.ts:2631` — `DB_VERSION = 53`; comentario en línea 29 |
| `viviendaHabitual` | V5.3 | `db.ts:2646` — `DB_VERSION = 53`; comentario en línea 29 |

### Stores EXISTENTES con schema cambiado desde 9 abril

| Store | Cambios identificados | Evidencia |
|---|---|---|
| `gastosInmueble` | Nuevos campos: `estadoTesoreria`, `treasuryEventId`, `facturaId`, `facturaNoAplica`, `justificanteId`, `justificanteNoAplica`, `categoryKey`, `subtypeKey`, `importeBruto`; nuevos índices: `movimientoId`, `treasuryEventId` | `db.ts:345-358` — comentarios PR3, PR5-HOTFIX |
| `mejorasInmueble` | Nuevos campos: `estadoTesoreria`, `treasuryEventId`, `facturaId/NoAplica`, `justificanteId/NoAplica`, `categoryKey`; nuevos índices: `movimientoId`, `treasuryEventId` | `db.ts:374-386` |
| `mueblesInmueble` | Mismos campos adicionales que `mejorasInmueble` | `db.ts:406-416` |
| `treasuryEvents` | Nuevos campos PR3: `ambito`, `categoryKey`, `subtypeKey`, `transferMetadata`, `providerName`, `providerNif`, `invoiceNumber`, `executedMovementId`, `executedAt`, `facturaId`, `facturaNoAplica`, `justificanteId`, `justificanteNoAplica`; nuevos índices: `ambito`, `inmuebleId` | `db.ts:1128-1158` |
| `planesPensionInversion` | `traspasosPlanes` era parte de este schema en V4 — separado en V5.2 | `db.ts:2372` |

### Stores ELIMINADOS desde 9 abril

Ninguno nuevo después de V4.4/V4.5 (las eliminaciones son de versiones anteriores a 9 abril 2026).

### Stores SIN CAMBIOS (presentes en 9 abril y sin modificaciones)

Todo el resto de stores que no aparecen en las secciones anteriores. Los 54 stores que existían a 9 abril siguen existiendo (neto: 54 + 2 nuevos = 56).

---

## 4. ESTADO DE BUGS Y GAPS

### [BUG-07] `rentaMensual` proyección renta presente/futuro

```
Estado: ABIERTO
```
- **Análisis**: El store `rentaMensual` almacena el historial de cobros por período (YYYY-MM) vinculados a contratos. El motor de proyección mensual (`proyeccionMensualService.ts`) usa `presupuestoLineas` y `treasuryEvents`, **no** `rentaMensual`.
- **Evidencia**: Grep de `proyeccion.*renta` y `renta.*proyeccion` → cero hits. `services/estimacionFiscalEnCursoService.ts:74` lee `rentaMensual` solo para calcular rendimiento fiscal del año en curso, no para proyectar futuro.
- **Ruta del bug**: `modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts` no importa `rentaMensual`; usa `contractService` para obtener `contract.rentaMensual` (campo escalar del contrato, no el store).
- **Archivo + línea**: `src/services/contractService.ts:372` usa `contract.rentaMensual` (campo del contrato, no el store `rentaMensual`). El store `rentaMensual` no alimenta la proyección.

---

### [BUG-08] `ejerciciosFiscales` lifecycle vs `ejerciciosFiscalesCoord`

```
Estado: ABIERTO
```
- **Análisis**: Dos write paths coexisten para el modelo fiscal:
  1. `services/ejercicioLifecycleService.ts:36,89,130,143` escribe a `ejerciciosFiscales` (LEGACY V3.6)
  2. `services/ejercicioResolverService.ts:82,323,332` escribe a `ejerciciosFiscalesCoord` (NUEVO V3.7)
- **Migración**: `ejercicioResolverService.ts:syncAndCleanupLegacyStore()` migra y borra de `ejerciciosFiscales` → `ejerciciosFiscalesCoord`, pero solo cuando se llama explícitamente.
- **Función `ejecutarOnboardingFiscal`**: **NO EXISTE** en el codebase. La función mencionada en el briefing de 9 abril no fue encontrada.
- **Archivo + línea del problema**: `src/services/ejercicioLifecycleService.ts:36` — `db.put('ejerciciosFiscales', ...)` sigue activo

---

### [GAP-D1] `ejecutarOnboardingPersonal` pasa `{} as any`

```
Estado: CERRADO (parcialmente)
```
- **Análisis**: La función `ejecutarOnboardingPersonal` **existe** en `services/personalOnboardingService.ts:179` y está correctamente tipada.
- **Evidencia**: `services/declaracionDistributorService.ts:283` y `services/declaracionOnboardingService.ts:743` la llaman con tipos correctos.
- **Excepción**: `services/__tests__/declaracionOnboardingService.test.ts:197` usa `as any` en mock de prueba — esto es aceptable en tests.
- **Veredicto**: El GAP original (pasa `{} as any` en producción) está **CERRADO**. Solo existe el `as any` en test mocks.

---

### [GAP-D2] Préstamos detectados → `prestamos` solo esqueleto

```
Estado: ABIERTO
```
- **Análisis**: No existe parser XML para datos de préstamos/hipotecas desde declaraciones AEAT. Búsqueda de `parsePrestamo`, `loanParser`, `parseXML.*presta`, `parseHipoteca` → **cero resultados**.
- **Evidencia**: El store `prestamos` se popula solo por:
  - `prestamosService.ts:createPrestamo()` — entrada manual
  - `pages/account/migracion/ImportarPrestamos.tsx` — migración manual CSV
- **`irpfXmlParserService.ts`**: No contiene lógica de extracción de préstamos/hipotecas.
- **Archivo + línea**: `src/services/irpfXmlParserService.ts` — ausencia de función `parsePrestamos` verificada

---

### [GAP-D6] Cuota líquida estatal/autonómica siempre 0

```
Estado: ABIERTO (bug confirmado)
```
- **Análisis**: Existe conflicto entre el motor IRPF y la capa Redux/UI:
  1. **Motor correcto**: `services/irpfCalculationService.ts:1276` — `const cuotaLiquida = round2(Math.max(0, cuotaIntegra - deduccionesDobleImposicion))` ✓
  2. **UI bugueada**: `store/taxSlice.ts:326` — `state.cuotaLiquida = state.cuotaIntegra; // sin deducciones adicionales por ahora` ← **BUG**
- **División Estado/Autonómica**: `ResumenFiscal` (`db.ts:1906-1907`) declara `cuotaLiquidaEstatal` y `cuotaLiquidaAutonomica`, pero el `taxSlice.ts` solo almacena el valor agregado sin split.
- **Archivo + línea**: `src/store/taxSlice.ts:326`

---

### [GAP-P1] `otrasTransmisiones: []` hardcoded

```
Estado: ABIERTO (confirmado como GAP de parseo)
```
- **Análisis**: El tipo `DeclaracionCompleta` (`types/declaracionCompleta.ts:267`) declara `otrasTransmisiones: OperacionTransmision[]`. El parser XML nunca popula este campo.
- **Evidencia**: `src/services/irpfXmlParserService.ts:667` — `otrasTransmisiones: []` — always initialized as empty array, never filled.
- **Alcance**: Ventas de acciones, fondos, crypto, y otros activos no inmobiliarios no se parsean desde XML AEAT.
- **Archivo + línea**: `src/services/irpfXmlParserService.ts:667`

---

### [GAP-P2] Entidades atribución (CB) → no existe función de extracción

```
Estado: CERRADO (servicio funcional implementado)
```
- **Análisis**: El servicio completo existe: `services/entidadAtribucionService.ts` con CRUD + `getByNif`. La integración con IRPF está en `services/irpfCalculationService.ts:10` via `getRendimientosAtribuidosEjercicio`.
- **Tipos**: `tipoEntidad: 'CB' | 'SC' | 'HY' | 'otra'` — CB (Comunidad de Bienes) es un valor válido soportado.
- **Tests**: `services/__tests__/entidadAtribucionService.test.ts` y `services/__tests__/irpfCalculationService.entidadesAtribucion.test.ts` confirman cobertura.
- **⚠️ Ambigüedad residual**: Solo `capital_inmobiliario` está testeado en tests de integración con IRPF. Los tipos `actividad_economica` y `capital_mobiliario` tienen cobertura de integración unknown.

---

### [GAP-P3] Capital mobiliario → bug guardia nodo

```
Estado: MUTADO
```
- **Análisis**: El patrón `guardaNodo`/`guardiaNodo` **no existe** en el codebase (cero resultados en grep).
- **Estado real**: El acceso a `capitalMobiliario` en `store/taxSlice.ts:284-285` usa la función helper `n()` (coerce-to-number) que convierte undefined a 0 — guard implícito, no explícito.
- **Nuevo issue**: `taxHydrationMapper.ts:125` — `const rcm = declaracion.baseAhorro.capitalMobiliario` — no tiene null guard explícito. Si `baseAhorro` es undefined, falla silenciosamente.
- **Archivo + línea**: `src/components/tax/taxHydrationMapper.ts:125`

---

### [GAP-P6] Pérdidas base general, arrastres → solo extrae tipo 'ahorro'

```
Estado: ABIERTO (type mismatch confirmado)
```
- **Análisis**: Existen tres sistemas de tipos incompatibles para arrastres/pérdidas:
  1. `types/fiscal.ts:278` — `tipo: 'gastos_0105_0106' | 'perdidas_ahorro' | 'perdidas_general'` (legacy)
  2. `db.ts:1938` (`ArrastrePerdida`) — `tipo: 'ahorro_general' | 'ahorro_renta_variable' | 'patrimonial'` (coord)
  3. `db.ts:1347` (`TipoArrastre`) — `'perdidas_patrimoniales_general' | 'perdidas_patrimoniales_ahorro' | ...` (3er sistema)
- **Bug activo**: `services/declaracionDistributorService.ts:394` — `tipo: p.tipo === 'ahorro' ? 'ahorro_general' : 'patrimonial'` — cast en frontera de sistemas que puede silenciar pérdidas de base general.
- **Archivo + línea**: `src/services/declaracionDistributorService.ts:394`

---

## 5. ESTADO DE REFACTORS RECIENTES

### 5.1 Refactor `gastosInmueble` fases A-F

**Estado: ✅ COMPLETADO**

- Los 4 stores fragmentados (`fiscalSummaries`, `operacionesFiscales`, `gastos`, `propertyImprovements`) fueron **eliminados** en la migración V4.2 (`db.ts:2171-2188`).
- `gastosInmueble` es el único store de source of truth para gastos de inmueble.
- `FiscalSummary` interface (`db.ts:1490`) persiste solo como tipo en-memoria — no como store persistido.
- **Deuda residual**: `fiscalSummaryService.test.ts:85,89` contiene mocks que referencian `'fiscalSummaries'` — retorna arrays vacíos, no causa bugs pero es código muerto.
- **Evidencia**: `services/declaracionDistributorService.ts:1331` — comentario: *"Write only to gastosInmueble — fiscalSummaries store no longer used"*

---

### 5.2 Unificación `opexRules + compromisosRecurrentes` (G-01)

**Estado: ⚠️ PARCIAL — DUAL-WRITE ACTIVO**

- **Migración V5.3 existe** (`db.ts:2655-2753`): copia registros existentes de `opexRules` → `compromisosRecurrentes` con `ambito='inmueble'` al hacer upgrade.
- **PROBLEMA**: `opexRules` **NO se elimina** post-migración. Sigue siendo escrito por `opexService.ts:35`.
- **Consumidores que leen de `opexRules` (sin migrar)**:
  - `services/propertyExpenses.ts:116` — `db.getAllFromIndex('opexRules', 'propertyId')`
  - `services/operacionFiscalService.ts:177` — `db.getAllFromIndex('opexRules', 'propertyId')`
  - `pages/inmuebles/InmueblesAnalisis.tsx:1201` — `getCachedStoreRecords('opexRules')`
- **Consecuencia**: Nuevos compromisos inmueble creados post-upgrade V5.3 van SOLO a `opexRules`, no a `compromisosRecurrentes`. El store `compromisosRecurrentes` queda incompleto para el ámbito `inmueble`.
- **Archivos afectados**: `src/services/opexService.ts`, `src/services/propertyExpenses.ts`, `src/services/operacionFiscalService.ts`, `src/pages/inmuebles/InmueblesAnalisis.tsx`

---

### 5.3 Tesorería restructure

**Estado: ✅ COMPLETADO (con referencia histórica en tipo)**

- `historicalTreasuryService.ts` **no existe** en el codebase (verificado por grep de paths).
- La referencia `'historicalTreasuryService'` en `TreasuryEvent.generadoPor` (`db.ts:1111`) es un valor de enum histórico para eventos generados antes del renombrado — es data tag, no servicio activo.
- Architecture V4 activa: `TesoreriaV4.tsx`, `TreasuryReconciliationView.tsx`, `treasurySyncService.ts`.
- `movements` está activo y bien integrado — la "deprecación" del briefing original no se completó: `movements` sigue siendo el store de movimientos bancarios importados.
- `treasuryEvents` es el store de eventos de tesorería (presente y futuro) — activo e intensamente usado.

---

### 5.4 Investment form field fixes (`inversiones`)

**Estado: ✅ ACTIVO (migración aplicada)**

- `services/migrations/migrateInversiones.ts` existe y aplica corrección de campos (`db.ts` no muestra qué campos cambiaron específicamente — la migración está en el servicio de migración).
- Store `inversiones` con `PosicionInversion` (importada de `types/inversiones`) está bien integrado.
- Companion store `valoraciones_historicas` funcional para historial de valoración.
- `components/personal/planes/TraspasoForm.tsx:75` lee `inversiones` para selector de destino en traspasos.
- `services/irpfCalculationService.ts:863` usa `inversiones` para cálculo de ganancias/pérdidas de capital.

---

## 6. STORES HUÉRFANOS / INERTES / MUERTOS

### ⚠️ INERTE · `reconciliationAuditLogs`
- **Descripción**: Log de auditoría de conciliaciones. Append-only sin consumidor de lectura en producción.
- **Impacto**: Los datos de auditoría existen en la DB del usuario pero son inaccesibles desde la UI. Solo visible via exportación manual de la DB.
- **Candidato a**: Añadir vista de auditoría en UI, o redirigir a console log si no se usará.

### ⚠️ ACTIVO/DEPRECATED · `opexRules`
- **Descripción**: Store de reglas de gastos recurrentes de inmuebles, oficialmente reemplazado por `compromisosRecurrentes` en V5.3 pero aún activo con escritura dual.
- **Riesgo**: Datos divergentes — nuevos registros post-V5.3 solo en `opexRules`, datos migrados en `compromisosRecurrentes`.
- **Candidato a**: Completar refactor G-01 — redirigir `opexService.ts` a `compromisosRecurrentes` y limpiar consumidores.

### ⚠️ SIN UI DE VISUALIZACIÓN · `resultadosEjercicio`
- **Descripción**: Snapshots canónicos de resultados de ejercicios fiscales. Solo se leen justo antes de eliminarlos en `fiscalHistoryService.ts:119`. No hay ruta de UI que muestre estos snapshots al usuario.
- **Candidato a**: Añadir historial fiscal en UI, o documentar que son internamente gestionados.

---

## 7. CONCLUSIONES

### Qué bloquea el reset de layout (Fase 4)

1. **GAP-D6 (BUG ABIERTO)** — `taxSlice.ts:326` hardcodea `cuotaLiquida = cuotaIntegra`. Cualquier mockup que muestre cuota líquida estatal/autonómica mostrará valores incorrectos.

2. **BUG-07 (ABIERTO)** — El motor de proyección no consume `rentaMensual`. Los mockups que proyecten rentas a futuro no tienen datos correctos del store.

3. **DUAL-WRITE opexRules/compromisosRecurrentes** — Mockups que lean gastos recurrentes de inmuebles pueden obtener datos incompletos si leen solo de `compromisosRecurrentes`.

4. **GAP-D2 (ABIERTO)** — Préstamos/hipotecas deben entrar manualmente. No hay parseo XML automático.

5. **`importSnapshot` solo restaura 3 stores** de 56 — si hay pérdida de datos, 53 stores no tienen ruta de restore.

### Qué se puede hacer ya (sin reset)

1. **Stores nuevos V5.3** (`compromisosRecurrentes`, `viviendaHabitual`) están completamente implementados y pueden usarse en mockups sin cambios.

2. **`ejerciciosFiscalesCoord`** es el store primario fiscal correcto y está bien implementado — los mockups fiscales deben leer de aquí, no de `ejerciciosFiscales`.

3. **53 de 56 stores son ACTIVO** — el modelo de datos cubre la mayoría de los casos de uso de Mi Plan v3.

4. **Bloque inversiones** (`inversiones` + `valoraciones_historicas` + `patrimonioSnapshots`) está maduro y preparado para los mockups de cartera.

5. **Bloque tesorería** (`treasuryEvents` + `accounts` + `movements`) está estable — V4 activo y funcional.

---

## 8. HALLAZGOS ADICIONALES

### HALLAZGO A — `FiscalSummary` usada como tipo en-memoria (no store)
`FiscalSummary` interface (`db.ts:1490`) y el string `'fiscalSummaries'` aparecen en servicios como tipo de objeto in-memory computado desde `gastosInmueble`/`mejorasInmueble`. No es un store persistido pero los tests legacy siguen mockeando `'fiscalSummaries'` como si lo fuera (`fiscalSummaryService.test.ts:85,89`).

### HALLAZGO B — `importSnapshot` solo restaura 3 stores
`src/services/db.ts:3051` — La función `importSnapshot` importa solo `properties`, `documents`, `contracts`. Los otros 53 stores (incluyendo todos los de tesorería, fiscalidad, personal, inversiones) no tienen ruta de backup/restore integrada en la app.

### HALLAZGO C — `ejerciciosFiscalesCoord.estado` sin options explícitas
`db.ts:2538` — `store.createIndex('estado', 'estado')` sin tercer parámetro. La ausencia de `{ unique: false }` explícito es ambigua pero IDB default es `{ unique: false, multiEntry: false }`. No es un bug funcional pero es inconsistente con el resto de índices.

### HALLAZGO D — `patrimonioSnapshots` con unique constraint por mes
`db.ts:2400` — `fecha` con `{ unique: true }`. Actualización concurrente desde dos tabs del mismo mes producirá `ConstraintError`. `dashboardService.ts:699` tiene manejo de este caso pero no es obvio para futuras implementaciones.

### HALLAZGO E — Versión V5.3 es DB_VERSION=53 (no V5.3)
El comentario de la constante es `// V5.3 (ATLAS Personal v1.1)...` pero el número de versión es `53`. Esto sugiere que el esquema de versiones usa enteros secuenciales (53 = versión 53ª de la DB), no semver. El comentario es una etiqueta informal, no el número de versión literal.

### HALLAZGO F — Función `migrarPlanesDuplicados` interna en db.ts
`db.ts:2783-2847` — Función `migrarPlanesDuplicados` definida dentro del archivo db.ts (no exportada) que detecta y fusiona planes de pensión duplicados. Ejecutada durante la inicialización de la DB. No tiene tests directos.

### HALLAZGO G — Tienda `keyval` sin tipo formal
El store `keyval` es un catch-all sin schema TypeScript. Cualquier consumidor puede escribir cualquier cosa bajo cualquier clave. Los usos conocidos (`planpagos_*`, flags de migración) no están documentados en ningún contrato de tipos.

### HALLAZGO H — Acceso a datos reales del usuario (Tarea 4.6)
**NO VIABLE** sin acceso a la DB real de Jose. No existe seed data ni DB local accesible en el entorno de auditoría. La inspección de registros reales requiere una segunda tarea (`Snapshot de datos reales`) con acceso al entorno de producción del usuario. **Todos los stores se reportan como `Cantidad de registros: unknown`** sin sample disponible.

---

*Documento generado el 25 abril 2026 · Auditoría pre-reset v3 · Rama `copilot/auditstores-25abril`*
*Fuente primaria: `src/services/db.ts` (3256 líneas) · DB_VERSION = 53 · DB_NAME = 'AtlasHorizonDB'*
