// src/modules/mi-plan/services/budgetProjection.ts
//
// Helper compartido de proyección de presupuesto 12 meses.
// T20 Fase 3c · sub-tarea 20.3c · cierra **TODO-T20-01** documentado en
// docs/TAREA-20-pendientes.md.
//
// Combina los stores que ya están en DB para producir una proyección
// estructural mes a mes:
//   - Ingresos · `nominas` (vía `nominaService.calculateSalary` para
//                obtener neto mensual con variables/bonus/retenciones)
//                + `autonomos` (con calendario `fuentesIngreso`)
//   - Gastos   · `compromisosRecurrentes` ámbito 'personal' · evento mes
//                según patrón (mensualDiaFijo · cadaNMeses · anualMesesConcretos
//                · pagasExtra · variablePorMes · trimestralFiscal · puntual)
//   - Rentas   · `contracts` · sumar renta mensual de contratos vigentes
//                a fecha del mes proyectado (con fallback a campos legacy
//                `startDate`/`endDate`/`monthlyRent`)
//
// Uso ·
//   - Cashflow chart de Tesorería (`VistaGeneralTab`) · sustituye la
//     proyección lineal simple por esta proyección estructural.
//   - Mi Plan · Landing y Proyección leen directamente.

import type { Nomina, Autonomo } from '../../../types/personal';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import type { Contract } from '../../../services/db';
import { initDB } from '../../../services/db';
import { nominaService } from '../../../services/nominaService';
import {
  computeAutonomoIngresoAnualEstimado,
  computeCompromisoImporteEnMes,
} from '../../personal/helpers';

const MONTH_LABELS = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

const ESTADOS_INACTIVOS = new Set([
  'cancelado',
  'cancelada',
  'cancelled',
  'canceled',
  'finalizado',
  'finalizada',
  'finished',
  'ended',
  'terminated',
  'terminated early',
  'inactivo',
  'inactive',
  'rescindido',
]);

export interface MonthBudget {
  /** 1-12 */
  month: number;
  /** Etiqueta corta · "ENE" · "FEB"... */
  label: string;
  isCurrent: boolean;
  /** Total ingresos del mes (positivo). */
  entradas: number;
  /** Total gastos del mes (negativo · suma con signo). */
  salidas: number;
  /** entradas + salidas. */
  flujoNeto: number;
}

export interface BudgetProjection {
  year: number;
  months: MonthBudget[];
  /** Suma anual de entradas (positivo). */
  entradasAnuales: number;
  /** Suma anual de salidas (negativo). */
  salidasAnuales: number;
}

export interface BudgetProjectionData {
  nominas: Nomina[];
  autonomos: Autonomo[];
  compromisos: CompromisoRecurrente[];
  contracts: Contract[];
}

/**
 * Calcula la entrada NETA mensual que aporta una nómina en el mes `month` (0-11).
 * Usa `nominaService.calculateSalary` que ya distribuye variables/bonus/pagas
 * extra · resta retenciones (SS · IRPF · plan pensiones empleado · otras
 * deducciones). El neto mensual es comparable con los movimientos bancarios
 * reales (Tesorería).
 */
const ingresoNominaEnMes = (nomina: Nomina, month: number): number => {
  if (!nomina.activa) return 0;
  if (!nomina.salarioBrutoAnual || nomina.salarioBrutoAnual <= 0) return 0;
  try {
    const calc = nominaService.calculateSalary(nomina);
    const mes = calc.distribucionMensual.find((d) => d.mes === month + 1);
    return mes?.netoTotal ?? 0;
  } catch {
    // Fallback simple si calculateSalary falla por datos parciales.
    const meses = nomina.distribucion?.meses ?? 12;
    if (meses === 14) {
      const mensualidad = nomina.salarioBrutoAnual / 14;
      if (month === 5 || month === 11) return mensualidad * 2;
      return mensualidad;
    }
    return nomina.salarioBrutoAnual / 12;
  }
};

const ingresoAutonomoEnMes = (autonomo: Autonomo, month: number): number => {
  if (!autonomo.activo) return 0;
  if (autonomo.fuentesIngreso && autonomo.fuentesIngreso.length > 0) {
    return autonomo.fuentesIngreso.reduce((sum, f) => {
      const meses = f.meses ?? [];
      if (meses.length === 0 || meses.includes(month + 1)) {
        return sum + (f.importeEstimado ?? 0);
      }
      return sum;
    }, 0);
  }
  return computeAutonomoIngresoAnualEstimado(autonomo) / 12;
};

const gastoCompromisoEnMes = (
  compromiso: CompromisoRecurrente,
  year: number,
  month: number, // 0-11
): number => {
  if (compromiso.estado !== 'activo') return 0;
  if (compromiso.ambito !== 'personal') return 0;

  const patron = compromiso.patron;

  switch (patron.tipo) {
    case 'mensualDiaFijo':
    case 'mensualDiaRelativo':
      return computeCompromisoImporteEnMes(compromiso, month);
    case 'cadaNMeses': {
      const offset = (month + 1 - patron.mesAncla) % patron.cadaNMeses;
      if (offset !== 0) return 0;
      return computeCompromisoImporteEnMes(compromiso, month);
    }
    case 'anualMesesConcretos': {
      const meses = patron.mesesPago ?? [];
      if (!meses.includes(month + 1)) return 0;
      return computeCompromisoImporteEnMes(compromiso, month);
    }
    case 'trimestralFiscal': {
      if (![1, 4, 7, 10].includes(month + 1)) return 0;
      return computeCompromisoImporteEnMes(compromiso, month);
    }
    case 'pagasExtra': {
      const meses = patron.mesesExtra ?? [];
      if (!meses.includes(month + 1)) return 0;
      return computeCompromisoImporteEnMes(compromiso, month);
    }
    case 'variablePorMes': {
      const meses = patron.mesesPago ?? [];
      if (!meses.includes(month + 1)) return 0;
      const por = meses.length > 0 ? patron.importeObjetivoAnual / meses.length : 0;
      return por;
    }
    case 'puntual': {
      // Compara contra el `year` de la proyección · NO contra el actual.
      const d = new Date(patron.fecha);
      if (Number.isNaN(d.getTime())) return 0;
      if (d.getFullYear() !== year) return 0;
      if (d.getMonth() !== month) return 0;
      return patron.importe;
    }
    default:
      return 0;
  }
};

/**
 * Renta mensual de un contrato en el mes `month` del año `year`.
 * Soporta fallbacks legacy · `startDate`/`endDate`/`monthlyRent` y filtra
 * por `estadoContrato`/`status` cuando indica contrato terminado/inactivo.
 */
const ingresoContratoEnMes = (
  contrato: Contract,
  year: number,
  month: number, // 0-11
): number => {
  const contratoLegacy = contrato as Contract & {
    startDate?: string | Date;
    endDate?: string | Date;
    monthlyRent?: number;
    estadoContrato?: string;
    status?: string;
  };

  const fechaInicio = contrato.fechaInicio ?? contratoLegacy.startDate;
  const fechaFin = contrato.fechaFin ?? contratoLegacy.endDate;
  const rentaMensual = contrato.rentaMensual ?? contratoLegacy.monthlyRent ?? 0;
  const estado = (contratoLegacy.estadoContrato ?? contratoLegacy.status ?? '')
    .toString()
    .trim()
    .toLowerCase();

  if (!fechaInicio) return 0;
  if (rentaMensual <= 0) return 0;
  if (estado && ESTADOS_INACTIVOS.has(estado)) return 0;

  const ini = new Date(fechaInicio);
  if (Number.isNaN(ini.getTime())) return 0;

  const fin = fechaFin ? new Date(fechaFin) : null;
  if (fin && Number.isNaN(fin.getTime())) return 0;

  // Mes objetivo · primer día y fin de mes objetivo.
  const target = new Date(year, month, 1);
  const targetEnd = new Date(year, month + 1, 0);

  // Intersección con periodo del contrato. Si no hay fechaFin · contrato
  // abierto mientras el estado no lo marque como inactivo.
  if (ini > targetEnd) return 0;
  if (fin && fin < target) return 0;

  return rentaMensual;
};

/**
 * Calcula proyección 12 meses · síncrono · trabaja sobre arrays.
 * Esta es la **única función de cálculo** · el resto son thin wrappers.
 */
export const computeBudgetProjectionFromData = (
  year: number,
  data: BudgetProjectionData,
): BudgetProjection => {
  const today = new Date();
  const months: MonthBudget[] = Array.from({ length: 12 }, (_, i) => {
    let entradas = 0;
    let salidas = 0;
    data.nominas.forEach((n) => {
      entradas += ingresoNominaEnMes(n, i);
    });
    data.autonomos.forEach((a) => {
      entradas += ingresoAutonomoEnMes(a, i);
    });
    data.contracts.forEach((c) => {
      entradas += ingresoContratoEnMes(c, year, i);
    });
    data.compromisos.forEach((c) => {
      const importe = gastoCompromisoEnMes(c, year, i);
      // Garantizamos signo negativo para gastos.
      salidas += -Math.abs(importe);
    });
    return {
      month: i + 1,
      label: MONTH_LABELS[i],
      isCurrent: year === today.getFullYear() && i === today.getMonth(),
      entradas,
      salidas,
      flujoNeto: entradas + salidas,
    };
  });

  const entradasAnuales = months.reduce((s, m) => s + m.entradas, 0);
  const salidasAnuales = months.reduce((s, m) => s + m.salidas, 0);

  return { year, months, entradasAnuales, salidasAnuales };
};

/**
 * Variante async · carga los stores de DB y devuelve la proyección.
 * Devuelve estructura con totales 0 si la DB falla · NO lanza.
 */
export const computeBudgetProjection12mAsync = async (
  year: number,
): Promise<BudgetProjection> => {
  try {
    const db = await initDB();
    const [nominas, autonomos, compromisos, contracts] = await Promise.all([
      db.getAll('nominas') as Promise<Nomina[]>,
      db.getAll('autonomos') as Promise<Autonomo[]>,
      db.getAll('compromisosRecurrentes') as Promise<CompromisoRecurrente[]>,
      db.getAll('contracts') as Promise<Contract[]>,
    ]);
    return computeBudgetProjectionFromData(year, {
      nominas,
      autonomos,
      compromisos,
      contracts,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[budgetProjection] error cargando datos · devuelve vacío', err);
    return computeBudgetProjectionFromData(year, {
      nominas: [],
      autonomos: [],
      compromisos: [],
      contracts: [],
    });
  }
};

/**
 * Versión sincrónica · útil cuando el caller ya tiene los datos cargados
 * (ej. desde Outlet context). REQUIERE pasar `data` explícitamente · ya no
 * devuelve resultado vacío silenciosamente.
 *
 * Para consumo desde Tesorería · usar `computeBudgetProjection12mAsync`.
 */
export const computeBudgetProjection12m = (
  year: number,
  data: BudgetProjectionData,
): BudgetProjection => {
  return computeBudgetProjectionFromData(year, data);
};
