// src/modules/horizon/inmuebles/supervision/hooks/useSupervisionData.ts
// Hook de datos para la vista Supervisión de Inmuebles.
// Solo lectura — agrega datos de múltiples servicios existentes.

import { useState, useEffect, useCallback } from 'react';
import { initDB, type Property, type Contract, type RentaMensual } from '../../../../../services/db';
import type { ValoracionHistorica } from '../../../../../types/valoraciones';
import type { AEATFiscalType } from '../../../../../services/db';
import { getMejorasPorInmueble } from '../../../../../services/mejoraActivoService';
import { getMobiliarioPorInmueble } from '../../../../../services/mobiliarioActivoService';
import { getInteresesHipotecaByPropertyAndYear } from '../../../../../services/loanInterestService';
import {
  getOperacionesPorInmuebleYEjercicio,
} from '../../../../../services/operacionFiscalService';

// ── Types ────────────────────────────────────────────────────────────────

export interface DatosAnuales {
  ano: number;
  rentas: number;
  gastosOp: number;
  intereses: number;
  reparaciones: number;
  cashflow: number;
}

export interface InmuebleSupervision {
  id: number;
  alias: string;
  direccion: string;
  anoCompra: number;
  precioCompra: number;
  gastosCompra: number;       // notaría + registro + gestoría + inmobiliaria + PSI + otros
  impuestosCompra: number;    // ITP o IVA+AJD
  mejorasCapex: number;       // tipo='mejora' | 'ampliacion'
  reparaciones: number;       // tipo='reparacion'
  mobiliario: number;         // coste total mobiliario

  costeAdquisicion: number;   // precioCompra + impuestos + gastos + mejoras CAPEX
  inversionTotal: number;     // costeAdquisicion + reparaciones + mobiliario

  valorActual: number;        // última valoración
  plusvaliaLatente: number;    // valorActual - costeAdquisicion

  cashflowAcumulado: number;  // sum(rentas) - sum(gastosOp) - sum(intereses)
  rentasUltimoAno: number;    // rentas del último año con datos

  yieldCosteAdquisicion: number;  // rentasUltimoAño / costeAdquisicion * 100
  yieldInversionTotal: number;    // rentasUltimoAño / inversionTotal * 100
  multiplo: number;               // (valorActual + cashflowAcumulado) / inversionTotal

  datosPorAno: DatosAnuales[];
}

export interface TotalesCartera {
  numInmuebles: number;
  valorCartera: number;
  costeAdquisicion: number;
  inversionTotal: number;
  plusvaliaLatente: number;
  revalorizacionPct: number;
  cashflowAcumulado: number;
  rentasUltimoAno: number;
  yieldCosteAdquisicion: number;
  yieldInversionTotal: number;
  multiplo: number;
  reparaciones: number;
  mobiliario: number;
}

export interface SupervisionData {
  inmuebles: InmuebleSupervision[];
  totales: TotalesCartera;
  loading: boolean;
  error: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const safeDiv = (a: number, b: number): number => (b !== 0 ? a / b : 0);

const sumAcqGastos = (costs: Property['acquisitionCosts']): number => {
  if (!costs) return 0;
  const others = (costs.other ?? []).reduce((s, o) => s + (o.amount || 0), 0);
  return (costs.notary ?? 0)
    + (costs.registry ?? 0)
    + (costs.management ?? 0)
    + (costs.psi ?? 0)
    + (costs.realEstate ?? 0)
    + others;
};

const sumAcqImpuestos = (costs: Property['acquisitionCosts']): number => {
  if (!costs) return 0;
  return (costs.itp ?? 0) + (costs.iva ?? 0);
};

/** Rango de años desde compra hasta hoy */
const buildYearRange = (anoCompra: number): number[] => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = anoCompra; y <= currentYear; y++) years.push(y);
  return years;
};

// AEAT boxes for operational expenses (excluding 0105=intereses and 0117=amortización muebles)
const GASTOS_OP_BOXES = new Set(['0106', '0109', '0112', '0113', '0114', '0115']);

// categoriaFiscal fallback — operations may not have casillaAEAT set
const GASTOS_OP_CATEGORIES: Set<AEATFiscalType> = new Set([
  'reparacion-conservacion', 'comunidad', 'servicios-personales',
  'suministros', 'seguros', 'tributos-locales',
]);
const INTERESES_CATEGORIES: Set<AEATFiscalType> = new Set(['financiacion']);

// ── Hook ─────────────────────────────────────────────────────────────────

export function useSupervisionData(): SupervisionData {
  const [inmuebles, setInmuebles] = useState<InmuebleSupervision[]>([]);
  const [totales, setTotales] = useState<TotalesCartera>(emptyTotales());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const db = await initDB();
      const properties: Property[] = await db.getAll('properties');
      const activos = properties.filter((p) => p.state === 'activo');

      if (activos.length === 0) {
        setInmuebles([]);
        setTotales(emptyTotales());
        setLoading(false);
        return;
      }

      // --- Batch-load shared tables once (performance) ---
      const [allContracts, allRentaRecords, allValoraciones] = await Promise.all([
        db.getAll('contracts') as Promise<Contract[]>,
        db.getAll('rentaMensual') as Promise<RentaMensual[]>,
        db.getAll('valoraciones_historicas') as Promise<ValoracionHistorica[]>,
      ]);

      // Pre-index contracts by property (support legacy propertyId field)
      const contractsByProp = new Map<number, Contract[]>();
      for (const c of allContracts) {
        const pid = (c as any).inmuebleId ?? (c as any).propertyId;
        if (pid == null) continue;
        const list = contractsByProp.get(pid) ?? [];
        list.push(c);
        contractsByProp.set(pid, list);
      }

      // Pre-index rentas by contratoId
      const rentasByContrato = new Map<number, RentaMensual[]>();
      for (const r of allRentaRecords) {
        const list = rentasByContrato.get(r.contratoId) ?? [];
        list.push(r);
        rentasByContrato.set(r.contratoId, list);
      }

      // Pre-index valoraciones: latest per inmueble
      const latestValByProp = new Map<number, ValoracionHistorica>();
      for (const v of allValoraciones) {
        if (v.tipo_activo !== 'inmueble') continue;
        const prev = latestValByProp.get(v.activo_id);
        if (!prev || v.fecha_valoracion > prev.fecha_valoracion) {
          latestValByProp.set(v.activo_id, v);
        }
      }

      const results: InmuebleSupervision[] = [];

      for (const prop of activos) {
        const propId = prop.id as number;
        const anoCompra = prop.purchaseDate
          ? new Date(prop.purchaseDate).getFullYear()
          : new Date().getFullYear();
        const years = buildYearRange(anoCompra);

        // --- Parallel data fetching per property ---
        const [mejoras, muebles] = await Promise.all([
          getMejorasPorInmueble(propId),
          getMobiliarioPorInmueble(propId),
        ]);

        // Mejoras / CAPEX / Reparaciones
        const mejorasCapex = mejoras
          .filter((m) => m.tipo !== 'reparacion')
          .reduce((s, m) => s + m.importe, 0);
        const reparaciones = mejoras
          .filter((m) => m.tipo === 'reparacion')
          .reduce((s, m) => s + m.importe, 0);

        // Mobiliario
        const mobiliarioTotal = muebles.reduce((s, m) => s + m.importe, 0);

        // Costes de adquisición
        const precioCompra = prop.acquisitionCosts?.price ?? 0;
        const gastosCompra = sumAcqGastos(prop.acquisitionCosts);
        const impuestosCompra = sumAcqImpuestos(prop.acquisitionCosts);
        const costeAdquisicion = precioCompra + impuestosCompra + gastosCompra + mejorasCapex;
        const inversionTotal = costeAdquisicion + reparaciones + mobiliarioTotal;

        // Valoración actual (from pre-loaded batch)
        const ultimaValoracion = latestValByProp.get(propId);
        const valorActual = ultimaValoracion?.valor ?? precioCompra;
        const plusvaliaLatente = valorActual - costeAdquisicion;

        // --- Year-by-year data ---
        // Contracts & rentas from pre-loaded data
        const propertyContracts = contractsByProp.get(propId) ?? [];
        const contractIds = propertyContracts.map((c: any) => c.id).filter(Boolean) as number[];

        let propRentas: RentaMensual[] = [];
        for (const cid of contractIds) {
          const rentas = rentasByContrato.get(cid);
          if (rentas) propRentas = propRentas.concat(rentas);
        }

        const datosPorAno: DatosAnuales[] = [];

        for (const ano of years) {
          // Rentas: sum importePrevisto for each month of this year
          const rentasAno = propRentas
            .filter((r) => r.periodo.startsWith(String(ano)))
            .reduce((s, r) => s + r.importePrevisto, 0);

          // Gastos operativos via operaciones fiscales
          let gastosOp = 0;
          let intereses = 0;
          try {
            const ops = await getOperacionesPorInmuebleYEjercicio(propId, ano);
            for (const op of ops) {
              const box = op.casillaAEAT;
              const cat = op.categoriaFiscal;
              if (box === '0105' || INTERESES_CATEGORIES.has(cat)) {
                intereses += op.total;
              } else if (GASTOS_OP_BOXES.has(box) || GASTOS_OP_CATEGORIES.has(cat)) {
                gastosOp += op.total;
              }
            }
          } catch {
            // If no operations for this year, try loanInterestService for interest
          }

          // If no interest from operaciones, try loanInterestService
          if (intereses === 0) {
            try {
              intereses = await getInteresesHipotecaByPropertyAndYear(propId, ano);
            } catch {
              // No loans for this property/year
            }
          }

          // Reparaciones for this specific year
          const reparacionesAno = mejoras
            .filter((m) => m.tipo === 'reparacion' && m.ejercicio === ano)
            .reduce((s, m) => s + m.importe, 0);

          const cashflow = rentasAno - gastosOp - intereses;

          datosPorAno.push({
            ano,
            rentas: Math.round(rentasAno * 100) / 100,
            gastosOp: Math.round(gastosOp * 100) / 100,
            intereses: Math.round(intereses * 100) / 100,
            reparaciones: Math.round(reparacionesAno * 100) / 100,
            cashflow: Math.round(cashflow * 100) / 100,
          });
        }

        const cashflowAcumulado = datosPorAno.reduce((s, d) => s + d.cashflow, 0);

        // Last year with rentas > 0
        const anosConRentas = datosPorAno.filter((d) => d.rentas > 0);
        const rentasUltimoAno = anosConRentas.length > 0
          ? anosConRentas[anosConRentas.length - 1].rentas
          : 0;

        const yieldCosteAdquisicion = safeDiv(rentasUltimoAno, costeAdquisicion) * 100;
        const yieldInversionTotal = safeDiv(rentasUltimoAno, inversionTotal) * 100;
        const multiplo = safeDiv(valorActual + cashflowAcumulado, inversionTotal);

        results.push({
          id: propId,
          alias: prop.alias || prop.address || `Inmueble ${propId}`,
          direccion: prop.address || '',
          anoCompra,
          precioCompra,
          gastosCompra: Math.round(gastosCompra * 100) / 100,
          impuestosCompra: Math.round(impuestosCompra * 100) / 100,
          mejorasCapex: Math.round(mejorasCapex * 100) / 100,
          reparaciones: Math.round(reparaciones * 100) / 100,
          mobiliario: Math.round(mobiliarioTotal * 100) / 100,
          costeAdquisicion: Math.round(costeAdquisicion * 100) / 100,
          inversionTotal: Math.round(inversionTotal * 100) / 100,
          valorActual: Math.round(valorActual * 100) / 100,
          plusvaliaLatente: Math.round(plusvaliaLatente * 100) / 100,
          cashflowAcumulado: Math.round(cashflowAcumulado * 100) / 100,
          rentasUltimoAno: Math.round(rentasUltimoAno * 100) / 100,
          yieldCosteAdquisicion: Math.round(yieldCosteAdquisicion * 100) / 100,
          yieldInversionTotal: Math.round(yieldInversionTotal * 100) / 100,
          multiplo: Math.round(multiplo * 100) / 100,
          datosPorAno,
        });
      }

      // --- Totales de cartera ---
      const t: TotalesCartera = {
        numInmuebles: results.length,
        valorCartera: results.reduce((s, i) => s + i.valorActual, 0),
        costeAdquisicion: results.reduce((s, i) => s + i.costeAdquisicion, 0),
        inversionTotal: results.reduce((s, i) => s + i.inversionTotal, 0),
        plusvaliaLatente: results.reduce((s, i) => s + i.plusvaliaLatente, 0),
        revalorizacionPct: 0,
        cashflowAcumulado: results.reduce((s, i) => s + i.cashflowAcumulado, 0),
        rentasUltimoAno: results.reduce((s, i) => s + i.rentasUltimoAno, 0),
        yieldCosteAdquisicion: 0,
        yieldInversionTotal: 0,
        multiplo: 0,
        reparaciones: results.reduce((s, i) => s + i.reparaciones, 0),
        mobiliario: results.reduce((s, i) => s + i.mobiliario, 0),
      };

      t.revalorizacionPct = safeDiv(t.plusvaliaLatente, t.costeAdquisicion) * 100;
      t.yieldCosteAdquisicion = safeDiv(t.rentasUltimoAno, t.costeAdquisicion) * 100;
      t.yieldInversionTotal = safeDiv(t.rentasUltimoAno, t.inversionTotal) * 100;
      t.multiplo = safeDiv(t.valorCartera + t.cashflowAcumulado, t.inversionTotal);

      // Round totals
      (Object.keys(t) as (keyof TotalesCartera)[]).forEach((k) => {
        if (typeof t[k] === 'number') {
          (t as any)[k] = Math.round((t[k] as number) * 100) / 100;
        }
      });

      setInmuebles(results);
      setTotales(t);
    } catch (err) {
      console.error('[SUPERVISION] Error loading data:', err);
      setError('Error al cargar los datos de supervisión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { inmuebles, totales, loading, error };
}

// ── Empty state ──────────────────────────────────────────────────────────

function emptyTotales(): TotalesCartera {
  return {
    numInmuebles: 0,
    valorCartera: 0,
    costeAdquisicion: 0,
    inversionTotal: 0,
    plusvaliaLatente: 0,
    revalorizacionPct: 0,
    cashflowAcumulado: 0,
    rentasUltimoAno: 0,
    yieldCosteAdquisicion: 0,
    yieldInversionTotal: 0,
    multiplo: 0,
    reparaciones: 0,
    mobiliario: 0,
  };
}
