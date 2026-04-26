import { initDB, OpexRule, OpexCategory, OpexFrequency } from './db';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';

// ─── Mapeo OpexCategory → CategoriaGastoCompromiso ────────────────────────

const OPEX_CAT_TO_COMPROMISO_CAT: Record<OpexCategory, string> = {
  comunidad: 'inmueble.comunidad',
  impuesto: 'inmueble.ibi',
  seguro: 'inmueble.seguros',
  suministro: 'inmueble.suministros',
  gestion: 'inmueble.gestionAlquiler',
  servicio: 'inmueble.opex',
  otro: 'inmueble.opex',
};

const COMPROMISO_CAT_TO_OPEX_CAT: Record<string, OpexCategory> = {
  'inmueble.comunidad': 'comunidad',
  'inmueble.ibi': 'impuesto',
  'inmueble.seguros': 'seguro',
  'inmueble.suministros': 'suministro',
  'inmueble.gestionAlquiler': 'gestion',
  'inmueble.opex': 'servicio',
};

const OPEX_CAT_TO_TIPO: Record<OpexCategory, CompromisoRecurrente['tipo']> = {
  comunidad: 'comunidad',
  impuesto: 'impuesto',
  seguro: 'seguro',
  suministro: 'suministro',
  gestion: 'otros',
  servicio: 'otros',
  otro: 'otros',
};

// ─── Conversión OpexRule ↔ CompromisoRecurrente ────────────────────────────

function mapOpexRuleToCompromiso(
  rule: Omit<OpexRule, 'id' | 'createdAt' | 'updatedAt'>,
  now: string
): Omit<CompromisoRecurrente, 'id'> {
  let patron: CompromisoRecurrente['patron'];
  if (rule.frecuencia === 'mensual') {
    patron = { tipo: 'mensualDiaFijo', dia: rule.diaCobro ?? 1 };
  } else if (rule.frecuencia === 'meses_especificos' && rule.mesesCobro?.length) {
    patron = { tipo: 'anualMesesConcretos', mesesPago: rule.mesesCobro, diaPago: rule.diaCobro ?? 5 };
  } else if (rule.frecuencia === 'trimestral') {
    patron = { tipo: 'cadaNMeses', cadaNMeses: 3, mesAncla: rule.mesInicio ?? 1, dia: rule.diaCobro ?? 5 };
  } else if (rule.frecuencia === 'semestral') {
    patron = { tipo: 'cadaNMeses', cadaNMeses: 6, mesAncla: rule.mesInicio ?? 1, dia: rule.diaCobro ?? 5 };
  } else if (rule.frecuencia === 'anual') {
    patron = { tipo: 'anualMesesConcretos', mesesPago: [rule.mesInicio ?? 1], diaPago: rule.diaCobro ?? 5 };
  } else if (rule.frecuencia === 'bimestral') {
    patron = { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: rule.mesInicio ?? 1, dia: rule.diaCobro ?? 5 };
  } else {
    patron = { tipo: 'mensualDiaFijo', dia: rule.diaCobro ?? 1 };
  }

  let importe: CompromisoRecurrente['importe'];
  if (rule.asymmetricPayments?.length) {
    const importesPorPago: Record<number, number> = {};
    for (const p of rule.asymmetricPayments) { importesPorPago[p.mes] = p.importe; }
    importe = { modo: 'porPago', importesPorPago };
  } else {
    importe = { modo: 'fijo', importe: rule.importeEstimado };
  }

  return {
    ambito: 'inmueble',
    inmuebleId: rule.propertyId,
    alias: rule.concepto,
    tipo: OPEX_CAT_TO_TIPO[rule.categoria] ?? 'otros',
    subtipo: rule.subtypeKey,
    proveedor: {
      nombre: rule.proveedorNombre || 'Sin proveedor',
      nif: rule.proveedorNIF,
      referencia: rule.invoiceNumber,
    },
    patron,
    importe,
    cuentaCargo: rule.accountId ?? 0,
    conceptoBancario: rule.proveedorNombre || rule.concepto,
    metodoPago: 'domiciliacion',
    categoria: OPEX_CAT_TO_COMPROMISO_CAT[rule.categoria] as any ?? 'inmueble.opex',
    bolsaPresupuesto: 'inmueble',
    responsable: 'titular',
    fechaInicio: now,
    estado: rule.activo ? 'activo' : 'pausado',
    // Serialize original OpexRule fields not covered by CompromisoRecurrente schema
    notas: JSON.stringify({ _opexCategoria: rule.categoria, _opexCasillaAEAT: rule.casillaAEAT }),
    createdAt: now,
    updatedAt: now,
  };
}

export function mapCompromisoToOpexRule(c: CompromisoRecurrente): OpexRule {
  let frecuencia: OpexFrequency = 'mensual';
  let mesesCobro: number[] | undefined;
  let diaCobro: number | undefined;
  let mesInicio: number | undefined;

  if (c.patron.tipo === 'mensualDiaFijo') {
    frecuencia = 'mensual';
    diaCobro = c.patron.dia;
  } else if (c.patron.tipo === 'anualMesesConcretos') {
    const meses = c.patron.mesesPago;
    diaCobro = c.patron.diaPago;
    if (meses.length === 1) {
      frecuencia = 'anual';
      mesInicio = meses[0];
    } else {
      frecuencia = 'meses_especificos';
      mesesCobro = meses;
    }
  } else if (c.patron.tipo === 'cadaNMeses') {
    const n = c.patron.cadaNMeses;
    frecuencia = n === 2 ? 'bimestral' : n === 3 ? 'trimestral' : n === 6 ? 'semestral' : 'mensual';
    mesInicio = c.patron.mesAncla;
    diaCobro = c.patron.dia;
  }

  let importeEstimado = 0;
  let asymmetricPayments: OpexRule['asymmetricPayments'];
  if (c.importe.modo === 'fijo') {
    importeEstimado = c.importe.importe;
  } else if (c.importe.modo === 'porPago') {
    const vals = Object.values(c.importe.importesPorPago);
    importeEstimado = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    asymmetricPayments = Object.entries(c.importe.importesPorPago).map(
      ([mes, imp]) => ({ mes: Number(mes), importe: imp })
    );
  } else if (c.importe.modo === 'variable') {
    importeEstimado = c.importe.importeMedio;
  }

  // Recover original OpexRule.categoria from notas if available
  let categoria: OpexCategory = COMPROMISO_CAT_TO_OPEX_CAT[c.categoria as string] ?? 'servicio';
  let casillaAEAT: string | undefined;
  try {
    if (c.notas) {
      const extras = JSON.parse(c.notas) as { _opexCategoria?: string; _opexCasillaAEAT?: string };
      if (extras._opexCategoria) categoria = extras._opexCategoria as OpexCategory;
      if (extras._opexCasillaAEAT) casillaAEAT = extras._opexCasillaAEAT;
    }
  } catch { /* ignore malformed notas */ }

  return {
    id: c.id,
    propertyId: c.inmuebleId!,
    accountId: c.cuentaCargo || undefined,
    categoria,
    concepto: c.alias,
    importeEstimado,
    frecuencia,
    mesesCobro,
    diaCobro,
    mesInicio,
    asymmetricPayments,
    activo: c.estado === 'activo',
    casillaAEAT: casillaAEAT as any,
    proveedorNIF: c.proveedor.nif,
    proveedorNombre: c.proveedor.nombre !== 'Sin proveedor' ? c.proveedor.nombre : undefined,
    invoiceNumber: c.proveedor.referencia,
    subtypeKey: c.subtipo,
    businessType: 'recurrente',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

type OpexRuleInput = Omit<OpexRule, 'id' | 'createdAt' | 'updatedAt'>;

const createRule = (
  propertyId: number,
  accountId: number | undefined,
  categoria: OpexCategory,
  concepto: string,
  frecuencia: OpexFrequency
): OpexRuleInput => ({
  propertyId,
  accountId,
  categoria,
  concepto,
  importeEstimado: 0,
  frecuencia,
  activo: true,
  businessType: 'recurrente',
});

/**
 * Adds rules to compromisosRecurrentes, skipping any that already exist
 * (by alias + inmuebleId + ambito='inmueble').
 * NOTE: Writes go to compromisosRecurrentes (V5.4+). opexRules is DEPRECATED.
 */
const addRulesIfNotExist = async (rules: OpexRuleInput[]): Promise<void> => {
  const db = await initDB();
  const now = new Date().toISOString();

  for (const rule of rules) {
    const existing = await db.getAllFromIndex('compromisosRecurrentes', 'inmuebleId', rule.propertyId);
    const alreadyExists = existing.some(
      (c) => c.ambito === 'inmueble' && c.alias.toLowerCase() === rule.concepto.toLowerCase()
    );
    if (!alreadyExists) {
      const compromiso = mapOpexRuleToCompromiso(rule, now);
      await db.add('compromisosRecurrentes', compromiso as CompromisoRecurrente);
    }
  }
};

/**
 * Generates base OPEX rules (at €0) for a property:
 * IBI (anual), Basuras (anual), Comunidad (mensual), Seguro Hogar (anual),
 * Luz (mensual), Agua (bimestral), Gas (bimestral).
 * NOTE: Writes to compromisosRecurrentes (V5.4+). opexRules is DEPRECATED.
 */
export const generateBaseOpexForProperty = async (
  propertyId: number,
  accountId?: number
): Promise<void> => {
  const baseRules: OpexRuleInput[] = [
    createRule(propertyId, accountId, 'impuesto', 'IBI', 'anual'),
    createRule(propertyId, accountId, 'impuesto', 'Basuras', 'anual'),
    createRule(propertyId, accountId, 'comunidad', 'Comunidad', 'mensual'),
    createRule(propertyId, accountId, 'seguro', 'Seguro Hogar', 'anual'),
    createRule(propertyId, accountId, 'suministro', 'Luz', 'mensual'),
    createRule(propertyId, accountId, 'suministro', 'Agua', 'bimestral'),
    createRule(propertyId, accountId, 'suministro', 'Gas', 'bimestral'),
  ];
  await addRulesIfNotExist(baseRules);
};

/**
 * Injects contract-specific OPEX rules for a property based on the contract type.
 * Supported types: 'coliving', 'vacacional', 'tradicional'.
 * NOTE: Writes to compromisosRecurrentes (V5.4+). opexRules is DEPRECATED.
 */
export const injectContractOpex = async (
  propertyId: number,
  contractType: string,
  accountId?: number
): Promise<void> => {
  let contractRules: OpexRuleInput[] = [];

  if (contractType === 'coliving') {
    contractRules = [
      createRule(propertyId, accountId, 'suministro', 'Internet', 'mensual'),
      createRule(propertyId, accountId, 'servicio', 'Limpieza', 'mensual'),
      createRule(propertyId, accountId, 'servicio', 'Netflix/Suscripciones', 'mensual'),
      createRule(propertyId, accountId, 'gestion', 'Property Management', 'mensual'),
      createRule(propertyId, accountId, 'seguro', 'Seguro Impago', 'anual'),
    ];
  } else if (contractType === 'vacacional') {
    contractRules = [
      createRule(propertyId, accountId, 'suministro', 'Internet', 'mensual'),
      createRule(propertyId, accountId, 'servicio', 'Limpieza y Lavandería', 'mensual'),
      createRule(propertyId, accountId, 'servicio', 'Netflix', 'mensual'),
      createRule(propertyId, accountId, 'servicio', 'Channel Manager', 'mensual'),
      createRule(propertyId, accountId, 'gestion', 'Property Management', 'mensual'),
    ];
  } else if (contractType === 'tradicional') {
    contractRules = [
      createRule(propertyId, accountId, 'gestion', 'Property Management', 'mensual'),
      createRule(propertyId, accountId, 'seguro', 'Seguro Impago', 'anual'),
    ];
  }

  if (contractRules.length > 0) {
    await addRulesIfNotExist(contractRules);
  }
};

/**
 * Returns all OPEX rules for a given property.
 * Reads from compromisosRecurrentes (V5.4+), maps back to OpexRule for backward compatibility.
 */
export const getOpexRulesForProperty = async (propertyId: number): Promise<OpexRule[]> => {
  const db = await initDB();
  const compromisos = await db.getAllFromIndex('compromisosRecurrentes', 'inmuebleId', propertyId);
  return compromisos
    .filter((c) => c.ambito === 'inmueble')
    .map(mapCompromisoToOpexRule);
};

/**
 * Returns all active CompromisoRecurrente records for a given inmueble.
 * Preferred API for new code — avoids OpexRule mapping overhead.
 */
export const getCompromisosForInmueble = async (propertyId: number): Promise<CompromisoRecurrente[]> => {
  const db = await initDB();
  const compromisos = await db.getAllFromIndex('compromisosRecurrentes', 'inmuebleId', propertyId);
  return compromisos.filter((c) => c.ambito === 'inmueble');
};

/**
 * Deletes an OPEX rule by ID (deletes from compromisosRecurrentes).
 */
export const deleteOpexRule = async (id: number): Promise<void> => {
  const db = await initDB();
  await db.delete('compromisosRecurrentes', id);
};

/**
 * Creates or updates an OPEX rule in compromisosRecurrentes.
 * NOTE: Writes to compromisosRecurrentes (V5.4+). opexRules is DEPRECATED.
 */
export const saveOpexRule = async (rule: OpexRule): Promise<void> => {
  const db = await initDB();
  const now = new Date().toISOString();
  const compromiso: CompromisoRecurrente = {
    ...mapOpexRuleToCompromiso(rule, now),
    id: rule.id,
    createdAt: rule.createdAt ?? now,
    updatedAt: now,
  } as CompromisoRecurrente;

  if (rule.id !== undefined) {
    await db.put('compromisosRecurrentes', compromiso);
  } else {
    const { id: _id, ...compromisoSinId } = compromiso;
    await db.add('compromisosRecurrentes', compromisoSinId as CompromisoRecurrente);
  }
};

