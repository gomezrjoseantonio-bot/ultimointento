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
import { calcularNetoMesNomina } from '../../../services/nominaCalculoService';
import { calcularNetoMesAutonomo } from '../../../services/autonomoCalculoService';
import { gastoPersonalCompromisoEnMes } from '../../personal/helpers';

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
 * Entrada NETA mensual que aporta una nómina en el mes `month` (0-11).
 * FIX consolidar módulo Personal (F6) · ÚNICA FUENTE DE VERDAD
 * (`calcularNetoMesNomina`) · misma cifra que card/panel/wizard/Tesorería.
 */
const ingresoNominaEnMes = (
  nomina: Nomina,
  month: number,
  year: number,
): number => {
  if (!nomina.activa) return 0;
  return calcularNetoMesNomina(nomina, month + 1, year).netoMes;
};

/**
 * Entrada NETA mensual de un autónomo (0-11) · ingresos − cuotaRETA − gastos −
 * retención IRPF. FIX consolidar módulo Personal (F7) · ÚNICA FUENTE DE VERDAD
 * (`calcularNetoMesAutonomo`). Las salidas (cuota/gastos) NO van por separado en
 * `salidas`, por eso aquí se computa el neto · sin doble conteo.
 */
const ingresoAutonomoEnMes = (
  autonomo: Autonomo,
  month: number,
  year: number,
): number => {
  if (!autonomo.activo) return 0;
  return calcularNetoMesAutonomo(autonomo, month + 1, year).netoMes;
};

// V81 (TAREA CC · Bloque C): `gastoCompromisoEnMes` movido a `personal/helpers`
// (`gastoPersonalCompromisoEnMes`) como FUENTE ÚNICA compartida con el motor de
// Horizon (`proyeccionMensualService`). Aquí solo se reexpone el alias local.
const gastoCompromisoEnMes = gastoPersonalCompromisoEnMes;

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
      entradas += ingresoNominaEnMes(n, i, year);
    });
    data.autonomos.forEach((a) => {
      entradas += ingresoAutonomoEnMes(a, i, year);
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
 * Devuelve una proyección estructural vacía (todos los meses a 0). Pensada
 * para que los callers la usen como ÚLTIMO recurso cuando capturan un error
 * y necesitan renderizar algo · NO se devuelve silenciosamente desde
 * `computeBudgetProjection12mAsync` (T-AUDIT-9 · Hallazgo 5.A).
 */
export const emptyBudgetProjection = (year: number): BudgetProjection =>
  computeBudgetProjectionFromData(year, {
    nominas: [],
    autonomos: [],
    compromisos: [],
    contracts: [],
  });

/**
 * Variante async · carga los stores de DB y devuelve la proyección.
 *
 * **Propaga errores** al caller · ya NO traga la excepción ni devuelve una
 * estructura silenciosa de ceros (T-AUDIT-9 · Hallazgo 5.A). Si la DB falla
 * (corrupción · schema mismatch · etc.) la promesa rechaza y el caller debe
 * decidir cómo reaccionar (mostrar banner · usar `emptyBudgetProjection`
 * como fallback explícito · etc.).
 *
 * T-RECONNECT-1.1 · los stores legacy `nominas` y `autonomos` se eliminaron
 * en V63 (rename a `ingresos` con unión discriminada por `tipo`). Antes de
 * este fix, `db.getAll('nominas')` rompía con "object stores not found".
 * Ahora leemos `ingresos` y filtramos por `tipo`, igual que hacen
 * `nominaService.getAllActiveNominas` y `autonomoService.getAutonomos`.
 */
export const computeBudgetProjection12mAsync = async (
  year: number,
): Promise<BudgetProjection> => {
  const db = await initDB();
  const [ingresos, compromisos, contracts] = await Promise.all([
    db.getAll('ingresos') as Promise<Array<Nomina | Autonomo>>,
    db.getAll('compromisosRecurrentes') as Promise<CompromisoRecurrente[]>,
    db.getAll('contracts') as Promise<Contract[]>,
  ]);
  const nominas = ingresos.filter((i): i is Nomina => (i as { tipo?: string }).tipo === 'nomina');
  const autonomos = ingresos.filter((i): i is Autonomo => (i as { tipo?: string }).tipo === 'autonomo');
  return computeBudgetProjectionFromData(year, {
    nominas,
    autonomos,
    compromisos,
    contracts,
  });
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
