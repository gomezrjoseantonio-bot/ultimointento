import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import {
  COLOR,
  drawFooter,
  drawHeader,
  drawKpiRow,
  drawSectionTitle,
  fmtEur,
  fmtPct,
  pageSize,
  parseIsoDate,
} from './pdfHelpers';

const drawProgress = (
  doc: jsPDF,
  y: number,
  label: string,
  valueText: string,
  percent: number,
  threshold: number,
  lowerIsBetter = true,
): number => {
  const x = 18;
  const width = 174;
  const bounded = Math.max(0, Math.min(100, percent));
  const ok = lowerIsBetter ? percent <= threshold : percent >= threshold;
  const color = ok ? COLOR.green : COLOR.amber;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.gray1);
  doc.text(label, x, y);
  doc.text(valueText, x + width, y, { align: 'right' });

  doc.setFillColor(...COLOR.graybd);
  doc.roundedRect(x, y + 2.5, width, 5, 2, 2, 'F');
  doc.setFillColor(...color);
  doc.roundedRect(x, y + 2.5, (width * bounded) / 100, 5, 2, 2, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.gray2);
  doc.text(`Umbral ${lowerIsBetter ? '≤' : '≥'} ${lowerIsBetter ? fmtPct(threshold) : threshold.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x'}`, x, y + 11);
  return y + 16;
};

export async function generateSolvencia(data: InformesData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const totalPages = 3;
  const monthlyIncome = data.proyeccion.totalesAnuales.ingresosTotales / 12;
  const monthlyExpenses = data.proyeccion.totalesAnuales.gastosTotales / 12;
  const monthlyInstallments = data.resumenFinanciacion.totalCuotasMensual;
  const dti = monthlyIncome > 0 ? (monthlyInstallments / monthlyIncome) * 100 : 0;
  const dscr = monthlyInstallments > 0 ? monthlyIncome / monthlyInstallments : 0;
  const ahorro = monthlyIncome > 0 ? ((monthlyIncome - monthlyInstallments - monthlyExpenses) / monthlyIncome) * 100 : 0;
  const freeCashFlow = data.proyeccion.totalesAnuales.flujoNeto;
  const finalCash = data.proyeccion.meses[data.proyeccion.meses.length - 1]?.cajaFinal ?? 0;
  const portfolioValue = data.resumenCartera.valorTotal;
  const ltv = data.resumenCartera.ltv;

  const { width, height } = pageSize(doc);
  doc.setFillColor(...COLOR.navy);
  doc.rect(0, 0, width, height, 'F');

  doc.setFillColor(...COLOR.teal);
  doc.triangle(24, 88, 60, 34, 96, 88, 'F');
  doc.setFillColor(...COLOR.white);
  doc.triangle(42, 73, 60, 46, 78, 73, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLOR.white);
  doc.text('Informe de Solvencia y', 26, 118);
  doc.text('Capacidad Financiera', 26, 130);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Ejercicio ${data.año}`, 26, 143);
  doc.text(`Generado el ${new Date(data.generadoEn).toLocaleString('es-ES')}`, 26, 151);

  doc.setFillColor(...COLOR.gray1);
  doc.roundedRect(26, 164, width - 52, 38, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Titular', 32, 176);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Nombre: ${data.personal.nombreCompleto || 'No disponible'}`, 32, 185);
  doc.text(`Empresa / actividad: ${data.personal.empresa || 'No disponible'}`, 32, 192);
  doc.text(`Antigüedad: ${data.personal.antiguedad || 'No disponible'}`, 114, 185);
  doc.text(`Nº inmuebles: ${data.inmuebles.length.toLocaleString('es-ES')}`, 114, 192);

  drawKpiRow(doc, 214, [
    { label: 'Ingresos anuales', value: fmtEur(data.proyeccion.totalesAnuales.ingresosTotales), sub: 'Capacidad acreditable', color: COLOR.teal },
    { label: 'Patrimonio neto', value: fmtEur(data.proyeccion.totalesAnuales.patrimonioNetoFinal), sub: 'Cierre ejercicio', color: COLOR.green },
    { label: 'DTI mensual', value: fmtPct(dti), sub: 'Cuotas / ingreso mensual', color: dti <= 43 ? COLOR.green : COLOR.amber },
    { label: 'Flujo libre', value: fmtEur(freeCashFlow), sub: 'Caja libre anual', color: freeCashFlow >= 0 ? COLOR.green : COLOR.red },
  ]);

  doc.setFillColor(...COLOR.teal);
  doc.rect(0, height - 16, width, 16, 'F');

  doc.addPage();
  drawHeader(doc, 'Informe de Solvencia y Capacidad Financiera', `Perfil financiero · ${data.año}`, 2, totalPages);
  let y = 48;

  if (data.personal.nombreCompleto || data.personal.empresa || data.personal.antiguedad) {
    y = drawSectionTitle(doc, y, 'Situación laboral');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR.gray1);
    const lines = [
      `Titular: ${data.personal.nombreCompleto || 'No disponible'}`,
      `Empresa / actividad: ${data.personal.empresa || 'No disponible'}`,
      `Antigüedad: ${data.personal.antiguedad || 'No disponible'}`,
    ];
    lines.forEach((line, index) => doc.text(line, 14, y + index * 6));
    y += 24;
  }

  y = drawSectionTitle(doc, y, 'KPIs de liquidez');
  y = drawKpiRow(doc, y, [
    { label: 'Ingreso anual', value: fmtEur(data.proyeccion.totalesAnuales.ingresosTotales), sub: 'Total del ejercicio', color: COLOR.teal },
    { label: 'Ingreso mensual', value: fmtEur(monthlyIncome), sub: 'Promedio mensual', color: COLOR.navy },
    { label: 'Cuotas mensuales', value: fmtEur(monthlyInstallments), sub: 'Hipotecas + préstamos', color: COLOR.amber },
    { label: 'Flujo libre anual', value: fmtEur(freeCashFlow), sub: 'Resultado neto', color: freeCashFlow >= 0 ? COLOR.green : COLOR.red },
    { label: 'Caja final', value: fmtEur(finalCash), sub: 'Tesorería estimada', color: COLOR.green },
  ]);

  y = drawSectionTitle(doc, y, 'Ratios bancarios');
  y = drawProgress(doc, y, 'DTI', fmtPct(dti), dti, 43, true);
  y = drawProgress(doc, y, 'LTV hipotecario', fmtPct(ltv), ltv, 50, true);
  y = drawProgress(doc, y, 'DSCR', `${dscr.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`, dscr * 100, 125, false);
  y = drawProgress(doc, y, 'Tasa de ahorro', fmtPct(ahorro), ahorro, 10, false);

  autoTable(doc, {
    startY: y + 2,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [[ 'Fuente', 'Anual', 'Mensual', '% s/total' ]],
    body: [
      ['Nóminas', fmtEur(data.proyeccion.desglose.nominas), fmtEur(data.proyeccion.desglose.nominas / 12), fmtPct(monthlyIncome > 0 ? (data.proyeccion.desglose.nominas / data.proyeccion.totalesAnuales.ingresosTotales) * 100 : 0)],
      ['Autónomos', fmtEur(data.proyeccion.desglose.autonomos), fmtEur(data.proyeccion.desglose.autonomos / 12), fmtPct(monthlyIncome > 0 ? (data.proyeccion.desglose.autonomos / data.proyeccion.totalesAnuales.ingresosTotales) * 100 : 0)],
      ['Rentas alquiler', fmtEur(data.proyeccion.desglose.rentasAlquiler), fmtEur(data.proyeccion.desglose.rentasAlquiler / 12), fmtPct(monthlyIncome > 0 ? (data.proyeccion.desglose.rentasAlquiler / data.proyeccion.totalesAnuales.ingresosTotales) * 100 : 0)],
      ['Intereses', fmtEur(data.proyeccion.desglose.intereses), fmtEur(data.proyeccion.desglose.intereses / 12), fmtPct(monthlyIncome > 0 ? (data.proyeccion.desglose.intereses / data.proyeccion.totalesAnuales.ingresosTotales) * 100 : 0)],
      ['Otros', fmtEur(data.proyeccion.desglose.otrosIngresos), fmtEur(data.proyeccion.desglose.otrosIngresos / 12), fmtPct(monthlyIncome > 0 ? (data.proyeccion.desglose.otrosIngresos / data.proyeccion.totalesAnuales.ingresosTotales) * 100 : 0)],
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.3, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
  });

  const afterIncomeTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? (y + 2);
  autoTable(doc, {
    startY: afterIncomeTable + 6,
    margin: { left: 14, right: 14, bottom: 18 },
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
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const value = data.proyeccion.meses[hookData.row.index]?.flujoCaja ?? 0;
        hookData.cell.styles.textColor = value >= 0 ? COLOR.green : COLOR.red;
      }
    },
  });
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Informe de Solvencia y Capacidad Financiera', `Cartera y financiación · ${data.año}`, 3, totalPages);
  y = 48;
  y = drawSectionTitle(doc, y, 'KPIs de cartera');
  y = drawKpiRow(doc, y, [
    { label: 'Valor total', value: fmtEur(portfolioValue), sub: 'Valor de activos', color: COLOR.navy },
    { label: 'Deuda hipotecaria', value: fmtEur(data.resumenCartera.deudaHipotecaria), sub: 'Capital vivo', color: COLOR.amber },
    { label: 'Equity', value: fmtEur(data.resumenCartera.equity), sub: 'Valor neto', color: COLOR.green },
    { label: 'Renta mensual', value: fmtEur(data.resumenCartera.rentaMensualTotal), sub: 'Ingresos alquiler', color: COLOR.teal },
    { label: 'Yield bruta', value: fmtPct(data.resumenCartera.yieldBruta), sub: 'Renta / coste', color: COLOR.green },
  ]);
  y = drawKpiRow(doc, y, [
    { label: 'LTV', value: fmtPct(data.resumenCartera.ltv), sub: 'Deuda / valor', color: data.resumenCartera.ltv <= 50 ? COLOR.green : COLOR.amber },
  ]);

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
    foot: [[
      'TOTAL',
      '',
      fmtEur(data.resumenCartera.costeTotal),
      fmtEur(data.resumenCartera.valorTotal),
      fmtEur(data.resumenCartera.plusvaliaTotal),
      fmtEur(data.resumenCartera.rentaMensualTotal),
      fmtPct(data.resumenCartera.yieldBruta),
      fmtEur(data.resumenFinanciacion.cuotaHipotecasMensual),
      fmtEur(data.resumenCartera.cfMensualTotal),
      '',
    ]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.1, cellPadding: 1.8, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    footStyles: { fillColor: COLOR.graylt, textColor: COLOR.gray1, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 8) {
        const value = data.inmuebles[hookData.row.index]?.cfNeto ?? 0;
        hookData.cell.styles.textColor = value >= 0 ? COLOR.green : COLOR.red;
        hookData.cell.styles.fontStyle = 'bold';
      }
      if (hookData.section === 'body' && hookData.column.index === 9) {
        const estado = String(data.inmuebles[hookData.row.index]?.estado ?? '').toLowerCase();
        hookData.cell.styles.textColor = estado === 'activo' ? COLOR.green : COLOR.gray2;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const afterPortfolio = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  autoTable(doc, {
    startY: afterPortfolio + 6,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [[ 'Nombre', 'Tipo', 'Capital vivo', 'Cuota mensual', 'TIN', 'Vencimiento' ]],
    body: data.prestamos.map((prestamo) => [
      prestamo.nombre,
      prestamo.tipo,
      fmtEur(prestamo.capitalVivo),
      fmtEur(prestamo.cuotaMensual),
      fmtPct(prestamo.tin),
      parseIsoDate(prestamo.fechaFin),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
  });
  drawFooter(doc);

  doc.save(`ATLAS_Informe_Solvencia_${data.año}.pdf`);
}
