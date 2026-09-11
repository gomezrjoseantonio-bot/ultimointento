# TAREA CLAUDE CODE — Fase 0: Store ejerciciosFiscales + Resolver

## Contexto

ATLAS tiene un problema arquitectónico: no existe una entidad "ejercicio fiscal" como objeto de primera clase. Los datos fiscales de distintos años se tratan igual cuando deberían tener tratamientos distintos según su estado. Esto causa double-counting, arrastres perdidos, inmuebles vendidos excluidos de cálculos donde deberían estar, y recalculación innecesaria.

**Esta tarea crea la pieza que falta: un store coordinador y un servicio resolver.** Es puramente aditiva — NO modifica ningún servicio existente.

---

## Scope ESTRICTO

### SÍ hacer:
- Crear nuevo store `ejerciciosFiscales` en `db.ts`
- Crear nuevo servicio `src/services/ejercicioResolverService.ts`
- Exportar interfaces y tipos necesarios
- Incrementar versión de la DB

### NO hacer:
- NO modificar `fiscalSummaryService.ts`
- NO modificar `irpfCalculationService.ts`
- NO modificar ningún componente `.tsx`
- NO modificar `aeatPdfParserService.ts`
- NO modificar `ejercicioFiscalService.ts` (el existente)
- NO tocar Redux, slices, ni stores existentes
- NO cambiar nada visual

---

## 1. Modificar `src/services/db.ts`

### 1.1 Añadir interfaces

Añadir estas interfaces al archivo, exportándolas:

```typescript
// ═══════════════════════════════════════════════
// MODELO FISCAL — 4 REGÍMENES
// ═══════════════════════════════════════════════

export interface EjercicioFiscal {
  año: number;  // keyPath — 2020, 2021, ..., 2026
  
  estado: 'en_curso' | 'pendiente' | 'declarado' | 'prescrito';
  
  // Fecha de prescripción (calculada: 30 jun del año+5)
  fechaPrescripcion?: string;
  
  // Fuente AEAT (solo si declarado o prescrito)
  aeat?: {
    snapshot: Record<string, number>;   // casillas: { '0435': 112096.62, ... }
    resumen: ResumenFiscal;
    pdfDocumentId?: string;
    fechaImportacion: string;
  };
  
  // Cálculo ATLAS (para pendiente/en_curso; también para comparativa en declarado)
  atlas?: {
    snapshot: Record<string, number>;
    resumen: ResumenFiscal;
    fechaCalculo: string;
    hashInputs: string;  // cache key
  };
  
  // Arrastres ENTRANTES (de año-1 → este año)
  arrastresIn: ArrastresEjercicio;
  
  // Arrastres SALIENTES (de este año → año+1)
  arrastresOut?: ArrastresOutEjercicio;
  
  // Inmuebles con actividad fiscal en este ejercicio
  inmuebleIds: number[];
  
  createdAt: string;
  updatedAt: string;
}

export interface ResumenFiscal {
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  cuotaIntegra: number;
  retenciones: number;
  resultado: number;  // negativo = a devolver
}

export interface ArrastresEjercicio {
  fuente: 'aeat' | 'atlas' | 'manual' | 'ninguno';
  gastosPendientes: ArrastreGasto[];
  perdidasPatrimoniales: ArrastrePerdida[];
  amortizacionesAcumuladas: AmortizacionAcumulada[];
  deduccionesPendientes: DeduccionPendiente[];
}

export interface ArrastresOutEjercicio {
  fuente: 'aeat' | 'atlas';
  gastosPendientes: ArrastreGasto[];
  perdidasPatrimoniales: ArrastrePerdida[];
  amortizacionesAcumuladas: AmortizacionAcumulada[];
  deduccionesPendientes: DeduccionPendiente[];
}

export interface ArrastreGasto {
  inmuebleId: number;
  inmuebleAlias?: string;
  importePendiente: number;
  añoOrigen: number;
  casilla: '0105' | '0106';
}

export interface ArrastrePerdida {
  tipo: 'ahorro_general' | 'ahorro_renta_variable' | 'patrimonial';
  importePendiente: number;
  añoOrigen: number;
}

export interface AmortizacionAcumulada {
  inmuebleId: number;
  inmuebleAlias?: string;
  amortizacionAcumulada: number;
  baseAmortizacion: number;
}

export interface DeduccionPendiente {
  tipo: string;
  importePendiente: number;
  añoOrigen: number;
}
```

### 1.2 Crear el store en el upgrade handler

Buscar la función `initDB()` y su `upgrade` callback. Añadir:

```typescript
if (!db.objectStoreNames.contains('ejerciciosFiscales')) {
  const store = db.createObjectStore('ejerciciosFiscales', { keyPath: 'año' });
  store.createIndex('estado', 'estado');
}
```

**IMPORTANTE:** Incrementar el número de versión de la DB en 1.

---

## 2. Crear `src/services/ejercicioResolverService.ts`

Crear este archivo nuevo:

```typescript
/**
 * ejercicioResolverService.ts
 * 
 * Nodo coordinador del modelo fiscal de ATLAS.
 * Gestiona el ciclo de vida de los ejercicios fiscales con 4 estados:
 *   en_curso → pendiente → declarado → prescrito
 * 
 * REGLAS FUNDAMENTALES:
 * - La AEAT manda cuando existe; si no, manda ATLAS (R1)
 * - El motor NUNCA recalcula ejercicios declarados o prescritos (R3)
 * - Los ejercicios prescritos NUNCA se eliminan (R10)
 * - La cadena de amortización es sagrada (R14)
 * - Los arrastres siguen la cascada: AEAT > ATLAS > manual (R2)
 */

import { initDB } from './db';
import type { 
  EjercicioFiscal, 
  ResumenFiscal,
  ArrastresEjercicio,
  ArrastresOutEjercicio,
  ArrastreGasto,
  ArrastrePerdida,
  AmortizacionAcumulada,
  DeduccionPendiente
} from './db';

// ═══════════════════════════════════════════════
// LECTURA — Resolver principal
// ═══════════════════════════════════════════════

/**
 * Obtiene el ejercicio fiscal para un año.
 * Si no existe, lo crea con estado inferido.
 */
export async function getEjercicio(año: number): Promise<EjercicioFiscal> {
  const db = await initDB();
  let ej = await db.get('ejerciciosFiscales', año);
  if (!ej) {
    ej = crearEjercicioInicial(año);
    await db.put('ejerciciosFiscales', ej);
  }
  return ej;
}

/**
 * Obtiene todos los ejercicios, ordenados por año.
 */
export async function getTodosLosEjercicios(): Promise<EjercicioFiscal[]> {
  const db = await initDB();
  const todos = await db.getAll('ejerciciosFiscales');
  return todos.sort((a, b) => a.año - b.año);
}

/**
 * Devuelve la declaración que manda para un año.
 * - Declarado/Prescrito con AEAT → snapshot AEAT (inmutable)
 * - Pendiente/En curso → placeholder (el motor real se conectará en Fase 2)
 */
export async function getDeclaracion(año: number): Promise<{
  fuente: 'aeat' | 'atlas' | 'ninguno';
  snapshot: Record<string, number> | null;
  resumen: ResumenFiscal | null;
}> {
  const ej = await getEjercicio(año);
  
  // Ejercicio con AEAT → devolver snapshot congelado
  if ((ej.estado === 'declarado' || ej.estado === 'prescrito') && ej.aeat) {
    return { 
      fuente: 'aeat', 
      snapshot: ej.aeat.snapshot, 
      resumen: ej.aeat.resumen 
    };
  }
  
  // Ejercicio con cálculo ATLAS cacheado → devolver cache
  if (ej.atlas) {
    return {
      fuente: 'atlas',
      snapshot: ej.atlas.snapshot,
      resumen: ej.atlas.resumen
    };
  }
  
  // Sin datos → el motor IRPF se conectará en Fase 2
  return { fuente: 'ninguno', snapshot: null, resumen: null };
}

/**
 * Devuelve los arrastres que llegan a un año.
 * Cascada: AEAT del año-1 > ATLAS del año-1 > Manual > Vacío
 */
export async function getArrastresParaAño(año: number): Promise<ArrastresEjercicio> {
  const ej = await getEjercicio(año);
  
  // Si ya tiene arrastresIn con datos, usarlos
  if (ej.arrastresIn.fuente !== 'ninguno') {
    return ej.arrastresIn;
  }
  
  // Intentar propagar desde año anterior
  try {
    const ejAnterior = await getEjercicio(año - 1);
    if (ejAnterior.arrastresOut) {
      const propagados: ArrastresEjercicio = {
        fuente: ejAnterior.arrastresOut.fuente,
        gastosPendientes: ejAnterior.arrastresOut.gastosPendientes,
        perdidasPatrimoniales: ejAnterior.arrastresOut.perdidasPatrimoniales,
        amortizacionesAcumuladas: ejAnterior.arrastresOut.amortizacionesAcumuladas,
        deduccionesPendientes: ejAnterior.arrastresOut.deduccionesPendientes,
      };
      ej.arrastresIn = propagados;
      ej.updatedAt = new Date().toISOString();
      await actualizarEjercicio(ej);
      return propagados;
    }
  } catch {
    // No hay año anterior — normal para el primer año
  }
  
  return arrastresVacios();
}

/**
 * Devuelve los inmuebles con actividad fiscal en un año.
 * NO usa properties.state actual — usa la lista guardada en el ejercicio.
 */
export async function getInmueblesDelEjercicio(año: number): Promise<number[]> {
  const ej = await getEjercicio(año);
  return ej.inmuebleIds;
}

// ═══════════════════════════════════════════════
// ESCRITURA — Transiciones de estado
// ═══════════════════════════════════════════════

/**
 * T2: Importar declaración AEAT
 * Transición: pendiente → declarado (o directamente → prescrito si ya prescribió)
 * 
 * Side effects:
 * 1. Guardar snapshot AEAT inmutable
 * 2. Extraer arrastresOut de casillas
 * 3. Propagar arrastresIn al año siguiente
 * 4. Archivar referencia al PDF
 */
export async function importarDeclaracionAEAT(params: {
  año: number;
  casillas: Record<string, number>;
  pdfDocumentId?: string;
  inmuebleIds?: number[];
}): Promise<EjercicioFiscal> {
  const { año, casillas, pdfDocumentId, inmuebleIds } = params;
  const ej = await getEjercicio(año);
  
  // 1. Guardar snapshot AEAT
  ej.aeat = {
    snapshot: casillas,
    resumen: extraerResumenDeCasillas(casillas),
    pdfDocumentId,
    fechaImportacion: new Date().toISOString()
  };
  
  // 2. Determinar estado: ¿ya prescribió?
  const fechaPrescripcion = new Date(año + 5, 5, 30); // 30 jun del año+5
  if (new Date() > fechaPrescripcion) {
    ej.estado = 'prescrito';
  } else {
    ej.estado = 'declarado';
  }
  
  // 3. Extraer arrastresOut de casillas AEAT
  ej.arrastresOut = {
    fuente: 'aeat',
    gastosPendientes: extraerArrastresGastos(casillas),
    perdidasPatrimoniales: extraerArrastresPerdidas(casillas),
    amortizacionesAcumuladas: [], // Se infieren del cálculo, no de casillas directamente
    deduccionesPendientes: []
  };
  
  // 4. Registrar inmuebles del ejercicio
  if (inmuebleIds && inmuebleIds.length > 0) {
    ej.inmuebleIds = inmuebleIds;
  }
  
  ej.updatedAt = new Date().toISOString();
  await actualizarEjercicio(ej);
  
  // 5. Propagar arrastres al año siguiente
  await propagarArrastres(año);
  
  return ej;
}

/**
 * Guardar cálculo ATLAS para un ejercicio pendiente o en_curso.
 * Incluye hash de inputs para cache.
 */
export async function guardarCalculoATLAS(params: {
  año: number;
  snapshot: Record<string, number>;
  resumen: ResumenFiscal;
  hashInputs: string;
}): Promise<void> {
  const ej = await getEjercicio(params.año);
  
  // No sobreescribir AEAT con cálculo ATLAS
  if (ej.estado === 'declarado' || ej.estado === 'prescrito') {
    // Solo guardar como comparativa, no como fuente principal
  }
  
  ej.atlas = {
    snapshot: params.snapshot,
    resumen: params.resumen,
    fechaCalculo: new Date().toISOString(),
    hashInputs: params.hashInputs
  };
  
  ej.updatedAt = new Date().toISOString();
  await actualizarEjercicio(ej);
}

/**
 * Actualizar la lista de inmuebles de un ejercicio.
 */
export async function setInmueblesDelEjercicio(año: number, inmuebleIds: number[]): Promise<void> {
  const ej = await getEjercicio(año);
  ej.inmuebleIds = inmuebleIds;
  ej.updatedAt = new Date().toISOString();
  await actualizarEjercicio(ej);
}

/**
 * Establecer arrastres manuales para un ejercicio.
 * Solo se aplican si no hay arrastres de mayor prioridad.
 */
export async function setArrastresManuales(
  año: number, 
  arrastres: Omit<ArrastresEjercicio, 'fuente'>
): Promise<boolean> {
  const ej = await getEjercicio(año);
  const prioridad: Record<string, number> = { 'aeat': 3, 'atlas': 2, 'manual': 1, 'ninguno': 0 };
  
  if ((prioridad[ej.arrastresIn.fuente] || 0) > 1) {
    // Ya hay arrastres de mayor prioridad — no sobreescribir
    return false;
  }
  
  ej.arrastresIn = { fuente: 'manual', ...arrastres };
  ej.updatedAt = new Date().toISOString();
  await actualizarEjercicio(ej);
  return true;
}

// ═══════════════════════════════════════════════
// BOOTSTRAP — Inicialización
// ═══════════════════════════════════════════════

/**
 * Inicializa los ejercicios fiscales al arrancar la app.
 * Crea registros para los últimos 7 años + actual si no existen.
 * Verifica prescripción de los declarados.
 * 
 * Llamar al montar el módulo fiscal por primera vez.
 */
export async function bootstrapEjercicios(): Promise<void> {
  const db = await initDB();
  const añoActual = new Date().getFullYear();
  
  // Asegurar que existen registros para 7 años atrás + actual
  for (let año = añoActual - 6; año <= añoActual; año++) {
    const existe = await db.get('ejerciciosFiscales', año);
    if (!existe) {
      await db.put('ejerciciosFiscales', crearEjercicioInicial(año));
    }
  }
  
  // Verificar consistencia y prescripción
  const todos = await db.getAll('ejerciciosFiscales');
  for (const ej of todos) {
    let modificado = false;
    
    // Si tiene AEAT pero no está como declarado/prescrito, corregir
    if (ej.aeat && ej.estado !== 'declarado' && ej.estado !== 'prescrito') {
      ej.estado = 'declarado';
      modificado = true;
    }
    
    // Verificar prescripción
    if (ej.estado === 'declarado') {
      const fechaPrescripcion = ej.fechaPrescripcion 
        ? new Date(ej.fechaPrescripcion) 
        : new Date(ej.año + 5, 5, 30);
      
      if (new Date() > fechaPrescripcion) {
        ej.estado = 'prescrito';
        modificado = true;
      }
    }
    
    // Asegurar que el año actual es en_curso
    if (ej.año === añoActual && ej.estado !== 'en_curso' && !ej.aeat) {
      ej.estado = 'en_curso';
      modificado = true;
    }
    
    // Asegurar que el año anterior es pendiente si no tiene AEAT
    if (ej.año === añoActual - 1 && ej.estado === 'en_curso') {
      ej.estado = 'pendiente';
      modificado = true;
    }
    
    if (modificado) {
      ej.updatedAt = new Date().toISOString();
      await db.put('ejerciciosFiscales', ej);
    }
  }
}

// ═══════════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════════

function crearEjercicioInicial(año: number): EjercicioFiscal {
  const añoActual = new Date().getFullYear();
  let estado: EjercicioFiscal['estado'];
  
  if (año === añoActual) {
    estado = 'en_curso';
  } else if (año === añoActual - 1) {
    estado = 'pendiente';
  } else {
    estado = 'pendiente';
  }
  
  const now = new Date().toISOString();
  return {
    año,
    estado,
    fechaPrescripcion: `${año + 5}-06-30T00:00:00.000Z`,
    arrastresIn: arrastresVacios(),
    inmuebleIds: [],
    createdAt: now,
    updatedAt: now
  };
}

function arrastresVacios(): ArrastresEjercicio {
  return {
    fuente: 'ninguno',
    gastosPendientes: [],
    perdidasPatrimoniales: [],
    amortizacionesAcumuladas: [],
    deduccionesPendientes: []
  };
}

async function actualizarEjercicio(ej: EjercicioFiscal): Promise<void> {
  const db = await initDB();
  await db.put('ejerciciosFiscales', ej);
}

/**
 * Propaga arrastresOut de un año como arrastresIn del siguiente.
 * Solo sustituye si la fuente es de mayor o igual prioridad.
 */
async function propagarArrastres(añoOrigen: number): Promise<void> {
  const ejOrigen = await getEjercicio(añoOrigen);
  if (!ejOrigen.arrastresOut) return;
  
  const ejDestino = await getEjercicio(añoOrigen + 1);
  const prioridad: Record<string, number> = { 'aeat': 3, 'atlas': 2, 'manual': 1, 'ninguno': 0 };
  
  const prioridadActual = prioridad[ejDestino.arrastresIn.fuente] || 0;
  const prioridadNueva = prioridad[ejOrigen.arrastresOut.fuente] || 0;
  
  if (prioridadNueva >= prioridadActual) {
    ejDestino.arrastresIn = {
      fuente: ejOrigen.arrastresOut.fuente,
      gastosPendientes: ejOrigen.arrastresOut.gastosPendientes,
      perdidasPatrimoniales: ejOrigen.arrastresOut.perdidasPatrimoniales,
      amortizacionesAcumuladas: ejOrigen.arrastresOut.amortizacionesAcumuladas,
      deduccionesPendientes: ejOrigen.arrastresOut.deduccionesPendientes,
    };
    ejDestino.updatedAt = new Date().toISOString();
    await actualizarEjercicio(ejDestino);
  }
}

// ═══════════════════════════════════════════════
// EXTRACTORES — Casillas AEAT → datos estructurados
// ═══════════════════════════════════════════════

function extraerResumenDeCasillas(casillas: Record<string, number>): ResumenFiscal {
  return {
    baseImponibleGeneral: casillas['0435'] || 0,
    baseImponibleAhorro: casillas['0460'] || 0,
    cuotaIntegra: casillas['0545'] || 0,
    retenciones: casillas['0596'] || 0,
    resultado: casillas['0670'] || 0
  };
}

/**
 * Extrae arrastres de gastos pendientes de casillas 1211-1224.
 * Estructura: 4 casillas por inmueble (una por cada año de antigüedad N-4..N-1)
 */
function extraerArrastresGastos(casillas: Record<string, number>): ArrastreGasto[] {
  const arrastres: ArrastreGasto[] = [];
  for (const [key, value] of Object.entries(casillas)) {
    const num = parseInt(key);
    if (num >= 1211 && num <= 1224 && value > 0) {
      arrastres.push({
        inmuebleId: 0,  // Se vinculará con inmueble en la fase de importación
        importePendiente: value,
        añoOrigen: 0,   // Se extraerá de casillas adyacentes
        casilla: '0105'  // TODO: distinguir 0105 vs 0106
      });
    }
  }
  return arrastres;
}

/**
 * Extrae arrastres de pérdidas patrimoniales de casillas 1258-1270.
 */
function extraerArrastresPerdidas(casillas: Record<string, number>): ArrastrePerdida[] {
  const arrastres: ArrastrePerdida[] = [];
  for (const [key, value] of Object.entries(casillas)) {
    const num = parseInt(key);
    if (num >= 1258 && num <= 1270 && value > 0) {
      arrastres.push({
        tipo: 'patrimonial',
        importePendiente: value,
        añoOrigen: 0
      });
    }
  }
  return arrastres;
}
```

---

## 3. Criterios de aceptación

- [ ] Store `ejerciciosFiscales` existe en IndexedDB con keyPath `año`
- [ ] Todas las interfaces exportadas desde `db.ts` sin errores TypeScript
- [ ] `ejercicioResolverService.ts` creado con todas las funciones exportadas
- [ ] `bootstrapEjercicios()` crea registros 2020-2026 al ejecutarse
- [ ] Estados correctos: 2026=en_curso, 2025=pendiente, 2020-2024=pendiente
- [ ] `getEjercicio(2026)` devuelve objeto con estado 'en_curso'
- [ ] `getDeclaracion(2026)` devuelve `{ fuente: 'ninguno', snapshot: null }`
- [ ] `getArrastresParaAño(2025)` devuelve fuente 'ninguno' (sin datos aún)
- [ ] `importarDeclaracionAEAT()` guarda snapshot y cambia estado
- [ ] Prescripción: si se importa AEAT de 2020, estado = 'prescrito' (ya prescribió)
- [ ] **Ningún archivo existente modificado excepto `db.ts`** (para el store)
- [ ] Versión de DB incrementada
- [ ] Compilación TypeScript sin errores

## 4. Commits sugeridos (en español)

```
feat: añadir interfaces EjercicioFiscal y tipos de arrastres en db.ts
feat: crear store ejerciciosFiscales en IndexedDB
feat: crear ejercicioResolverService con resolver y bootstrap
```

## 5. Notas para el implementador

- La función `initDB()` en `db.ts` usa la librería `idb`. Respetar el patrón existente de stores.
- No crear Redux slice para esto — se consume directamente desde servicios con async/await.
- El bootstrap se llamará desde el módulo fiscal en una fase posterior. Por ahora solo exportar la función.
- Las funciones extractoras de casillas (1211-1224, 1258-1270) son placeholders. Se refinará el mapeo exacto cuando el parser de PDF entregue las casillas correctamente (tarea T1.1 separada).
- NO llamar a `bootstrapEjercicios()` automáticamente desde ningún sitio aún. Solo exportarla.
