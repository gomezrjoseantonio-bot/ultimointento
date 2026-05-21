import type { Contract, Property } from '../../../services/db';
import { isContratoActivo } from './contratoEstado';
import { esFechaIndefinida } from './formatFechaFin';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';

export interface UnidadLibre {
  inmuebleId: number;
  inmuebleAlias: string;
  diasLibre: number | null;
  fechaLibreDesde?: string;
  rentaPotencial?: number;
  rentaPerdidaAcumulada?: number;
  unidadLabel: string;
}

export interface ResultadoLibresAhora {
  total: number;
  unidades: UnidadLibre[];
  diasTotalesAcumulados: number;
  rentaPerdidaAcumulada: number;
}

const MS_DIA = 1000 * 60 * 60 * 24;

function diasEntre(desde: Date, hasta: Date): number {
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / MS_DIA));
}

function rentaMediaInmueble(contratos: Contract[]): number | undefined {
  const con = contratos.filter((c) => typeof c.rentaMensual === 'number');
  if (con.length === 0) return undefined;
  return con.reduce((s, c) => s + c.rentaMensual, 0) / con.length;
}

/**
 * Calcula las unidades sin contrato activo a fecha `hoy`.
 *
 * Modelo actual del proyecto · `Property.bedrooms` indica el número de unidades
 * arrendables por propiedad; cada `Contract.estadoContrato === 'activo'` ocupa
 * una unidad. No existe entidad `Habitacion` con identidad propia, por lo que
 * el detalle por habitación se resume como "Unidad libre" sin etiqueta.
 *
 * `diasLibre` se estima como días desde la fecha de fin del último contrato
 * finalizado del inmueble; si no hay contratos previos se devuelve `null`.
 */
export function calcularLibresAhora(
  contracts: Contract[],
  properties: Property[],
  hoy: Date = new Date(),
): ResultadoLibresAhora {
  if (properties.length === 0) {
    return { total: 0, unidades: [], diasTotalesAcumulados: 0, rentaPerdidaAcumulada: 0 };
  }

  const hoyNorm = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));

  const contratosPorInmueble = new Map<number, Contract[]>();
  for (const c of contracts) {
    const lista = contratosPorInmueble.get(c.inmuebleId) ?? [];
    lista.push(c);
    contratosPorInmueble.set(c.inmuebleId, lista);
  }

  const unidades: UnidadLibre[] = [];

  for (const p of properties) {
    if (p.id == null) continue;
    if (p.state && p.state !== 'activo') continue;
    const totalUnidades = Math.max(1, p.bedrooms || 1);
    const contratosInmueble = contratosPorInmueble.get(p.id) ?? [];
    const activos = contratosInmueble.filter(isContratoActivo);
    const libresEnInmueble = totalUnidades - activos.length;
    if (libresEnInmueble <= 0) continue;

    const finalizados = contratosInmueble
      .filter((c) => c.estadoContrato === 'finalizado' || c.estadoContrato === 'rescindido')
      .filter((c) => c.fechaFin && !esFechaIndefinida(c.fechaFin))
      .sort((a, b) => (a.fechaFin < b.fechaFin ? 1 : -1));
    const ultimoFinalizado = finalizados[0];
    const fechaLibreDesde = ultimoFinalizado?.fechaFin;
    const fechaLibreParsed = fechaLibreDesde ? parseIsoDateAsUTC(fechaLibreDesde) : null;
    const diasLibre = fechaLibreParsed && !Number.isNaN(fechaLibreParsed.getTime())
      ? diasEntre(fechaLibreParsed, hoyNorm)
      : null;

    const rentaReferencia =
      ultimoFinalizado?.rentaMensual ?? rentaMediaInmueble(contratosInmueble);
    const rentaPerdida = diasLibre != null && rentaReferencia != null
      ? Math.round((rentaReferencia / 30) * diasLibre)
      : undefined;

    for (let i = 0; i < libresEnInmueble; i += 1) {
      unidades.push({
        inmuebleId: p.id,
        inmuebleAlias: p.alias,
        diasLibre,
        fechaLibreDesde,
        rentaPotencial: rentaReferencia,
        rentaPerdidaAcumulada: rentaPerdida,
        unidadLabel: totalUnidades === 1 ? 'Unidad libre' : `Unidad libre ${i + 1}`,
      });
    }
  }

  const diasTotalesAcumulados = unidades.reduce(
    (s, u) => s + (u.diasLibre ?? 0),
    0,
  );
  const rentaPerdidaAcumulada = unidades.reduce(
    (s, u) => s + (u.rentaPerdidaAcumulada ?? 0),
    0,
  );

  return {
    total: unidades.length,
    unidades,
    diasTotalesAcumulados,
    rentaPerdidaAcumulada,
  };
}
