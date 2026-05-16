/**
 * inmuebleCasillasService.ts · helper F3 inmueble fiscal del año.
 *
 * Construye las 5 secciones del mockup (Ingresos · Arrastres ·
 * Gastos · Amortización inmueble · Rendimiento) desde
 * `FiscalSummaryExtended` (sub-tarea 1 hueco 1) + Property.aeatAmortization
 * para los datos catastrales (0123-0127).
 *
 * NO toca motor · sólo compone vista.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 §6.3 / §6.4.
 */

import type { FiscalSummaryExtended } from '../../../../services/fiscalSummaryService';
import type { Property } from '../../../../services/db';
import type { BoxRow, BoxSection } from './ejercicioCasillasService';

export interface InmuebleSeccionesData {
  secciones: BoxSection[];
  modoDeclaracion: FiscalSummaryExtended['modoDeclaracion'];
  porcentajeReduccion: number;
  metodoProrrateo?: FiscalSummaryExtended['metodoProrrateo'];
  diasArrendado: number;
  diasDisposicion: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Devuelve el número solo si es finito y > 0 · null en otro caso. Permite
 *  encadenar `??` para que un 0 explícito en AEAT no bloquee fallbacks. */
function getPositive(n: number | undefined | null): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function buildInmuebleSecciones(
  ext: FiscalSummaryExtended,
  property: Property | null,
): InmuebleSeccionesData {
  const aeat = property?.aeatAmortization;

  // ─── Ingresos del año (gold €) ──────────────────────────────────────────
  // La casilla 0102 representa SOLO los ingresos íntegros de arrendamiento.
  // Si el inmueble tuvo días a disposición del titular, la renta inmobiliaria
  // imputada va en la 0089 (concepto distinto, se integra en la base general
  // del Modelo 100) y se muestra como línea separada · NO se suma a la 0102.
  const rentaImputada = ext.box0089 ?? 0;
  const ingresosRows: BoxRow[] = [
    {
      num: '0102',
      concepto: 'Ingresos íntegros de arrendamiento',
      subtitulo: ingresosSubtitulo(ext),
      importe: ext.box0102,
    },
  ];
  if (rentaImputada > 0) {
    ingresosRows.push({
      num: '0089',
      concepto: 'Renta inmobiliaria imputada',
      subtitulo: ext.diasDisposicion > 0
        ? `${ext.diasDisposicion} días a disposición · 1,1 % / 2 % VC`
        : 'imputación por días a disposición',
      importe: rentaImputada,
    });
  }
  ingresosRows.push({
    num: '0101',
    concepto: 'Días arrendado',
    importe: ext.box0101 ?? ext.diasArrendado,
    unit: 'dias',
    subtitulo: ext.diasDisposicion > 0
      ? `${ext.diasDisposicion} días a disposición sin alquilar`
      : 'año arrendado completo',
  });
  const seccionIngresos: BoxSection = {
    letter: '€',
    letterVariant: 'gold',
    title: 'Ingresos del año',
    total: ext.box0102,
    rows: ingresosRows,
  };

  // ─── Arrastres años anteriores (warn ←) ────────────────────────────────
  const arrastresDisponibles = ext.box0103 ?? 0;
  const arrastresAplicados = ext.box0104 ?? 0;
  const seccionArrastres: BoxSection = {
    letter: '←',
    letterVariant: 'warn',
    title: 'Arrastres de años anteriores',
    total: arrastresAplicados > 0 ? -arrastresAplicados : null,
    rows: arrastresDisponibles > 0 || arrastresAplicados > 0
      ? [
        {
          num: '0103',
          concepto: 'Gastos pendientes deducir de ejercicios previos',
          subtitulo: 'disponible · origen gastos no aplicados años previos',
          importe: arrastresDisponibles,
        },
        {
          num: '0104',
          concepto: 'Aplicado este año',
          subtitulo: arrastresAplicados >= arrastresDisponibles
            ? 'se aplicó el 100% disponible'
            : 'aplicado dentro del tope · resto sigue arrastrando',
          importe: arrastresAplicados,
          subtotal: true,
        },
      ]
      : [],
    empty: arrastresDisponibles === 0 && arrastresAplicados === 0,
    emptyText: 'Sin arrastres de ejercicios anteriores',
  };

  // ─── Gastos del año (neg −) ────────────────────────────────────────────
  const box0105 = ext.box0105 ?? 0;
  const box0106 = ext.box0106 ?? 0;
  const box0107 = ext.box0107 ?? 0;
  const box0108 = ext.box0108 ?? 0;
  const box0109 = ext.box0109 ?? 0;
  const box0112 = ext.box0112 ?? 0;
  const box0113 = ext.box0113 ?? 0;
  const box0114 = ext.box0114 ?? 0;
  const box0115 = ext.box0115 ?? 0;
  const box0117 = ext.box0117 ?? 0;
  const totalGastos = box0107 + box0109 + box0112 + box0113 + box0114 + box0115 + box0117;

  const gastosRows: BoxRow[] = [];
  if (box0105 !== 0) {
    gastosRows.push({
      num: '0105',
      concepto: 'Intereses de préstamos',
      subtitulo: 'hipoteca del inmueble',
      importe: box0105,
    });
  }
  if (box0106 !== 0) {
    gastosRows.push({
      num: '0106',
      concepto: 'Reparación y conservación',
      importe: box0106,
    });
  }
  if (box0105 !== 0 || box0106 !== 0) {
    gastosRows.push({
      num: '0107',
      concepto: 'Intereses + reparación aplicados',
      subtitulo: box0108 === 0
        ? 'dentro del límite anual · cabe el total'
        : 'tope alcanzado · exceso arrastra a años siguientes',
      importe: box0107,
    });
    gastosRows.push({
      num: '0108',
      concepto: 'Exceso a deducir en 4 años siguientes',
      importe: box0108,
    });
  }
  if (box0109 !== 0) gastosRows.push({ num: '0109', concepto: 'Gastos de comunidad', importe: box0109 });
  if (box0112 !== 0) gastosRows.push({ num: '0112', concepto: 'Servicios personales · jardinero · limpieza', importe: box0112 });
  if (box0113 !== 0) gastosRows.push({ num: '0113', concepto: 'Suministros · luz · agua · gas · internet', importe: box0113 });
  if (box0114 !== 0) gastosRows.push({ num: '0114', concepto: 'Primas de seguro · hogar', importe: box0114 });
  if (box0115 !== 0) gastosRows.push({ num: '0115', concepto: 'Tributos · IBI · tasa basuras', importe: box0115 });
  if (box0117 !== 0) {
    gastosRows.push({
      num: '0117',
      concepto: 'Amortización del mobiliario · 10% anual',
      subtitulo: 'muebles y electrodomésticos',
      importe: box0117,
    });
  }

  const seccionGastos: BoxSection = {
    letter: '−',
    letterVariant: 'neg',
    title: 'Gastos del año',
    total: totalGastos > 0 ? -round2(totalGastos) : null,
    rows: gastosRows,
    empty: gastosRows.length === 0,
    emptyText: 'Sin gastos del año',
  };

  // ─── Amortización del inmueble (navy A) ────────────────────────────────
  const valorCatastral = getPositive(aeat?.cadastralValue) ?? getPositive(property?.fiscalData?.cadastralValue) ?? 0;
  const valorCatastralConstruccion = getPositive(aeat?.constructionCadastralValue)
    ?? getPositive(property?.fiscalData?.constructionCadastralValue) ?? 0;
  const pctConstruccion = getPositive(aeat?.constructionPercentage)
    ?? getPositive(property?.fiscalData?.constructionPercentage);
  const importeAdq = getPositive(aeat?.onerosoAcquisition?.acquisitionAmount)
    ?? getPositive(property?.acquisitionCosts?.price);
  const gastosAdq = getPositive(aeat?.onerosoAcquisition?.acquisitionExpenses);
  // `baseAmortizacion` vive en `Property.aeatAmortization` (no en
  // `fiscalData` directamente · cast permite leer el campo opcional).
  const fiscalData = property?.fiscalData as Record<string, unknown> | undefined;
  const baseAmortizacion =
    getPositive(aeat?.baseAmortizacion)
    ?? (typeof fiscalData?.baseAmortizacion === 'number' ? getPositive(fiscalData.baseAmortizacion as number) : null);
  // Amortización inmueble · valor en box0131 del summary base. El número
  // de casilla que se muestra varía con el modo: en modo III por habitaciones
  // (casos especiales) la AEAT lo coloca en 0132 · el resto en 0131.
  const amortInmueble = ext.box0131 ?? 0;
  const usaCasosEspeciales = ext.modoDeclaracion === 'III';

  const amortRows: BoxRow[] = [];
  if (valorCatastral > 0) amortRows.push({ num: '0123', concepto: 'Valor catastral total', importe: valorCatastral });
  if (valorCatastralConstruccion > 0) amortRows.push({ num: '0124', concepto: 'Valor catastral construcción', importe: valorCatastralConstruccion });
  if (pctConstruccion !== null) {
    amortRows.push({
      num: '0125',
      concepto: '% construcción',
      importe: round2(pctConstruccion),
      unit: 'pct',
      subtitulo: 'porcentaje sobre VC total',
    });
  }
  if (importeAdq !== null) amortRows.push({ num: '0126', concepto: 'Importe adquisición', importe: importeAdq });
  if (gastosAdq !== null) {
    amortRows.push({
      num: '0127',
      concepto: 'Gastos inherentes adquisición · ITP · notaría · registro',
      importe: gastosAdq,
    });
  }
  if (baseAmortizacion !== null) {
    amortRows.push({
      num: '0130',
      concepto: 'Base de amortización',
      subtitulo: '(precio + gastos) × % construcción',
      importe: baseAmortizacion,
    });
  }
  if (amortInmueble > 0) {
    amortRows.push({
      num: usaCasosEspeciales ? '0132' : '0131',
      concepto: usaCasosEspeciales
        ? 'Amortización casos especiales'
        : 'Amortización anual del inmueble',
      subtitulo: usaCasosEspeciales
        ? 'prorrateado por método aplicado'
        : 'base × 3% · prorrateado a días',
      importe: amortInmueble,
      subtotal: true,
      negativeSign: true,
    });
  }

  const amortDisplayValue = amortInmueble;
  const seccionAmort: BoxSection = {
    letter: 'A',
    letterVariant: 'navy',
    title: 'Amortización del inmueble',
    total: amortDisplayValue > 0 ? -round2(amortDisplayValue) : null,
    rows: amortRows,
    empty: amortRows.length === 0,
    emptyText: 'Sin datos de amortización · falta valor catastral o adquisición',
  };

  // ─── Rendimiento del inmueble (pos ∑) ───────────────────────────────────
  const seccionRendimiento: BoxSection = {
    letter: '∑',
    letterVariant: 'pos',
    title: 'Rendimiento del inmueble',
    total: ext.box0154,
    rows: [
      {
        num: '0149',
        concepto: 'Rendimiento neto · antes de reducción',
        importe: ext.box0149,
      },
      {
        num: '0150',
        concepto: ext.porcentajeReduccion > 0
          ? `Reducción Ley Vivienda · ${ext.porcentajeReduccion}%`
          : 'Reducción Ley Vivienda',
        subtitulo: ext.box0150 > 0
          ? 'aplicada sobre la parte reducible'
          : 'no aplica · sin contrato larga estancia o vivienda no habitual',
        importe: ext.box0150,
        negativeSign: ext.box0150 > 0,
      },
      {
        num: '0154',
        concepto: 'Rendimiento neto reducido',
        importe: ext.box0154,
        subtotal: true,
      },
    ],
  };

  return {
    secciones: [seccionIngresos, seccionArrastres, seccionGastos, seccionAmort, seccionRendimiento],
    modoDeclaracion: ext.modoDeclaracion,
    porcentajeReduccion: ext.porcentajeReduccion,
    metodoProrrateo: ext.metodoProrrateo,
    diasArrendado: ext.diasArrendado,
    diasDisposicion: ext.diasDisposicion,
  };
}

function ingresosSubtitulo(ext: FiscalSummaryExtended): string {
  const partes: string[] = [];
  if (ext.diasArrendado > 0) partes.push(`${ext.diasArrendado} días arrendado`);
  if (ext.diasDisposicion > 0) partes.push(`${ext.diasDisposicion} días a disposición`);
  return partes.join(' · ') || 'año fiscal';
}

// ── Labels humanas del modo de declaración ─────────────────────────────────
// El body se genera dinámicamente para reflejar el % de reducción real
// (puede ser 50 · 60 · 70 · 90 según contratos · Ley Vivienda · zonas
// tensionadas) en lugar de hardcodear 60%.
export interface ModoLabel {
  tag: string;
  title: string;
  body: string;
}

export function getModoLabel(
  modo: FiscalSummaryExtended['modoDeclaracion'],
  porcentajeReduccion: number,
): ModoLabel {
  switch (modo) {
    case 'I':
      return {
        tag: 'Larga estancia',
        title: 'Vivienda habitual del inquilino',
        body: porcentajeReduccion > 0
          ? `Contrato de larga estancia · LAU. ATLAS aplicó la reducción del ${porcentajeReduccion}% sobre el rendimiento neto positivo (Ley Vivienda).`
          : 'Contrato de larga estancia · LAU. Sin reducción aplicada en este ejercicio.',
      };
    case 'II':
      return {
        tag: 'Parcial vacío',
        title: 'Año con período sin alquilar',
        body: 'Parte del año el inmueble estuvo arrendado y parte a disposición del titular. Los días sin alquilar generan imputación de renta · los arrendados rendimiento neto.',
      };
    case 'III':
      return {
        tag: 'Alquiler mixto',
        title: 'Casos especiales · habitaciones',
        body: 'Habitaciones combinando corta y larga estancia. ATLAS aplicó prorrateo por días-habitación sobre los gastos compartidos.',
      };
    case 'IV':
      return {
        tag: 'Vivienda habitual',
        title: 'Vivienda habitual del titular',
        body: 'Vivienda habitual del propietario · sin rendimiento ni imputación.',
      };
    case 'V':
      return {
        tag: 'Corta estancia',
        title: 'Turístico o temporada',
        body: 'Alquiler turístico o por temporada · sin derecho a reducción Ley Vivienda. Se grava como rendimiento de capital inmobiliario.',
      };
  }
}

/**
 * @deprecated Usar `getModoLabel(modo, porcentajeReduccion)` para que el
 * texto refleje el % de reducción real. Mantenido por compatibilidad con
 * pruebas que importan el mapa estático.
 */
export const MODO_LABEL: Record<FiscalSummaryExtended['modoDeclaracion'], ModoLabel> = {
  I: getModoLabel('I', 60),
  II: getModoLabel('II', 0),
  III: getModoLabel('III', 0),
  IV: getModoLabel('IV', 0),
  V: getModoLabel('V', 0),
};
