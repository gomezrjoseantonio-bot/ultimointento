import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PrestamoFinanciacion, CalculoLive } from '../types/financiacion';

const fmt = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Generate amortization schedule rows (French system)
 */
function generateAmortizationRows(
  capital: number,
  tinAnual: number,
  plazoMeses: number,
  fechaInicio: string
): string[][] {
  const rows: string[][] = [];
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

    const fecha = new Date(fechaBase);
    fecha.setMonth(fecha.getMonth() + i);

    rows.push([
      String(i),
      fecha.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit' }),
      `${fmt(cuota)} €`,
      `${fmt(capitalAmort)} €`,
      `${fmt(intereses)} €`,
      `${fmt(capitalPendiente)} €`
    ]);
  }

  return rows;
}

/**
 * Export loan summary and amortization table to PDF
 */
export function exportLoanToPDF(
  formData: Partial<PrestamoFinanciacion>,
  calculoLive: CalculoLive | null
): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.setTextColor(10, 36, 99); // atlas-navy
  doc.text('Resumen del Préstamo', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 27);

  // Summary table
  const summaryData: string[][] = [
    ['Capital inicial', formData.capitalInicial ? `${fmt(formData.capitalInicial)} €` : '-'],
    ['Plazo', formData.plazoTotal ? `${formData.plazoTotal} ${formData.plazoPeriodo === 'AÑOS' ? 'años' : 'meses'}` : '-'],
    ['Tipo de interés', formData.tipo || '-'],
  ];

  if (formData.tipo === 'FIJO') {
    summaryData.push(['TIN fijo', formData.tinFijo ? `${fmt(formData.tinFijo)} %` : '-']);
  } else if (formData.tipo === 'VARIABLE') {
    summaryData.push(['Diferencial', formData.diferencial !== undefined ? `${fmt(formData.diferencial)} %` : '-']);
    summaryData.push(['Valor índice', formData.valorIndice !== undefined ? `${fmt(formData.valorIndice)} %` : '-']);
  }

  if (calculoLive) {
    summaryData.push(['Cuota estimada', `${fmt(calculoLive.cuotaEstimada)} €/mes`]);
    summaryData.push(['TAE', `${fmt(calculoLive.taeAproximada)} %`]);
    summaryData.push(['TIN efectivo', `${fmt(calculoLive.tinEfectivo)} %`]);
  }

  autoTable(doc, {
    startY: 35,
    head: [['Concepto', 'Valor']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [10, 36, 99] },
    styles: { fontSize: 10 }
  });

  // Amortization table
  const capital = formData.capitalInicial || 0;
  const tinEfectivo = calculoLive?.tinEfectivo || 0;
  const plazoMeses = formData.plazoPeriodo === 'AÑOS'
    ? (formData.plazoTotal || 0) * 12
    : (formData.plazoTotal || 0);
  const fechaInicio = formData.fechaFirma || new Date().toISOString().split('T')[0];

  if (capital > 0 && tinEfectivo > 0 && plazoMeses > 0) {
    const amortRows = generateAmortizationRows(capital, tinEfectivo, plazoMeses, fechaInicio);
    const finalY = (doc as any).lastAutoTable?.finalY ?? 35;

    doc.setFontSize(14);
    doc.setTextColor(10, 36, 99);
    doc.text('Cuadro de Amortización', 14, finalY + 15);

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Período', 'Fecha', 'Cuota', 'Capital', 'Intereses', 'Cap. Pendiente']],
      body: amortRows,
      theme: 'striped',
      headStyles: { fillColor: [10, 36, 99] },
      styles: { fontSize: 8 }
    });
  }

  const alias = formData.alias || 'prestamo';
  doc.save(`${alias.replace(/\s+/g, '_')}_resumen.pdf`);
}
