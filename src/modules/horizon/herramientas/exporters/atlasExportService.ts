import * as XLSX from 'xlsx';
import { calcularDeclaracionIRPF } from '../../../../services/irpfCalculationService';
import { generarEventosFiscales } from '../../../../services/fiscalPaymentsService';
import { initDB, type Account, type Contract, type Movement } from '../../../../services/db';
import { inmuebleService } from '../../../../services/inmuebleService';
import { prestamosService } from '../../../../services/prestamosService';
import { generateProyeccionMensual } from '../../../horizon/proyeccion/mensual/services/proyeccionMensualService';
import type { ProyeccionAnual, MonthlyProjectionRow } from '../../../horizon/proyeccion/mensual/types/proyeccionMensual';
import type { Inmueble } from '../../../../types/inmueble';
import type { PlanPagos, Prestamo } from '../../../../types/prestamos';
import type { ValoracionHistorica } from '../../../../types/valoraciones';
import {
  getLatestValuation,
  mapInmuebleToRow,
  mapPrestamoToRow,
  toNumber,
  type ExtendedProperty,
  type InmuebleRow,
  type PrestamoRow,
} from './mappers';

type RowDefinition = {
  label: string | ((year: number) => string);
  getValue?: (month: MonthlyProjectionRow) => number;
  isTotal?: boolean;
  specialBg?: 'total' | 'highlight';
  highlight?: 'positive-negative';
};

type RowMeta = {
  kind: 'header' | 'section' | 'value';
  rowDef?: RowDefinition;
};

const MONTH_HEADERS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const safe = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

const autoFitColumns = (worksheet: XLSX.WorkSheet, widths: number[]): void => {
  worksheet['!cols'] = widths.map((wch) => ({ wch }));
};

const createSheetFromJson = <T extends Record<string, string | number>>(rows: T[], widths?: number[], headers: string[] = []): XLSX.WorkSheet => {
  const sheet = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows, { skipHeader: false, header: headers.length > 0 ? headers : undefined })
    : XLSX.utils.aoa_to_sheet(headers.length > 0 ? [headers] : [[]]);
  if (widths) {
    autoFitColumns(sheet, widths);
  }
  return sheet;
};

const buildPortfolioContext = async (): Promise<{
  inmuebles: Inmueble[];
  properties: ExtendedProperty[];
  valuations: ValoracionHistorica[];
  contracts: Contract[];
  prestamos: Prestamo[];
  prestamosMapeados: PrestamoRow[];
}> => {
  const [inmuebles, prestamos, dbPayload] = await Promise.all([
    safe(inmuebleService.getAll(), [] as Inmueble[]),
    safe(prestamosService.getAllPrestamos(), [] as Prestamo[]),
    safe((async () => {
      const db = await initDB();
      const [properties, valuations, contracts] = await Promise.all([
        safe(db.getAll('properties'), [] as ExtendedProperty[]),
        safe(db.getAll('valoraciones_historicas'), [] as ValoracionHistorica[]),
        safe(db.getAll('contracts'), [] as Contract[]),
      ]);
      return { properties, valuations, contracts };
    })(), { properties: [] as ExtendedProperty[], valuations: [] as ValoracionHistorica[], contracts: [] as Contract[] }),
  ]);

  const loanPlans = new Map<string, PlanPagos | null>(
    await Promise.all(
      prestamos.map(async (prestamo) => [
        prestamo.id,
        await safe(prestamosService.getPaymentPlan(prestamo.id), null as PlanPagos | null),
      ] as const),
    ),
  );

  const prestamosMapeados = prestamos.map((prestamo) => mapPrestamoToRow({
    prestamo,
    plan: loanPlans.get(prestamo.id) ?? null,
  }));

  return {
    inmuebles,
    properties: dbPayload.properties,
    valuations: dbPayload.valuations,
    contracts: dbPayload.contracts,
    prestamos,
    prestamosMapeados,
  };
};

const buildInmuebleRows = async (): Promise<InmuebleRow[]> => {
  const { inmuebles, properties, valuations, contracts, prestamos, prestamosMapeados } = await buildPortfolioContext();

  return inmuebles.map((inmueble) => {
    const property = properties.find((item) => String(item.id) === String(inmueble.id)) ?? null;
    const valuation = getLatestValuation(inmueble.id, valuations);
    const contractsForProperty = contracts.filter((contract) => String(contract.inmuebleId) === String(inmueble.id));
    const prestamosForProperty = prestamosMapeados.filter((prestamo) => {
      const original = prestamos.find((item) => item.id === prestamo.id);
      return prestamo.esHipoteca && original?.inmuebleId === inmueble.id;
    });

    return mapInmuebleToRow({
      inmueble,
      property,
      valuation,
      contracts: contractsForProperty,
      prestamos: prestamosForProperty,
    });
  });
};

const writeWorkbook = (workbook: XLSX.WorkBook, fileName: string): void => {
  XLSX.writeFile(workbook, fileName);
};

const buildProjectionRows = (projection: ProyeccionAnual): { data: Array<Record<string, string | number>>; meta: RowMeta[] } => {
  const sections: Array<{ label: string; rows: RowDefinition[] }> = [
    {
      label: 'INGRESOS',
      rows: [
        { label: 'Nóminas', getValue: (month) => toNumber(month.ingresos.nomina) },
        { label: 'Ingresos Autónomos', getValue: (month) => toNumber(month.ingresos.serviciosFreelance) },
        { label: 'Rentas alquiler', getValue: (month) => toNumber(month.ingresos.rentasAlquiler) },
        { label: 'Intereses Inversiones', getValue: (month) => toNumber(month.ingresos.dividendosInversiones) + toNumber(month.ingresos.pensiones) },
        { label: 'Otros ingresos', getValue: (month) => toNumber(month.ingresos.otrosIngresos) },
        { label: 'Total ingresos', getValue: (month) => toNumber(month.ingresos.total), isTotal: true, specialBg: 'total' },
      ],
    },
    {
      label: 'GASTOS',
      rows: [
        { label: 'Gastos Alquileres', getValue: (month) => toNumber(month.gastos.gastosOperativos) },
        { label: 'Gastos personales', getValue: (month) => toNumber(month.gastos.gastosPersonales) },
        { label: 'Gastos autónomo', getValue: (month) => toNumber(month.gastos.gastosAutonomo) },
        { label: (year) => `IRPF ${year - 1}`, getValue: (month) => toNumber(month.gastos.irpf) },
        { label: 'Total gastos', getValue: (month) => toNumber(month.gastos.total), isTotal: true, specialBg: 'total' },
      ],
    },
    {
      label: 'FINANCIACIÓN',
      rows: [
        { label: 'Cuotas hipotecas', getValue: (month) => toNumber(month.financiacion.cuotasHipotecas) },
        { label: 'Cuotas préstamos', getValue: (month) => toNumber(month.financiacion.cuotasPrestamos) },
        { label: 'Total financiación', getValue: (month) => toNumber(month.financiacion.total), isTotal: true, specialBg: 'total' },
      ],
    },
    {
      label: 'TESORERÍA',
      rows: [
        { label: 'Flujo caja del mes', getValue: (month) => toNumber(month.tesoreria.flujoCajaMes), highlight: 'positive-negative' },
        { label: 'Caja inicial', getValue: (month) => toNumber(month.tesoreria.cajaInicial) },
        { label: 'Caja final', getValue: (month) => toNumber(month.tesoreria.cajaFinal), isTotal: true, specialBg: 'highlight' },
      ],
    },
  ];

  const data: Array<Record<string, string | number>> = [];
  const meta: RowMeta[] = [];

  for (const section of sections) {
    data.push({ ATRIBUTO: section.label, ...Object.fromEntries(MONTH_HEADERS.map((month) => [month, ''])) });
    meta.push({ kind: 'section' });

    for (const row of section.rows) {
      data.push({
        ATRIBUTO: typeof row.label === 'function' ? row.label(projection.year) : row.label,
        ...Object.fromEntries(MONTH_HEADERS.map((header, index) => {
          const month = projection.months[index];
          return [header, month ? (row.getValue?.(month) ?? '') : ''];
        })),
      });
      meta.push({ kind: 'value', rowDef: row });
    }
  }

  return { data, meta };
};

const styleProjectionSheet = (worksheet: XLSX.WorkSheet, meta: RowMeta[]): void => {
  const totalCols = MONTH_HEADERS.length + 1;
  const borders = {
    left: { style: 'thin', color: { rgb: 'D1D5DB' } },
    right: { style: 'thin', color: { rgb: 'D1D5DB' } },
    top: { style: 'thin', color: { rgb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
  };
  const baseStyle = {
    font: { name: 'Arial', sz: 10 },
    alignment: { vertical: 'center', horizontal: 'right' },
    border: borders,
  };

  for (let rowIndex = 0; rowIndex <= meta.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < totalCols; colIndex += 1) {
      const ref = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = (worksheet[ref] ?? { t: 's', v: '' }) as XLSX.CellObject & { s?: unknown };
      const isHeaderRow = rowIndex === 0;
      const isLabelCol = colIndex === 0;
      const rowMeta = meta[rowIndex - 1];
      const style: {
        font: { name: string; sz: number; bold?: boolean; color?: { rgb: string } };
        alignment: { vertical: string; horizontal: string };
        border: typeof borders;
        fill?: { patternType: string; fgColor: { rgb: string } };
        numFmt?: string;
      } = {
        ...baseStyle,
        alignment: {
          ...baseStyle.alignment,
          horizontal: isLabelCol ? 'left' : 'right',
        },
      };

      if (isHeaderRow) {
        style.font = { ...style.font, bold: true, color: { rgb: 'FFFFFF' } };
        style.fill = { patternType: 'solid', fgColor: { rgb: '0F172A' } };
      } else if (!isLabelCol && rowMeta?.kind === 'value') {
        style.numFmt = '#,##0.00';
      }

      if (rowMeta?.kind === 'section') {
        style.font = { ...style.font, bold: true, color: { rgb: '111827' } };
        style.fill = { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } };
      }

      if (rowMeta?.kind === 'value' && rowMeta.rowDef?.specialBg === 'total') {
        style.fill = { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } };
        style.font = { ...style.font, bold: true };
      }

      if (rowMeta?.kind === 'value' && rowMeta.rowDef?.specialBg === 'highlight') {
        style.fill = { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } };
        style.font = { ...style.font, bold: true };
      }

      if (rowMeta?.kind === 'value' && !isLabelCol && rowMeta.rowDef?.highlight === 'positive-negative') {
        const numericValue = Number(cell.v ?? 0);
        if (numericValue > 0) {
          style.font = { ...style.font, bold: true, color: { rgb: '15803D' } };
        } else if (numericValue < 0) {
          style.font = { ...style.font, bold: true, color: { rgb: 'DC2626' } };
        }
      }

      cell.s = style;
      worksheet[ref] = cell;
    }
  }

  autoFitColumns(worksheet, [24, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12]);
};

export async function exportarProyeccionMensual(año: number): Promise<void> {
  const projections = await safe(generateProyeccionMensual(), [] as ProyeccionAnual[]);
  const projection = projections.find((item) => item.year === año);

  if (!projection) {
    const worksheet = XLSX.utils.aoa_to_sheet([[ 'ATRIBUTO', ...MONTH_HEADERS ]]);
    autoFitColumns(worksheet, [24, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Proyección ${año}`);
    writeWorkbook(workbook, `proyeccion_mensual_${año}.xlsx`);
    return;
  }

  const { data, meta } = buildProjectionRows(projection);
  const worksheet = XLSX.utils.json_to_sheet(data);
  styleProjectionSheet(worksheet, meta);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Proyección ${año}`);
  writeWorkbook(workbook, `proyeccion_mensual_${año}.xlsx`);
}

export async function exportarCarteraInmuebles(): Promise<void> {
  const rows = await buildInmuebleRows();
  const fecha = new Date().toISOString().slice(0, 10);

  const carteraSheet = createSheetFromJson(rows.map((row) => ({
    ID: row.id,
    Alias: row.alias,
    Dirección: row.direccion,
    Municipio: row.municipio,
    CCAA: row.ccaa,
    Estado: row.estado,
    Régimen: row.regimen,
    'Fecha compra': row.fechaCompra,
    'm²': row.metrosCuadrados,
    'Hab.': row.habitaciones,
    'Precio compra': row.precioCompra,
    'Gastos compra': row.gastosCompra,
    Impuestos: row.impuestosCompra,
    'Coste total': row.costeTotal,
    'Valor actual': row.valorActual,
    Plusvalía: row.plusvalia,
    'Plusvalía %': row.plusvaliaPct,
    'Renta mensual': row.rentaMensual,
    'Yield bruto %': row.yieldBruto,
    'Hipoteca mensual': row.hipotecaMensual,
    'CF neto': row.cfNeto,
    'Deuda hipotecaria': row.deudaHipotecaria,
    'LTV %': row.ltv,
    'Ref. catastral': row.referenciaCatastral,
  })), [16, 18, 28, 16, 14, 12, 16, 14, 10, 8, 14, 14, 12, 14, 14, 14, 14, 14, 12, 14, 12, 14, 10, 18], ['ID', 'Alias', 'Dirección', 'Municipio', 'CCAA', 'Estado', 'Régimen', 'Fecha compra', 'm²', 'Hab.', 'Precio compra', 'Gastos compra', 'Impuestos', 'Coste total', 'Valor actual', 'Plusvalía', 'Plusvalía %', 'Renta mensual', 'Yield bruto %', 'Hipoteca mensual', 'CF neto', 'Deuda hipotecaria', 'LTV %', 'Ref. catastral']);

  const totals = rows.reduce((acc, row) => ({
    metrosCuadrados: acc.metrosCuadrados + row.metrosCuadrados,
    habitaciones: acc.habitaciones + row.habitaciones,
    precioCompra: acc.precioCompra + row.precioCompra,
    gastosCompra: acc.gastosCompra + row.gastosCompra,
    impuestosCompra: acc.impuestosCompra + row.impuestosCompra,
    costeTotal: acc.costeTotal + row.costeTotal,
    valorActual: acc.valorActual + row.valorActual,
    plusvalia: acc.plusvalia + row.plusvalia,
    rentaMensual: acc.rentaMensual + row.rentaMensual,
    hipotecaMensual: acc.hipotecaMensual + row.hipotecaMensual,
    cfNeto: acc.cfNeto + row.cfNeto,
    deudaHipotecaria: acc.deudaHipotecaria + row.deudaHipotecaria,
  }), {
    metrosCuadrados: 0,
    habitaciones: 0,
    precioCompra: 0,
    gastosCompra: 0,
    impuestosCompra: 0,
    costeTotal: 0,
    valorActual: 0,
    plusvalia: 0,
    rentaMensual: 0,
    hipotecaMensual: 0,
    cfNeto: 0,
    deudaHipotecaria: 0,
  });

  XLSX.utils.sheet_add_json(carteraSheet, [{
    ID: 'TOTALES',
    Alias: '',
    Dirección: '',
    Municipio: '',
    CCAA: '',
    Estado: '',
    Régimen: '',
    'Fecha compra': '',
    'm²': totals.metrosCuadrados,
    'Hab.': totals.habitaciones,
    'Precio compra': totals.precioCompra,
    'Gastos compra': totals.gastosCompra,
    Impuestos: totals.impuestosCompra,
    'Coste total': totals.costeTotal,
    'Valor actual': totals.valorActual,
    Plusvalía: totals.plusvalia,
    'Plusvalía %': 0,
    'Renta mensual': totals.rentaMensual,
    'Yield bruto %': 0,
    'Hipoteca mensual': totals.hipotecaMensual,
    'CF neto': totals.cfNeto,
    'Deuda hipotecaria': totals.deudaHipotecaria,
    'LTV %': 0,
    'Ref. catastral': '',
  }], { skipHeader: true, origin: -1 });

  const fiscalSheet = createSheetFromJson(rows
    .filter((row) => row.estado === 'ACTIVO')
    .map((row) => ({
      ID: row.id,
      Alias: row.alias,
      'Valor catastral': row.valorCatastral,
      'Valor catastral construcción': row.valorCatastralConstruccion,
      '% construcción': row.porcentajeConstruccion,
      'Método amortización': row.metodoAmortizacion,
      'Amortización anual base': row.amortizacionAnualBase,
      '% amortización': row.porcentajeAmortizacion,
      'Régimen fiscal': row.regimenFiscal,
    })), [16, 18, 18, 24, 16, 22, 22, 16, 20], ['ID', 'Alias', 'Valor catastral', 'Valor catastral construcción', '% construcción', 'Método amortización', 'Amortización anual base', '% amortización', 'Régimen fiscal']);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, carteraSheet, 'Cartera');
  XLSX.utils.book_append_sheet(workbook, fiscalSheet, 'Detalle fiscal');
  writeWorkbook(workbook, `atlas_cartera_inmuebles_${fecha}.xlsx`);
}

export async function exportarFiscal(año: number): Promise<void> {
  const declaracion = await calcularDeclaracionIRPF(año, { usarConciliacion: true });
  const calendario = await safe(generarEventosFiscales(año, declaracion), []);

  const resumenRows = [
    { Concepto: 'Rendimientos del trabajo (neto)', Importe: toNumber(declaracion.baseGeneral.rendimientosTrabajo?.rendimientoNeto) },
    { Concepto: 'Rendimientos capital inmobiliario (total)', Importe: declaracion.baseGeneral.rendimientosInmuebles.reduce((sum, item) => sum + toNumber(item.rendimientoNeto), 0) },
    { Concepto: 'Rendimientos actividades económicas', Importe: toNumber(declaracion.baseGeneral.rendimientosAutonomo?.rendimientoNeto) },
    { Concepto: 'Rendimientos capital mobiliario', Importe: toNumber(declaracion.baseAhorro.capitalMobiliario.total) },
    { Concepto: 'Base imponible general', Importe: toNumber(declaracion.liquidacion.baseImponibleGeneral) },
    { Concepto: 'Base imponible del ahorro', Importe: toNumber(declaracion.liquidacion.baseImponibleAhorro) },
    { Concepto: 'Base liquidable general', Importe: toNumber(declaracion.liquidacion.baseImponibleGeneral - declaracion.reducciones.total) },
    { Concepto: 'Cuota íntegra', Importe: toNumber(declaracion.liquidacion.cuotaIntegra) },
    { Concepto: 'Retenciones (trabajo)', Importe: toNumber(declaracion.retenciones.trabajo) },
    { Concepto: 'Retenciones (capital)', Importe: toNumber(declaracion.retenciones.capitalMobiliario) },
    { Concepto: 'Retenciones (autónomo / pagos fraccionados)', Importe: toNumber(declaracion.retenciones.autonomoM130) },
    { Concepto: 'Total retenciones', Importe: toNumber(declaracion.retenciones.total) },
    { Concepto: 'Resultado de la declaración', Importe: toNumber(declaracion.resultado) },
  ];

  const inmueblesRows = declaracion.baseGeneral.rendimientosInmuebles.map((item) => ({
    Alias: item.alias,
    'Ingresos íntegros': toNumber(item.ingresosIntegros),
    'Gastos deducibles': toNumber(item.gastosDeducibles),
    Amortización: toNumber(item.amortizacion),
    'Base neta': toNumber(item.ingresosIntegros - item.gastosDeducibles - item.amortizacion),
    'Reducción 60% (si aplica)': toNumber(item.reduccionHabitual),
    'Rendimiento neto reducido': toNumber(item.rendimientoNetoReducido ?? item.rendimientoNeto),
    Retenciones: 0,
    Saldo: toNumber(item.rendimientoNeto),
  }));

  const calendarioRows = calendario.map((evento) => ({
    Concepto: evento.descripcion,
    Fecha: evento.fechaPago ?? evento.fechaLimite,
    Importe: toNumber(evento.importe),
    Estado: evento.pagado ? 'Pagado' : 'Pendiente',
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, createSheetFromJson(resumenRows, [36, 16], ['Concepto', 'Importe']), `Resumen IRPF ${año}`);
  XLSX.utils.book_append_sheet(workbook, createSheetFromJson(inmueblesRows, [20, 18, 18, 16, 14, 22, 24, 12, 14], ['Alias', 'Ingresos íntegros', 'Gastos deducibles', 'Amortización', 'Base neta', 'Reducción 60% (si aplica)', 'Rendimiento neto reducido', 'Retenciones', 'Saldo']), `Inmuebles fiscales ${año}`);
  XLSX.utils.book_append_sheet(workbook, createSheetFromJson(calendarioRows, [42, 14, 14, 12], ['Concepto', 'Fecha', 'Importe', 'Estado']), `Calendario pagos ${año}`);
  writeWorkbook(workbook, `atlas_fiscal_${año}.xlsx`);
}

export async function exportarPrestamos(): Promise<void> {
  const fecha = new Date().toISOString().slice(0, 10);
  const prestamos = await safe(prestamosService.getAllPrestamos(), [] as Prestamo[]);
  const currentYear = new Date().getFullYear();
  const rows = (await Promise.all(prestamos.map(async (prestamo) => {
    const plan = await safe(prestamosService.getPaymentPlan(prestamo.id), null as PlanPagos | null);
    return {
      row: mapPrestamoToRow({ prestamo, plan }),
      plan,
    };
  })))
    .filter(({ row }) => row.estado === 'Activo');

  const activosSheet = createSheetFromJson(rows.map(({ row }) => ({
    Nombre: row.nombre,
    Ámbito: row.ambito,
    Finalidad: row.finalidad,
    Tipo: row.tipo,
    Sistema: row.sistema,
    'Principal inicial': row.principalInicial,
    'Principal vivo': row.principalVivo,
    'Fecha firma': row.fechaFirma,
    'Fecha vencimiento': row.fechaVencimiento,
    'Plazo total (meses)': row.plazoTotalMeses,
    'Plazo restante (meses)': row.plazoRestanteMeses,
    'Cuota mensual': row.cuotaMensual,
    'TIN %': row.tin,
    'TAE %': row.tae,
    'Total intereses pendientes': row.totalInteresesPendientes,
    Estado: row.estado,
  })), [24, 14, 16, 12, 12, 18, 18, 14, 16, 18, 20, 16, 12, 12, 22, 12], ['Nombre', 'Ámbito', 'Finalidad', 'Tipo', 'Sistema', 'Principal inicial', 'Principal vivo', 'Fecha firma', 'Fecha vencimiento', 'Plazo total (meses)', 'Plazo restante (meses)', 'Cuota mensual', 'TIN %', 'TAE %', 'Total intereses pendientes', 'Estado']);

  const calendarioRows = rows.flatMap(({ row, plan }) =>
    (plan?.periodos ?? [])
      .filter((periodo) => periodo.fechaCargo.startsWith(`${currentYear}-`))
      .slice(0, 12)
      .map((periodo) => ({
        Préstamo: row.nombre,
        Mes: periodo.fechaCargo.slice(0, 7),
        'Cuota total': toNumber(periodo.cuota),
        Capital: toNumber(periodo.amortizacion),
        Intereses: toNumber(periodo.interes),
        'Capital pendiente': toNumber(periodo.principalFinal),
      })),
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, activosSheet, 'Préstamos activos');
  XLSX.utils.book_append_sheet(workbook, createSheetFromJson(calendarioRows, [24, 12, 14, 14, 14, 18], ['Préstamo', 'Mes', 'Cuota total', 'Capital', 'Intereses', 'Capital pendiente']), 'Calendario anual');
  writeWorkbook(workbook, `atlas_prestamos_${fecha}.xlsx`);
}

export async function exportarCuentas(): Promise<void> {
  const fecha = new Date().toISOString().slice(0, 10);
  const db = await initDB();
  const accounts = await safe(db.getAll('accounts'), [] as Account[]);

  const rows = accounts
    .filter((a) => a.status !== 'DELETED' && !a.deleted_at)
    .map((a) => ({
      iban: a.iban,
      alias: a.alias || '',
      banco: a.banco?.name || a.bank || '',
      tipo: a.tipo || 'CORRIENTE',
      saldo_inicial: a.openingBalance ?? a.balance ?? 0,
      fecha_saldo_inicial: a.openingBalanceDate || a.createdAt?.slice(0, 10) || '',
      titular_nombre: a.titular?.nombre || '',
      titular_nif: a.titular?.nif || '',
      estado: a.status || (a.activa ? 'ACTIVE' : 'INACTIVE'),
    }));

  const headers = ['iban', 'alias', 'banco', 'tipo', 'saldo_inicial', 'fecha_saldo_inicial', 'titular_nombre', 'titular_nif', 'estado'];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createSheetFromJson(rows, [28, 20, 20, 18, 16, 20, 24, 20, 12], headers),
    'Cuentas',
  );
  writeWorkbook(workbook, `atlas_cuentas_${fecha}.xlsx`);
}

export async function exportarContratosParaImportacion(): Promise<void> {
  const fecha = new Date().toISOString().slice(0, 10);
  const db = await initDB();
  const [contracts, properties, accounts] = await Promise.all([
    safe(db.getAll('contracts'), [] as Contract[]),
    safe(db.getAll('properties'), [] as ExtendedProperty[]),
    safe(db.getAll('accounts'), [] as Account[]),
  ]);

  const accountsMap = new Map<number, string>(
    accounts.map((a) => [a.id ?? 0, a.alias || a.iban || '']),
  );

  const propertiesMap = new Map<string, string>(
    properties.map((p) => [String(p.id), `${p.alias || ''} ${p.address || ''}`.trim()]),
  );

  const modalidadLabel = (modalidad: Contract['modalidad']): string => {
    if (modalidad === 'temporada') return 'Contrato de temporada';
    if (modalidad === 'vacacional') return 'Contrato vacacional';
    return 'Contrato de arrendamiento de vivienda';
  };

  const rows = contracts.map((contract) => {
    // Support legacy field shapes that may exist in older records
    const legacy = contract as Contract & {
      startDate?: string;
      endDate?: string;
      monthlyRent?: number;
      deposit?: { amount?: number };
    };

    // Legacy contracts may use `tenant.name` (single string) instead of inquilino.nombre + apellidos
    const nombreCompania = [
      [contract.inquilino?.nombre, contract.inquilino?.apellidos].filter(Boolean).join(' ').trim(),
      contract.tenant?.name ?? '',
    ].find((v) => Boolean(v?.trim()))?.trim() ?? '';

    // Legacy contracts may store the property reference as `propertyId` instead of `inmuebleId`
    const inmuebleKey = String(contract.inmuebleId ?? contract.propertyId ?? '');

    return {
      ID: String(contract.id ?? ''),
      Propiedad: propertiesMap.get(inmuebleKey) || inmuebleKey,
      Tipo: modalidadLabel(contract.modalidad),
      'Inicio de alquiler': contract.fechaInicio ?? legacy.startDate ?? '',
      'Fin de alquiler': contract.fechaFin ?? legacy.endDate ?? '',
      'Nombre compañía': nombreCompania,
      Habitación: contract.habitacionId || '',
      Alquiler: contract.rentaMensual ?? legacy.monthlyRent ?? 0,
      Fianza: contract.fianzaImporte ?? legacy.deposit?.amount ?? 0,
      'Banco de cobro': accountsMap.get(contract.cuentaCobroId) || '',
      Comentarios: '',
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createSheetFromJson(
      rows,
      [10, 30, 38, 18, 18, 28, 12, 14, 14, 24, 20],
      ['ID', 'Propiedad', 'Tipo', 'Inicio de alquiler', 'Fin de alquiler', 'Nombre compañía', 'Habitación', 'Alquiler', 'Fianza', 'Banco de cobro', 'Comentarios'],
    ),
    'Contratos',
  );
  writeWorkbook(workbook, `atlas_contratos_importacion_${fecha}.xlsx`);
}

export async function exportarPrestamosParaImportacion(): Promise<void> {
  const fecha = new Date().toISOString().slice(0, 10);
  const db = await initDB();
  const [prestamos, properties, accounts] = await Promise.all([
    safe(prestamosService.getAllPrestamos(), [] as Prestamo[]),
    safe(db.getAll('properties'), [] as ExtendedProperty[]),
    safe(db.getAll('accounts'), [] as Account[]),
  ]);

  const accountsMap = new Map<string, string>(
    accounts.map((a) => [String(a.id ?? ''), a.alias || a.iban || '']),
  );

  const propertiesMap = new Map<string, string>(
    properties.map((p) => [String(p.id), `${p.alias || ''} ${p.address || ''}`.trim()]),
  );

  const rows = prestamos.map((prestamo) => {
    const isVariable = prestamo.tipo === 'VARIABLE';
    const isMixto = prestamo.tipo === 'MIXTO';
    return {
      tipo: prestamo.ambito === 'INMUEBLE' ? 'inmueble' : 'personal',
      cuenta_cargo: accountsMap.get(prestamo.cuentaCargoId) || '',
      fecha_firma: prestamo.fechaFirma,
      fecha_primer_cargo: prestamo.fechaPrimerCargo,
      dia_cobro: prestamo.diaCargoMes,
      capital_inicial: prestamo.principalInicial,
      plazo_total_meses: prestamo.plazoMesesTotal,
      tipo_interes: prestamo.tipo.toLowerCase(),
      tin_fijo: !isVariable ? (prestamo.tipoNominalAnualFijo ?? '') : '',
      diferencial: isVariable ? (prestamo.diferencial ?? '') : '',
      indice: (isVariable || isMixto) ? (prestamo.indice?.toLowerCase() ?? '') : '',
      valor_indice_actual: (isVariable || isMixto) ? (prestamo.valorIndiceActual ?? '') : '',
      revision_meses: (isVariable || isMixto) ? (prestamo.periodoRevisionMeses ?? '') : '',
      tramo_fijo_meses: isMixto ? (prestamo.tramoFijoMeses ?? '') : '',
      tin_tramo_fijo: isMixto ? (prestamo.tipoNominalAnualMixtoFijo ?? '') : '',
      diferencial_variable: isMixto ? (prestamo.diferencial ?? '') : '',
      indice_variable: isMixto ? (prestamo.indice?.toLowerCase() ?? '') : '',
      inmueble_direccion: prestamo.inmuebleId ? (propertiesMap.get(prestamo.inmuebleId) || '') : '',
      alias: prestamo.nombre,
      esquema_primer_recibo: (prestamo.esquemaPrimerRecibo ?? 'NORMAL').toLowerCase(),
      carencia: prestamo.carencia.toLowerCase(),
      meses_carencia: prestamo.carenciaMeses ?? '',
      comision_apertura: prestamo.comisionApertura ?? 0,
      comision_mantenimiento: prestamo.comisionMantenimiento ?? 0,
      comision_amortizacion_anticipada: prestamo.comisionAmortizacionAnticipada ?? 0,
    };
  });

  const headers = [
    'tipo', 'cuenta_cargo', 'fecha_firma', 'fecha_primer_cargo', 'dia_cobro',
    'capital_inicial', 'plazo_total_meses', 'tipo_interes', 'tin_fijo', 'diferencial',
    'indice', 'valor_indice_actual', 'revision_meses', 'tramo_fijo_meses', 'tin_tramo_fijo',
    'diferencial_variable', 'indice_variable', 'inmueble_direccion', 'alias',
    'esquema_primer_recibo', 'carencia', 'meses_carencia', 'comision_apertura',
    'comision_mantenimiento', 'comision_amortizacion_anticipada',
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createSheetFromJson(
      rows,
      [12, 30, 14, 18, 12, 16, 18, 14, 12, 14, 14, 20, 16, 18, 16, 22, 18, 30, 28, 22, 14, 16, 18, 24, 28],
      headers,
    ),
    'Prestamos',
  );
  writeWorkbook(workbook, `atlas_prestamos_importacion_${fecha}.xlsx`);
}

export async function exportarTesoreria(mesesAtras: number): Promise<void> {
  const fecha = new Date().toISOString().slice(0, 10);
  const db = await initDB();
  const [movements, accounts] = await Promise.all([
    safe(db.getAll('movements'), [] as Movement[]),
    safe(db.getAll('accounts'), [] as Account[]),
  ]);

  const minDate = new Date();
  minDate.setMonth(minDate.getMonth() - mesesAtras);
  const accountsMap = new Map<number, string>(
    accounts.map((account) => [account.id ?? 0, account.alias || account.name || account.iban]),
  );

  const rows = movements
    .filter((movement) => new Date(movement.date) >= minDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((movement) => ({
      Fecha: movement.date,
      Cuenta: accountsMap.get(movement.accountId) ?? `Cuenta ${movement.accountId}`,
      Descripción: movement.description,
      Contrapartida: movement.counterparty ?? '',
      Importe: toNumber(movement.amount),
      'Saldo tras movimiento': toNumber(movement.saldo ?? movement.balance),
      'Origen (import/manual)': movement.source,
    }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, createSheetFromJson(rows, [14, 20, 34, 24, 14, 18, 18], ['Fecha', 'Cuenta', 'Descripción', 'Contrapartida', 'Importe', 'Saldo tras movimiento', 'Origen (import/manual)']), 'Movimientos');
  writeWorkbook(workbook, `atlas_tesoreria_${mesesAtras}m_${fecha}.xlsx`);
}
