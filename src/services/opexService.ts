// src/services/opexService.ts
// T-OPEX-RECONNECT (V69 · 2026-05-07): los 4 consumidores de la API legacy
// `OpexRule` delegan ahora en `compromisosRecurrentesService` (ámbito='inmueble')
// vía mapping bidireccional. El store `opexRules` sigue eliminado · DB_VERSION=69
// sigue intacta · NO se crean stores nuevos · NO se migran datos.
//
// Decisión Jose Q1 · Opción A: mantener API surface OpexRule (no se reescribe
// `OpexRuleForm` ni los 3 callers UI). El servicio actúa como fachada.

import { initDB, OpexRule, OpexCategory, OpexFrequency, AsymmetricPayment } from './db';
import {
  CompromisoRecurrente,
  PatronRecurrente,
  ImporteEvento,
  TipoCompromiso,
} from '../types/compromisosRecurrentes';
import {
  listarCompromisos,
  crearCompromiso,
  actualizarCompromiso,
  eliminarCompromiso,
} from './personal/compromisosRecurrentesService';

// Re-export types from db.ts for backward compatibility
export type { OpexRule, OpexCategory, OpexFrequency, OpexEstacionalidad, ExpenseBusinessType, AsymmetricPayment } from './db';

// ─── Mapping helpers · OpexCategory ↔ tipo + categoria string ──────────────

/**
 * OpexCategory → CompromisoRecurrente.tipo (TipoCompromiso).
 * Cubre las 7 categorías del enum OpexRule.categoria.
 */
function mapCategoriaToTipo(categoria: OpexCategory): TipoCompromiso {
  switch (categoria) {
    case 'comunidad':  return 'comunidad';
    case 'impuesto':   return 'impuesto';
    case 'seguro':     return 'seguro';
    case 'suministro': return 'suministro';
    case 'servicio':   return 'suscripcion';
    case 'gestion':    return 'otros';
    case 'otro':       return 'otros';
  }
}

/**
 * OpexCategory → CompromisoRecurrente.categoria (string normalizada inmueble.*).
 */
function mapCategoriaToCategoriaCompromiso(categoria: OpexCategory, concepto?: string): string {
  switch (categoria) {
    case 'comunidad':  return 'inmueble.comunidad';
    case 'impuesto':   return 'inmueble.ibi';
    case 'seguro':     return 'inmueble.seguros';
    case 'suministro': return 'inmueble.suministros';
    case 'gestion':    return 'inmueble.gestionAlquiler';
    case 'servicio':   return 'inmueble.opex';
    case 'otro': {
      // Heurística: si el concepto sugiere reparación/conservación lo dejamos
      // en `inmueble.otros`. La fuente de verdad para reparaciones es
      // mejorasInmueble/gastosInmueble — no compromisos recurrentes.
      const c = (concepto ?? '').toLowerCase();
      if (c.includes('repar') || c.includes('conserv')) return 'inmueble.otros';
      return 'inmueble.otros';
    }
  }
}

/**
 * tipo + categoria string (CompromisoRecurrente) → OpexCategory.
 * Prioriza la categoria string normalizada cuando aporta información (es más
 * específica que `tipo`).
 */
function mapTipoToCategoria(
  tipo: TipoCompromiso,
  categoria?: string,
): OpexCategory {
  if (categoria) {
    switch (categoria) {
      case 'inmueble.comunidad':       return 'comunidad';
      case 'inmueble.ibi':             return 'impuesto';
      case 'inmueble.seguros':         return 'seguro';
      case 'inmueble.suministros':     return 'suministro';
      case 'inmueble.gestionAlquiler': return 'gestion';
      case 'inmueble.opex':            return 'servicio';
      case 'inmueble.otros':           return 'otro';
    }
  }
  switch (tipo) {
    case 'comunidad':  return 'comunidad';
    case 'impuesto':   return 'impuesto';
    case 'seguro':     return 'seguro';
    case 'suministro': return 'suministro';
    case 'suscripcion': return 'servicio';
    case 'cuota':      return 'gestion';
    case 'otros':      return 'otro';
  }
}

// ─── Mapping helpers · frecuencia ↔ patron ──────────────────────────────────

function mapFrecuenciaToPatron(rule: Pick<OpexRule, 'frecuencia' | 'diaCobro' | 'mesInicio' | 'mesesCobro'>): PatronRecurrente {
  const dia = rule.diaCobro && rule.diaCobro >= 1 && rule.diaCobro <= 31 ? rule.diaCobro : 1;
  const mesAncla = rule.mesInicio && rule.mesInicio >= 1 && rule.mesInicio <= 12 ? rule.mesInicio : 1;
  switch (rule.frecuencia) {
    case 'mensual':
      return { tipo: 'mensualDiaFijo', dia };
    case 'bimestral':
      return { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla, dia };
    case 'trimestral':
      return { tipo: 'cadaNMeses', cadaNMeses: 3, mesAncla, dia };
    case 'semestral':
      return { tipo: 'cadaNMeses', cadaNMeses: 6, mesAncla, dia };
    case 'anual':
      return { tipo: 'anualMesesConcretos', mesesPago: [mesAncla], diaPago: dia };
    case 'meses_especificos': {
      const meses = Array.isArray(rule.mesesCobro) && rule.mesesCobro.length > 0
        ? [...rule.mesesCobro].sort((a, b) => a - b)
        : [mesAncla];
      return { tipo: 'anualMesesConcretos', mesesPago: meses, diaPago: dia };
    }
    case 'semanal':
      // Aproximación · CompromisoRecurrente no soporta semanal nativo. Se
      // representa como mensual día fijo (genera 12 eventos/año vs 52). Es
      // una pérdida de información asumida (semanal no es un caso típico
      // para gastos recurrentes de inmueble).
      return { tipo: 'mensualDiaFijo', dia };
  }
}

function mapPatronToFrecuencia(patron: PatronRecurrente): Pick<OpexRule, 'frecuencia' | 'diaCobro' | 'mesInicio' | 'mesesCobro'> {
  switch (patron.tipo) {
    case 'mensualDiaFijo':
      return { frecuencia: 'mensual', diaCobro: patron.dia };
    case 'mensualDiaRelativo':
      return { frecuencia: 'mensual', diaCobro: 1 };
    case 'cadaNMeses': {
      const dia = patron.dia;
      const mesAncla = patron.mesAncla;
      switch (patron.cadaNMeses) {
        case 1:  return { frecuencia: 'mensual', diaCobro: dia, mesInicio: mesAncla };
        case 2:  return { frecuencia: 'bimestral', diaCobro: dia, mesInicio: mesAncla };
        case 3:  return { frecuencia: 'trimestral', diaCobro: dia, mesInicio: mesAncla };
        case 6:  return { frecuencia: 'semestral', diaCobro: dia, mesInicio: mesAncla };
        case 12: return { frecuencia: 'anual', diaCobro: dia, mesInicio: mesAncla };
        default: {
          const meses: number[] = [];
          for (let m = mesAncla; m <= 12; m += patron.cadaNMeses) meses.push(m);
          return { frecuencia: 'meses_especificos', diaCobro: dia, mesInicio: mesAncla, mesesCobro: meses };
        }
      }
    }
    case 'trimestralFiscal':
      return { frecuencia: 'trimestral', diaCobro: patron.diaPago, mesInicio: 1 };
    case 'anualMesesConcretos': {
      if (patron.mesesPago.length === 1) {
        return { frecuencia: 'anual', diaCobro: patron.diaPago, mesInicio: patron.mesesPago[0] };
      }
      return {
        frecuencia: 'meses_especificos',
        diaCobro: patron.diaPago,
        mesInicio: patron.mesesPago[0],
        mesesCobro: [...patron.mesesPago].sort((a, b) => a - b),
      };
    }
    case 'pagasExtra':
      return {
        frecuencia: 'meses_especificos',
        diaCobro: 1,
        mesInicio: patron.mesesExtra[0] ?? 1,
        mesesCobro: [...patron.mesesExtra].sort((a, b) => a - b),
      };
    case 'variablePorMes':
      return {
        frecuencia: 'meses_especificos',
        diaCobro: 1,
        mesInicio: patron.mesesPago[0] ?? 1,
        mesesCobro: [...patron.mesesPago].sort((a, b) => a - b),
      };
    case 'puntual': {
      const fecha = new Date(patron.fecha);
      return {
        frecuencia: 'anual',
        diaCobro: isNaN(fecha.getTime()) ? 1 : fecha.getDate(),
        mesInicio: isNaN(fecha.getTime()) ? 1 : fecha.getMonth() + 1,
      };
    }
  }
}

// ─── Mapping helpers · importe ↔ importeEstimado + asymmetricPayments ──────

function mapImporteEstimadoToImporte(rule: Pick<OpexRule, 'frecuencia' | 'importeEstimado' | 'asymmetricPayments' | 'mesesCobro'>): ImporteEvento {
  if (
    rule.frecuencia === 'meses_especificos' &&
    Array.isArray(rule.asymmetricPayments) &&
    rule.asymmetricPayments.length > 0
  ) {
    const importesPorPago: Record<number, number> = {};
    for (const p of rule.asymmetricPayments) {
      importesPorPago[p.mes] = p.importe;
    }
    return { modo: 'porPago', importesPorPago };
  }
  return { modo: 'fijo', importe: rule.importeEstimado || 0 };
}

function mapImporteToImporteEstimado(
  importe: ImporteEvento,
  frecuencia: OpexFrequency,
  mesesCobro?: number[],
): { importeEstimado: number; asymmetricPayments?: AsymmetricPayment[] } {
  switch (importe.modo) {
    case 'fijo':
      return { importeEstimado: importe.importe || 0 };
    case 'variable':
      return { importeEstimado: importe.importeMedio || 0 };
    case 'diferenciadoPorMes': {
      const valores = importe.importesPorMes || [];
      const meses = (frecuencia === 'meses_especificos' && mesesCobro?.length)
        ? mesesCobro
        : valores.map((v, i) => v > 0 ? i + 1 : -1).filter((m) => m > 0);
      const asymmetricPayments: AsymmetricPayment[] = meses.map((m) => ({
        mes: m,
        importe: valores[m - 1] || 0,
      }));
      const total = asymmetricPayments.reduce((s, p) => s + p.importe, 0);
      const promedio = asymmetricPayments.length > 0 ? total / asymmetricPayments.length : 0;
      return { importeEstimado: Math.round(promedio * 100) / 100, asymmetricPayments };
    }
    case 'porPago': {
      const entries = Object.entries(importe.importesPorPago || {});
      const asymmetricPayments: AsymmetricPayment[] = entries
        .map(([mes, imp]) => ({ mes: parseInt(mes, 10), importe: imp }))
        .filter((p) => p.mes >= 1 && p.mes <= 12)
        .sort((a, b) => a.mes - b.mes);
      const total = asymmetricPayments.reduce((s, p) => s + p.importe, 0);
      const promedio = asymmetricPayments.length > 0 ? total / asymmetricPayments.length : 0;
      return { importeEstimado: Math.round(promedio * 100) / 100, asymmetricPayments };
    }
  }
}

// ─── Mappings principales ──────────────────────────────────────────────────

/**
 * CompromisoRecurrente → OpexRule (legacy API).
 * Devuelve null si el compromiso no es de ámbito inmueble (no aplica al
 * dominio OpexRule).
 */
export function mapCompromisoToOpexRule(compromiso: CompromisoRecurrente): OpexRule | null {
  if (compromiso.ambito !== 'inmueble') return null;
  if (!compromiso.inmuebleId) return null;
  if (compromiso.id == null) return null;

  const { frecuencia, diaCobro, mesInicio, mesesCobro } = mapPatronToFrecuencia(compromiso.patron);
  const { importeEstimado, asymmetricPayments } = mapImporteToImporteEstimado(
    compromiso.importe,
    frecuencia,
    mesesCobro,
  );

  return {
    id: compromiso.id,
    propertyId: compromiso.inmuebleId,
    accountId: compromiso.cuentaCargo > 0 ? compromiso.cuentaCargo : undefined,
    categoria: mapTipoToCategoria(compromiso.tipo, compromiso.categoria),
    concepto: compromiso.alias,
    importeEstimado,
    frecuencia,
    mesesCobro,
    diaCobro,
    mesInicio,
    asymmetricPayments,
    proveedorNIF: compromiso.proveedor?.nif,
    proveedorNombre: compromiso.proveedor?.nombre,
    activo: compromiso.estado === 'activo',
    subtypeKey: compromiso.subtipo,
    createdAt: compromiso.createdAt,
    updatedAt: compromiso.updatedAt,
  };
}

/**
 * OpexRule (legacy API) → CompromisoRecurrente (parcial · faltan id/createdAt).
 * Producir un objeto listo para `crearCompromiso` o `actualizarCompromiso`.
 */
export function mapOpexRuleToCompromiso(
  rule: Omit<OpexRule, 'createdAt' | 'updatedAt'> & { id?: number },
): Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'> {
  const patron = mapFrecuenciaToPatron(rule);
  const importe = mapImporteEstimadoToImporte(rule);
  const categoriaCompromiso = mapCategoriaToCategoriaCompromiso(rule.categoria, rule.concepto);

  return {
    ambito: 'inmueble',
    inmuebleId: rule.propertyId,
    alias: rule.concepto || 'Gasto recurrente',
    tipo: mapCategoriaToTipo(rule.categoria),
    subtipo: rule.subtypeKey,
    proveedor: {
      nombre: rule.proveedorNombre || rule.concepto || 'Proveedor',
      nif: rule.proveedorNIF,
    },
    patron,
    importe,
    cuentaCargo: rule.accountId ?? 0,
    conceptoBancario: rule.proveedorNombre || rule.concepto || 'Gasto recurrente',
    metodoPago: 'domiciliacion',
    categoria: categoriaCompromiso,
    bolsaPresupuesto: 'inmueble',
    responsable: 'titular',
    fechaInicio: new Date().toISOString().slice(0, 10),
    estado: rule.activo ? 'activo' : 'pausado',
    derivadoDe: { fuente: 'opexRule', refId: rule.id },
  };
}

// ─── CRUD · API surface OpexRule delegando a compromisosRecurrentes ─────────

/**
 * Lectura · todos los compromisos de un inmueble como OpexRule[].
 */
export async function getOpexRulesForProperty(propertyId: number): Promise<OpexRule[]> {
  const compromisos = await listarCompromisos({
    ambito: 'inmueble',
    inmuebleId: propertyId,
  });
  return compromisos
    .map(mapCompromisoToOpexRule)
    .filter((rule): rule is OpexRule => rule !== null);
}

/**
 * Crear o actualizar un OpexRule (delega en compromisosRecurrentesService).
 * Devuelve la regla mapeada de vuelta para que la UI tenga el id real.
 */
export async function saveOpexRule(
  rule: Omit<OpexRule, 'createdAt' | 'updatedAt'> & { id?: number },
): Promise<OpexRule | null> {
  try {
    const compromisoData = mapOpexRuleToCompromiso(rule);
    if (rule.id != null) {
      // Preservar fechaInicio existente al actualizar (no la pisamos con hoy)
      const { fechaInicio: _ignorada, ...patch } = compromisoData;
      const actualizado = await actualizarCompromiso(rule.id, patch);
      return mapCompromisoToOpexRule(actualizado);
    }
    const creado = await crearCompromiso(compromisoData);
    return mapCompromisoToOpexRule(creado);
  } catch (error) {
    console.error('[opexService.saveOpexRule] error', error);
    return null;
  }
}

/**
 * Eliminar un OpexRule (delega en compromisosRecurrentesService.eliminarCompromiso).
 */
export async function deleteOpexRule(ruleId: number): Promise<void> {
  if (ruleId == null) return;
  await eliminarCompromiso(ruleId);
}

/**
 * @deprecated · T-OPEX-RECONNECT (V69) · ya no necesario.
 * El modelo `compromisosRecurrentes` no usa filas placeholder a 0€ — la UI
 * detecta ausencia y propone "+ categoría". Se mantiene como noop para no
 * romper imports existentes hasta la próxima limpieza.
 */
export async function generateBaseOpexForProperty(
  propertyId: number,
  _accountId?: number,
): Promise<void> {
  console.info(
    '[opexService.generateBaseOpexForProperty] deprecated · noop',
    { propertyId },
  );
}

/**
 * Atajo legacy · devuelve los compromisos crudos de un inmueble. Útil para
 * consumidores que quieran trabajar con la entidad real (no el wrapper
 * OpexRule). Mantiene compatibilidad con uso histórico.
 */
export async function getCompromisosForInmueble(propertyId: number): Promise<CompromisoRecurrente[]> {
  try {
    const db = await initDB();
    const compromisos = await db.getAllFromIndex('compromisosRecurrentes', 'inmuebleId', propertyId);
    return compromisos.filter((c) => c.ambito === 'inmueble');
  } catch (error) {
    console.error('[opexService] Error getting compromisos:', error);
    return [];
  }
}

/**
 * @deprecated · T-OPEX-RECONNECT (V69) · noop. La inyección de OPEX por tipo
 * de contrato la realiza ahora el flujo de creación de contratos directamente
 * sobre `compromisosRecurrentes` cuando aplique.
 */
export async function injectContractOpex(
  _propertyId: number,
  _contractType: string,
  _accountId?: number,
): Promise<void> {
  // Noop intencional · ver T-OPEX-RECONNECT
}
