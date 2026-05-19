# AUDIT_VALORACIONES_USAGES

**PR0 · TAREA-CC-T-VALORACIONES · v1**
**Fecha** · 2026-05-19
**HEAD auditado** · `624f190` (branch `claude/polymorphic-valuations-store-wVfsr`)
**Generado a partir de** ·
- `docs/AUDIT_VALORACIONES_FIELDS.txt` (raw grep · 690 líneas)
- `docs/AUDIT_STORES_LIST.txt` (raw grep de `createObjectStore` · 51 líneas)
- `docs/AUDIT_IMPORT_SERVICE.txt` (raw grep import service · 8 líneas)
- `docs/AUDIT_CHART_LIB.txt` (raw grep package.json · 2 líneas)

---

## 1 · Stores de activo en `db.ts` actuales

Auditados con `grep -RIn "createObjectStore" src/services/db.ts` (DB_VERSION actual = **73**, no v71 como suponía la spec).

### 1.1 · Stores que SÍ contienen "activos valorables temporalmente"

| Store | Línea db.ts | keyPath | autoIncr | Campos de valoración detectados | # estimado por tipo de activo |
|---|---:|---|---|---|---|
| `properties` (inmuebles) | 2519 | `id` | ✅ | `valorActual`, `valorActualActivo` (en type), `valorCatastral` (fiscal), `precioCompra` (fiscal), `tasacion` (sólo en helpers fiscales) | inmuebles activos del usuario |
| `inversiones` | 2833 | `id` | ✅ | `valorActual`, `cotizacion`, `precioUnitario`, `valor_actual` (snake en algunos paths) | TODO tipo: fondos + acciones + ETF + crypto lumped |
| `planesPensiones` | 2807 (V65) y 3986 (V72 re-create) | `id` | ❌ | `valorActual` (en type · `planesPensiones.ts:53`) | planes pensiones |
| `planesPensionInversion` (legacy) | 2784 | `id` | ✅ | `valorActual` (legacy pre-V65) | sólo en DBs `0 < oldVersion < 65` |
| `valoraciones_historicas` (**polimórfico, ya existente**) | 2856 | `id` | ✅ | campo nativo: `valor` + `tipo_activo` + `activo_id` + `fecha_valoracion` (YYYY-MM) + `origen` + `activo_nombre` + `created_at` + `updated_at` | hoy: 3 tipos lumped |

### 1.2 · Stores que NO son "activos valorables" pero aparecieron en el grep

| Store | Línea | Razón de aparición | Disposición |
|---|---:|---|---|
| `accounts` (cuentas) | 2655 | `saldoActual`, `saldoFinal` (37+19 hits) | **NO migrar** · cash de tesorería · saldo derivado de `movements` |
| `movements` (movimientos) | 2663 | — | NO toca |
| `treasuryEvents` | 2681 | — | NO toca |
| `fondos_ahorro` (ahorro por metas) | 3394 | `valorActual` (mi-plan wizards) | **NO migrar** · es un sub-objetivo de ahorro (mi-plan), no un activo invertible · convive como meta |
| `objetivos` | 3379 | `valorActual` (mi-plan) | NO migrar (idem) |
| `objetivos_financieros` | 2535 | — | NO toca |
| `viviendaHabitual` | 3075 | `valorCatastral`, `valorCatastralConstruccion` | NO migrar · fiscal |
| `personalData` | 2756 | `valorCompra`, `valorActual` (`src/types/personal.ts:480-481`) | Revisar · ¿bien muebles personales? Si entran al refactor entran como `tipoActivo: 'otro'`. **Recomendación** · fuera de scope V1 |
| `gastosInmueble`, `mejorasInmueble`, `mueblesInmueble` | 2581, 2600, 2614 | — | NO toca |
| `contracts`, `documents`, `proveedores` | 2548, 2540, 2574 | — | NO toca |
| `prestamos` | 2848 | — | NO toca · es pasivo, no activo |
| `resultadosEjercicio`, `arrastresIRPF`, `perdidasPatrimonialesAhorro`, `snapshotsDeclaracion`, `entidadesAtribucion`, `ejerciciosFiscalesCoord`, `vinculosAccesorio`, `deudasFiscales`, `benchmarksReferencia` | 2882-2958 | — | NO toca · stores fiscales |
| `avisosUsuario`, `objetivosVitales`, `compromisosRecurrentes`, `presupuestos`, `presupuestoLineas`, `personalModuleConfig`, `ingresos`, `movementLearningRules`, `propertyDays`, `property_sales`, `aeatCarryForwards`, `traspasosPlanes`, `aportacionesPlan`, `traspasosPlanPensiones`, `importBatches`, `escenarios`, `retos`, `keyval` | varios | — | NO toca |

**Total stores en db.ts** · 44 declarados en bandera DB_VERSION = 73.

### 1.3 · Stores nuevos previstos por la spec que **no existen** hoy

- `depositos` · NO existe. Si se requiere modelar depósitos a plazo como tipo de activo independiente, hay que crear el store en un PR aparte (fuera de scope T-VALORACIONES).
- `fondosInversion` · NO existe como store separado. Los fondos viven dentro de `inversiones`.
- `accionesEtfs` · NO existe como store separado. Acciones/ETFs viven dentro de `inversiones`.
- `crypto` · NO existe como store separado.

---

## 2 · Casos null / 0 / undefined detectados en lectura de valor

Patrón común encontrado en el repo · **fallback en cascada cuando el campo legacy es undefined**:

```typescript
// src/services/valoracionesService.ts:162
ultima_valoracion: ultima?.valor ?? plan.valorActual,

// src/services/valoracionesService.ts:177
ultima_valoracion: ultima?.valor ?? plan.valorActual ?? 0,

// src/modules/horizon/inversiones/components/utils.ts (patrón general)
const valor = activo.valorActual ?? activo.valor ?? 0;
```

Esto confirma el problema del spec: hay activos sin valoración en `valoraciones_historicas` y los lectores caen al campo legacy del store de activo. **Cualquier seed de migración debe garantizar 1+ valoración por activo activo**, si no, los lectores quedan sin fallback tras PR7.

---

## 3 · Servicios de cálculo derivado encontrados

Servicios identificados que consumen `valorActual` / `valor` / etc para producir métricas:

| Servicio | Path | Métrica derivada | Lee de |
|---|---|---|---|
| `rentabilidadPlanService` | `src/services/rentabilidadPlanService.ts` | TWR plan pensiones | `valoraciones_historicas` + `aportacionesPlan` |
| `rentabilidadInmuebleService` | `src/services/rentabilidadInmuebleService.ts` | rentabilidad inmueble | `tasacion`, `precioCompra` (fiscal) |
| `proyeccionMensualService` | `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts` | proyección + index valoraciones | `valoraciones_historicas` (via `valoracionesService.getAllValoraciones`) |
| `informesDataService` | `src/services/informesDataService.ts` | informes Cartera/Patrimonio | `valoraciones_historicas` + stores |
| `historicalCashflowCalculator` | `src/services/historicalCashflowCalculator.ts` | cashflow histórico | tesoreria · NO toca |
| `historicalTreasuryService` | `src/services/historicalTreasuryService.ts` | tesorería histórica | tesoreria · NO toca |
| `treasuryOverviewService` | `src/services/treasuryOverviewService.ts` | tesoreria | NO toca |
| `simuladorFiscalService` | `src/services/simuladorFiscalService.ts` | simulación fiscal | `precioCompra`, `valorCatastral` (fiscal) |
| `propertyDisposalTaxService` | `src/services/propertyDisposalTaxService.ts` | impuesto venta | `tasacion`, `precioCompra` (fiscal) |
| `proyeccionActivoService` | `src/services/proyeccionActivoService.ts` | proyección por activo | `valorActual` |
| `fiscalSummaryService` | `src/services/fiscalSummaryService.ts` | fiscal | `valorCatastral` |
| `irpfCalculationService` | `src/services/irpfCalculationService.ts` | IRPF | fiscal |
| `traspasosPlanPensionesService` | `src/services/traspasosPlanPensionesService.ts` | traspasos PP | `valorActual` plan |
| `planesPensionesService` | `src/services/planesPensionesService.ts` | CRUD PP | `valorActual` |
| `planesInversionService` | `src/services/planesInversionService.ts` | CRUD PP legacy V65 | `valorActual` |
| `inversionesService` | `src/services/inversionesService.ts` | CRUD inversiones | `valorActual`, `cotizacion` |

> **Nota** · los servicios fiscales (irpf, simuladorFiscal, propertyDisposal, fiscalSummary) leen campos de adquisición fiscal (`precioCompra`, `valorCatastral`) **que NO se migran** según decisión §3 del `AUDIT_VALORACIONES_FIELDS.md`. Quedan intactos.

---

## 4 · Componentes UI que muestran "valor actual"

### 4.1 · Inversiones

- `src/modules/horizon/inversiones/InversionesPage.tsx` · listado
- `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` · modal actualizar valor (single-point write)
- `src/modules/horizon/inversiones/components/AportacionForm.tsx` · aportación
- `src/modules/horizon/inversiones/components/utils.ts` · helpers
- `src/modules/inversiones/InversionesPage.tsx` (mockup nuevo)
- `src/modules/inversiones/components/CartaPosicion.tsx` · tarjeta
- `src/modules/inversiones/components/FichaValoracionSimple.tsx` · ficha
- `src/modules/inversiones/components/FichaGenerica.tsx` · ficha
- `src/modules/inversiones/components/FichaDividendos.tsx` · ficha
- `src/modules/inversiones/components/bloques/BloqueProyeccion.tsx`
- `src/modules/inversiones/components/bloques/BloqueSandbox.tsx`
- `src/modules/inversiones/components/modal/AltaFondoModal.tsx`
- `src/modules/inversiones/components/modal/AltaPlanWizard.tsx`
- `src/modules/inversiones/components/modal/TraspasoModal.tsx`
- `src/modules/inversiones/pages/FichaPlanPensiones.tsx` · **ficha PP detalle** (incluye gráfica de evolución actualmente "línea recta de 2 puntos" según spec)
- `src/modules/inversiones/import/ImportarIndexaCapitalPage.tsx` · wizard import Indexa
- `src/pages/account/migracion/ImportarIndexaCapital.tsx`

### 4.2 · Inmuebles

- `src/pages/inmuebles/InmueblesAnalisis.tsx`
- `src/pages/inmuebles/InmueblePage.tsx`
- `src/modules/inmuebles/pages/DetallePage.tsx`
- `src/modules/inmuebles/pages/ListadoPage.tsx`
- `src/modules/inmuebles/import/ImportarValoraciones.tsx` · wizard import polimórfico (acepta 3 tipos)
- `src/modules/inmuebles/import/ImportarInmuebles.tsx`

### 4.3 · Fiscalidad (consume `precioCompra`, `valorCatastral` · NO migra)

- `src/components/tax/TaxView.tsx`
- `src/components/tax/blocks/RealEstateBlock.tsx`
- `src/components/tax/blocks/PatrimGainsBlock.tsx`
- `src/components/tax/blocks/SavingsGPBlock.tsx`
- `src/components/tax/blocks/WorkIncomeBlock.tsx`
- `src/components/tax/blocks/ResultBlock.tsx`
- `src/components/tax/taxHydrationMapper.ts`
- `src/modules/fiscal/v2/FiscalVentaPage.tsx`
- `src/modules/fiscal/v2/VentaKpiStrip.tsx`
- `src/modules/fiscal/v2/helpers/inmuebleCasillasService.ts`
- `src/modules/fiscal/v2/helpers/ejercicioCasillasService.ts`
- `src/modules/fiscal/v2/helpers/ventaCalculoService.ts`
- `src/modules/horizon/fiscalidad/declaracion/DeclaracionPage.tsx`
- `src/modules/horizon/fiscalidad/declaracion/DeclaracionCompletaPage.tsx`
- `src/modules/horizon/fiscalidad/mi-irpf/MiIRPFPage.tsx`
- `src/modules/horizon/fiscalidad/historial/ImportarDatosFiscalesWizard.tsx`
- `src/modules/horizon/fiscalidad/historico/ImportarDeclaracionWizard.tsx`

### 4.4 · Tesorería (saldo · NO migra)

- `src/components/treasury/CalendarioMes12.tsx`
- `src/components/treasury/CalendarioRolling24m.tsx`
- `src/components/treasury/TreasuryReconciliationView.tsx`
- `src/modules/tesoreria/TesoreriaPage.tsx`
- `src/modules/tesoreria/pages/VistaCuentaPage.tsx`
- `src/modules/horizon/tesoreria/HistoricoWizard.tsx`
- `src/modules/horizon/tesoreria/services/treasurySyncService.ts`

### 4.5 · Dashboard / Panel / Mi-plan

- `src/modules/panel/PanelPage.tsx`
- `src/modules/panel/components/PulsoDelMes.tsx`
- `src/modules/mi-plan/wizards/WizardNuevoFondo.tsx` (fondos_ahorro · meta · NO migra)
- `src/modules/mi-plan/wizards/WizardNuevoObjetivo.tsx`
- `src/modules/mi-plan/wizards/utils/calcularRitmo.ts`

### 4.6 · Informes / Herramientas

- `src/modules/horizon/informes/generators/generateCartera.ts`
- `src/modules/horizon/informes/generators/generatePatrimonio.ts`
- `src/modules/horizon/informes/generators/generateSolvencia.ts`
- `src/modules/horizon/informes/generators/generateFiscal.ts`
- `src/modules/horizon/herramientas/exporters/atlasExportService.ts`
- `src/modules/horizon/herramientas/exporters/mappers.ts`

### 4.7 · Pensiones (vista personal)

- `src/modules/inversiones/pages/FichaPlanPensiones.tsx`
- `src/modules/personal/pages/ViviendaPage.tsx`

### 4.8 · Proyección (consume serie)

- `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts` · ya consume `valoracionesService.getAllValoraciones()` para construir índice por activo
- `src/modules/horizon/proyeccion/valoraciones/Valoraciones.tsx` · página de gestión manual de valoraciones (ya existe · CRUD UI)

**Total · ~50 paths** que leen `valorActual` (o variantes). El refactor PR7 toca decenas de ficheros → la decisión §8.4 del spec ("dividir en PR7a + PR7b") es **recomendable**.

---

## 5 · Estado del servicio de importación · NO huérfano

El spec asume "servicio importValoraciones huérfano sin UI". La realidad:

| Hallazgo | Estado |
|---|---|
| `indexaCapitalImportService.ts` · 460+ LOC · activo | **VIVO** · escribe en `valoraciones_historicas`, `aportacionesPlan` y stores de plan |
| `src/pages/account/migracion/ImportarIndexaCapital.tsx` · página | **VIVO** · llamada desde `src/App.tsx` |
| `src/modules/inversiones/import/ImportarIndexaCapitalPage.tsx` · wizard nuevo | **VIVO** |
| `src/modules/inmuebles/import/ImportarValoraciones.tsx` · wizard genérico polimórfico | **VIVO** · acepta CSV con columna `tipo_activo` ∈ {inmueble, inversion, plan_pensiones} |
| Otros patrones spec (`importHistorico`, `csvValoraciones`, `navImport`, `priceImport`) | **NO encontrados** |

**Conclusión** · el spec PR3 ("rehidratar servicio huérfano") debe reescribirse como "**extender / unificar** los wizards de importación de valoraciones existentes para soportar más tipos de activo (si la cardinalidad final >3) y exponerlos desde las fichas detalle". No hay servicio que rehidratar; hay UI que reorganizar.

---

## 6 · Librería de gráficas confirmada en `package.json`

```
"chart.js": "^4.5.1"
"recharts": "^3.1.2"
```

**Dos** librerías instaladas. Habría que confirmar con Jose cuál es la canónica para los componentes nuevos PR8 / PR9 (`GraficaEvolucionValor`, `GraficaPatrimonioTotal`).

Recomendación · `recharts` (más usado en componentes React, API declarativa, ya en uso).

---

## 7 · Servicios y tipos relacionados (ya existentes · NO recrear)

| Artefacto | Path | Uso |
|---|---|---|
| `valoracionesService` | `src/services/valoracionesService.ts` | servicio CRUD + lectura polimórfica (3 tipos) |
| `ValoracionHistorica` type | `src/types/valoraciones.ts:4` | type del registro polimórfico |
| `ValoracionInput` type | `src/types/valoraciones.ts:31` | input alta |
| `ActivoParaActualizar` type | `src/types/valoraciones.ts:39` | dropdowns "qué actualizar" |
| `ValoracionesMensuales` type | `src/types/valoraciones.ts:17` | snapshot mensual derivado (¿en uso?) |
| Página Valoraciones | `src/modules/horizon/proyeccion/valoraciones/Valoraciones.tsx` | CRUD UI (manual + edit + delete) |
| Audit T24 previo | `docs/AUDIT-T24-valoraciones-matching.md` | normalización String vs Number en matching |

---

## 8 · Resumen ejecutivo para Jose · 3 opciones de PR1

### 8.1 · Opción ALPHA · Refactor en sitio (recomendada)
Renombrar/extender `valoraciones_historicas` a `valoracionesActivos`, mantener servicio existente, **añadir nuevas APIs** del spec (`upsertByDate`, `getPatrimonioTotal`, `getPatrimonioPorTipo`, `deleteAllByActivo`, `bulkInsert` ya está, etc), añadir campos del spec (`divisaOriginal`, `esAnchorFiscal`, `archivoOrigenId`, `deletedAt` soft delete, `valorDivisaOriginal`), normalizar a camelCase, cambiar granularidad de `YYYY-MM` a `YYYY-MM-DD`.
**Pros** · cero data migration, una sola DB version, código existente sigue funcionando.
**Contras** · cambia el schema → necesita migración en `onupgradeneeded`, romper `tipo_activo` (3 valores) → `tipoActivo` (N valores).

### 8.2 · Opción BETA · Store nuevo en paralelo + dual-write transición
Crear store nuevo `valoracionesActivos` (camelCase, granularidad diaria, 7 tipos), dual-write desde servicio, deprecar `valoraciones_historicas` en PR7.
**Pros** · refactor incremental, rollback fácil.
**Contras** · duplicidad temporal, código adicional, riesgo de divergencia.

### 8.3 · Opción GAMMA · Mantener 3-tipos (status quo cardinality)
Solo enriquecer schema actual (granularidad diaria + nuevos campos) sin tocar `tipo_activo` cardinality. Aceptar que fondos/acciones/ETFs/crypto siguen siendo `tipo_activo = 'inversion'`.
**Pros** · refactor mínimo, no cambia modelo dominio.
**Contras** · pierde la oportunidad de separar las fichas por tipo · gráficas y KPIs por tipo se diluyen.

---

## FIN AUDIT_VALORACIONES_USAGES
