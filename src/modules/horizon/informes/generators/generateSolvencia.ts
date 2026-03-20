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
  thresholdText?: string,
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
  doc.text(`Ref. ${thresholdText ?? (lowerIsBetter ? `max. ${fmtPct(threshold)}` : `min. ${threshold.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`)}`, x, y + 11);
  return y + 16;
};

const drawCover = (doc: jsPDF, data: InformesData, dti: number): void => {
  doc.setFillColor(...COLOR.navy);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFillColor(...COLOR.teal);
  doc.rect(0, 0, 210, 3, 'F');

  doc.setFillColor(...COLOR.teal);
  doc.rect(0, 294, 210, 3, 'F');

  doc.setFillColor(11, 61, 122);
  doc.triangle(0, 297, 115, 297, 0, 100, 'F');

  const lx = 18;
  const ly = 40;
  const lw = 30;
  const lh = 30;
  doc.setFillColor(26, 74, 130);
  doc.triangle(lx + lw / 2, ly, lx, ly + lh, lx + lw, ly + lh, 'F');
  const crossY = ly + lh * 0.52;
  const crossXL = lx + lw / 2 - (lw / 2) * (1 - 0.52) * 0.9;
  const crossXR = lx + lw / 2 + (lw / 2) * (1 - 0.52) * 0.9;
  doc.setFillColor(...COLOR.teal);
  doc.rect(crossXL, crossY - 1, crossXR - crossXL, 2, 'F');
  doc.circle(lx + lw / 2, ly, 1.5, 'F');

  doc.setTextColor(...COLOR.white);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('ATLAS', 18, ly + lh + 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR.teal);
  doc.text('HORIZON & PULSE', 18, ly + lh + 19);

  doc.setDrawColor(...COLOR.teal);
  doc.setLineWidth(0.5);
  doc.line(18, ly + lh + 23, 108, ly + lh + 23);

  doc.setTextColor(...COLOR.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Informe de Solvencia', 18, ly + lh + 32);
  doc.text('y Capacidad Financiera', 18, ly + lh + 40);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 184, 212);
  doc.text(`Ejercicio ${data.año}  -  ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`, 18, ly + lh + 48);

  const bx = 115;
  const by = 80;
  const bw = 80;
  const bh = 60;
  doc.setFillColor(11, 61, 122);
  doc.roundedRect(bx, by, bw, bh, 3, 3, 'F');
  doc.setDrawColor(...COLOR.teal);
  doc.setLineWidth(0.3);
  doc.roundedRect(bx, by, bw, bh, 3, 3, 'S');
  doc.setTextColor(...COLOR.teal);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('TITULAR', bx + 4, by + 7);
  doc.setTextColor(...COLOR.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(data.personal.nombreCompleto || 'José Antonio Gómez', bx + 4, by + 14);

  const fields: Array<[string, string]> = [
    ['Empresa', data.personal.empresa || 'No disponible'],
    ['Actividad', 'Gestor de patrimonio inmobiliario'],
    ['Cartera', `${data.inmuebles.filter((i) => i.estado !== 'VENDIDO').length} inmuebles activos`],
    ['Sistema', 'ATLAS Horizon & Pulse'],
  ];
  let fy = by + 21;
  fields.forEach(([label, value]) => {
    doc.setTextColor(160, 184, 212);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(label, bx + 4, fy);
    doc.setTextColor(...COLOR.white);
    doc.setFontSize(6.5);
    doc.text(value, bx + 28, fy);
    fy += 5;
  });

  const kpisPortada = [
    { label: 'Ingresos anuales', value: fmtEur(data.proyeccion.totalesAnuales.ingresosTotales), sub: `Ejercicio ${data.año}`, color: COLOR.teal },
    { label: 'Patrimonio neto', value: fmtEur(data.proyeccion.meses[11]?.patrimonioNeto ?? 0), sub: 'Cierre diciembre', color: COLOR.green },
    { label: 'DTI mensual', value: fmtPct(dti), sub: 'Cuotas / ingreso', color: COLOR.amber },
    { label: 'Flujo libre', value: fmtEur(data.proyeccion.totalesAnuales.flujoNeto), sub: 'Caja generada anual', color: COLOR.navy },
  ];
  const ky = 220;
  const kh = 22;
  const kw = (210 - 36 - 9) / 4;
  kpisPortada.forEach((k, i) => {
    const kx = 18 + i * (kw + 3);
    doc.setFillColor(11, 61, 122);
    doc.roundedRect(kx, ky, kw, kh, 2, 2, 'F');
    doc.setFillColor(...k.color);
    doc.roundedRect(kx, ky, 2.5, kh, 1, 1, 'F');
    doc.rect(kx + 1, ky, 1.5, kh, 'F');
    doc.setTextColor(160, 184, 212);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(k.label.toUpperCase(), kx + 4.5, ky + 5.5);
    doc.setTextColor(...COLOR.white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(k.value, kx + 4.5, ky + 12);
    doc.setTextColor(...k.color);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(k.sub, kx + 4.5, ky + 19);
  });

  doc.setTextColor(90, 122, 154);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Documento confidencial preparado con datos reales del sistema ATLAS  -  No distribuir sin autorización', 105, 290, { align: 'center' });
};

export async function generateSolvencia(data: InformesData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
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

  drawCover(doc, data, dti);

  doc.addPage();
  drawHeader(doc, 'Informe de Solvencia y Capacidad Financiera', `Perfil financiero - ${data.año}`, 2, 3);
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
  y = drawProgress(doc, y, 'DTI', fmtPct(dti), dti, 43, true, 'max. 43,00%');
  y = drawProgress(doc, y, 'LTV hipotecario', fmtPct(ltv), ltv, 50, true, 'max. 50,00%');
  y = drawProgress(doc, y, 'DSCR', `${dscr.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`, dscr, 1.25, false, 'min. 1,25x');
  y = drawProgress(doc, y, 'Tasa de ahorro', fmtPct(ahorro), ahorro, 10, false, 'min. 10,00%');

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

  const afterIncomeTable =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 2;

  const pageHeight = doc.internal.pageSize.getHeight();
  const footerReserve = 18;
  const spaceNeeded = 88;
  const spaceAvailable = pageHeight - afterIncomeTable - footerReserve;
  const needsExtraPage = spaceAvailable < spaceNeeded;

  const totalPages = needsExtraPage ? 4 : 3;

  if (needsExtraPage) {
    drawHeader(doc, 'Informe de Solvencia y Capacidad Financiera', `Perfil financiero - ${data.año}`, 2, totalPages);
  }

  let monthlyStartY: number;

  if (needsExtraPage) {
    drawFooter(doc);
    doc.addPage();
    drawHeader(doc, 'Informe de Solvencia y Capacidad Financiera', `Perfil financiero - ${data.año}`, 3, totalPages);
    monthlyStartY = 48;
  } else {
    monthlyStartY = afterIncomeTable + 6;
  }

  autoTable(doc, {
    startY: monthlyStartY,
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
    pageBreak: 'avoid',
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
  const carteraPage = needsExtraPage ? 4 : 3;
  drawHeader(doc, 'Informe de Solvencia y Capacidad Financiera', `Cartera y financiación - ${data.año}`, carteraPage, totalPages);
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
