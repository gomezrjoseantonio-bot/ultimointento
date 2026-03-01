import { initDB } from './db';
import { Aportacion, PosicionInversion } from '../types/inversiones';
import { getConfiguracionFiscal, saveConfiguracionFiscal } from './fiscalPaymentsService';
import { CONSTANTES_IRPF } from './irpfCalculationService';

export interface OperacionFiscal {
  posicionId: number;
  posicionNombre: string;
  fecha: string;
  importeVenta: number;
  costeAdquisicion: number;
  gananciaOPerdida: number;
  tipo: 'plusvalia' | 'minusvalia';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getAportacionUnits(aportacion: Aportacion): number | undefined {
  const candidate = (aportacion as any).unidades_compradas
    ?? (aportacion as any).unidades
    ?? (aportacion as any).participaciones
    ?? (aportacion as any).numero_participaciones;
  return typeof candidate === 'number' && candidate > 0 ? candidate : undefined;
}

function normalizarFecha(fecha: string): number {
  const ts = new Date(fecha).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

export function calcularGananciaPerdidaFIFO(
  posicion: PosicionInversion,
  reembolso: Aportacion,
): { costeAdquisicion: number; gananciaOPerdida: number } {
  const aportacionesOrdenadas = (posicion.aportaciones ?? [])
    .filter((a) => a.tipo === 'aportacion')
    .sort((a, b) => normalizarFecha(a.fecha) - normalizarFecha(b.fecha));

  const unidadesVenta = reembolso.unidades_vendidas;
  let costeAdquisicion = 0;

  if (typeof unidadesVenta === 'number' && unidadesVenta > 0) {
    let unidadesRestantes = unidadesVenta;
    for (const aportacion of aportacionesOrdenadas) {
      if (unidadesRestantes <= 0) break;
      const unidadesAportacion = getAportacionUnits(aportacion);
      if (!unidadesAportacion) continue;
      const unidadesConsumidas = Math.min(unidadesRestantes, unidadesAportacion);
      const costeUnitario = aportacion.importe / unidadesAportacion;
      costeAdquisicion += unidadesConsumidas * costeUnitario;
      unidadesRestantes -= unidadesConsumidas;
    }

    if (unidadesRestantes > 0) {
      const costeMedioFallback = (posicion.total_aportado ?? 0) / Math.max(1, unidadesVenta - unidadesRestantes);
      costeAdquisicion += unidadesRestantes * costeMedioFallback;
    }
  } else {
    let ventaRestante = reembolso.importe;
    for (const aportacion of aportacionesOrdenadas) {
      if (ventaRestante <= 0) break;
      const base = Math.min(ventaRestante, aportacion.importe);
      costeAdquisicion += base;
      ventaRestante -= base;
    }

    if (ventaRestante > 0) {
      costeAdquisicion += ventaRestante;
    }
  }

  const coste = round2(costeAdquisicion);
  const ganancia = round2((reembolso.importe ?? 0) - coste);
  return { costeAdquisicion: coste, gananciaOPerdida: ganancia };
}

export async function calcularGananciasPerdidasEjercicio(
  ejercicio: number,
): Promise<{ plusvalias: number; minusvalias: number; operaciones: OperacionFiscal[] }> {
  const db = await initDB();
  const posiciones = (await db.getAll('inversiones')) as PosicionInversion[];

  let plusvalias = 0;
  let minusvalias = 0;
  const operaciones: OperacionFiscal[] = [];

  for (const posicion of posiciones) {
    if (!posicion?.activo) continue;
    for (const operacion of (posicion.aportaciones ?? [])) {
      if (operacion.tipo !== 'reembolso') continue;
      const anioOperacion = new Date(operacion.fecha).getFullYear();
      if (anioOperacion !== ejercicio) continue;

      const { costeAdquisicion, gananciaOPerdida } = calcularGananciaPerdidaFIFO(posicion, operacion);
      const tipo: 'plusvalia' | 'minusvalia' = gananciaOPerdida >= 0 ? 'plusvalia' : 'minusvalia';
      operaciones.push({
        posicionId: posicion.id,
        posicionNombre: posicion.nombre,
        fecha: operacion.fecha,
        importeVenta: round2(operacion.importe),
        costeAdquisicion,
        gananciaOPerdida,
        tipo,
      });

      if (gananciaOPerdida >= 0) plusvalias += gananciaOPerdida;
      else minusvalias += Math.abs(gananciaOPerdida);
    }
  }

  return {
    plusvalias: round2(plusvalias),
    minusvalias: round2(minusvalias),
    operaciones,
  };
}

export async function getMinusvaliasPendientes(ejercicio: number): Promise<{ anio: number; importe: number }[]> {
  const config = await getConfiguracionFiscal();
  const limite = CONSTANTES_IRPF.aniosCompensacionPerdidas;

  return (config.minusvalias_pendientes ?? [])
    .filter((item) => item.importe > 0 && (ejercicio - item.anio) <= limite)
    .sort((a, b) => a.anio - b.anio)
    .map((item) => ({ anio: item.anio, importe: round2(item.importe) }));
}

export async function gestionarArrastresMinusvalias(ejercicio: number): Promise<void> {
  const limite = CONSTANTES_IRPF.aniosCompensacionPerdidas;
  const { plusvalias, minusvalias } = await calcularGananciasPerdidasEjercicio(ejercicio);
  const config = await getConfiguracionFiscal();

  let pendientes = (config.minusvalias_pendientes ?? [])
    .filter((item) => item.importe > 0 && (ejercicio - item.anio) <= limite)
    .map((item) => ({ anio: item.anio, importe: round2(item.importe) }))
    .sort((a, b) => a.anio - b.anio);

  const netoEjercicio = round2(plusvalias - minusvalias);

  if (netoEjercicio > 0) {
    let restanteCompensar = netoEjercicio;
    pendientes = pendientes.map((item) => {
      if (restanteCompensar <= 0) return item;
      const aplicado = Math.min(item.importe, restanteCompensar);
      restanteCompensar = round2(restanteCompensar - aplicado);
      return {
        ...item,
        importe: round2(item.importe - aplicado),
      };
    }).filter((item) => item.importe > 0);
  } else if (netoEjercicio < 0) {
    pendientes.push({ anio: ejercicio, importe: round2(Math.abs(netoEjercicio)) });
  }

  // TODO: regla antiaplicación de 2 meses (valores homogéneos) no implementada.

  await saveConfiguracionFiscal({
    minusvalias_pendientes: pendientes
      .filter((item) => item.importe > 0 && (ejercicio - item.anio) <= limite)
      .sort((a, b) => a.anio - b.anio),
  });
}
