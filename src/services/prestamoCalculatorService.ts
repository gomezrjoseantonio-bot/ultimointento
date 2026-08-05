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
import { interesPorDias, type BaseDeCalculo } from './prestamos/baseDeCalculo';

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
 * Los días sueltos entre la disposición y el primer cargo · §6 bis · bis.
 *
 * El banco los liquida **en la primera fecha de cobro POSTERIOR a la
 * disposición**, sea del mes que sea. Tres cuadros reales del Santander, los
 * tres iguales:
 *
 *   · 12-05-2026, cobro el día 1  → 01-06-2026 · 20 días · 214,64 € de 78.500
 *   · 03-07-2025, cobro fin de mes → 31-07-2025 · 28 días · 154,96 € de 50.000
 *   · 16-10-2023, cobro fin de mes → 31-10-2023 · 15 días ·  29,05 € de 17.675
 *
 * Esto decía «el día de cobro del MES SIGUIENTE», y eso solo acierta cuando el
 * día de cobro ya ha pasado al firmar. En los otros dos se saltaba un cargo
 * entero: el de 16-10-2023 salía a **45 días y 87,16 €** en vez de 15 y 29,05, y
 * encima con la fecha del primer recibo de verdad, o sea dos cargos el mismo
 * día. *(Jose · 5 ago 2026 — «se dice que la primera cuota son 45 días».)*
 *
 * Si el día de cobro es el mismo de la disposición no hay días sueltos que
 * cobrar. Se compara con el día YA RECORTADO: quien cobra «el 31» y dispone un
 * 30 de noviembre no tiene carencia, porque en noviembre el 31 es el 30.
 */
export function detectarCarenciaTecnica(
  fechaFirmaISO: string,
  diaCobro: number,
): CarenciaTecnicaInfo {
  const firma = parseISODate(fechaFirmaISO);

  // El día de cobro de ESTE mes · el 31 en noviembre es el 30.
  const esteMes = clampDay(firma.y, firma.m, diaCobro);
  if (esteMes === firma.d) {
    return { existe: false, dias: 0, fechaLiquidacion: null };
  }

  let ly = firma.y;
  let lm = firma.m;
  let ld = esteMes;

  // Solo se salta al mes siguiente si en este el cobro YA HA PASADO.
  if (esteMes < firma.d) {
    const total = firma.y * 12 + (firma.m - 1) + 1;
    ly = Math.floor(total / 12);
    lm = (total % 12) + 1;
    ld = clampDay(ly, lm, diaCobro);
  }

  const fechaLiq = toISODate(ly, lm, ld);
  const dias = diasEntreISO(fechaFirmaISO, fechaLiq);
  return { existe: dias > 0, dias, fechaLiquidacion: fechaLiq };
}

/**
 * Intereses devengados durante los días de carencia técnica.
 *
 *   I = C · TIN · días ÷ base
 *
 * La base la dice la escritura (§6 bis · bis), y se pide SIN valor por defecto:
 * con uno, este cargo se calcularía sobre 365 mientras el resto del cuadro
 * cuenta días sobre 360, y nadie se enteraría. Con el mes comercial se cuenta
 * sobre 365, que es lo que dice la carta del Santander —78.500 € al 4,99 % por
 * 20 días son sus 214,64 €—.
 */
export function calcularInteresesCarenciaTecnica(
  capital: number,
  tinAnual: number,
  dias: number,
  base: BaseDeCalculo,
): number {
  if (capital <= 0 || tinAnual <= 0 || dias <= 0) return 0;
  return interesPorDias(Math.round(capital * 100), tinAnual * 100, dias, base) / 100;
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
