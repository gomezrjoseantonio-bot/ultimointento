import { initDB, OpexRule, OpexCategory, OpexFrequency } from './db';

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
});

/**
 * Adds rules to the database, skipping any that already exist (by concepto + propertyId).
 */
const addRulesIfNotExist = async (rules: OpexRuleInput[]): Promise<void> => {
  const db = await initDB();
  const now = new Date().toISOString();

  for (const rule of rules) {
    const existing = await db.getAllFromIndex('opexRules', 'propertyId', rule.propertyId);
    const alreadyExists = existing.some(
      (r) => r.concepto.toLowerCase() === rule.concepto.toLowerCase()
    );
    if (!alreadyExists) {
      await db.add('opexRules', { ...rule, createdAt: now, updatedAt: now } as OpexRule);
    }
  }
};

/**
 * Generates base OPEX rules (at €0) for a property:
 * IBI (anual), Basuras (anual), Comunidad (mensual), Seguro Hogar (anual),
 * Luz (mensual), Agua (bimestral), Gas (bimestral).
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
 */
export const getOpexRulesForProperty = async (propertyId: number): Promise<OpexRule[]> => {
  const db = await initDB();
  return db.getAllFromIndex('opexRules', 'propertyId', propertyId);
};

/**
 * Deletes an OPEX rule by ID.
 */
export const deleteOpexRule = async (id: number): Promise<void> => {
  const db = await initDB();
  await db.delete('opexRules', id);
};

/**
 * Creates or updates an OPEX rule.
 * If the rule has an id, it updates the existing rule; otherwise, it creates a new one.
 */
export const saveOpexRule = async (rule: OpexRule): Promise<void> => {
  const db = await initDB();
  const now = new Date().toISOString();
  if (rule.id !== undefined) {
    await db.put('opexRules', { ...rule, updatedAt: now });
  } else {
    await db.add('opexRules', { ...rule, createdAt: now, updatedAt: now });
  }
};
