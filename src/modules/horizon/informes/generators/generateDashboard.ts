import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { COLOR, drawFooter, drawHeader, drawKpiRow, fmtEur } from './pdfHelpers';

const HEADER_Y = 46;
const KPI_RESERVED_HEIGHT = 28;
const TABLE_BOTTOM_MARGIN = 20;
const TABLE_ROW_HEIGHT = 7;
const TABLE_ROW_HEIGHT_COMPACT = 6;

const renderDashboardDoc = (data: InformesData, rowHeight: number): jsPDF => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  drawHeader(doc, 'Dashboard Ejecutivo', `Ejercicio ${data.año} - Generado el ${new Date(data.generadoEn).toLocaleString('es-ES')}`, 1, 1);

  let y = HEADER_Y;
  y = drawKpiRow(doc, y, [
    {
      label: 'Ingresos anuales',
      value: fmtEur(data.proyeccion.totalesAnuales.ingresosTotales),
      sub: 'Suma anual proyectada',
      color: COLOR.teal,
    },
    {
      label: 'Gastos totales',
      value: fmtEur(data.proyeccion.totalesAnuales.gastosTotales),
      sub: 'Coste operativo y personal',
      color: COLOR.red,
    },
    {
      label: 'Flujo neto',
      value: fmtEur(data.proyeccion.totalesAnuales.flujoNeto),
      sub: 'Caja generada en el año',
      color: data.proyeccion.totalesAnuales.flujoNeto >= 0 ? COLOR.green : COLOR.red,
    },
    {
      label: 'Patrimonio neto',
      value: fmtEur(data.proyeccion.totalesAnuales.patrimonioNetoFinal),
      sub: 'Cierre del ejercicio',
      color: COLOR.navy,
    },
  ]);

  const pageHeight = doc.internal.pageSize.getHeight();
  const footerTop = pageHeight - 14;
  const availableHeight = footerTop - y - TABLE_BOTTOM_MARGIN;
  const estimatedTableHeight = (data.proyeccion.meses.length + 1) * rowHeight;
  const startY = estimatedTableHeight <= availableHeight ? y : Math.max(HEADER_Y + KPI_RESERVED_HEIGHT, footerTop - TABLE_BOTTOM_MARGIN - estimatedTableHeight);

  autoTable(doc, {
    startY,
    margin: { left: 10, right: 10, bottom: TABLE_BOTTOM_MARGIN },
    head: [[ 'Mes', 'Ingresos', 'Gastos', 'Financiación', 'Flujo caja', 'Caja final' ]],
    body: data.proyeccion.meses.map((month) => [
      month.mes,
      fmtEur(month.totalIngresos),
      fmtEur(month.totalGastos),
      fmtEur(month.totalFinanciacion),
      fmtEur(month.flujoCaja),
      fmtEur(month.cajaFinal),
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      textColor: COLOR.gray1,
      cellPadding: 1.6,
      minCellHeight: rowHeight,
      lineColor: COLOR.graybd,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLOR.navy,
      textColor: COLOR.white,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: COLOR.graylt,
    },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const flujo = data.proyeccion.meses[hookData.row.index]?.flujoCaja ?? 0;
        hookData.cell.styles.textColor = flujo >= 0 ? COLOR.green : COLOR.red;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  drawFooter(doc);
  return doc;
};

export async function generateDashboard(data: InformesData): Promise<void> {
  let doc = renderDashboardDoc(data, TABLE_ROW_HEIGHT);

  if (doc.getNumberOfPages() > 1) {
    doc = renderDashboardDoc(data, TABLE_ROW_HEIGHT_COMPACT);
  }

  doc.save(`ATLAS_Dashboard_${data.año}.pdf`);
}
