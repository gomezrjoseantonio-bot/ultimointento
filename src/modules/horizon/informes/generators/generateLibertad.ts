import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { initDB } from '../../../../services/db';
import { COLOR, drawFooter, drawHeader, drawKpiRow, drawSectionTitle, fmtEur, fmtPct } from './pdfHelpers';

const PAGE_MARGIN = 14;
const MAX_MESES = 600;
const RENTABILIDAD_NETA_ESTIMADA = 0.06;
const COSTE_ENTRADA_PISO = 80_000;

type HitoLibertad = { mes: number; evento: string; nuevoCashflow: number };
type Escenario = { rentabilidad: number; objetivo: number; meses: number; pisos: number };

const getLastAutoTableY = (doc: jsPDF, fallback: number): number => {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
};

const addMonths = (base: Date, months: number): Date => {
  const copy = new Date(base.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
};

const formatMonthYear = (date: Date | null): string => {
  if (!date) return '—';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

export async function generateLibertad(data: InformesData): Promise<void> {
  const objetivos = await getObjetivos();
  const OBJETIVO_MENSUAL = objetivos.rentaPasivaObjetivo;
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  let objetivoMensual = 5_000;

  try {
    const db = await initDB();
    const objetivoGuardado = await db.get('objetivos_financieros', 1).catch(() => null);
    if (objetivoGuardado && typeof (objetivoGuardado as { rentaPasivaObjetivo?: unknown }).rentaPasivaObjetivo === 'number') {
      objetivoMensual = (objetivoGuardado as { rentaPasivaObjetivo: number }).rentaPasivaObjetivo;
    }
  } catch {
    // Usar el valor por defecto si el store aún no existe o no está disponible.
  }

  const cfInmueblesMensual = data.resumenCartera.cfMensualTotal;
  const ahorroMensualTotal = (data.proyeccion.totalesAnuales.ingresosTotales -
    data.proyeccion.totalesAnuales.gastosTotales -
    data.proyeccion.totalesAnuales.financiacionTotal) / 12;
  const capitalLiquido = data.proyeccion.meses[11]?.cajaFinal ?? 0;
  const ingresoMensualActual = data.proyeccion.totalesAnuales.ingresosTotales / 12;

  const simularBolaNieve = (
    objetivo: number,
    cfActual: number,
    ahorroMensualNomina: number,
    capitalInicial: number,
    costeEntrada: number,
    rentabilidadNetaAnual: number,
  ): { meses: number; pisosComprados: number; hitos: HitoLibertad[]; logrado: boolean } => {
    const rentabilidadMensual = (costeEntrada * rentabilidadNetaAnual) / 12;
    let meses = 0;
    let cashflow = Math.max(cfActual, 0);
    let capital = Math.max(capitalInicial, 0);
    let pisos = 0;
    const hitos: HitoLibertad[] = [];
    while (cashflow < objetivo && meses < MAX_MESES) {
      meses += 1;
      capital += Math.max(ahorroMensualNomina, 0) + cashflow;
      while (capital >= costeEntrada && costeEntrada > 0) {
        pisos += 1;
        capital -= costeEntrada;
        cashflow += rentabilidadMensual;
        hitos.push({ mes: meses, evento: `Inmueble #${pisos}`, nuevoCashflow: cashflow });
      }
    }
    return { meses, pisosComprados: pisos, hitos, logrado: cashflow >= objetivo };
  };

  const ahorroMensualNomina = Math.max(ahorroMensualTotal - cfInmueblesMensual, 0);
  const simulacion = simularBolaNieve(
    objetivoMensual,
    cfInmueblesMensual,
    ahorroMensualNomina,
    capitalLiquido,
    COSTE_ENTRADA_PISO,
    RENTABILIDAD_NETA_ESTIMADA,
  );
  const añosLibertad = simulacion.meses / 12;
  const fechaLibertad = simulacion.logrado
    ? (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + simulacion.meses);
      return d;
    })()
    : null;

  const progresoActual = objetivoMensual > 0 ? Math.max(0, (cfInmueblesMensual / objetivoMensual) * 100) : 0;
  const progresoCapped = Math.min(progresoActual, 100);

  drawHeader(doc, 'Proyección de Libertad Financiera', 'Situación actual y hoja de ruta', 1, 2);
  let y = 46;

  y = drawKpiRow(doc, y, [
    {
      label: 'CF inmuebles/mes',
      value: fmtEur(cfInmueblesMensual),
      sub: 'Cash flow neto actual',
      color: cfInmueblesMensual >= 0 ? COLOR.green : COLOR.red,
    },
    {
      label: 'Ahorro mensual total',
      value: fmtEur(ahorroMensualTotal),
      sub: `Ingresos actuales ${fmtEur(ingresoMensualActual)}/mes`,
      color: COLOR.navy,
    },
    { label: 'Capital líquido', value: fmtEur(capitalLiquido), sub: 'Caja disponible', color: COLOR.teal },
    { label: 'Objetivo mensual (ref.)', value: fmtEur(objetivoMensual), sub: 'Renta pasiva objetivo', color: COLOR.teal },
  ]);

  y = drawKpiRow(doc, y, [
    { label: 'Años para libertad', value: `${añosLibertad.toFixed(1)} años`, sub: `${simulacion.meses} meses`, color: COLOR.navy },
    { label: 'Inmuebles a comprar', value: String(simulacion.pisosComprados), sub: 'Según escenario base', color: COLOR.teal },
    {
      label: 'Progreso actual',
      value: fmtPct(progresoActual, 1),
      sub: `${fmtEur(cfInmueblesMensual)} / ${fmtEur(objetivoMensual)}`,
      color: progresoActual > 80 ? COLOR.green : progresoActual > 40 ? COLOR.amber : COLOR.red,
    },
    {
      label: 'Fecha estimada',
      value: simulacion.logrado ? formatMonthYear(fechaLibertad) : 'No alcanzable',
      sub: simulacion.logrado ? 'Escenario base' : 'Objetivo no alcanzable con los parámetros actuales',
      color: simulacion.logrado ? COLOR.teal : COLOR.red,
    },
  ]);

  y = drawSectionTitle(doc, y, 'Progreso hacia el objetivo mensual');
  const pageWidth = doc.internal.pageSize.getWidth();
  const barWidth = pageWidth - 28;
  const barX = PAGE_MARGIN;
  const barY = y + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.gray1);
  doc.text(
    `${fmtPct(progresoActual, 1)} de tu objetivo mensual (${fmtEur(cfInmueblesMensual)} / ${fmtEur(objetivoMensual)})`,
    barX,
    y,
  );
  doc.setFillColor(...COLOR.graylt);
  doc.setDrawColor(...COLOR.graybd);
  doc.rect(barX, barY, barWidth, 6, 'FD');
  if (progresoCapped > 0) {
    doc.setFillColor(...COLOR.green);
    doc.rect(barX, barY, (barWidth * progresoCapped) / 100, 6, 'F');
  }
  y = barY + 12;

  y = drawSectionTitle(doc, y, 'Hitos de la simulación');
  const hitosMostrados = simulacion.hitos.slice(0, 15);
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Hito', 'Mes', 'Fecha estimada', 'Inmueble', 'CF tras hito']],
    body: hitosMostrados.length > 0
      ? hitosMostrados.map((h, i) => [
        String(i + 1),
        String(h.mes),
        formatMonthYear(addMonths(new Date(), h.mes)),
        h.evento,
        fmtEur(h.nuevoCashflow),
      ])
      : [['Sin hitos de compra con los parámetros actuales', '', '', '', '']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      if (hitosMostrados.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }
      if (hookData.column.index === 4) {
        hookData.cell.styles.textColor = COLOR.green;
      }
    },
  });

  if (simulacion.hitos.length > 15) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.gray2);
    doc.text(
      `... y ${simulacion.hitos.length - 15} hitos adicionales hasta alcanzar el objetivo.`,
      PAGE_MARGIN,
      getLastAutoTableY(doc, y) + 7,
    );
  }
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Proyección de Libertad Financiera', 'Escenarios y análisis de sensibilidad', 2, 2);
  y = 48;

  y = drawSectionTitle(doc, y, 'Escenarios comparativos');
  const escenarios: Escenario[] = [];
  for (const rent of [0.04, 0.06, 0.08]) {
    for (const obj of [2000, 3000, 5000]) {
      const sim = simularBolaNieve(obj, cfInmueblesMensual, ahorroMensualNomina, capitalLiquido, COSTE_ENTRADA_PISO, rent);
      escenarios.push({ rentabilidad: rent * 100, objetivo: obj, meses: sim.meses, pisos: sim.pisosComprados });
    }
  }

  const objetivosTabla = [2000, 3000, 5000];
  const rentabilidades = [4, 6, 8];
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Objetivo \\ Rentabilidad neta', '4%', '6%', '8%']],
    body: objetivosTabla.map((objetivo) => [
      `${new Intl.NumberFormat('es-ES').format(objetivo)} €/mes`,
      ...rentabilidades.map((rentabilidad) => {
        const escenario = escenarios.find((item) => item.objetivo === objetivo && item.rentabilidad === rentabilidad);
        if (!escenario) return '—';
        return `${(escenario.meses / 12).toFixed(1)} años (${escenario.pisos} pisos)`;
      }),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.3, cellPadding: 2.4, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.row.index === 1 && hookData.column.index === 2) {
        hookData.cell.styles.fillColor = COLOR.graylt;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = getLastAutoTableY(doc, y) + 10;
  y = drawSectionTitle(doc, y, 'Palancas de aceleración');

  const simMasAhorro = simularBolaNieve(
    objetivoMensual,
    cfInmueblesMensual,
    ahorroMensualNomina + 100,
    capitalLiquido,
    COSTE_ENTRADA_PISO,
    RENTABILIDAD_NETA_ESTIMADA,
  );
  const simMasRentabilidad = simularBolaNieve(
    objetivoMensual,
    cfInmueblesMensual,
    ahorroMensualNomina,
    capitalLiquido,
    COSTE_ENTRADA_PISO,
    0.08,
  );
  const simMenorEntrada = simularBolaNieve(
    objetivoMensual,
    cfInmueblesMensual,
    ahorroMensualNomina,
    capitalLiquido,
    60_000,
    RENTABILIDAD_NETA_ESTIMADA,
  );
  const mesesBase = simulacion.meses;

  const blocks: Array<{ color: [number, number, number]; title: string; text: string }> = [
    {
      color: COLOR.teal,
      title: 'Aumentar el ahorro mensual destinado a inmuebles',
      text: `Cada 100 € adicionales de ahorro mensual reduce el plazo estimado en ~${Math.max(mesesBase - simMasAhorro.meses, 0)} meses.`,
    },
    {
      color: COLOR.green,
      title: 'Mejorar la rentabilidad neta de la cartera',
      text: `Subir de 6% a 8% neto reduce el plazo estimado en ~${Math.max(mesesBase - simMasRentabilidad.meses, 0)} meses.`,
    },
    {
      color: COLOR.amber,
      title: 'Reducir el coste medio de entrada por activo',
      text: `Bajar el coste de entrada de 80.000€ a 60.000€ reduce el plazo en ~${Math.max(mesesBase - simMenorEntrada.meses, 0)} meses.`,
    },
  ];

  blocks.forEach((block) => {
    doc.setDrawColor(...COLOR.graybd);
    doc.setFillColor(...COLOR.white);
    doc.roundedRect(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN * 2, 17, 2, 2, 'FD');
    doc.setFillColor(...block.color);
    doc.rect(PAGE_MARGIN, y, 3, 17, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.gray1);
    doc.text(block.title, PAGE_MARGIN + 6, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(...COLOR.gray2);
    doc.text(block.text, PAGE_MARGIN + 6, y + 11.5, { maxWidth: pageWidth - PAGE_MARGIN * 2 - 10 });
    y += 21;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.gray2);
  doc.text(
    'Simulación basada en el algoritmo de bola de nieve inmobiliaria de ATLAS Herramientas. Hipótesis: rentabilidad neta constante, reinversión total del CF, coste de entrada fijo. No contempla inflación, cambios fiscales, vacíos ni gastos extraordinarios. Uso exclusivamente orientativo para planificación personal.',
    PAGE_MARGIN,
    Math.min(y + 3, doc.internal.pageSize.getHeight() - 24),
    { maxWidth: pageWidth - PAGE_MARGIN * 2 },
  );

  drawFooter(doc);
  doc.save(`ATLAS_Libertad_Financiera_${data.año}.pdf`);
}
