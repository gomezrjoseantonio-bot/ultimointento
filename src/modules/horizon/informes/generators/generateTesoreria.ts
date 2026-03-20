import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { initDB, type Account, type Movement } from '../../../../services/db';
import { cuentasService } from '../../../../services/cuentasService';
import { COLOR, drawFooter, drawHeader, drawKpiRow, drawSectionTitle, fmtEur } from './pdfHelpers';

const PAGE_MARGIN = 14;

type ResumenMensual = { mes: string; ingresos: number; gastos: number; count: number };

const getLastAutoTableY = (doc: jsPDF, fallback: number): number => {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
};

const toDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function generateTesoreria(data: InformesData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const db = await initDB();
  const movimientosRaw = await db.getAll('movements');
  const cuentas = await cuentasService.list();

  const seisAtr = new Date();
  seisAtr.setMonth(seisAtr.getMonth() - 6);
  const movimientos = (movimientosRaw as Movement[])
    .filter((m) => m.movementState !== 'Revisar' && (toDate(m.date) ?? new Date(0)) >= seisAtr)
    .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0));

  const aliasCuenta = new Map<number, string>(
    (cuentas as Account[])
      .filter((c): c is Account & { id: number } => typeof c.id === 'number')
      .map((c) => [c.id, c.alias ?? c.iban ?? String(c.id)]),
  );

  const ingresos = movimientos
    .filter((m) => m.amount > 0)
    .reduce((s, m) => s + Math.abs(m.amount), 0);
  const gastos = movimientos
    .filter((m) => m.amount < 0)
    .reduce((s, m) => s + Math.abs(m.amount), 0);
  const saldoPanel = data.tesoreria.totales;

  drawHeader(doc, 'Informe de Tesorería', 'Panel de cuentas y resumen', 1, 2);
  let y = 46;

  const saldoColor = (value: number): [number, number, number] => (value > 10000 ? COLOR.green : value > 0 ? COLOR.amber : COLOR.red);

  y = drawKpiRow(doc, y, [
    { label: 'Saldo total hoy', value: fmtEur(saldoPanel.hoy), sub: 'Posición consolidada', color: saldoColor(saldoPanel.hoy) },
    { label: 'Por cobrar (mes)', value: fmtEur(saldoPanel.porCobrar), sub: 'Entradas pendientes', color: COLOR.teal },
    { label: 'Por pagar (mes)', value: fmtEur(saldoPanel.porPagar), sub: 'Salidas pendientes', color: COLOR.amber },
    { label: 'Proyección fin de mes', value: fmtEur(saldoPanel.proyeccion), sub: 'Saldo previsto', color: saldoColor(saldoPanel.proyeccion) },
  ]);

  y = drawSectionTitle(doc, y, 'Panel de cuentas');
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Banco / Cuenta', 'Saldo inicio mes', 'Saldo hoy', 'Por cobrar', 'Por pagar', 'Proyección fin mes']],
    body: data.tesoreria.filas.length > 0
      ? data.tesoreria.filas.map((f) => [
        f.banco,
        fmtEur(f.inicioMes),
        fmtEur(f.hoy),
        fmtEur(f.porCobrar),
        fmtEur(f.porPagar),
        fmtEur(f.proyeccion),
      ])
      : [['Sin cuentas disponibles en tesorería', '', '', '', '', '']],
    foot: data.tesoreria.filas.length > 0
      ? [[
        'TOTAL',
        fmtEur(data.tesoreria.totales.inicioMes),
        fmtEur(data.tesoreria.totales.hoy),
        fmtEur(data.tesoreria.totales.porCobrar),
        fmtEur(data.tesoreria.totales.porPagar),
        fmtEur(data.tesoreria.totales.proyeccion),
      ]]
      : undefined,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.9, cellPadding: 2.1, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    footStyles: { fillColor: COLOR.graylt, textColor: COLOR.gray1, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' && hookData.section !== 'foot') return;
      if (hookData.section === 'body' && data.tesoreria.filas.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }
      if (hookData.column.index === 2 || hookData.column.index === 5) {
        const value = hookData.section === 'foot'
          ? (hookData.column.index === 2 ? data.tesoreria.totales.hoy : data.tesoreria.totales.proyeccion)
          : (hookData.column.index === 2 ? data.tesoreria.filas[hookData.row.index]?.hoy ?? 0 : data.tesoreria.filas[hookData.row.index]?.proyeccion ?? 0);
        hookData.cell.styles.textColor = saldoColor(value);
      }
    },
  });

  y = getLastAutoTableY(doc, y) + 8;
  y = drawSectionTitle(doc, y, 'Resumen movimientos (últimos 6 meses)');

  const porMes = new Map<string, ResumenMensual>();
  for (const m of movimientos) {
    const fecha = toDate(m.date);
    if (!fecha) continue;
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    const entry = porMes.get(clave) ?? { mes: clave, ingresos: 0, gastos: 0, count: 0 };
    if (m.amount > 0) entry.ingresos += m.amount;
    else entry.gastos += Math.abs(m.amount);
    entry.count += 1;
    porMes.set(clave, entry);
  }
  const filasResumen = Array.from(porMes.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .map(([mes, v]) => [mes, fmtEur(v.ingresos), fmtEur(v.gastos), fmtEur(v.ingresos - v.gastos), String(v.count)]);

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    head: [['Período', 'Ingresos', 'Gastos', 'Saldo neto', 'Nº movimientos']],
    body: filasResumen.length > 0
      ? filasResumen
      : [['Sin movimientos en el período seleccionado', fmtEur(ingresos), fmtEur(gastos), fmtEur(ingresos - gastos), '0']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.1, cellPadding: 2.2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      if (filasResumen.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
      }
      if (hookData.column.index === 3) {
        const value = filasResumen.length === 0
          ? ingresos - gastos
          : ((porMes.get(filasResumen[hookData.row.index]?.[0] as string)?.ingresos ?? 0) - (porMes.get(filasResumen[hookData.row.index]?.[0] as string)?.gastos ?? 0));
        hookData.cell.styles.textColor = value > 0 ? COLOR.green : value < 0 ? COLOR.red : COLOR.gray1;
      }
    },
  });
  drawFooter(doc);

  doc.addPage();
  drawHeader(doc, 'Informe de Tesorería', 'Extracto de movimientos recientes', 2, 2);
  y = 48;

  y = drawSectionTitle(doc, y, 'Últimos movimientos confirmados');
  const movimientosRows = movimientos.slice(0, 50).map((m) => {
    const fecha = toDate(m.date);
    return [
      fecha ? fecha.toLocaleDateString('es-ES') : '—',
      aliasCuenta.get(m.accountId) ?? '—',
      String(m.description ?? '—').slice(0, 40),
      String(m.counterparty ?? '—').slice(0, 30),
      fmtEur(m.amount),
      String(m.movementState ?? '—'),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: 9, right: 9, bottom: 28 },
    head: [['Fecha', 'Cuenta', 'Descripción', 'Contrapartida', 'Importe', 'Estado']],
    body: movimientosRows.length > 0
      ? movimientosRows
      : [['No hay movimientos en el período seleccionado', '', '', '', '', '']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 2, textColor: COLOR.gray1, lineColor: COLOR.graybd, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.navy, textColor: COLOR.white },
    alternateRowStyles: { fillColor: COLOR.graylt },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      if (movimientosRows.length === 0 && hookData.column.index === 0) {
        hookData.cell.styles.fontStyle = 'italic';
        hookData.cell.styles.textColor = COLOR.gray2;
        return;
      }
      if (hookData.column.index === 4) {
        const amount = movimientos[hookData.row.index]?.amount ?? 0;
        hookData.cell.styles.textColor = amount > 0 ? COLOR.green : amount < 0 ? COLOR.red : COLOR.gray1;
        hookData.cell.styles.fontStyle = 'bold';
      }
      if (hookData.column.index === 5) {
        const estado = movimientos[hookData.row.index]?.movementState ?? '';
        hookData.cell.styles.textColor = estado === 'Previsto'
          ? COLOR.amber
          : estado === 'Confirmado' || estado === 'Conciliado'
            ? COLOR.green
            : COLOR.gray1;
      }
    },
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.gray2);
  doc.text(
    `Mostrando los 50 movimientos más recientes de los últimos 6 meses. Total de movimientos en el período: ${movimientos.length}`,
    PAGE_MARGIN,
    Math.min(getLastAutoTableY(doc, y) + 7, doc.internal.pageSize.getHeight() - 24),
    { maxWidth: doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2 },
  );

  drawFooter(doc);
  doc.save(`ATLAS_Tesoreria_${data.año}.pdf`);
}
