import * as XLSX from 'xlsx';
import { PrestamoFinanciacion, CalculoLive } from '../types/financiacion';

/**
 * Generate amortization schedule rows (French system)
 */
function generateAmortizationRows(
  capital: number,
  tinAnual: number,
  plazoMeses: number,
  fechaInicio: string
): (string | number)[][] {
  const rows: (string | number)[][] = [];
  const tasaMensual = tinAnual / 100 / 12;
  let capitalPendiente = capital;

  const cuota =
    tasaMensual > 0
      ? capital * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) /
        (Math.pow(1 + tasaMensual, plazoMeses) - 1)
      : capital / plazoMeses;

  const fechaBase = new Date(fechaInicio);

  for (let i = 1; i <= plazoMeses; i++) {
    const intereses = capitalPendiente * tasaMensual;
    const capitalAmort = cuota - intereses;
    capitalPendiente = Math.max(0, capitalPendiente - capitalAmort);

    fechaBase.setMonth(fechaBase.getMonth() + 1);

    rows.push([
      i,
      fechaBase.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit' }),
      Math.round(cuota * 100) / 100,
      Math.round(capitalAmort * 100) / 100,
      Math.round(intereses * 100) / 100,
      Math.round(capitalPendiente * 100) / 100
    ]);
  }

  return rows;
}

/**
 * Export loan summary and amortization schedule to Excel (.xlsx)
 */
export function exportLoanToExcel(
  formData: Partial<PrestamoFinanciacion>,
  calculoLive: CalculoLive | null
): void {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Summary ---
  const summaryData: (string | number | undefined)[][] = [
    ['Resumen del Préstamo'],
    [],
    ['Concepto', 'Valor'],
    ['Capital inicial', formData.capitalInicial || 0],
    ['Plazo', formData.plazoTotal ? `${formData.plazoTotal} ${formData.plazoPeriodo === 'AÑOS' ? 'años' : 'meses'}` : '-'],
    ['Tipo de interés', formData.tipo || '-']
  ];

  if (formData.tipo === 'FIJO') {
    summaryData.push(['TIN fijo (%)', formData.tinFijo || 0]);
  } else if (formData.tipo === 'VARIABLE') {
    summaryData.push(['Diferencial (%)', formData.diferencial || 0]);
    summaryData.push(['Valor índice (%)', formData.valorIndice || 0]);
  }

  if (calculoLive) {
    summaryData.push(['Cuota estimada (€/mes)', calculoLive.cuotaEstimada]);
    summaryData.push(['TAE (%)', calculoLive.taeAproximada]);
    summaryData.push(['TIN efectivo (%)', calculoLive.tinEfectivo]);
    if (calculoLive.ahorroMensual) {
      summaryData.push(['Ahorro mensual (€)', calculoLive.ahorroMensual]);
    }
    if (calculoLive.ahorroAnual) {
      summaryData.push(['Ahorro anual (€)', calculoLive.ahorroAnual]);
    }
  }

  summaryData.push([]);
  summaryData.push(['Generado', new Date().toLocaleDateString('es-ES')]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  // --- Sheet 2: Amortization ---
  const capital = formData.capitalInicial || 0;
  const tinEfectivo = calculoLive?.tinEfectivo || 0;
  const plazoMeses = formData.plazoPeriodo === 'AÑOS'
    ? (formData.plazoTotal || 0) * 12
    : (formData.plazoTotal || 0);
  const fechaInicio = formData.fechaFirma || new Date().toISOString().split('T')[0];

  if (capital > 0 && tinEfectivo > 0 && plazoMeses > 0) {
    const amortRows = generateAmortizationRows(capital, tinEfectivo, plazoMeses, fechaInicio);
    const wsAmort = XLSX.utils.aoa_to_sheet([
      ['Período', 'Fecha', 'Cuota (€)', 'Capital (€)', 'Intereses (€)', 'Cap. Pendiente (€)'],
      ...amortRows
    ]);
    XLSX.utils.book_append_sheet(wb, wsAmort, 'Cuadro Amortización');
  }

  const alias = formData.alias || 'prestamo';
  XLSX.writeFile(wb, `${alias.replace(/\s+/g, '_')}_resumen.xlsx`);
}
