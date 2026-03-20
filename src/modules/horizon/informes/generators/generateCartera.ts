import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { COLOR, drawFooter, drawHeader, drawKpiRow, drawSectionTitle, fmtEur, fmtPct } from './pdfHelpers';

const PAGE_MARGIN = 14;

const getLastAutoTableY = (doc: jsPDF, fallback: number): number => {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
};

export async function generateCartera(data: InformesData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const inmueblesActivos = data.inmuebles.filter((item) => item.estado !== 'VENDIDO');
  const valorTotal = inmueblesActivos.reduce((s, item) => s + item.valorActual, 0);
  const costeTotal = inmueblesActivos.reduce((s, item) => s + item.costeTotal, 0);
  const plusvaliaTotal = inmueblesActivos.reduce((s, item) => s + item.plusvalia, 0);
  const rentaTotal = inmueblesActivos.reduce((s, item) => s + item.rentaMensual, 0);
  const hipTotal = inmueblesActivos.reduce((s, item) => s + item.hipotecaMensual, 0);
  const cfTotal = inmueblesActivos.reduce((s, item) => s + item.cfNeto, 0);
  const deudaTotal = data.resumenCartera.deudaHipotecaria;
  const equity = valorTotal - deudaTotal;
  const yieldBruta = costeTotal > 0 ? (rentaTotal * 12 / costeTotal) * 100 : 0;
  const ltv = valorTotal > 0 ? (deudaTotal / valorTotal) * 100 : 0;
  const plusPct = costeTotal > 0 ? (plusvaliaTotal / costeTotal) * 100 : 0;

  const proyeccion = Array.from({ length: 10 }, (_, idx) => {
    const yr = idx + 1;
    const valor = valorTotal * Math.pow(1.05, yr);
    const deuda = deudaTotal * Math.pow(0.96, yr);
    const cfAcum = Array.from({ length: yr }, (__, i) => cfTotal * 12 * Math.pow(1.02, i + 1))
      .reduce((s, v) => s + v, 0);
    return {
      año: new Date().getFullYear() + yr,
      valor: Math.round(valor),
      deuda: Math.round(deuda),
      equity: Math.round(valor - deuda),
      cfAcumulado: Math.round(cfAcum),
    };
  });

  const year10 = proyeccion[9] ?? { año: new Date().getFullYear() + 10, valor: 0, deuda: 0, equity: 0, cfAcumulado: 0 };

  drawHeader(doc, 'Informe de Cartera Inmobiliaria', `Resumen y métricas - ${data.año}`, 1, 3);
  let y = 46;

  y = drawKpiRow(doc, y, [
    { label: 'Valor cartera', value: fmtEur(valorTotal), sub: 'Activos vivos', color: COLOR.navy },
    { label: 'Coste acumulado', value: fmtEur(costeTotal), sub: 'Base invertida', color: COLOR.gray2 },
    { label: 'Plusvalía latente', value: fmtEur(plusvaliaTotal), sub: fmtPct(plusPct), color: plusvaliaTotal >= 0 ? COLOR.green : COLOR.red },
    { label: 'Equity', value: fmtEur(equity), sub: 'Valor neto estimado', color: COLOR.teal },
    { label: 'LTV medio', value: fmtPct(ltv), sub: 'Deuda / valor', color: ltv < 50 ? COLOR.green : COLOR.amber },
  ]);

  y = drawKpiRow(doc, y, [
    { label: 'Renta bruta/mes', value: fmtEur(rentaTotal), sub: 'Ingreso mensual', color: COLOR.navy },
    { label: 'CF neto/mes', value: fmtEur(cfTotal), sub: 'Renta - hipoteca', color: cfTotal >= 0 ? COLOR.green : COLOR.red },
    { label: 'Yield bruta', value: fmtPct(yieldBruta), sub: 'Renta anual / coste', color: yieldBruta > 8 ? COLOR.green : yieldBruta >= 3 ? COLOR.amber : COLOR.red },
    { label: 'Deuda hipotecaria', value: fmtEur(deudaTotal), sub: 'Capital vivo', color: COLOR.amber },
    { label: 'Nº activos', value: String(inmueblesActivos.length), sub: 'Inmuebles en cartera', color: COLOR.teal },
  ]);

  y = drawSectionTitle(doc, y, 'Activos en cartera');

  const activosRows = inmueblesActivos.length > 0
    ? inmueblesActivos.map((item) => [
      item.alias,
      item.ciudad,
      fmtEur(item.costeTotal),
      fmtEur(item.valorActual),
      fmtEur(item.plusvalia),
      fmtEur(item.rentaMensual),
      fmtPct(item.yieldBruto),
      fmtEur(item.hipotecaMensual),
      fmtEur(item.cfNeto),
    ])
    : [['Sin activos disponibles para este ejercicio', '', '', '', '', '', '', '', '']];

  const activosFoot = inmueblesActivos.length > 0
    ? [[
      'TOTAL',
      '',
      fmtEur(costeTotal),
      fmtEur(valorTotal),
      fmtEur(plusvaliaTotal),
      fmtEur(rentaTotal),
      fmtPct(yieldBruta),
      fmtEur(hipTotal),
      fmtEur(cfTotal),
    ]]
    : undefined;

  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10, bottom: 20 },
    head: [['Activo', 'Ciudad', 'Coste', 'Valor', 'Plusvalía', 'Renta/mes', 'Yield', 'Hip./mes', 'CF neto']],
    body: activosRows,
    foot: activosFoot,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 1.9, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    footStyles: { fillColor: COLOR.graylt, textColor: COLOR.gray1, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && inmueblesActivos.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }
      if ((hookData.section === 'body' || hookData.section === 'foot') && hookData.column.index === 8) {
        const value = hookData.section === 'foot' ? cfTotal : (inmueblesActivos[hookData.row.index]?.cfNeto ?? 0);
        hookData.cell.styles.textColor = value >= 0 ? COLOR.green : COLOR.red;
      }
      if ((hookData.section === 'body' || hookData.section === 'foot') && hookData.column.index === 6) {
        const value = hookData.section === 'foot' ? yieldBruta : (inmueblesActivos[hookData.row.index]?.yieldBruto ?? 0);
        hookData.cell.styles.textColor = value > 8 ? COLOR.green : value >= 3 ? COLOR.amber : COLOR.red;
      }
    },
  });
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Informe de Cartera Inmobiliaria', `Datos fiscales por activo - ${data.año}`, 2, 3);
  y = 48;

  y = drawSectionTitle(doc, y, 'Datos catastrales y fiscales');
  const detalleFiscalRows = data.cartera.detalleFiscal.length > 0
    ? data.cartera.detalleFiscal.map((item) => [
      item.alias,
      fmtEur(item.valorCatastral),
      fmtEur(item.vcConstruccion),
      fmtPct(item.pctConstruccion),
      item.metodoAmortizacion,
      fmtPct(item.pctAmortizacion),
      item.regimenFiscal,
    ])
    : [['Sin datos fiscales disponibles para este ejercicio', '', '', '', '', '', '']];

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Inmueble', 'Valor catastral', 'VC construcción', '% Const.', 'Método amort.', '% Amort.', 'Régimen fiscal']],
    body: detalleFiscalRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.1, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && data.cartera.detalleFiscal.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
      }
    },
  });

  const afterFiscalData = getLastAutoTableY(doc, y);
  autoTable(doc, {
    startY: afterFiscalData + 8,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Activo', 'Renta/mes', 'Hip./mes', 'CF neto', 'Yield bruta', 'Estado']],
    body: inmueblesActivos.length > 0
      ? inmueblesActivos.map((item) => [
        item.alias,
        fmtEur(item.rentaMensual),
        fmtEur(item.hipotecaMensual),
        fmtEur(item.cfNeto),
        fmtPct(item.yieldBruto),
        item.estado,
      ])
      : [['Sin activos disponibles para este ejercicio', '', '', '', '', '']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') {
        return;
      }
      if (inmueblesActivos.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }
      if (hookData.column.index === 3) {
        const cfNeto = inmueblesActivos[hookData.row.index]?.cfNeto ?? 0;
        hookData.cell.styles.textColor = cfNeto >= 0 ? COLOR.green : COLOR.red;
      }
      if (hookData.column.index === 5) {
        const estado = inmueblesActivos[hookData.row.index]?.estado ?? '';
        hookData.cell.styles.textColor = estado === 'ACTIVO' ? COLOR.green : COLOR.gray1;
      }
    },
  });
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Informe de Cartera Inmobiliaria', `Proyección a 10 años - ${data.año}`, 3, 3);
  y = 48;

  y = drawKpiRow(doc, y, [
    { label: 'Valor cartera (año 10)', value: fmtEur(year10.valor), sub: String(year10.año), color: COLOR.navy },
    { label: 'Equity (año 10)', value: fmtEur(year10.equity), sub: 'Valor neto estimado', color: COLOR.green },
    { label: 'Deuda residual (año 10)', value: fmtEur(year10.deuda), sub: 'Hipoteca pendiente', color: COLOR.amber },
    { label: 'CF acumulado 10 años', value: fmtEur(year10.cfAcumulado), sub: 'Caja agregada', color: COLOR.teal },
  ]);

  y = drawSectionTitle(doc, y, 'Proyección financiera');
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 24 },
    head: [['Año', 'Valor cartera', 'Deuda hipot.', 'Equity', 'CF acumulado']],
    body: proyeccion.map((row) => [row.año, fmtEur(row.valor), fmtEur(row.deuda), fmtEur(row.equity), fmtEur(row.cfAcumulado)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.4, cellPadding: 2.4, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        hookData.cell.styles.textColor = COLOR.green;
      }
      if (hookData.section === 'body' && hookData.column.index === 4) {
        hookData.cell.styles.textColor = COLOR.teal;
      }
    },
  });

  const afterProjection = getLastAutoTableY(doc, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.gray2);
  doc.text(
    'Hipotesis: revalorización +5%/año, amortización de deuda –4%/año, CF +2%/año. No incluye inflación ni cambios de tipo de interés. Uso meramente orientativo.',
    PAGE_MARGIN,
    afterProjection + 8,
    { maxWidth: doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2 },
  );

  drawFooter(doc);
  doc.save(`ATLAS_Cartera_Inmobiliaria_${data.año}.pdf`);
}
