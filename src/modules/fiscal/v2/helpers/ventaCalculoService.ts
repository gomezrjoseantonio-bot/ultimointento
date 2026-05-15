/**
 * ventaCalculoService.ts · compone los 5 calc-steps del F4 venta.
 *
 * Lee de `PropertySale.fiscalSnapshot` (cuando el wizard de venta ya lo
 * pobló) y deriva el desglose visible. NO recalcula motor · sólo
 * presenta datos pre-calculados.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 5 §7.3 / §7.4.
 */

import { initDB, type PropertySale, type Property } from '../../../../services/db';
import {
  calcularGananciaPatrimonial,
  TRAMOS_BASE_AHORRO_2025,
  type GananciaPatrimonialResult,
} from '../../../../services/gananciaPatrimonialService';
import { getAmortizacionAcumulada } from './amortizacionAcumuladaService';
import { getPerdidasPatrimonialesVivas } from './arrastresVivosService';

export interface VentaCalcLine {
  /** Operador visible · '+', '−', '×', '=' · '' para indent puro */
  op: '+' | '−' | '×' | '=' | '';
  text: string;
  /** Cantidad formateada · null muestra "—" · 'pendiente' muestra "pendiente" */
  amount: number | null | 'pendiente';
  indent?: 1 | 2;
  negativeAmount?: boolean;
  subtotal?: boolean;
  /** Fila final destacada (navy background · texto blanco) */
  final?: boolean;
}

export interface VentaCalcStep {
  num: 1 | 2 | 3 | 4 | 5;
  title: string;
  casillaRef: string;
  lines: VentaCalcLine[];
}

export interface VentaCalculoData {
  steps: VentaCalcStep[];
  // KPIs derivados
  valorTransmision: number;
  valorAdquisicionActualizado: number;
  gananciaBruta: number;
  gananciaTributable: number;
  impuestoEstimado: number;
  // Metadata
  tieneGastosVentaConfirmados: boolean;
  arrastresCompensados: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface TramoAplicado {
  desde: number;
  hasta: number | null;
  base: number;
  tipo: number;
  impuesto: number;
}

function desglosarImpuestoPorTramos(ganancia: number): TramoAplicado[] {
  if (ganancia <= 0) return [];
  const aplicados: TramoAplicado[] = [];
  let restante = ganancia;
  let prev = 0;
  // Reutiliza la constante única del motor · evita drift si AEAT cambia tramos
  for (const tramo of TRAMOS_BASE_AHORRO_2025) {
    const slice = Math.min(restante, tramo.hasta - prev);
    if (slice <= 0) break;
    aplicados.push({
      desde: prev,
      hasta: Number.isFinite(tramo.hasta) ? tramo.hasta : null,
      base: round2(slice),
      tipo: tramo.tipo,
      impuesto: round2(slice * tramo.tipo),
    });
    restante -= slice;
    prev = tramo.hasta;
    if (restante <= 0) break;
  }
  return aplicados;
}

function isoYear(iso?: string): number | null {
  if (!iso || iso.length < 4) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function fmtFechaIso(iso?: string): string {
  if (!iso) return '—';
  const date = iso.slice(0, 10);
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface BuildOpts {
  sale: PropertySale;
  property: Property;
  snapshot: GananciaPatrimonialResult;
}

export async function buildVentaCalculo(opts: BuildOpts): Promise<VentaCalculoData> {
  const { sale, property, snapshot } = opts;

  const añoVenta = isoYear(sale.saleDate) ?? new Date().getFullYear();

  // ─── Step 1 · Valor transmisión (casilla 0316) ─────────────────────────
  const gastosVenta = snapshot.gastosVenta ?? 0;
  const valorTransmisionConGastos = snapshot.valorNetoTransmision;
  const tieneGastos = gastosVenta > 0;

  const step1: VentaCalcStep = {
    num: 1,
    title: 'Valor de transmisión',
    casillaRef: 'casilla 0316',
    lines: [
      {
        op: '+',
        text: 'Precio venta escritura',
        amount: sale.salePrice,
      },
      {
        op: '−',
        text: 'Gastos venta deducibles',
        amount: tieneGastos ? gastosVenta : 'pendiente',
        negativeAmount: true,
      },
      ...buildGastosVentaIndent(sale, tieneGastos),
      {
        op: '=',
        text: tieneGastos
          ? 'Valor de transmisión'
          : 'Valor transmisión · sin gastos confirmados',
        amount: tieneGastos ? valorTransmisionConGastos : sale.salePrice,
        subtotal: true,
      },
    ],
  };

  // ─── Step 2 · Valor adquisición actualizado (casilla 0317) ──────────────
  let amortPorAño: Array<{ año: number; diasArrendado: number; importeInmueble: number; importeMobiliario: number }> = [];
  try {
    const acum = await getAmortizacionAcumulada(property.id!, añoVenta);
    amortPorAño = acum.rows
      .filter((r) => !r.esFuturo)
      .map((r) => ({
        año: r.año,
        diasArrendado: r.diasArrendado,
        importeInmueble: r.amortInmueble,
        importeMobiliario: r.amortMobiliario,
      }));
  } catch {
    amortPorAño = [];
  }

  // El amort total del snapshot puede diferir ligeramente del desglose (XML
  // vs estimación Atlas). Mostramos el del snapshot como autoritativo en
  // el subtotal y el desglose como informativo.
  const amortAcumTotal = round2(
    (snapshot.amortizacionAcumuladaDeclarada ?? 0) +
    (snapshot.amortizacionAcumuladaAtlas ?? 0),
  );

  const step2Lines: VentaCalcLine[] = [
    {
      op: '+',
      text: `Precio compra · ${fmtFechaIso(property.purchaseDate)}`,
      amount: snapshot.precioAdquisicion,
    },
    {
      op: '+',
      text: 'Gastos inherentes adquisición (ITP · notaría · registro)',
      amount: snapshot.gastosAdquisicion,
    },
    {
      op: '+',
      text: 'Mejoras realizadas durante la tenencia',
      amount: snapshot.mejorasCapexAcumuladas,
    },
    {
      op: '−',
      text: 'Amortizaciones acumuladas',
      amount: amortAcumTotal,
      negativeAmount: true,
    },
  ];
  // Indent · desglose año a año
  for (const row of amortPorAño) {
    const importe = round2(row.importeInmueble + row.importeMobiliario);
    if (importe === 0) continue;
    step2Lines.push({
      op: '',
      indent: 2,
      text: `${row.año} · ${row.diasArrendado} días`,
      amount: importe,
    });
  }
  step2Lines.push({
    op: '=',
    text: 'Valor adquisición actualizado',
    amount: snapshot.costeFiscalAdquisicion,
    subtotal: true,
  });

  const step2: VentaCalcStep = {
    num: 2,
    title: 'Valor de adquisición actualizado',
    casillaRef: 'casilla 0317',
    lines: step2Lines,
  };

  // ─── Step 3 · Ganancia patrimonial bruta (casilla 0320) ────────────────
  const purchaseYear = isoYear(property.purchaseDate) ?? añoVenta;
  const reduccionAbatimiento = 0; // No aplica a inmuebles comprados después de 31/12/1994
  const aplicaReduccion = purchaseYear < 1995;

  const step3: VentaCalcStep = {
    num: 3,
    title: 'Ganancia patrimonial bruta',
    casillaRef: 'casilla 0320',
    lines: [
      {
        op: '=',
        text: 'Valor transmisión − Valor adquisición actualizado',
        amount: snapshot.gananciaPatrimonial + reduccionAbatimiento,
      },
      {
        op: '−',
        text: aplicaReduccion
          ? 'Reducción por adquisiciones antiguas (abatimiento)'
          : `Reducción por adquisiciones antiguas · no aplica (compra ${purchaseYear})`,
        amount: reduccionAbatimiento,
      },
      {
        op: '=',
        text: 'Ganancia reducida',
        amount: snapshot.gananciaPatrimonial,
        subtotal: true,
      },
    ],
  };

  // ─── Step 4 · Compensación con arrastres (casillas 1264-1269) ──────────
  const arrastres = await getPerdidasPatrimonialesVivas(añoVenta);
  let saldoACompensar = snapshot.gananciaPatrimonial;
  const lineasArrastres: VentaCalcLine[] = [];
  let totalCompensado = 0;
  for (const ar of arrastres) {
    if (saldoACompensar <= 0) break;
    const aplicar = Math.min(ar.importePendiente, saldoACompensar);
    lineasArrastres.push({
      op: '−',
      text: `Saldo ${ar.origen} (caduca 31/12/${ar.ejercicioCaducidad})`,
      amount: aplicar,
      negativeAmount: true,
    });
    totalCompensado += aplicar;
    saldoACompensar -= aplicar;
  }
  const gananciaTributable = round2(Math.max(0, snapshot.gananciaPatrimonial - totalCompensado));

  const step4Lines: VentaCalcLine[] = [
    {
      op: '+',
      text: 'Ganancia reducida · saldo a compensar',
      amount: snapshot.gananciaPatrimonial,
    },
    ...lineasArrastres,
  ];
  if (totalCompensado > 0) {
    step4Lines.push({
      op: '',
      indent: 1,
      text: `Total compensado · ${formatEurosShort(totalCompensado)}`,
      amount: null,
    });
  }
  step4Lines.push({
    op: '=',
    text: 'Ganancia tributable final',
    amount: gananciaTributable,
    subtotal: true,
  });

  const step4: VentaCalcStep = {
    num: 4,
    title: 'Compensación con arrastres anteriores',
    casillaRef: 'casillas 1264–1269',
    lines: arrastres.length === 0
      ? [
        {
          op: '+',
          text: 'Ganancia reducida · saldo a compensar',
          amount: snapshot.gananciaPatrimonial,
        },
        {
          op: '−',
          text: 'Sin arrastres patrimoniales disponibles',
          amount: 0,
        },
        {
          op: '=',
          text: 'Ganancia tributable final',
          amount: snapshot.gananciaPatrimonial,
          subtotal: true,
        },
      ]
      : step4Lines,
  };

  // ─── Step 5 · Impuesto · tramos base ahorro 2025 (casillas 0610 / 0670) ─
  const tramosAplicados = desglosarImpuestoPorTramos(gananciaTributable);
  const step5Lines: VentaCalcLine[] = tramosAplicados.map((t) => ({
    op: '×',
    text: t.hasta === null
      ? `Excedente sobre ${formatEurosShort(t.desde)} × ${(t.tipo * 100).toFixed(0)}%`
      : t.desde === 0
        ? `Primeros ${formatEurosShort(t.base)} × ${(t.tipo * 100).toFixed(0)}%`
        : `Restantes ${formatEurosShort(t.base)} × ${(t.tipo * 100).toFixed(0)}%`,
    amount: t.impuesto,
  }));
  const impuestoFinal = round2(tramosAplicados.reduce((s, t) => s + t.impuesto, 0));
  step5Lines.push({
    op: '=',
    text: 'Impuesto estimado por la venta',
    amount: impuestoFinal,
    final: true,
  });

  const step5: VentaCalcStep = {
    num: 5,
    title: 'Impuesto · tramos base ahorro 2025',
    casillaRef: 'casillas 0610 · 0670',
    lines: tramosAplicados.length === 0
      ? [
        {
          op: '=',
          text: 'Sin ganancia tributable · no procede impuesto',
          amount: 0,
          final: true,
        },
      ]
      : step5Lines,
  };

  return {
    steps: [step1, step2, step3, step4, step5],
    valorTransmision: tieneGastos ? valorTransmisionConGastos : sale.salePrice,
    valorAdquisicionActualizado: snapshot.costeFiscalAdquisicion,
    gananciaBruta: snapshot.gananciaPatrimonial,
    gananciaTributable,
    impuestoEstimado: impuestoFinal,
    tieneGastosVentaConfirmados: tieneGastos,
    arrastresCompensados: round2(totalCompensado),
  };
}

function buildGastosVentaIndent(sale: PropertySale, tieneGastos: boolean): VentaCalcLine[] {
  const sc = sale.saleCosts;
  const items = [
    { text: 'Notaría venta', amount: sc?.saleNotaryCosts ?? 0 },
    { text: 'Plusvalía municipal (IIVTNU)', amount: sc?.municipalTax ?? 0 },
    { text: 'Cancelación hipoteca', amount: sale.loanSettlement?.cancellationFee ?? 0 },
    { text: 'Agencia inmobiliaria', amount: sc?.agencyCommission ?? 0 },
    { text: 'Otros gastos venta', amount: sc?.otherCosts ?? 0 },
  ];
  return items.map((it) => ({
    op: '' as const,
    indent: 1 as const,
    text: `▸ ${it.text}`,
    amount: tieneGastos
      ? (it.amount > 0 ? it.amount : 0)
      : ('pendiente' as const),
  }));
}

function formatEurosShort(n: number): string {
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} €`;
}

/**
 * Carga el PropertySale por id desde el store · si no tiene fiscalSnapshot
 * intenta recalcularlo con `calcularGananciaPatrimonial`.
 */
export async function loadVentaConSnapshot(ventaId: number): Promise<{
  sale: PropertySale;
  property: Property;
  snapshot: GananciaPatrimonialResult;
} | null> {
  const db = await initDB();
  const sale = (await db.get('property_sales', ventaId)) as PropertySale | undefined;
  if (!sale) return null;
  const property = (await db.get('properties', sale.propertyId)) as Property | undefined;
  if (!property) return null;

  let snapshot: GananciaPatrimonialResult;
  if (sale.fiscalSnapshot) {
    snapshot = sale.fiscalSnapshot as GananciaPatrimonialResult;
  } else {
    try {
      snapshot = await calcularGananciaPatrimonial({
        propertyId: sale.propertyId,
        sellDate: sale.saleDate,
        salePrice: sale.salePrice,
        agencyCommission: sale.saleCosts?.agencyCommission ?? 0,
        municipalTax: sale.saleCosts?.municipalTax ?? 0,
        saleNotaryCosts: sale.saleCosts?.saleNotaryCosts ?? 0,
        otherCosts: sale.saleCosts?.otherCosts ?? 0,
      });
    } catch {
      return null;
    }
  }

  return { sale, property, snapshot };
}
