# AUDIT FICHA PLAN DE PENSIONES · v1

**Fecha auditoría** · 2026-05-21
**Branch base** · `main` @ commit `ae848f2` (post merge #1383)
**Autor** · CC (sesión Claude Code on the Web)
**Spec de origen** · TAREA-CC-AUDIT-T-FICHA-PP v1

> ⚠️ **Nota cronológica** · Cuando se redactó la spec PR0 el repo estaba en
> `main @ c3aa850` (post #1382 · DB v75). Entre la redacción y esta
> ejecución, el PR **#1383 (T-FICHA-PP-PULIDO v1)** se mergeó en `main`
> (`f4b7037` + merge `ae848f2`). Esa entrega resolvió de facto 6 de las 10
> hipótesis del PR0. Esta auditoría refleja el **estado real post-#1383** y,
> en cada hipótesis, marca explícitamente · "**resuelta por #1383**" cuando
> aplique. Las recomendaciones de §12 actualizan T-FICHA-PP-PULIDO v1 en
> función de qué queda por hacer.

---

## 1 · Estructura del componente

### 1.1 · Path principal

- **`src/modules/inversiones/pages/FichaPlanPensiones.tsx`** · **1641 LOC** · function component
- `React.FC<{ planId: string; onBack: () => void }>`
- Cabecera del archivo (`L1-L11`) declara "T23.6.4 · Ficha detallada de plan de pensiones".
- **NO está dividido en archivos**: el componente concentra todo el JSX del detalle (1641 LOC) y delega los 5 bloques "chicha" a subcomponentes en `components/bloques/`.

### 1.2 · Árbol de subcomponentes

```
FichaPlanPensiones.tsx                                              1641 LOC
│  L724 ── <FichaShell hero={...} actions={...}>                    (header navy + meta + KPIs hero)
│
├── <BloqueProyeccion />            P1   431 LOC  ⭐ Bug #3 (escala Y) + Bug #5 (+451k€)
│     src/modules/inversiones/components/bloques/BloqueProyeccion.tsx
│     · Saldo final + diferencias por escenario
│     · Toggle "Escenario actual / Si cambias gestora / Si aportas el máximo"
│     · SVG inline custom (SerieMiniSparkline) — NO usa recharts
│
├── <BloqueBenchmark />             P2   228 LOC
│     src/modules/inversiones/components/bloques/BloqueBenchmark.tsx
│     · Barras horizontales TWR vs benchmarks
│
├── <BloqueCostes />                P3   263 LOC  ⭐ Bug #1 (TER) + Bug #2 (botón)
│     src/modules/inversiones/components/bloques/BloqueCostes.tsx
│     · Acepta `ter: number | null` + `terFuente` (post-#1383)
│
├── <BloqueHitos />                 P4   212 LOC
│     src/modules/inversiones/components/bloques/BloqueHitos.tsx
│
├── <BloqueSandbox />               P5   254 LOC
│     src/modules/inversiones/components/bloques/BloqueSandbox.tsx
│
└── <details> "Detalle fiscal y aportaciones" (inline en FichaPlanPensiones)
       ├── §1.3 SparklineDoble inline (L225-306)            ⭐ gráfica histórico real
       ├── §1.4 Estructura aportación (solo PPE/PPES)
       ├── §1.5 Ventaja fiscal · campaña 2026               ⭐ Bug #4 — "este plan"
       ├── §1.5.bis Datos fiscales (Este plan + Tu hogar + Al rescatar)  ⭐ Bug #4 — "tu hogar"
       ├── §1.6 Composición (placeholder pendiente API gestora)
       ├── Datos del plan (tipo/gestora/ISIN/fecha/estado)
       ├── §1.6.bis Trayectoria · rentabilidad por bloque (tabla)
       ├── §1.6.ter Trayectoria del plan (timeline tabular)            ⭐ H9
       └── §1.7 Tabla aportaciones histórico (condicional ≥2)          ⭐ Bug #6
```

Los `BloqueBenchmark`, `BloqueHitos`, `BloqueSandbox` y los wrappers de fiscal/datos del plan son **secundarios** para los 6 bugs · se documentan más arriba pero no se entra al detalle.

### 1.3 · Props del componente principal

`FichaPlanPensiones.tsx:311-314` ·

```ts
interface Props {
  planId: string;
  onBack: () => void;
}
```

- Recibe **sólo el ID** y carga internamente (`load()` en `L346`) ·
  `planesPensionesService.getPlan(planId)`, `aportacionesPlanService.getAportacionesPorPlan`, `valoracionesService.getEvolucionActivo`, `traspasosPlanPensionesService.getTraspasosPorPlan`.
- 13 piezas de estado · `plan`, `aportaciones`, `valoraciones`, `marginalIrpf`, `hasFiscalContext`, `rentabilidadTotal`, `bloques`, `traspasos`, `reduccionHogar`, 5 booleanos de modales (incluido `showEditTer` post-#1383).

### 1.4 · Navegación entrante

- Routing en `src/App.tsx:891-893` ·
  ```tsx
  <Route path="inversiones/:posicionId" element={<InversionesFichaPosicion />} />
  ```
- `FichaPosicionPage.tsx:108-110` despacha al detector de tipo · si `esPlanPensiones` ⇒ renderiza `<FichaPlanPensiones planId={posicionId!} onBack={handleBack} />`.
- **Único entry-point**. No hay navegación directa desde dashboard, Mi Plan u otros módulos al detalle PP · sólo desde la galería de Inversiones.

---

## 2 · Modelo de datos · tipo `PlanPensiones`

### 2.1 · Definición canónica

`src/types/planesPensiones.ts:33-80` (íntegro, sin recortar) ·

```ts
export interface PlanPensiones {
  id: string; // UUID estable durante toda la trayectoria

  nombre: string;
  titular: 'yo' | 'pareja';
  personalDataId: number;

  tipoAdministrativo: TipoAdministrativo;
  subtipoPPE?: SubtipoPPE;
  subtipoPPES?: SubtipoPPES;
  garantizado?: boolean;

  politicaInversion?: PoliticaInversion;
  porcentajeRentaVariable?: number;

  modalidadAportacion?: ModalidadAportacion;

  gestoraActual: string;
  isinActual?: string;
  fechaUltimaValoracion?: string;
  valorActual?: number;

  fechaContratacion: string;
  importeInicial?: number;

  empresaPagadora?: {
    cif: string;
    nombre: string;
    ingresoIdVinculado?: string;
  };

  participeConDiscapacidad?: boolean;

  /**
   * Override manual del TER (Total Expense Ratio) anual del plan en formato
   * porcentual decimal · 1.5 = 1,50 %. Prevalece sobre el catálogo curado
   * (`TER_CATALOGO_PP`). Vacío · resuelve por catálogo o cae a "sin dato".
   * T-FICHA-PP-PULIDO v1 · Bug #1 · campo opcional · sin DB bump.
   */
  terOverride?: number;

  estado: EstadoPlan;

  fechaCreacion: string;
  fechaActualizacion: string;

  origen: 'manual' | 'xml_aeat' | 'migrado_v60';
}
```

Notas ·

- `valorActual` y `fechaUltimaValoracion` siguen en el schema pero ya **se hidratan en runtime** desde `valoracionesActivos` vía `hydrateValorActualPlanes()` en `planesPensionesService.ts:23-37` (T-VALORACIONES PR7a'''').
- Origen ·
  - **AEAT** · sólo importación masiva (`origen='xml_aeat'`); rellena `gestoraActual`, `nombre`, `tipoAdministrativo`, `fechaContratacion`, `importeInicial`.
  - **Manual** · alta vía wizard · todos los campos visibles editables.
  - **Computado** · `valorActual`, `fechaUltimaValoracion` (post hidratación).

### 2.2 · Tabla de campos críticos

| Campo esperado por spec | ¿Existe? | Nombre real | Tipo | Nota |
|---|---|---|---|---|
| `gestoraId` | ❌ NO | — | — | No existe slug · el matching del catálogo usa normalización de `gestoraActual` en runtime |
| `gestoraNombre` | ⚠️ otro nombre | `gestoraActual` | `string` | Display literal (ej. "BBVA", "myinvestor") |
| `planSlug` | ❌ NO | — | — | Idem · matching por normalización de `nombre` |
| `planNombre` / `nombrePlan` | ⚠️ otro nombre | `nombre` | `string` | |
| `tipoPlan` (PPI/PPE/PPES/PPA) | ✅ SÍ | `tipoAdministrativo` | `'PPI' \| 'PPE' \| 'PPES' \| 'PPA'` | |
| `terAnual` / `comisionGestion` | ❌ NO | — | — | TER se resuelve runtime por `resolveTerPlan()`. Hay un override opcional |
| `terOverride` | ✅ SÍ (añadido en #1383) | `terOverride` | `number?` | Formato porcentual (1.5 = 1,50 %) |
| `fechaContratacion` / `fechaApertura` | ✅ SÍ | `fechaContratacion` | `string` (ISO) | |
| `valorInicial` | ⚠️ otro nombre | `importeInicial` | `number?` | Spec lo llama "Valor inicial"; el código lo nombra "importeInicial" |
| `tipoMarginalIRPF` | ❌ NO en el plan | — | — | Se calcula desde `estimacionFiscalEnCurso → baseImponibleGeneral → TRAMOS_MARGINAL` (`FichaPlanPensiones.tsx:75-89`, `431-435`). El "45 %" sale del último tramo |
| `edadObjetivoRescate` (en escenarios) | ✅ SÍ | `escenario.edadObjetivoRescate` | `number` | Vía `getEscenarioActivo()` |

### 2.3 · Seed actual de Jose (2 planes)

- **No existe seed canónica** con los dos planes de Jose en `src/data/seeds/` ni `src/__fixtures__/`.
- `src/data/seeds/` sólo contiene `benchmarksReferencia.ts` (MSCI_WORLD_EUR, SP500_EUR, etc.).
- Los planes "Plan Orange BBVA · 35.491€" y "Indexado myinvestor · 101.745€" **se cargan vía importación XML AEAT o creación manual del wizard**. No están materializados en código.
- Los nombres aparecen en código sólo como casos de test (`src/data/__tests__/terCatalogoPP.test.ts`, `src/services/__tests__/planesPensionesService.resolveTerPlan.test.ts`).

---

## 3 · Fuentes de datos · qué consume la ficha PP

### 3.1 · Servicios

`FichaPlanPensiones.tsx:13-43` ·

| Servicio | Responsabilidad |
|---|---|
| `aportacionesPlanService` | CRUD aportaciones · `getAportacionesPorPlan(planId)` |
| `planesPensionesService` (`getPlan`, `updatePlan`) + `resolveTerPlan` + `calcularTotalAportadoPlan` | Lectura/escritura del plan + hidratación de valor actual + resolución del TER |
| `traspasosPlanPensionesService` + `valorTraspasoNormalizado` | Traspasos para la trayectoria |
| `limitesFiscalesPlanesService.calcularReduccionBaseImponible` | Agregado fiscal del hogar (Bug #4 origen del 1.145,76€) |
| `rentabilidadPlanService` (`getRentabilidadTotal`, `getRentabilidadPorBloque`) | TWR/MWR y bloques por gestora |
| `fiscalContextService.getFiscalContextSafe` | Sólo para gating · ¿hay CCAA + ingresos? |
| `estimacionFiscalEnCurso.calcularEstimacionEnCurso` | `baseImponibleGeneral` → tramos → marginal IRPF |
| `valoracionesService` (`getEvolucionActivo`, `guardarValoracionActivo`) | SSoT temporal post-T-VALORACIONES |
| `BloqueProyeccion` deps · `proyeccionActivoService`, `benchmarksReferenciaService`, `escenariosService`, `personalDataService` | Cálculo de la proyección + benchmark de referencia |

### 3.2 · Hooks custom

Sólo hooks estándar (`useCallback`, `useEffect`, `useMemo`, `useId`, `useState`). En el árbol completo (incluidos los Bloques) sólo añade ·

- `useAvisoCerrable` (`src/modules/inversiones/components/bloques/useAvisoCerrable.ts`) · estado persistente de banner cerrado.

### 3.3 · Stores IndexedDB leídos directamente

- **Cero acceso directo a `db.*`** desde `FichaPlanPensiones.tsx` salvo en el handler de `onSavePlan` del modal `AportarModal` (`L1494-1499`), que crea `movements` + `treasuryEvents` para el camino doble de la aportación (tesorería + plan). Todo lo demás pasa por servicios.

### 3.4 · Cableado con `valoracionesActivos` (post T-VALORACIONES)

`FichaPlanPensiones.tsx:357-367` ·

```ts
return (await valoracionesService.getEvolucionActivo(
  'plan_pensiones',
  planId as unknown as number,
)) as ValoracionHistorica[];
```

Y `planesPensionesService.getPlan()` hidrata internamente `valorActual` desde `valoracionesService.getMapValoracionesMasRecientes('plan_pensiones')` (`planesPensionesService.ts:106-107`). El valor actual del plan ya es **canónico desde `valoracionesActivos`**.

`L1417-1423` · al guardar valoración nueva ·
```ts
await valoracionesService.guardarValoracionActivo(fechaMes, {
  tipo_activo: 'plan_pensiones',
  activo_id: plan.id as unknown as number,
  activo_nombre: plan.nombre,
  valor,
});
```

### 3.5 · Cableado con `ejerciciosFiscalesCoord`

**Cero referencias** a `ejerciciosFiscalesCoord` o `declaracionCompleta` en `FichaPlanPensiones.tsx` ni en `components/bloques/`. La sección fiscal NO bebe del coord canónico, sino de cálculos en vivo (ver §7).

### 3.6 · Cableado con `aportacionesPlan`

`FichaPlanPensiones.tsx:354` · `aportacionesPlanService.getAportacionesPorPlan(planId)` devuelve un array plano · luego en el componente ·

- `L449-460` · sumas por rol para `aportadoTotal/Titular/Empresa` (incluye cónyuge).
- `L477-494` · `sparklineData` agrupa por mes y acumula.
- `L585-600` · filtra `aportacionesPostInicial` (Bug #6 ya resuelto).
- `L606-614` · agrupa por ejercicio para el "Primera aportación" en Trayectoria.

### 3.7 · Cableado con `benchmarksReferencia`

Sólo dentro de `BloqueProyeccion` y `BloqueBenchmark` · `BloqueProyeccion.tsx:113` ·
```ts
listBenchmarks().catch(() => [] as BenchmarkReferencia[])
```
La elección del benchmark se hace por `pickBenchmarkParaPolitica(benchmarks, politicaInversion)` (`BloqueProyeccion.tsx:53-77`) · matching simple política → códigos · MSCI_WORLD_EUR / SP500_EUR / BONDS_AGG_EUR. Sin cableado en `FichaPlanPensiones.tsx` directo.

---

## 4 · Secciones renderizadas · orden, nombre exacto, datos

### 4.1 · Lista ordenada (top → bottom)

```
1. Hero (FichaShell)                       ─ "Plan Orange BBVA" + KPIs · L724-836
2. P1 · Proyección                         ─ <BloqueProyeccion>            · L840-862
3. P2 · Benchmark                          ─ <BloqueBenchmark>             · L865-871
4. P3 · Comisiones                         ─ <BloqueCostes>                · L874-898 (en IIFE post-#1383)
5. P4 · Hitos vivos                        ─ <BloqueHitos>                 · L901-905
6. P5 · Sandbox interactivo                ─ <BloqueSandbox>               · L908-921
7. <details> "Detalle fiscal y aportaciones"                              · L928-1442
     7.1 · Evolución del valor (SVG inline)                                · L934-964
     7.2 · Estructura de aportación (PPE/PPES only)                        · L972-998
     7.3 · Ventaja fiscal · campaña 2026                                   · L1000-1067
     7.4 · Datos fiscales · ejercicio 2026 (este plan / hogar / rescate)   · L1070-1172
     7.5 · Composición (placeholder)                                       · L1182-1192
     7.6 · Datos del plan (tipo, gestora, ISIN, fecha, estado)             · L1194-1219
     7.7 · Trayectoria · rentabilidad por bloque (tabla TWR)               · L1225-1326
     7.8 · Trayectoria del plan (timeline)                                 · L1329-1369
     7.9 · Aportaciones · histórico (CONDICIONAL ≥2 post-inicial)          · L1372-1410
```

### 4.2 · Bloques que la spec de pulido toca

#### 4.2.1 · Sección "Comisiones" (Bug #1)

- Sección dedicada · `<BloqueCostes>` montado en `FichaPlanPensiones.tsx:874-898`.
- **No hay `<KpiCard>`** · usa `styles.mini` en `BloqueCostes.tsx:179-217`.
- TER **no es hardcoded**. El valor llega resuelto vía IIFE ·
  ```tsx
  const { ter, fuente, catalogoEntry } = resolveTerPlan(plan);
  ```
  (`FichaPlanPensiones.tsx:878`). Prioridad · `terOverride` (manual) > catálogo curado > `null`.
- El botón **"Buscar plan con TER menor →" ya NO existe** (Bug #2 cerrado en #1383). Existe en su lugar ·
  - Si `ter != null` · botón "¿No coincide con tu cuadro de comisiones? · editar TER" (`BloqueCostes.tsx:241-250`).
  - Si `ter == null` · botón "Añadir TER manualmente" (`L258-265`).

#### 4.2.2 · Sección "Proyección" (Bugs #3 y #5)

- Es **una sola gráfica** (`SerieMiniSparkline` inline en `BloqueProyeccion.tsx:303-394`). El "toggle" (`role="group"`) en `L246-273` cambia el escenario (`actual` / `benchmark` / `maxAportacion`), pero **renderiza la misma curva** con los puntos del escenario activo.
- Library · **SVG inline custom · NO usa recharts** aunque `recharts ^3.1.2` está instalado. Hipótesis H3 es **FALSA**.
- Toggle states (literales) · `"Escenario actual"` / `"Si cambias gestora"` / `"Si aportas el máximo"` (`L259-273`).
- **YAxis** · no existe componente. Es SVG plano con dominio Y dinámico calculado en `BloqueProyeccion.tsx:317-322` (post-#1383) ·
  ```ts
  const dataMin = Math.min(...ys);
  const dataMax = Math.max(...ys);
  const spread = Math.max(1, dataMax - dataMin);
  const minY = Math.max(0, dataMin - spread * 0.05);
  const maxY = dataMax + spread * 0.05;
  ```
- **XAxis** · ticks anuales con paso 1/2/5 años según span (`L324-329`).
- **Origen del "+451 k€"** · `BloqueProyeccion.tsx:279-294` (Mini "Si cambias gestora") · `view.data.diferenciaConBenchmark` calculado en `proyeccionActivoService.ts:304-306` como `escenarioConBenchmark.valorFinal - valorFinalNominal`. Es decir, **diferencia entre proyectar con TWR del benchmark vs proyectar con TWR del usuario · NO compara TER alguno**.

#### 4.2.3 · Sección "Ventaja fiscal · campaña 2026" (Bug #4)

- Bloque "Ventaja fiscal · campaña 2026" (`L1003-1067`) muestra ·
  - Tipo marginal IRPF · `(marginalIrpf * 100).toFixed(0) %` · post-#1383 etiquetas anclan "· este plan ·".
  - Límite anual · `getLimiteAnual(tipoAdministrativo)` (1.500€ o 10.000€).
  - **"Reducción base IRPF · este plan · 2026"** · `reduccionBase` calculado en `useMemo` en `L498-518` · sólo aportaciones del titular a ESTE plan, capadas por límite titular del tipo.
  - **"Ahorrado en cuota · este plan"** · `reduccionBase × marginalIrpf`.
  - Pie informativo · "Sin aportaciones registradas a este plan en 2026. Si hay aportaciones a otros planes de tu hogar, aparecen abajo en 'Datos fiscales · Tu hogar'." (post-#1383).
- Bloque separado **"Datos fiscales · ejercicio 2026"** (`L1070-1172`) contiene 3 sub-bloques claramente etiquetados ·
  - **"Este plan"** (`L1077-1101`) · usa `fiscalPlan` (`useMemo` en `L523-559`) · aportaciones del año a este plan, capadas por límites del tipo.
  - **"Tu hogar · todos los planes de pensiones declarados"** (`L1103-1126`) · usa `reduccionHogar`, que viene de `limitesFiscalesPlanesService.calcularReduccionBaseImponible(plan.personalDataId, ejercicio)`. **De aquí sale el 1.145,76€** · ver §7.
  - **"Al rescatar"** (`L1128-1151`) · cota superior estimada (valor × marginal).
- La contradicción visual ya está **resuelta etiquetando**, no separando completamente los bloques. La lógica de cálculo no se tocó.

#### 4.2.4 · Sección "Aportaciones · histórico" (Bug #6)

- `L1372-1410` · sección **condicional** post-#1383 ·
  ```ts
  const mostrarTablaAportaciones = aportacionesPostInicial.length >= 2;
  ```
  (`FichaPlanPensiones.tsx:602`).
- Filtro de "aportación inicial" en `L584-601` ·
  - Igual fecha que `plan.fechaContratacion` **Y**
  - `Math.abs(total - importeInicial) ≤ 0.01`
- Si NO se cumplen ambas, la aportación cuenta como real y entra a la tabla.
- Las dos filas que veía Jose (31/12/2017 y 27/12/2016) hoy ·
  - 27/12/2016 (importe = `importeInicial`) **queda oculta**.
  - 31/12/2017 sigue siendo única → `aportacionesPostInicial.length = 1` → **tabla oculta**.
  - Resultado · la sección ya no se renderiza en el caso de Jose.

#### 4.2.5 · Sección "Trayectoria del plan"

- Sí existe · "Trayectoria del plan" en `L1329-1369`.
- Render · `<table>` tabular (no timeline visual con dots) con columnas Fecha / Evento / Detalle, agrupada por año vía cabeceras de año intercaladas (`L1339-1356`).
- Eventos generados en `useMemo` (`L607-690`) ·
  1. **Contratación** · `"Plan abierto en {gestoraInicial}"` + detalle `"Valor inicial · {fmt(importeInicial)}"` si > 0.
  2. **Primera aportación** · sólo si su fecha ≠ contratación · agrega TODAS las aportaciones del primer ejercicio con desglose titular/empresa/cónyuge.
  3. **Cada traspaso** (orden ascendente) · `"Traspaso total/parcial · {origen} → {destino}"`.
  4. **Última valoración** · sólo si su fecha ≠ último evento.
- El "27/12/2016 · Plan abierto en ING · 36.825€" del plan de Jose sigue visible aquí · evento de contratación.
- **No hay duplicidad** post-#1383 · la "Aportaciones · histórico" oculta la inicial y la sección de Trayectoria sigue mostrando el hito de apertura.

---

## 5 · Gráficas · library, configuración, sub-vistas

### 5.1 · Library

- **NO se usa recharts ni chart.js en el árbol de la ficha PP**, a pesar de que ambas están en `package.json` (`"recharts": "^3.1.2"`, `"chart.js": "^4.5.1"`).
- Todas las gráficas de la ficha son **SVG custom inline** ·
  - `SparklineDoble` (`FichaPlanPensiones.tsx:225-306`) · 2 líneas (valor vs aportado) sobre `viewBox 0 0 800 220`. Histórico real.
  - `SerieMiniSparkline` (`BloqueProyeccion.tsx:303-394`) · 1 línea + área + ejes Y/X custom. Proyección futura.
  - Barras horizontales en `BloqueBenchmark` (no auditadas en detalle, fuera de los 6 bugs).

### 5.2 · Configuración eje Y · post-#1383

`BloqueProyeccion.tsx:317-322` ·

```ts
const dataMin = Math.min(...ys);
const dataMax = Math.max(...ys);
const spread = Math.max(1, dataMax - dataMin);
const minY = Math.max(0, dataMin - spread * 0.05);  // ±5 % de holgura
const maxY = dataMax + spread * 0.05;
```

Más 3 ticks horizontales con etiquetas en € (min, medio, max) — `L341-371`.

Para `SparklineDoble` (histórico) · `FichaPlanPensiones.tsx:236-237` usa `Math.min(...allVals)` y `Math.max(...allVals)` sin clamp a 0 · ya está bien.

### 5.3 · Configuración eje X · post-#1383

`BloqueProyeccion.tsx:325-329` ·

```ts
const yearSpan = maxX - minX;
const tickStep = yearSpan <= 5 ? 1 : yearSpan <= 12 ? 2 : 5;
const ticksX: number[] = [];
for (let y = minX; y <= maxX; y += tickStep) ticksX.push(y);
if (ticksX[ticksX.length - 1] !== maxX) ticksX.push(maxX);
```

Y los `<text>` en `L376-388`. Para `SparklineDoble` el eje X no se renderiza explícitamente (sólo línea, sin labels).

### 5.4 · Helper `generarTicksAnuales`

- **No existe** como helper exportado ni en `src/modules/inversiones/` ni en `src/utils/`. La lógica de ticks anuales vive **inline dentro de `SerieMiniSparkline`** (`BloqueProyeccion.tsx:325-329`).

### 5.5 · Datos que alimentan cada gráfica

- **`SparklineDoble`** (histórico) · `sparklineData` en `FichaPlanPensiones.tsx:478-495` · cruza `valoraciones` (de `valoracionesService`) con aportaciones acumuladas por mes.
- **`SerieMiniSparkline`** (proyección) · `escenarioActivo.puntos` de `proyeccionActivoService.proyectarInversion` (`BloqueProyeccion.tsx:163-167`). El escenario activo viene del toggle de UI (`actual/benchmark/maxAportacion`).
- **Barras `BloqueBenchmark`** · datos de `benchmarksReferenciaService` agrupados localmente (no auditado en profundidad — fuera de los 6 bugs).

---

## 6 · TER · estado actual completo

### 6.1 · Hardcoded 1,50 %

- **Eliminado en #1383**. `grep -RIn "0\.015\|1\.50" src/modules/inversiones/` no devuelve más TER hardcoded (los matches de `1.50` que quedan son del límite fiscal 1.500€, distinta unidad).
- El antiguo `ter={0.015 /* TODO ... */}` en `FichaPlanPensiones.tsx` (era L880 pre-#1383) está sustituido por la IIFE `resolveTerPlan(plan)` en L876-898.

### 6.2 · Catálogo curado

`src/data/terCatalogoPP.ts` · 199 LOC creado en #1383. Contenido ·

- 9 entradas iniciales · myinvestor (Indexado S&P 500 0,43% + Indexado Global 0,43%), Indexa (0,50%), BBVA (Plan Orange 1,50%, Plan Quality 1,50%), ING (1,25%), Finizens (0,61%), Mapfre (1,40%), Bestinver (1,75%).
- Funciones · `lookupTerCatalogo(gestoraId, planSlug)`, `lookupTerCatalogoFromNames(gestoraNombre, planNombre)` (loose · normaliza primero), `normalizeGestoraSlug`/`normalizePlanSlug` (lowercase + NFD + strip diacríticos + slug).
- Tabla auxiliar `TER_MEDIA_MERCADO` con medias por tipo (PPI 1.1, PPE 1.35, PPES 0.8, PPA 1.2) — **no se renderiza aún en UI**.

### 6.3 · Resolver

`src/services/planesPensionesService.ts:53-86` · `resolveTerPlan(plan)` ·

```ts
1. plan.terOverride numérico ≥ 0  → { ter, fuente: 'manual' }
2. lookupTerCatalogoFromNames(gestoraActual, nombre) match
                                 → { ter, fuente: 'catalogo', catalogoEntry }
3. fallback                       → { ter: null, fuente: 'desconocido' }
```

### 6.4 · Funciones de cálculo de comisiones acumuladas

Dentro de `BloqueCostes.tsx:88-117` (post-#1383) ·

- `comisionesAcumuladas` = `terDec × saldoMedioAnual × anosTranscurridos`
- `comisionesFuturas` = `terDec × saldoMedioProyectado × anosHastaRescate`
- `ahorroHipotetico` = `max(0, comisionesFuturas - terObjetivoDec × saldoMedioProyectado × anosHastaRescate)`

Los inputs vienen calculados en `FichaPlanPensiones.tsx:885-897` ·
- `saldoMedioAnual` = `(valorActual + aportadoTotal) / 2`
- `anosTranscurridos` = `Date.now() - new Date(fechaPrimeraAportacion).getTime()` en años
- `anosHastaRescate` = **23 hardcoded** (TODO · pendiente PR4 follow-up · derivar de personal + escenario)
- `saldoMedioProyectado` = `max(valorActual, 1) × 1.5`

### 6.5 · Override manual

`PlanPensiones.terOverride?: number` añadido en #1383 (`src/types/planesPensiones.ts:67-71`).

- Edición vía `EditorTerModal` (`src/modules/inversiones/components/modal/EditorTerModal.tsx`, 153 LOC) · botón "Volver al catálogo" limpia el override.
- Persistencia · `planesPensionesService.updatePlan(planId, { terOverride })` (`FichaPlanPensiones.tsx:1592-1597`).
- Sin DB bump · IndexedDB schemaless tolera campos opcionales nuevos · DB sigue v75.

---

## 7 · El 1.145,76€ · trazado completo

### 7.1 · Origen

**HIPÓTESIS H4 FALSA** · NO viene de `ejerciciosFiscalesCoord[2026].aeat.declaracionCompleta.planPensiones`. Viene de un **cálculo en vivo** sobre el store `aportacionesPlan`.

Cadena ·

1. `FichaPlanPensiones.tsx:392-399` · al cargar el plan, si `plan.personalDataId` existe ·
   ```ts
   const r = await limitesFiscalesPlanesService.calcularReduccionBaseImponible(
     p.personalDataId,
     new Date().getFullYear(),
   );
   setReduccionHogar(r);
   ```
2. `limitesFiscalesPlanesService.ts:258-376` · `calcularReduccionBaseImponible(personalDataId, ejercicio)` ·
   - `db.getAll('planesPensiones')` → filtra por `personalDataId`.
   - Para cada plan del hogar · `aportacionesPlanService.getTotalesPorAño(plan.id, ejercicio)`.
   - Aplica cap por rol (titular/empresa) y por tipo · `getLimitesPorTipo()`.
   - Suma a `totalDeducibleBruto`.
   - Aplica tope 30 % rendimientos netos (de `getRendimientosNetosAprox(personalDataId, ejercicio)`).
   - Devuelve `{ totalDeducibleAplicado, excesoArrastrable, alertas, ... }`.
3. Render en `FichaPlanPensiones.tsx:1117-1118` ·
   ```tsx
   <span>{fmt(reduccionHogar.totalDeducibleAplicado)}</span>
   ```

El número **1.145,76 €** sale, por tanto, de · agregar **aportaciones reales registradas** en `aportacionesPlan` para todos los planes del `personalDataId=Jose` en 2026, aplicar caps y tope 30%. La fuente AEAT sólo entra si esas aportaciones se importaron del XML (con `origen='xml_aeat'`); pero el dato final es **derivado**, no leído del coord.

### 7.2 · "Este plan" vs "Tu hogar"

Distinción **sí existe** en código ·

- **`fiscalPlan`** (`FichaPlanPensiones.tsx:523-559`) · sólo aportaciones a `planId` actual, con caps del tipo del plan. Renderiza el bloque "Este plan".
- **`reduccionHogar`** (`limitesFiscalesPlanesService.calcularReduccionBaseImponible`) · agregado de TODOS los planes del titular. Renderiza el bloque "Tu hogar".
- **`reduccionBase`** (`L498-518`) · derivado más simple, sólo aportaciones del titular a este plan, capadas por límite titular. Renderiza el ítem "Reducción base IRPF · este plan · 2026".

Tres niveles de cálculo coexisten · la separación visual post-#1383 ya cumple la spec sin necesidad de añadir lógica nueva.

### 7.3 · Tipo marginal IRPF (45%)

`FichaPlanPensiones.tsx:75-89` · constante `TRAMOS_MARGINAL` (tarifas IRPF 2024+) ·

```ts
const TRAMOS_MARGINAL = [
  { hasta: 12_450, tipo: 0.19 },
  { hasta: 20_200, tipo: 0.24 },
  { hasta: 35_200, tipo: 0.30 },
  { hasta: 60_000, tipo: 0.37 },
  { hasta: 300_000, tipo: 0.45 },
  { hasta: Infinity, tipo: 0.47 },
];
function getTipoMarginal(base) { ... }
```

El "45 %" sale de · `calcularEstimacionEnCurso() → resultadoEstimado.baseImponibleGeneral` → `getTipoMarginal()` → tramo 5 (base entre 60.000€ y 300.000€).

NO es campo del plan, NO es constante hardcoded, NO sale del coord · es derivado del IRPF estimado del usuario.

---

## 8 · Aportaciones · diferenciar inicial vs posterior

### 8.1 · Lectura

`aportacionesPlanService.getAportacionesPorPlan(planId)` devuelve `AportacionPlan[]` sin ordenar; el componente ordena cuando lo necesita (`L466` para fecha primera, `L606` para timeline).

### 8.2 · Flag `esInicialDelPlan`

**NO existe** como flag en el schema (`AportacionPlan` `src/types/planesPensiones.ts:74-99`). La spec original especulaba con un flag explícito; la realidad es opción **B (lógica de detección)**.

### 8.3 · Detección actual

`FichaPlanPensiones.tsx:585-601` (post-#1383) ·

```ts
const aportacionesPostInicial = useMemo(() => {
  if (!plan) return aportaciones;
  return aportaciones.filter((a) => {
    if (a.fecha !== plan.fechaContratacion) return true;
    const total = (a.importeTitular ?? 0) + (a.importeEmpresa ?? 0) + (a.importeConyuge ?? 0);
    const inicial = plan.importeInicial ?? 0;
    return Math.abs(total - inicial) > 0.01;
  });
}, [aportaciones, plan]);
```

Es decir · una aportación se considera "inicial" cuando ·

- Su `fecha` coincide con `plan.fechaContratacion` **Y**
- Su importe total cuadra (±1 céntimo) con `plan.importeInicial`.

Si NO se cumple alguna condición, la aportación es "real" y entra en `aportacionesPostInicial`. La tabla sólo se muestra si `aportacionesPostInicial.length >= 2`.

---

## 9 · Tests existentes

### 9.1 · Tests del componente

- `src/modules/inversiones/pages/__tests__/FichaPlanPensiones.helpers.test.ts` · **88 LOC** · cubre helpers exportados (`getFechaMinimaRescate` y similares). **NO test de render** del componente completo.

### 9.2 · Tests de servicios y data relacionados

| Path | LOC | Cobertura |
|---|---|---|
| `src/services/__tests__/planesPensionesService.hydrateValorActualPR7a.test.ts` | — | Hidratación de `valorActual` desde `valoracionesActivos` (T-VALORACIONES) |
| `src/services/__tests__/planesPensionesService.persistir5Campos.test.ts` | — | Persistencia de campos del schema |
| `src/services/__tests__/planesPensionesService.resolveTerPlan.test.ts` | — | **#1383** · prioridades override > catálogo > null + normalización |
| `src/services/__tests__/traspasosPlanPensionesService.test.ts` | — | Traspasos |
| `src/services/__tests__/aeatPlanesPensionesImportService.test.ts` | — | Importación XML AEAT |
| `src/data/__tests__/terCatalogoPP.test.ts` | — | **#1383** · catálogo + slug + lookup |
| `src/modules/inversiones/components/bloques/__tests__/BloqueCostes.test.tsx` | — | **#1383** · ausencia del botón, ter null, fuente, CTA |
| `src/modules/inversiones/components/bloques/__tests__/BloqueProyeccion.test.tsx` | — | Pre-#1383 · selección de benchmark |
| `src/modules/inversiones/components/bloques/__tests__/tipoPlanCopy.test.ts` | — | Copy tipo-aware |

### 9.3 · Snapshots

**Cero snapshots** de ficha PP. No hay carpeta `__snapshots__` ni en `pages/` ni en `components/bloques/`. Toda la cobertura es unit + RTL puro.

### 9.4 · Baseline rojo

No ejecutado el test runner completo en esta auditoría (PR0 es read-only). Los tests específicos de la ficha PP **pasan tras #1383** (verificado pre-merge). Confianza alta de que el baseline sigue verde.

---

## 10 · Validación de hipótesis

| ID | Hipótesis (resumen) | Estado | Realidad si difiere | Impacto en spec pulido |
|---|---|---|---|---|
| **H1** | Path `src/modules/inversiones/pages/FichaPlanPensiones.tsx` | ✅ CONFIRMADA | 1641 LOC · function component monolítico delegando a 5 Bloques | Ninguno |
| **H2** | TER hardcoded a 1,50% | ❌ FALSA · **resuelta por #1383** | Sustituido por `resolveTerPlan(plan)` (override > catálogo > null). El antiguo `ter={0.015}` ya no existe | **Bug #1 cerrado** · sección §1 de T-FICHA-PP-PULIDO ya no aplica; queda sólo (a) ampliar catálogo, (b) reintroducir match por `terMediaMercado` si se quiere fallback estadístico |
| **H3** | Gráfica usa recharts `<YAxis domain={[0,'auto']}>` | ❌ FALSA · **resuelta por #1383** | SVG inline custom · sin recharts. Eje Y dinámico (`Math.max(0, dataMin − 5%)` ... `dataMax + 5%`) ya implementado en `BloqueProyeccion.tsx:317-322`. Eje X con ticks anuales paso 1/2/5 | **Bug #3 cerrado** · sección §3 de T-FICHA-PP-PULIDO obsoleta. Si se quisiera unificar con recharts en futuro, sería refactor separado, no parte del pulido |
| **H4** | 1.145,76€ viene de `ejerciciosFiscalesCoord[2026].aeat.declaracionCompleta.planPensiones` | ❌ FALSA | Viene de `limitesFiscalesPlanesService.calcularReduccionBaseImponible(personalDataId, año)` que itera planes del hogar y aplica caps · **cálculo en vivo desde `aportacionesPlan`** | **Mantener** · #1383 etiquetó pero no separó cálculos. Si se quiere "subdivisión limpia" tipo Bloque A vs B vs C (spec §4.2.1/4.2.2), basta con mejorar copy más; no requiere mover datos al coord |
| **H5** | "+451 k€" se calcula con TER objetivo hipotético | ❌ FALSA · **clarificada por #1383** | Es la diferencia entre proyectar con TWR del **benchmark** vs TWR del usuario · NO compara TERs. El subtítulo post-#1383 ya dice "vs continuar con tu TWR histórico (X %)" | **Bug #5 cerrado** copy-wise. Si se quiere KPI adicional "ahorro real si bajas TER", hay que añadirlo a `proyeccionActivoService` con TER como parámetro — fuera del scope original |
| **H6** | "Aportaciones histórico" se muestra siempre | ❌ FALSA · **resuelta por #1383** | Hoy condicional (`aportacionesPostInicial.length >= 2`). Caso de Jose · tabla oculta | **Bug #6 cerrado** · sección §6 obsoleta |
| **H7** | `PlanPensiones` no tiene `terOverride/gestoraId/planSlug` | ⚠️ PARCIAL · **terOverride añadido por #1383** | `terOverride?: number` ya existe. `gestoraId/planSlug` **NO existen ni hacen falta** · el matching se hace por normalización runtime de `gestoraActual`+`nombre`. Decisión #1383 · evitar DB bump | **Mantener** decisión #1383 · catálogo sin slug en plan, matching loose. Si en futuro se quiere alta de plan con `gestoraId/planSlug` explícitos (UX más limpia), sería sub-tarea distinta |
| **H8** | Plan Orange BBVA + Indexado myinvestor son seeds | ❌ FALSA | No hay seed canónica · sólo fixtures en tests. Datos reales vienen de importación AEAT o alta manual del wizard | Documentar en la próxima spec que para tests E2E hay que crear fixtures explícitas |
| **H9** | Sección "Trayectoria del plan" existe | ✅ CONFIRMADA | `L1329-1369` · tabla agrupada por año con contratación + primera aportación + traspasos + última valoración. Sin duplicidad post-#1383 | Ninguno |
| **H10** | `valorActual` viene de `valoracionesService` | ✅ CONFIRMADA | Hidratación upstream en `planesPensionesService.getPlan()` (`L106-107`) + sparkline histórico vía `getEvolucionActivo`. Cierra T-VALORACIONES | Ninguno |

**Resumen ·** 5 hipótesis cerradas por #1383 (H2, H3, H5, H6, parcialmente H7) · 2 confirmadas (H1, H9, H10) · 2 falsas estructurales (H4 origen del 1.145,76€ · H8 seeds inexistentes).

---

## 11 · 🔴 Hallazgos inesperados

### 11.1 · `anosHastaRescate = 23` hardcoded

`FichaPlanPensiones.tsx:895` · valor de `anosHastaRescate` que recibe `BloqueCostes` y `BloqueSandbox` está hardcodeado a `23` con un `TODO · derivar de personal+escenario · PR 4 follow-up`. Lo mismo en `L911` para `anosDefault`. Esto compromete la cifra "Proyectado hasta rescate" y el "Ahorro hipotético" del bloque Comisiones para usuarios cuya edad real difiere del supuesto. **No estaba listado en los 6 bugs**.

### 11.2 · `saldoMedioProyectado = max(valorActual, 1) × 1.5` hardcoded

`FichaPlanPensiones.tsx:897` · usa multiplicador fijo 1.5 sobre el valor actual para estimar el saldo medio futuro. Trivial · realista sólo en casos limitados.

### 11.3 · Lazy import duplicado de `planesPensionesService`

`FichaPlanPensiones.tsx:16` importa `planesPensionesService` directo. `L348` vuelve a hacerlo dinámicamente dentro de `load()`. Es ruido · no daña, pero confunde.

### 11.4 · `valoracionesService` se importa dinámicamente dentro del `Promise.all`

`L358-365` · `await import('../../../services/valoracionesService')` cada vez que se llama a `load()`. Ya está importado estáticamente en `L42`. Igual al punto anterior · ruido sin daño.

### 11.5 · `BloqueBenchmark` no auditado

`BloqueBenchmark` (228 LOC) no es parte de los 6 bugs pero renderiza barras de TWR vs benchmarks. Sin auditoría dedicada, pueden existir bugs análogos (escala mal, comparación confusa). Recomendable PR0 mini cuando se aborde.

### 11.6 · Banner "coste-cambio-gestora-cta" sigue vivo aunque el botón se eliminó

`BloqueCostes.tsx:121-122` mantiene el aviso cerrable `coste-cambio-gestora-cta`. El texto del banner referencia "Cambiando a un plan con TER 0,5 %" (`tipoPlanCopy.ts` line del template) pero como ya no hay botón, el copy queda algo descolgado · revisable.

### 11.7 · TER_MEDIA_MERCADO sin uso

`TER_MEDIA_MERCADO` (catálogo §6.2) está exportada pero ningún componente la consume. Existe en el cero pero no renderiza. Si la intención era mostrar "tu TER (X%) vs media del mercado (Y%)" como prometía la spec original, el cableado quedó pendiente.

### 11.8 · Tests sin snapshot ni render integrado

`FichaPlanPensiones.helpers.test.ts` cubre sólo helpers puros. **No hay test de render** que monte `<FichaPlanPensiones>` y verifique las secciones · por eso los pulidos visuales no tienen red de seguridad. Si se vuelve a tocar la ficha, conviene añadir al menos un test smoke con `mock-jest` de servicios.

### 11.9 · Tooltip `title` del Mini "Si cambias gestora" sólo en navegador con mouse

`BloqueProyeccion.tsx:384` usa `<div title={detail}>` para exponer la explicación larga. En móvil (touch) no se ve · si Bug #5 quiere transmitir el modelo subyacente claramente, conviene un popover persistente o un detail expandible.

---

## 12 · Recomendaciones de ajuste a `TAREA-CC-T-FICHA-PP-PULIDO v1`

Con #1383 ya mergeado, la spec original pierde la mitad del scope. Recomendación · **NO entregar T-FICHA-PP-PULIDO v1 tal cual**. Tres opciones ·

### 12.1 · Opción A · descartar T-FICHA-PP-PULIDO v1
Cerrar la spec por superseded · los 6 bugs originales están resueltos. Abrir tickets nuevos en función de los hallazgos §11 si Jose decide que valen la pena.

### 12.2 · Opción B · reducir T-FICHA-PP-PULIDO v1 a "Bug #1 follow-up"
Mantener sólo lo que #1383 dejó como deuda ·
- **(1)** Mostrar **TER_MEDIA_MERCADO** como comparativa visible (catálogo ya lo expone, falta el componente).
- **(2)** Derivar `anosHastaRescate` y `saldoMedioProyectado` desde `personalData` + escenario activo, sustituyendo los hardcodes 23 y `×1.5` (`§11.1` y `§11.2`).
- **(3)** Ampliar catálogo con más entradas (CaixaBank, Santander, Sabadell, Kutxabank).

### 12.3 · Opción C · mantener T-FICHA-PP-PULIDO v1 pero reescrita
Sólo si Jose detecta visualmente que algún bug NO está plenamente cerrado (ej. la separación "este plan / tu hogar" todavía se percibe como contradicción). Aplicar las recomendaciones de §11.4-11.6 + revisar copy. Esta opción requiere captura de pantalla del estado post-#1383 para confirmar persistencia del bug.

**Recomendación CC · Opción B**. Es el menor coste de coordinación y captura la deuda residual visible.

---

## 13 · Apéndice · comandos grep clave

```bash
# Localización del componente
grep -RIln "FichaPlanPensiones" src/ --include="*.tsx" --include="*.ts"
#  → src/modules/inversiones/pages/FichaPlanPensiones.tsx (principal)
#  → src/modules/inversiones/pages/FichaPosicionPage.tsx (dispatcher)
#  → src/modules/inversiones/components/bloques/BloqueSandbox.tsx (comment)

# TER hardcoded — ya no existe
grep -RIn "0\.015" src/modules/inversiones/  # → 0 matches
grep -RIn "1\.50\|1,50" src/modules/inversiones/  # → sólo límites fiscales 1.500€

# Origen del 1.145,76€
grep -RIn "totalDeducibleAplicado" src/services/limitesFiscalesPlanesService.ts
#  → L342, L344, L352, L364
grep -RIn "ejerciciosFiscalesCoord" src/modules/inversiones/pages/FichaPlanPensiones.tsx src/modules/inversiones/components/bloques/
#  → 0 matches (H4 falsa)

# Recharts en la ficha
grep -RIn "from 'recharts'" src/modules/inversiones/  # → 0 matches (H3 falsa)

# Edge cases ya cubiertos
grep -n "aportacionesPostInicial" src/modules/inversiones/pages/FichaPlanPensiones.tsx
#  → L585-602 (filtro inicial + condicional ≥ 2)
grep -n "resolveTerPlan" src/services/planesPensionesService.ts src/modules/inversiones/pages/FichaPlanPensiones.tsx
#  → service L53-86, página L876-898

# Sin seed canónica
grep -RIn "myinvestor\|Plan Orange" src/services/migrations/ src/data/seeds/ src/__fixtures__/ 2>/dev/null
#  → sólo en tests (no seed productiva)
```

---

## FIN AUDIT FICHA PP v1
