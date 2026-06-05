import type { Contract } from '../../../services/db';
import { mapearTipoContrato } from './mapearTipoContrato';
import { calcularEstadoChip, type EstadoChip } from './calcularEstadoChip';

export interface FiltrosActivos {
  busqueda: string;
  /** Filtro por inmueble · `'todos'` o el id del inmueble. */
  inmueble: 'todos' | number;
  // `tipo`/`estado` se conservan en el modelo por compatibilidad de storage,
  // pero la barra de filtros V5-FIX ya NO los expone (spec § 1.2 elimina los
  // chips TIPO/ESTADO). Quedan fijados a 'todos'.
  tipo: 'todos' | 'larga' | 'corta';
  estado: 'todos' | EstadoChip;
}

export const FILTROS_INICIALES: FiltrosActivos = {
  busqueda: '',
  inmueble: 'todos',
  tipo: 'todos',
  estado: 'todos',
};

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function filtrarContratos(
  contratos: Contract[],
  filtros: FiltrosActivos,
  hoy: Date = new Date(),
): Contract[] {
  let resultado = contratos;

  const q = filtros.busqueda.trim();
  if (q !== '') {
    const qNorm = normalizarTexto(q);
    resultado = resultado.filter((c) => {
      const nombre = `${c.inquilino?.nombre ?? ''} ${c.inquilino?.apellidos ?? ''}`;
      return (
        normalizarTexto(nombre).includes(qNorm) ||
        normalizarTexto(c.inquilino?.dni ?? '').includes(qNorm) ||
        normalizarTexto(c.inquilino?.email ?? '').includes(qNorm)
      );
    });
  }

  if (filtros.inmueble !== 'todos') {
    resultado = resultado.filter((c) => c.inmuebleId === filtros.inmueble);
  }

  if (filtros.tipo !== 'todos') {
    resultado = resultado.filter((c) => mapearTipoContrato(c) === filtros.tipo);
  }

  if (filtros.estado !== 'todos') {
    resultado = resultado.filter((c) => calcularEstadoChip(c, hoy) === filtros.estado);
  }

  return resultado;
}

export interface CountsChips {
  tipo: { todos: number; larga: number; corta: number };
  estado: {
    todos: number;
    'al-dia': number;
    'vence-30d': number;
    impago: number;
    'sin-firmar': number;
  };
}

export function contarChips(contratos: Contract[], hoy: Date = new Date()): CountsChips {
  const counts: CountsChips = {
    tipo: { todos: contratos.length, larga: 0, corta: 0 },
    estado: {
      todos: contratos.length,
      'al-dia': 0,
      'vence-30d': 0,
      impago: 0,
      'sin-firmar': 0,
    },
  };
  for (const c of contratos) {
    counts.tipo[mapearTipoContrato(c)] += 1;
    counts.estado[calcularEstadoChip(c, hoy)] += 1;
  }
  return counts;
}

export interface StatsAgregados {
  total: number;
  rentaMensual: number;
  fianzaAcumulada: number;
}

export function calcularStatsAgregados(contratos: Contract[]): StatsAgregados {
  return {
    total: contratos.length,
    rentaMensual: contratos.reduce((sum, c) => sum + (c.rentaMensual ?? 0), 0),
    fianzaAcumulada: contratos.reduce((sum, c) => sum + (c.fianzaImporte ?? 0), 0),
  };
}
