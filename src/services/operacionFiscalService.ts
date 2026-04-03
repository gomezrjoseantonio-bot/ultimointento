// WRAPPER TEMPORAL — este servicio delega a gastosInmuebleService
// Mantiene los mismos nombres de métodos públicos para no romper importadores
// Pendiente eliminar en fase de limpieza final

import { initDB, type AEATBox, type AEATFiscalType, type OperacionFiscal, type OpexRule, type GastoInmueble, type GastoCategoria } from './db';
import { OPEX_CATEGORY_TO_AEAT_BOX } from './aeatClassificationService';
import { prestamosService } from './prestamosService';
import { prestamosCalculationService } from './prestamosCalculationService';
import { gastosInmuebleService } from './gastosInmuebleService';

// ── Mapping helpers ──

function mapCasillaToCategoria(casilla: string): GastoCategoria {
  const map: Record<string, GastoCategoria> = {
    '0105': 'intereses', '0106': 'reparacion', '0109': 'comunidad',
    '0112': 'gestion', '0113': 'suministro', '0114': 'seguro',
    '0115': 'ibi', '0117': 'otro',
  };
  return map[casilla] || 'otro';
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

function mapGastoToOperacion(g: GastoInmueble): OperacionFiscal {
  return {
    id: g.id,
    ejercicio: g.ejercicio,
    fecha: g.fecha,
    concepto: g.concepto,
    casillaAEAT: g.casillaAEAT as AEATBox,
    categoriaFiscal: mapBoxToFiscalType(g.casillaAEAT as AEATBox),
    total: g.importe,
    inmuebleId: g.inmuebleId,
    proveedorNIF: g.proveedorNIF || 'PENDIENTE',
    proveedorNombre: g.proveedorNombre,
    documentId: g.documentId,
    movementId: g.movimientoId,
    origen: g.origen === 'xml_aeat' ? 'migracion' :
            g.origen === 'tesoreria' ? 'movimiento' :
            g.origen === 'recurrente' ? 'recurrente' :
            g.origen === 'prestamo' ? 'recurrente' : 'manual',
    origenId: g.origenId,
    estado: g.estado === 'previsto' ? 'previsto' : 'confirmado',
    patas: (g.documentId ? 1 : 0) + (g.movimientoId ? 1 : 0) + (g.inmuebleId && g.casillaAEAT && g.importe > 0 ? 1 : 0),
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  } as OperacionFiscal;
}

// ── CRUD wrappers ──

export async function crearOperacionFiscal(
  input: Omit<OperacionFiscal, 'id' | 'ejercicio' | 'estado' | 'patas' | 'createdAt' | 'updatedAt'>
): Promise<OperacionFiscal> {
  const ejercicio = new Date(input.fecha).getFullYear();
  const id = await gastosInmuebleService.add({
    inmuebleId: input.inmuebleId!,
    ejercicio,
    fecha: input.fecha,
    concepto: input.concepto || '',
    categoria: mapCasillaToCategoria(input.casillaAEAT),
    casillaAEAT: input.casillaAEAT as any,
    importe: input.total || 0,
    origen: input.origen === 'recurrente' ? 'recurrente' :
            input.origen === 'movimiento' ? 'tesoreria' :
            input.origen === 'migracion' ? 'xml_aeat' : 'manual',
    origenId: input.origenId ? String(input.origenId) : undefined,
    estado: 'confirmado',
    proveedorNIF: input.proveedorNIF,
    proveedorNombre: input.proveedorNombre,
    documentId: input.documentId,
    movimientoId: input.movementId ? String(input.movementId) : undefined,
  });
  const created = await gastosInmuebleService.getByInmuebleYEjercicio(input.inmuebleId!, ejercicio);
  const gasto = created.find(g => g.id === id);
  return gasto ? mapGastoToOperacion(gasto) : { ...input, id, ejercicio, estado: 'confirmado', patas: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as OperacionFiscal;
}

export async function actualizarOperacionFiscal(
  id: number,
  updates: Partial<Omit<OperacionFiscal, 'id' | 'createdAt'>>
): Promise<OperacionFiscal> {
  const mappedUpdates: Partial<GastoInmueble> = {};
  if (updates.fecha != null) mappedUpdates.fecha = updates.fecha;
  if (updates.concepto != null) mappedUpdates.concepto = updates.concepto;
  if (updates.casillaAEAT != null) {
    mappedUpdates.casillaAEAT = updates.casillaAEAT as any;
    mappedUpdates.categoria = mapCasillaToCategoria(updates.casillaAEAT);
  }
  if (updates.total != null) mappedUpdates.importe = updates.total;
  if (updates.proveedorNIF !== undefined) mappedUpdates.proveedorNIF = updates.proveedorNIF;
  if (updates.proveedorNombre !== undefined) mappedUpdates.proveedorNombre = updates.proveedorNombre;
  if (updates.documentId !== undefined) mappedUpdates.documentId = updates.documentId;
  if (updates.movementId !== undefined) mappedUpdates.movimientoId = updates.movementId ? String(updates.movementId) : undefined;

  await gastosInmuebleService.update(id, mappedUpdates);
  const db = await initDB();
  const gasto = await db.get('gastosInmueble', id);
  if (!gasto) throw new Error('Operación fiscal no encontrada');
  return mapGastoToOperacion(gasto);
}

export async function getOperacionesPorInmuebleYEjercicio(inmuebleId: number, ejercicio: number): Promise<OperacionFiscal[]> {
  const gastos = await gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ejercicio);
  return gastos.map(mapGastoToOperacion).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function getOperacionesPorEjercicio(ejercicio: number): Promise<OperacionFiscal[]> {
  const gastos = await gastosInmuebleService.getByEjercicio(ejercicio);
  return gastos.map(mapGastoToOperacion);
}

export async function vincularMovimiento(operacionId: number, movementId: number | string): Promise<OperacionFiscal> {
  return actualizarOperacionFiscal(operacionId, { movementId });
}

export async function vincularDocumento(operacionId: number, documentId: number): Promise<OperacionFiscal> {
  return actualizarOperacionFiscal(operacionId, { documentId });
}

export async function eliminarOperacionFiscal(id: number): Promise<void> {
  await gastosInmuebleService.delete(id);
}

export async function getResumenCasillasAEAT(inmuebleId: number, ejercicio: number): Promise<Record<string, number>> {
  return gastosInmuebleService.getSumaPorCasilla(inmuebleId, ejercicio);
}

// ── Recurring generation (writes only to gastosInmueble) ──

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function calcularMesesAplicables(rule: OpexRule, _ejercicio: number): number[] {
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
  const rules = await db.getAllFromIndex('opexRules', 'propertyId', inmuebleId);
  let creadas = 0;

  for (const rule of rules.filter((item) => item.activo)) {
    if (rule.id == null) continue;

    const casillaAEAT = (rule.casillaAEAT as AEATBox | undefined) || OPEX_CATEGORY_TO_AEAT_BOX[rule.categoria as keyof typeof OPEX_CATEGORY_TO_AEAT_BOX];
    if (!casillaAEAT) continue;

    for (const mes of calcularMesesAplicables(rule, ejercicio)) {
      // Dedup: check gastosInmueble by origenId
      const origenId = `recurrente-${rule.id}-${ejercicio}-${mes}`;
      const existentes = await gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ejercicio);
      const yaExiste = existentes.some(g =>
        g.origen === 'recurrente' && g.origenId === origenId
      );
      if (yaExiste) continue;

      // Also check by concepto+mes for legacy dedup
      const duplicadoPorMes = existentes.some(g =>
        g.origen === 'recurrente'
        && g.casillaAEAT === casillaAEAT
        && g.concepto?.includes(MESES[mes - 1])
        && Math.abs(g.importe - getRecurringAmountForMonth(rule, mes)) < 0.01
      );
      if (duplicadoPorMes) continue;

      const total = getRecurringAmountForMonth(rule, mes);
      if (total <= 0) continue;

      const fechaOp = `${ejercicio}-${String(mes).padStart(2, '0')}-${String(rule.diaCobro || 1).padStart(2, '0')}`;
      const conceptoOp = `${rule.concepto} — ${MESES[mes - 1]}`;

      await gastosInmuebleService.add({
        inmuebleId,
        ejercicio,
        fecha: fechaOp,
        concepto: conceptoOp,
        categoria: mapCasillaToCategoria(casillaAEAT),
        casillaAEAT: casillaAEAT as any,
        importe: total,
        origen: 'recurrente',
        origenId,
        estado: 'previsto',
        proveedorNIF: rule.proveedorNIF || undefined,
        proveedorNombre: rule.proveedorNombre || undefined,
      });
      creadas += 1;
    }
  }

  return creadas;
}

export async function generarOperacionesDesdeIntereses(inmuebleId: number, ejercicio: number): Promise<number> {
  const prestamos = await prestamosService.getPrestamosByProperty(String(inmuebleId));
  if (!prestamos.length) return 0;

  let creadas = 0;

  for (const prestamo of prestamos) {
    if (!prestamo.activo) continue;

    const porcentaje = prestamosService.getPorcentajeAfectacion(prestamo, String(inmuebleId));
    if (porcentaje <= 0) continue;
    const factor = porcentaje / 100;

    let plan = await prestamosService.getPaymentPlan(prestamo.id);
    if (!plan) {
      plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
    }

    const existentes = await gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ejercicio);

    for (const periodo of plan.periodos) {
      const fechaCargo = new Date(periodo.fechaCargo);
      if (fechaCargo.getFullYear() !== ejercicio || periodo.interes <= 0) continue;
      const mes = fechaCargo.getMonth() + 1;

      const origenId = `prestamo-${prestamo.id}-${ejercicio}-${mes}`;
      const yaExiste = existentes.some(g => g.origenId === origenId);
      if (yaExiste) continue;

      const interesProporcion = Math.round(periodo.interes * factor * 100) / 100;
      if (interesProporcion <= 0) continue;

      const conceptoInt = `Intereses ${prestamo.nombre} — ${MESES[mes - 1]}${factor < 1 ? ` (${porcentaje}%)` : ''}`;

      await gastosInmuebleService.add({
        inmuebleId,
        ejercicio,
        fecha: periodo.fechaCargo,
        concepto: conceptoInt,
        categoria: 'intereses',
        casillaAEAT: '0105',
        importe: interesProporcion,
        origen: 'prestamo',
        origenId,
        estado: 'previsto',
        proveedorNombre: prestamo.nombre || undefined,
      });
      creadas += 1;
    }
  }

  return creadas;
}

export async function limpiarDuplicadosRecurrentes(
  inmuebleId: number,
  ejercicio: number
): Promise<number> {
  const gastos = await gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ejercicio);
  const recurrentes = gastos.filter(g => g.origen === 'recurrente' || g.origen === 'prestamo');

  const seen = new Map<string, number>();
  const toDelete: number[] = [];

  for (const g of recurrentes) {
    if (g.id == null) continue;
    const mes = new Date(g.fecha).getMonth() + 1;
    const key = `${g.origenId ?? 'null'}-${g.casillaAEAT}-${mes}`;
    if (!seen.has(key)) {
      seen.set(key, g.id);
    } else {
      toDelete.push(g.id);
    }
  }

  for (const id of toDelete) {
    await gastosInmuebleService.delete(id);
  }

  return toDelete.length;
}

export async function limpiarTodosDuplicadosEjercicio(ejercicio: number): Promise<number> {
  const db = await initDB();
  const properties = await db.getAll('properties');
  let totalEliminados = 0;

  for (const prop of properties) {
    if (!prop.id) continue;
    const eliminados = await limpiarDuplicadosRecurrentes(prop.id, ejercicio);
    if (eliminados > 0) {
      console.log(`Inmueble ${prop.alias || prop.id}: ${eliminados} duplicados eliminados`);
    }
    totalEliminados += eliminados;
  }

  console.log(`Total duplicados eliminados para ${ejercicio}: ${totalEliminados}`);
  return totalEliminados;
}
