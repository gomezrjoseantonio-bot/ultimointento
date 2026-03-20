import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { COLOR, drawFooter, drawHeader, drawKpiRow, drawSectionTitle, fmtEur, fmtPct, parseIsoDate } from './pdfHelpers';

const PAGE_MARGIN = 14;

type PrestamoInforme = InformesData['prestamos'][number];
type VencimientoAnual = { año: number; prestamosVencen: string[]; capitalLiberado: number; cuotaLiberada: number };


const getLastAutoTableY = (doc: jsPDF, fallback: number): number => {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
};

const monthDiff = (from: Date, to: Date): number => {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
};


const monthsActiveInYear = (fechaFin: string, year: number): number => {
  const fin = new Date(fechaFin);
  if (Number.isNaN(fin.getTime())) return 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  if (year < currentYear) return 0;

  const startMonth = year === currentYear ? now.getMonth() + 1 : 1;
  const endMonth = fin.getFullYear() === year ? fin.getMonth() + 1 : 12;
  return Math.max(0, endMonth - startMonth + 1);
};


export async function generatePrestamos(data: InformesData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const hipotecas = data.prestamos.filter((p) => p.tipo === 'Hipoteca');
  const personales = data.prestamos.filter((p) => p.tipo !== 'Hipoteca');
  const deudaHipotecaria = hipotecas.reduce((s, p) => s + p.capitalVivo, 0);
  const deudaPersonal = personales.reduce((s, p) => s + p.capitalVivo, 0);
  const cuotaHip = hipotecas.reduce((s, p) => s + p.cuotaMensual, 0);
  const cuotaPers = personales.reduce((s, p) => s + p.cuotaMensual, 0);
  const deudaTotal = data.resumenFinanciacion.deudaTotal;
  const cuotaTotal = data.resumenFinanciacion.totalCuotasMensual;

  const ahora = new Date();
  const calcularMesesRestantes = (fechaFin: string): number => {
    const fin = new Date(fechaFin);
    if (Number.isNaN(fin.getTime()) || fin <= ahora) return 0;
    return Math.max(0, monthDiff(ahora, fin));
  };
  const calcularInteresesPendientes = (p: PrestamoInforme): number => {
    const meses = calcularMesesRestantes(p.fechaFin);
    return Math.max(0, p.cuotaMensual * meses - p.capitalVivo);
  };
  const totalInteresesPendientes = data.prestamos.reduce(
    (s, p) => s + calcularInteresesPendientes(p), 0,
  );

  const ingresosMensuales = data.proyeccion.totalesAnuales.ingresosTotales / 12;
  const dti = ingresosMensuales > 0 ? (cuotaTotal / ingresosMensuales) * 100 : 0;
  const weightedTerm = deudaTotal > 0
    ? data.prestamos.reduce((sum, p) => sum + calcularMesesRestantes(p.fechaFin) * p.capitalVivo, 0) / deudaTotal
    : 0;

  const hipotecasIntereses = hipotecas.reduce((sum, p) => sum + calcularInteresesPendientes(p), 0);
  const personalesIntereses = personales.reduce((sum, p) => sum + calcularInteresesPendientes(p), 0);

  drawHeader(doc, 'Informe de Préstamos y Financiación', `Resumen - ${data.año}`, 1, 3);
  let y = 46;

  y = drawKpiRow(doc, y, [
    { label: 'Deuda hipotecaria', value: fmtEur(deudaHipotecaria), sub: `${hipotecas.length} préstamos`, color: COLOR.navy },
    { label: 'Deuda personal', value: fmtEur(deudaPersonal), sub: `${personales.length} préstamos`, color: COLOR.gray2 },
    {
      label: 'Deuda total',
      value: fmtEur(deudaTotal),
      sub: 'Capital vivo agregado',
      color: deudaTotal > 300000 ? COLOR.red : deudaTotal > 100000 ? COLOR.amber : COLOR.green,
    },
    { label: 'Cuota mensual total', value: fmtEur(cuotaTotal), sub: 'Servicio de deuda', color: COLOR.teal },
    {
      label: 'Intereses pend. estimados',
      value: fmtEur(totalInteresesPendientes),
      sub: 'Cálculo orientativo',
      color: COLOR.amber,
    },
  ]);

  y = drawKpiRow(doc, y, [
    { label: 'Cuota hipotecas/mes', value: fmtEur(cuotaHip), sub: 'Hipotecas activas', color: COLOR.navy },
    { label: 'Cuota préstamos/mes', value: fmtEur(cuotaPers), sub: 'Préstamos personales', color: COLOR.gray2 },
    {
      label: '% cuotas s/ingresos (DTI)',
      value: fmtPct(dti),
      sub: ingresosMensuales > 0 ? `Sobre ${fmtEur(ingresosMensuales)}/mes` : 'Sin ingresos informados',
      color: dti < 35 ? COLOR.green : dti <= 43 ? COLOR.amber : COLOR.red,
    },
    {
      label: 'Plazo medio ponderado',
      value: `${weightedTerm.toFixed(1)} meses`,
      sub: 'Ponderado por capital vivo',
      color: COLOR.teal,
    },
  ]);

  y = drawSectionTitle(doc, y, 'Resumen por tipo');
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 18 },
    head: [['Tipo', 'Nº préstamos', 'Capital vivo', 'Cuota/mes', 'Intereses pend.']],
    body: [
      ['Hipotecas', String(hipotecas.length), fmtEur(deudaHipotecaria), fmtEur(cuotaHip), fmtEur(hipotecasIntereses)],
      ['Préstamos personales', String(personales.length), fmtEur(deudaPersonal), fmtEur(cuotaPers), fmtEur(personalesIntereses)],
    ],
    foot: [[
      'TOTAL',
      String(data.prestamos.length),
      fmtEur(deudaTotal),
      fmtEur(cuotaTotal),
      fmtEur(totalInteresesPendientes),
    ]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.1, cellPadding: 2.2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    footStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR.graylt },
  });

  y = getLastAutoTableY(doc, y) + 8;
  y = drawSectionTitle(doc, y, 'Préstamos activos');

  const prestamosRows = data.prestamos.length > 0
    ? data.prestamos.map((p) => [
      p.nombre,
      p.tipo,
      fmtEur(p.capitalVivo),
      fmtEur(p.cuotaMensual),
      fmtPct(p.tin),
      parseIsoDate(p.fechaFin),
      String(calcularMesesRestantes(p.fechaFin)),
      fmtEur(calcularInteresesPendientes(p)),
    ])
    : [['No hay préstamos activos para este ejercicio', '', '', '', '', '', '', '']];

  autoTable(doc, {
    startY: y,
    margin: { left: 9, right: 9, bottom: 20 },
    head: [['Nombre', 'Tipo', 'Capital vivo', 'Cuota/mes', 'TIN %', 'Vencimiento', 'Meses rest.', 'Intereses pend.']],
    body: prestamosRows,
    foot: data.prestamos.length > 0
      ? [[
        'TOTAL',
        '',
        fmtEur(deudaTotal),
        fmtEur(cuotaTotal),
        '',
        '',
        '',
        fmtEur(totalInteresesPendientes),
      ]]
      : undefined,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.2, cellPadding: 1.7, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    footStyles: { fillColor: COLOR.graylt, textColor: COLOR.gray1, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') {
        if (hookData.section === 'foot' && hookData.column.index === 7) {
          hookData.cell.styles.textColor = COLOR.red;
        }
        return;
      }

      if (data.prestamos.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }

      if (hookData.column.index === 4) {
        const tin = data.prestamos[hookData.row.index]?.tin ?? 0;
        hookData.cell.styles.textColor = tin < 3 ? COLOR.green : tin <= 5 ? COLOR.amber : COLOR.red;
      }
      if (hookData.column.index === 7) {
        hookData.cell.styles.textColor = COLOR.red;
      }
    },
  });
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Informe de Préstamos y Financiación', `Calendario de vencimientos y coste anual - ${data.año}`, 2, 3);
  y = 48;

  y = drawSectionTitle(doc, y, 'Calendario de vencimientos');
  const currentYear = ahora.getFullYear();
  const maxYear = data.prestamos.reduce((max, p) => {
    const year = new Date(p.fechaFin).getFullYear();
    return Number.isFinite(year) ? Math.max(max, year) : max;
  }, currentYear);
  const lastYear = Math.min(maxYear, currentYear + 9);

  const vencimientos: VencimientoAnual[] = [];
  for (let year = currentYear; year <= lastYear; year += 1) {
    const prestamosAno = data.prestamos.filter((p) => {
      const fin = new Date(p.fechaFin);
      return !Number.isNaN(fin.getTime()) && fin.getFullYear() === year;
    });
    if (prestamosAno.length > 0) {
      vencimientos.push({
        año: year,
        prestamosVencen: prestamosAno.map((p) => p.nombre),
        capitalLiberado: prestamosAno.reduce((sum, p) => sum + p.capitalVivo, 0),
        cuotaLiberada: prestamosAno.reduce((sum, p) => sum + p.cuotaMensual, 0),
      });
    }
  }
  vencimientos.push({ año: lastYear + 1, prestamosVencen: [], capitalLiberado: 0, cuotaLiberada: 0 });

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Año', 'Préstamos que vencen', 'Capital liberado', 'Cuota liberada/mes', 'Cuota total restante']],
    body: vencimientos.map((fila) => {
      const cuotaLiberadaHastaAno = vencimientos
        .filter((item) => item.año <= fila.año)
        .reduce((sum, item) => sum + item.cuotaLiberada, 0);
      return [
        String(fila.año),
        fila.prestamosVencen.length > 0 ? fila.prestamosVencen.join(', ') : '—',
        fmtEur(fila.capitalLiberado),
        fmtEur(fila.cuotaLiberada),
        fmtEur(Math.max(cuotaTotal - cuotaLiberadaHastaAno, 0)),
      ];
    }),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.7, cellPadding: 2.2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      const fila = vencimientos[hookData.row.index];
      if (!fila) return;
      if (fila.año === currentYear || fila.año === currentYear + 1) {
        hookData.cell.styles.fillColor = COLOR.graylt;
      }
    },
  });

  y = getLastAutoTableY(doc, y) + 8;
  y = drawSectionTitle(doc, y, 'Coste anual de financiación');

  const annualCostRows = Array.from({ length: 6 }, (_, index) => currentYear + index).map((year) => {
    const cuotasHipotecas = hipotecas.reduce((sum, p) => sum + monthsActiveInYear(p.fechaFin, year) * p.cuotaMensual, 0);
    const cuotasPrestamos = personales.reduce((sum, p) => sum + monthsActiveInYear(p.fechaFin, year) * p.cuotaMensual, 0);
    const total = cuotasHipotecas + cuotasPrestamos;
    const ratio = data.proyeccion.totalesAnuales.ingresosTotales > 0
      ? (total / data.proyeccion.totalesAnuales.ingresosTotales) * 100
      : 0;
    return { year, cuotasHipotecas, cuotasPrestamos, total, ratio };
  });

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Año', 'Cuotas hipotecas', 'Cuotas préstamos', 'Total cuotas', '% s/ingresos anuales']],
    body: annualCostRows.map((row) => [
      String(row.year),
      fmtEur(row.cuotasHipotecas),
      fmtEur(row.cuotasPrestamos),
      fmtEur(row.total),
      fmtPct(row.ratio),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.1, cellPadding: 2.3, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 4) return;
      const ratio = annualCostRows[hookData.row.index]?.ratio ?? 0;
      hookData.cell.styles.textColor = ratio < 35 ? COLOR.green : ratio <= 43 ? COLOR.amber : COLOR.red;
    },
  });
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Informe de Préstamos y Financiación', `Estrategia de cancelación anticipada - ${data.año}`, 3, 3);
  y = 48;

  y = drawSectionTitle(doc, y, 'Análisis de cancelación anticipada');
  const ahorroSiCancela = (p: PrestamoInforme) => {
    const meses = calcularMesesRestantes(p.fechaFin);
    const totalPagar = p.cuotaMensual * meses;
    const ahorroIntereses = Math.max(0, totalPagar - p.capitalVivo);
    const comisionEstimada = p.capitalVivo * 0.005;
    return { totalPagar, ahorroIntereses, comisionEstimada, ahorroNeto: ahorroIntereses - comisionEstimada };
  };

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Préstamo', 'Capital vivo', 'Total a pagar', 'Ahorro intereses', 'Comisión est.', 'Ahorro neto']],
    body: data.prestamos.length > 0
      ? data.prestamos.map((p) => {
        const ahorro = ahorroSiCancela(p);
        return [
          p.nombre,
          fmtEur(p.capitalVivo),
          fmtEur(ahorro.totalPagar),
          fmtEur(ahorro.ahorroIntereses),
          fmtEur(ahorro.comisionEstimada),
          fmtEur(ahorro.ahorroNeto),
        ];
      })
      : [['No hay préstamos activos para analizar', '', '', '', '', '']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      if (data.prestamos.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }
      if (hookData.column.index === 5) {
        const ahorro = data.prestamos[hookData.row.index] ? ahorroSiCancela(data.prestamos[hookData.row.index] as PrestamoInforme).ahorroNeto : 0;
        hookData.cell.styles.textColor = ahorro > 0 ? COLOR.green : COLOR.gray1;
      }
    },
  });

  y = getLastAutoTableY(doc, y) + 8;
  y = drawSectionTitle(doc, y, 'Orden recomendado de cancelación');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR.gray1);
  doc.text(
    'Estrategia avalanche: cancelar primero el préstamo con mayor TIN reduce el coste total de intereses. Con tu deuda actual, el orden óptimo es:',
    PAGE_MARGIN,
    y,
    { maxWidth: doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2 },
  );
  y += 10;

  const ordenAvalancha = [...data.prestamos].sort((a, b) => b.tin - a.tin);
  if (ordenAvalancha.length > 0) {
    ordenAvalancha.forEach((prestamo, index) => {
      doc.text(
        `${index + 1}. ${prestamo.nombre} — ${fmtPct(prestamo.tin)} TIN — ${fmtEur(calcularInteresesPendientes(prestamo))} intereses pend.`,
        PAGE_MARGIN,
        y,
      );
      y += 5.5;
    });
  } else {
    doc.setTextColor(...COLOR.gray2);
    doc.text('No hay préstamos activos para ordenar.', PAGE_MARGIN, y);
    y += 5.5;
  }

  y += 4;
  y = drawSectionTitle(doc, y, 'Escenario de amortización acelerada');

  const prestamoObjetivo = ordenAvalancha[0] ?? null;
  const extraMensual = 500;
  const escenarioAcelerado = (() => {
    if (!prestamoObjetivo) {
      return null;
    }
    const mesesActuales = calcularMesesRestantes(prestamoObjetivo.fechaFin);
    const cuotaAcelerada = prestamoObjetivo.cuotaMensual + extraMensual;
    const mesesAcelerados = cuotaAcelerada > 0
      ? Math.ceil(prestamoObjetivo.capitalVivo / cuotaAcelerada)
      : mesesActuales;
    const interesesActuales = calcularInteresesPendientes(prestamoObjetivo);
    const interesesAcelerados = Math.max(0, cuotaAcelerada * mesesAcelerados - prestamoObjetivo.capitalVivo);
    return {
      mesesActuales,
      mesesAcelerados,
      mesesAhorrados: Math.max(mesesActuales - mesesAcelerados, 0),
      interesesAhorrados: Math.max(interesesActuales - interesesAcelerados, 0),
    };
  })();

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 32 },
    head: [['Préstamo objetivo', 'Capital vivo', 'Con amortización extra 500€/mes', 'Meses ahorrados', 'Intereses ahorrados']],
    body: prestamoObjetivo && escenarioAcelerado
      ? [[
        prestamoObjetivo.nombre,
        fmtEur(prestamoObjetivo.capitalVivo),
        `${escenarioAcelerado.mesesAcelerados} meses (${fmtEur(prestamoObjetivo.cuotaMensual + extraMensual)}/mes)`,
        String(escenarioAcelerado.mesesAhorrados),
        fmtEur(escenarioAcelerado.interesesAhorrados),
      ]]
      : [['No hay préstamos activos para simular', '', '', '', '']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.1, cellPadding: 2.3, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      if (!prestamoObjetivo && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }
      if (hookData.column.index === 4) {
        hookData.cell.styles.textColor = COLOR.green;
      }
    },
  });

  const legalY = Math.min(getLastAutoTableY(doc, y) + 9, doc.internal.pageSize.getHeight() - 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.gray2);
  doc.text(
    'Los cálculos de intereses pendientes son estimaciones basadas en el sistema francés. La comisión de cancelación anticipada puede variar según contrato. Consultar con la entidad antes de cualquier operación.',
    PAGE_MARGIN,
    legalY,
    { maxWidth: doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2 },
  );

  drawFooter(doc);
  doc.save(`ATLAS_Prestamos_${data.año}.pdf`);
}
