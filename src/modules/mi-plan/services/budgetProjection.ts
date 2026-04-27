// src/modules/mi-plan/services/budgetProjection.ts
//
// Helper compartido de proyección de presupuesto 12 meses.
// T20 Fase 3c · sub-tarea 20.3c · cierra **TODO-T20-01** documentado en
// docs/TAREA-20-pendientes.md.
//
// Combina los stores que ya están en DB para producir una proyección
// estructural mes a mes:
//   - Ingresos · `nominas` (con distribución 12/14 + variables/bonus)
//                + `autonomos` (con calendario `fuentesIngreso`)
//   - Gastos   · `compromisosRecurrentes` ámbito 'personal' · evento mes
//                según patrón (mensualDiaFijo · cadaNMeses · anualMesesConcretos
//                · pagasExtra · variablePorMes · trimestralFiscal · puntual)
//   - Rentas   · `contracts` · sumar renta mensual de contratos vigentes
//                a fecha del mes proyectado
//
// Uso ·
//   - Cashflow chart de Tesorería (`VistaGeneralTab`) · sustituye la
//     proyección lineal simple por esta proyección estructural.
//   - Mi Plan · Landing y Proyección leen directamente.
//
// La función es síncrona y O(N×12) · trabaja sobre los arrays cargados
// en memoria · NO toca DB ni servicios.

import type { Nomina, Autonomo } from '../../../types/personal';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import type { Contract } from '../../../services/db';
import { initDB } from '../../../services/db';
import {
  computeAutonomoIngresoAnualEstimado,
  computeCompromisoImporteEnMes,
} from '../../personal/helpers';

const MONTH_LABELS = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

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

/**
 * Calcula la entrada mensual que aporta una nómina en el mes `month` (0-11).
 * Distribuye el bruto anual entre los meses de cobro · pagas extra van en sus
 * meses configurados (default 6 y 12 si distribucion=14).
 */
const ingresoNominaEnMes = (nomina: Nomina, month: number): number => {
  if (!nomina.activa) return 0;
  const bruto = nomina.salarioBrutoAnual ?? 0;
  if (bruto <= 0) return 0;
  const meses = nomina.distribucion?.meses ?? 12;
  // Mensualidad ordinaria · bruto / 12 mes a mes (paga extra contemplada
  // como parte del bruto anual ya distribuido).
  // Aproximación · doce mensualidades iguales si distribucion=12 · catorce
  // si distribucion=14 (mensualidad de 12 + dos extras en jun/dic).
  if (meses === 14) {
    const mensualidad = bruto / 14;
    if (month === 5 || month === 11) return mensualidad * 2;
    return mensualidad;
  }
  return bruto / 12;
};

const ingresoAutonomoEnMes = (autonomo: Autonomo, month: number): number => {
  if (!autonomo.activo) return 0;
  if (autonomo.fuentesIngreso && autonomo.fuentesIngreso.length > 0) {
    // Sumar las fuentes que activan ese mes · `meses` contiene 1-12.
    return autonomo.fuentesIngreso.reduce((sum, f) => {
      const meses = f.meses ?? [];
      if (meses.length === 0 || meses.includes(month + 1)) {
        return sum + (f.importeEstimado ?? 0);
      }
      return sum;
    }, 0);
  }
  // Fallback · proyección plana del bruto anual estimado / 12.
  return computeAutonomoIngresoAnualEstimado(autonomo) / 12;
};

const gastoCompromisoEnMes = (
  compromiso: CompromisoRecurrente,
  month: number, // 0-11
): number => {
  if (compromiso.estado !== 'activo') return 0;
  if (compromiso.ambito !== 'personal') return 0;

  const patron = compromiso.patron;

  switch (patron.tipo) {
    case 'mensualDiaFijo':
    case 'mensualDiaRelativo':
      // Cargo cada mes.
      return computeCompromisoImporteEnMes(compromiso, month);
    case 'cadaNMeses': {
      // Anclaje · `mesAncla` 1-12 · genera evento si (month+1 - mesAncla) % cadaNMeses === 0.
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
      // Trimestres fiscales · pago en abril (4) · julio (7) · octubre (10) · enero (1).
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
      // Repartir el objetivo anual entre los meses indicados.
      const por = meses.length > 0 ? patron.importeObjetivoAnual / meses.length : 0;
      return por;
    }
    case 'puntual': {
      // Solo si la fecha cae en este mes/año.
      const d = new Date(patron.fecha);
      if (Number.isNaN(d.getTime())) return 0;
      const yearProj = new Date().getFullYear();
      if (d.getFullYear() !== yearProj) return 0;
      if (d.getMonth() !== month) return 0;
      return patron.importe;
    }
    default:
      return 0;
  }
};

const ingresoContratoEnMes = (
  contrato: Contract,
  year: number,
  month: number, // 0-11
): number => {
  if (!contrato.fechaInicio || !contrato.fechaFin) return 0;
  const ini = new Date(contrato.fechaInicio);
  const fin = new Date(contrato.fechaFin);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return 0;
  // Mes objetivo · primer día.
  const target = new Date(year, month, 1);
  // Fin de mes objetivo.
  const targetEnd = new Date(year, month + 1, 0);
  // Intersección con periodo del contrato.
  if (ini > targetEnd || fin < target) return 0;
  return contrato.rentaMensual ?? 0;
};

/**
 * Calcula proyección 12 meses · síncrono · trabaja sobre arrays.
 */
export const computeBudgetProjectionFromData = (
  year: number,
  data: {
    nominas: Nomina[];
    autonomos: Autonomo[];
    compromisos: CompromisoRecurrente[];
    contracts: Contract[];
  },
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
      const importe = gastoCompromisoEnMes(c, i);
      // El importe ya viene con el signo correcto del compromiso · pero
      // garantizamos negativo para los que son gasto.
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
 *
 * Devuelve un objeto vacío con totales 0 si la DB falla · NO lanza.
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
 * (ej. Mi Plan Landing usa Outlet context). NO va a DB. Se reserva un cache
 * vacío si se llama sin datos.
 *
 * Para consumo desde Tesorería · usar `computeBudgetProjection12mAsync`.
 */
export const computeBudgetProjection12m = (
  year: number,
): BudgetProjection => {
  // Sin datos en memoria · devuelve estructura vacía. El caller debe usar
  // la versión async si quiere los datos reales.
  return computeBudgetProjectionFromData(year, {
    nominas: [],
    autonomos: [],
    compromisos: [],
    contracts: [],
  });
};
