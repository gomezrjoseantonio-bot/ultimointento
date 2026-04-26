# TAREA CC · TAREA 13 · Módulo Planes de Pensiones · v2

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
> **Tiempo estimado** · 5-7h Copilot · 3-4h tu revisión · total 8-11h
>
> **Prioridad** · ALTA · bloquea importación XML AEAT correcta · bloquea salida a usuarios reales
>
> **Predecesores** · TAREA 7 cerrada (sub-tarea 8 mergeada)
>
> **DB de partida** · DB_VERSION 64 · 39 stores
>
> **DB tras esta tarea** · DB_VERSION 65 · 40 stores

---

## 1 · Contexto · qué problemas resuelve esta tarea

### 1.1 · Bug detectado en TAREA 7-bis

Los planes de pensiones se escriben hoy en 2 stores distintos según vía de entrada:
- **UI manual** · escribe en `inversiones` con `tipo: 'plan_pensiones'`
- **XML AEAT** · escribe en `planesPensionInversion`

Resultado · `planesPensionInversion` es zombie funcional · `inversiones` mezcla activos financieros con planes de pensiones.

### 1.2 · Caso real Jose · trayectoria ING → Indexa → MyInvestor

Un PPI real:
- 2016 contratación en ING · 45.000 €
- 2021 traspaso a Indexa · valor 56.000 €
- 2025 traspaso a MyInvestor · valor 86.000 €
- 2026 valor actual · 96.000 €

Esto NO son 3 inversiones · es 1 plan con identidad estable y 3 traspasos.

### 1.3 · Realidad legal de los planes de pensiones en España

Tras investigación · existen 5 productos distintos · esta tarea cubre **4 de los 5** y deja PPA como variante de PPI:

| Tipo | Nombre completo | Quién lo contrata | Límite anual 2026 |
|---|---|---|---|
| PPI | Plan de Pensiones Individual | Persona física en banco/aseguradora | 1.500 € |
| PPE | Plan de Pensiones de Empleo | Empresa para sus empleados | 10.000 € (8.500 € empresa) |
| PPES | Plan de Pensiones de Empleo Simplificado | Sectorial/público/cooperativas/autónomos | Variable según submodalidad · autónomo: 4.250 € adicionales |
| PPA | Plan de Previsión Asegurado | Persona física · seguro garantizado | 1.500 € (igual que PPI) |
| EPSV | Entidad Previsión Social Voluntaria | Solo País Vasco | NO se cubre en esta TAREA |

### 1.4 · Decisiones consolidadas previas (de chats anteriores · NO se tocan)

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
  nombre: string;                          // "Plan jubilación 2016" · nombre amigable
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
  planId: string;                          // FK a planesPensiones
  
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
- `planId` (CRÍTICO)
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
  
  // Valor en el momento del traspaso
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
  activo_nombre: 'Plan jubilación 2016',
  fecha_valoracion: '2026-04-26',
  valor: 96000,
  origen: 'manual' | 'xml_aeat' | 'gestora_api'
}
```

---

## 3 · Servicio fiscal · cálculo de límites y validación

Esta es la pieza nueva más importante. ATLAS ahora ENTIENDE las reglas fiscales.

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

## 4 · Flujos de datos · cómo se rellenan los stores

### 4.1 · Alta manual de PPI

Usuario · "Crear plan de pensiones" · selecciona tipo PPI.

1. Crear `planesPensiones`:
   - `tipoAdministrativo: 'PPI'`
   - `garantizado: false`
   - resto de campos
2. Si aporta importe inicial → primera entrada `aportacionesPlan`
3. Si conoce valor actual → entrada en `valoraciones_historicas`

### 4.2 · Alta manual de PPA

Igual que PPI pero con `tipoAdministrativo: 'PPA'` y `garantizado: true`.

### 4.3 · Alta manual de PPE empleador único (caso Orange Jose)

1. Crear `planesPensiones`:
   - `tipoAdministrativo: 'PPE'`
   - `subtipoPPE: 'empleador_unico'`
   - `empresaPagadora: { cif: 'A82009812', nombre: 'Orange España S.A.U.' }`
2. Aportaciones se generan automáticamente al confirmar nóminas (§4.6)

### 4.4 · Alta manual de PPES autónomos

1. Crear `planesPensiones`:
   - `tipoAdministrativo: 'PPES'`
   - `subtipoPPES: 'autonomos'`
2. Aportaciones manuales · puntuales o periódicas

### 4.5 · Importación XML AEAT

1. XML AEAT distingue tipos por casilla · CC mapea casilla → tipo
2. Buscar coincidencia con plan existente
3. Si NO existe · crear `planesPensiones` con tipo inferido
4. Crear entrada en `aportacionesPlan` con el importe + `casillaAEAT`
5. Si XML trae valor del plan → entrada en `valoraciones_historicas`

### 4.6 · Vínculo nómina-plan (PPE / PPES con empresa)

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

### 4.7 · Aportación de cónyuge (caso especial)

1. Aportación se registra en `aportacionesPlan` del plan del CÓNYUGE
2. `importeConyuge` · `importeTitular: 0` · `importeEmpresa: 0`
3. La deducción la aplica el titular aportante en su declaración
4. ATLAS valida que el cónyuge tiene base imponible < 8.000 €

### 4.8 · Traspaso de plan entre gestoras

1. `traspasosPlanPensiones` con datos del traspaso
2. Actualizar `planesPensiones` · `gestoraActual` · `isinActual`
3. `valoraciones_historicas` · entrada con valor del traspaso
4. Aportaciones existentes siguen apuntando al MISMO `planId`

---

## 5 · Migración desde V64 a V65

### 5.1 · Datos a migrar

**Origen A · `inversiones[tipo='plan_pensiones']`** (caso Jose · 2 registros)

**Origen B · `planesPensionInversion`** (vacío hoy)

### 5.2 · Lógica de migración · inferir tipo administrativo

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

### 5.3 · Recuento final de stores

```
DB_VERSION 64 · 39 stores
- 1 store eliminado    · planesPensionInversion
+ 2 stores nuevos       · planesPensiones · aportacionesPlan
+ 1 store renombrado    · traspasosPlanes → traspasosPlanPensiones
DB_VERSION 65 · 40 stores
```

---

## 6 · Servicios a crear/modificar

### 6.1 · NUEVOS

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

**`src/services/limitesFiscalesPlanesService.ts`** ← CLAVE · NUEVO
- `getLimitesPorTipo(personalDataId, año)`
- `validarAportacionDeducible(planId, importe, año, rolAportante)`
- `calcularReduccionBaseImponible(personalDataId, año)`
- `getCasillaAEAT(tipoAdministrativo, subtipoPPE?, subtipoPPES?, rolAportante)`

### 6.2 · MODIFICADOS

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

## 7 · UI dedicada · pantallas y componentes

### 7.1 · Pantalla principal · "Mis Planes de Pensiones"

- Lista de planes activos · card por plan
  - Nombre · gestora · **badge tipo** (PPI · PPE · PPES · PPA) · titular
  - Si PPE/PPES con empresa · mostrar empresa
  - Valor actual · aportado total · rentabilidad acumulada
- Botón "+ Nuevo plan"
- Filtros · titular · tipoAdministrativo · estado
- Sección "Resumen fiscal del año" · base imponible reducida acumulada

### 7.2 · Detalle de plan · 6 secciones

**Sección 1 · Resumen**
- Datos básicos con badge claro
- Valor actual + última valoración
- Aportado total (titular + empresa + cónyuge desglosado)
- Rentabilidad acumulada

**Sección 2 · Trayectoria (timeline visual)**
- Cronología · contratación · aportaciones · traspasos · valoraciones

**Sección 3 · Aportaciones**
- Tabla detallada con desglose · año · mes · titular · empresa · cónyuge · total · origen · casilla AEAT
- Filtros por año
- Acciones · "Añadir aportación manual" · "Mensualizar año X"
- **NUEVO** · indicador exceso límite anual

**Sección 4 · Valoraciones**
- Histórico · gráfica de evolución
- Acción "Actualizar valor"

**Sección 5 · Traspasos**
- Lista de traspasos
- Acción "Registrar traspaso"
- Si en algún traspaso cambió tipo administrativo · indicarlo

**Sección 6 · Datos fiscales**
- Reducción acumulada de base imponible
- **NUEVO** · desglose por tipo
- **NUEVO** · exceso arrastrable a próximos 5 años
- Estimación tributación al rescatar
- Iliquidez · "puede rescatarse desde fecha X"

### 7.3 · Wizard de alta de plan · 5 pasos

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

### 7.4 · Wizard de traspaso · 1 paso

- Plan a traspasar (pre-seleccionado)
- Nueva gestora · nuevo ISIN
- ¿Cambia tipo administrativo? (raro · pero posible)
- Nueva política inversión (si cambia)
- Fecha solicitud · fecha ejecución
- Valor traspaso

### 7.5 · Modificar NominaWizard

- Selector "¿A qué plan va la aportación?":
  - Lee de `planesPensiones` filtrado por:
    - `titular` correspondiente
    - `tipoAdministrativo IN ('PPE', 'PPES')`
    - `estado = 'activo'`
- Si no hay · botón "Crear plan empleo nuevo" pre-rellenado

---

## 8 · Reglas inviolables

1. **Migración SIN PÉRDIDA de datos** · todos los registros se migran
2. **Identidad estable del plan** · el `id` NO cambia tras un traspaso
3. **Aportaciones SOLO en `aportacionesPlan`** · NO embebidas
4. **Valoraciones SOLO en `valoraciones_historicas`** · NO en sub-store del plan
5. **Vínculo nómina-plan se preserva tras migración**
6. **Sub-tareas obligatorias** · §9 · 6 sub-tareas con commits separados
7. **DB_VERSION sube a 65** · migración irreversible
8. **Cero compatibilidad retroactiva**
9. **Tests obligatorios** · migración + flujos + cálculo fiscal
10. **Si surge ambigüedad** · PARAR · documentar · esperar input
11. **Casillas AEAT** · verificar contra docs AEAT · si CC tiene duda · TODO con número probable

---

## 9 · Sub-tareas · 6 commits separados

PR único contra `main` · título · `feat(planes-pensiones): módulo dedicado · DB v65 · cobertura PPI/PPE/PPES/PPA`

### Sub-tarea 13.1 · Schema + stores nuevos

**Commit 1** · `feat(db): añadir stores planesPensiones y aportacionesPlan · DB v65`

- Crear `planesPensiones` schema §2.1
- Crear `aportacionesPlan` schema §2.2
- Renombrar `traspasosPlanes` → `traspasosPlanPensiones` schema §2.3
- Añadir índices
- DB_VERSION 65
- Tests · stores accesibles

### Sub-tarea 13.2 · Servicios CRUD

**Commit 2** · `feat(services): planesPensionesService · aportacionesPlanService · traspasosPlanPensionesService`

- Los 3 servicios CRUD §6.1
- Tests unitarios

### Sub-tarea 13.3 · Servicio fiscal · CLAVE

**Commit 3** · `feat(fiscal): limitesFiscalesPlanesService · validación + cálculo reducción base`

- `limitesFiscalesPlanesService` con tabla §3.1
- Validación aportaciones §3.2
- Cálculo reducción §3.3
- Mapeo casillas AEAT §3.4 (con TODOs si CC no confirma)
- Tests · varios casos · titular nómina · titular autónomo · cónyuge · discapacidad · exceso

### Sub-tarea 13.4 · Migración de datos

**Commit 4** · `feat(migration): migrar planes desde inversiones[tipo=plan_pensiones] y planesPensionInversion`

- Migración cursor-based §5.2
- Inferencia de `tipoAdministrativo`
- Actualizar referencias en `ingresos.metadata.nomina.aportacionPlanPensiones.planId`
- Eliminar registros origen
- Eliminar store `planesPensionInversion`
- Tests · migración con DB poblada

### Sub-tarea 13.5 · UI · pantallas y wizards

**Commit 5** · `feat(ui): pantalla planes pensiones + wizards alta/traspaso · 4 tipos`

- Pantalla principal §7.1
- Detalle del plan §7.2 (6 secciones)
- Wizard alta §7.3 (5 pasos · selección tipo)
- Wizard traspaso §7.4
- Adaptar sección Cartera Inversiones

### Sub-tarea 13.6 · Adaptar consumidores externos

**Commit 6** · `refactor(consumers): nomina · xml-aeat · cartera adaptados a nuevo módulo`

- Modificar `nominaService` · escribe en `aportacionesPlan`
- Modificar `aeatXmlImportService` · escribe en `planesPensiones` + `aportacionesPlan`
- Modificar `inversionesService` · filtra planes
- Modificar NominaWizard · selector lee de `planesPensiones`
- Tests integración

---

## 10 · Verificación post-deploy

### 10.1 · Tests automáticos obligatorios

- DB_VERSION = 65
- 40 stores activos
- `planesPensionInversion` NO existe
- `planesPensiones` y `aportacionesPlan` existen
- `traspasosPlanPensiones` existe (renombrado)
- Migración preserva datos previos
- Servicio fiscal calcula límites correctos
- Casillas AEAT mapeadas o con TODOs documentados

### 10.2 · Verificación manual de Jose

**Verificación 1 · Datos migrados**
- DevTools · `planesPensiones` con registros migrados
- Plan Orange · `tipoAdministrativo: 'PPE'` con `subtipoPPE: 'empleador_unico'`
- Plan ING/MyInvestor (si aplica) · `tipoAdministrativo: 'PPI'`
- `aportacionesPlan` · histórico
- `inversiones` ya NO contiene `tipo='plan_pensiones'`

**Verificación 2 · UI funcional**
- Pantalla "Mis planes" muestra 2 planes con badges correctos
- Click · timeline · aportaciones · etc.
- Crear plan nuevo · 4 tipos funcionan

**Verificación 3 · Caso real Jose · trayectoria PPI**
- Crear PPI · "Plan jubilación 2016"
- Aportación inicial · 45.000 € · 2016
- Traspaso · ING → Indexa · 56.000 € · 2021
- Traspaso · Indexa → MyInvestor · 86.000 € · 2025
- Valor actual · 96.000 €
- Trayectoria visible

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

**Verificación 6 · PPES autónomo (cuando cliente autónomo lo pruebe)**
- Crear PPES autónomos
- Aportar 4.000 € · debe ser 100% deducible (límite 4.250 €)
- Aportar 5.000 € · 750 € no deducibles · ATLAS lo indica

---

## 11 · Pull Request

PR único contra `main` · título · `feat(planes-pensiones): módulo dedicado · DB v65 · 4 tipos`

6 commits secuenciales (sub-tareas 13.1 a 13.6).

Descripción del PR:
- Tabla stores afectados
- Diff DB_VERSION
- Tests pasados (incluyendo fiscal)
- Casillas AEAT verificadas/pendientes
- Captura UI con badges
- Confirmación migración

---

## 12 · Criterios de aceptación

### Globales
- [ ] PR contra `main` · 6 commits separados
- [ ] DB_VERSION 65
- [ ] 40 stores activos
- [ ] `planesPensionInversion` eliminado
- [ ] Tests pasan (incluyendo fiscal)
- [ ] tsc --noEmit pasa
- [ ] App arranca sin errores

### Por sub-tarea
- [ ] 13.1 · schemas + indexes + DB_VERSION 65
- [ ] 13.2 · 3 servicios CRUD con tests
- [ ] 13.3 · servicio fiscal con tests · casillas AEAT verificadas o TODO
- [ ] 13.4 · migración con datos preservados · tipo administrativo inferido
- [ ] 13.5 · UI funcional · wizards · badges · 6 secciones detalle
- [ ] 13.6 · consumidores adaptados · nómina vinculada genera aportaciones con tipo correcto

---

## 13 · Reglas operativas

- **Si CC no puede confirmar casilla AEAT exacta** · TODO con número probable · NO inventar
- **Si la migración encuentra plan sin contexto** · default PPI · `origen: 'migrado_v60'`
- **NO arreglar bugs detectados** · documentar
- **NO refactorizar fuera del scope**
- **El orden de sub-tareas importa** · 13.1 → 13.2 → 13.3 → 13.4 → 13.5 → 13.6
- **Si la sub-tarea 13.4 falla** · NO continuar
- **Si hay datos en producción Jose que no encajan** · reportar antes de eliminar

---

## 14 · Lo que esta tarea NO hace

- ❌ NO cubre **EPSV** (País Vasco · TAREA futura)
- ❌ NO cubre **Mutualidades profesionales** (TAREA futura)
- ❌ NO cubre **PPSE** · **Sistema Asociado** (raros · TAREA futura si aparecen)
- ❌ NO implementa **rescate de plan** (TAREA futura cuando llegue jubilación)
- ❌ NO conecta con **APIs de gestoras** (BBVA · Indexa · MyInvestor)
- ❌ NO calcula **rentabilidad financiera avanzada** (TWR · MWR)
- ❌ NO toca **`ingresos.tipo='pension'`** (cobro · no plan activo)
- ❌ NO mensualiza **automáticamente** aportaciones anuales (solo bajo acción del usuario)

---

## 15 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main` (post-TAREA 7)
- DB_VERSION 64 · 39 stores
- Datos producción Jose · 2 planes en `inversiones[tipo='plan_pensiones']`:
  - "ORANGE ESPAGNE SA" · BBVA · ~35.491 € valor · ~6.420 € aportado · 4 años · 119 aportaciones
  - "SP500" · MyInvestor (probable PPI)
- `planesPensionInversion` vacío
- `traspasosPlanes` vacío
- Decisiones consolidadas previas (§1.4)
- Tabla legal de tipos de planes (§1.3)
- Sección Cartera Inversiones ya muestra planes (`atlas-inversiones-v2.html`)

---

## 16 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Migración pierde aportaciones | Alta | Tests con DB poblada · cursor-based · verificar conteos |
| Migración infiere tipo equivocado | Alta | Default PPI · usuario lo cambia · `origen: 'migrado_v60'` flag |
| ID nuevo del plan rompe vínculo nómina | Alta | Tabla mapping viejo→nuevo · actualizar `ingresos.metadata` |
| Casillas AEAT incorrectas | Media | TODOs marcados · usuario verifica antes de declaración |
| Servicio fiscal calcula mal límites | Media | Tests exhaustivos por tipo · ejemplo con datos AEAT 2025 |
| UI con 4 tipos confunde al usuario | Media | Wizard guiado · ejemplos · ayuda contextual |
| Datos productivos perdidos | Baja | Datos NO productivos · wipe aceptable |

---

## 17 · Si todo falla · plan B

Si tras deploy la app no arranca:
1. `git revert` del PR
2. Forzar redeploy
3. App vuelve a DB_VERSION 64 · 39 stores
4. Documentar bug
5. Re-planificar

---

## 18 · Después de TAREA 13

1. Jose verifica deploy · 40 stores · datos migrados · UI funcional
2. Jose prueba caso real ING → Indexa → MyInvestor en producción
3. Jose verifica caso Orange · PPE empleador único · vínculo nómina
4. Jose decide siguiente TAREA del backlog
5. Pestaña "Cartera de Inversiones" tiene datos coherentes con badges
6. Próxima importación XML AEAT · planes irán al sitio correcto con tipo inferido por casilla

---

**Fin de la spec v2 · esperar PR con 6 commits · verificación Jose post-deploy · cerrar TAREA 13.**
