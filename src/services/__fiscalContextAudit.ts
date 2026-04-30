/**
 * TAREA 14.1 · utilidad interna de auditoría del contexto fiscal.
 *
 * Prefijo `__` indica herramienta de desarrollo · NO importar desde código
 * de producción. Únicos consumidores legítimos:
 *   - `src/pages/dev/FiscalContextAudit.tsx` (página DEV-only `/dev/fiscal-context-audit`)
 *   - tests
 *
 * Lee los 4 sitios donde vive información fiscal en ATLAS:
 *   1. store `personalData`        — perfil fiscal núcleo
 *   2. store `personalModuleConfig` — flags UI/integración (NO fiscal)
 *   3. store `viviendaHabitual`    — datos catastral/adquisición/IBI
 *   4. keyval['configFiscal']      — documentada pero sin escritor activo
 *
 * No muta ni borra nada · solo lee y devuelve un report estructurado.
 */

import { initDB } from './db';
import type { PersonalData, PersonalModuleConfig } from '../types/personal';
import type { ViviendaHabitual } from '../types/viviendaHabitual';

// ─── Tipos del report ────────────────────────────────────────────────────────

export type FiscalSiteStatus = 'populated' | 'empty' | 'not_found';

export interface FiscalFieldAudit {
  field: string;
  present: boolean;
  valueType: string;
  byteSize: number;
  note?: string;
}

export interface PersonalDataAudit {
  status: FiscalSiteStatus;
  record: PersonalData | null;
  fiscalFields: FiscalFieldAudit[];
}

export interface PersonalModuleConfigAudit {
  status: FiscalSiteStatus;
  record: PersonalModuleConfig | null;
  fields: FiscalFieldAudit[];
}

export interface ViviendaHabitualAudit {
  status: FiscalSiteStatus;
  viviendaActiva: ViviendaHabitual | null;
  totalRegistros: number;
  fiscalFields: FiscalFieldAudit[];
}

export interface ConfigFiscalKeyvalAudit {
  status: FiscalSiteStatus;
  value: unknown;
  byteSize: number;
  note: string;
}

export interface FiscalContextAuditReport {
  generatedAt: string;
  personalData: PersonalDataAudit;
  personalModuleConfig: PersonalModuleConfigAudit;
  viviendaHabitual: ViviendaHabitualAudit;
  configFiscalKeyval: ConfigFiscalKeyvalAudit;
  inconsistencias: string[];
  gapsCriticos: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function approximateByteSize(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return 0;
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch {
    return 0;
  }
}

function detectValueType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `array[${(value as unknown[]).length}]`;
  return typeof value;
}

function fieldAudit(
  field: string,
  value: unknown,
  note?: string,
): FiscalFieldAudit {
  const present =
    value !== undefined &&
    value !== null &&
    value !== '' &&
    !(Array.isArray(value) && (value as unknown[]).length === 0);
  return {
    field,
    present,
    valueType: detectValueType(value),
    byteSize: approximateByteSize(value),
    note,
  };
}

// ─── Auditoría personalData ──────────────────────────────────────────────────

async function auditPersonalData(db: Awaited<ReturnType<typeof initDB>>): Promise<PersonalDataAudit> {
  let record: PersonalData | null = null;
  try {
    const tx = db.transaction('personalData', 'readonly');
    record = (await tx.objectStore('personalData').get(1)) as PersonalData | null ?? null;
    await tx.done;
  } catch {
    record = null;
  }

  if (!record) {
    return {
      status: 'not_found',
      record: null,
      fiscalFields: [],
    };
  }

  const fiscalFields: FiscalFieldAudit[] = [
    fieldAudit('comunidadAutonoma', record.comunidadAutonoma,
      'CORE FISCAL · afecta reducciones autonómicas · no usada aún en irpfCalc (GAP §5.1)'),
    fieldAudit('tributacion', record.tributacion,
      'CORE FISCAL · individual/conjunta · afecta tablas IRPF'),
    fieldAudit('descendientes[]', record.descendientes,
      'CORE FISCAL · mínimos por descendiente · edad<3 da extra'),
    fieldAudit('ascendientes[]', record.ascendientes,
      'CORE FISCAL · mínimos por ascendiente (convive + edad≥65)'),
    fieldAudit('discapacidad', record.discapacidad,
      'CORE FISCAL · nivel discapacidad propio · 3 tramos'),
    fieldAudit('fechaNacimiento', record.fechaNacimiento,
      'CORE FISCAL · edad para mínimo contribuyente (≥65 +918€) · TODO en irpfCalc (GAP §5.2)'),
    fieldAudit('situacionPersonal', record.situacionPersonal,
      'CONTEXTUAL · soltero/casado/pareja-hecho/divorciado'),
    fieldAudit('situacionLaboral[]', record.situacionLaboral,
      'CONTEXTUAL · asalariado/autonomo/desempleado/jubilado'),
  ];

  const status: FiscalSiteStatus = fiscalFields.some((f) => f.present) ? 'populated' : 'empty';

  return { status, record, fiscalFields };
}

// ─── Auditoría personalModuleConfig ─────────────────────────────────────────

async function auditPersonalModuleConfig(db: Awaited<ReturnType<typeof initDB>>): Promise<PersonalModuleConfigAudit> {
  let record: PersonalModuleConfig | null = null;
  try {
    const tx = db.transaction('personalModuleConfig', 'readonly');
    record = (await tx.objectStore('personalModuleConfig').get(1)) as PersonalModuleConfig | null ?? null;
    await tx.done;
  } catch {
    record = null;
  }

  if (!record) {
    return {
      status: 'not_found',
      record: null,
      fields: [],
    };
  }

  const fields: FiscalFieldAudit[] = [
    fieldAudit('seccionesActivas.nomina', record.seccionesActivas?.nomina,
      'UI/INTEGRACIÓN · derivado de situacionLaboral · NO fiscal'),
    fieldAudit('seccionesActivas.autonomo', record.seccionesActivas?.autonomo,
      'UI/INTEGRACIÓN · derivado de situacionLaboral · NO fiscal'),
    fieldAudit('seccionesActivas.pensionesInversiones', record.seccionesActivas?.pensionesInversiones,
      'UI/INTEGRACIÓN · siempre true · NO fiscal'),
    fieldAudit('seccionesActivas.otrosIngresos', record.seccionesActivas?.otrosIngresos,
      'UI/INTEGRACIÓN · siempre true · NO fiscal'),
    fieldAudit('integracionTesoreria', record.integracionTesoreria,
      'UI/INTEGRACIÓN · siempre true · sin lector externo conocido'),
    fieldAudit('integracionProyecciones', record.integracionProyecciones,
      'UI/INTEGRACIÓN · siempre true · sin lector externo conocido'),
    fieldAudit('integracionFiscalidad', record.integracionFiscalidad,
      'UI/INTEGRACIÓN · siempre true · sin lector externo conocido'),
  ];

  return { status: 'populated', record, fields };
}

// ─── Auditoría viviendaHabitual ──────────────────────────────────────────────

async function auditViviendaHabitual(db: Awaited<ReturnType<typeof initDB>>): Promise<ViviendaHabitualAudit> {
  let all: ViviendaHabitual[] = [];
  try {
    const tx = db.transaction('viviendaHabitual', 'readonly');
    all = (await tx.objectStore('viviendaHabitual').getAll()) as ViviendaHabitual[];
    await tx.done;
  } catch {
    all = [];
  }

  const viviendaActiva = all.find((v) => v.activa) ?? null;

  if (all.length === 0) {
    return {
      status: 'not_found',
      viviendaActiva: null,
      totalRegistros: 0,
      fiscalFields: [],
    };
  }

  const data = viviendaActiva?.data ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;

  const fiscalFields: FiscalFieldAudit[] = [
    fieldAudit('data.tipo', d?.tipo,
      'VIVIENDA FISCAL · inquilino/propietarioSinHipoteca/propietarioConHipoteca'),
    fieldAudit('data.catastro.referenciaCatastral', d?.catastro?.referenciaCatastral,
      'VIVIENDA FISCAL · imputación rentas inmobiliarias (solo si prop.)'),
    fieldAudit('data.catastro.valorCatastral', d?.catastro?.valorCatastral,
      'VIVIENDA FISCAL · base imputación 1,1% o 2%'),
    fieldAudit('data.catastro.porcentajeTitularidad', d?.catastro?.porcentajeTitularidad,
      'VIVIENDA FISCAL · prorrateo si gananciales'),
    fieldAudit('data.catastro.catastralRevisado', d?.catastro?.catastralRevisado,
      'VIVIENDA FISCAL · decide % imputación (1,1 post-1994 · 2 pre-1994)'),
    fieldAudit('data.adquisicion.fecha', d?.adquisicion?.fecha,
      'VIVIENDA FISCAL · clave para deducción hipoteca pre-2013'),
    fieldAudit('data.adquisicion.gastosAdquisicion', d?.adquisicion?.gastosAdquisicion,
      'VIVIENDA FISCAL · valor adquisición para IRPF'),
    fieldAudit('data.ibi', d?.ibi,
      'VIVIENDA FISCAL · gasto deducible en inmueble no habitual'),
    fieldAudit('data.beneficioFiscal', d?.beneficioFiscal,
      'VIVIENDA FISCAL · deducción hipoteca anterior a 31/12/2012'),
    fieldAudit('data.contrato.rentaMensual', d?.contrato?.rentaMensual,
      'VIVIENDA FISCAL · base deducción alquiler (CCAA)'),
    fieldAudit('vigenciaDesde', viviendaActiva?.vigenciaDesde,
      'VIVIENDA FISCAL · inicio periodo para cálculo días'),
  ];

  const status: FiscalSiteStatus = all.length > 0 ? 'populated' : 'empty';

  return { status, viviendaActiva, totalRegistros: all.length, fiscalFields };
}

// ─── Auditoría keyval['configFiscal'] ───────────────────────────────────────

async function auditConfigFiscalKeyval(db: Awaited<ReturnType<typeof initDB>>): Promise<ConfigFiscalKeyvalAudit> {
  let value: unknown = undefined;
  try {
    const tx = db.transaction('keyval', 'readonly');
    value = await tx.objectStore('keyval').get('configFiscal');
    await tx.done;
  } catch {
    value = undefined;
  }

  const byteSize = approximateByteSize(value);
  const exists = value !== undefined && value !== null;

  return {
    status: exists ? 'populated' : 'not_found',
    value,
    byteSize,
    note: exists
      ? '⚠️ INESPERADO: keyval[configFiscal] tiene contenido a pesar de no tener escritor activo conocido. Documentar y esperar decisión Jose antes de cualquier acción.'
      : 'Confirmado: keyval[configFiscal] vacía. Sin escritor activo (T15.1 audit correcto). T14.2 puede decidir eliminarla.',
  };
}

// ─── Detección de inconsistencias ───────────────────────────────────────────

function detectarInconsistencias(
  pd: PersonalDataAudit,
  vivienda: ViviendaHabitualAudit,
): string[] {
  const inconsistencias: string[] = [];

  if (pd.record?.situacionPersonal === 'casado' && pd.record?.tributacion === undefined) {
    inconsistencias.push(
      'personalData.situacionPersonal=casado pero tributacion no está definida · el cálculo IRPF asumirá individual por defecto',
    );
  }

  if (
    pd.record &&
    vivienda.viviendaActiva
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = vivienda.viviendaActiva.data as any;
    const ccaaVivienda: string | undefined = d?.direccion?.ccaa;
    const ccaaPersonal = pd.record.comunidadAutonoma;
    if (ccaaVivienda && ccaaPersonal && ccaaVivienda !== ccaaPersonal) {
      inconsistencias.push(
        `CCAA de personalData ("${ccaaPersonal}") difiere de la CCAA en viviendaHabitual.data.direccion.ccaa ("${ccaaVivienda}") · verificar cuál es la correcta`,
      );
    }
  }

  return inconsistencias;
}

function detectarGapsCriticos(pd: PersonalDataAudit): string[] {
  const gaps: string[] = [];

  if (!pd.record?.comunidadAutonoma) {
    gaps.push('comunidadAutonoma no poblada · reducciones autonómicas IRPF no aplicables');
  }
  if (!pd.record?.tributacion) {
    gaps.push('tributacion no poblada · irpfCalc asumirá individual por defecto');
  }
  if (!pd.record?.fechaNacimiento) {
    gaps.push('fechaNacimiento no poblada · mínimo contribuyente por edad (≥65) no calculable');
  }

  return gaps;
}

// ─── Función principal ───────────────────────────────────────────────────────

export async function auditFiscalContext(): Promise<FiscalContextAuditReport> {
  const db = await initDB();

  const [pdAudit, pmcAudit, vhAudit, cfAudit] = await Promise.all([
    auditPersonalData(db),
    auditPersonalModuleConfig(db),
    auditViviendaHabitual(db),
    auditConfigFiscalKeyval(db),
  ]);

  const inconsistencias = detectarInconsistencias(pdAudit, vhAudit);
  const gapsCriticos = detectarGapsCriticos(pdAudit);

  return {
    generatedAt: new Date().toISOString(),
    personalData: pdAudit,
    personalModuleConfig: pmcAudit,
    viviendaHabitual: vhAudit,
    configFiscalKeyval: cfAudit,
    inconsistencias,
    gapsCriticos,
  };
}

/**
 * Helper · lee el valor crudo de un campo desde el report para
 * inspección en la página DEV.
 */
export function getFieldValue(
  report: FiscalContextAuditReport,
  site: 'personalData' | 'personalModuleConfig' | 'viviendaHabitual' | 'configFiscalKeyval',
  field: string,
): unknown {
  switch (site) {
    case 'personalData':
      return report.personalData.record
        ? (report.personalData.record as Record<string, unknown>)[field]
        : undefined;
    case 'personalModuleConfig':
      return report.personalModuleConfig.record
        ? (report.personalModuleConfig.record as Record<string, unknown>)[field]
        : undefined;
    case 'viviendaHabitual':
      return report.viviendaHabitual.viviendaActiva
        ? (report.viviendaHabitual.viviendaActiva as Record<string, unknown>)[field]
        : undefined;
    case 'configFiscalKeyval':
      return report.configFiscalKeyval.value;
    default:
      return undefined;
  }
}
