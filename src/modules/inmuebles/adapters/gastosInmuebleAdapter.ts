import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import type { CompromisoRecurrente, ImporteEvento } from '../../../types/compromisosRecurrentes';
import {
  clasificarCompromisoRecurrenteInmueble,
  clasificarGastoVisualInmueble,
  esCompromisoRecurrenteDeInmueble,
  type GrupoVisualInmueble,
} from '../utils/clasificacionGastoVisual';

/**
 * Modelo visual unificado de gastos de inmueble para presentación.
 * No sustituye al catálogo fiscal ni modifica persistencia.
 */
export interface GastoInmuebleVisual {
  idVisual: string;
  origen: 'recurrente' | 'real' | 'mejora' | 'mobiliario';
  registroId?: number;
  inmuebleId: number;
  /** Ejercicio fiscal del registro (cuando el modelo lo expone). */
  ejercicio?: number;
  fecha: string;
  descripcion: string;
  estado?: string;
  concepto?: string;
  categoryKey?: string;
  categoria?: string;
  /** Casilla del Modelo 100 cuando la fila procede de una declaración AEAT. */
  casillaAEAT?: string;
  subtipo?: string;
  tipoFamilia?: string;
  familiaFiscalManual?: CompromisoRecurrente['familiaFiscalManual'];
  grupoVisual: GrupoVisualInmueble;
  importePrevisto?: number;
  importeReal?: number;
}

function importePrevistoDesdeCompromiso(importe: ImporteEvento): number | undefined {
  switch (importe.modo) {
    case 'fijo':
      return importe.importe;
    case 'variable':
      return importe.importeMedio;
    case 'diferenciadoPorMes': {
      const importes = importe.importesPorMes.filter((n) => Number.isFinite(n));
      if (importes.length === 0) return undefined;
      return importes.reduce((acc, n) => acc + n, 0) / importes.length;
    }
    case 'porPago': {
      const importes = Object.values(importe.importesPorPago).filter((n) => Number.isFinite(n));
      if (importes.length === 0) return undefined;
      return importes.reduce((acc, n) => acc + n, 0) / importes.length;
    }
    case 'porTramos':
      return undefined;
    case 'porcentajeRenta':
      return undefined;
    default:
      return undefined;
  }
}

export function filtrarCompromisosRecurrentesDeInmueble(
  compromisos: readonly CompromisoRecurrente[],
  inmuebleId?: number,
): Array<CompromisoRecurrente & { ambito: 'inmueble'; inmuebleId: number }> {
  return compromisos.filter((c): c is CompromisoRecurrente & { ambito: 'inmueble'; inmuebleId: number } =>
    esCompromisoRecurrenteDeInmueble(c, inmuebleId),
  );
}

export function adaptarCompromisoRecurrenteAGastoVisual(
  compromiso: CompromisoRecurrente,
): GastoInmuebleVisual | null {
  if (!esCompromisoRecurrenteDeInmueble(compromiso)) return null;

  return {
    idVisual: `recurrente:${compromiso.id ?? `${compromiso.inmuebleId}:${compromiso.alias}:${compromiso.fechaInicio}`}`,
    origen: 'recurrente',
    registroId: compromiso.id,
    inmuebleId: compromiso.inmuebleId,
    fecha: compromiso.fechaInicio,
    descripcion: compromiso.alias,
    estado: compromiso.estado,
    concepto: compromiso.concepto,
    categoria: compromiso.categoria,
    subtipo: compromiso.subtipo,
    tipoFamilia: compromiso.tipoFamilia,
    familiaFiscalManual: compromiso.familiaFiscalManual,
    grupoVisual: clasificarCompromisoRecurrenteInmueble(compromiso),
    importePrevisto: importePrevistoDesdeCompromiso(compromiso.importe),
    importeReal: undefined,
  };
}

export function adaptarGastoRealAGastoVisual(gasto: GastoInmueble): GastoInmuebleVisual {
  const grupoBase = clasificarGastoVisualInmueble({
    ambito: 'inmueble',
    categoryKey: gasto.categoryKey,
    categoria: gasto.categoria,
  });
  // La amortización del mobiliario (casilla 0117) es el coste ANUAL de los
  // muebles: se muestra en el grupo Mobiliario, no en «Otros».
  const grupoVisual: GrupoVisualInmueble =
    gasto.casillaAEAT === '0117' ? 'mobiliario' : grupoBase;

  return {
    idVisual: `real:${gasto.id ?? `${gasto.inmuebleId}:${gasto.fecha}:${gasto.concepto}`}`,
    origen: 'real',
    registroId: gasto.id,
    inmuebleId: gasto.inmuebleId,
    ejercicio: gasto.ejercicio,
    fecha: gasto.fecha,
    descripcion: gasto.concepto,
    estado: gasto.estado,
    categoryKey: gasto.categoryKey,
    categoria: gasto.categoria,
    casillaAEAT: gasto.casillaAEAT,
    grupoVisual,
    importePrevisto: undefined,
    importeReal: gasto.importe,
  };
}

export function adaptarMejoraAGastoVisual(mejora: MejoraInmueble): GastoInmuebleVisual {
  return {
    idVisual: `mejora:${mejora.id ?? `${mejora.inmuebleId}:${mejora.fecha}:${mejora.descripcion}`}`,
    origen: 'mejora',
    registroId: mejora.id,
    inmuebleId: mejora.inmuebleId,
    ejercicio: mejora.ejercicio,
    fecha: mejora.fecha,
    descripcion: mejora.descripcion,
    estado: undefined,
    categoryKey: mejora.categoryKey,
    grupoVisual: clasificarGastoVisualInmueble({
      ambito: 'inmueble',
      categoryKey: mejora.categoryKey,
      esRegistroMejora: true,
    }),
    importePrevisto: undefined,
    importeReal: mejora.importe,
  };
}

// Casillas del Modelo 100 que la declaración trae pero que NO son un gasto del
// año: bases contables o duplicados de otro registro.
//   0130 · base de amortización del inmueble (valor amortizable, no un desembolso)
//   0129 · mejoras del ejercicio (la misma mejora ya se registra como mejora)
const CASILLAS_NO_COSTE = new Set(['0130', '0129']);

/**
 * ¿La fila cuenta como «lo que costó tener el activo este año»? Fuera quedan las
 * bases contables (0130), los duplicados de mejora (0129) y el alta patrimonial
 * del mobiliario —un mueble es un activo; su coste anual es la amortización
 * (casilla 0117), que sí se conserva—. No altera la persistencia ni el motor
 * fiscal: es solo criterio de presentación del coste.
 */
export function esCosteRealDelAnioInmueble(it: GastoInmuebleVisual): boolean {
  if (it.origen === 'mobiliario') return false;
  if (it.origen === 'real' && it.casillaAEAT && CASILLAS_NO_COSTE.has(it.casillaAEAT)) return false;
  return true;
}

export function adaptarMuebleAGastoVisual(mueble: MuebleInmueble): GastoInmuebleVisual {
  return {
    idVisual: `mobiliario:${mueble.id ?? `${mueble.inmuebleId}:${mueble.fechaAlta}:${mueble.descripcion}`}`,
    origen: 'mobiliario',
    registroId: mueble.id,
    inmuebleId: mueble.inmuebleId,
    ejercicio: mueble.ejercicio,
    fecha: mueble.fechaAlta,
    descripcion: mueble.descripcion,
    estado: mueble.activo ? 'activo' : 'baja',
    categoryKey: mueble.categoryKey,
    grupoVisual: clasificarGastoVisualInmueble({
      ambito: 'inmueble',
      categoryKey: mueble.categoryKey,
      esRegistroMobiliario: true,
    }),
    importePrevisto: undefined,
    importeReal: mueble.importe,
  };
}

export interface ConstruirListaVisualInmuebleInput {
  inmuebleId?: number;
  compromisosRecurrentes?: readonly CompromisoRecurrente[];
  gastosReales?: readonly GastoInmueble[];
  mejoras?: readonly MejoraInmueble[];
  mobiliario?: readonly MuebleInmueble[];
}

export function construirListaVisualGastosInmueble(
  input: ConstruirListaVisualInmuebleInput,
): GastoInmuebleVisual[] {
  const recurrentes = filtrarCompromisosRecurrentesDeInmueble(
    input.compromisosRecurrentes ?? [],
    input.inmuebleId,
  )
    .map(adaptarCompromisoRecurrenteAGastoVisual)
    .filter((item): item is GastoInmuebleVisual => item !== null);

  const reales = (input.gastosReales ?? [])
    .filter((g) => (typeof input.inmuebleId === 'number' ? g.inmuebleId === input.inmuebleId : true))
    .map(adaptarGastoRealAGastoVisual);

  const mejoras = (input.mejoras ?? [])
    .filter((m) => (typeof input.inmuebleId === 'number' ? m.inmuebleId === input.inmuebleId : true))
    .map(adaptarMejoraAGastoVisual);

  const mobiliario = (input.mobiliario ?? [])
    .filter((m) => (typeof input.inmuebleId === 'number' ? m.inmuebleId === input.inmuebleId : true))
    .map(adaptarMuebleAGastoVisual);

  return [...recurrentes, ...reales, ...mejoras, ...mobiliario];
}

// ─── Resumen económico por grupo visual ────────────────────────────────────

/**
 * Totales económicos para un grupo visual (mantener / explotar / mejorar / mobiliario).
 * `previsto` es la suma de importes previstos de compromisos recurrentes.
 * `real` es la suma de importes reales de registros concretos.
 * Ambos son `undefined` cuando no hay ningún dato para ese concepto.
 */
export interface ResumenGrupoInmueble {
  /** Suma de importePrevisto de recurrentes en este grupo. */
  previsto?: number;
  /** Suma de importeReal de gastos/mejoras/mobiliario en este grupo. */
  real?: number;
}

export interface ResumenGastosInmueble {
  mantener: ResumenGrupoInmueble;
  explotar: ResumenGrupoInmueble;
  mejorar: ResumenGrupoInmueble;
  mobiliario: ResumenGrupoInmueble;
  /** Totales agregados de toda la ficha. */
  total: {
    /** Suma de previstos recurrentes (mantener + explotar). */
    previstoRecurrente?: number;
    /** Suma de reales ordinarios (mantener + explotar). */
    realOrdinario?: number;
    /** Suma de importes de mejoras. */
    mejoras?: number;
    /** Suma de importes de mobiliario. */
    mobiliarioReal?: number;
  };
}

function sumarOpcional(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return (a ?? 0) + (b ?? 0);
}

/**
 * Calcula el resumen económico agrupado a partir de la lista visual.
 *
 * `ejercicio` — cuando se proporciona, los importes reales se filtran por
 * ese año (usando `GastoInmuebleVisual.ejercicio`). Los registros sin campo
 * `ejercicio` (p. ej. compromisos recurrentes) no se filtran.
 *
 * Decisión de diseño: `importePrevisto` en el visual de recurrentes es el
 * importe por pago (per-occurrence average devuelto por el adaptador).
 * No se anualiza aquí para evitar importar la lógica del patrón fuera de
 * `compromisosRecurrentesService`. El componente lo etiqueta como "previsto".
 */
export function calcularResumenGastosInmueble(
  lista: readonly GastoInmuebleVisual[],
  ejercicio?: number,
): ResumenGastosInmueble {
  const acum: Record<GrupoVisualInmueble, ResumenGrupoInmueble> = {
    mantener: {},
    explotar: {},
    mejorar: {},
    mobiliario: {},
    sin_clasificar: {},
  };

  for (const item of lista) {
    const grupo = item.grupoVisual;

    // Previsto: solo recurrentes (no hay año fijo, se suman todos)
    if (item.origen === 'recurrente' && item.importePrevisto !== undefined) {
      acum[grupo].previsto = (acum[grupo].previsto ?? 0) + item.importePrevisto;
    }

    // Real: filtrar por ejercicio si se proporciona
    if (item.origen !== 'recurrente' && item.importeReal !== undefined) {
      const ejercicioItem = item.ejercicio;
      if (ejercicio !== undefined && ejercicioItem !== undefined && ejercicioItem !== ejercicio) {
        continue;
      }
      acum[grupo].real = (acum[grupo].real ?? 0) + item.importeReal;
    }
  }

  const previstoRecurrente = sumarOpcional(acum.mantener.previsto, acum.explotar.previsto);
  const realOrdinario = sumarOpcional(acum.mantener.real, acum.explotar.real);

  return {
    mantener: { previsto: acum.mantener.previsto, real: acum.mantener.real },
    explotar: { previsto: acum.explotar.previsto, real: acum.explotar.real },
    mejorar: { real: acum.mejorar.real },
    mobiliario: { real: acum.mobiliario.real },
    total: {
      previstoRecurrente,
      realOrdinario,
      mejoras: acum.mejorar.real,
      mobiliarioReal: acum.mobiliario.real,
    },
  };
}

export { type GrupoVisualInmueble };
