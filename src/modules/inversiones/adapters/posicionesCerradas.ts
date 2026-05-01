// T23.4 · Adaptador "posiciones cerradas" · perspectiva inversor.
//
// La fuente real de las ventas/cierres del usuario vive en la
// `DeclaracionCompleta` importada del XML AEAT
// (`ejerciciosFiscalesCoord[].aeat.declaracionCompleta.gananciasPerdidas`).
// Ese modelo es FISCAL · expone `valorAdquisicion`, `valorTransmision`,
// `ganancia`, `nifFondo`, `retencion`, etc.
//
// Este adaptador OCULTA el lenguaje fiscal y traduce cada operación a la
// estructura `PosicionCerrada` con narrativa de inversor (`aportado`,
// `vendido`, `resultado`, `cagr`, `duracionDias`). § 5.2/5.4 spec.
//
// El adaptador es **read-only · idempotente · cero migración**. NO toca
// el store fiscal · solo lo lee. Si un campo no está disponible (típico
// del XML AEAT que no expone fechas de adquisición), devolvemos
// `undefined` y la UI muestra "—" (regla § 5.4.6 · NO inventar datos).

import { initDB } from '../../../services/db';
import type {
  GananciasPerdidas,
  OperacionCripto,
  OperacionFondo,
  OperacionTransmision,
} from '../../../types/declaracionCompleta';
import type { TipoPosicion } from '../../../types/inversiones';

export interface PosicionCerrada {
  /** ID estable · `${año}-${categoria}-${idx}`. */
  id: string;
  nombre: string;
  tipo: TipoPosicion;
  entidad: string;
  unidades?: number;
  unidadesLabel?: string;

  // ── Datos inversor ────────────────────────────────────────────
  fechaApertura?: string;       // ISO · si disponible · `undefined` si XML no lo expone
  fechaCierre: string;          // ISO · siempre presente (al menos al año fiscal)
  duracionDias?: number;        // null si fechaApertura no disponible
  aportado: number;             // capital invertido · siempre positivo
  vendido: number;              // valor de venta · siempre positivo
  resultado: number;            // vendido - aportado · puede ser negativo
  resultadoPercent: number;     // (resultado / aportado) * 100
  cagr?: number;                // null si fechaApertura no disponible

  // ── Puente OPCIONAL al módulo Fiscal (§ 5.5 spec) ────────────
  /** Si la operación viene del XML AEAT · año fiscal de origen para
   *  navegar a `/fiscal/ejercicio/{año}`. Si la posición se cerró
   *  manualmente desde Inversiones (sin paso por declaración) · ausente. */
  referenciaFiscal?: string;
}

export interface KpisCerradas {
  count: number;
  totalInvertido: number;
  resultadoNeto: number;
  mejor: PosicionCerrada | null;
  peor: PosicionCerrada | null;
  tasaAcierto: number;          // 0-100
  cagrMedio: number;            // 0 si no calculable
  duracionMediaDias: number;    // 0 si no calculable
  rangoAnios: string;           // "" si vacío · "2024" o "2020-2024"
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_YEAR = MS_PER_DAY * 365.25;

const safeNumber = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const calcularDerivados = (
  aportado: number,
  vendido: number,
  fechaCierreISO: string,
  fechaAperturaISO?: string,
): {
  resultado: number;
  resultadoPercent: number;
  duracionDias?: number;
  cagr?: number;
} => {
  const resultado = vendido - aportado;
  const resultadoPercent = aportado > 0 ? (resultado / aportado) * 100 : 0;
  if (!fechaAperturaISO) {
    return { resultado, resultadoPercent };
  }
  const open = new Date(fechaAperturaISO).getTime();
  const close = new Date(fechaCierreISO).getTime();
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) {
    return { resultado, resultadoPercent };
  }
  const duracionDias = Math.round((close - open) / MS_PER_DAY);
  const elapsedYears = (close - open) / MS_PER_YEAR;
  let cagr: number | undefined;
  if (aportado > 0 && vendido > 0 && elapsedYears > 0) {
    cagr = (Math.pow(vendido / aportado, 1 / elapsedYears) - 1) * 100;
    if (!Number.isFinite(cagr)) cagr = undefined;
  }
  return { resultado, resultadoPercent, duracionDias, cagr };
};

const fechaCierreDelEjercicio = (anio: number): string =>
  // No tenemos día/mes exactos en el XML AEAT · usamos fin de año como
  // proxy estable. La UI muestra "Cierre · 2024" sin día específico.
  new Date(Date.UTC(anio, 11, 31)).toISOString();

/** Mapea un `OperacionFondo` (transmisión de fondo) a `PosicionCerrada`. */
const mapearFondo = (
  op: OperacionFondo,
  anio: number,
  idx: number,
): PosicionCerrada => {
  const aportado = safeNumber(op.valorAdquisicion);
  const vendido = safeNumber(op.valorTransmision);
  const fechaCierre = fechaCierreDelEjercicio(anio);
  const derivados = calcularDerivados(aportado, vendido, fechaCierre);
  return {
    id: `${anio}-fondo-${idx}`,
    nombre: op.nifFondo ? `Fondo · ${op.nifFondo}` : `Fondo · transmisión ${idx + 1}`,
    tipo: 'fondo_inversion',
    entidad: op.nifFondo || '—',
    fechaCierre,
    aportado,
    vendido,
    ...derivados,
    referenciaFiscal: String(anio),
  };
};

const mapearCripto = (
  op: OperacionCripto,
  anio: number,
  idx: number,
): PosicionCerrada => {
  const aportado = safeNumber(op.valorAdquisicion);
  const vendido = safeNumber(op.valorTransmision);
  const fechaCierre = fechaCierreDelEjercicio(anio);
  const derivados = calcularDerivados(aportado, vendido, fechaCierre);
  return {
    id: `${anio}-cripto-${idx}`,
    nombre: op.moneda ? `${op.moneda} · transmisión` : `Crypto · transmisión ${idx + 1}`,
    tipo: 'crypto',
    entidad: op.claveContraprestacion || '—',
    fechaCierre,
    aportado,
    vendido,
    ...derivados,
    referenciaFiscal: String(anio),
  };
};

const mapearTransmision = (
  op: OperacionTransmision,
  anio: number,
  idx: number,
): PosicionCerrada => {
  const aportado = safeNumber(op.valorAdquisicion);
  const vendido = safeNumber(op.valorTransmision);
  const fechaCierre = fechaCierreDelEjercicio(anio);
  const derivados = calcularDerivados(aportado, vendido, fechaCierre);
  return {
    id: `${anio}-transmision-${idx}`,
    nombre: op.descripcion?.trim() || `Acción / valor · transmisión ${idx + 1}`,
    // Heurística · si la descripción menciona REIT/SOCIMI lo clasificamos
    // como tal; si no, por defecto acción.
    tipo: /reit|socimi/i.test(op.descripcion || '') ? 'reit' : 'accion',
    entidad: '—',
    fechaCierre,
    aportado,
    vendido,
    ...derivados,
    referenciaFiscal: String(anio),
  };
};

const extraerCerradasDelEjercicio = (
  anio: number,
  ganancias: GananciasPerdidas | undefined,
): PosicionCerrada[] => {
  if (!ganancias) return [];
  const out: PosicionCerrada[] = [];
  (ganancias.fondos || []).forEach((op, i) => out.push(mapearFondo(op, anio, i)));
  (ganancias.criptomonedas || []).forEach((op, i) => out.push(mapearCripto(op, anio, i)));
  (ganancias.otrasTransmisiones || []).forEach((op, i) =>
    out.push(mapearTransmision(op, anio, i)),
  );
  return out;
};

/**
 * Devuelve TODAS las posiciones cerradas del usuario · agregando todos
 * los ejercicios fiscales con `aeat.declaracionCompleta` disponible.
 * Incluye también las posiciones cerradas "nativas" del store
 * `inversiones` (con `activo === false`) · sin duplicar.
 *
 * Si el usuario no ha importado ninguna declaración y no tiene
 * posiciones marcadas como cerradas en el store, devuelve `[]`.
 */
export async function getPosicionesCerradas(): Promise<PosicionCerrada[]> {
  const db = await initDB();
  const ejercicios = await db.getAll('ejerciciosFiscalesCoord');

  const desdeXml: PosicionCerrada[] = [];
  for (const ej of ejercicios) {
    const decl = ej?.aeat?.declaracionCompleta;
    if (!decl) continue;
    const anio = ej.año;
    if (!Number.isFinite(anio)) continue;
    desdeXml.push(...extraerCerradasDelEjercicio(anio, decl.gananciasPerdidas));
  }

  // Posiciones cerradas nativas del store `inversiones` (cierre manual ·
  // `activo === false`). Estas NO tienen `referenciaFiscal` · puente al
  // módulo Fiscal queda oculto en la UI.
  const posicionesStore = (await db.getAll('inversiones')) as Array<{
    id: number;
    activo?: boolean;
    nombre?: string;
    tipo?: TipoPosicion;
    entidad?: string;
    valor_actual?: number;
    total_aportado?: number;
    fecha_compra?: string;
    fecha_valoracion?: string;
    plan_liquidacion?: { fecha_estimada?: string };
  }>;

  const desdeStore: PosicionCerrada[] = posicionesStore
    .filter((p) => p.activo === false)
    .map((p): PosicionCerrada => {
      const aportado = safeNumber(p.total_aportado);
      const vendido = safeNumber(p.valor_actual);
      const fechaCierre =
        p.plan_liquidacion?.fecha_estimada || p.fecha_valoracion || new Date().toISOString();
      const derivados = calcularDerivados(aportado, vendido, fechaCierre, p.fecha_compra);
      return {
        id: `store-${p.id}`,
        nombre: p.nombre || p.entidad || `Posición #${p.id}`,
        tipo: (p.tipo || 'otro') as TipoPosicion,
        entidad: p.entidad || '—',
        fechaApertura: p.fecha_compra,
        fechaCierre,
        aportado,
        vendido,
        ...derivados,
      };
    });

  return [...desdeXml, ...desdeStore];
}

/**
 * KPIs agregados · narrativa inversor (sin "casilla" · sin "ejercicio" ·
 * sin "paralela"). Si la lista está vacía devuelve un objeto con todos
 * los valores a 0/null.
 */
export function calcularKpisCerradas(cerradas: PosicionCerrada[]): KpisCerradas {
  if (cerradas.length === 0) {
    return {
      count: 0,
      totalInvertido: 0,
      resultadoNeto: 0,
      mejor: null,
      peor: null,
      tasaAcierto: 0,
      cagrMedio: 0,
      duracionMediaDias: 0,
      rangoAnios: '',
    };
  }

  let totalInvertido = 0;
  let resultadoNeto = 0;
  let aciertos = 0;
  let mejor: PosicionCerrada | null = null;
  let peor: PosicionCerrada | null = null;
  let cagrPonderadoNum = 0;
  let cagrPonderadoDen = 0;
  let duracionTotal = 0;
  let duracionCount = 0;

  for (const p of cerradas) {
    totalInvertido += p.aportado;
    resultadoNeto += p.resultado;
    if (p.resultado > 0) aciertos += 1;
    if (mejor === null || p.resultado > mejor.resultado) mejor = p;
    if (peor === null || p.resultado < peor.resultado) peor = p;
    if (p.cagr != null && Number.isFinite(p.cagr) && p.aportado > 0) {
      cagrPonderadoNum += p.cagr * p.aportado;
      cagrPonderadoDen += p.aportado;
    }
    if (p.duracionDias != null && Number.isFinite(p.duracionDias)) {
      duracionTotal += p.duracionDias;
      duracionCount += 1;
    }
  }

  const tasaAcierto = (aciertos / cerradas.length) * 100;
  const cagrMedio = cagrPonderadoDen > 0 ? cagrPonderadoNum / cagrPonderadoDen : 0;
  const duracionMediaDias = duracionCount > 0 ? duracionTotal / duracionCount : 0;

  const anios = cerradas
    .map((p) => new Date(p.fechaCierre).getFullYear())
    .filter((y) => Number.isFinite(y) && y > 1900);
  const min = anios.length ? Math.min(...anios) : null;
  const max = anios.length ? Math.max(...anios) : null;
  const rangoAnios =
    min === null || max === null ? '' : min === max ? String(min) : `${min}-${max}`;

  return {
    count: cerradas.length,
    totalInvertido,
    resultadoNeto,
    mejor,
    peor,
    tasaAcierto,
    cagrMedio,
    duracionMediaDias,
    rangoAnios,
  };
}

/** Formatea una duración en días como `2 años 4 meses` · `4 meses` · `12 días`. */
export function formatDuracion(diasRaw: number | undefined): string {
  if (diasRaw == null || !Number.isFinite(diasRaw) || diasRaw < 0) return '—';
  const dias = Math.round(diasRaw);
  if (dias < 31) return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  const meses = Math.round(dias / 30.44);
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const años = Math.floor(meses / 12);
  const mesesResto = meses % 12;
  if (mesesResto === 0) return `${años} ${años === 1 ? 'año' : 'años'}`;
  return `${años} ${años === 1 ? 'año' : 'años'} ${mesesResto} ${mesesResto === 1 ? 'mes' : 'meses'}`;
}
