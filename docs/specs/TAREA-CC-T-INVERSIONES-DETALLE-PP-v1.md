# TAREA CC · T-INVERSIONES-DETALLE-PP-v1 · rediseño ficha Plan Pensiones + Posiciones Cerradas

> **Tipo** · refactor UI con extensión de modelo de datos · bump DB v71→v72 · 1 store nuevo + 1 store extendido + 1 servicio nuevo.
> **Decisiones cerradas con Jose** · Q1-Q5 (ver §2).
> **Mockup vinculante** · `atlas-inversiones-fichas-v2.html` · 1472 líneas · 84 KB · revisado y aprobado por Jose el 17/05/2026.
> **Estimación** · 18-26h CC · 5 PRs secuenciales con stop-and-wait.
> **Sucede a** · T-INVERSIONES-V5 (cerrada · módulo galería + modales + fichas básicas en producción · estado OK).
> **Aplica solo a** · ficha plan de pensiones (4 tipos PPI/PPE/PPES/PPA) + página posiciones cerradas. Las fichas de fondo · acción · préstamo · depósito · crypto serán réplicas en tareas posteriores T-INVERSIONES-DETALLE-FONDO · ACCION · PRESTAMO · DEPOSITO · CRYPTO.
> **Regla absoluta** · si CC encuentra cualquier divergencia entre esta spec y el código real durante el pre-flight · DETENER y reportar a Jose · NO improvisar.

---

## 0 · Pre-flight obligatorio · NO empezar a tocar código sin completar esto

### 0.1 · Auditoría componentes y rutas existentes

CC inventaria en un comentario del primer PR · antes de tocar nada · los siguientes archivos · con conteo de líneas y consumidores:

| Componente | Ruta esperada | Acción tras pre-flight |
|---|---|---|
| `FichaPlanPensiones.tsx` (T13v4 + T-INVERSIONES-V5) | en `pages/` según T-INVERSIONES-V5 Q8 | Reestructuración interna · preserva 2 secciones T13v4 |
| `PosicionesCerradasPage.tsx` | `pages/` | Reestructuración completa · foco rentabilidad |
| Componentes ficha post T-INVERSIONES-V5 · `FichaShell` `FichaHero` `FichaActionBar` | `components/ficha/` (extendidos en T-INVERSIONES-V5) | Reutilizar · NO duplicar |
| `proyeccionService` (Mi Plan) | reportar ruta exacta | Reutilizar para cálculos comunes · NO duplicar |
| Servicios fiscales existentes · `limitesFiscalesPlanesService` · `aeatPlanesPensionesImportService` · `inversionesFiscalService` | NO se tocan | Lectura solo |

### 0.2 · Auditoría modelo de datos actual · Mi Plan + Personal

CC reporta qué campos existen ya en:
- Store `miPlan` (o equivalente) · ¿qué cubre? ¿edad objetivo rescate? ¿inflación asumida?
- Store `personal` (o equivalente) · ¿qué cubre? ¿fecha de nacimiento del usuario? ¿perfil del usuario?
- Concepto `objetivos` · ¿existe ya un store o submódulo? ¿qué shape tiene?

Si CC encuentra que **Mi Plan ya tiene** `edadObjetivoRescate` · `inflacionAnualAsumida` · `objetivosVitales[]` · NO se duplica · solo se usan.
Si **NO existen** · CC los crea según §4.B · §4.C.

### 0.3 · Confirmación de que T-INVERSIONES-V5 está cerrada

Antes de empezar · CC verifica que:
1. Los 5 PRs de T-INVERSIONES-V5 están merged en `main`.
2. La galería · 12 modales · 6 fichas tipadas · están en producción.
3. Los 43 tests baseline rojos pre-existentes siguen siendo el baseline (no se ha ampliado el set rojo).

### 0.4 · Stores que NO se tocan en esta tarea (lectura solo)

```
inversiones · planesPensiones · aportacionesPlan · traspasosPlanPensiones
ejercicioFiscalCoord · cuentas · contracts · valoraciones_historicas
```

### 0.5 · Lo que CC entrega antes del primer PR de código

Comentario en el issue con:
1. Inventario §0.1 con conteo de líneas y consumidores (`grep -r 'import.*ComponentName'` por cada uno).
2. Auditoría §0.2 con shape actual de `miPlan` · `personal` · `objetivos`.
3. Confirmación §0.3 · T-INVERSIONES-V5 cerrada.
4. Confirmación §0.4 · stores no tocados.
5. Tests baseline · número de tests rojos en `npm test` sobre `main` HEAD.
6. Preguntas abiertas si encuentra algo que la spec no contempla.

**Stop-and-wait obligatorio** · Jose responde OK al pre-flight · CC abre PR 1.

---

## 1 · Alcance

### 1.1 · Entra en esta tarea

- Rediseño completo de la ficha de plan de pensiones (4 tipos PPI/PPE/PPES/PPA) siguiendo mockup `atlas-inversiones-fichas-v2.html` página `page-plan`.
- Rediseño completo de la página de posiciones cerradas siguiendo mockup página `page-cerradas`.
- **Tipo-aware** · accionables distintos por tipo de plan (PPI accionable · PPE educativo · ver §5.4).
- 5 bloques chicha en ficha PP · P1 proyección · P2 benchmark · P3 coste comisiones · P4 hitos vivos · P5 sandbox.
- 5 bloques chicha en cerradas · C1 hero patrimonio cerrado · C2 histograma · C3 best/worst · C5 ranking por tipo · listado de detalle al pie.
- Store nuevo `benchmarksReferencia` con precarga inicial · UI Ajustes → "Datos de mercado".
- Extensión Mi Plan · `edadObjetivoRescate` · `inflacionAnualAsumida` · UI inline en Mi Plan.
- Objetivos vitales en Mi Plan (verificar existencia · extender si necesario).
- Servicio nuevo `proyeccionInversionService` para calcular curvas de proyección.
- Sistema de avisos cerrables · store `avisosUsuario` · UI Ajustes → "Avisos" para restaurar.
- Paleta sobria · tags monocromáticos Oxford Gold en toda la página · sin lavanda/rosa/azul-claro.
- Banners cerrables · botón X discreto · persistencia en `avisosUsuario`.
- Chips "fuente del dato" · indican origen del valor (Mi Plan · Ajustes · Personal) con click navegable.

### 1.2 · NO entra · diferido a tareas posteriores

- **Ficha fondo de inversión** · T-INVERSIONES-DETALLE-FONDO-v1.
- **Ficha acción / ETF / REIT** · T-INVERSIONES-DETALLE-ACCION-v1.
- **Ficha préstamo P2P / empresa** · T-INVERSIONES-DETALLE-PRESTAMO-v1.
- **Ficha depósito / cuenta** · T-INVERSIONES-DETALLE-DEPOSITO-v1.
- **Ficha crypto / otro** · T-INVERSIONES-DETALLE-CRYPTO-v1.
- **Integración con API externa de benchmarks** (Yahoo Finance, Alpha Vantage, etc.) · diferido a T-BENCHMARKS-API-v1 cuando se decida.
- **Sparkline mensual real** desde valoraciones · diferido (Q5 MVP de T-INVERSIONES-V5).
- **Cambios en módulo galería** · ya cerrado en T-INVERSIONES-V5.
- **Cambios en modales** · ya cerrados en T-INVERSIONES-V5.
- **Régimen art. 94 LIRPF para fondos** · diferido.

### 1.3 · Lo que se PRESERVA intacto

- Las 2 secciones T13v4 en ficha plan · datos fiscales hogar + trayectoria de aportaciones por ejercicio. **Aparecerán al final de la nueva ficha**, debajo del bloque P5 (sandbox), en una sección "Detalle fiscal y aportaciones".
- Los servicios fiscales · `limitesFiscalesPlanesService` · `aeatPlanesPensionesImportService` · `inversionesFiscalService` · `planesPensionesService`.
- Los modales · acciones · alta · todos los flujos cerrados en T-INVERSIONES-V5.
- 43 tests baseline rojos.

---

## 2 · Decisiones de producto cerradas con Jose

| Código | Decisión | Implicación |
|---|---|---|
| Q1 | Benchmarks · edición manual en Ajustes · precarga inicial con valores actuales | Store `benchmarksReferencia` + UI Ajustes → "Datos de mercado" |
| Q2 | Horizonte rescate · vive en Mi Plan (no en Personal) | Extender Mi Plan con `edadObjetivoRescate` |
| Q3 | Inflación · usar la actual, pero accionable | Campo `inflacionAnualAsumida` en Mi Plan · editable inline |
| Q4 | Objetivos ya está en Mi Plan | Auditoría §0.2 confirma · si existe, se usa; si no, se crea como submódulo |
| Q5 | PPE muestra sección "cambio gestora" en tono educativo (no accionable) | Tipo-aware copy en `FichaPlanPensiones` |
| Patrón | Todos los avisos cerrables | Botón X + persistencia en `avisosUsuario` + UI Ajustes → "Avisos" para restaurar |

---

## 3 · Mockup vinculante

`atlas-inversiones-fichas-v2.html` · 1472 líneas · 84 KB.

**CC debe descargar este HTML como referencia visual binding.** La spec describe el qué · el mockup demuestra el cómo (CSS exacto · iconos · espaciados · copy · interacciones).

Páginas relevantes en el mockup:
- `page-plan` · ficha Plan Orange (caso PPE) con los 5 bloques chicha + secciones T13v4 al pie
- `page-cerradas` · página posiciones cerradas rediseñada con foco rentabilidad

Patrón Modal ATLAS · ya cubierto por T-INVERSIONES-V5 · no se cambia aquí.

---

## 4 · Modelo de datos · 5 piezas nuevas/extendidas

### 4.A · Store nuevo `benchmarksReferencia` (bump DB v71→v72)

```typescript
// src/types/benchmarksReferencia.ts
export type TipoBenchmark = 'indice_equity' | 'indice_renta_fija' | 'inflacion' | 'etf_referencia';

export interface BenchmarkReferencia {
  id: string;                              // uuid
  codigo: string;                          // 'MSCI_WORLD_EUR' · 'SP500' · 'CPI_ES' · 'EUROSTOXX_50' · 'BONDS_AGG'
  nombre: string;                          // "MSCI World EUR hedged"
  tipo: TipoBenchmark;
  divisa: string;                          // 'EUR' · 'USD'
  descripcion: string;                     // "Renta variable global · 1600 valores grandes y medianos · hedged a EUR"
  valoresAnuales: Record<number, number>;  // { 2020: 5.8, 2021: 21.8, 2022: -18.1, 2023: 22.0, 2024: 18.7 }
  fuenteUrl?: string;                      // "https://msci.com/index/..."
  notaInterna?: string;                    // usuario · "actualizado desde factsheet diciembre"
  ultimaActualizacion: string;             // ISO date · "2024-12-31"
  fechaCreacion: string;                   // ISO date
  fechaModificacion: string;               // ISO date
}
```

**Configuración del store:**
- `keyPath`: `id`
- Índices: `codigo` (unique) · `tipo` · `ultimaActualizacion`

**Precarga inicial · §8 de esta spec** · 6 benchmarks con datos al 31/12/2024.

### 4.B · Extensión Mi Plan (sin bump DB · solo añadir campos opcionales)

CC verifica en pre-flight qué campos tiene hoy `miPlan`. Añade los siguientes **si no existen**:

```typescript
interface MiPlanExtension {
  // existente …
  edadObjetivoRescate?: number;          // default 65 · slider 55-75 en UI
  inflacionAnualAsumida?: number;        // default 2.0 (%) · editable
  fechaNacimientoUsuario?: string;       // ISO · si no está en `personal` ya
}
```

**Migración v72 idempotente** (flag `migration_v72_extendMiPlanRescate_v1`):
- Para cada registro de `miPlan` · si falta cualquiera de los 3 campos · `edadObjetivoRescate = 65` · `inflacionAnualAsumida = 2.0`.
- `fechaNacimientoUsuario` queda `null` hasta que el usuario la introduzca.

### 4.C · Objetivos vitales en Mi Plan

CC audita en §0.2 si existe `objetivos`. Casos:

**Caso A · existe ya con shape compatible** · usar tal cual. Espera al menos:
```typescript
interface ObjetivoVital {
  id: string;
  nombre: string;            // "Salida de Orange España"
  fechaEstimada: string;     // ISO date · "2027-12-31"
  descripcion?: string;
  planFinancieroAsociado?: string;  // id del plan · null = afecta a todos
  tipo?: 'salida_empresa' | 'jubilacion' | 'compra_vivienda' | 'hijo_universidad' | 'herencia' | 'otro';
}
```

**Caso B · NO existe** · crear submódulo nuevo en Mi Plan con CRUD básico · store `objetivosVitales` (sin bump DB · es store nuevo accesorio).

**En cualquier caso** · la ficha de plan filtra objetivos cuyo `fechaEstimada` esté entre hoy y `edadObjetivoRescate` del usuario · y que `planFinancieroAsociado === null || planFinancieroAsociado === planId`.

### 4.D · Servicio nuevo `proyeccionInversionService`

```typescript
// src/services/proyeccionInversionService.ts

export interface ProyeccionInputs {
  saldoActual: number;            // valor actual del activo
  aportadoActual: number;         // capital aportado acumulado
  aportacionAnualEstimada: number;// aportación recurrente anual estimada · 0 si pasivo
  anosTranscurridos: number;      // años desde apertura
  twrHistorico: number;           // TWR anualizado real del activo · si <2 años de histórico · null
  fechaNacimientoUsuario: string | null;
  edadObjetivoRescate: number;
  inflacionAnualAsumida: number;
  benchmarkReferencia: BenchmarkReferencia | null;  // para escenario "si cambias gestora"
}

export interface ProyeccionResult {
  anosHastaRescate: number;
  fechaRescate: string;            // ISO
  // 3 escenarios · cada uno con array de puntos {año, valor}
  escenarioActual: ProyeccionEscenario;
  escenarioConBenchmark: ProyeccionEscenario | null;  // null si no hay benchmark
  escenarioConMaxAportacion: ProyeccionEscenario;
  // Conos de incertidumbre · ±2 pp TWR sobre escenarioActual
  conoBajo: ProyeccionEscenario;
  conoAlto: ProyeccionEscenario;
  // Valor final nominal y real
  valorFinalNominal: number;
  valorFinalReal: number;           // descontada inflación
  diferenciaConBenchmark: number | null;
}

export interface ProyeccionEscenario {
  twrAplicado: number;
  puntos: Array<{ ano: number; valor: number; aportadoAcumulado: number }>;
  valorFinal: number;
}

export function proyectarInversion(inputs: ProyeccionInputs): ProyeccionResult { /* ... */ }
```

**Reglas de cálculo:**
- Si `twrHistorico === null` (menos de 2 años de histórico) · usar `benchmarkReferencia.twrRolling5y` como base conservadora.
- Fórmula valor futuro · `VF = saldoActual·(1+r)^n + aporte·((1+r)^n - 1)/r`.
- Conos · `twrHistorico ± 2 pp`.
- Valor real · `valorFinalNominal / (1 + inflacion)^n`.

**NOTA** · esta función es genérica · servirá también para ficha fondo · acción · etc. en tareas posteriores. No incluir lógica específica del tipo plan aquí.

### 4.E · Store nuevo `avisosUsuario` (sin bump DB · es store accesorio)

```typescript
interface AvisoCerrado {
  avisoId: string;          // "benchmark-orange-loss" · "coste-ppe-info" · "hitos-info" · etc.
  fechaCierre: string;      // ISO
  ubicacionContexto?: string; // "/inversiones/:id" · útil para restaurar
}
```

**Configuración:**
- `keyPath`: `avisoId`
- API simple · `cerrarAviso(avisoId)` · `estaAvisoActivo(avisoId)` · `restaurarTodos()` · `listarCerrados()`.

**Persistencia** · solo IndexedDB · no localStorage (es contenido de usuario · debe seguir el patrón de la app).

---

## 5 · UI · qué se rediseña y cómo

### 5.1 · Ficha `FichaPlanPensiones.tsx` · armado nuevo

Estructura visual de arriba abajo · siguiendo mockup `page-plan`:

1. **Back button** · "Volver a inversiones" · navega a galería.
2. **Hero compacto** (existente · ampliado) · 4 KPIs · valor · aportado · resultado · TWR/año. Añadir badge tipo PPI/PPE/PPES/PPA visible.
3. **Action bar** (existente) · Actualizar valoración · Aportar · Traspasar · Rescatar · Editar.
4. **Bloque P1 · Proyección** · ver §5.2.
5. **Bloque P2 · Benchmark** · ver §5.3.
6. **Bloque P3 · Coste comisiones** · tipo-aware · ver §5.4.
7. **Bloque P4 · Hitos vivos** · ver §5.5.
8. **Bloque P5 · Sandbox interactivo** · ver §5.6.
9. **Sección "Detalle fiscal y aportaciones"** · contiene las 2 secciones T13v4 preservadas · colapsable opcionalmente.

### 5.2 · Bloque P1 · Proyección "tu yo en X"

**Componente nuevo** · `BloqueProyeccion.tsx`.

Props:
- `posicionId: string`
- `tipoActivo: 'plan_pensiones' | 'fondo' | 'accion' | ...` (genérico para reuso futuro)

Comportamiento:
- Carga inputs de · `miPlan` (edadObjetivoRescate · inflación) · `personal` (fechaNacimiento) · benchmark más cercano a la política del plan (matchear por `politicaInversion` con tabla de mapping).
- Llama `proyeccionInversionService.proyectarInversion(inputs)`.
- Renderiza SVG con · línea valor real + línea proyectada escenario actual + línea con benchmark (si existe) + cono ±2pp.
- Toggle 3 escenarios · actual · con benchmark · aportación máxima.
- 3 chips fuente · "Edad rescate · X · Mi Plan ↗" · "Inflación · X % · Mi Plan ↗" · "Benchmarks · Ajustes ↗" (cada chip navega a su origen).
- 3 minis al pie · valor nominal · poder adquisitivo descontando inflación · diferencia si cambias.

**Tipo-aware en P1** · solo el copy del mensaje grande cambia:
- PPI · "A los X años tendrás Y €" · accionable
- PPE · "A los X años tendrás Y €" · informativo (mismo cálculo)
- PPES · idem PPI
- PPA · "A vencimiento del plan tendrás Y € garantizados" (PPA tiene rentabilidad garantizada · usar `garantiaMinima` si existe en el plan)

### 5.3 · Bloque P2 · Benchmark

**Componente nuevo** · `BloqueBenchmark.tsx`.

Props · `posicionId` · `tipoActivo` · `politicaInversion`.

Comportamiento:
- Lee `benchmarksReferencia` del store.
- Selecciona benchmarks relevantes según `politicaInversion` del plan:
  - Renta fija mixta → CPI España + Bonos AGG + MSCI World (para comparar con alternativa)
  - Renta variable global → CPI España + MSCI World + SP500
  - Renta fija → CPI España + Bonos AGG
  - Mixto → CPI + Bonos AGG + MSCI World
  - Sin clasificar → CPI + MSCI World (genéricos)
- Si el usuario tiene **otro plan de su propiedad** · añade fila comparativa "Tu plan X · TWR Y %" (decision binding · comparar contigo mismo).
- Barras horizontales centradas en 0 · escala automática.
- Banner cerrable con análisis · "Tu plan pierde contra la inflación..." (texto generado según resultados · tabla de plantillas en §5.3.1).
- Chip fuente · "datos a fecha X · Ajustes ↗".

#### 5.3.1 · Plantillas de análisis para banner P2

| Condición | Banner |
|---|---|
| TWR plan < inflación | "Tu {nombre} pierde contra la inflación · {X} puntos reales perdidos en los últimos 5 años" |
| TWR plan < benchmark mismo asset class | "Tu {nombre} rinde {X} pp menos que su benchmark de referencia ({nombreBench})" |
| TWR plan ≥ benchmark | "Tu {nombre} está batiendo a su benchmark · sigue así" |
| Sin TWR (menos de 2 años) | "Aún no tenemos suficiente histórico · revisa en {N} años" |

### 5.4 · Bloque P3 · Coste comisiones · TIPO-AWARE

**Componente nuevo** · `BloqueCostes.tsx`.

Comportamiento común:
- Calcula `comisionesAcumuladas = TER × saldoMedioAnual × años` (años desde apertura).
- Calcula `comisionesFuturas = TER × saldoMedioProyectado × añosHastaRescate`.
- Calcula ahorro hipotético cambiando a TER 0.5%.

**Variación copy por tipo:**

| Tipo | Título | Copy banner |
|---|---|---|
| PPI | "Lo que te cobra la gestora" | "Cambiando a TER 0,5% ahorrarías {X} € · traspasa con un clic · NO tributa" (banner accionable) |
| PPA | "Lo que te cobra la gestora" | Si plan garantizado · "Las comisiones ya están descontadas del rendimiento garantizado · informativo" |
| PPES | Idem PPI | Idem PPI · si autónomo y dentro de límite 5.750 € |
| **PPE** | "Lo que cuesta tener este plan" | "Esto lo paga la empresa promotora · informativo. Cuando dejes {nombreEmpresa} podrás traspasar a PPI con TER más bajo" (banner educativo · NO accionable hoy) |

CC implementa función `getCopyPorTipo(tipoPlan: TipoAdministrativo)` con switch.

**Botón al pie:**
- PPI/PPES/PPA · "Buscar plan con TER menor" (toast · futuro · sin lógica real ahora).
- PPE · NO botón · solo banner informativo.

### 5.5 · Bloque P4 · Hitos vivos

**Componente nuevo** · `BloqueHitos.tsx`.

Comportamiento:
- Calcula hitos del sistema:
  - **Apertura + 10 años** · "Rescatable libremente · RD-Ley 1/2015" (etiqueta urgente si <12 meses · normal si <5 años · futuro si >5 años).
  - **Apertura + 15 años** · "Antigüedad media · revisa rendimiento".
  - **Edad usuario = edadObjetivoRescate** · "Jubilación · ventana fiscal óptima".
- Lee `objetivosVitales` filtrados:
  - Solo futuros (`fechaEstimada > hoy`)
  - Asociados a este plan (`planFinancieroAsociado === planId`) o globales (`planFinancieroAsociado === null`)
- Combina todos · ordena por fecha · muestra máximo 4 en timeline horizontal · si hay más · "Ver todos →".
- Cada hito · etiqueta de origen · "desde Mi Plan" · "derivado del plan" · "objetivo principal".
- Banner cerrable · "Si no tienes hitos en Mi Plan → Objetivos · solo verás los del sistema. Añade los tuyos."
- Chip fuente · "Objetivos · Mi Plan ↗".

### 5.6 · Bloque P5 · Sandbox interactivo "Y si..."

**Componente nuevo** · `BloqueSandbox.tsx`.

3 sliders:
- Aportación anual · 0 a 10.000 € · paso 100 € (PPE · titular limite 1.500 + empresa 8.500 · ver §5.6.1).
- Años hasta rescate · 5 a 40 · paso 1.
- TWR esperado · 0 % a 10 % · paso 0.1.

Valor final · recalculado en cada `oninput` · fórmula valor futuro · igual que `proyeccionInversionService.proyectarInversion` pero solo con escenario único.

Mostrar `valorFinal` grande en card navy + diferencia vs escenario actual (`+ X € sobre escenario actual` en verde · `− X € vs escenario actual` en rojo).

#### 5.6.1 · Tope sliders por tipo

| Tipo | Max aportación anual slider |
|---|---|
| PPI · PPA | 1.500 € (límite legal art. 51.6) |
| PPE | 10.000 € (1.500 titular + 8.500 empresa · art. 51.7) |
| PPES | 1.500 € general · 5.750 € si autónomo (art. 51.8) |

Si usuario marca check discapacidad en su perfil · subir hasta 24.250 €.

### 5.7 · Sección "Detalle fiscal y aportaciones" · PRESERVAR T13v4

Al final de la ficha · colapsable opcionalmente · 2 sub-secciones:

1. **Datos fiscales por plan + hogar** (T13v4) · MIGRAR tal cual la lógica · solo recolocar dentro del nuevo layout.
2. **Trayectoria de aportaciones** (T13v4) · MIGRAR tal cual.

CC NO toca · solo recoloca dentro del nuevo `FichaPlanPensiones.tsx`.

---

## 6 · Página `PosicionesCerradasPage.tsx` · armado nuevo

Estructura · siguiendo mockup `page-cerradas`:

1. **Back button** · "Volver a inversiones".
2. **H1** · "Posiciones cerradas" · subtítulo "activos que ya has vendido o liquidado · foco rentabilidad real".
3. **Bloque C1 · Hero patrimonio cerrado** · 4 KPIs.
4. **Bloque C3 · Best/worst** · 2 cards destacadas.
5. **Bloque C2 · Histograma rentabilidades** · 5 barras + banner análisis.
6. **Bloque C5 · Ranking por tipo** · tabla agrupada + banner análisis.
7. **Sec título "Detalle de operaciones"**.
8. **Filtros mínimos** · pills por tipo + orden.
9. **Listado tabular compacto** · 5 columnas · fecha · activo · aportado · tiempo · plusvalía · TWR.

### 6.1 · KPIs hero C1

Calcular desde `posicionesCerradas` (selector existente):
- `capitalInvertidoTotal` · suma de `valor_compra` de cerradas
- `plusvaliaNeta` · suma de `plusvalia` de cerradas
- `cagrMedioPonderado` · ponderado por capital invertido
- `aciertosRatio` · `cerradasGanadoras / totalCerradas`

### 6.2 · Best/worst C3

- Mejor · `max(plusvaliaPorcentual)` de cerradas
- Peor · `min(plusvaliaPorcentual)` de cerradas
- Mostrar nombre · fecha cierre · tiempo en cartera · porcentaje · euros

### 6.3 · Histograma C2

Bins fijos · `<0%` · `0-3%` · `3-10%` · `10-20%` · `>20%`.

Banner análisis · plantillas en función de distribución:
- Si >50% en negativo · "La mayoría de tus cierres han sido pérdidas · revisa tu estrategia"
- Si mayoría en 0-3% · "Tus cierres son tibios · plantéate horizontes más largos"
- Si mayoría >3% · "La mitad de tus operaciones cerradas acabaron en rentabilidad >3%"

### 6.4 · Ranking C5

Agrupar por `tipo` de la posición · ordenar por CAGR medio descendente:
- columnas · tipo · nº ops · capital · plusvalía · CAGR medio · tiempo medio
- destacar primera fila con tag `lead` (variante gold del tag)
- banner análisis · "Los X te han funcionado mejor · {Y} operaciones · CAGR medio {Z}%"

### 6.5 · Listado tabular detalle

Reutilizar `posicionesCerradasService` (existente). Solo cambiar el render. Sin foco fiscal.

Columnas mostradas:
- Activo (con tag tipo monocromático + nombre + meta gestora)
- Fecha cierre
- Aportado
- Tiempo en cartera (años/meses)
- Plusvalía (€ con color)
- TWR (% con color)

NO mostrar columnas fiscales (casilla · documento PDF) · esto vive en `/fiscal`.

Filtros mínimos · pills · Todas · {por tipo presente} · orden cierre.

---

## 7 · UI Ajustes · 2 secciones nuevas

### 7.1 · Ajustes → "Datos de mercado"

Ruta · `/ajustes/datos-mercado`.

UI:
- Tabla con todos los benchmarks del store.
- Columnas · código · nombre · tipo · valor último año · última actualización · acciones.
- Click en una fila · expande edición inline:
  - Editar nombre · descripción · fuente URL · nota interna.
  - Tabla anual editable · `año | valor (%) | acciones`.
  - Botón "Marcar todos como actualizados" · pone `ultimaActualizacion = today`.
- Botón header · "+ Añadir benchmark" · modal simple · código + nombre + tipo + divisa.
- Botón header · "Restaurar precarga" · sobreescribe con los 6 default de §8.

### 7.2 · Ajustes → "Avisos"

Ruta · `/ajustes/avisos`.

UI:
- Listado de `avisosUsuario.listarCerrados()` con · texto del aviso · fecha cierre · ubicación contexto.
- Click "Restaurar este aviso" · borra del store · vuelve a aparecer.
- Botón header · "Restaurar todos los avisos" · `restaurarTodos()`.

---

## 8 · Datos de precarga benchmarks

CC crea archivo `src/data/seeds/benchmarksReferencia.ts` con · estos 6 benchmarks · valores históricos al 31/12/2024 · datos públicos.

**IMPORTANTE** · CC NO inventa valores. Si no encuentra fuentes públicas verificables · marca el benchmark como `valoresAnuales: {}` y reporta a Jose para que él los introduzca manualmente.

Benchmarks a precargar:
1. `MSCI_WORLD_EUR` · MSCI World EUR · renta variable global
2. `SP500_EUR` · S&P 500 EUR · renta variable EEUU
3. `EUROSTOXX_50` · EURO STOXX 50 · renta variable europa
4. `BONDS_AGG_EUR` · Bloomberg Global Aggregate Bond EUR · renta fija global
5. `CPI_ES` · IPC España · inflación
6. `CPI_EUR` · HICP Zona Euro · inflación referencia

Para cada uno · valores anuales 2020 · 2021 · 2022 · 2023 · 2024 (5 años mínimos · TWR 5y se calcula desde aquí).

**Fuentes recomendadas (no normativo · CC decide):**
- MSCI · factsheets oficiales `msci.com`
- S&P · `spglobal.com`
- INE · `ine.es` para CPI España
- Eurostat para HICP zona euro
- Bloomberg/iShares para AGG

Si CC no quiere asumir responsabilidad de los valores · OPCIÓN B · precarga con `valoresAnuales: {}` y banner en UI Ajustes "Datos pendientes · introduce los valores manualmente".

---

## 9 · Centro de avisos cerrables

### 9.1 · IDs de avisos en esta tarea

```
benchmark-orange-loss        // banner P2 análisis benchmark
coste-ppe-info               // banner P3 PPE educativo
coste-cambio-gestora-cta     // banner P3 PPI accionable
hitos-info                   // banner P4 sin objetivos
cerradas-histo               // banner C2 distribución
cerradas-ranking             // banner C5 análisis tipos
```

Cada uno · clave única · cerrable con X · persistencia en `avisosUsuario`.

### 9.2 · Comportamiento

- Al cargar el componente · `if (estaAvisoActivo(avisoId)) renderiza` · sino `display: none`.
- Al click en X · `cerrarAviso(avisoId)` · oculta el banner con animación corta.
- Toast feedback · "Aviso cerrado · puedes restaurarlo desde Ajustes → Avisos".

---

## 10 · Entrega · 5 PRs secuenciales con stop-and-wait

| PR | Alcance | Validación Jose en Netlify |
|---|---|---|
| **PR 1** | Pre-flight + estructura `BloqueProyeccion` · `BloqueBenchmark` · `BloqueCostes` · `BloqueHitos` · `BloqueSandbox` shells + servicio `proyeccionInversionService` + tokens CSS módulo + tests smoke | `/inversiones/:planId` carga igual · 0 cambios visibles |
| **PR 2** | Store `benchmarksReferencia` v72 + UI Ajustes → "Datos de mercado" + precarga 6 benchmarks | Ajustes → Datos de mercado funciona · 6 benchmarks editables · valores precargados |
| **PR 3** | Extensión Mi Plan (`edadObjetivoRescate` · `inflacionAnualAsumida` · campos UI editables) + verificación/extensión Objetivos vitales + store `avisosUsuario` + UI Ajustes → "Avisos" | Mi Plan permite ajustar edad rescate · inflación · objetivos vitales · centro avisos vacío inicialmente |
| **PR 4** | Ficha PP rediseñada · 5 bloques chicha · tipo-aware (PPI/PPE/PPES/PPA) · preservar 2 secciones T13v4 al pie · chips fuente · banners cerrables con IDs §9.1 | Visitar Plan Orange (PPE) muestra los 5 bloques · sandbox interactivo funciona · cerrar aviso persiste tras reload · datos fiscales T13v4 siguen ahí |
| **PR 5** | Página posiciones cerradas rediseñada · C1 hero + C2 histograma + C3 best/worst + C5 ranking + listado detalle sin foco fiscal · paleta monocromática · banners cerrables | Posiciones cerradas muestra 4 KPIs · histograma · best/worst · ranking por tipo · listado detalle sin columnas fiscales |

**Reglas inviolables entre PRs:**
1. CC NO abre PR N+1 sin OK explícito de Jose al PR N en Netlify deploy review.
2. Tests pre-existentes baseline NO se tocan.
3. Si un PR rompe algún test verde existente · revert y reportar.
4. Cada PR revert-able sin tocar los anteriores.
5. Aplicar checklist v5 §17 ANTES de marcar cada PR ready-for-review.

---

## 11 · Tests · smoke nuevos

| PR | Test | Cobertura mínima |
|---|---|---|
| 1 | `proyeccionInversionService.test.ts` | proyección con saldo 35.491 · aportes 1.500/año · TWR -0,1% · 23 años → valor final aproximado 79k · ±5% margen |
| 1 | `BloqueProyeccion.test.tsx` | render con datos mock · toggle escenarios cambia clase active |
| 2 | `benchmarksReferenciaService.test.ts` | CRUD básico · precarga inicial · update valor anual |
| 2 | `AjustesDatosMercado.test.tsx` | render tabla · click expande edición · save persiste |
| 3 | `miPlanService.test.ts` | get/set `edadObjetivoRescate` · `inflacionAnualAsumida` · default 65/2% |
| 3 | `avisosUsuarioService.test.ts` | cerrarAviso · estaAvisoActivo · restaurarTodos |
| 4 | `FichaPlanPensiones.test.tsx` | render PPE muestra "Lo que cuesta tener este plan" · render PPI muestra "Lo que te cobra la gestora" · 2 secciones T13v4 presentes |
| 4 | `BloqueCostes.test.tsx` | tipo PPE NO muestra botón "Buscar plan con TER menor" · tipo PPI sí |
| 4 | `BloqueSandbox.test.tsx` | recálculo dinámico · slider TWR 5% · valor final correcto |
| 5 | `PosicionesCerradasPage.test.tsx` | 4 KPIs presentes · histograma 5 bins · best/worst · ranking tabla |
| 5 | `posicionesCerradasService.test.ts` | calcular `cagrMedioPonderado` · `aciertosRatio` correctos con mock |

Total · 11 tests smoke nuevos · 0 tests baseline tocados.

---

## 12 · Checklist v5 obligatorio (sección 17)

CC corre antes de marcar cada PR ready-for-review.

### Tokens
- [ ] No hex hardcoded · todo vía variables Oxford Gold
- [ ] Solo paleta Oxford Gold · sin lavanda/rosa/azul-claro
- [ ] Inter + JetBrains Mono · `font-variant-numeric: tabular-nums` en todo `.mono`

### Layout
- [ ] Sidebar 11 items orden canónico
- [ ] Topbar (cinta resumen) preservada
- [ ] Main padding 22px 32px 60px · max-width 1520px

### Tags monocromáticos
- [ ] `ranking-tag` solo `card-alt` + `line` + `ink-3` · variante `lead` con `gold-wash`
- [ ] `tag-tipo` en listado cerradas monocromático
- [ ] Histograma · gradiente neutro→gold · sin rosa/morado/verde-pastel

### Chips fuente
- [ ] Click en chip navega al origen (Mi Plan · Ajustes · Personal)
- [ ] Estilo · `--ink-4` discreto · hover `--gold-ink`

### Callouts cerrables
- [ ] Todos los banners tienen botón X
- [ ] Click cierra · persiste en `avisosUsuario`
- [ ] Restaurables desde Ajustes → Avisos
- [ ] IDs únicos según §9.1

### Tipo-aware
- [ ] PPE muestra coste informativo · NO accionable
- [ ] PPI/PPA/PPES muestra coste accionable
- [ ] Sandbox tope sliders correcto por tipo (§5.6.1)
- [ ] Mensaje P1 cambia según tipo

### Chips datos dinámicos
- [ ] Edad rescate viene de `miPlan` · NO hardcoded
- [ ] Inflación viene de `miPlan` · NO hardcoded
- [ ] Benchmarks vienen de store `benchmarksReferencia` · NO hardcoded

### Preservación T13 v4
- [ ] Las 2 secciones T13v4 siguen renderizando intactas
- [ ] `limitesFiscalesPlanesService.ts` NO se toca
- [ ] `aeatPlanesPensionesImportService.ts` NO se toca

### Componentes nuevos genéricos para reuso futuro
- [ ] `BloqueProyeccion` · prop `tipoActivo` · agnostic
- [ ] `proyeccionInversionService` · NO referencia plan_pensiones específico
- [ ] `BloqueBenchmark` · funciona con cualquier `politicaInversion`

### Cleanup
- [ ] 0 referencias residuales a componentes antiguos sustituidos
- [ ] `grep -r` previo a cada delete · 0 hits

---

## 13 · Riesgos identificados · mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| CC se salta el pre-flight §0 | Alta · pasó en T13v3 y T14v1 | Stop-and-wait obligatorio · Jose NO da OK sin ver comentario auditoría |
| Cálculo proyección numéricamente incorrecto | Media | Test PR1 con caso real conocido · ±5% margen |
| Precarga benchmarks con valores inventados | Media | Opción B explicita · si CC no encuentra fuente verificable · `valoresAnuales: {}` y avisar Jose |
| Tipo-aware mal aplicado en PPE | Media | Test PR4 obligatorio · checklist específico §12 |
| Las 2 secciones T13v4 se rompen al recolocar | Media | Test PR4 obligatorio · validación visual Jose en Netlify |
| Mi Plan no tiene los campos asumidos | Alta · spec asume · realidad puede ser distinta | Auditoría §0.2 ANTES del primer PR · si falta · CC lo crea según §4.B |
| Objetivos vitales no existen en Mi Plan | Media | §4.C cubre caso A y caso B · CC lo audita y decide |
| `proyeccionInversionService` se acopla a tipo plan | Media | Checklist explicito · función genérica · futuro reuso |
| Centro de avisos llena el sidebar de Ajustes | Baja | Solo 2 secciones nuevas en Ajustes · "Datos de mercado" · "Avisos" |
| Performance del sandbox · re-render cada slider | Baja | `useMemo` en cálculo · debounce 50ms si lag |

---

## 14 · Fuera de alcance · explícito

- Las 5 fichas de los otros tipos (fondo · acción · préstamo · depósito · crypto).
- Integración API externa de benchmarks (Yahoo · Alpha Vantage · etc.).
- Sparkline mensual real desde valoraciones históricas.
- Cambios en módulo galería · modales · servicios fiscales · servicios de planes.
- Régimen art. 94 LIRPF.
- Wrapper `planesInversionService` (sigue activo).
- Borrado zombie `InversionesPage` horizon (sigue en backlog).
- Notificaciones push de hitos próximos (futuro).

---

## 15 · Documentos relacionados · CC debe leerlos antes

1. **`atlas-inversiones-fichas-v2.html`** · mockup vinculante · referencia visual exhaustiva.
2. **`GUIA-DISENO-V5-atlas.md`** · paleta · tokens · checklist §17.
3. **`TAREA-CC-T-INVERSIONES-V5-rediseno-modulo-inversiones.md`** · contexto de la tarea predecesora (ya cerrada).
4. **HANDOFF más reciente** · estado del repo tras T-INVERSIONES-V5.

---

## 16 · Resumen ejecutivo

- ✅ Rediseño ficha plan pensiones · 5 bloques chicha · tipo-aware (PPI/PPE/PPES/PPA).
- ✅ Rediseño posiciones cerradas · foco rentabilidad · sin foco fiscal.
- ✅ Store nuevo `benchmarksReferencia` v72 + UI Ajustes editable.
- ✅ Extensión Mi Plan · edad rescate · inflación · objetivos vitales.
- ✅ Servicio nuevo `proyeccionInversionService` genérico para reuso futuro.
- ✅ Sistema de avisos cerrables con centro en Ajustes.
- ✅ Paleta sobria · tags monocromáticos · sin colorinchis.
- ✅ Chips "fuente del dato" · transparencia sobre origen.
- ✅ 5 PRs secuenciales con stop-and-wait + validación Jose entre cada uno.
- ✅ Preservación intacta de las 2 secciones T13v4.
- ❌ Fichas fondo · acción · préstamo · depósito · crypto · siguientes tareas.
- ❌ API externa benchmarks · diferido.

---

**Fin de spec.** CC arranca por §0 pre-flight obligatorio. Una vez OK Jose · PR 1.
