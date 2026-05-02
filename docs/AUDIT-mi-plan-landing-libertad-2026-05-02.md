# AUDITORÍA · Mi Plan landing + Libertad financiera + Simulador escenarios

> Fecha · 2026-05-02
> Repo · `gomezrjoseantonio-bot/ultimointento` · branch base `main` · post-T27.3 mergeada · pre-T27.4
> NO modifica código · solo lectura

---

## 0 · Síntomas observados

Tras T27.1 (objetivos) y T27.3 (fondos) cerrados queda pendiente la pieza grande del módulo Mi Plan · simulador de escenarios + landing con brújula.

Síntomas en producción:

- Landing Mi Plan · KPI estrella libertad muestra placeholder · "año libertad financiera" sin valor real (handoff V8 §8.1)
- Página Libertad financiera · estado desconocido pre-auditoría
- Simulador de escenarios · sin evidencia clara en backlog de si está construido
- Brújula Panel V5 (T22.6) muestra `añoLibertad = "—"` y `metaInmuebles = null` con TODO inline

El mockup canónico (`docs/audit-inputs/atlas-mi-plan-v2.html`) muestra alcance esperado:

- Landing con hero libertad (fecha + 54 % progreso) · gráfica histórica 2020 → 2031 · grid 4 submódulos
- Página Libertad financiera con simulador · 5 sliders reactivos · gráfica plan base vs escenario · 4 escenarios guardados pre-definidos
- Página Proyección de caja con tabla mes a mes navegable

---

## 1 · Landing Mi Plan

### Componente

- **Path canónico** · `src/modules/mi-plan/pages/LandingPage.tsx` (234 líneas)
- **Wrapper / shell** · `src/modules/mi-plan/MiPlanPage.tsx` (151 líneas) · provee tabs + outlet context
- **Routing** · `src/App.tsx:890-919` lo cuelga en `/mi-plan` (index)
- **NO se han localizado dos versiones (legacy + V5)** · el módulo `src/modules/horizon/mi-plan/` existe en disco como carpeta vacía/inexistente · no hay landing legacy duplicada

### Renderizado actual

| Elemento mockup | Estado | Detalle |
|---|---|---|
| Hero libertad (fecha + % progreso) | 🟡 Parcial | Renderiza `HeroBanner` de design-system v5 con texto narrativo basado en **balance anual proyectado** (entradas − gastos), NO con "año libertad" ni "% progreso a libertad". Stats del hero · meses positivos / meses pérdida / objetivos activos / fondos activos. CTA · "Abrir Proyección" |
| Gráfica histórica 2020→2031 | ❌ No existe | NO hay gráfica histórica en la landing. El mockup muestra una curva 2020→2031 que no está implementada en ningún sitio |
| Grid 4 submódulos | 🟡 Parcial | Renderiza grid de **5 cards** (LandingPage.tsx:63-148): Proyección · Libertad financiera · Objetivos · Fondos · Retos. El mockup pedía 4 |
| KPI "año libertad financiera" en card Libertad | ❌ Hardcoded | LandingPage.tsx:88-93 · `value: '—'` con `footPill: '2040 · simulación'` ambos hardcoded. Sub-text literal · `"punto de cruce · pendiente conectar con simulador escenarios"` |
| KPI proyección | ✅ Cableado real | Lee `computeBudgetProjection12mAsync(year)` y deriva balance anual + meses positivos/negativos |
| KPI objetivos | ✅ Cableado real | Lee `objetivos` del outlet context (`db.getAll('objetivos')`) y filtra por estado |
| KPI fondos | ✅ Cableado real | Lee `fondos` del outlet context y cuenta colchón |
| KPI retos | ✅ Cableado real | Muestra `retoActivo` del mes en curso si existe |

### De dónde lee la cifra "año libertad financiera"

- **No existe servicio que la calcule.**
- En la card de la landing es literal `'—'` con footer hardcoded `'2040 · simulación'`.
- En la brújula del Panel V5 (`src/modules/panel/PanelPage.tsx:345-346`) es literal `const añoLibertad = '—'` con TODO inline `// TODO: calcular añoLibertad desde simulador Mi Plan cuando esté disponible`.
- **No se ha localizado** ninguna función `calcularLibertad` / `proyectarLibertad` / `computeLibertad` / `simularProyeccion` / `proyectarRentaPasiva`. `grep` devuelve cero coincidencias.

### TODOs activos en el componente landing

- `LandingPage.tsx:31` · `// Proyección · usa el helper compartido (cierra TODO-T20-01).` · documenta cierre, NO TODO activo
- `LandingPage.tsx:90` · texto inline `"pendiente conectar con simulador escenarios"` (en `sub` de la card libertad)

---

## 2 · Página Libertad financiera

### Componente

- **Path** · `src/modules/mi-plan/pages/LibertadPage.tsx` (386 líneas)
- **Routing** · `src/App.tsx:905-909` la cuelga en `/mi-plan/libertad`
- **Existe y está cableada al outlet context.**

### Estructura actual

| Elemento mockup | Estado | Detalle |
|---|---|---|
| Hero variant `toggle` con escenarios alquiler/propia | 🟡 Parcial | El toggle existe (LibertadPage.tsx:59-71) pero el cambio NO recalcula nada · sólo cambia el label visual del título · ambos escenarios usan los **mismos** `hitos`, `gastosVida` y `rentaPasivaObjetivo` |
| 5 sliders reactivos del simulador | ❌ No existe | NO hay sliders. Cero coincidencias para `lib-control` / `lib-slider` / `SimuladorSlider` / `EscenarioSlider` en todo el repo |
| Gráfica plan base vs escenario | 🟠 Existe pero desconectada | Hay un SVG inline (LibertadPage.tsx:179-340) que dibuja la trayectoria 18 años, pero el punto de partida está **hardcoded a 0 €** (`const rentaActual = 0;` en l.132). NO recibe la renta pasiva real (contratos activos), por lo que la curva siempre arranca en 0 y solo sube por los `hitos` añadidos manualmente |
| 4 cards de escenarios guardados pre-definidos | ❌ No existe | NO hay cards de escenarios guardados. NO hay store `escenarios_guardados` ni similar |
| Botón "Guardar escenario" | ❌ No existe | No se ha localizado |
| Botón "Editar objetivo" / "Configurar escenario" | 🟠 Stub | El header de `MiPlanPage.tsx:117-122` y el `EmptyState` de Libertad apuntan a `showToastV5('Editar escenario · sub-tarea follow-up')` · es un toast, no abre nada |
| 4 KPIs estrella | ✅ Renderizan | renta pasiva objetivo · gastos vida · cobertura % · número de hitos · todos del singleton `escenario` |
| Tabla de hitos | ✅ Funciona | Renderiza si hay hitos · empty state si no |

### Comportamiento del toggle alquiler / propia

- LibertadPage.tsx:20 · `const [escenarioActivo, setEscenarioActivo] = useState<Escenario>(escenarioPersistido as Escenario);`
- Es estado local React. El cambio **no persiste** y **no recalcula** nada · sólo cambia el copy del título.
- Choca con el campo persistido `escenario.modoVivienda` (singleton).

### TODOs activos

- No se han localizado TODO/FIXME inline en `LibertadPage.tsx`. La discrepancia funcional (toggle sin efecto, rentaActual hardcoded a 0, sliders ausentes) NO está marcada con TODO.

---

## 3 · Modelo de datos · Escenario · Configuración Libertad

### Tipos

- **Path** · `src/types/miPlan.ts` (181 líneas)
- **Tipo `Escenario`** · líneas 20-39 · **es un singleton** (id=1 fijo) · NO un array de escenarios guardados:

```ts
export interface Escenario {
  id: number;                     // singleton · siempre id=1
  modoVivienda: ModoVivienda;             // 'alquiler' | 'propia'
  gastosVidaLibertadMensual: number;
  estrategia: Estrategia;                 // 'hibrido' | 'conservador' | 'agresivo'
  hitos: Hito[];                          // embebido · array dentro del singleton
  rentaPasivaObjetivo?: number;
  patrimonioNetoObjetivo?: number;
  cajaMinima?: number;
  dtiMaximo?: number;
  ltvMaximo?: number;
  yieldMinimaCartera?: number;
  tasaAhorroMinima?: number;
  updatedAt: string;
}
```

- **Tipo `Hito`** · líneas 12-18 · `tipo: 'compra' | 'venta' | 'revisionRenta' | 'amortizacionExtraordinaria' | 'cambioGastosVida'` · `impactoMensual: number`.

### Store en DB

- **Store `escenarios`** · creado en migración V5.5 · `src/services/db.ts:3076-3157`. Es store singleton con `keyPath: 'id'` y siempre id=1. Renombrado desde el legacy `objetivos_financieros`.
- **NO existe store `escenarios_guardados`** · ni `simulaciones` (en Mi Plan) · ni `libertadConfig` separado del singleton.
- DB_VERSION actual estable post-T27.3 · 65/66 según handoff.

### Servicio

- **Path** · `src/services/escenariosService.ts` (127 líneas)
- Métodos · `getEscenarioActivo()` · `saveEscenarioActivo(partial)` · `resetEscenario()` · `addHito(hito)` · `updateHito(id, patch)` · `removeHito(id)` · `listHitos()`
- Defaults · LibertadPage por defecto · gastosVida 2500 €/mes · rentaPasivaObjetivo 3000 €/mes · etc.
- **Solo gestiona el singleton** · no admite múltiples escenarios.

### Tipo para "configuración personal de libertad"

- Embebida en el mismo `Escenario`. NO existe interface separada.
- Campos relevantes · `modoVivienda` · `gastosVidaLibertadMensual` · `estrategia` · `rentaPasivaObjetivo`.

### Tipo para los 5 supuestos del simulador (compras nuevas · entrada · gastos vida · inflación · subida rentas)

- ❌ **No se ha localizado** ninguna interface que recoja los 5 supuestos del mockup. Los `hitos` cubren parcialmente "compras nuevas" (tipo `'compra'`) y "ventas" pero NO inflación · subida de rentas · entrada · gastos vida (este último sí se cubre como campo del singleton, no como supuesto del simulador).

---

## 4 · Lógica de proyección · función que calcula la curva

### ¿Existe función pura que proyecte la curva de renta pasiva?

- ❌ **NO existe** función dedicada que proyecte la curva de renta pasiva libertad. `grep` para `calcularLibertad` / `proyectarLibertad` / `computeLibertad` / `simularProyeccion` / `proyectarRentaPasiva` devuelve cero coincidencias.
- Lo único parecido es la **construcción inline** dentro del SVG de `LibertadPage.tsx:127-178` · loop sobre 18 años sumando `impactoMensual` de hitos cuya fecha cae antes del año iterado, partiendo de `rentaActual = 0` hardcoded. **No es función pura reutilizable** · está dentro del componente.

### Servicio compartido que existe (relacionado pero distinto)

- **Path** · `src/modules/mi-plan/services/budgetProjection.ts` (313 líneas)
- **Función pura** · `computeBudgetProjectionFromData(year, data)` · síncrona · acepta `{nominas, autonomos, compromisos, contracts}` · devuelve `BudgetProjection { year, months[12], entradasAnuales, salidasAnuales }`
- **Variante async** · `computeBudgetProjection12mAsync(year)` · carga DB y llama a la pura
- **Qué calcula** · proyección **12 meses · ingresos − gastos del hogar** · NO renta pasiva libertad ni año cruce
- **Qué NO calcula** · año cruce libertad · curva 18 años · escenarios alternativos · rentas futuras de inmuebles aún no comprados · efecto de hitos
- **Acepta supuestos como parámetros** · NO · solo `year` y los datos crudos
- **Devuelve serie temporal** · sí · 12 meses por año · NO multi-año
- **Consumidores hoy** ·
  - `src/modules/mi-plan/pages/LandingPage.tsx:35`
  - `src/modules/mi-plan/pages/ProyeccionPage.tsx:18`
  - Tesorería `VistaGeneralTab` (según comentario inline del servicio)

---

## 5 · Página Proyección de caja

### Componente

- **Path** · `src/modules/mi-plan/pages/ProyeccionPage.tsx` (311 líneas)
- **Routing** · `src/App.tsx:900-904` lo cuelga en `/mi-plan/proyeccion`

### Estado

| Elemento mockup | Estado | Detalle |
|---|---|---|
| KPIs anuales (entradas / salidas / balance / mes más positivo) | ✅ Cableado real | Lee de `computeBudgetProjection12mAsync` |
| Gráfica waterfall 12 meses (ingresos vs gastos por mes) | ✅ Funciona | Bars positivas/negativas · click muestra toast con detalle |
| Tabla mes a mes navegable | ✅ Renderiza | Tabla 12 filas con entradas / salidas / flujo neto. **El mockup pedía "navegable mes a mes"** — la tabla NO permite paginar año adelante/atrás · solo año en curso |
| Año seleccionable | ❌ No | Hardcoded a `new Date().getFullYear()` · sin selector de año |

### TODOs activos

- No se han localizado TODO/FIXME inline en `ProyeccionPage.tsx`.

---

## 6 · Tabs submódulo Mi Plan

### Componente

- **Path** · `src/modules/mi-plan/MiPlanPage.tsx:21-28`

### Tabs activos (orden actual)

1. `Mi Plan` (landing) · default
2. `Proyección`
3. `Libertad financiera`
4. `Objetivos`
5. `Retos`
6. `Fondos de ahorro`

> **Orden real en código** · landing → proyeccion → libertad → objetivos → fondos → retos (MiPlanPage.tsx:22-27).

### ¿Tab Retos oculto post-T27.2-skip?

- ❌ **NO está oculto.** `MiPlanPage.tsx:27` lo declara como tab visible. La página `RetosPage.tsx` existe (6,5 KB).
- Si T27.2 fue skip y la decisión era ocultarlo, **no se ejecutó** en el código actual.

### Navegación

- Cada botón llama a `navigate(tab.path)` · funcional.
- `activeKey` se deriva del `location.pathname` · funcional.
- Redirect `/mi-plan/` → `/mi-plan` correcto.

---

## 7 · Cruce con T22.x · Panel V5

### MiPlanCompass

- **Path** · `src/modules/panel/components/MiPlanCompass.tsx` (132 líneas)
- **Consumidor único** · `src/modules/panel/PanelPage.tsx:601-609`
- **Existe y está construido en T22.6** según comentario header (`§ Z.11 · TAREA 22.6`).

### ¿Reutilizable en la landing de Mi Plan?

- 🟠 Parcialmente. Recibe 7 props ya derivadas (`pctCobertura`, `añoLibertad`, `mesesColchon`, `rentaPasiva`, `gastoVida`, `inmueblesActivos`, `metaInmuebles`). El componente es presentacional puro · sí podría montarse en la landing de Mi Plan, pero su layout (card vertical con barra progreso + 4 items) NO encaja con el hero+grid actual de `LandingPage.tsx`.
- **Hoy NO se usa en la landing de Mi Plan** · solo en Panel.

### ¿La cifra "año libertad" del Panel V5 está cableada o es null?

- ❌ **Hardcoded a `'—'`.** `PanelPage.tsx:345-346`:

```ts
// TODO: calcular añoLibertad desde simulador Mi Plan cuando esté disponible
const añoLibertad = '—';
```

- Igualmente `PanelPage.tsx:348-349` para `metaInmuebles: number | null = null`.
- **Las otras métricas SÍ están cableadas** · `rentaPasiva` desde contratos activos · `gastoVida` desde escenario o fallback a `pulsoMes.gastos` · `pctCobertura` calculado · `mesesColchon` calculado · `inmueblesActivos` desde `properties.length`.

---

## 8 · TODOs y FIXMEs específicos del módulo

### En `src/modules/mi-plan/`

| Archivo | Línea | TODO |
|---|---|---|
| `pages/LandingPage.tsx` | 31 | `// Proyección · usa el helper compartido (cierra TODO-T20-01).` (documenta cierre) |
| `services/budgetProjection.ts` | 4 | Header doc · `cierra **TODO-T20-01**` (documenta cierre) |

> **Cero TODO activos** dentro del módulo `mi-plan/`. Los gaps funcionales (sliders ausentes, rentaActual hardcoded, escenarios guardados ausentes) NO están marcados con TODO.

### En `src/modules/panel/` relacionados con Mi Plan

| Archivo | Línea | TODO |
|---|---|---|
| `components/MiPlanCompass.tsx` | 9, 14, 36, 122 | "TODO conectar simulador Mi Plan" (4 ocurrencias en docs y en `metaInmuebles`) |
| `PanelPage.tsx` | 322 | "TODO conectar con proyección de gastos reales cuando esté disponible" |
| `PanelPage.tsx` | 325 | "añoLibertad = TODO conectar simulador Mi Plan" |
| `PanelPage.tsx` | 326 | "metaInmuebles = TODO conectar simulador Mi Plan" |
| `PanelPage.tsx` | 345 | `// TODO: calcular añoLibertad desde simulador Mi Plan cuando esté disponible` |
| `PanelPage.tsx` | 348 | `// TODO: obtener metaInmuebles desde escenario/simulador Mi Plan` |

---

## 9 · Diagnóstico (8 preguntas)

| # | Pregunta | Estado | Path / Detalle |
|---|---|---|---|
| 1 | ¿La landing Mi Plan está implementada? | 🟡 Existe parcial | `src/modules/mi-plan/pages/LandingPage.tsx` · hero + grid 5 cards · KPIs proyección/objetivos/fondos/retos cableados · KPI libertad hardcoded · gráfica histórica del mockup NO existe |
| 2 | ¿La página Libertad financiera existe? | 🟠 Existe pero rota | `src/modules/mi-plan/pages/LibertadPage.tsx` · KPIs + gráfica trayectoria + tabla hitos · pero `rentaActual` hardcoded a 0 · toggle alquiler/propia inerte · sin sliders · sin escenarios guardados · sin botón guardar |
| 3 | ¿Existe modelo de datos para Escenarios? | 🟡 Existe parcial | Singleton `Escenario` (id=1) en store `escenarios` con `hitos[]` embebidos · NO admite múltiples escenarios guardados · NO existe tipo para los 5 supuestos del simulador |
| 4 | ¿Existe función pura de proyección que calcule fecha de libertad? | ❌ No existe | Cero coincidencias para `calcularLibertad` / `proyectar*Libertad` · solo construcción inline dentro del SVG de `LibertadPage.tsx:127-178` partiendo de renta = 0 · `budgetProjection.ts` proyecta caja 12 m, no libertad |
| 5 | ¿Sliders del simulador implementados o placeholder? | ❌ No existen | Cero coincidencias para `lib-slider`, `SimuladorSlider`, `EscenarioSlider`, etc. |
| 6 | ¿Gráfica reactiva existe? | 🟠 Existe pero rota | SVG inline en LibertadPage.tsx · reactiva al singleton (hitos, gastosVida, rentaPasivaObjetivo) · pero arranca de renta = 0 hardcoded · no se conecta con renta pasiva real (contratos activos) |
| 7 | ¿4 escenarios pre-definidos del mockup están seedeados o son hardcode visual? | ❌ No existen en Mi Plan | `escenariosService.ts` solo seedea **un** singleton con `ESCENARIO_DEFAULTS`. **Nota lateral** · existe módulo legacy `src/modules/horizon/proyeccion/escenarios/` con `ScenarioSummary[]` hardcoded como mockup, ruta `/proyeccion/escenarios` (ver §11) |
| 8 | ¿Cifra "año libertad" del Panel V5 cableada o null? | ❌ Hardcoded "—" | `PanelPage.tsx:346` literal `const añoLibertad = '—'` con TODO inline |

---

## 10 · Tabla síntoma → causa raíz

| Síntoma | Causa raíz | Severidad | Archivo principal |
|---|---|---|---|
| Landing Mi Plan KPI libertad placeholder | No existe función que calcule fecha cruce libertad · LandingPage hardcodea `'—'` y `'2040 · simulación'` | Alta | `src/modules/mi-plan/pages/LandingPage.tsx:88-93` |
| Año libertad sin valor (Panel V5) | TODO inline · ningún simulador devuelve la cifra | Alta | `src/modules/panel/PanelPage.tsx:345-346` |
| Meta inmuebles sin valor (Panel V5) | TODO inline · ningún simulador devuelve la cifra | Media | `src/modules/panel/PanelPage.tsx:348-349` |
| Página Libertad operativa pero gráfica arranca en 0 € | `rentaActual = 0` hardcoded · NO se conecta con renta pasiva real (contratos activos) | Alta | `src/modules/mi-plan/pages/LibertadPage.tsx:132` |
| Sliders del simulador no funcionan | NO están implementados · cero referencias en repo | Alta | `src/modules/mi-plan/pages/LibertadPage.tsx` (ausencia) |
| Toggle alquiler/propia inerte | useState local sin persistencia ni recálculo · `escenario.modoVivienda` se ignora salvo en valor inicial | Media | `src/modules/mi-plan/pages/LibertadPage.tsx:18-20, 65` |
| Escenarios guardados (4 cards mockup) no existen | NO hay store `escenarios_guardados` · `Escenario` es singleton id=1 · servicio no admite múltiples | Alta | `src/types/miPlan.ts:20`, `src/services/escenariosService.ts` |
| Tab Proyección · selector de año ausente | Hardcoded `new Date().getFullYear()` | Baja | `src/modules/mi-plan/pages/ProyeccionPage.tsx:13` |
| Tab Retos visible cuando T27.2 fue skip | Tab declarado · no oculto | Baja | `src/modules/mi-plan/MiPlanPage.tsx:27` |
| Botón "Configurar escenario" del header sólo dispara toast | `showToastV5('Editar escenario · sub-tarea follow-up')` · no hay drawer/wizard | Media | `src/modules/mi-plan/MiPlanPage.tsx:117-122`, `LibertadPage.tsx:29` |

---

## 11 · Recomendación de descomposición

> Sub-tareas honestas según realidad del repo · NO copia mecánica del spec.

| Sub | Qué cubriría | Esfuerzo CC estimado | Bloqueante para mercado |
|---|---|---|---|
| T27.4.1 | **Función pura de proyección libertad** · `proyectarRentaPasivaLibertad(supuestos, datosReales) → SerieAnual[]` · serie multi-año (ej. 18) · arranca de renta pasiva real (contratos activos) · aplica hitos + supuestos (inflación · subida rentas · gastos vida fijos) · devuelve `{ serie, anioCruce, % cobertura por año }` · tests unitarios | 6-8 h | Sí · es prerrequisito para 27.4.2/.3/.4 |
| T27.4.2 | **Wiring KPIs reales** · Landing card libertad y MiPlanCompass leen `proyectarRentaPasivaLibertad()` y muestran `anioCruce` · meta inmuebles deriva de hitos tipo `'compra'` agregados · elimina hardcodes `'—'` y `'2040 · simulación'` | 3-4 h | Sí · es lo que el handoff V8 §8.1 marca como blocker |
| T27.4.3 | **Página Libertad · simulador funcional** · sliders (5 supuestos) sobre la función pura · gráfica reactiva plan base vs escenario en vivo · arranca renta real (no 0) · toggle alquiler/propia que recalcula con `gastosVida` distinto · botón "Guardar escenario" persistente | 8-12 h | Sí · es el corazón de Mi Plan |
| T27.4.4 | **Modelo de datos · escenarios guardados** · nuevo store `escenarios_guardados` (array, distinto del singleton activo) · CRUD · seed de 4 escenarios pre-definidos del mockup · cards en Libertad · DB migration | 5-7 h | No bloqueante de mercado pero lo pide el mockup canónico |
| T27.4.5 | **Limpieza zombie escenarios horizon** · decidir si `src/modules/horizon/proyeccion/escenarios/` se conserva, se deprecia o se mergea con la nueva implementación de Mi Plan (ver §12) | 1-2 h decisión + ejecución | No |
| T27.4.6 | **Wizard "Configurar escenario"** · sustituir `showToastV5('sub-tarea follow-up')` del header de MiPlanPage y EmptyState de Libertad por drawer/wizard funcional para `modoVivienda` · `gastosVida` · `estrategia` · KPIs macro | 3-5 h | No |

> **Total estimado** · 26-38 h CC. **Subdivisión sugerida** · merge T27.4.1 primero (función pura testable) · luego T27.4.2 (corta el síntoma del handoff §8.1) · después T27.4.3+T27.4.4 en PR conjunto o secuencial.

---

## 12 · Hallazgos laterales (bugs detectados sin arreglar)

> NO se arreglan · solo se documentan para futuras tareas.

1. **Módulo zombie `src/modules/horizon/proyeccion/escenarios/`** · 3 archivos relevantes (`ProyeccionEscenarios.tsx`, 86 líneas · `services/escenarioService.ts`, 822 líneas · `components/ScenarioManagement.tsx`, 558 líneas) · ruta activa `/proyeccion/escenarios` (App.tsx:945) · usa **modelo de datos paralelo** (`ScenarioSummary` · `ScenarioDetail` · `QuickWin` · `SnapshotData` · etc.) totalmente desconectado del singleton `Escenario` de Mi Plan. Riesgo · 2 verdades de "escenario" coexistiendo. Decisión necesaria · borrar, integrar o renombrar. **Comentario en App.tsx:955-957** redirige `/proyeccion/{base,simulaciones,comparativas}` a `/proyeccion/escenarios` · sugiere consolidación previa parcial.

2. **`LibertadPage.tsx:132` · `const rentaActual = 0;`** · la curva siempre arranca en 0, ignorando renta pasiva real (suma `rentaMensual` de contratos activos). El Panel V5 ya calcula esa cifra (`PanelPage.tsx:330-332`) · sería trivial reusarla.

3. **Toggle alquiler/propia (`LibertadPage.tsx:18-20`)** · `useState` local sin persistencia ni efectos. Cambia el copy del título pero no llama a `saveEscenarioActivo({ modoVivienda })` · contradice el campo persistido `escenario.modoVivienda`.

4. **Card libertad en LandingPage (`LandingPage.tsx:88-93`)** · contiene literales hardcoded `'—'` y `'2040 · simulación'` · si el simulador devuelve un valor real distinto, esta card seguirá mostrando lo hardcoded a menos que se reescriba.

5. **`MiPlanPage.tsx:117-122`** · botón header "Configurar escenario" dispara `showToastV5('Editar escenario · sub-tarea follow-up')` · es código deliberadamente provisional declarado como "sub-tarea follow-up", no marcado con TODO.

6. **`ProyeccionPage.tsx:13`** · año hardcoded a `new Date().getFullYear()` · el mockup pedía tabla mes a mes navegable (implica selector de año adelante/atrás).

7. **Tab Retos visible (`MiPlanPage.tsx:27`)** · si la decisión post-T27.2-skip era ocultarlo, no se ejecutó.

8. **Tipo `ScenarioMode = 'diy' | 'strategies' | 'objectives'` (escenario legacy)** vs. `Estrategia = 'hibrido' | 'conservador' | 'agresivo'` (escenario Mi Plan v3) · dos vocabularios distintos para "estrategia" en el mismo repo.

9. **`LandingPage.tsx:90`** · texto sub-card libertad literal `"punto de cruce · pendiente conectar con simulador escenarios"` · documenta el gap pero está visible al usuario final.

---

Generated by Claude Code (auditoría T27.4-pre · 2026-05-02)
