import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { COLOR, drawFooter, drawHeader, drawKpiRow, drawSectionTitle, fmtEur, fmtPct } from './pdfHelpers';

const PAGE_MARGIN = 14;

type FiscalResumenRow = {
  concepto: string;
  importe: number | null;
  highlight?: boolean;
  isResult?: boolean;
};

const getLastAutoTableY = (doc: jsPDF, fallback: number): number => {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
};

const sumBy = <T>(items: T[], getValue: (item: T) => number): number => {
  return items.reduce((sum, item) => sum + getValue(item), 0);
};

const formatCoverageLabel = (retenciones: number, cuotaIntegra: number, ratio: number): string => {
  return `Retenciones / Cuota íntegra: ${fmtPct(ratio)} (${fmtEur(retenciones)} / ${fmtEur(cuotaIntegra)})`;
};

export async function generateFiscal(data: InformesData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const resumen = data.fiscal.resumen;
  const inmuebles = data.fiscal.inmuebles;
  const calendario = data.fiscal.calendario;

  const totalIngresosIntegros = sumBy(inmuebles, (item) => item.ingresosIntegros);
  const totalGastosYAmortizacion = sumBy(inmuebles, (item) => item.gastosDeducibles + item.amortizacion);
  const totalReduccion60 = sumBy(inmuebles, (item) => item.reduccion60);
  const totalRendimientoNetoReducido = sumBy(inmuebles, (item) => item.rendimientoNetoReducido);

  const totalModelo130 = calendario
    .filter((item) => item.concepto.toUpperCase().includes('130'))
    .reduce((sum, item) => sum + item.importe, 0);
  const totalDeclaracionIRPF = calendario
    .filter((item) => item.concepto.toUpperCase().includes('IRPF'))
    .reduce((sum, item) => sum + item.importe, 0);
  const totalDesembolsar = calendario.reduce((sum, item) => sum + item.importe, 0);
  const totalRetenido = resumen.totalRetenciones;

  const coverageRatio = resumen.cuotaIntegra > 0 ? (resumen.totalRetenciones / resumen.cuotaIntegra) * 100 : 0;
  const boundedCoverageRatio = Math.max(0, Math.min(100, coverageRatio));

  const resumenRows: FiscalResumenRow[] = [
    { concepto: 'Rendimientos del trabajo (neto)', importe: resumen.rendimientosTrabajo },
    { concepto: 'Rentas capital inmobiliario', importe: resumen.rentasCapitalInmobiliario },
    { concepto: 'Rendimientos actividades económicas', importe: resumen.rendimientosAutonomo },
    { concepto: 'Rendimientos capital mobiliario', importe: resumen.rendimientosCapitalMobiliario },
    { concepto: '', importe: null },
    { concepto: 'Base imponible general', importe: resumen.baseImponibleGeneral },
    { concepto: 'Base imponible del ahorro', importe: resumen.baseImponibleAhorro },
    { concepto: 'Base liquidable general', importe: resumen.baseLiquidableGeneral, highlight: true },
    { concepto: '', importe: null },
    { concepto: 'Cuota íntegra', importe: resumen.cuotaIntegra, highlight: true },
    { concepto: '', importe: null },
    { concepto: 'Retenciones trabajo', importe: resumen.retencionTrabajo },
    { concepto: 'Retenciones capital', importe: resumen.retencionCapital },
    { concepto: 'Retenciones autónomo / pag. fraccionados', importe: resumen.retencionAutonomo },
    { concepto: 'Total retenciones', importe: resumen.totalRetenciones, highlight: true },
    { concepto: '', importe: null },
    { concepto: 'RESULTADO — A ingresar / A devolver', importe: resumen.resultado, highlight: true, isResult: true },
  ];

  drawHeader(doc, 'Cuadro Fiscal Anual', `Resumen IRPF - ${data.año}`, 1, 3);
  let y = 46;

  y = drawKpiRow(doc, y, [
    { label: 'Base liquidable general', value: fmtEur(resumen.baseLiquidableGeneral), sub: 'Base sujeta a gravamen', color: COLOR.navy },
    { label: 'Cuota íntegra', value: fmtEur(resumen.cuotaIntegra), sub: 'Cuota estimada', color: COLOR.amber },
    { label: 'Total retenciones', value: fmtEur(resumen.totalRetenciones), sub: 'Importe ya retenido', color: COLOR.teal },
    {
      label: 'Resultado declaración',
      value: fmtEur(resumen.resultado),
      sub: resumen.resultado > 0 ? 'A pagar' : resumen.resultado < 0 ? 'A devolver' : 'Resultado neutro',
      color: resumen.resultado > 0 ? COLOR.red : resumen.resultado < 0 ? COLOR.green : COLOR.gray2,
    },
  ]);

  y = drawSectionTitle(doc, y, 'Resumen de la declaración');

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 18 },
    head: [['Concepto', 'Importe']],
    body: resumenRows.map((row) => [row.concepto, row.importe === null ? '' : fmtEur(row.importe)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.8, cellPadding: 2.5, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') {
        return;
      }
      const row = resumenRows[hookData.row.index];
      if (!row) {
        return;
      }
      if (row.highlight) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = COLOR.graylt;
      }
      if (!row.concepto) {
        hookData.cell.styles.fillColor = COLOR.white;
      }
      if (row.isResult) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = (row.importe ?? 0) > 0 ? COLOR.red : (row.importe ?? 0) < 0 ? COLOR.green : COLOR.gray1;
      }
    },
  });
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Cuadro Fiscal Anual', `Rendimientos por inmueble - ${data.año}`, 2, 3);
  y = 46;

  y = drawKpiRow(doc, y, [
    { label: 'Ingresos íntegros totales', value: fmtEur(totalIngresosIntegros), sub: 'Ingresos declarados', color: COLOR.navy },
    { label: 'Gastos + amort. totales', value: fmtEur(totalGastosYAmortizacion), sub: 'Deducciones acumuladas', color: COLOR.amber },
    { label: 'Reducción 60% total', value: fmtEur(totalReduccion60), sub: 'Aplicada a alquiler habitual', color: COLOR.teal },
    { label: 'Rendimiento neto total', value: fmtEur(totalRendimientoNetoReducido), sub: 'Resultado fiscal neto', color: totalRendimientoNetoReducido >= 0 ? COLOR.green : COLOR.red },
  ]);

  y = drawSectionTitle(doc, y, 'Detalle fiscal por inmueble');

  const inmuebleRows = inmuebles.length > 0
    ? inmuebles.map((item) => [
      item.alias,
      fmtEur(item.ingresosIntegros),
      fmtEur(item.gastosDeducibles),
      fmtEur(item.amortizacion),
      fmtEur(item.baseNeta),
      fmtEur(item.reduccion60),
      fmtEur(item.rendimientoNetoReducido),
    ])
    : [['Sin datos fiscales disponibles para este ejercicio', '', '', '', '', '', '']];

  const footRows = inmuebles.length > 0
    ? [[
      'TOTAL',
      fmtEur(totalIngresosIntegros),
      fmtEur(sumBy(inmuebles, (item) => item.gastosDeducibles)),
      fmtEur(sumBy(inmuebles, (item) => item.amortizacion)),
      fmtEur(sumBy(inmuebles, (item) => item.baseNeta)),
      fmtEur(totalReduccion60),
      fmtEur(totalRendimientoNetoReducido),
    ]]
    : undefined;

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 24 },
    head: [['Inmueble', 'Ingresos íntegros', 'Gastos deducibles', 'Amortización', 'Base neta', 'Reducción 60%', 'Rend. neto red.']],
    body: inmuebleRows,
    foot: footRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 2.1, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    footStyles: { fillColor: COLOR.graylt, textColor: COLOR.gray1, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && inmuebles.length > 0 && (hookData.column.index === 4 || hookData.column.index === 6)) {
        const value = hookData.column.index === 4
          ? (inmuebles[hookData.row.index]?.baseNeta ?? 0)
          : (inmuebles[hookData.row.index]?.rendimientoNetoReducido ?? 0);
        hookData.cell.styles.textColor = value >= 0 ? COLOR.green : COLOR.red;
      }
      if (hookData.section === 'body' && inmuebles.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
      }
      if (hookData.section === 'foot' && (hookData.column.index === 4 || hookData.column.index === 6)) {
        const value = hookData.column.index === 4 ? sumBy(inmuebles, (item) => item.baseNeta) : totalRendimientoNetoReducido;
        hookData.cell.styles.textColor = value >= 0 ? COLOR.green : COLOR.red;
      }
    },
  });

  const afterInmuebles = getLastAutoTableY(doc, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.gray2);
  doc.text(
    'Los inmuebles con rendimiento negativo pueden compensar positivos del mismo ejercicio o arrastrarse a los 4 ejercicios siguientes.',
    PAGE_MARGIN,
    afterInmuebles + 8,
  );
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Cuadro Fiscal Anual', `Calendario de pagos - ${data.año}`, 3, 3);
  y = 46;

  y = drawKpiRow(doc, y, [
    { label: 'Total Mod. 130', value: fmtEur(totalModelo130), sub: 'Pagos fraccionados', color: COLOR.amber },
    { label: 'Declaración IRPF', value: fmtEur(totalDeclaracionIRPF), sub: 'Resultado anual', color: COLOR.navy },
    { label: 'Total a desembolsar', value: fmtEur(totalDesembolsar), sub: 'Calendario fiscal', color: COLOR.red },
    { label: 'Ya retenido', value: fmtEur(totalRetenido), sub: 'Cobertura estimada', color: COLOR.green },
  ]);

  y = drawSectionTitle(doc, y, 'Calendario de pagos fiscales');

  const calendarioRows = calendario.length > 0
    ? calendario.map((item) => [item.concepto, item.fecha, fmtEur(item.importe), item.estado])
    : [['Sin datos fiscales disponibles para este ejercicio', '', '', '']];

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 32 },
    head: [['Concepto', 'Fecha límite', 'Importe', 'Estado']],
    body: calendarioRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 2.4, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') {
        return;
      }
      if (calendario.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }
      if (hookData.column.index === 2) {
        hookData.cell.styles.textColor = COLOR.red;
      }
      if (hookData.column.index === 3) {
        const estado = calendario[hookData.row.index]?.estado ?? '';
        hookData.cell.styles.textColor = estado === 'Pendiente' ? COLOR.amber : estado === 'Pagado' ? COLOR.green : COLOR.gray1;
      }
    },
  });

  const afterCalendar = getLastAutoTableY(doc, y);
  const pageWidth = doc.internal.pageSize.getWidth();
  const barWidth = pageWidth - 28;
  const barX = PAGE_MARGIN;
  const barY = afterCalendar + 15;
  const fillWidth = (barWidth * boundedCoverageRatio) / 100;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.gray1);
  doc.text(formatCoverageLabel(resumen.totalRetenciones, resumen.cuotaIntegra, coverageRatio), barX, barY - 2.5);
  doc.setFillColor(...COLOR.graylt);
  doc.setDrawColor(...COLOR.graybd);
  doc.rect(barX, barY, barWidth, 5, 'FD');
  if (fillWidth > 0) {
    doc.setFillColor(...COLOR.green);
    doc.rect(barX, barY, fillWidth, 5, 'F');
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.gray2);
  const legalY = barY + 14;
  const legalNotes = [
    'Los datos de este cuadro fiscal han sido generados automáticamente por ATLAS a partir de los datos del ejercicio registrados por el titular.',
    'Los importes son estimaciones calculadas según la normativa IRPF vigente. Antes de presentar la declaración, revisar con gestor o asesor fiscal.',
    'El resultado a ingresar se abona en la declaración anual de la Renta, en dos fracciones si se fracciona el pago.',
  ];
  legalNotes.forEach((line, index) => {
    doc.text(line, PAGE_MARGIN, legalY + index * 4.5);
  });

  drawFooter(doc);
  doc.save(`ATLAS_Fiscal_${data.año}.pdf`);
}
