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
  fecha: string;
  descripcion: string;
  estado?: string;
  concepto?: string;
  categoryKey?: string;
  categoria?: string;
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
  return {
    idVisual: `real:${gasto.id ?? `${gasto.inmuebleId}:${gasto.fecha}:${gasto.concepto}`}`,
    origen: 'real',
    registroId: gasto.id,
    inmuebleId: gasto.inmuebleId,
    fecha: gasto.fecha,
    descripcion: gasto.concepto,
    estado: gasto.estado,
    categoryKey: gasto.categoryKey,
    categoria: gasto.categoria,
    grupoVisual: clasificarGastoVisualInmueble({
      ambito: 'inmueble',
      categoryKey: gasto.categoryKey,
      categoria: gasto.categoria,
    }),
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

export function adaptarMuebleAGastoVisual(mueble: MuebleInmueble): GastoInmuebleVisual {
  return {
    idVisual: `mobiliario:${mueble.id ?? `${mueble.inmuebleId}:${mueble.fechaAlta}:${mueble.descripcion}`}`,
    origen: 'mobiliario',
    registroId: mueble.id,
    inmuebleId: mueble.inmuebleId,
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
