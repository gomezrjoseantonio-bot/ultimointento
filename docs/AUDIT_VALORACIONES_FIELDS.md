# AUDIT_VALORACIONES_FIELDS

**PR0 · TAREA-CC-T-VALORACIONES · v1**
**Fecha** · 2026-05-19
**HEAD auditado** · `624f190` (branch `claude/polymorphic-valuations-store-wVfsr`)
**Generado por** · `grep -RInE "<patrón legacy>" src/`
**Raw output** · ver `docs/AUDIT_VALORACIONES_FIELDS.txt` (690 líneas)

---

## 1 · Frecuencia absoluta por campo (en `src/`)

| Campo legacy | Hits | Naturaleza (preliminar) |
|---|---:|---|
| `valorCatastral` | 319 | **FISCAL · catastro** · NO migrar (no es valoración temporal) |
| `valorActual` | 220 | **VALORACIÓN temporal** · candidato MIGRAR |
| `precioCompra` | 58 | **FISCAL · adquisición** · NO migrar (dato fiscal histórico de compra) |
| `valorAdquisicion` | 54 | **FISCAL · adquisición** · NO migrar |
| `cotizacion` | 44 | **VALORACIÓN temporal** · candidato MIGRAR (inversiones/acciones) |
| `saldoActual` | 37 | **VALORACIÓN temporal** (cuentas/depósitos) · candidato MIGRAR (revisar: en tesoreria es el cash, NO un activo invertible) |
| `saldoFinal` | 19 | **VALORACIÓN temporal** (cuentas) · candidato MIGRAR (mismas reservas que `saldoActual`) |
| `precioUnitario` | 14 | **VALORACIÓN temporal** (por unidad/participación) · candidato MIGRAR |
| `tasacion` | 7 | **VALORACIÓN temporal** (inmuebles) · candidato MIGRAR |
| `valorCompra` | 2 | **FISCAL · adquisición** · NO migrar |

**Patrones del spec NO encontrados en código** · `valorMercado`, `valorMercadoActual`, `valorContable`, `costeOriginal`, `importeActual`, `valorLiquidativo`, `valorParticipacion`, `valoracionCatastral`, `valorConsolidado` — la spec asumía estos nombres pero el repo usa otros (los hits totales del grep cubren los snake_case y variantes que sí existen, listados arriba).

---

## 2 · Tabla detallada `store_name | file_path | line | field_name | usage_type | consumer_module`

**Convención** ·
- `usage_type` · `read` (lectura), `write` (escritura/asignación), `type` (declaración en interface), `comment` (solo doc), `both`
- `consumer_module` · módulo funcional (Inversiones, Inmuebles, Fiscalidad, Tesorería, Pensiones, Personal, Informes, Tests, Servicios-core)

> Tabla acotada a campos **candidatos a MIGRAR** (no fiscales). Lista completa, larga · ver `AUDIT_VALORACIONES_FIELDS.txt` para inspección 1-a-1.

### 2.1 · `valorActual` (220 hits · 45 ficheros)

| store_name | file_path | line | field_name | usage_type | consumer_module |
|---|---|---:|---|---|---|
| planesPensiones | `src/types/planesPensiones.ts` | 53 | `valorActual?: number` | type | Pensiones |
| (memoria) | `src/types/personal.ts` | 481 | `valorActual: number` | type | Personal |
| properties | `src/types/propertyAnalysis.ts` | 18 | `valorActualActivo: number` | type | Inmuebles |
| valoraciones_historicas | `src/services/valoracionesService.ts` | 162, 177, 481 | `plan.valorActual` / `valorActual: v.valor` | both | Servicios-core |
| inversiones | `src/services/inversionesService.ts` | (múltiple) | `valorActual` | both | Inversiones |
| planesPensiones | `src/services/planesPensionesService.ts` | (múltiple) | `valorActual` | both | Pensiones |
| planesPensionInversion (legacy V65) | `src/services/planesInversionService.ts` | (múltiple) | `valorActual` | both | Pensiones-legacy |
| inversiones | `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 9, 16, 20 | prop `valorActual: number` | read | Inversiones · UI |
| inversiones | `src/modules/horizon/inversiones/components/utils.ts` | — | helper | read | Inversiones |
| inversiones | `src/modules/horizon/inversiones/InversionesPage.tsx` | — | listado | read | Inversiones |
| inversiones | `src/modules/inversiones/components/FichaValoracionSimple.tsx` | — | ficha detalle | read | Inversiones · ficha |
| inversiones | `src/modules/inversiones/components/FichaGenerica.tsx` | — | ficha detalle | read | Inversiones · ficha |
| inversiones | `src/modules/inversiones/components/FichaDividendos.tsx` | — | ficha detalle | read | Inversiones · ficha |
| inversiones | `src/modules/inversiones/components/CartaPosicion.tsx` | — | tarjeta resumen | read | Inversiones · listado |
| inversiones | `src/modules/inversiones/adapters/posicionesCerradas.ts` | — | adapter | read | Inversiones |
| inversiones | `src/modules/inversiones/components/modal/AltaFondoModal.tsx` | — | input alta | write | Inversiones · alta |
| planesPensiones | `src/modules/inversiones/components/modal/AltaPlanWizard.tsx` | — | input alta | write | Pensiones · alta |
| planesPensiones | `src/modules/inversiones/pages/FichaPlanPensiones.tsx` | — | ficha PP | read | Pensiones · ficha |
| inversiones | `src/modules/inversiones/types/cartaItem.ts` | — | type | type | Inversiones |
| inversiones | `src/modules/inversiones/helpers.ts` | — | helper | read | Inversiones |
| inversiones | `src/modules/inversiones/components/modal/TraspasoModal.tsx` | — | modal | read | Inversiones |
| valoraciones_historicas | `src/services/declaracionDistributorService.ts` | — | dist fiscal | read | Fiscalidad |
| (varios) | `src/services/indexaCapitalImportService.ts` | — | importer | write | Inversiones · import |
| valoraciones_historicas | `src/services/informesDataService.ts` | — | informe cartera | read | Informes |
| inversiones | `src/services/rentabilidadPlanService.ts` | — | TWR plan | read | Pensiones · KPIs |
| inversiones | `src/services/traspasosPlanPensionesService.ts` | — | traspasos | read | Pensiones |
| (varios) | `src/modules/horizon/herramientas/exporters/atlasExportService.ts` | — | export | read | Herramientas |
| (varios) | `src/modules/horizon/herramientas/exporters/mappers.ts` | — | export | read | Herramientas |
| (varios) | `src/modules/horizon/informes/generators/generateCartera.ts` | — | informe | read | Informes |
| (varios) | `src/modules/horizon/informes/generators/generatePatrimonio.ts` | — | informe | read | Informes |
| (varios) | `src/modules/horizon/informes/generators/generateSolvencia.ts` | — | informe | read | Informes |
| (varios) | `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts` | — | proyección | read | Proyección |
| (cuentas) | `src/modules/horizon/tesoreria/HistoricoWizard.tsx` | — | wizard | read | Tesorería |
| (cuentas) | `src/modules/horizon/tesoreria/services/treasurySyncService.ts` | — | sync | read | Tesorería |
| inmuebles | `src/pages/inmuebles/InmueblesAnalisis.tsx` | — | análisis | read | Inmuebles |
| fondos_ahorro | `src/modules/mi-plan/wizards/WizardNuevoFondo.tsx` | — | wizard | write | Mi-plan |
| objetivos | `src/modules/mi-plan/wizards/WizardNuevoObjetivo.tsx` | — | wizard | write | Mi-plan |
| objetivos | `src/modules/mi-plan/wizards/utils/calcularRitmo.ts` | — | helper | read | Mi-plan |
| (tests) | `src/services/__tests__/rentabilidadPlanService.test.ts` | — | test | mock | Tests |
| (tests) | `src/services/__tests__/traspasosPlanPensionesService.test.ts` | — | test | mock | Tests |
| (tests) | `src/services/__tests__/dbV65Migration.test.ts` | — | test | mock | Tests |
| (tests) | `src/utils/__tests__/propertyAnalysisUtils.test.ts` | — | test | mock | Tests |
| (tests) | `src/modules/inversiones/components/modal/__tests__/AportarModal.test.tsx` | — | test | mock | Tests |
| (tests) | `src/modules/inversiones/components/bloques/__tests__/BloqueSandbox.test.tsx` | — | test | mock | Tests |
| properties | `src/utils/propertyAnalysisUtils.ts` | — | util | read | Inmuebles |
| varios | `src/services/db.ts` | — | DB schema / migrations | both | DB-core |

### 2.2 · `cotizacion` (44 hits · principalmente Inversiones · acciones/ETF)

Archivos top:
- `src/modules/inversiones/**` (CartaPosicion, FichaDividendos, FichaGenerica, modal/AportarModal, modal/VenderModal, modal/TraspasoModal)
- `src/services/inversionesService.ts`
- `src/types/inversiones.ts`

Naturaleza · precio unitario de cotización de acción/ETF a fecha. **Candidato a MIGRAR** como valoración del activo (`valor = cotizacion * unidades` o como entrada cotización-pura por unidad).

### 2.3 · `precioUnitario` (14 hits)

Casi exclusivamente en `src/modules/inversiones/` · variante de `cotizacion`. Mismo trato.

### 2.4 · `saldoActual` (37 hits) y `saldoFinal` (19 hits)

Ubicación dominante: `src/modules/tesoreria/`, `src/services/accountBalanceService.ts`. **Estos NO son valoración de "activo invertible"** sino saldo de cuenta corriente (cash en tesorería). El spec los incluye en el patrón, pero la decisión correcta es:
- **`accounts` (cuentas corrientes) · NO migrar a `valoracionesActivos`**. La tesorería tiene su propio modelo de saldo derivado de `movements`.
- **`depositos` (depósito a plazo bancario remunerado) · SÍ migrar** si existe como tipo de activo invertible. **No se ha encontrado un store `depositos` independiente** en `db.ts` (ver §3 del audit de stores). Los depósitos hoy se modelan como subtipo dentro de `inversiones` o no existen.

### 2.5 · `tasacion` (7 hits)

- `src/services/informesDataService.ts`
- `src/services/rentabilidadInmuebleService.ts`
- `src/services/propertyDisposalTaxService.ts`
- `src/services/__tests__/irpfPropertyDisposalIntegration.test.ts`

Naturaleza · valoración pericial de inmueble. **MIGRAR como anchor fiscal** (`esAnchorFiscal: true` en `ValoracionActivo` propuesto).

---

## 3 · Campos a NO migrar (datos fiscales, no temporales)

Decisión documentada en spec §8.1: **`valorAdquisicion`, `precioCompra`, `valorCompra`, `valorCatastral`** son **datos de adquisición / catastro fiscal**, no valoraciones temporales del activo. Deben permanecer en sus stores actuales.

| Campo | Hits | Justificación |
|---|---:|---|
| `valorCatastral` | 319 | Valor catastral del inmueble (AEAT) · cambia muy poco · dato fiscal · vive en el inmueble |
| `precioCompra` | 58 | Precio histórico de compra · dato inmutable de adquisición |
| `valorAdquisicion` | 54 | Mismo que precioCompra (alias por módulo) |
| `valorCompra` | 2 | Mismo que precioCompra (alias por módulo) |

---

## 4 · Hallazgo crítico · La spec PR0 asume un punto de partida que NO coincide con el repo

### 4.1 · La DB ya está en V73 (no v71)

`src/services/db.ts:31`:
```typescript
const DB_VERSION = 73; // V73 (T-INVERSIONES-DETALLE-PP-v1 PR 3): ...44 stores totales.
```

El spec asume bump `v71 → v72` para PR1. El **bump real propuesto** debe ser `v73 → v74` (PR1) y `v74 → v75` (PR7).

### 4.2 · Ya existe un store polimórfico de valoraciones · `valoraciones_historicas`

Creado en V2.1 (versión muy antigua), con índices reforzados en V69. Ubicación: `src/services/db.ts:2855-2869`.

Schema actual:
```typescript
{
  id: number,             // autoincrement
  tipo_activo: 'inmueble' | 'inversion' | 'plan_pensiones',  // discriminator (snake_case)
  activo_id: number | string,  // ⚠️ tipo mixto (V69 normaliza con String())
  activo_nombre: string,
  fecha_valoracion: string,    // YYYY-MM (mensual · no YYYY-MM-DD diario)
  valor: number,
  origen: 'manual' | 'importacion' | 'api_externa',
  notas?: string,
  created_at: string,
  updated_at: string,
}
```

Índices:
- `tipo_activo`
- `activo_id`
- `fecha_valoracion`
- `tipo-activo-fecha` (3-key compuesto) · creado V2.1
- `tipo-activo` (2-key compuesto) · añadido V69 para queries sin fecha

**Servicio asociado** · `src/services/valoracionesService.ts` (762 LOC, completamente cableado).

API existente (parcial · ver §5 de `AUDIT_VALORACIONES_USAGES.md`):
- `getInmueblesParaActualizar()`, `getInversionesParaActualizar()`, `getPlanesParaActualizar()`
- `getUltimaValoracion(tipo, id)`, `getValoracionMasReciente(tipo, id)` (alias)
- `getAllValoraciones()`
- `getMapValoracionesMasRecientes(tipo)` (Map activo_id → última)
- `getMapValoracionesMasRecientesConMatchingPorNombre(tipo)` (matcher robusto · fallback por nombre)
- `auditMatching(tipo)` (debug · valoraciones huérfanas)
- `guardarValoracion(input)`
- `guardarValoracionesMensual(...)` (cierre mensual)
- (768 LOC totales · ver fichero completo para el set entero)

**Tipo asociado** · `src/types/valoraciones.ts` (`ValoracionHistorica`, `ValoracionesMensuales`, `ValoracionInput`, `ActivoParaActualizar`).

### 4.3 · Hay UI de importación de valoraciones · NO está huérfana

| Componente | Path | Estado |
|---|---|---|
| `ImportarValoraciones.tsx` (genérica) | `src/modules/inmuebles/import/ImportarValoraciones.tsx` | **VIVO** · acepta CSV con columna `tipo_activo` |
| `ImportarIndexaCapitalPage.tsx` (Indexa) | `src/modules/inversiones/import/ImportarIndexaCapitalPage.tsx` | **VIVO** · wizard específico Indexa |
| `ImportarIndexaCapital.tsx` (page-shell viejo) | `src/pages/account/migracion/ImportarIndexaCapital.tsx` | **VIVO** · página llamada desde menú |
| `indexaCapitalImportService.ts` | `src/services/indexaCapitalImportService.ts` | **VIVO** · escribe en `valoraciones_historicas` |

> El spec asume "servicio huérfano sin UI"; la realidad es que **el sistema de importación está vivo y cableado**, aunque limitado a `tipo_activo` cardinalidad-3.

### 4.4 · Cardinalidad real de `TipoActivo` en datos · 3, no 7

El spec asume 7 tipos (`plan_pensiones, fondo, accion_etf, crypto, inmueble, deposito, otro`).
El código actual solo modela 3: **`inmueble | inversion | plan_pensiones`**.

Bajo `inversion` se agrupan hoy fondos / acciones / ETFs / crypto (sin distinguir). Ver §1 del nuevo `AUDIT_TIPO_ACTIVO_FINAL.md`.

---

## 5 · Lectura recomendada para Jose antes de PR1

1. Leer §4 de este documento.
2. Decidir entre las tres rutas listadas en `AUDIT_TIPO_ACTIVO_FINAL.md` §3.
3. Ratificar (o ajustar) la lista cerrada de `TipoActivo` para PRs 3-6.
4. Confirmar tratamiento de cuentas (cash en `accounts`) · **propuesta** · fuera de scope del refactor.

---

## FIN AUDIT_VALORACIONES_FIELDS
