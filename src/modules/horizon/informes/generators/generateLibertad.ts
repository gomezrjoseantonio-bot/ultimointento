import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { getObjetivos } from '../../../../services/objetivosService';
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
  const objetivoMensual = Math.max(await getObjetivos().then((o) => o.rentaPasivaObjetivo), 3_000);
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });

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

  const roundTo = (n: number, multiple: number): number => Math.ceil(n / multiple) * multiple;

  const hito1Raw = objetivoMensual / 3;
  const hito2Raw = (objetivoMensual * 2) / 3;

  const redondeo = objetivoMensual >= 50_000 ? 5_000 : objetivoMensual >= 10_000 ? 1_000 : 500;

  const hito1 = Math.max(roundTo(hito1Raw, redondeo), redondeo);
  const hito2 = Math.max(roundTo(hito2Raw, redondeo), hito1 + redondeo);
  const hito3 = objetivoMensual;

  const objetivosTabla = [hito1, hito2, hito3];
  const rentabilidades = [4, 6, 8];

  const escenarios: Escenario[] = [];
  for (const rent of [0.04, 0.06, 0.08]) {
    for (const obj of objetivosTabla) {
      const sim = simularBolaNieve(
        obj,
        cfInmueblesMensual,
        ahorroMensualNomina,
        capitalLiquido,
        COSTE_ENTRADA_PISO,
        rent,
      );
      escenarios.push({
        rentabilidad: rent * 100,
        objetivo: obj,
        meses: sim.meses,
        pisos: sim.pisosComprados,
      });
    }
  }

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Objetivo \\ Rentabilidad neta', '4%', '6%', '8%']],
    body: objetivosTabla.map((objetivo) => [
      `${new Intl.NumberFormat('es-ES').format(objetivo)} €/mes${objetivo === hito3 ? ' ★' : ''}`,
      ...rentabilidades.map((rentabilidad) => {
        const escenario = escenarios.find(
          (item) => item.objetivo === objetivo && item.rentabilidad === rentabilidad,
        );
        if (!escenario) return '—';
        if (escenario.meses === 0) return 'Ya alcanzado ✓';
        return `${(escenario.meses / 12).toFixed(1)} años (${escenario.pisos} pisos)`;
      }),
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.3,
      cellPadding: 2.4,
      textColor: COLOR.gray1,
      lineColor: COLOR.graybd,
      lineWidth: 0.1,
    },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.row.index === objetivosTabla.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [235, 242, 250];
      }
      if (
        hookData.section === 'body' &&
        hookData.row.index === objetivosTabla.length - 1 &&
        hookData.column.index === 2
      ) {
        hookData.cell.styles.fillColor = COLOR.graylt;
        hookData.cell.styles.textColor = COLOR.navy;
      }
      if (
        hookData.section === 'body' &&
        typeof hookData.cell.raw === 'string' &&
        hookData.cell.raw.includes('Ya alcanzado')
      ) {
        hookData.cell.styles.textColor = COLOR.green;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const tableFinalY = getLastAutoTableY(doc, y) + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.gray2);
  doc.text(
    '★ = tu objetivo configurado en Mi Plan. Escenario base: 6% rentabilidad neta, 80.000 € coste de entrada.',
    PAGE_MARGIN,
    tableFinalY,
  );
  y = tableFinalY + 8;

  y = drawSectionTitle(doc, y, 'Palancas de aceleración');

  const brechaActual = Math.max(0, objetivoMensual - cfInmueblesMensual);
  const yaAlcanzado = cfInmueblesMensual >= objetivoMensual;

  const mesesParaProximaCompra = ahorroMensualNomina > 0
    ? Math.ceil(COSTE_ENTRADA_PISO / ahorroMensualNomina)
    : null;

  const cfPorNuevaCompra = (COSTE_ENTRADA_PISO * RENTABILIDAD_NETA_ESTIMADA) / 12;

  const comprasFaltantes = cfPorNuevaCompra > 0
    ? Math.ceil(brechaActual / cfPorNuevaCompra)
    : null;

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

  const textoAhorro = (() => {
    const reduccion = Math.max(0, mesesBase - simMasAhorro.meses);
    if (yaAlcanzado) {
      return 'Tu objetivo ya está alcanzado. Cada 100 € adicionales de ahorro te permiten '
        + 'acumular el capital de una nueva compra antes, ampliando tu margen de seguridad.';
    }
    if (ahorroMensualNomina <= 0) {
      return 'Actualmente tu ahorro mensual disponible para reinvertir es nulo o negativo. '
        + 'Reducir gastos o aumentar ingresos antes de la siguiente compra aceleraría significativamente el plazo.';
    }
    const mesesProxima = mesesParaProximaCompra ?? '?';
    const parteCompras = comprasFaltantes !== null
      ? ` Te faltan ~${comprasFaltantes} compras para cerrar la brecha actual de ${fmtEur(brechaActual)}/mes.`
      : '';
    return `Con tu ahorro actual de ${fmtEur(ahorroMensualNomina)}/mes, acumularías el capital para la próxima compra en ~${mesesProxima} meses. `
      + `Cada 100 € más de ahorro mensual recorta el plazo total en ~${reduccion} meses.`
      + parteCompras;
  })();

  const textoRentabilidad = (() => {
    const reduccion = Math.max(0, mesesBase - simMasRentabilidad.meses);
    if (yaAlcanzado) {
      return 'Mejorar la rentabilidad neta de la cartera incrementa el CF pasivo mensual y '
        + 'aleja el punto de quiebre si aparecen vacíos o subidas de costes.';
    }
    const cfMensualActualPorPiso = (COSTE_ENTRADA_PISO * RENTABILIDAD_NETA_ESTIMADA) / 12;
    const cfMensualA8PorPiso = (COSTE_ENTRADA_PISO * 0.08) / 12;
    return `Cada inmueble añade hoy ${fmtEur(cfMensualActualPorPiso)}/mes al CF (6% neto). `
      + `Subiendo a 8% neto añadiría ${fmtEur(cfMensualA8PorPiso)}/mes por activo, `
      + `recortando el plazo total en ~${reduccion} meses.`;
  })();

  const textoEntrada = (() => {
    const reduccion = Math.max(0, mesesBase - simMenorEntrada.meses);
    if (yaAlcanzado) {
      return 'Reducir el coste de entrada en futuras compras mantiene el capital disponible '
        + 'más tiempo y permite diversificar con más activos.';
    }
    const cfPorPiso60k = (60_000 * RENTABILIDAD_NETA_ESTIMADA) / 12;
    const mesesAhorroConEntradaMenor = ahorroMensualNomina > 0
      ? Math.ceil(60_000 / ahorroMensualNomina)
      : null;
    const parteAhorro = mesesAhorroConEntradaMenor !== null
      ? ` Con coste de 60.000 €, acumularías capital en ~${mesesAhorroConEntradaMenor} meses.`
      : '';
    return `Bajar el coste medio de entrada de 80.000 € a 60.000 € reduce el plazo total en ~${reduccion} meses.`
      + parteAhorro
      + ` CF por activo: ${fmtEur(cfPorPiso60k)}/mes (igual yield sobre menor base).`;
  })();

  const blocks: Array<{ color: [number, number, number]; title: string; text: string }> = [
    {
      color: COLOR.teal,
      title: 'Aumentar el ahorro mensual destinado a compras',
      text: textoAhorro,
    },
    {
      color: COLOR.green,
      title: 'Mejorar la rentabilidad neta de la cartera',
      text: textoRentabilidad,
    },
    {
      color: COLOR.amber,
      title: 'Reducir el coste medio de entrada por activo',
      text: textoEntrada,
    },
  ];

  if (yaAlcanzado) {
    blocks.push({
      color: COLOR.navy,
      title: '¿Qué sigue? Consolida y amplía el margen',
      text: `Tu CF de ${fmtEur(cfInmueblesMensual)}/mes supera el objetivo de ${fmtEur(objetivoMensual)}/mes. `
        + 'Puedes subir el objetivo en Mi Plan, aumentar la reserva de liquidez o reinvertir el excedente en nuevos activos.',
    });
  }

  blocks.forEach((block) => {
    const maxWidth = pageWidth - PAGE_MARGIN * 2 - 10;
    const charsPerLine = Math.floor(maxWidth / 2.2);
    const estimatedLines = Math.ceil(block.text.length / charsPerLine);
    const blockHeight = 9 + estimatedLines * 4.5;

    if (y + blockHeight > doc.internal.pageSize.getHeight() - 30) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc, 'Proyección de Libertad Financiera', 'Escenarios y análisis de sensibilidad', 2, 2);
      y = 48;
    }

    doc.setDrawColor(...COLOR.graybd);
    doc.setFillColor(...COLOR.white);
    doc.roundedRect(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN * 2, blockHeight, 2, 2, 'FD');
    doc.setFillColor(...block.color);
    doc.rect(PAGE_MARGIN, y, 3, blockHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.gray1);
    doc.text(block.title, PAGE_MARGIN + 6, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(...COLOR.gray2);
    doc.text(block.text, PAGE_MARGIN + 6, y + 11.5, {
      maxWidth: pageWidth - PAGE_MARGIN * 2 - 10,
    });
    y += blockHeight + 4;
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
