import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InformesData } from '../../../../services/informesDataService';
import { initDB, type Account, type Movement, type Property } from '../../../../services/db';
import { COLOR, drawFooter, drawHeader, drawKpiRow, drawSectionTitle, fmtEur } from './pdfHelpers';
import { formatMovementDescriptionForReport } from './tesoreriaReportFormatting';

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
  const cuentasDB = await db.getAll('accounts') as Account[];
  const propertiesDB = await db.getAll('properties') as Property[];

  const seisAtr = new Date();
  seisAtr.setMonth(seisAtr.getMonth() - 6);
  const movimientos = (movimientosRaw as Movement[])
    .filter((m) => m.movementState !== 'Revisar' && (toDate(m.date) ?? new Date(0)) >= seisAtr)
    .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0));

  // Resolver nombre de cuenta con prioridad: alias + banco > alias > banco + IBAN > id
  const resolverNombreCuenta = (c: Account): string => {
    const alias = String((c as Account & { alias?: string }).alias ?? '').trim();
    const banco = String((c as Account & { banco?: { name?: string } }).banco?.name ?? c.bank ?? '').trim();
    const iban = String(c.iban ?? '').replace(/\s/g, '');
    const ultimos4 = iban.length >= 4 ? `····${iban.slice(-4)}` : '';

    if (alias && banco) return `${alias} · ${banco}`;
    if (alias) return alias;
    if (banco && ultimos4) return `${banco} ${ultimos4}`;
    if (banco) return banco;
    if (ultimos4) return ultimos4;
    return `Cuenta ${c.id ?? '?'}`;
  };

  // Mapa por ID de IndexedDB (string para evitar mismatch number vs string)
  const mapaId = new Map<string, string>();
  const mapaIban = new Map<string, string>();
  const propertyAliasById = new Map<string, string>();

  for (const c of cuentasDB) {
    const nombre = resolverNombreCuenta(c);
    if (c.id != null) mapaId.set(String(c.id), nombre);
    if (c.iban) mapaIban.set(c.iban.replace(/\s/g, '').toUpperCase(), nombre);
  }

  for (const property of propertiesDB) {
    if (property.id == null) continue;
    const alias = String(property.alias ?? '').trim();
    if (!alias) continue;
    propertyAliasById.set(String(property.id), alias);
  }

  // Completar con cuentas de localStorage (fuente alternativa de nombres)
  try {
    const stored = localStorage.getItem('atlas_accounts');
    if (stored) {
      const lsAccounts = JSON.parse(stored) as Account[];
      for (const c of lsAccounts) {
        const nombre = resolverNombreCuenta(c);
        if (c.id != null && !mapaId.has(String(c.id))) mapaId.set(String(c.id), nombre);
        if (!c.iban) continue;
        const key = c.iban.replace(/\s/g, '').toUpperCase();
        if (!mapaIban.has(key)) mapaIban.set(key, nombre);
      }
    }
  } catch {
    // silencioso
  }

  const getAlias = (movement: Movement): string => {
    const rawAccountId = movement.accountId == null ? '' : String(movement.accountId);
    const normalizedAccountId = rawAccountId.replace(/\s/g, '').toUpperCase();
    const sourceBank = String(movement.sourceBank ?? '').trim();
    const resolvedAccount = mapaId.get(rawAccountId)
      ?? mapaIban.get(normalizedAccountId)
      ?? sourceBank;

    return resolvedAccount || (rawAccountId ? `Cuenta ${rawAccountId}` : '—');
  };

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

  const movimientosConfirmados = movimientos
    .filter((movement) => movement.movementState === 'Confirmado' || movement.movementState === 'Conciliado');

  doc.addPage();
  drawHeader(doc, 'Informe de Tesorería', 'Extracto de movimientos recientes', 2, 2);
  y = 48;

  y = drawSectionTitle(doc, y, 'Últimos movimientos confirmados');
  const movimientosRows = movimientosConfirmados.slice(0, 50).map((m) => {
    const fecha = toDate(m.date);
    return [
      fecha ? fecha.toLocaleDateString('es-ES') : '—',
      getAlias(m),
      formatMovementDescriptionForReport(m, propertyAliasById).slice(0, 40),
      String(m.counterparty ?? '—').slice(0, 30),
      fmtEur(m.amount),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: 9, right: 9, bottom: 28 },
    head: [['Fecha', 'Banco / Cuenta', 'Descripción', 'Contrapartida', 'Importe']],
    body: movimientosRows.length > 0
      ? movimientosRows
      : [['No hay movimientos confirmados en el período seleccionado', '', '', '', '']],
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
        const amount = movimientosConfirmados[hookData.row.index]?.amount ?? 0;
        hookData.cell.styles.textColor = amount > 0 ? COLOR.green : amount < 0 ? COLOR.red : COLOR.gray1;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.gray2);
  doc.text(
    `Mostrando los 50 movimientos confirmados más recientes de los últimos 6 meses. Total de movimientos confirmados en el período: ${movimientosConfirmados.length}`,
    PAGE_MARGIN,
    Math.min(getLastAutoTableY(doc, y) + 7, doc.internal.pageSize.getHeight() - 24),
    { maxWidth: doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2 },
  );

  drawFooter(doc);
  doc.save(`ATLAS_Tesoreria_${data.año}.pdf`);
}
