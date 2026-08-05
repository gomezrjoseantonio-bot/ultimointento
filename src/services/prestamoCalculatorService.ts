/**
 * Lo que rodea al cuadro · carencia técnica y previsiones de tesorería.
 *
 * El CUADRO ya no se genera aquí: vive en `services/prestamos/cuadro`, que es
 * el único motor. Este fichero era el segundo, y de él salía el cuadro de la
 * vista previa del wizard mientras el otro generaba el que se guardaba.
 *
 * Queda lo que sí es suyo:
 *   - **La carencia técnica**, los días sueltos entre la firma y el primer mes
 *     de cobro. El banco los liquida en un cargo SEPARADO, no como suplemento
 *     de la primera cuota.
 *   - **Los descriptores de eventos de tesorería**, que ahora salen del cuadro
 *     del motor único en vez de generar uno propio — eran un TERCER cuadro, y
 *     de él salían las previsiones.
 *
 * Puro: no lee la base ni el reloj. El caller completa los campos auditables.
 */
import type { Prestamo } from '../types/prestamos';
import { generarCuadro } from './prestamos/cuadro';

export type TipoPrestamoV2 = 'hipotecario' | 'personal' | 'linea_credito' | 'otro';
export type TipoInteresV2 = 'fijo' | 'variable' | 'mixto';
export type TipoCarenciaInicialV2 = 'ninguna' | 'solo_capital' | 'total';
export type TipoDestinoV2 =
  | 'adquisicion_inmueble'
  | 'reforma_inmueble'
  | 'cancelar_deuda'
  | 'inversion'
  | 'personal'
  | 'otro';
export type TipoGarantiaV2 = 'hipotecaria' | 'personal' | 'pignoraticia';

export interface CarenciaTecnicaInfo {
  existe: boolean;
  dias: number;
  /** ISO date de la fecha de liquidación. `null` si NO existe. */
  fechaLiquidacion: string | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ── Date helpers ────────────────────────────────────────────────────────────
// Operamos sobre strings ISO YYYY-MM-DD para evitar drift por zona horaria.

function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
  return { y, m, d };
}

function toISODate(y: number, m: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

function diasEnMes(y: number, m: number): number {
  return new Date(y, m, 0).getDate(); // m es 1-12 aquí
}

function clampDay(y: number, m: number, d: number): number {
  return Math.min(d, diasEnMes(y, m));
}

function diasEntreISO(isoA: string, isoB: string): number {
  // Diferencia de días calendario (UTC para evitar DST).
  const a = parseISODate(isoA);
  const b = parseISODate(isoB);
  const ta = Date.UTC(a.y, a.m - 1, a.d);
  const tb = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((tb - ta) / 86_400_000);
}

// ── Funciones financieras ───────────────────────────────────────────────────

/**
 * Detecta si hay carencia técnica (días entre la firma y la primera fecha de
 * cobro mensual) y devuelve los días y la fecha de liquidación.
 *
 * Si el día de firma coincide con el día de cobro → NO hay carencia técnica.
 */
export function detectarCarenciaTecnica(
  fechaFirmaISO: string,
  diaCobro: number,
): CarenciaTecnicaInfo {
  const firma = parseISODate(fechaFirmaISO);
  if (firma.d === diaCobro) {
    return { existe: false, dias: 0, fechaLiquidacion: null };
  }
  // Fecha de liquidación = día de cobro del mes siguiente a la firma.
  const total = firma.y * 12 + (firma.m - 1) + 1;
  const ly = Math.floor(total / 12);
  const lm = (total % 12) + 1;
  const ld = clampDay(ly, lm, diaCobro);
  const fechaLiq = toISODate(ly, lm, ld);
  const dias = diasEntreISO(fechaFirmaISO, fechaLiq);
  return { existe: dias > 0, dias, fechaLiquidacion: fechaLiq };
}

/**
 * Intereses devengados durante los días de carencia técnica · base 365.
 *   I = C · TIN · días / 365
 */
export function calcularInteresesCarenciaTecnica(
  capital: number,
  tinAnual: number,
  dias: number,
): number {
  if (capital <= 0 || tinAnual <= 0 || dias <= 0) return 0;
  return capital * tinAnual * dias / 365;
}

// ── Generación de Treasury Events (v2) ──────────────────────────────────────
// Devuelve descriptores de eventos · el caller los inserta en la DB.
// NO usa interfaz TreasuryEvent del db.ts para mantener pureza · el caller
// completa los campos auditables (id, createdAt, status, etc.).

export interface TreasuryEventDescriptor {
  fecha: string;                     // ISO date YYYY-MM-DD
  tipo: 'ingreso' | 'gasto';
  importe: number;
  cuentaId: number | undefined;
  concepto: string;
  prestamoId: string;
  numeroCuota?: number;
  desglose?: { capital: number; intereses: number };
  esCarenciaTecnica?: boolean;
}

/**
 * Los cargos previstos de un préstamo, para tesorería.
 *
 * Un ingreso el día de la firma —la disposición— y un gasto por cada línea del
 * cuadro, la de carencia técnica incluida.
 *
 * El cuadro sale del motor ÚNICO. Antes esta función generaba el suyo, con su
 * propio TIN pasado por el caller: era el tercer cuadro de la casa, y de él
 * salían las previsiones que después se cuadraban contra el banco.
 */
export function generarTreasuryEventDescriptors(
  prestamo: Prestamo,
  cuentaCargoId: number | undefined,
): TreasuryEventDescriptor[] {
  const alias = prestamo.nombre;
  const descriptores: TreasuryEventDescriptor[] = [
    {
      fecha: prestamo.fechaFirma,
      tipo: 'ingreso',
      importe: round2(prestamo.principalInicial),
      cuentaId: cuentaCargoId,
      concepto: `Disposición préstamo · ${alias}`,
      prestamoId: prestamo.id,
    },
  ];

  const { periodos } = generarCuadro(prestamo).plan;
  const cuotas = periodos.filter((p) => p.periodo > 0).length;

  for (const p of periodos) {
    // Lo que no se cobra no se prevé · un cargo de 0 € pondría en tesorería un
    // recibo que nadie va a ver en su extracto, y que además habría que
    // puntear. Hoy solo pasa en la carencia TOTAL, donde no se paga nada y los
    // intereses se capitalizan (§6 bis · ter), pero la regla vale para
    // cualquier periodo que no mueva dinero.
    if (p.cuota === 0) continue;

    // El periodo 0 es la carencia técnica · cargo aparte, sin capital.
    if (p.periodo === 0) {
      descriptores.push({
        fecha: p.fechaCargo,
        tipo: 'gasto',
        importe: p.cuota,
        cuentaId: cuentaCargoId,
        concepto: `Liquidación carencia técnica · ${alias}`,
        prestamoId: prestamo.id,
        esCarenciaTecnica: true,
      });
      continue;
    }

    descriptores.push({
      fecha: p.fechaCargo,
      tipo: 'gasto',
      importe: p.cuota,
      cuentaId: cuentaCargoId,
      concepto: `Cuota ${p.periodo}/${cuotas} · ${alias}`,
      prestamoId: prestamo.id,
      numeroCuota: p.periodo,
      desglose: { capital: p.amortizacion, intereses: p.interes },
    });
  }

  return descriptores;
}
