import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { COLOR, drawFooter, drawHeader, drawKpiRow, drawSectionTitle, fmtEur, fmtPct } from './pdfHelpers';

export async function generatePatrimonio(data: InformesData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const totalPages = 2;
  const activosTotales = data.resumenCartera.valorTotal + (data.proyeccion.meses[data.proyeccion.meses.length - 1]?.cajaFinal ?? 0);
  const pasivoTotal = data.resumenFinanciacion.deudaTotal;
  const patrimonioNeto = activosTotales - pasivoTotal;
  const equityInmobiliario = data.resumenCartera.equity;
  const variacionAnual = data.proyeccion.totalesAnuales.patrimonioNetoFinal - data.proyeccion.totalesAnuales.patrimonioNetoInicial;
  const deudaActivo = activosTotales > 0 ? (pasivoTotal / activosTotales) * 100 : 0;

  drawHeader(doc, 'Informe Patrimonial', `Resumen patrimonial · ${data.año}`, 1, totalPages);
  let y = 46;
  y = drawKpiRow(doc, y, [
    { label: 'Activos totales', value: fmtEur(activosTotales), sub: 'Valor agregado', color: COLOR.navy },
    { label: 'Pasivo total', value: fmtEur(pasivoTotal), sub: 'Deuda viva', color: COLOR.amber },
    { label: 'Patrimonio neto', value: fmtEur(patrimonioNeto), sub: 'Activo - pasivo', color: patrimonioNeto >= 0 ? COLOR.green : COLOR.red },
    { label: 'Equity inmobiliario', value: fmtEur(equityInmobiliario), sub: 'Valor neto inmuebles', color: COLOR.teal },
    { label: 'Variación anual', value: fmtEur(variacionAnual), sub: 'Evolución del año', color: variacionAnual >= 0 ? COLOR.green : COLOR.red },
  ]);
  y = drawKpiRow(doc, y, [
    { label: 'Ratio deuda/activo', value: fmtPct(deudaActivo), sub: 'Apalancamiento', color: deudaActivo <= 50 ? COLOR.green : COLOR.amber },
  ]);

  const cajaFinal = data.proyeccion.meses[data.proyeccion.meses.length - 1]?.cajaFinal ?? 0;
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [[ 'Categoría', 'Valor activo', 'Deuda', 'Equity', '% s/total activos' ]],
    body: [
      ['Inmuebles', fmtEur(data.resumenCartera.valorTotal), fmtEur(data.resumenCartera.deudaHipotecaria), fmtEur(data.resumenCartera.equity), fmtPct(activosTotales > 0 ? (data.resumenCartera.valorTotal / activosTotales) * 100 : 0)],
      ['Inversiones/Pensiones', fmtEur(0), fmtEur(0), fmtEur(0), fmtPct(0)],
      ['Tesorería / Caja', fmtEur(cajaFinal), fmtEur(0), fmtEur(cajaFinal), fmtPct(activosTotales > 0 ? (cajaFinal / activosTotales) * 100 : 0)],
    ],
    foot: [[ 'TOTAL', fmtEur(activosTotales), fmtEur(pasivoTotal), fmtEur(patrimonioNeto), fmtPct(100) ]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    footStyles: { fillColor: COLOR.graylt, textColor: COLOR.gray1, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR.graylt },
  });

  const afterComposition = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  autoTable(doc, {
    startY: afterComposition + 6,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [[ 'Mes', 'Patrimonio neto', 'Variación mensual', 'Variación %' ]],
    body: data.proyeccion.meses.map((month, index) => {
      const previous = index > 0 ? data.proyeccion.meses[index - 1]?.patrimonioNeto ?? data.proyeccion.totalesAnuales.patrimonioNetoInicial : data.proyeccion.totalesAnuales.patrimonioNetoInicial;
      const diff = month.patrimonioNeto - previous;
      const diffPct = previous !== 0 ? (diff / previous) * 100 : 0;
      return [month.mes, fmtEur(month.patrimonioNeto), fmtEur(diff), fmtPct(diffPct)];
    }),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.1, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && (hookData.column.index === 2 || hookData.column.index === 3)) {
        const row = data.proyeccion.meses[hookData.row.index];
        const previous = hookData.row.index > 0
          ? data.proyeccion.meses[hookData.row.index - 1]?.patrimonioNeto ?? data.proyeccion.totalesAnuales.patrimonioNetoInicial
          : data.proyeccion.totalesAnuales.patrimonioNetoInicial;
        const diff = row ? row.patrimonioNeto - previous : 0;
        hookData.cell.styles.textColor = diff >= 0 ? COLOR.green : COLOR.red;
      }
    },
  });
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Informe Patrimonial', `Detalle de inmuebles y deuda · ${data.año}`, 2, totalPages);
  y = 48;
  y = drawSectionTitle(doc, y, 'Detalle de inmuebles');

  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10, bottom: 18 },
    head: [[ 'Activo', 'Ciudad', 'Coste', 'Valor', 'Plusvalía', 'Renta/mes', 'Yield', 'Hip./mes', 'CF neto', 'Estado' ]],
    body: data.inmuebles.map((item) => [
      item.alias,
      item.ciudad,
      fmtEur(item.costeTotal),
      fmtEur(item.valorActual),
      fmtEur(item.plusvalia),
      fmtEur(item.rentaMensual),
      fmtPct(item.yieldBruto),
      fmtEur(item.hipotecaMensual),
      fmtEur(item.cfNeto),
      item.estado,
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 1.9, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 8) {
        const value = data.inmuebles[hookData.row.index]?.cfNeto ?? 0;
        hookData.cell.styles.textColor = value >= 0 ? COLOR.green : COLOR.red;
      }
    },
  });

  const afterAssets = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  autoTable(doc, {
    startY: afterAssets + 6,
    margin: { left: 14, right: 14, bottom: 22 },
    head: [[ 'Mes', 'Deuda inmuebles', 'Deuda personal', 'Total deuda', 'Variación' ]],
    body: data.proyeccion.meses.map((month, index) => {
      const total = data.resumenCartera.deudaHipotecaria + Math.max(0, data.resumenFinanciacion.deudaTotal - data.resumenCartera.deudaHipotecaria);
      const remainingFactor = (data.proyeccion.meses.length - index) / data.proyeccion.meses.length;
      const deudaInmuebles = data.resumenCartera.deudaHipotecaria * remainingFactor;
      const deudaPersonal = Math.max(0, data.resumenFinanciacion.deudaTotal - data.resumenCartera.deudaHipotecaria) * remainingFactor;
      const totalDeuda = deudaInmuebles + deudaPersonal;
      const previous = index === 0 ? total : (() => {
        const prevFactor = (data.proyeccion.meses.length - (index - 1)) / data.proyeccion.meses.length;
        return data.resumenCartera.deudaHipotecaria * prevFactor + Math.max(0, data.resumenFinanciacion.deudaTotal - data.resumenCartera.deudaHipotecaria) * prevFactor;
      })();
      return [month.mes, fmtEur(deudaInmuebles), fmtEur(deudaPersonal), fmtEur(totalDeuda), fmtEur(totalDeuda - previous)];
    }),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.1, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const rowIndex = hookData.row.index;
        const currentFactor = (data.proyeccion.meses.length - rowIndex) / data.proyeccion.meses.length;
        const currentTotal = data.resumenFinanciacion.deudaTotal * currentFactor;
        const previousFactor = rowIndex === 0 ? 1 : (data.proyeccion.meses.length - (rowIndex - 1)) / data.proyeccion.meses.length;
        const previousTotal = data.resumenFinanciacion.deudaTotal * previousFactor;
        hookData.cell.styles.textColor = currentTotal - previousTotal <= 0 ? COLOR.green : COLOR.red;
      }
    },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.gray2);
  doc.text('Documento de uso exclusivamente informativo. No constituye asesoramiento legal, fiscal ni una tasación oficial.', 14, pageHeight - 20);
  drawFooter(doc);

  doc.save(`ATLAS_Informe_Patrimonio_${data.año}.pdf`);
}
