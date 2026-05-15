/**
 * ejercicioCasillasService.ts · helper para F2 ejercicio detalle.
 *
 * Extrae valores de casillas por sección A-H desde
 * `DatosFiscalesEjercicio` (que viene de `resolverDatosEjercicio`).
 *
 * Prioridad de fuentes:
 *   1. `casillas` (snapshot AEAT clave-valor · indexado por casilla y
 *      por sufijo `_<orden>` para casillas multi-inmueble)
 *   2. `declaracionCompleta` (DeclaracionIRPF estructurada · fallback
 *      para ejercicios en_curso o con datos parciales)
 *   3. `resumen` (agregados base liquidable · cuota íntegra · etc)
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.3.
 */

import type { DatosFiscalesEjercicio } from '../../../../services/fiscalResolverService';

export interface BoxRow {
  num: string;
  concepto: string;
  subtitulo?: string;
  importe: number | null;
  subtotal?: boolean;
  negativeSign?: boolean;
  highlight?: boolean;
  /** Unidad del importe · default '€' · usa 'días' para conteos y '%' para porcentajes */
  unit?: 'eur' | 'dias' | 'pct';
}

export type BoxLetterVariant = 'navy' | 'gold' | 'warn' | 'neg' | 'pos';

export interface BoxSection {
  /** Identificador de la sección · "A"-"H" en F2 · "€" "←" "−" "A" "∑" en F3 */
  letter: string;
  /** Variante de color del chip · default 'navy' (F2) */
  letterVariant?: BoxLetterVariant;
  title: string;
  total: number | null;
  rows: BoxRow[];
  empty?: boolean;
  emptyText?: string;
}

export interface InmuebleSeccionB {
  inmuebleId: number;
  alias: string;
  rendimientoNetoReducido: number;
  diasArrendado: number;
  diasDisposicion: number;
  modoLabel?: string;
  metaText?: string;
}

export interface SeccionBData {
  inmuebles: InmuebleSeccionB[];
  totalRendimientos: number;
  totalImputaciones: number;
}

const safeNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function getCasilla(casillas: Record<string, number> | null, key: string): number | null {
  if (!casillas) return null;
  return safeNum(casillas[key]);
}

// ─── A · Trabajo ────────────────────────────────────────────────────────────
export function buildSeccionA(d: DatosFiscalesEjercicio): BoxSection {
  const c = d.casillas;
  const decl = d.declaracionCompleta;
  const t = decl?.baseGeneral?.rendimientosTrabajo ?? null;

  const box0003 = getCasilla(c, '0003') ?? safeNum(t?.salarioBrutoAnual);
  const box0005 = getCasilla(c, '0005') ?? safeNum(t?.especieAnual);
  const box0007 = getCasilla(c, '0007') ?? safeNum(t?.ppEmpresa);
  const box0012 = getCasilla(c, '0012') ?? ((box0003 ?? 0) + (box0005 ?? 0) + (box0007 ?? 0));
  const box0013 = getCasilla(c, '0013') ?? safeNum(t?.cotizacionSS);
  const box0019 = getCasilla(c, '0019');
  const box0022 = getCasilla(c, '0022') ?? safeNum(t?.rendimientoNeto);

  const rows: BoxRow[] = [];
  if (box0003 !== null) rows.push({ num: '0003', concepto: 'Retribuciones dinerarias', importe: box0003 });
  if (box0005 !== null) rows.push({ num: '0005', concepto: 'Retribuciones en especie', importe: box0005 });
  if (box0007 !== null) rows.push({ num: '0007', concepto: 'Contribuciones empresariales a plan de pensiones', importe: box0007 });
  if (box0012 !== null) rows.push({ num: '0012', concepto: 'Total ingresos íntegros', importe: box0012, subtotal: true });
  if (box0013 !== null) rows.push({ num: '0013', concepto: 'Cotizaciones Seguridad Social', importe: box0013, negativeSign: true });
  if (box0019 !== null) rows.push({ num: '0019', concepto: 'Otros gastos deducibles (tope general)', importe: box0019, negativeSign: true });
  if (box0022 !== null) rows.push({ num: '0022', concepto: 'Rendimiento neto del trabajo', importe: box0022, subtotal: true });

  return {
    letter: 'A',
    title: 'Rendimientos del trabajo',
    total: box0022,
    rows,
    empty: rows.length === 0,
    emptyText: 'Sin rendimientos del trabajo declarados',
  };
}

// ─── B · Capital inmobiliario (per-property) ────────────────────────────────
export function buildSeccionB(d: DatosFiscalesEjercicio): { section: BoxSection; data: SeccionBData } {
  const c = d.casillas;
  const decl = d.declaracionCompleta;
  const inmuebles = decl?.baseGeneral?.rendimientosInmuebles ?? [];

  const inmueblesVm: InmuebleSeccionB[] = inmuebles.map((inm) => ({
    inmuebleId: inm.inmuebleId,
    alias: inm.alias || `Inmueble ${inm.inmuebleId}`,
    rendimientoNetoReducido: safeNum(inm.rendimientoNetoReducido) ?? safeNum(inm.rendimientoNeto) ?? 0,
    diasArrendado: inm.diasAlquilado ?? 0,
    diasDisposicion: inm.diasVacio ?? 0,
    modoLabel: inm.esHabitual ? 'Vivienda habitual' : undefined,
    metaText: buildInmuebleMeta(inm),
  }));

  const totalRendimientos =
    getCasilla(c, '0156') ??
    inmueblesVm.reduce((s, i) => s + i.rendimientoNetoReducido, 0);
  const totalImputaciones =
    getCasilla(c, '0155') ??
    (decl?.baseGeneral?.imputacionRentas ?? []).reduce((s, i) => s + (i.imputacion ?? 0), 0);

  const rows: BoxRow[] = [];
  rows.push({
    num: '0156',
    concepto: 'Σ rendimientos netos reducidos de capital inmobiliario',
    importe: totalRendimientos,
    subtotal: true,
  });
  if (totalImputaciones > 0) {
    rows.push({
      num: '0155',
      concepto: 'Σ imputaciones renta a disposición',
      subtitulo: 'días sin arrendar · inmuebles con uso parcial',
      importe: totalImputaciones,
    });
  }

  return {
    section: {
      letter: 'B',
      title: `Capital inmobiliario${inmueblesVm.length > 0 ? ` · ${inmueblesVm.length} inmueble${inmueblesVm.length === 1 ? '' : 's'}` : ''}`,
      total: totalRendimientos,
      rows,
      empty: inmueblesVm.length === 0,
      emptyText: 'Sin inmuebles con actividad fiscal',
    },
    data: {
      inmuebles: inmueblesVm,
      totalRendimientos,
      totalImputaciones,
    },
  };
}

function buildInmuebleMeta(inm: {
  diasAlquilado?: number;
  diasVacio?: number;
  diasTotal?: number;
  esHabitual?: boolean;
}): string {
  const partes: string[] = [];
  if (typeof inm.diasAlquilado === 'number' && inm.diasAlquilado > 0) {
    partes.push(`${inm.diasAlquilado} días arrendado`);
  }
  if (typeof inm.diasVacio === 'number' && inm.diasVacio > 0) {
    partes.push(`${inm.diasVacio} días disposición`);
  }
  if (inm.esHabitual) partes.push('vivienda habitual');
  return partes.join(' · ');
}

// ─── C · Capital mobiliario ─────────────────────────────────────────────────
export function buildSeccionC(d: DatosFiscalesEjercicio): BoxSection {
  const c = d.casillas;
  const cm = d.declaracionCompleta?.baseAhorro?.capitalMobiliario;

  const box0027 = getCasilla(c, '0027') ?? safeNum(cm?.intereses);
  const box0029 = getCasilla(c, '0029') ?? safeNum(cm?.dividendos);
  const box0041 = getCasilla(c, '0041') ?? safeNum(cm?.total);

  const rows: BoxRow[] = [];
  if (box0027 !== null && box0027 !== 0) {
    rows.push({
      num: '0027',
      concepto: 'Intereses de cuentas · depósitos · activos financieros',
      importe: box0027,
    });
  }
  if (box0029 !== null && box0029 !== 0) {
    rows.push({ num: '0029', concepto: 'Dividendos', importe: box0029 });
  }
  if (box0041 !== null) {
    rows.push({
      num: '0041',
      concepto: 'Σ a integrar en base imponible del ahorro',
      importe: box0041,
      subtotal: true,
    });
  }

  return {
    letter: 'C',
    title: 'Capital mobiliario · ahorro',
    total: box0041,
    rows,
    empty: rows.length === 0,
    emptyText: 'Sin rendimientos de capital mobiliario',
  };
}

// ─── D · Actividad económica ────────────────────────────────────────────────
export function buildSeccionD(d: DatosFiscalesEjercicio): BoxSection {
  const c = d.casillas;
  const aut = d.declaracionCompleta?.baseGeneral?.rendimientosAutonomo;

  const box0171 = getCasilla(c, '0171') ?? safeNum(aut?.ingresos);
  const box0186 = getCasilla(c, '0186') ?? safeNum(aut?.cuotaSS);
  const box0199 = getCasilla(c, '0199');
  const box0221 = getCasilla(c, '0221');
  const box0222 = getCasilla(c, '0222') ?? safeNum(aut?.gastoDificilJustificacion);
  const box0224 = getCasilla(c, '0224') ?? safeNum(aut?.rendimientoNeto);
  const epigrafe = aut?.actividades?.[0]?.epigrafe;

  const rows: BoxRow[] = [];
  if (epigrafe) {
    rows.push({
      num: '0167',
      concepto: `Epígrafe IAE ${epigrafe}`,
      subtitulo: aut?.actividades?.[0]?.nombre,
      importe: null,
    });
  }
  if (box0171 !== null) rows.push({ num: '0171', concepto: 'Ingresos de explotación', importe: box0171 });
  if (box0186 !== null && box0186 !== 0) {
    rows.push({ num: '0186', concepto: 'Seguridad Social del titular', importe: box0186, negativeSign: true });
  }
  if (box0199 !== null && box0199 !== 0) {
    rows.push({ num: '0199', concepto: 'Servicios profesionales independientes', importe: box0199, negativeSign: true });
  }
  if (box0221 !== null) rows.push({ num: '0221', concepto: 'Diferencia (ingresos − gastos)', importe: box0221 });
  if (box0222 !== null && box0222 !== 0) {
    rows.push({
      num: '0222',
      concepto: 'Provisión 5% gastos difícil justificación',
      subtitulo: 'deducción adicional · régimen simplificado',
      importe: box0222,
      negativeSign: true,
    });
  }
  if (box0224 !== null) {
    rows.push({ num: '0224', concepto: 'Rendimiento neto de la actividad', importe: box0224, subtotal: true });
  }

  return {
    letter: 'D',
    title: 'Actividad económica',
    total: box0224,
    rows,
    empty: rows.length === 0,
    emptyText: 'Sin rendimientos de actividades económicas',
  };
}

// ─── E · Ganancias patrimoniales ────────────────────────────────────────────
export function buildSeccionE(d: DatosFiscalesEjercicio): BoxSection {
  const c = d.casillas;
  const gp = d.declaracionCompleta?.baseAhorro?.gananciasYPerdidas;
  const ventasInmuebles = d.declaracionCompleta?.ventasInmuebles ?? [];

  const box0316 = getCasilla(c, '0316');
  const box0317 = getCasilla(c, '0317');
  const box0320 = getCasilla(c, '0320') ?? safeNum(gp?.plusvalias);
  const box0325 = getCasilla(c, '0325') ?? safeNum(gp?.compensado);

  const tieneOperaciones = ventasInmuebles.length > 0
    || (box0316 ?? 0) !== 0
    || (box0320 ?? 0) !== 0;

  if (!tieneOperaciones) {
    return {
      letter: 'E',
      title: 'Ganancias y pérdidas patrimoniales',
      total: null,
      rows: [],
      empty: true,
      emptyText: 'Sin transmisiones este ejercicio',
    };
  }

  const rows: BoxRow[] = [];
  if (box0316 !== null) rows.push({ num: '0316', concepto: 'Valor de transmisión', importe: box0316 });
  if (box0317 !== null) rows.push({ num: '0317', concepto: 'Valor de adquisición actualizado', importe: box0317, negativeSign: true });
  if (box0320 !== null) rows.push({ num: '0320', concepto: 'Ganancia bruta', importe: box0320, subtotal: true });
  if (box0325 !== null) {
    rows.push({ num: '0325', concepto: 'Ganancia reducida · integra BI ahorro', importe: box0325, subtotal: true });
  }

  return {
    letter: 'E',
    title: `Ganancias y pérdidas patrimoniales · ${ventasInmuebles.length} operación${ventasInmuebles.length === 1 ? '' : 'es'}`,
    total: box0325 ?? box0320,
    rows,
  };
}

// ─── F · Plan pensiones ─────────────────────────────────────────────────────
export function buildSeccionF(d: DatosFiscalesEjercicio): BoxSection {
  const c = d.casillas;
  const red = d.declaracionCompleta?.reducciones;

  const box0426 = getCasilla(c, '0426') ?? safeNum(red?.ppEmpleado);
  const box0427 = getCasilla(c, '0427') ?? safeNum(red?.ppEmpresa);
  const box0467 = getCasilla(c, '0467');
  const box0492 = getCasilla(c, '0492') ?? safeNum(red?.planPensiones) ?? safeNum(red?.total);

  const rows: BoxRow[] = [];
  if (box0426 !== null) {
    rows.push({
      num: '0426',
      concepto: 'Aportación del trabajador al PP de empresa',
      subtitulo: 'dentro del tope de 1.500 €',
      importe: box0426,
    });
  }
  if (box0427 !== null) {
    rows.push({
      num: '0427',
      concepto: 'Contribución empresarial',
      subtitulo: 'dentro del tope de 8.500 €',
      importe: box0427,
    });
  }
  if (box0467 !== null) {
    rows.push({ num: '0467', concepto: 'Con derecho a reducción (límite art. 52)', importe: box0467 });
  }
  if (box0492 !== null) {
    rows.push({
      num: '0492',
      concepto: 'Reducción aplicada a base general',
      importe: box0492,
      subtotal: true,
      negativeSign: true,
    });
  }

  return {
    letter: 'F',
    title: 'Reducción base imponible · planes de pensiones',
    total: box0492 !== null ? -Math.abs(box0492) : null,
    rows,
    empty: rows.length === 0,
    emptyText: 'Sin aportaciones a planes de pensiones',
  };
}

// ─── G · Bases ──────────────────────────────────────────────────────────────
export function buildSeccionG(d: DatosFiscalesEjercicio): BoxSection {
  const c = d.casillas;
  const r = d.resumen;
  const liq = d.declaracionCompleta?.liquidacion;

  // 0435/0460 son las bases IMPONIBLES (general y ahorro) · NO las
  // liquidables. El bug histórico mezclaba ambas y mostraba las BL
  // (147.665,23 BLG para Jose 2024) en lugar de las BI (150.924,07 BIG).
  // `d.baseImponibleGeneral` y `d.baseImponibleAhorro` vienen del coord vía
  // `resumenCoord.baseImponible*` que escribe `guardarEjercicioFiscal`.
  const box0435 = getCasilla(c, '0435') ?? safeNum(d.baseImponibleGeneral) ?? safeNum(liq?.baseImponibleGeneral);
  const box0460 = getCasilla(c, '0460') ?? safeNum(d.baseImponibleAhorro) ?? safeNum(liq?.baseImponibleAhorro);
  const box0500 = getCasilla(c, '0500') ?? safeNum(r.baseLiquidableGeneral);
  const box0510 = getCasilla(c, '0510') ?? safeNum(r.baseLiquidableAhorro);

  const rows: BoxRow[] = [];
  if (box0435 !== null) rows.push({ num: '0435', concepto: 'Base imponible general', importe: box0435 });
  if (box0460 !== null) rows.push({ num: '0460', concepto: 'Base imponible del ahorro', importe: box0460 });
  if (box0500 !== null) {
    rows.push({ num: '0500', concepto: 'Base liquidable general (tras reducción)', importe: box0500, subtotal: true });
  }
  if (box0510 !== null) {
    rows.push({ num: '0510', concepto: 'Base liquidable del ahorro', importe: box0510, subtotal: true });
  }

  // Coherencia con otras secciones (A, C, H): NO descartamos un 0 legítimo.
  // El total queda null solo si no hay datos de base liquidable / imponible.
  const tieneAlgunaBase = box0500 !== null || box0510 !== null || box0435 !== null || box0460 !== null;
  const total = tieneAlgunaBase
    ? ((box0500 ?? box0435 ?? 0) + (box0510 ?? box0460 ?? 0))
    : null;

  return {
    letter: 'G',
    title: 'Bases imponible y liquidable',
    total,
    rows,
    empty: rows.length === 0,
    emptyText: 'Sin bases liquidables calculadas',
  };
}

// ─── H · Cuotas y resultado ─────────────────────────────────────────────────
export function buildSeccionH(d: DatosFiscalesEjercicio): BoxSection {
  const c = d.casillas;
  const r = d.resumen;

  const box0545 = getCasilla(c, '0545') ?? safeNum(r.cuotaIntegraEstatal);
  const box0546 = getCasilla(c, '0546') ?? safeNum(r.cuotaIntegraAutonomica);
  const box0570 = getCasilla(c, '0570') ?? safeNum(r.cuotaLiquidaEstatal);
  const box0571 = getCasilla(c, '0571') ?? safeNum(r.cuotaLiquidaAutonomica);
  const box0587 = getCasilla(c, '0587') ?? ((box0570 ?? 0) + (box0571 ?? 0));
  const box0609 = getCasilla(c, '0609') ?? safeNum(d.retenciones);
  const box0670 = getCasilla(c, '0670') ?? safeNum(d.resultado);

  const rows: BoxRow[] = [];
  if (box0545 !== null) rows.push({ num: '0545', concepto: 'Cuota íntegra estatal', importe: box0545 });
  if (box0546 !== null) rows.push({ num: '0546', concepto: 'Cuota íntegra autonómica', importe: box0546 });
  if (box0587 !== null && box0587 !== 0) {
    rows.push({ num: '0587', concepto: 'Cuota líquida total', importe: box0587, subtotal: true });
  }
  if (box0609 !== null && box0609 !== 0) {
    rows.push({
      num: '0609',
      concepto: 'Σ retenciones e ingresos a cuenta',
      subtitulo: 'trabajo + actividad + capital mobiliario',
      importe: box0609,
      negativeSign: true,
    });
  }
  if (box0670 !== null) {
    rows.push({
      num: '0670',
      concepto: box0670 >= 0 ? 'Resultado de la declaración · a pagar' : 'Resultado de la declaración · a devolver',
      importe: box0670,
      subtotal: true,
      highlight: true,
    });
  }

  return {
    letter: 'H',
    title: 'Cuotas y resultado final',
    total: box0670,
    rows,
    empty: rows.length === 0,
    emptyText: 'Sin cuotas calculadas',
  };
}

// ─── Builder global ────────────────────────────────────────────────────────
export interface SeccionesData {
  secciones: BoxSection[];
  inmueblesB: InmuebleSeccionB[];
}

export function buildSecciones(d: DatosFiscalesEjercicio): SeccionesData {
  const seccionB = buildSeccionB(d);
  return {
    secciones: [
      buildSeccionA(d),
      seccionB.section,
      buildSeccionC(d),
      buildSeccionD(d),
      buildSeccionE(d),
      buildSeccionF(d),
      buildSeccionG(d),
      buildSeccionH(d),
    ],
    inmueblesB: seccionB.data.inmuebles,
  };
}

// ─── Tipo medio efectivo (KPI 4) ────────────────────────────────────────────
export function calcularTipoMedio(d: DatosFiscalesEjercicio): number | null {
  const baseLiq = d.resumen.baseLiquidableGeneral;
  const cuotaLiqEstatal = d.resumen.cuotaLiquidaEstatal;
  const cuotaLiqAuto = d.resumen.cuotaLiquidaAutonomica;
  if (!baseLiq || baseLiq <= 0) return null;
  const cuotaLiquida = (cuotaLiqEstatal ?? 0) + (cuotaLiqAuto ?? 0);
  if (cuotaLiquida === 0) return null;
  return (cuotaLiquida / baseLiq) * 100;
}
