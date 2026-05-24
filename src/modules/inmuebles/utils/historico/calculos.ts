import type { Contract, Property } from '../../../../services/db';
import { mapearTipoContrato } from '../mapearTipoContrato';
import { habitacionNumeroDe } from '../timelineColores';
import { formatEuros } from './formato';
import type {
  CeldaRotacion,
  ClaseHeat,
  Insight,
  KpisHistorico,
  MotivoDist,
  MotivoFinKey,
  RotacionInmueble,
  RowDuracion,
  StatsPagos,
} from './tipos';

const MS_DIA = 1000 * 60 * 60 * 24;
const DIAS_MES = 30.4375;

const MOTIVOS_FIN: MotivoFinKey[] = [
  'fin_natural',
  'cambio_ciudad',
  'no_renovacion_precio',
  'incidencia_convivencia',
  'rescision_impago',
  'otros',
];

const MOTIVO_TEXTO: Record<MotivoFinKey, string> = {
  fin_natural: 'fin natural',
  cambio_ciudad: 'cambio de ciudad',
  no_renovacion_precio: 'no renovación por precio',
  incidencia_convivencia: 'incidencia de convivencia',
  rescision_impago: 'rescisión por impago',
  otros: 'otros',
  sin_clasificar: 'sin clasificar',
};

function parseDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha real de salida · prioriza fechaCierre, luego rescisión, luego fechaFin. */
export function fechaCierreEfectiva(c: Contract): string | undefined {
  return c.fechaCierre ?? c.rescision?.fecha ?? c.fechaFin;
}

/** Duración real del contrato en meses (decimal). 0 si no calculable. */
export function calcularDuracionMeses(c: Contract): number {
  const ini = parseDate(c.fechaInicio);
  const fin = parseDate(fechaCierreEfectiva(c));
  if (!ini || !fin) return 0;
  const meses = (fin.getTime() - ini.getTime()) / (MS_DIA * DIAS_MES);
  return meses > 0 ? meses : 0;
}

/** Días transcurridos desde la salida. Negativo si la salida es futura. */
export function calcularDiasDesdeSalida(c: Contract, hoy: Date = new Date()): number {
  const fin = parseDate(fechaCierreEfectiva(c));
  if (!fin) return 0;
  return Math.floor((hoy.getTime() - fin.getTime()) / MS_DIA);
}

/** "salió hace 47 días" / "salió hoy" / "salió hace 3 meses". */
export function textoSalida(dias: number, _c: Contract): string {
  if (dias < 0) {
    const futuros = Math.abs(dias);
    return futuros === 1 ? 'sale mañana' : `sale en ${futuros} días`;
  }
  if (dias === 0) return 'salió hoy';
  if (dias === 1) return 'salió ayer';
  if (dias < 60) return `salió hace ${dias} días`;
  const meses = Math.round(dias / DIAS_MES);
  return `salió hace ${meses} meses`;
}

/** Versión compacta · "hace 47d" / "hace 3m" / "hoy". */
export function textoCortoSalida(dias: number, _c: Contract): string {
  if (dias < 0) return `en ${Math.abs(dias)}d`;
  if (dias === 0) return 'hoy';
  if (dias < 60) return `hace ${dias}d`;
  return `hace ${Math.round(dias / DIAS_MES)}m`;
}

/** Texto de la fianza devuelta · usa `fianzaImporte` como importe original. */
export function textoFianzaDevuelta(c: Contract): string {
  if (c.fianzaDevuelta === undefined || c.fianzaDevuelta === null) return '—';
  if (c.fianzaDevuelta === 0) return 'Retenida total';
  const original = c.fianzaImporte ?? 0;
  if (original === 0) return `${formatEuros(c.fianzaDevuelta)} €`;
  if (c.fianzaDevuelta >= original) return `${formatEuros(c.fianzaDevuelta)} € · íntegra`;
  return `${formatEuros(c.fianzaDevuelta)} € de ${formatEuros(original)} €`;
}

/**
 * Stats de pagos del histórico · placeholder honesto mientras no exista
 * servicio de cobros · devuelve nulls para mostrar "—" + mensaje informativo.
 */
export function obtenerStatsPagos(_c: Contract): StatsPagos {
  return { alDia: null, conRetraso: null, impagos: null };
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/** Clave de agrupación por unidad física (inmueble + habitación). */
function unidadKey(c: Contract): string {
  return `${c.inmuebleId}::${c.unidadTipo === 'habitacion' ? c.habitacionId ?? '?' : 'piso'}`;
}

export function calcularDiasVaciosMedios(
  contratos: Contract[],
  hoy: Date = new Date(),
): number | null {
  const porUnidad = new Map<string, Contract[]>();
  contratos.forEach((c) => {
    const key = unidadKey(c);
    const arr = porUnidad.get(key) ?? [];
    arr.push(c);
    porUnidad.set(key, arr);
  });

  const gaps: number[] = [];
  porUnidad.forEach((lista) => {
    const ordenados = [...lista].sort((a, b) => {
      const da = parseDate(a.fechaInicio)?.getTime() ?? 0;
      const db = parseDate(b.fechaInicio)?.getTime() ?? 0;
      return da - db;
    });
    for (let i = 0; i < ordenados.length - 1; i += 1) {
      const finPrev = parseDate(fechaCierreEfectiva(ordenados[i]));
      const iniNext = parseDate(ordenados[i + 1].fechaInicio);
      if (!finPrev || !iniNext) continue;
      const dias = Math.round((iniNext.getTime() - finPrev.getTime()) / MS_DIA);
      if (dias >= 0 && iniNext.getTime() <= hoy.getTime() + MS_DIA * 365 * 5) {
        gaps.push(dias);
      }
    }
  });

  if (gaps.length === 0) return null;
  return Math.round(media(gaps));
}

export function calcularKpisHistorico(
  contratos: Contract[],
  hoy: Date = new Date(),
): KpisHistorico {
  const duraciones = contratos.map(calcularDuracionMeses).filter((m) => m > 0);
  const valoraciones = contratos
    .map((c) => c.valoracion)
    .filter((v): v is NonNullable<typeof v> => v != null);

  return {
    totalFinalizados: contratos.length,
    duracionMediaMeses: duraciones.length ? Math.round(media(duraciones) * 10) / 10 : 0,
    diasVaciosMedios: calcularDiasVaciosMedios(contratos, hoy),
    valoracionMedia: valoraciones.length
      ? Math.round(media(valoraciones) * 10) / 10
      : null,
  };
}

function claseRotacion(n: number): ClaseHeat {
  if (n <= 0) return 'r1';
  if (n === 1) return 'r2';
  if (n === 2) return 'r3';
  if (n === 3) return 'r4';
  if (n === 4) return 'r5';
  if (n === 5) return 'r6';
  return 'r7';
}

function numHabitaciones(p: Property): number {
  if (p.alquilerPorHabitaciones?.activo && p.alquilerPorHabitaciones.numeroHabitaciones) {
    return Math.max(1, p.alquilerPorHabitaciones.numeroHabitaciones);
  }
  return Math.max(1, p.bedrooms || 1);
}

export function calcularRotacionPorHabitacion(
  contratos: Contract[],
  properties: Property[],
): RotacionInmueble[] {
  return properties
    .filter((p): p is Property & { id: number } => p.id != null)
    .map((p) => {
      const delInmueble = contratos.filter((c) => c.inmuebleId === p.id);
      const porHabitaciones = p.alquilerPorHabitaciones?.activo;

      let celdas: CeldaRotacion[];
      if (porHabitaciones) {
        const N = numHabitaciones(p);
        celdas = Array.from({ length: N }, (_, i) => {
          const habNum = i + 1;
          const rotaciones = delInmueble.filter(
            (c) => c.unidadTipo === 'habitacion' && habitacionNumeroDe(c) === habNum,
          ).length;
          return { habitacion: habNum, rotaciones, clase: claseRotacion(rotaciones) };
        });
      } else {
        const rotaciones = delInmueble.length;
        celdas = [{ habitacion: null, rotaciones, clase: claseRotacion(rotaciones) }];
      }

      return { inmuebleId: p.id, alias: p.alias, celdas };
    })
    .filter((r) => r.celdas.some((c) => c.rotaciones > 0) || properties.length <= 12);
}

export function calcularDistribucionMotivosSalida(contratos: Contract[]): MotivoDist[] {
  const total = contratos.length;
  const counts = new Map<MotivoFinKey, number>();
  contratos.forEach((c) => {
    const key: MotivoFinKey = c.motivoFin ?? 'sin_clasificar';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return MOTIVOS_FIN.map((motivo) => {
    const count = counts.get(motivo) ?? 0;
    return { motivo, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
}

export function calcularDuracionPorTipo(contratos: Contract[]): RowDuracion[] {
  const grupos: Record<'corta' | 'larga', number[]> = { corta: [], larga: [] };
  contratos.forEach((c) => {
    const tipo = mapearTipoContrato(c);
    const meses = calcularDuracionMeses(c);
    if (meses > 0) grupos[tipo].push(meses);
  });

  const filas: RowDuracion[] = [
    {
      tipo: 'larga',
      label: 'Larga estancia',
      duracionMediaMeses: Math.round(media(grupos.larga) * 10) / 10,
      pctBar: 0,
      count: grupos.larga.length,
    },
    {
      tipo: 'corta',
      label: 'Corta estancia',
      duracionMediaMeses: Math.round(media(grupos.corta) * 10) / 10,
      pctBar: 0,
      count: grupos.corta.length,
    },
  ];

  const max = Math.max(...filas.map((f) => f.duracionMediaMeses), 1);
  filas.forEach((f) => {
    f.pctBar = Math.round((f.duracionMediaMeses / max) * 100);
  });
  return filas;
}

export function generarInsights(
  contratos: Contract[],
  kpis: KpisHistorico,
  rotacion: RotacionInmueble[],
  motivos: MotivoDist[],
): Insight[] {
  const insights: Insight[] = [];
  if (contratos.length === 0) return insights;

  // 1 · Motivo de salida dominante.
  const motivoTop = [...motivos].sort((a, b) => b.count - a.count)[0];
  if (motivoTop && motivoTop.count > 0 && motivoTop.pct >= 40) {
    const tono = motivoTop.motivo === 'rescision_impago' ? 'neg' : 'info';
    insights.push({
      tipo: tono,
      texto: `El ${motivoTop.pct}% de las salidas se debió a ${MOTIVO_TEXTO[motivoTop.motivo]}.`,
    });
  }

  // 2 · Unidad con rotación más alta.
  const todasCeldas = rotacion.flatMap((inm) =>
    inm.celdas.map((celda) => ({
      alias: inm.alias,
      hab: celda.habitacion,
      rot: celda.rotaciones,
    })),
  );
  const peor = todasCeldas.reduce<{ alias: string; hab: number | null; rot: number } | null>(
    (max, cur) => (max === null || cur.rot > max.rot ? cur : max),
    null,
  );
  if (peor && peor.rot >= 3) {
    const donde = peor.hab != null ? `${peor.alias} · hab ${peor.hab}` : peor.alias;
    insights.push({
      tipo: 'warn',
      texto: `${donde} acumula ${peor.rot} contratos finalizados · revisa la rotación.`,
    });
  }

  // 3 · Duración media.
  if (kpis.duracionMediaMeses > 0) {
    const tono = kpis.duracionMediaMeses >= 12 ? 'pos' : 'info';
    insights.push({
      tipo: tono,
      texto: `La duración media de los contratos finalizados es de ${kpis.duracionMediaMeses} meses.`,
    });
  }

  return insights.slice(0, 3);
}
