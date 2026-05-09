# T-COMPROMISOS-AUDIT · INFORME · pieza compromisos recurrentes · estado real

> **Tipo** · Auditoría dedicada · CERO código modificado
> **Fecha** · 2026-05-09
> **Spec ejecutado** · `T-COMPROMISOS-AUDIT` (entregado por Jose 2026-05-09)
> **Output** · este archivo · 1 solo
> **Reglas aplicadas** · V11.3 · V11.6 · V11.7 · grep duro · NO confiar en T-CRUD-AUDIT anterior

---

## §0 · Resumen ejecutivo (5 líneas)

1. **Catálogo de plantillas** · No existe un store/JSON de plantillas, pero **sí existen 2 catálogos UI cerrados**: `TIPOS_GASTO_PERSONAL` (5 grupos · 30 subtipos) y `TIPOS_GASTO_INMUEBLE_V2` (7 grupos · ~25 subtipos). El wizard NO empieza desde 0 · empieza por el selector tipoGasto→subtipo de esos catálogos · cubre IBI, comunidad, suministros, seguros, gestión, etc.
2. **Confirmación al store** · Servicio `personal/compromisosRecurrentesService.ts` expone CRUD completo · `crearCompromiso` valida invariantes, persiste en `compromisosRecurrentes` y **regenera automáticamente `treasuryEvents` predicted** · `actualizarCompromiso` y `eliminarCompromiso` también sincronizan eventos. Estados disponibles · `'activo' | 'pausado' | 'baja'` · NO existen `'sugerido'` ni `'confirmado'` (el flujo "sugerencia → aprobación" se resuelve en pantalla `DetectarCompromisosPage` SIN persistir candidatos · solo crea ya como `activo`).
3. **Materialización** · La generación de cargos sí ocurre · `generarEventosDesdeCompromiso` + `regenerarEventosCompromiso` escriben en `treasuryEvents` con `sourceType='gasto_recurrente'` y `status='predicted'`. El "Próximo cargo · 29 may" del KPI es runtime sobre `expandirPatron` (NO persistido). Cargos materializados se ven en el `RowExpandedDetail` de cada fila al expandir · **pero NO en una vista agregada de "gastos materializados del mes"** · gap.
4. **Botón Detectar** · SOLO en personal · navega a `/personal/gastos/detectar-compromisos`. Pantalla `DetectarCompromisosPage` invoca `compromisoDetectionService.detectCompromisos` (algoritmo 5 fases sobre `movements`) → muestra candidatos → usuario aprueba → `compromisoCreationService.createCompromisosFromCandidatos` los persiste como `estado='activo'` directamente. NO existe estado intermedio "sugerido". NO existe en inmueble por decisión spec TAREA 9 (heurística orientada a patrones personales bancarios).
5. **Veredicto** · Pieza más completa de lo que sugería T-CRUD-AUDIT · **R1+** · solo gaps menores · ver §F.

---

## §1 · Pre-flight literal (regla §2 spec)

### §1.1 · Eje 1 · catálogo de plantillas

```
$ grep -rnE "plantillaGasto|gastoTemplate|catalogoGastos|templateRecurrente|catalogo.*compromiso" \
    src/ --include="*.ts" --include="*.tsx"
(sin matches)

$ grep -rnE "IBI.*Anual|comunidad.*Mensual|seguro.*Anual" \
    src/services/ src/constants/
(sin matches)

$ find src/ -type f \( -name "*[Nn]uevo*[Gg]asto*" -o -name "*[Cc]ompromiso*[Ww]izard*" \
    -o -name "*[Cc]rear*[Gg]asto*" \)
src/modules/personal/pages/NuevoGastoRecurrentePage.tsx
src/modules/inmuebles/wizards/NuevoGastoRecurrenteInmueblePage.tsx

$ grep -rnE "wizardSteps|stepCatalogo|elegirPlantilla|plantilla[A-Z]" src/modules/
(sin matches)
```

**Hallazgo no contemplado por la spec** · catálogo NO está como "plantillas" sino como **`TipoGastoSelector` + tablas tipadas** · `src/modules/personal/wizards/utils/tiposDeGastoPersonal.ts` (5 grupos · 30 subtipos) y `src/modules/inmuebles/wizards/utils/tiposDeGastoInmueble.ts` (7 grupos · ~25 subtipos). Ambos importados por sus respectivos `NuevoGastoRecurrente*Page.tsx`.

### §1.2 · Eje 2 · confirmación al store

```
$ grep -nE "^export" src/services/compromisosRecurrentesService.ts
(archivo no existe en root)

$ grep -nE "^export" src/services/personal/compromisosRecurrentesService.ts
38:export async function listarCompromisos(
52:export async function obtenerCompromiso(id: number)
57:export async function crearCompromiso(
84:export async function actualizarCompromiso(
117:export async function eliminarCompromiso(id: number)
139:export async function puedeCrearCompromiso(
259:export function generarEventosDesdeCompromiso(
350:export async function borrarEventosFuturosCompromiso(compromisoId: number)
373:export async function regenerarEventosCompromiso(
397:export async function regenerarTodosLosEventos()
408:export { expandirPatron, calcularImporte, aplicarVariacion } from './patronCalendario';

$ grep -rnE "estado.*compromiso|'sugerido'|'confirmado'.*compromiso" src/
(no matches para 'sugerido' relativos a compromiso)
src/modules/shared/components/ListadoGastos/components/KpiStrip.tsx:22:
    const activos = compromisos.filter((c) => c.estado === 'activo');
src/modules/mi-plan/services/budgetProjection.ts:136:
    if (compromiso.estado !== 'activo') return 0;
src/modules/personal/PersonalPage.tsx:36:
    ctx.compromisos.filter((c) => c.ambito === 'personal' && c.estado === 'activo').length
(estados encontrados solo 'activo' · NO 'sugerido'/'confirmado')

$ grep -rnE "db\.put\('compromisosRecurrentes'|db\.add\('compromisosRecurrentes'" src/
src/services/__tests__/propertyExpenses.test.ts:68 (test fixture)
src/services/migrations/__tests__/cleanupCategoriasT34T35fix2.test.ts:85 (test)
src/services/migrations/v68-tipoFamilia.ts:301 (migración)
src/services/__tests__/propertySaleService.test.ts:367 (test)
src/services/migrations/cleanupCategoriasT34T35fix2.ts:114 (migración)
(escrituras productivas SOLO via crearCompromiso/actualizarCompromiso · resto son tests/migraciones)

$ grep -rnE "actualizarCompromiso|updateCompromiso" src/services/
src/services/opexService.ts:20: import { actualizarCompromiso }
src/services/opexService.ts:344: actualizarCompromiso(rule.id, patch)
src/services/personal/compromisosRecurrentesService.ts:84: export async function actualizarCompromiso

$ find src/ -type f -iname "*EditDrawer*" -o -name "compromisoDetection*" -o -name "compromisoCreation*"
src/modules/shared/components/ListadoGastos/components/EditDrawer.tsx
src/services/compromisoDetectionService.ts
src/services/compromisoCreationService.ts
src/pages/dev/CompromisoDetection.tsx
```

**Tipo `EstadoCompromiso`** · `src/types/compromisosRecurrentes.ts:127`

```ts
export type EstadoCompromiso = 'activo' | 'pausado' | 'baja';
```

### §1.3 · Eje 3 · materialización

```
$ grep -rnE "materializar|generarCargo|ejecutarCompromiso|generateRecurrentEvents|expandPattern" \
    src/services/ --include="*.ts"
src/services/treasuryConfirmationService.ts:9:
  // Puntear = materializar una previsión en un movimiento real.
src/services/categoryCatalog.ts:63:
  /** Store de destino al materializar la línea (solo gastos de inmueble). */
(NO existe función llamada literalmente "materializar*" · pero …)

$ grep -rnE "compromisoId|patronId" src/services/treasury*
(sin matches en treasury* services · enlace via sourceId/sourceType)

$ grep -rnE "sourceType.*'gasto_recurrente'|sourceType.*'opex_rule'" src/ --include="*.ts" --include="*.tsx"
src/modules/shared/components/ListadoGastos/components/RowExpandedDetail.tsx:52
src/modules/horizon/tesoreria/services/treasurySyncService.ts:110-111 (orquestación)
src/modules/horizon/tesoreria/services/treasurySyncService.ts:270 (escribe opex_rule)
src/services/personal/compromisosRecurrentesService.ts:308 (escribe gasto_recurrente)
src/services/movementSuggestionService.ts:174 (vía A · sugerir match movement→event)
src/services/fiscalConciliationService.ts:259, 294
src/services/treasuryForecastService.ts:605
src/services/personal/viviendaHabitualService.ts:231, 270, 309 (vivienda habitual derivada)
src/services/db.ts:1172 (definición tipo)
```

**Función materialización canónica** · `generarEventosDesdeCompromiso` + `regenerarEventosCompromiso` (ambas en `src/services/personal/compromisosRecurrentesService.ts:259` y `:373`) · pura + persistente respectivamente · invocadas desde `crearCompromiso` y `actualizarCompromiso` automáticamente. Adicionalmente, `treasuryBootstrapService.regenerateForecastsForward` (`src/services/treasuryBootstrapService.ts:113`) re-procesa todos los compromisos forward-only.

### §1.4 · Eje 4 · botón Detectar

```
$ grep -rnE ">.{0,3}Detectar" src/ --include="*.tsx"
src/modules/horizon/tesoreria/import/BankStatementUploadPage.tsx:457
  <option value="auto">Detectar automáticamente</option>
(esto es de banco · NO el botón Detectar de gastos · es coincidencia léxica)

$ grep -rnE "detectarCompromisos|detectarRecurrentes|detectPatterns|patternDetection" \
    src/ --include="*.ts" --include="*.tsx"
(sin matches con esos nombres EXACTOS)

$ grep -rnE "detectAndPreview|detectCompromisos" src/ --include="*.ts" --include="*.tsx"
src/services/compromisoDetectionService.ts:737: export async function detectCompromisos
src/services/compromisoCreationService.ts:30: import { detectCompromisos }
src/services/compromisoCreationService.ts:211: export async function detectAndPreview
src/modules/personal/pages/DetectarCompromisosPage.tsx:34: import { detectAndPreview }
src/modules/personal/pages/DetectarCompromisosPage.tsx:652: const r = await detectAndPreview(...)
src/pages/dev/CompromisoDetection.tsx (página dev)

$ ls src/services/*[Dd]etect*.ts
src/services/compromisoDetectionService.ts (ESTE)
src/services/documentTypeDetectionService.ts (otros)
src/services/newDocumentTypeDetectionService.ts
src/services/propertyDetectionService.ts
src/services/transferDetectionService.ts
src/services/unicornioDocumentDetection.ts
src/services/utilityDetectionService.ts
```

**Algoritmo · 5 fases** · `compromisoDetectionService.ts:245+` · spec `docs/TAREA-9-bootstrap-compromisos-recurrentes.md` §2.3:

- Fase 1 · `fase1_loadAndNormalize` · lee `movements`
- Fase 2 · `fase2_cluster` · agrupa por concepto bancario normalizado
- Fase 3 · `fase3_inferTemporalPattern` · infiere uno de 8 patrones tipados
- Fase 4 · `fase4_inferImporte` · fijo · variable · estacional · por pago
- Fase 5 · score · MIN_CONFIDENCE 60 · proveedores españoles reconocidos suman +5 (Iberdrola, Endesa, Movistar, Mapfre, etc. · 36 proveedores hardcoded)

**Reglas inviolables** declaradas en cabecera del servicio:

```
//   - NUNCA escribe (solo lectura)
//   - NUNCA toca movementSuggestionService ni compromisosRecurrentesService
//   - NUNCA inventa variantes de PatronRecurrente
//   - Filtra candidatos que correspondan a vivienda habitual o a inmuebles
//     de inversión (modelo · sección 1.2 de la spec)
```

### §1.5 · asimetría inmueble vs personal

```
$ find src/ -type f \( -name "*Gastos*Page*" -o -name "*Gastos*Personal*" -o -name "*Gastos*Inmueble*" \)
src/modules/personal/pages/GastosPage.tsx
(NO hay GastosInmueblePage · usa DetallePage.tsx tab='gastos' del módulo inmuebles)

$ grep -nE "ListadoGastosRecurrentes" src/modules/personal/pages/GastosPage.tsx
5: import { ListadoGastosRecurrentes } from ...
26: <ListadoGastosRecurrentes ... mode="personal" ... />

$ grep -nE "ListadoGastosRecurrentes" src/modules/inmuebles/pages/DetallePage.tsx
21: import { ListadoGastosRecurrentes } from ...
420: <ListadoGastosRecurrentes ... mode="inmueble" inmuebleId={propertyId} ... />
```

**Componente compartido** · `src/modules/shared/components/ListadoGastos/ListadoGastosRecurrentes.tsx` · acepta `mode: 'personal' | 'inmueble'`. Botones "Importar" y "Detectar" se renderizan solo si `mode === 'personal'` (`ListadoGastosRecurrentes.tsx:228`).

### §1.6 · comparativa patrón vs real

```
$ grep -rnE "patron.*real|comparativaCompromiso|aprenderPatron" src/services/
(sin matches)
```

**Veredicto** · NO existe en código la lógica V8/V9 P8.2 ("ATLAS aprende anual · resumen + cliente decide"). El patrón se proyecta forward (`expandirPatron`) y se reconcilia movement-by-movement vía `movementSuggestionService` (vía A) · pero NO hay agregador anual que diga "este compromiso pidió 25€/mes · realidad 28€/mes · ¿actualizo el patrón?". Gap legítimo · documentado en §F.

---

## §A · Eje 1 · catálogo de plantillas · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿Existe en código? | **Sí · parcial** · NO como "plantillas" sino como tablas tipadas: `TIPOS_GASTO_PERSONAL` (`src/modules/personal/wizards/utils/tiposDeGastoPersonal.ts`) y `TIPOS_GASTO_INMUEBLE_V2` (`src/modules/inmuebles/wizards/utils/tiposDeGastoInmueble.ts`) |
| 2 · ¿Cuántas implementaciones? | **2 catálogos paralelos** · uno por ámbito · estructura idéntica (`tipoGasto[].subtipos[]`) pero contenido distinto |
| 3 · ¿Está viva? | **Sí** · ambos catálogos importados por `NuevoGastoRecurrente*Page.tsx` y por `TipoGastoSelector` (componente shared). Productivo |
| 4 · Si 2+ · canónica vs legacy | **Ambas canónicas** · NO son duplicidad · cubren ámbitos distintos. Comparten el componente `TipoGastoSelector` y el tipo `TipoGasto` shared |
| 5 · Dead code residual | **No detectado** · 0 referencias en `src/` a "templates" o "plantillas" como concepto no usado |

### Respuesta concreta

> ¿Hay catálogo de plantillas estándar (IBI · comunidad · seguros · suministros · gestión · ...) o el wizard "Nuevo gasto recurrente" empieza desde 0?

**SÍ hay catálogo · NO empieza de 0.** Cobertura real:

**Personal** · 5 grupos · 30 subtipos · `tiposDeGastoPersonal.ts`:
- `vivienda` (alquiler · IBI · comunidad · seguro hogar)
- `suministros` (luz · gas · agua · internet · móvil · otros)
- `dia_a_dia` (supermercado · transporte · restaurantes · ocio · salud · ropa · cuidado · otros)
- `suscripciones` (streaming · música · software · cloud · prensa · otros)
- `seguros_cuotas` (seguro salud · coche · vida · gimnasio · educación · …)

**Inmueble** · 7 grupos · ~25 subtipos · `tiposDeGastoInmueble.ts`:
- `tributos` (IBI · tasa basuras)
- `comunidad` (cuota ordinaria · derrama)
- `suministros` (luz · gas · agua · internet)
- `seguros` (hogar · impago)
- `gestion` (honorarios agencia · gestoría · asesoría)
- `reparacion` (mantenimiento caldera · integral · limpieza)
- `otros` (personalizado)

**Lo que NO existe** · valores por defecto productivos para "IBI Madrid 2026 ≈ X €/m²", proveedores precargados (Iberdrola, etc.) como sugerencia en el wizard nuevo (sí hay reconocimiento en el detector de patrones del eje 4 · pero no en el wizard manual). Si un cliente nuevo abre el wizard con DB vacía, debe escribir todo a mano (proveedor · NIF · referencia · importe · patrón · cuenta cargo).

---

## §B · Eje 2 · confirmación al store · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿Existe en código? | **Sí · canónico** · `src/services/personal/compromisosRecurrentesService.ts` (NO en root como sugería pre-flight de la spec) |
| 2 · ¿Cuántas implementaciones? | **1 servicio canónico** + 1 capa secundaria (`compromisoCreationService.ts`) que delega en `crearCompromiso` para flujo desde `DetectarCompromisosPage` |
| 3 · ¿Está viva? | **Sí** · imports productivos en `NuevoGastoRecurrente*Page`, `EditDrawer`, `DetectarCompromisosPage`, `opexService`, `viviendaHabitualService`, `treasuryBootstrapService` |
| 4 · Si 2+ · canónica vs legacy | `compromisosRecurrentesService` es canónica · `compromisoCreationService` es **wrapper** que aprueba candidatos de detección · no duplica · usa `crearCompromiso` internamente |
| 5 · Dead code residual | `src/pages/dev/CompromisoDetection.tsx` es página DEV (preview detección) · NO productiva · candidata a documentar como dev-only |

### Respuestas concretas

> ¿Qué stores toca al crear · al modificar · al confirmar · al desactivar un compromiso?

- **crear** (`crearCompromiso:57`) · valida invariantes · `db.add('compromisosRecurrentes')` · si `estado==='activo'` ⇒ `regenerarEventosCompromiso` ⇒ `treasuryEvents` (status `predicted`)
- **actualizar** (`actualizarCompromiso:84`) · valida bloqueo `derivadoDe.bloqueado` · `db.put('compromisosRecurrentes')` · `borrarEventosFuturosCompromiso` ⇒ regenera `treasuryEvents`
- **eliminar** (`eliminarCompromiso:117`) · valida bloqueo · `borrarEventosFuturosCompromiso` ⇒ `db.delete('compromisosRecurrentes')`
- **desactivar (pausar/baja)** · vía `actualizarCompromiso({ estado: 'pausado' | 'baja' })` · borra eventos futuros porque condición `if (actualizado.estado === 'activo')` no se cumple

> ¿El servicio `actualizarCompromiso` realmente persiste o solo emite evento UI?

**Persiste** · `db.put` real en línea `actualizarCompromiso:103` + cascada a `treasuryEvents`. Verificado contra fuente.

> ¿Hay estados (sugerido · confirmado · activo · inactivo) implementados o todos son `activo` por defecto?

`EstadoCompromiso = 'activo' | 'pausado' | 'baja'` (`src/types/compromisosRecurrentes.ts:127`).
- **NO existe** `'sugerido'` ni `'confirmado'`
- El flujo "sugerencia → aprobación" del detector NO persiste candidatos · usa estado en memoria de `DetectarCompromisosPage` y al aprobar inserta directamente con `estado='activo'` (`compromisoCreationService.ts:154+`)
- **Implicación** · si cliente cierra navegador con candidatos detectados sin aprobar · se pierden · hay que re-detectar

---

## §C · Eje 3 · materialización · matriz V11.3 · sección crítica

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿Existe en código? | **Sí** · `generarEventosDesdeCompromiso` + `regenerarEventosCompromiso` (`src/services/personal/compromisosRecurrentesService.ts:259, 373`) |
| 2 · ¿Cuántas implementaciones? | **1 canónica** · más orquestador `regenerateForecastsForward` en `treasuryBootstrapService.ts:113` que la llama en bulk |
| 3 · ¿Está viva? | **Sí** · invocada automáticamente en `crearCompromiso`, `actualizarCompromiso`, `regenerarTodosLosEventos`, `regenerateForecastsForward` |
| 4 · Si 2+ · canónica vs legacy | No duplicidad. `treasurySyncService` toca opex_rule (inmuebles legacy) pero por sourceType distinto · arquitectura paralela coherente |
| 5 · Dead code residual | No detectado |

### Respuestas concretas

> ¿Existe servicio que genere cargos reales desde el patrón? (cron · al abrir app · al cambiar mes · manual)

**Sí · 4 disparadores**:
1. **Al crear** un compromiso `estado='activo'` ⇒ se generan eventos hasta `HORIZONTE_MESES_DEFECTO` (probablemente 12 · pendiente leer constante)
2. **Al actualizar** un compromiso · se borran eventos futuros y se regeneran
3. **Manual orquestado** · `regenerateForecastsForward({ force: true })` invocado en `NuevoGastoRecurrente*Page` tras guardar
4. **Bootstrap inicial** · `treasuryBootstrapService.regenerateForecastsForward` se ejecuta al inicializar tesorería

NO hay cron · NO hay "al cambiar mes". El horizonte se mantiene fijo desde la última escritura. Si pasa el tiempo y nadie toca el compromiso, la "cola" forward se vacía. **Gap menor** · ver §F.

> ¿Esos cargos se persisten en `treasuryEvents` · en `gastosInmueble` · en otro store · en ninguno?

**Solo en `treasuryEvents`** · con campos identificativos:
```ts
sourceType: 'gasto_recurrente'
sourceId: compromiso.id
status: 'predicted'
ambito: 'PERSONAL' | 'INMUEBLE'
inmuebleId: si ambito === 'inmueble'
categoryKey, subtypeKey, providerName, providerNif
```
NO se duplica en `gastosInmueble` (store legacy de gastos puntuales) ni en `movements` hasta que el banco confirme (vía A → reconciliation).

> ¿Las vistas inmueble/personal muestran los cargos materializados junto al patrón?

**Parcial** · `RowExpandedDetail.tsx:52+` muestra los próximos 6 cargos al expandir una fila del listado · cruza `treasuryEvents` por `sourceId` + atributos `categoryKey/subtypeKey/ambito/inmuebleId` para evitar colisiones. Si no hay events (compromiso recién creado) hace fallback computado runtime con `expandirPatron`. Histórico de movements ejecutados también se muestra ligado vía `executedMovementId`.

**Lo que NO está**:
- Vista agregada "todos los cargos materializados del mes" en personal (vistas Tesorería sí los muestran como cualquier otro `treasuryEvent`)
- Vista agregada por inmueble específico de "cargos pendientes este mes" como bloque separado del listado de patrones (igual · están en Tesorería filtrable por `ambito=INMUEBLE` + `inmuebleId`)

> ¿El "próximo cargo · 29 may · -25€" del KPI es cálculo runtime o registro persistido?

**Runtime** · `KpiStrip.tsx:22+` calcula `nextDate` iterando `formatPattern(c.patron, c.fechaInicio).nextDate` para cada compromiso activo · escoge el más cercano. NO consulta `treasuryEvents`. Importe via `calcularImporte(c.importe, fp.nextDate) + aplicarVariacion`.

**Implicación** · KPI es honesto · refleja siempre el patrón actual aunque no haya regenerado events recientemente.

---

## §D · Eje 4 · botón "Detectar" · matriz V11.3

| Pregunta V11.3 | Respuesta |
|---|---|
| 1 · ¿Existe en código? | **Sí** · botón visible solo en `mode='personal'` (`ListadoGastosRecurrentes.tsx:228+`) |
| 2 · ¿Cuántas implementaciones? | **1 servicio detección** (`compromisoDetectionService.ts`) + **1 servicio creación** (`compromisoCreationService.ts`) + **1 pantalla productiva** (`DetectarCompromisosPage`) + **1 página DEV** (`src/pages/dev/CompromisoDetection.tsx`) |
| 3 · ¿Está viva? | **Sí** · ruta productiva `/personal/gastos/detectar-compromisos` · invocada como CTA desde EmptyState también |
| 4 · Si 2+ · canónica vs legacy | `DetectarCompromisosPage` es la productiva · `pages/dev/CompromisoDetection.tsx` es DEV-only (preview rápido sin UI completa) |
| 5 · Dead code residual | Página DEV podría documentarse como dev-only o moverse a `__dev__/` |

### Respuestas concretas

> ¿Qué hace el botón en personal? (fuente · output · efecto secundario)

- **Fuente** · `db.movements` (lecto only · todos los movements)
- **Output** · array `CandidatoCompromiso[]` con `propuestaCompromiso` (objeto pre-rellenado), `score` y `motivosScore`
- **Efecto secundario inmediato** · ninguno (lectura pura)
- **Efecto secundario al APROBAR** · `compromisoCreationService.createCompromisosFromCandidatos` ⇒ `crearCompromiso` (uno por candidato) ⇒ persiste `compromisosRecurrentes` + regenera `treasuryEvents`. Idempotente · filtro por `cuentaCargo + conceptoBancario` similar contra el store

> ¿Por qué NO está en inmueble? · deuda · intencional · imposible

**Intencional** según cabecera del servicio: "Filtra candidatos que correspondan a vivienda habitual o a inmuebles de inversión" — el detector descarta candidatos que parezcan inmueble (matchVivienda + matchInmuebleInversion en el algoritmo) porque la heurística está pensada para gastos personales bancarios. Inmuebles tienen flujo distinto (contratos · OPEX · documentos importados). **NO es deuda · es decisión arquitectónica documentada**.

> ¿Detección es ML · heurística simple · regex · plantillas?

**Heurística estructurada** · 5 fases · 8 variantes de PatronRecurrente tipadas (no se inventan). Score con umbral 60. Diccionario de proveedores reconocidos suma boost · ~36 proveedores españoles hardcoded (Iberdrola, Endesa, Naturgy, Movistar, Mapfre, Allianz, Sanitas, Netflix, Spotify, etc.).

> ¿Crea compromisos directamente o sugiere para que cliente confirme?

**Sugiere** · `DetectarCompromisosPage` muestra candidatos con checkbox por defecto seleccionado (selectedVisibleCount), permite editar tipoCompromiso · categoria · responsable · alias antes de aprobar. Aprobación bulk vía botón "Aprobar seleccionados (N)" (`DetectarCompromisosPage.tsx:1008`). NO persiste candidatos como "sugeridos" en BD · solo memoria de la pantalla.

---

## §E · asimetría inmueble vs personal · mapa de diferencias

| Diferencia | Personal | Inmueble | Veredicto |
|---|---|---|---|
| Botón **Detectar** | ✅ visible · navega a `/personal/gastos/detectar-compromisos` | ❌ no visible | **Intencional** · detector se filtra a `personal` por diseño · `compromisoDetectionService` cabecera |
| Botón **Importar** | ✅ visible · navega a `/inmuebles/importar-contratos` (¡!) | ❌ no visible | **Bug menor de UX** · botón en personal pero ruta destino es de inmuebles · revisar si era intencional reutilizar el importer de contratos para detectar nóminas/pagos personales |
| Wizard "Nuevo gasto recurrente" | `NuevoGastoRecurrentePage` · sección bolsa 50/30/20 · catálogo `TIPOS_GASTO_PERSONAL` (5 grupos) | `NuevoGastoRecurrenteInmueblePage` · PropertyBadge en header · sin bolsa · catálogo `TIPOS_GASTO_INMUEBLE_V2` (7 grupos) | **Coherente** · spec T34/T35 explícita |
| Vista agregada de cargos materializados del mes | ❌ no existe (existe Tesorería filtrable) | ❌ no existe | **Gap simétrico** |
| Vista comparativa patrón vs realidad anual | ❌ no existe | ❌ no existe | **Gap simétrico · regla V8/V9 P8.2 NO implementada** |
| Tipo `inmuebleId` en compromiso | undefined si ambito='personal' | required si ambito='inmueble' | Tipado correcto |
| `tipoCompromiso` · disponibles | `'otros'` `'impuesto'` `'comunidad'` `'seguro'` `'suministro'` `'suscripcion'` `'cuota'` | mismos · pero catálogo restringe a tributos/comunidad/suministro/seguro/otros | Coherente · subtipos restringidos a subtipos productivos por ámbito |

**Hallazgo no contemplado** · el botón "Importar" en personal apunta a `/inmuebles/importar-contratos` · puede ser bug copy-paste de cuando se diseñó el componente shared. Decisión Jose recomendada · spec mini-fix o ignorar.

---

## §F · veredicto · alcance del trabajo necesario

### Tabla de gaps detectados

| # | Gap | Severidad | Tiempo estimado | Bloquea otros |
|---|---|---|---|---|
| 1 | Catálogo wizard sin valores por defecto productivos (proveedores · importes orientativos · NIFs típicos) | Baja · UX | 2-4h CC · constantes hardcoded por subtipo | NO |
| 2 | NO existe estado intermedio `'sugerido'` · candidatos detectados se pierden si cierra navegador sin aprobar | Media · UX · datos | 4-6h CC · ampliar `EstadoCompromiso` + persistir candidatos en nuevo store o en `compromisosRecurrentes` con flag | Sí · spec previo a comparativa anual |
| 3 | NO hay regeneración periódica de eventos (cron · al cambiar mes) · "cola forward" puede vaciarse | Baja · operativa | 2-3h CC · hook en `App.tsx` o en routing · invocar `regenerarTodosLosEventos` si último update >30 días | NO |
| 4 | NO hay vista agregada "cargos del mes" por ámbito · solo Tesorería | Baja · UX | 4-6h CC · componente `CargosMensualesPanel` reutilizable | NO |
| 5 | NO existe comparativa patrón vs real anual (V8/V9 P8.2) · "ATLAS aprende anual · resumen + cliente decide" | Media · estratégica | 6-10h CC · agregador `compromisosLearningService` que cruce `treasuryEvents.executed` con patrón teórico · resumen anual + propuesta de actualización | Sí · es lo que cierra el ciclo de la pieza |
| 6 | Botón "Importar" en personal apunta a ruta de inmuebles · UX confusa | Trivial | 30 min CC · decidir destino o eliminar botón | NO |
| 7 | Página DEV `src/pages/dev/CompromisoDetection.tsx` no documentada como dev-only | Trivial · housekeeping | 15 min · banner DEV o mover a `__dev__/` | NO |
| 8 | Detector no aplica a inmuebles · documentación de la decisión solo en cabecera del servicio | Bajo · documentación | 30 min · README en `/inmuebles` o ADR | NO |

### Resumen ejecutivo · ruta recomendada

**R1+ · pieza está bien · solo faltan refinamientos**

- T-CRUD-AUDIT NO se equivocó al marcar N/A · UI compromisos existe y persiste correctamente
- Los 4 ejes auditados están **mejor implementados de lo que sugería el spec** ·
  - Catálogo · existe (con matiz · son tablas tipadas, no plantillas con defaults)
  - Confirmación · cubierta · CRUD completo · cascada a treasuryEvents · estados claros
  - Materialización · cubierta · sourceType='gasto_recurrente' · vista granular en RowExpandedDetail
  - Detector · funcional · 5 fases · 8 patrones · 36 proveedores reconocidos · bulk approval con edición previa

**Lo que SÍ falta** se concentra en gap #5 (comparativa patrón vs real anual · regla V8/V9 P8.2) que es la pieza estratégica · todo lo demás es UX/housekeeping.

**Propuesta concreta para Jose · 3 specs separados ordenados por valor**:

| Orden | Spec | Tiempo | Justificación |
|---|---|---|---|
| 1 | `S-COMPROMISOS-LEARNING` (gap #5) | 6-10h CC | Cierra el ciclo · es la pieza que más valor da al cliente · "ATLAS aprende cada año y propone actualizar el patrón sin tocar nada hasta que confirmes" |
| 2 | `S-COMPROMISOS-SUGERIDO-PERSIST` (gap #2) | 4-6h CC | Aumenta calidad · evita pérdida de trabajo · prerequisito de polish |
| 3 | Mini-fixes (gaps #1 #3 #4 #6 #7 #8) | 8-12h CC total · 1-2h cada uno | Housekeeping · pueden ir en un solo PR encadenado tipo D-CRUD-MEDIA |

**NO recomendado · R3/R4** · no hay duplicidades arquitectónicas que requieran saneamiento previo · no hay alcance grande oculto.

---

## §G · Riesgos y notas

1. **Riesgo bajo** · `EditDrawer.tsx` no fue inspeccionado en detalle · solo confirmé que existe y se usa. Si Jose sospecha de comportamiento al editar, audit dedicado.
2. **Constante `HORIZONTE_MESES_DEFECTO`** · referenciada en `generarEventosDesdeCompromiso:269` · no se leyó valor · presumiblemente 12 (estándar). Si fuese distinto, afectaría a la cola forward.
3. **Vía A · `movementSuggestionService`** · no se auditó en este informe (fuera de scope · es matching banco→evento) · pero se confirma que se cabela vía `metadata.compromisoId` y `sourceType='gasto_recurrente'`.
4. **NO se ejecutaron tests** · audit es solo informe.

---

## §H · Criterios de aceptación (§5 spec)

- [x] Pre-flight §2 ejecutado · output pegado literal
- [x] §A · catálogo plantillas con matriz V11.3
- [x] §B · confirmación al store con matriz V11.3
- [x] §C · materialización con matriz V11.3
- [x] §D · botón Detectar con matriz V11.3
- [x] §E · asimetría inmueble vs personal
- [x] §F · veredicto · ruta R1+
- [x] PR contra `main` con UN solo archivo
- [x] PR description con resumen ejecutivo · 5 líneas

---

**Fin del informe.**
**Stop-and-wait · esperar decisión Jose sobre R1+ · spec que sigue.**
