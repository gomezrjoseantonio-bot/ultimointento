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
  EjercicioFiscalCoord,
  ResumenFiscal,
  ArrastresEjercicioCoord,
  ArrastresOutEjercicioCoord,
  ArrastreGasto,
  ArrastrePerdida,
  AmortizacionAcumulada,
  DeduccionPendiente
} from './db';

// Re-export types for consumer convenience
export type {
  EjercicioFiscalCoord,
  ResumenFiscal,
  ArrastresEjercicioCoord,
  ArrastresOutEjercicioCoord,
  ArrastreGasto,
  ArrastrePerdida,
  AmortizacionAcumulada,
  DeduccionPendiente
};

// ═══════════════════════════════════════════════
// LECTURA — Resolver principal
// ═══════════════════════════════════════════════

/**
 * Obtiene el ejercicio fiscal para un año.
 * Si no existe, lo crea con estado inferido.
 */
export async function getEjercicio(año: number): Promise<EjercicioFiscalCoord> {
  const db = await initDB();
  let ej = await db.get('ejerciciosFiscalesCoord', año);
  if (!ej) {
    ej = crearEjercicioInicial(año);
    await db.put('ejerciciosFiscalesCoord', ej);
  }
  return ej;
}

/**
 * Obtiene todos los ejercicios, ordenados por año.
 */
export async function getTodosLosEjercicios(): Promise<EjercicioFiscalCoord[]> {
  const db = await initDB();
  const todos = await db.getAll('ejerciciosFiscalesCoord');
  return todos.sort((a: EjercicioFiscalCoord, b: EjercicioFiscalCoord) => a.año - b.año);
}

/**
 * Devuelve la declaración que manda para un año.
 * - Declarado/Prescrito con AEAT → snapshot AEAT (inmutable)
 * - Pendiente/En curso → placeholder (el motor real se conectará en Fase 2)
 */
export async function getDeclaracion(año: number): Promise<{
  fuente: 'aeat' | 'xml_aeat' | 'pdf_aeat' | 'atlas' | 'ninguno';
  snapshot: Record<string, number> | null;
  resumen: ResumenFiscal | null;
}> {
  const ej = await getEjercicio(año);

  // Ejercicio con AEAT → devolver snapshot congelado
  if ((ej.estado === 'declarado' || ej.estado === 'prescrito') && ej.aeat) {
    const fuenteAeat = ej.aeat.fuenteImportacion === 'xml' ? 'xml_aeat' : 'pdf_aeat';
    return {
      fuente: fuenteAeat,
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
export async function getArrastresParaAño(año: number): Promise<ArrastresEjercicioCoord> {
  const ej = await getEjercicio(año);

  // Si ya tiene arrastresIn con datos, usarlos
  if (ej.arrastresIn.fuente !== 'ninguno') {
    return ej.arrastresIn;
  }

  // Intentar propagar desde año anterior
  try {
    const ejAnterior = await getEjercicio(año - 1);
    if (ejAnterior.arrastresOut) {
      const propagados: ArrastresEjercicioCoord = {
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
}): Promise<EjercicioFiscalCoord> {
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
  arrastres: Omit<ArrastresEjercicioCoord, 'fuente'>
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
  const añoInicio = añoActual - 6; // e.g. 2020
  const añoFin = añoActual;        // e.g. 2026

  for (let año = añoInicio; año <= añoFin; año++) {
    const existe = await db.get('ejerciciosFiscalesCoord', año);
    if (!existe) {
      await db.put('ejerciciosFiscalesCoord', crearEjercicioInicial(año));
    }
  }

  // Limpiar ejercicios fuera del rango válido (basura de bootstrap anteriores)
  const todos = await db.getAll('ejerciciosFiscalesCoord');
  for (const ej of todos) {
    // Para años futuros: solo borrar si NO tienen datos AEAT reales
    if ((ej.año > añoFin && !ej.aeat) || ej.año < 2015) {
      await db.delete('ejerciciosFiscalesCoord', ej.año);
    }
  }

  // Verificar consistencia y prescripción de los que quedan
  const validos = await db.getAll('ejerciciosFiscalesCoord');
  for (const ej of validos) {
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

    // Corregir años históricos sin AEAT que quedaron marcados como 'declarado'
    // (artefacto de crearEjercicioInicial antes de la corrección de 2026-04-09)
    if (
      ej.año < añoActual - 1 &&
      ej.estado === 'declarado' &&
      !ej.aeat
    ) {
      ej.estado = 'pendiente';
      modificado = true;
    }

    if (modificado) {
      ej.updatedAt = new Date().toISOString();
      await db.put('ejerciciosFiscalesCoord', ej);
    }
  }

  // Limpiar ejerciciosFiscales (store legacy) de años futuros que pudieran haberse creado
  try {
    const todosLegacy = await db.getAll('ejerciciosFiscales');
    for (const ej of todosLegacy) {
      const añoEj = (ej as any).ejercicio ?? (ej as any).año;
      if (typeof añoEj === 'number' && añoEj > añoActual + 1) {
        await db.delete('ejerciciosFiscales', añoEj);
      }
    }
  } catch {
    // ejerciciosFiscales store might not exist in older DB versions
  }
}

/**
 * Elimina del store ejerciciosFiscalesCoord cualquier año que sea
 * mayor que el año actual. Son registros basura generados por un bug anterior
 * (bootstrap creaba entradas marcadas como 'declarado' para años futuros).
 *
 * A diferencia de bootstrapEjercicios, elimina incluso entradas con snapshot
 * AEAT, ya que para años futuros no puede existir una declaración AEAT real.
 *
 * Safe to run multiple times (idempotent).
 */
export async function limpiarEjerciciosCoordBasura(): Promise<{ eliminados: number }> {
  const db = await initDB();
  const añoActual = new Date().getFullYear();

  const todos = await db.getAll('ejerciciosFiscalesCoord');
  let eliminados = 0;

  for (const registro of todos) {
    const año = typeof registro?.año === 'number' ? registro.año : NaN;
    if (Number.isFinite(año) && año > añoActual) {
      await db.delete('ejerciciosFiscalesCoord', año);
      eliminados++;
    }
  }

  if (eliminados > 0) {
    console.log(`[ejerciciosFiscalesCoord] Limpieza: ${eliminados} registros basura eliminados`);
  }
  return { eliminados };
}

// ═══════════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════════

function crearEjercicioInicial(año: number): EjercicioFiscalCoord {
  const hoy = new Date();
  const añoActual = hoy.getFullYear();
  let estado: EjercicioFiscalCoord['estado'];

  if (año === añoActual) {
    estado = 'en_curso';
  } else if (año === añoActual - 1) {
    const finCampaña = new Date(añoActual, 5, 30); // 30 de junio
    estado = hoy <= finCampaña ? 'pendiente' : 'declarado';
  } else {
    // Historical years without AEAT import default to 'pendiente', not 'declarado'.
    // bootstrapEjercicios / guardarEjercicioFiscal will set 'declarado' once AEAT arrives.
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

function arrastresVacios(): ArrastresEjercicioCoord {
  return {
    fuente: 'ninguno',
    gastosPendientes: [],
    perdidasPatrimoniales: [],
    amortizacionesAcumuladas: [],
    deduccionesPendientes: []
  };
}

async function actualizarEjercicio(ej: EjercicioFiscalCoord): Promise<void> {
  const db = await initDB();
  await db.put('ejerciciosFiscalesCoord', ej);
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
  const cuotaIntegraEstatal = casillas['0545'] || 0;
  const cuotaIntegraAutonomica = casillas['0546'] || 0;

  return {
    baseImponibleGeneral: casillas['0435'] || 0,
    baseImponibleAhorro: casillas['0460'] || 0,
    baseLiquidableGeneral: casillas['0505'] || casillas['0500'] || 0,
    baseLiquidableAhorro: casillas['0510'] || 0,
    cuotaIntegra: cuotaIntegraEstatal + cuotaIntegraAutonomica,
    cuotaIntegraEstatal,
    cuotaIntegraAutonomica,
    cuotaLiquidaEstatal: casillas['0570'] || 0,
    cuotaLiquidaAutonomica: casillas['0571'] || 0,
    resultado: casillas['0695'] || casillas['0670'] || 0,
  };
}

/**
 * Extrae arrastres de gastos pendientes de casillas 1211-1224.
 * Estructura: 4 casillas por inmueble (una por cada año de antigüedad N-4..N-1)
 */
function extraerArrastresGastos(casillas: Record<string, number>): ArrastreGasto[] {
  const arrastres: ArrastreGasto[] = [];
  const keys = Object.keys(casillas);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = casillas[key];
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
  const keys = Object.keys(casillas);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = casillas[key];
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
