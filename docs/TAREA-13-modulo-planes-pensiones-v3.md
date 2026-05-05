# TAREA CC · TAREA 13 · Módulo Planes de Pensiones · v3

> **Tipo** · diseño + implementación · módulo nuevo que reemplaza arquitectura actual
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama** · crear `feature/planes-pensiones-modulo` desde `main`
>
> **Cobertura** · PPI + PPE (empleador único + PPEPC) + PPES (4 submodalidades) + PPA (como flag)
>
> **NO cubre en esta tarea** · EPSV (País Vasco · TAREA futura) · Mutualidades profesionales (TAREA futura) · PPSE · Sistema Asociado
>
> **Tiempo estimado** · 6.5-9h Copilot · 4-5h tu revisión · total **10-14h**
>
> **Prioridad** · ALTA · bloquea importación XML AEAT correcta · bloquea salida a usuarios reales
>
> **Predecesores** · TAREA 7 cerrada (sub-tarea 8 mergeada · `STORES-V60-ACTIVOS.md` existe en repo) · T34 + T35 + T34-fix + T35-fix + T34.b + T35.b + T38 + T39 mergeadas
>
> **DB de partida** · DB_VERSION **68** · 40 stores
>
> **DB tras esta tarea** · DB_VERSION **69** · 41 stores
>
> **Cambios respecto v2** · DB_VERSION refrescada de v64→v65 a v68→v69 · conteo stores de 39→40 a 40→41 · caso real ING/Indexa/MyInvestor aclarado como 1 plan con identidad estable · sub-tarea 13.7 nueva (servicio rentabilidad TWR + UI) · scope negativo actualizado

---

## 1 · Contexto · qué problemas resuelve esta tarea

### 1.1 · Bug detectado en TAREA 7-bis

Los planes de pensiones se escriben hoy en 2 stores distintos según vía de entrada:
- **UI manual** · escribe en `inversiones` con `tipo: 'plan_pensiones'`
- **XML AEAT** · escribe en `planesPensionInversion`

Resultado · `planesPensionInversion` es zombie funcional · `inversiones` mezcla activos financieros con planes de pensiones.

### 1.2 · Caso real Jose · trayectoria ING → Indexa → MyInvestor (PPI · 1 plan · 3 gestoras)

**Es 1 solo plan con identidad estable** · NO 3 inversiones separadas. El dinero contratado en 2017 es el mismo que viaja entre gestoras.

| Año | Gestora | Valor en momento del traspaso |
|---|---|---|
| 2017 | ING (contratación) | 45.000 € |
| 2021 | Traspaso a Indexa | 56.000 € |
| 2025 | Traspaso a MyInvestor | 86.000 € |
| 2026 (hoy) | MyInvestor | 96.000 € |

**Lo que el usuario quiere ver:**
1. Rentabilidad acumulada total del plan desde 2017 hasta hoy (capital aportado · valor actual · plusvalía · TWR anualizado · MWR anualizado · periodo)
2. Rentabilidad **por bloque · 1 bloque = 1 gestora** · para entender si los traspasos fueron decisiones acertadas
3. Comparación visual entre bloques (semáforo neutro · mejor / igual / peor que el bloque anterior)

**Implicación de modelo:** el plan se gestiona como **1 ficha única con `id` UUID estable**. El traspaso es un evento dentro del plan · NO crea ficha nueva · NO cierra la anterior. Las aportaciones siguen apuntando al MISMO `planId` antes y después del traspaso.

### 1.3 · Caso real Jose · plan empleo Orange (PPE · empleador único)

Plan de pensiones de empleo gestionado por BBVA · vinculado a la nómina de Orange España.
- Tipo administrativo · PPE
- Subtipo · empleador único
- Empresa pagadora · Orange España S.A.U. (CIF A82009812)
- Aportación titular + aportación empresa · ambas al MISMO plan
- Vínculo nómina↔plan ya implementado (NominaWizard)

### 1.4 · Realidad legal de los planes de pensiones en España

Tras investigación · existen 5 productos distintos · esta tarea cubre **4 de los 5** y deja PPA como variante de PPI:

| Tipo | Nombre completo | Quién lo contrata | Límite anual 2026 |
|---|---|---|---|
| PPI | Plan de Pensiones Individual | Persona física en banco/aseguradora | 1.500 € |
| PPE | Plan de Pensiones de Empleo | Empresa para sus empleados | 10.000 € (8.500 € empresa) |
| PPES | Plan de Pensiones de Empleo Simplificado | Sectorial/público/cooperativas/autónomos | Variable según submodalidad · autónomo: 4.250 € adicionales |
| PPA | Plan de Previsión Asegurado | Persona física · seguro garantizado | 1.500 € (igual que PPI) |
| EPSV | Entidad Previsión Social Voluntaria | Solo País Vasco | NO se cubre en esta TAREA |

### 1.5 · Decisiones consolidadas previas (de chats anteriores · NO se tocan)

1. **Vínculo nómina ↔ plan ya implementado** · `NominaWizard` tiene selector "¿A qué plan va?". Cuando se confirma una nómina · ATLAS genera automáticamente apunte de aportación al plan vinculado.
2. **Las 2 aportaciones (titular + empresa) van AL MISMO plan** · no separadas.
3. **Importación XML AEAT** · solo trae planes con aportaciones del ejercicio. Plan sin aportaciones requiere alta manual.
4. **Sección Cartera de Inversiones ya muestra planes** · solo cambia la fuente de datos.
5. **Plan de pensiones COBRADO (rescate) NO entra aquí** · va a `ingresos.tipo='pension'`. Esta tarea trata el plan ACTIVO.

---

## 2 · Modelo de datos propuesto

### 2.1 · Store nuevo · `planesPensiones` (entidad estable)

```typescript
type TipoAdministrativo = 'PPI' | 'PPE' | 'PPES' | 'PPA';

type SubtipoPPE = 'empleador_unico' | 'promocion_conjunta';

type SubtipoPPES = 'sectorial' | 'sector_publico' | 'cooperativas' | 'autonomos';

type PoliticaInversion = 
  | 'renta_fija_corto' 
  | 'renta_fija_largo' 
  | 'renta_variable' 
  | 'renta_mixta' 
  | 'garantizado' 
  | 'ciclo_vida'
  | 'desconocido';

type ModalidadAportacion = 'aportacion_definida' | 'prestacion_definida' | 'mixto';

type EstadoPlan = 'activo' | 'rescatado_total' | 'rescatado_parcial' | 'traspasado_externo';

interface PlanPensiones {
  id: string;                              // UUID estable durante toda la trayectoria
  
  // Identificación
  nombre: string;                          // "Plan jubilación 2017" · nombre amigable
  titular: 'yo' | 'pareja';
  personalDataId: number;                  // FK a personalData
  
  // Clasificación administrativa (según ley)
  tipoAdministrativo: TipoAdministrativo;
  subtipoPPE?: SubtipoPPE;                 // solo si tipoAdministrativo='PPE'
  subtipoPPES?: SubtipoPPES;               // solo si tipoAdministrativo='PPES'
  garantizado?: boolean;                   // true para PPA · false para resto
  
  // Política de inversión (informativa · puede cambiar al traspasar)
  politicaInversion?: PoliticaInversion;
  porcentajeRentaVariable?: number;        // 0-100 · solo si politicaInversion='renta_mixta'
  
  // Modalidad
  modalidadAportacion?: ModalidadAportacion;
  
  // Estado actual (denormalizado para queries rápidas)
  gestoraActual: string;                   // "MyInvestor" · "BBVA" · etc.
  isinActual?: string;                     // ISIN del plan en la gestora actual · puede no tener (PPE)
  fechaUltimaValoracion?: string;          // YYYY-MM-DD
  valorActual?: number;                    // valor liquidativo actual
  
  // Datos de inicio (no cambian)
  fechaContratacion: string;               // YYYY-MM-DD
  importeInicial?: number;
  
  // Plan de empleo / PPES con empresa
  empresaPagadora?: {
    cif: string;
    nombre: string;
    ingresoIdVinculado?: string;           // FK a ingresos.id si vinculado a nómina
  };
  
  // Discapacidad (afecta límites fiscales)
  partícipeConDiscapacidad?: boolean;      // ≥65% física/sensorial o ≥33% psíquica
  
  // Estado del plan
  estado: EstadoPlan;
  
  // Fechas de gestión
  fechaCreacion: string;
  fechaActualizacion: string;
  
  // Origen del registro
  origen: 'manual' | 'xml_aeat' | 'migrado_v60';
}
```

**Indexes:**
- `personalDataId` (queries por titular)
- `tipoAdministrativo` (filtrar por PPI · PPE · PPES · PPA)
- `estado` (mostrar solo activos por defecto)
- `titular`

**keyPath:** `id`

---

### 2.2 · Store nuevo · `aportacionesPlan` (eventos · cardinalidad alta)

```typescript
type OrigenAportacion = 
  | 'manual'
  | 'xml_aeat'
  | 'nomina_vinculada'
  | 'migrado_v60';

type GranularidadAportacion = 'anual' | 'mensual' | 'puntual';

type AportanteRol = 'titular' | 'empresa' | 'conyuge';

interface AportacionPlan {
  id: string;
  planId: string;                          // FK a planesPensiones · ESTABLE entre traspasos
  
  // Cuando · qué año fiscal
  fecha: string;                           // YYYY-MM-DD
  ejercicioFiscal: number;
  
  // Cuánto · de quién
  importeTitular: number;
  importeEmpresa: number;                  // 0 si plan individual
  importeConyuge?: number;                 // caso especial · cónyuge sin rentas
  
  // Origen
  origen: OrigenAportacion;
  
  // Vínculo si vino de nómina
  ingresoIdNomina?: string;
  movementId?: string;
  
  // Granularidad
  granularidad: GranularidadAportacion;
  mesesCubrios?: number;
  
  // Casilla AEAT donde se declaró
  casillaAEAT?: string;
  
  // Notas
  notas?: string;
  
  // Fechas gestión
  fechaCreacion: string;
  fechaActualizacion: string;
}
```

**Indexes:**
- `planId` (CRÍTICO · queries de aportaciones por plan)
- `ejercicioFiscal`
- `[planId+ejercicioFiscal]` (compuesto)
- `origen`
- `ingresoIdNomina`

**keyPath:** `id`

---

### 2.3 · Store renombrado · `traspasosPlanes` → `traspasosPlanPensiones`

```typescript
interface TraspasoPlanPensiones {
  id: string;
  planId: string;                          // FK · MISMO plan antes y después
  
  // Cuando
  fechaSolicitud: string;
  fechaEjecucion: string;                  // (puede tardar 7-15 días)
  
  // De dónde a dónde
  gestoraOrigen: string;
  gestoraDestino: string;
  isinOrigen?: string;
  isinDestino?: string;
  
  // ¿Cambia tipo administrativo? (raro · pero puede pasar)
  tipoAdministrativoOrigen?: TipoAdministrativo;
  tipoAdministrativoDestino?: TipoAdministrativo;
  
  // Política inversión origen/destino (informativo)
  politicaInversionOrigen?: PoliticaInversion;
  politicaInversionDestino?: PoliticaInversion;
  
  // Valor en el momento del traspaso (CRÍTICO para cálculo rentabilidad por bloque)
  valorTraspaso: number;
  
  // Aportaciones acumuladas hasta ese momento (base de coste)
  aportacionesAcumuladasMomento?: number;
  
  // Notas
  notas?: string;
  
  // Fechas gestión
  fechaCreacion: string;
  fechaActualizacion: string;
}
```

**Indexes:**
- `planId`
- `fechaEjecucion`

**keyPath:** `id`

---

### 2.4 · Cómo se gestionan las VALORACIONES · uso de `valoraciones_historicas`

`valoraciones_historicas` ya existe (180 registros · uso intensivo). Es el store genérico.

**NO se crea sub-store de valoraciones de plan.** Se usa `valoraciones_historicas`:

```typescript
{
  tipo_activo: 'plan_pensiones',
  activo_id: '<id del plan>',
  activo_nombre: 'Plan jubilación 2017',
  fecha_valoracion: '2026-04-26',
  valor: 96000,
  origen: 'manual' | 'xml_aeat' | 'gestora_api'
}
```

---

## 3 · Servicio fiscal · cálculo de límites y validación

Esta es la pieza nueva más importante a nivel fiscal. ATLAS ahora ENTIENDE las reglas de límites.

### 3.1 · Tabla de límites por tipo (territorio común · 2026)

```typescript
// src/services/limitesFiscalesPlanesService.ts

const LIMITES_2026_TERRITORIO_COMUN = {
  PPI: {
    limiteAnual: 1500,
    porcentajeMaxRendimientos: 30,
  },
  PPA: {
    limiteAnual: 1500,                     // mismo que PPI (es seguro · misma fiscalidad)
    porcentajeMaxRendimientos: 30,
  },
  PPE: {
    limiteAnualEmpresa: 8500,
    limiteAnualConjunto: 10000,            // empresa + empleado
    porcentajeMaxRendimientos: 30,
  },
  PPES_autonomos: {
    limiteAnualAdicional: 4250,            // adicional al PPI · total autónomo: 5750
    porcentajeMaxRendimientos: 30,
  },
  PPES_sectorial: {
    limiteAnualConjunto: 10000,
  },
  PPES_publico: {
    limiteAnualConjunto: 10000,
  },
  PPES_cooperativas: {
    limiteAnualConjunto: 10000,
  },
  conyugeSinRentas: {
    limiteAnual: 1000,
    importeBaseImponibleMaximo: 8000,
  },
  discapacidad: {
    limiteAnualGeneral: 24250,
  },
};
```

### 3.2 · Función · validar aportación

```typescript
function validarAportacionDeducible(
  planId: string,
  importe: number,
  ejercicioFiscal: number,
  rolAportante: AportanteRol = 'titular'
): {
  esDeducible: boolean;
  importeDeducible: number;
  excesoNoDeducible: number;
  motivo?: string;
  limiteAplicable: number;
  totalAportadoEjercicio: number;
}
```

Lógica:
1. Obtiene plan · su `tipoAdministrativo` · subtipos
2. Calcula totales del ejercicio para todos los planes del titular agregados
3. Calcula límite aplicable según tipo + situación personal del titular
4. Aplica el menor entre · límite € y 30% rendimientos netos
5. Devuelve si la aportación es deducible y cuánto

### 3.3 · Función · calcular reducción base imponible

```typescript
function calcularReduccionBaseImponible(
  personalDataId: number,
  ejercicioFiscal: number
): {
  totalAportadoTitular: number;
  totalAportadoEmpresa: number;
  totalAportadoConyuge: number;
  
  desgloseDeduciblesPorTipo: {
    PPI: number;
    PPA: number;
    PPE: number;
    PPES_autonomos: number;
    PPES_sectorial: number;
    PPES_publico: number;
    PPES_cooperativas: number;
  };
  
  totalDeducibleAplicado: number;
  excesoArrastrable: number;               // se puede aplicar en 5 años siguientes
  
  alertas?: string[];
}
```

### 3.4 · Mapeo casillas AEAT por tipo

```typescript
const CASILLAS_AEAT_2026 = {
  PPI: '0465',                             // VERIFICAR contra docs AEAT
  PPE: '0466',
  PPES_autonomos: '0470',
  // ... resto
};
```

⚠ **NOTA:** los códigos exactos deben verificarse contra documentación AEAT antes de implementar. CC investiga las casillas reales si tiene duda · si no puede confirmar · marca TODO con número probable y avisa.

---

## 4 · Servicio rentabilidad · cálculo total y por bloque ★ NUEVO

Esta es la pieza nueva más importante a nivel UX. Responde a la pregunta del usuario "¿fueron correctos los traspasos?".

### 4.1 · Concepto · 1 plan · N bloques

Un plan tiene N bloques delimitados por traspasos:
- Bloque 1 · desde `fechaContratacion` hasta primer traspaso (`fechaEjecucion` del traspaso 1)
- Bloque 2 · desde primer traspaso hasta segundo traspaso
- ...
- Bloque N · desde último traspaso hasta hoy (gestora actual)

Cada bloque tiene su propia rentabilidad · independiente del resto. La rentabilidad TOTAL del plan es la composición de las rentabilidades de los bloques (no su simple suma).

### 4.2 · Métricas calculadas

| Métrica | Qué representa | Cuándo se usa |
|---|---|---|
| **Capital aportado** | Suma de `aportacionesPlan.importeTitular + importeEmpresa + importeConyuge` en el periodo | KPI básico |
| **Valor actual** | Última `valoraciones_historicas` del plan (o `planesPensiones.valorActual`) | KPI básico |
| **Plusvalía absoluta** | Valor actual − Capital aportado | KPI básico |
| **Plusvalía relativa %** | Plusvalía absoluta / Capital aportado | KPI sencillo |
| **TWR anualizado** | Time-Weighted Return · neutraliza efecto de aportaciones | Comparar gestoras entre sí |
| **MWR anualizado (IRR)** | Money-Weighted Return · ponderado por cuándo entró el dinero | Saber tu rentabilidad efectiva |
| **Periodo en años** | Diferencia en años entre fecha inicio y fecha fin | Contextualiza el rendimiento |

### 4.3 · Algoritmo TWR (Time-Weighted Return)

Para un periodo con cash flows intermedios (aportaciones):

1. Dividir el periodo en sub-periodos delimitados por cada cash flow
2. Para cada sub-periodo · calcular HPR (Holding Period Return):
   ```
   HPR_i = (V_fin_i − CF_i) / V_ini_i − 1
   ```
   donde `CF_i` es el cash flow al final del sub-periodo (positivo si aportación · negativo si retirada)
3. Componer los HPR:
   ```
   TWR_periodo = ∏(1 + HPR_i) − 1
   ```
4. Anualizar:
   ```
   TWR_anualizado = (1 + TWR_periodo)^(1 / años) − 1
   ```

Si el periodo es < 1 año · NO anualizar · mostrar como "+X% en N meses".

### 4.4 · Algoritmo MWR (Money-Weighted Return / IRR)

Es el IRR de los flujos de caja:
- Aportaciones como flujos negativos (en su fecha)
- Valor actual como flujo positivo (en fecha de evaluación)
- Resolver para r:
  ```
  Σ CF_t / (1 + r)^t = 0
  ```
  donde t es años desde el primer flujo

Implementación · Newton-Raphson con tolerancia 1e-6 · max 100 iteraciones · valor inicial r=0.05.

Si el algoritmo no converge · devolver `null` y log de warning.

### 4.5 · Servicio · `rentabilidadPlanService.ts`

```typescript
// src/services/rentabilidadPlanService.ts

interface RentabilidadTotal {
  planId: string;
  capitalAportadoTotal: number;
  valorActual: number;
  plusvaliaAbsoluta: number;
  plusvaliaRelativa: number;               // %
  TWR: number | null;                      // % anualizado · null si <1 año o no calculable
  MWR: number | null;                      // % anualizado · null si no converge
  periodoAños: number;
  fechaInicio: string;
  fechaFin: string;
  numeroBloques: number;
}

interface RentabilidadBloque {
  bloqueIndex: number;                     // 1, 2, 3...
  gestora: string;
  isin?: string;
  fechaInicio: string;
  fechaFin: string;                        // si es el último bloque · es "hoy"
  esBloqueActual: boolean;
  
  valorInicio: number;                     // 0 si bloque 1 · valorTraspaso si N>1
  valorFin: number;                        // valorTraspaso del siguiente · o valorActual si último
  
  aportacionesBloque: number;              // suma de aportaciones durante el bloque
  
  plusvaliaAbsoluta: number;
  plusvaliaRelativa: number;               // %
  TWR: number | null;
  MWR: number | null;
  
  periodoAños: number;
  
  // Comparativa con bloque anterior
  diferenciaConAnterior?: {
    deltaTWR: number | null;               // TWR_actual − TWR_anterior · puntos porcentuales
    semaforo: 'mejor' | 'igual' | 'peor' | 'sin_comparar';
  };
}

interface RentabilidadComparativa {
  planId: string;
  bloques: RentabilidadBloque[];
  conclusionGeneral: 'mejorando' | 'empeorando' | 'mixto' | 'estable';
}

// Funciones públicas
function getRentabilidadTotal(planId: string): Promise<RentabilidadTotal>;
function getRentabilidadPorBloque(planId: string): Promise<RentabilidadBloque[]>;
function getRentabilidadComparativaBloques(planId: string): Promise<RentabilidadComparativa>;
```

### 4.6 · Reglas y casos especiales

| Caso | Comportamiento |
|---|---|
| Plan recién creado (sin valoraciones · sin aportaciones registradas) | Devolver TWR/MWR/plusvalía como `null` · NO se pinta KPI |
| Plan con 1 sola valoración (la actual) | Plusvalía simple solo · TWR/MWR `null` |
| Plan con < 1 año de historia | TWR sin anualizar · mostrar como "+X% en N meses" |
| Plan migrado v60 sin histórico fino | Calcular con los datos disponibles · marcar advertencia "rentabilidad estimada con datos parciales" |
| Plan con un único bloque | `getRentabilidadPorBloque` devuelve array de 1 elemento · semáforo `sin_comparar` |
| Bloque con 0 aportaciones intermedias (caso típico Jose) | TWR = MWR = (valorFin − valorInicio) / valorInicio anualizado |

### 4.7 · UI · dónde se muestra cada métrica

**Sección 1 · Resumen del plan** (cabecera):
```
[Badge PPI]  Plan jubilación 2017  ·  Titular: yo
─────────────────────────────────────────────────
Valor actual              96.000 €
Total aportado            45.000 €
Plusvalía                 +51.000 €  (+113%)
Rentabilidad anualizada   TWR 8,7%/año  ·  MWR 8,5%/año
Periodo                   9 años (desde 2017)
Gestora actual            MyInvestor (ISIN ESxxxxxx)
```

**Sección 2 · Trayectoria timeline** (cada evento de traspaso muestra el cierre del bloque):
```
●  2017-01-15 · Contratación en ING · 45.000 €
│
●  2021-03-22 · Traspaso ING → Indexa · 56.000 €
│  Bloque cerrado · ING (4 años) · TWR 5,5%/año · +24%
│
●  2025-06-10 · Traspaso Indexa → MyInvestor · 86.000 €
│  Bloque cerrado · Indexa (4 años) · TWR 11,2%/año · +54%  [▲ mejor que anterior]
│
●  Hoy · MyInvestor · 96.000 €
   Bloque vivo · MyInvestor (~1 año) · TWR ~12,0%/año · +12%
```

**Sección 5 · Traspasos** (tabla con comparativa visual):

| # | Gestora | Periodo | Valor inicio | Valor fin | Aportes | Plusvalía | TWR/año | vs anterior |
|---|---|---|---|---|---|---|---|---|
| 1 | ING | 2017–2021 | 45.000 € | 56.000 € | 0 € | +24% | 5,5% | — |
| 2 | Indexa | 2021–2025 | 56.000 € | 86.000 € | 0 € | +54% | 11,2% | ▲ +5,7 pp |
| 3 | MyInvestor | 2025–hoy | 86.000 € | 96.000 € | 0 € | +12% | ~12,0% | ▲ +0,8 pp |

Semáforo neutro · ▲ verde · = ámbar · ▼ rojo. Diferencia en puntos porcentuales (pp).

### 4.8 · Tests obligatorios

- Caso Jose ING/Indexa/MyInvestor con datos exactos · verificar números frente a referencia calculada externamente
- Caso plan recién creado · TWR `null` · UI no muestra KPI
- Caso plan con 1 traspaso · 2 bloques · semáforo del bloque 2
- Caso plan con aportaciones intermedias en cada bloque · TWR y MWR diferentes
- Caso periodo < 1 año · TWR no anualizado
- Caso MWR no converge · devuelve `null` · log warning

---

## 5 · Flujos de datos · cómo se rellenan los stores

### 5.1 · Alta manual de PPI

Usuario · "Crear plan de pensiones" · selecciona tipo PPI.

1. Crear `planesPensiones`:
   - `tipoAdministrativo: 'PPI'`
   - `garantizado: false`
   - resto de campos
2. Si aporta importe inicial → primera entrada `aportacionesPlan`
3. Si conoce valor actual → entrada en `valoraciones_historicas`

### 5.2 · Alta manual de PPA

Igual que PPI pero con `tipoAdministrativo: 'PPA'` y `garantizado: true`.

### 5.3 · Alta manual de PPE empleador único (caso Orange Jose)

1. Crear `planesPensiones`:
   - `tipoAdministrativo: 'PPE'`
   - `subtipoPPE: 'empleador_unico'`
   - `empresaPagadora: { cif: 'A82009812', nombre: 'Orange España S.A.U.' }`
2. Aportaciones se generan automáticamente al confirmar nóminas (§5.6)

### 5.4 · Alta manual de PPES autónomos

1. Crear `planesPensiones`:
   - `tipoAdministrativo: 'PPES'`
   - `subtipoPPES: 'autonomos'`
2. Aportaciones manuales · puntuales o periódicas

### 5.5 · Importación XML AEAT

1. XML AEAT distingue tipos por casilla · CC mapea casilla → tipo
2. Buscar coincidencia con plan existente
3. Si NO existe · crear `planesPensiones` con tipo inferido
4. Crear entrada en `aportacionesPlan` con el importe + `casillaAEAT`
5. Si XML trae valor del plan → entrada en `valoraciones_historicas`

### 5.6 · Vínculo nómina-plan (PPE / PPES con empresa)

1. `ingresos.tipo='nomina'` con `metadata.nomina.aportacionPlanPensiones`:
   ```
   {
     planId: string,
     aportacionTitularMensual: number,
     aportacionEmpresaMensual: number
   }
   ```
2. Cobro mensual → `treasuryEvents` proyecta evento
3. Confirmación nómina → ATLAS crea:
   - `movements` · ingreso neto en cuenta
   - `aportacionesPlan` · `granularidad: 'mensual'` · `origen: 'nomina_vinculada'` · `ingresoIdNomina` · `movementId`

### 5.7 · Aportación de cónyuge (caso especial)

1. Aportación se registra en `aportacionesPlan` del plan del CÓNYUGE
2. `importeConyuge` · `importeTitular: 0` · `importeEmpresa: 0`
3. La deducción la aplica el titular aportante en su declaración
4. ATLAS valida que el cónyuge tiene base imponible < 8.000 €

### 5.8 · Traspaso de plan entre gestoras (caso Jose ING → Indexa → MyInvestor)

1. Usuario pulsa "Registrar traspaso" en la ficha del plan
2. Wizard de 1 paso · gestora destino · ISIN nuevo · fecha solicitud · fecha ejecución · valor en momento del traspaso
3. Crear registro en `traspasosPlanPensiones` con `planId` ESTABLE
4. Actualizar `planesPensiones`:
   - `gestoraActual` ← gestora destino
   - `isinActual` ← ISIN destino
   - `politicaInversion` (si cambia) ← nueva
5. Crear entrada en `valoraciones_historicas` con valor del traspaso (fecha = `fechaEjecucion`)
6. Aportaciones existentes siguen apuntando al MISMO `planId`
7. `rentabilidadPlanService` recalcula automáticamente al pintar la ficha · cierra el bloque anterior y abre uno nuevo

---

## 6 · Migración desde V68 a V69

### 6.1 · Datos a migrar

**Origen A · `inversiones[tipo='plan_pensiones']`** (caso Jose · 2 registros)
- "ORANGE ESPAGNE SA" · BBVA · ~35.491 € valor · ~6.420 € aportado · 4 años · 119 aportaciones → PPE empleador único Orange
- Posible plan PPI MyInvestor (verificar en DevTools antes de migrar) → PPI · trayectoria ING/Indexa/MyInvestor (si aplica)

**Origen B · `planesPensionInversion`** (vacío hoy)

### 6.2 · Lógica de migración · inferir tipo administrativo

Para cada registro en `inversiones` con `tipo='plan_pensiones'`:

1. **Inferir `tipoAdministrativo`:**
   - Si tiene `empresaPagadora` o existe nómina vinculada → **PPE** (subtipo `empleador_unico` por defecto)
   - Si NO tiene empresa pero el titular es autónomo (`personalData.situacionLaboral` incluye 'autonomo') → **PPES** (subtipo `autonomos`)
   - Si NO tiene empresa y no es autónomo → **PPI** (default)
   - PPA · NO se infiere · marca como PPI · usuario lo cambia si era PPA garantizado
2. Crear `planesPensiones` con tipo inferido · `origen: 'migrado_v60'`
3. Por cada item en `aportaciones[]`:
   - Crear `aportacionesPlan` con `origen: 'migrado_v60'`
4. Si tiene `valor_actual` → entrada en `valoraciones_historicas`
5. Eliminar registro original

Para `planesPensionInversion` (si los hubiere) · lógica similar.

Tras migración:
- Eliminar store `planesPensionInversion`
- Renombrar `traspasosPlanes` → `traspasosPlanPensiones`
- Actualizar referencias en `ingresos.metadata.nomina.aportacionPlanPensiones.planId`

### 6.3 · Recuento final de stores

```
DB_VERSION 68 · 40 stores
- 1 store eliminado    · planesPensionInversion
+ 2 stores nuevos       · planesPensiones · aportacionesPlan
+ 1 store renombrado    · traspasosPlanes → traspasosPlanPensiones (no cuenta cambio neto)
DB_VERSION 69 · 41 stores
```

---

## 7 · Servicios a crear/modificar

### 7.1 · NUEVOS

**`src/services/planesPensionesService.ts`**
- `createPlan(data)` · alta
- `updatePlan(id, data)`
- `getPlan(id)`
- `getAllPlanes(filtros?)` · titular · tipoAdministrativo · estado
- `getPlanesPorTipo(tipo)` · ej. solo PPE
- `eliminarPlan(id)` · cascade
- `getValorActualConsolidado(id)`
- `getAportacionesAcumuladasTotal(id)`
- `cambiarTipoAdministrativo(id, nuevoTipo)`

**`src/services/aportacionesPlanService.ts`**
- `crearAportacion(data)`
- `getAportacionesPorPlan(planId)`
- `getAportacionesPorAño(planId, ejercicio)`
- `getTotalesPorAño(planId, ejercicio)`
- `mensualizarAnual(aportacionId)`
- `eliminarAportacion(id)`

**`src/services/traspasosPlanPensionesService.ts`**
- `registrarTraspaso(data)`
- `getTraspasosPorPlan(planId)`
- `getTrayectoriaCompleta(planId)`

**`src/services/limitesFiscalesPlanesService.ts`** ← CLAVE FISCAL · NUEVO
- `getLimitesPorTipo(personalDataId, año)`
- `validarAportacionDeducible(planId, importe, año, rolAportante)`
- `calcularReduccionBaseImponible(personalDataId, año)`
- `getCasillaAEAT(tipoAdministrativo, subtipoPPE?, subtipoPPES?, rolAportante)`

**`src/services/rentabilidadPlanService.ts`** ← CLAVE UX · NUEVO
- `getRentabilidadTotal(planId)`
- `getRentabilidadPorBloque(planId)`
- `getRentabilidadComparativaBloques(planId)`
- Internas · `_calcularTWR(cashFlows, valoraciones)` · `_calcularMWR(cashFlows, valoraciones)` · `_anualizar(rentabilidadPeriodo, años)`

### 7.2 · MODIFICADOS

**`src/services/nominaService.ts`** (o equivalente con `ingresos`)
- Al confirmar nómina vinculada → escribir en `aportacionesPlan` (NUEVO)

**`src/services/inversionesService.ts`**
- Filtrar OUT registros con `tipo='plan_pensiones'` (no deberían existir tras migración)

**`src/services/aeatXmlImportService.ts`**
- Cambiar destino · planes → `planesPensiones` + `aportacionesPlan`
- Inferir `tipoAdministrativo` desde casilla AEAT donde aparece la aportación

**`src/services/valoracionesService.ts`**
- Aceptar `tipo_activo: 'plan_pensiones'`

**Componente "Cartera de Inversiones"**
- Sección "Planes de pensiones" lee de `planesPensiones`

---

## 8 · UI dedicada · pantallas y componentes

### 8.1 · Pantalla principal · "Mis Planes de Pensiones"

- Lista de planes activos · card por plan
  - Nombre · gestora · **badge tipo** (PPI · PPE · PPES · PPA) · titular
  - Si PPE/PPES con empresa · mostrar empresa
  - Valor actual · aportado total · **rentabilidad acumulada con TWR/año** ★ NUEVO
- Botón "+ Nuevo plan"
- Filtros · titular · tipoAdministrativo · estado
- Sección "Resumen fiscal del año" · base imponible reducida acumulada

### 8.2 · Detalle de plan · 6 secciones

**Sección 1 · Resumen** (★ AMPLIADA con rentabilidad)
- Datos básicos con badge claro
- Valor actual + última valoración
- Aportado total (titular + empresa + cónyuge desglosado)
- **Plusvalía absoluta + relativa**
- **Rentabilidad anualizada · TWR · MWR**
- **Periodo en años**
- Gestora actual · ISIN actual

**Sección 2 · Trayectoria (timeline visual)** (★ AMPLIADA con cierre de bloque)
- Cronología · contratación · aportaciones · traspasos · valoraciones
- **Cada traspaso muestra debajo el cierre del bloque anterior** · "Bloque cerrado · gestora · periodo · TWR · plusvalía"
- **El último bloque (vivo) muestra rentabilidad provisional**

**Sección 3 · Aportaciones**
- Tabla detallada con desglose · año · mes · titular · empresa · cónyuge · total · origen · casilla AEAT
- Filtros por año
- Acciones · "Añadir aportación manual" · "Mensualizar año X"
- Indicador exceso límite anual

**Sección 4 · Valoraciones**
- Histórico · gráfica de evolución
- Acción "Actualizar valor"
- En la gráfica · marcar puntos de traspaso con etiqueta visual

**Sección 5 · Traspasos** (★ AMPLIADA con tabla rentabilidad)
- Lista de traspasos
- **Tabla de rentabilidad por bloque** (formato §4.7)
  - Columnas · # · Gestora · Periodo · Valor inicio · Valor fin · Aportes · Plusvalía · TWR · vs anterior (semáforo neutro)
- Acción "Registrar traspaso"
- Si en algún traspaso cambió tipo administrativo · indicarlo

**Sección 6 · Datos fiscales**
- Reducción acumulada de base imponible
- Desglose por tipo
- Exceso arrastrable a próximos 5 años
- Estimación tributación al rescatar
- Iliquidez · "puede rescatarse desde fecha X"

### 8.3 · Wizard de alta de plan · 5 pasos

**Paso 1 · Tipo administrativo**
- Selector visual:
  - PPI · "Lo contraté yo en un banco/aseguradora"
  - PPE · "Me lo da mi empresa"
  - PPES · "Plan simplificado"
  - PPA · "Plan garantizado · seguro"
- Si PPE · subtipo (empleador único / promoción conjunta)
- Si PPES · submodalidad (sectorial / sector público / cooperativas / autónomos)

**Paso 2 · Empresa (solo si PPE o PPES con empresa)**
- CIF + nombre empresa
- Pre-rellenable desde nóminas existentes

**Paso 3 · Datos básicos**
- Nombre amigable (sugerido)
- Titular · gestora · ISIN · política inversión · fecha contratación

**Paso 4 · Estado actual (opcional)**
- ¿Sabes el valor actual?

**Paso 5 · Aportación inicial (opcional)**
- ¿Quieres registrar la aportación inicial?
- Si plan empleo/PPES con empresa · vincular a nómina

### 8.4 · Wizard de traspaso · 1 paso

- Plan a traspasar (pre-seleccionado · NO se puede cambiar de plan)
- Nueva gestora · nuevo ISIN
- ¿Cambia tipo administrativo? (raro · pero posible)
- Nueva política inversión (si cambia)
- Fecha solicitud · fecha ejecución
- **Valor en el momento del traspaso** (CRÍTICO para rentabilidad)
- Tras guardar · MISMA ficha · solo cambia gestora actual + se cierra el bloque anterior

### 8.5 · Modificar NominaWizard

- Selector "¿A qué plan va la aportación?":
  - Lee de `planesPensiones` filtrado por:
    - `titular` correspondiente
    - `tipoAdministrativo IN ('PPE', 'PPES')`
    - `estado = 'activo'`
- Si no hay · botón "Crear plan empleo nuevo" pre-rellenado

---

## 9 · Reglas inviolables

1. **Migración SIN PÉRDIDA de datos** · todos los registros se migran
2. **Identidad estable del plan** · el `id` NO cambia tras un traspaso · se mantiene la MISMA ficha
3. **Aportaciones SOLO en `aportacionesPlan`** · NO embebidas
4. **Valoraciones SOLO en `valoraciones_historicas`** · NO en sub-store del plan
5. **Vínculo nómina-plan se preserva tras migración**
6. **Sub-tareas obligatorias** · §10 · 7 sub-tareas con commits separados
7. **DB_VERSION sube a 69** · migración irreversible
8. **Cero compatibilidad retroactiva**
9. **Tests obligatorios** · migración + flujos + cálculo fiscal + cálculo rentabilidad
10. **Si surge ambigüedad** · PARAR · documentar · esperar input
11. **Casillas AEAT** · verificar contra docs AEAT · si CC tiene duda · TODO con número probable
12. **TWR/MWR · si no se pueden calcular · devolver `null`** · NO inventar valores ni interpolar

---

## 10 · Sub-tareas · 7 commits separados

PR único contra `main` · título · `feat(planes-pensiones): módulo dedicado · DB v69 · cobertura PPI/PPE/PPES/PPA + rentabilidad TWR/MWR`

### Sub-tarea 13.1 · Schema + stores nuevos

**Commit 1** · `feat(db): añadir stores planesPensiones y aportacionesPlan · DB v69`

- Crear `planesPensiones` schema §2.1
- Crear `aportacionesPlan` schema §2.2
- Renombrar `traspasosPlanes` → `traspasosPlanPensiones` schema §2.3
- Añadir índices
- DB_VERSION 69
- Tests · stores accesibles

### Sub-tarea 13.2 · Servicios CRUD

**Commit 2** · `feat(services): planesPensionesService · aportacionesPlanService · traspasosPlanPensionesService`

- Los 3 servicios CRUD §7.1
- Tests unitarios

### Sub-tarea 13.3 · Servicio fiscal · CLAVE FISCAL

**Commit 3** · `feat(fiscal): limitesFiscalesPlanesService · validación + cálculo reducción base`

- `limitesFiscalesPlanesService` con tabla §3.1
- Validación aportaciones §3.2
- Cálculo reducción §3.3
- Mapeo casillas AEAT §3.4 (con TODOs si CC no confirma)
- Tests · varios casos · titular nómina · titular autónomo · cónyuge · discapacidad · exceso

### Sub-tarea 13.4 · Migración de datos

**Commit 4** · `feat(migration): migrar planes desde inversiones[tipo=plan_pensiones] y planesPensionInversion`

- Migración cursor-based §6.2
- Inferencia de `tipoAdministrativo`
- Actualizar referencias en `ingresos.metadata.nomina.aportacionPlanPensiones.planId`
- Eliminar registros origen
- Eliminar store `planesPensionInversion`
- Tests · migración con DB poblada

### Sub-tarea 13.5 · UI · pantallas y wizards

**Commit 5** · `feat(ui): pantalla planes pensiones + wizards alta/traspaso · 4 tipos`

- Pantalla principal §8.1
- Detalle del plan §8.2 (6 secciones · sin la rentabilidad todavía · placeholder)
- Wizard alta §8.3 (5 pasos · selección tipo)
- Wizard traspaso §8.4
- Adaptar sección Cartera Inversiones

### Sub-tarea 13.6 · Adaptar consumidores externos

**Commit 6** · `refactor(consumers): nomina · xml-aeat · cartera adaptados a nuevo módulo`

- Modificar `nominaService` · escribe en `aportacionesPlan`
- Modificar `aeatXmlImportService` · escribe en `planesPensiones` + `aportacionesPlan`
- Modificar `inversionesService` · filtra planes
- Modificar NominaWizard · selector lee de `planesPensiones`
- Tests integración

### Sub-tarea 13.7 · Servicio rentabilidad + UI ★ NUEVO

**Commit 7** · `feat(rentabilidad): rentabilidadPlanService · TWR + MWR + por bloque · UI enchufada`

- Crear `rentabilidadPlanService.ts` con las 3 funciones públicas §4.5
- Implementar algoritmo TWR §4.3
- Implementar algoritmo MWR (Newton-Raphson) §4.4
- Manejar casos especiales §4.6
- Enchufar en Sección 1 (KPIs cabecera) §4.7
- Enchufar en Sección 2 (cierre de bloque en timeline) §4.7
- Enchufar en Sección 5 (tabla rentabilidad por bloque con semáforo) §4.7
- Enchufar en pantalla principal "Mis Planes" (badge rentabilidad/año en card) §8.1
- Tests · §4.8 · caso Jose verificación numérica externa

---

## 11 · Verificación post-deploy

### 11.1 · Tests automáticos obligatorios

- DB_VERSION = 69
- 41 stores activos
- `planesPensionInversion` NO existe
- `planesPensiones` y `aportacionesPlan` existen
- `traspasosPlanPensiones` existe (renombrado)
- Migración preserva datos previos
- Servicio fiscal calcula límites correctos
- Servicio rentabilidad · TWR caso Jose verificado contra cálculo externo (tolerancia ±0.1pp)
- Casillas AEAT mapeadas o con TODOs documentados

### 11.2 · Verificación manual de Jose

**Verificación 1 · Datos migrados**
- DevTools · `planesPensiones` con registros migrados
- Plan Orange · `tipoAdministrativo: 'PPE'` con `subtipoPPE: 'empleador_unico'`
- Plan ING/Indexa/MyInvestor (si hay datos en `inversiones`) · `tipoAdministrativo: 'PPI'`
- `aportacionesPlan` · histórico
- `inversiones` ya NO contiene `tipo='plan_pensiones'`

**Verificación 2 · UI funcional**
- Pantalla "Mis planes" muestra los planes con badges correctos
- Cada card muestra rentabilidad acumulada + TWR/año
- Click · timeline · aportaciones · etc.
- Crear plan nuevo · 4 tipos funcionan

**Verificación 3 · Caso real Jose · trayectoria PPI ING → Indexa → MyInvestor**
- Crear PPI · "Plan jubilación 2017"
- Aportación inicial · 45.000 € · 2017 (ING)
- Traspaso · ING → Indexa · 56.000 € · 2021
- Traspaso · Indexa → MyInvestor · 86.000 € · 2025
- Valor actual · 96.000 €
- **Verificar UI:**
  - Cabecera muestra "Rentabilidad acumulada · +113% · TWR ~8,7%/año · 9 años"
  - Timeline muestra los 3 bloques cerrados con su TWR
  - Sección Traspasos muestra tabla con 3 filas · semáforos correctos (Indexa ▲ ING · MyInvestor ▲ Indexa o = según números)
  - Es UNA SOLA ficha · no aparecen 3 fichas distintas

**Verificación 4 · Caso PPE Orange con vínculo nómina**
- Plan Orange · `tipoAdministrativo: 'PPE'`
- Confirmar nómina mensual → entrada automática en `aportacionesPlan`
- `importeTitular` y `importeEmpresa` ambos registrados
- `casillaAEAT` correcta

**Verificación 5 · Servicio fiscal**
- Tu DNI · titular del PPI + PPE Orange
- Total aportado titular ejercicio 2025 · X €
- ATLAS calcula correctamente reducción base imponible
- Si excedes límite · alerta visible

**Verificación 6 · Servicio rentabilidad ★ NUEVO**
- Caso Jose ING/Indexa/MyInvestor · números de TWR/MWR consistentes con cálculo externo
- Plan recién creado · NO muestra TWR (es null)
- Plan con periodo < 1 año · TWR mostrado como "+X% en N meses" · NO anualizado
- Semáforo entre bloques · ▲ verde si delta TWR > +1pp · = ámbar si entre -1 y +1 · ▼ rojo si < -1

**Verificación 7 · PPES autónomo (cuando cliente autónomo lo pruebe)**
- Crear PPES autónomos
- Aportar 4.000 € · debe ser 100% deducible (límite 4.250 €)
- Aportar 5.000 € · 750 € no deducibles · ATLAS lo indica

---

## 12 · Pull Request

PR único contra `main` · título · `feat(planes-pensiones): módulo dedicado · DB v69 · 4 tipos + rentabilidad TWR/MWR`

7 commits secuenciales (sub-tareas 13.1 a 13.7).

Descripción del PR:
- Tabla stores afectados
- Diff DB_VERSION (68 → 69)
- Tests pasados (incluyendo fiscal y rentabilidad)
- Casillas AEAT verificadas/pendientes
- Captura UI con badges + KPIs rentabilidad + tabla por bloque
- Confirmación migración

**STOP-AND-WAIT · NO mergear · esperar autorización Jose tras validación deploy preview.**

---

## 13 · Criterios de aceptación

### Globales
- [ ] PR contra `main` · 7 commits separados
- [ ] DB_VERSION 69
- [ ] 41 stores activos
- [ ] `planesPensionInversion` eliminado
- [ ] Tests pasan (incluyendo fiscal y rentabilidad)
- [ ] tsc --noEmit pasa
- [ ] App arranca sin errores

### Por sub-tarea
- [ ] 13.1 · schemas + indexes + DB_VERSION 69
- [ ] 13.2 · 3 servicios CRUD con tests
- [ ] 13.3 · servicio fiscal con tests · casillas AEAT verificadas o TODO
- [ ] 13.4 · migración con datos preservados · tipo administrativo inferido
- [ ] 13.5 · UI funcional · wizards · badges · 6 secciones detalle
- [ ] 13.6 · consumidores adaptados · nómina vinculada genera aportaciones con tipo correcto
- [ ] 13.7 · servicio rentabilidad · TWR + MWR + por bloque · UI enchufada · tests caso Jose pasan

---

## 14 · Reglas operativas

- **Si CC no puede confirmar casilla AEAT exacta** · TODO con número probable · NO inventar
- **Si la migración encuentra plan sin contexto** · default PPI · `origen: 'migrado_v60'`
- **Si TWR/MWR no convergen o no son calculables** · devolver `null` · NO interpolar · NO inventar
- **NO arreglar bugs detectados** · documentar
- **NO refactorizar fuera del scope**
- **El orden de sub-tareas importa** · 13.1 → 13.2 → 13.3 → 13.4 → 13.5 → 13.6 → 13.7
- **Si la sub-tarea 13.4 falla** · NO continuar
- **Si hay datos en producción Jose que no encajan** · reportar antes de eliminar
- **Stop-and-wait** · NO mergear el PR · esperar confirmación explícita Jose

---

## 15 · Lo que esta tarea NO hace

- ❌ NO cubre **EPSV** (País Vasco · TAREA futura)
- ❌ NO cubre **Mutualidades profesionales** (TAREA futura)
- ❌ NO cubre **PPSE** · **Sistema Asociado** (raros · TAREA futura si aparecen)
- ❌ NO implementa **rescate de plan** (TAREA futura cuando llegue jubilación)
- ❌ NO conecta con **APIs de gestoras** (BBVA · Indexa · MyInvestor)
- ❌ NO compara **rentabilidad con benchmarks externos** (IBEX · S&P 500 · TAREA futura)
- ❌ NO calcula **métricas de riesgo avanzadas** (volatilidad · max drawdown · Sharpe · Sortino)
- ❌ NO calcula **rentabilidad neta de impuestos** (depende del año de rescate · TAREA futura)
- ❌ NO toca **`ingresos.tipo='pension'`** (cobro · no plan activo)
- ❌ NO mensualiza **automáticamente** aportaciones anuales (solo bajo acción del usuario)

---

## 16 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main` (post-T39)
- DB_VERSION 68 · 40 stores
- Datos producción Jose (verificar en DevTools antes de migrar):
  - "ORANGE ESPAGNE SA" · BBVA · ~35.491 € valor · ~6.420 € aportado · 4 años · 119 aportaciones · → PPE empleador único
  - Posible plan PPI MyInvestor (si está en `inversiones[tipo='plan_pensiones']`) · → PPI · trayectoria ING/Indexa/MyInvestor
- `planesPensionInversion` vacío
- `traspasosPlanes` vacío
- Decisiones consolidadas previas (§1.5)
- Tabla legal de tipos de planes (§1.4)
- Sección Cartera Inversiones ya muestra planes (`atlas-inversiones-v2.html`)

---

## 17 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Migración pierde aportaciones | Alta | Tests con DB poblada · cursor-based · verificar conteos |
| Migración infiere tipo equivocado | Alta | Default PPI · usuario lo cambia · `origen: 'migrado_v60'` flag |
| ID nuevo del plan rompe vínculo nómina | Alta | Tabla mapping viejo→nuevo · actualizar `ingresos.metadata` |
| Casillas AEAT incorrectas | Media | TODOs marcados · usuario verifica antes de declaración |
| Servicio fiscal calcula mal límites | Media | Tests exhaustivos por tipo · ejemplo con datos AEAT 2025 |
| **TWR/MWR con números irreales** | Media | Tests caso Jose con verificación externa · si no converge · null |
| **MWR no converge en casos extremos** | Media | Newton-Raphson con max 100 iter · fallback null + warning |
| UI con 4 tipos confunde al usuario | Media | Wizard guiado · ejemplos · ayuda contextual |
| Datos productivos perdidos | Baja | Datos NO productivos · wipe aceptable |

---

## 18 · Si todo falla · plan B

Si tras deploy la app no arranca:
1. `git revert` del PR
2. Forzar redeploy
3. App vuelve a DB_VERSION 68 · 40 stores
4. Documentar bug
5. Re-planificar

---

## 19 · Después de TAREA 13

1. Jose verifica deploy preview · 41 stores · datos migrados · UI funcional
2. Jose prueba caso real ING → Indexa → MyInvestor en producción · valida números TWR
3. Jose verifica caso Orange · PPE empleador único · vínculo nómina
4. Si todos los puntos OK · Jose autoriza merge
5. Pestaña "Cartera de Inversiones" tiene datos coherentes con badges
6. Próxima importación XML AEAT · planes irán al sitio correcto con tipo inferido por casilla
7. Jose decide siguiente TAREA del backlog (T14 · T11 · T16 · etc.)

---

## 20 · Cómo lanzar esta TAREA a CC

```
@CC ejecuta el spec de TAREA-13-modulo-planes-pensiones-v3.md
Auditoría obligatoria antes de codear · verificar DB_VERSION actual = 68 · 40 stores
1 PR único · 7 commits secuenciales (13.1 → 13.7) · stop-and-wait · 6.5-9h
NO mergear · esperar autorización Jose tras validación deploy preview
```

---

**Fin de la spec v3 · esperar PR con 7 commits · verificación Jose post-deploy · cerrar TAREA 13.**
