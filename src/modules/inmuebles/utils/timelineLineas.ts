import type {
  Contract,
  Property,
  HabitacionAlquiler,
  EstadoExplotacion,
} from '../../../services/db';
import { isContratoActivo } from './contratoEstado';
import { calcularEstadoChip, estaFirmado } from './calcularEstadoChip';
import { mapearTipoContrato } from './mapearTipoContrato';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';
import {
  type ColorHabitacion,
  colorPorNumeroHabitacion,
  habitacionNumeroDe,
} from './timelineColores';
import {
  type RangoFechas,
  calcularLeftPorcentaje,
  calcularWidthPorcentaje,
  intersectaConRango,
  rangoEfectivoContrato,
} from './timelineRango';

const MS_DIA = 1000 * 60 * 60 * 24;

export type ClaseBarra =
  | 'vigente-l'
  | 'vigente-c'
  | 'pendiente-firma'
  | 'impago'
  | 'renovado'
  | 'libre';

export interface SegmentoContrato {
  tipo: 'contrato';
  leftPct: number;
  widthPct: number;
  contrato: Contract & { id: number };
  textoBarra: string;
  claseBarra: ClaseBarra;
}

export interface SegmentoLibre {
  tipo: 'libre';
  leftPct: number;
  widthPct: number;
  fechaInicioReal: Date;
  textoBarra: string;
  claseBarra: 'libre';
}

export type Segmento = SegmentoContrato | SegmentoLibre;

export interface LineaTimeline {
  key: string;
  habitacionNumero: number | null;
  esPiso: boolean;
  color: ColorHabitacion;
  tipoLabel: 'larga' | 'corta' | 'libre';
  segmentos: Segmento[];
  /** Nombre de la habitación (explotación R3) · si falta, la vista usa «Hab N». */
  nombre?: string;
  /** Estado de la habitación (explotación R3) · `en_reforma` se ve apagada. */
  estadoHabitacion?: EstadoExplotacion;
}

export interface OverlayCompleto {
  contrato: Contract & { id: number };
  leftPct: number;
  widthPct: number;
  textoBarra: string;
  claseBarra: ClaseBarra;
}

export interface PropiedadGroupData {
  lineas: LineaTimeline[];
  overlaysCompletos: OverlayCompleto[];
}

function esRenovadoReciente(c: Contract, hoy: Date, umbralDias = 30): boolean {
  const hist = c.historicoRentas ?? [];
  const ren = hist
    .filter((h) => h.origen === 'renegociacion')
    .map((h) => parseIsoDateAsUTC(h.fechaDesde))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (ren.length === 0) return false;
  const masReciente = Math.max(...ren.map((d) => d.getTime()));
  const dias = Math.floor((hoy.getTime() - masReciente) / MS_DIA);
  return dias >= 0 && dias <= umbralDias;
}

function esFirmaPendiente(c: Contract): boolean {
  return !estaFirmado(c) && c.firma?.estado !== 'firmado';
}

export function claseBarraContrato(c: Contract, hoy: Date = new Date()): ClaseBarra {
  if (esRenovadoReciente(c, hoy, 30)) return 'renovado';
  if (esFirmaPendiente(c)) return 'pendiente-firma';
  if (calcularEstadoChip(c, hoy) === 'impago') return 'impago';
  return mapearTipoContrato(c) === 'corta' ? 'vigente-c' : 'vigente-l';
}

function formatRentaCorta(renta: number | undefined): string {
  const n = Math.round(renta ?? 0);
  return `${n.toLocaleString('es-ES')} €`;
}

export function textoBarraContrato(c: Contract, hoy: Date = new Date()): string {
  const nombre =
    `${c.inquilino?.nombre ?? ''} ${c.inquilino?.apellidos ?? ''}`.trim() ||
    '—';
  const renta = formatRentaCorta(c.rentaMensual);
  if (esRenovadoReciente(c, hoy, 30)) return `${nombre} · renovado · ${renta}`;
  if (esFirmaPendiente(c)) return `${nombre} · firma pendiente`;
  if (calcularEstadoChip(c, hoy) === 'impago') return `${nombre} · impago`;
  const tipo = mapearTipoContrato(c);
  return `${nombre} · ${tipo} · ${renta}`;
}

function textoSegmentoLibre(desde: Date, hasta: Date, hoy: Date): string {
  const enHueco = hoy >= desde && hoy <= hasta;
  const diasDesdeInicio = Math.max(
    0,
    Math.floor((hoy.getTime() - desde.getTime()) / MS_DIA),
  );
  if (enHueco && diasDesdeInicio > 7) {
    return `libre · ${diasDesdeInicio} d · sin candidato`;
  }
  if (enHueco) {
    return `libre · ${diasDesdeInicio} d`;
  }
  if (desde > hoy) return 'libre · a decidir';
  return 'libre';
}

function crearSegmentoLibre(
  desde: Date,
  hasta: Date,
  rangoFechas: RangoFechas,
  hoy: Date,
): SegmentoLibre {
  return {
    tipo: 'libre',
    leftPct: calcularLeftPorcentaje(desde, rangoFechas),
    widthPct: calcularWidthPorcentaje(desde, hasta, rangoFechas),
    fechaInicioReal: desde,
    textoBarra: textoSegmentoLibre(desde, hasta, hoy),
    claseBarra: 'libre',
  };
}

function segmentoDeContrato(
  c: Contract & { id: number },
  ef: { inicio: Date; fin: Date },
  rangoFechas: RangoFechas,
  hoy: Date,
): SegmentoContrato {
  return {
    tipo: 'contrato',
    leftPct: calcularLeftPorcentaje(ef.inicio, rangoFechas),
    widthPct: calcularWidthPorcentaje(ef.inicio, ef.fin, rangoFechas),
    contrato: c,
    textoBarra: textoBarraContrato(c, hoy),
    claseBarra: claseBarraContrato(c, hoy),
  };
}

function generarSegmentos(
  contratos: (Contract & { id: number })[],
  rangoFechas: RangoFechas,
  hoy: Date,
): Segmento[] {
  const visibles = contratos
    .filter(isContratoActivo)
    .filter((c) => intersectaConRango(c, rangoFechas))
    .map((c) => {
      const ef = rangoEfectivoContrato(c, rangoFechas);
      return ef ? { c, ef } : null;
    })
    .filter((x): x is { c: Contract & { id: number }; ef: { inicio: Date; fin: Date } } => x != null)
    .sort((a, b) => a.ef.inicio.getTime() - b.ef.inicio.getTime());

  const segmentos: Segmento[] = [];
  let cursor = rangoFechas.inicio;
  for (const { c, ef } of visibles) {
    const inicioEnRango = ef.inicio < rangoFechas.inicio ? rangoFechas.inicio : ef.inicio;
    const finEnRango = ef.fin > rangoFechas.fin ? rangoFechas.fin : ef.fin;
    if (inicioEnRango > cursor) {
      segmentos.push(crearSegmentoLibre(cursor, inicioEnRango, rangoFechas, hoy));
    }
    segmentos.push(
      segmentoDeContrato(c, { inicio: inicioEnRango, fin: finEnRango }, rangoFechas, hoy),
    );
    if (finEnRango > cursor) cursor = finEnRango;
  }
  if (cursor < rangoFechas.fin) {
    segmentos.push(crearSegmentoLibre(cursor, rangoFechas.fin, rangoFechas, hoy));
  }
  return segmentos;
}

/** Descriptor de una línea de habitación · unifica explotación (R3) y legacy. */
interface DescriptorHabitacion {
  id: string;
  numero: number;
  nombre?: string;
  estado?: EstadoExplotacion;
}

/** Número que le toca a una habitación · del id `hab-N`, o su posición. */
function numeroDeHabitacion(h: HabitacionAlquiler, indice: number): number {
  const m = /^hab-(\d+)$/.exec(h.id);
  return m ? Number(m[1]) : indice + 1;
}

/**
 * Las habitaciones a dibujar. Con explotación (R3) manda su lista (nombre, renta,
 * estado); sin ella se derivan de `bedrooms` con el esquema `hab-N` de siempre.
 */
function descriptoresHabitacion(
  propiedad: Property,
  habitaciones: HabitacionAlquiler[] | undefined,
): DescriptorHabitacion[] {
  if (habitaciones !== undefined) {
    return habitaciones.map((h, i) => ({
      id: h.id,
      numero: numeroDeHabitacion(h, i),
      nombre: h.nombre,
      estado: h.estado,
    }));
  }
  const N = Math.max(1, propiedad.bedrooms || 1);
  return Array.from({ length: N }, (_, i) => ({ id: `hab-${i + 1}`, numero: i + 1 }));
}

export function generarPropiedadGroupData(
  propiedad: Property,
  contratos: Contract[],
  rangoFechas: RangoFechas,
  hoy: Date = new Date(),
  habitaciones?: HabitacionAlquiler[],
): PropiedadGroupData {
  const descriptores = descriptoresHabitacion(propiedad, habitaciones);
  const contratosConId = contratos.filter(
    (c): c is Contract & { id: number } => c.id != null,
  );

  // Una sola unidad arrendable · 1 línea "Piso" (piso completo · turístico).
  if (descriptores.length <= 1) {
    const segmentos = generarSegmentos(contratosConId, rangoFechas, hoy);
    const ultimo = contratosConId.find(isContratoActivo);
    return {
      lineas: [
        {
          key: 'piso',
          habitacionNumero: null,
          esPiso: true,
          color: 'verde',
          tipoLabel: ultimo ? mapearTipoContrato(ultimo) : 'libre',
          segmentos,
          nombre: habitaciones?.[0]?.nombre,
          estadoHabitacion: habitaciones?.[0]?.estado,
        },
      ],
      overlaysCompletos: [],
    };
  }

  // Multi-habitación · separamos por alcance
  const contratosCompleto = contratosConId.filter(
    (c) => c.unidadTipo === 'vivienda',
  );
  const contratosPorHab = contratosConId.filter(
    (c) => c.unidadTipo === 'habitacion',
  );

  // Una línea por habitación · empareja por id real y, por compat, por número.
  const lineas: LineaTimeline[] = descriptores.map((desc) => {
    const contratosDeHab = contratosPorHab.filter(
      (c) => c.habitacionId === desc.id || habitacionNumeroDe(c) === desc.numero,
    );
    const segmentos = generarSegmentos(contratosDeHab, rangoFechas, hoy);
    const ultimo = contratosDeHab.find(isContratoActivo);
    return {
      key: desc.id,
      habitacionNumero: desc.numero,
      esPiso: false,
      color: colorPorNumeroHabitacion(desc.numero),
      tipoLabel: ultimo ? mapearTipoContrato(ultimo) : 'libre',
      segmentos,
      nombre: desc.nombre,
      estadoHabitacion: desc.estado,
    };
  });

  // Overlays · contratos piso_completo que intersectan con el rango
  const overlaysCompletos: OverlayCompleto[] = contratosCompleto
    .filter(isContratoActivo)
    .filter((c) => intersectaConRango(c, rangoFechas))
    .map((c) => {
      const ef = rangoEfectivoContrato(c, rangoFechas);
      if (!ef) return null;
      const inicioEnRango =
        ef.inicio < rangoFechas.inicio ? rangoFechas.inicio : ef.inicio;
      const finEnRango = ef.fin > rangoFechas.fin ? rangoFechas.fin : ef.fin;
      return {
        contrato: c,
        leftPct: calcularLeftPorcentaje(inicioEnRango, rangoFechas),
        widthPct: calcularWidthPorcentaje(inicioEnRango, finEnRango, rangoFechas),
        textoBarra: textoBarraContrato(c, hoy),
        claseBarra: claseBarraContrato(c, hoy),
      };
    })
    .filter((x): x is OverlayCompleto => x != null);

  return { lineas, overlaysCompletos };
}
