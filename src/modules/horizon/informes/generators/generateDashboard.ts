import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { COLOR, drawFooter, drawHeader, drawKpiRow, fmtEur } from './pdfHelpers';

export async function generateDashboard(data: InformesData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  drawHeader(doc, 'Dashboard Ejecutivo', `Ejercicio ${data.año} · Generado el ${new Date(data.generadoEn).toLocaleString('es-ES')}`, 1, 1);

  let y = 46;
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

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 20 },
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
      fontSize: 9,
      textColor: COLOR.gray1,
      cellPadding: 3,
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
  doc.save(`ATLAS_Dashboard_${data.año}.pdf`);
}
