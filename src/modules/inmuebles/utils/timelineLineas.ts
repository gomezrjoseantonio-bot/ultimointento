import type { Contract, Property } from '../../../services/db';
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
    .map((c) => ({ c, ef: rangoEfectivoContrato(c, rangoFechas)! }))
    .filter((x) => x.ef != null)
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

export function generarPropiedadGroupData(
  propiedad: Property,
  contratos: Contract[],
  rangoFechas: RangoFechas,
  hoy: Date = new Date(),
): PropiedadGroupData {
  const N = Math.max(1, propiedad.bedrooms || 1);
  const contratosConId = contratos.filter(
    (c): c is Contract & { id: number } => c.id != null,
  );

  // Si la propiedad sólo tiene una unidad arrendable · 1 línea "Piso"
  if (N === 1) {
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

  // N líneas · una por habitación · con segmentos de los contratos asignados
  const lineas: LineaTimeline[] = [];
  for (let i = 0; i < N; i += 1) {
    const habNum = i + 1;
    const contratosDeHab = contratosPorHab.filter(
      (c) => habitacionNumeroDe(c) === habNum,
    );
    const segmentos = generarSegmentos(contratosDeHab, rangoFechas, hoy);
    const ultimo = contratosDeHab.find(isContratoActivo);
    lineas.push({
      key: `hab-${habNum}`,
      habitacionNumero: habNum,
      esPiso: false,
      color: colorPorNumeroHabitacion(habNum),
      tipoLabel: ultimo ? mapearTipoContrato(ultimo) : 'libre',
      segmentos,
    });
  }

  // Overlays · contratos piso_completo que intersectan con el rango
  const overlaysCompletos: OverlayCompleto[] = contratosCompleto
    .filter(isContratoActivo)
    .filter((c) => intersectaConRango(c, rangoFechas))
    .map((c) => {
      const ef = rangoEfectivoContrato(c, rangoFechas)!;
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
    });

  return { lineas, overlaysCompletos };
}
