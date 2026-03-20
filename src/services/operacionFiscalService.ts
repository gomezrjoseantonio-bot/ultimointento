import { initDB, type AEATBox, type AEATFiscalType, type OperacionFiscal, type OpexRule } from './db';
import { OPEX_CATEGORY_TO_AEAT_BOX } from './aeatClassificationService';
import { prestamosService } from './prestamosService';
import { prestamosCalculationService } from './prestamosCalculationService';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function calcularPatas(op: Partial<OperacionFiscal>): number {
  let patas = 0;
  if (op.inmuebleId && op.casillaAEAT && (op.total || 0) > 0) patas += 1;
  if (op.documentId) patas += 1;
  if (op.movementId) patas += 1;
  return patas;
}

function calcularEstado(op: Partial<OperacionFiscal>): OperacionFiscal['estado'] {
  const tieneAsignacion = !!op.inmuebleId && !!op.casillaAEAT && (op.total || 0) > 0;
  const tieneDoc = !!op.documentId;
  const tieneMov = !!op.movementId;

  if (tieneAsignacion && tieneDoc && tieneMov) return 'completo';
  if (tieneMov) return 'conciliado';
  if (tieneDoc) return 'documentado';
  if (tieneAsignacion) return 'confirmado';
  return 'previsto';
}

function extraerEjercicio(fecha: string): number {
  return new Date(fecha).getFullYear();
}

export function mapBoxToFiscalType(box: AEATBox): AEATFiscalType {
  const map: Record<AEATBox, AEATFiscalType> = {
    '0105': 'financiacion',
    '0106': 'reparacion-conservacion',
    '0109': 'comunidad',
    '0112': 'servicios-personales',
    '0113': 'suministros',
    '0114': 'seguros',
    '0115': 'tributos-locales',
    '0117': 'amortizacion-muebles',
  };
  return map[box];
}

function getCuentaBancaria(rule: OpexRule, cuentas: any[]): string | undefined {
  if (!rule.accountId) return undefined;
  const cuenta = cuentas.find((item) => item.id === rule.accountId);
  if (!cuenta) return undefined;
  return cuenta.alias || cuenta.banco?.name || cuenta.ibanMasked || cuenta.iban;
}

async function getInmuebleAlias(inmuebleId: number): Promise<string | undefined> {
  const db = await initDB();
  const property = await db.get('properties', inmuebleId);
  return property?.alias;
}

export async function crearOperacionFiscal(
  input: Omit<OperacionFiscal, 'id' | 'ejercicio' | 'estado' | 'patas' | 'createdAt' | 'updatedAt'>
): Promise<OperacionFiscal> {
  const db = await initDB();
  const now = new Date().toISOString();
  const operacion: Omit<OperacionFiscal, 'id'> = {
    ...input,
    ejercicio: extraerEjercicio(input.fecha),
    estado: calcularEstado(input),
    patas: calcularPatas(input),
    createdAt: now,
    updatedAt: now,
  };
  const id = await db.add('operacionesFiscales', operacion);
  return { ...operacion, id: id as number };
}

export async function actualizarOperacionFiscal(
  id: number,
  updates: Partial<Omit<OperacionFiscal, 'id' | 'createdAt'>>
): Promise<OperacionFiscal> {
  const db = await initDB();
  const actual = await db.get('operacionesFiscales', id);
  if (!actual) throw new Error('Operación fiscal no encontrada');

  const merged = {
    ...actual,
    ...updates,
  } as OperacionFiscal;

  const updated: OperacionFiscal = {
    ...merged,
    ejercicio: extraerEjercicio(merged.fecha),
    estado: calcularEstado(merged),
    patas: calcularPatas(merged),
    updatedAt: new Date().toISOString(),
  };
  await db.put('operacionesFiscales', updated);
  return updated;
}

export async function getOperacionesPorInmuebleYEjercicio(inmuebleId: number, ejercicio: number): Promise<OperacionFiscal[]> {
  const db = await initDB();
  const operaciones = await db.getAllFromIndex('operacionesFiscales', 'inmueble-ejercicio', [inmuebleId, ejercicio]);
  return operaciones.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function getOperacionesPorEjercicio(ejercicio: number): Promise<OperacionFiscal[]> {
  const db = await initDB();
  return db.getAllFromIndex('operacionesFiscales', 'ejercicio', ejercicio);
}

export async function vincularMovimiento(operacionId: number, movementId: number | string): Promise<OperacionFiscal> {
  return actualizarOperacionFiscal(operacionId, { movementId });
}

export async function vincularDocumento(operacionId: number, documentId: number): Promise<OperacionFiscal> {
  return actualizarOperacionFiscal(operacionId, { documentId });
}

export async function eliminarOperacionFiscal(id: number): Promise<void> {
  const db = await initDB();
  await db.delete('operacionesFiscales', id);
}

export async function getResumenCasillasAEAT(inmuebleId: number, ejercicio: number): Promise<Record<string, number>> {
  const operaciones = await getOperacionesPorInmuebleYEjercicio(inmuebleId, ejercicio);
  return operaciones
    .filter((op) => op.inmuebleId && op.casillaAEAT && op.total > 0)
    .reduce<Record<string, number>>((acc, op) => {
      acc[op.casillaAEAT] = (acc[op.casillaAEAT] || 0) + op.total;
      return acc;
    }, {});
}

function calcularMesesAplicables(rule: OpexRule, ejercicio: number): number[] {
  const startMonth = rule.mesInicio && rule.mesInicio >= 1 && rule.mesInicio <= 12 ? rule.mesInicio : 1;
  const allMonthsByFrequency: Record<string, number[]> = {
    mensual: [1,2,3,4,5,6,7,8,9,10,11,12],
    bimestral: [1,3,5,7,9,11],
    trimestral: [1,4,7,10],
    semestral: [1,7],
    anual: [startMonth],
    meses_especificos: Array.isArray(rule.mesesCobro) && rule.mesesCobro.length > 0 ? rule.mesesCobro : [startMonth],
    semanal: [1,2,3,4,5,6,7,8,9,10,11,12],
  };
  const months = allMonthsByFrequency[rule.frecuencia] || [1,2,3,4,5,6,7,8,9,10,11,12];
  return months.filter((mes) => mes >= 1 && mes <= 12 && (rule.frecuencia === 'mensual' || rule.frecuencia === 'semanal' || mes >= startMonth || rule.frecuencia === 'meses_especificos' || rule.frecuencia === 'anual'));
}

function getRecurringAmountForMonth(rule: OpexRule, month: number): number {
  if (rule.frecuencia === 'meses_especificos' && rule.asymmetricPayments?.length) {
    return rule.asymmetricPayments.find((payment) => payment.mes === month)?.importe ?? 0;
  }
  if (rule.frecuencia === 'semanal') {
    return Math.round(((rule.importeEstimado * 52) / 12) * 100) / 100;
  }
  return rule.importeEstimado;
}

export async function generarOperacionesDesdeRecurrentes(inmuebleId: number, ejercicio: number): Promise<number> {
  const db = await initDB();
  const [rules, cuentas] = await Promise.all([
    db.getAllFromIndex('opexRules', 'propertyId', inmuebleId),
    db.getAll('accounts'),
  ]);
  const alias = await getInmuebleAlias(inmuebleId);
  let creadas = 0;

  for (const rule of rules.filter((item) => item.activo)) {
    const casillaAEAT = (rule.casillaAEAT as AEATBox | undefined) || OPEX_CATEGORY_TO_AEAT_BOX[rule.categoria as keyof typeof OPEX_CATEGORY_TO_AEAT_BOX];
    if (!casillaAEAT) continue;

    const existentes = await db.getAllFromIndex('operacionesFiscales', 'origen-origenId', ['recurrente', rule.id]);
    for (const mes of calcularMesesAplicables(rule, ejercicio)) {
      const yaExiste = existentes.some((op) => op.ejercicio === ejercicio && new Date(op.fecha).getMonth() + 1 === mes);
      if (yaExiste) continue;

      const total = getRecurringAmountForMonth(rule, mes);
      if (total <= 0) continue;

      const now = new Date().toISOString();
      await db.add('operacionesFiscales', {
        ejercicio,
        fecha: `${ejercicio}-${String(mes).padStart(2, '0')}-${String(rule.diaCobro || 1).padStart(2, '0')}`,
        concepto: `${rule.concepto} — ${MESES[mes - 1]}`,
        casillaAEAT,
        categoriaFiscal: mapBoxToFiscalType(casillaAEAT),
        total,
        inmuebleId,
        inmuebleAlias: alias,
        proveedorNIF: rule.proveedorNIF || 'PENDIENTE',
        proveedorNombre: rule.proveedorNombre,
        cuentaBancaria: getCuentaBancaria(rule, cuentas),
        origen: 'recurrente',
        origenId: rule.id,
        estado: 'previsto',
        patas: 1,
        createdAt: now,
        updatedAt: now,
      } as OperacionFiscal);
      creadas += 1;
    }
  }

  return creadas;
}

export async function generarOperacionesDesdeIntereses(inmuebleId: number, ejercicio: number): Promise<number> {
  const db = await initDB();
  const prestamos = await prestamosService.getPrestamosByProperty(String(inmuebleId));
  if (!prestamos.length) return 0;

  const alias = await getInmuebleAlias(inmuebleId);
  let creadas = 0;

  for (const prestamo of prestamos) {
    if (!prestamo.activo) continue;

    let plan = await prestamosService.getPaymentPlan(prestamo.id);
    if (!plan) {
      plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
    }
    const existentes = await db.getAllFromIndex('operacionesFiscales', 'origen-origenId', ['recurrente', prestamo.id]);

    for (const periodo of plan.periodos) {
      const fechaCargo = new Date(periodo.fechaCargo);
      if (fechaCargo.getFullYear() !== ejercicio || periodo.interes <= 0) continue;
      const mes = fechaCargo.getMonth() + 1;
      const yaExiste = existentes.some((op) => op.ejercicio === ejercicio && op.casillaAEAT === '0105' && new Date(op.fecha).getMonth() + 1 === mes);
      if (yaExiste) continue;

      const now = new Date().toISOString();
      await db.add('operacionesFiscales', {
        ejercicio,
        fecha: periodo.fechaCargo,
        concepto: `Intereses ${prestamo.nombre} — ${MESES[mes - 1]}`,
        casillaAEAT: '0105',
        categoriaFiscal: 'financiacion',
        total: Math.round(periodo.interes * 100) / 100,
        inmuebleId,
        inmuebleAlias: alias,
        proveedorNIF: 'PENDIENTE',
        proveedorNombre: prestamo.nombre,
        origen: 'recurrente',
        origenId: prestamo.id,
        estado: 'previsto',
        patas: 1,
        createdAt: now,
        updatedAt: now,
      } as OperacionFiscal);
      creadas += 1;
    }
  }

  return creadas;
}
