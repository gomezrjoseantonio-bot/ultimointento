/**
 * Préstamo Calculator Service (v2 · S-WIZARD-PRESTAMO-V2)
 *
 * Motor financiero PURO — sin efectos secundarios — para el wizard único de
 * préstamo. Implementa el caso Santander Jose al céntimo:
 *   capital 78.500 € · TIN 4,99% · 96 cuotas · firma 12/05/2026 · primer
 *   cargo 01/07/2026 · cuota 993,43 € · carencia técnica 20 días · 214,64 €
 *   total intereses 17.083,96 €.
 *
 * Reglas críticas (§2 del spec):
 *   - Sistema francés cuota constante.
 *   - Carencia técnica = días entre firma y primer mes de cobro (NO suplemento
 *     a la primera cuota · cargo separado).
 *   - Cuadro N+1 líneas cuando existe carencia técnica (línea 0 + N cuotas).
 *   - Cuota NUNCA cambia por carencia técnica.
 */
// Tipos auxiliares — definidos aquí para mantener el servicio autocontenido.

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

export interface PrestamoCalculatorInput {
  capital: number;
  tinAnual: number;            // 0.0499 = 4,99%
  numCuotas: number;
  fechaFirma: string;          // ISO date (YYYY-MM-DD)
  primerCargoCuadro: string;   // ISO date (YYYY-MM-DD)
  diaCobro: number;            // 1-31
  comisiones?: {
    apertura?: number;             // % sobre capital
    mantenimiento?: number;        // €/mes
    amortAnticipada?: number;      // %
    modifCondiciones?: number;     // %
    reclamacionImpago?: number;    // € (49 típico)
  };
  // NOTA · `carenciaInicial` (solo_capital / total) NO se admite todavía en
  // el motor v2 — el cuadro francés se genera siempre sin modificaciones por
  // carencia inicial. Se almacena por separado en el `Prestamo` legacy
  // (`carencia` / `carenciaMeses`) pero el cuadro generado aquí lo ignora.
  // Pendiente refinamiento (§7 spec).
}

export interface CarenciaTecnicaInfo {
  existe: boolean;
  dias: number;
  /** ISO date de la fecha de liquidación. `null` si NO existe. */
  fechaLiquidacion: string | null;
}

export type TipoLineaCuadro = 'carencia_tecnica' | 'cuota';

export interface LineaCuadroV2 {
  numero: number;              // 0 = carencia técnica · 1..N = cuotas
  fecha: string;               // ISO date
  tipo: TipoLineaCuadro;
  capitalAmortizado: number;
  intereses: number;
  cuota: number;
  capitalPendiente: number;
}

export interface ResumenCuadroV2 {
  cuotaMensual: number;
  totalCuotas: number;         // suma de cuotas pagadas (todas las líneas)
  totalIntereses: number;      // intereses_cuadro + intereses_carencia_tecnica
  interesesCuadro: number;     // suma de intereses líneas 1..N
  interesesCarenciaTecnica: number;
  tae: number;                 // TAE aproximada en %
  tinEfectivo: number;         // TIN aplicable en % (sin bonificaciones aquí)
  fechaUltimaCuota: string;    // ISO date
  capitalTotal: number;
  numLineas: number;           // N+1 si carencia técnica, N si no
}

export interface CuadroAmortizacionV2 {
  lineas: LineaCuadroV2[];
  resumen: ResumenCuadroV2;
}

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

function addMonthsISO(iso: string, months: number): string {
  const { y, m, d } = parseISODate(iso);
  // m está 1-12; convertimos a 0-11 para sumar y volvemos
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISODate(ny, nm, clampDay(ny, nm, d));
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

/**
 * Cuota constante sistema francés.
 *   C · ((i·(1+i)^n)/((1+i)^n − 1))   con i = TIN_anual / 12.
 * Si TIN = 0 → C / n.
 */
export function calcularCuotaFrances(
  capital: number,
  tinMensual: number,
  numCuotas: number,
): number {
  if (capital <= 0 || numCuotas <= 0) return 0;
  if (tinMensual === 0) return capital / numCuotas;
  const pot = Math.pow(1 + tinMensual, numCuotas);
  return capital * (tinMensual * pot) / (pot - 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Genera el cuadro de amortización completo. Devuelve N+1 líneas si existe
 * carencia técnica (línea 0 + N cuotas) o N líneas si no.
 *
 * La carencia técnica genera UN cargo separado (línea 0) sin afectar la cuota.
 * La carencia inicial (solo_capital / total) NO está implementada al 100% en
 * v2 — se documenta como pendiente refinamiento (§7 spec).
 */
export function generarCuadroAmortizacion(
  input: PrestamoCalculatorInput,
): CuadroAmortizacionV2 {
  const { capital, tinAnual, numCuotas, fechaFirma, primerCargoCuadro, diaCobro } = input;
  const tinMensual = tinAnual / 12;
  const lineas: LineaCuadroV2[] = [];

  // Línea 0 · carencia técnica (si aplica)
  const carencia = detectarCarenciaTecnica(fechaFirma, diaCobro);
  let interesesCarenciaTecnica = 0;
  if (carencia.existe && carencia.fechaLiquidacion) {
    interesesCarenciaTecnica = calcularInteresesCarenciaTecnica(capital, tinAnual, carencia.dias);
    lineas.push({
      numero: 0,
      fecha: carencia.fechaLiquidacion,
      tipo: 'carencia_tecnica',
      capitalAmortizado: 0,
      intereses: round2(interesesCarenciaTecnica),
      cuota: round2(interesesCarenciaTecnica),
      capitalPendiente: capital,
    });
  }

  // Líneas 1..N · cuadro francés
  const cuotaRaw = calcularCuotaFrances(capital, tinMensual, numCuotas);
  const cuota = round2(cuotaRaw);
  let capitalPendiente = capital;
  let interesesCuadro = 0;

  for (let i = 1; i <= numCuotas; i++) {
    const intereses = capitalPendiente * tinMensual;
    let capitalAmortizado = cuotaRaw - intereses;
    let cuotaLinea = cuotaRaw;
    if (i === numCuotas) {
      // Última cuota · ajustar para que capitalPendiente quede en 0 al céntimo.
      capitalAmortizado = capitalPendiente;
      cuotaLinea = capitalAmortizado + intereses;
    }
    capitalPendiente = Math.max(0, capitalPendiente - capitalAmortizado);
    interesesCuadro += intereses;
    lineas.push({
      numero: i,
      fecha: addMonthsISO(primerCargoCuadro, i - 1),
      tipo: 'cuota',
      capitalAmortizado: round2(capitalAmortizado),
      intereses: round2(intereses),
      cuota: round2(cuotaLinea),
      capitalPendiente: round2(capitalPendiente),
    });
  }

  const totalCuotas = lineas.reduce((sum, l) => sum + l.cuota, 0);
  const totalIntereses = round2(interesesCuadro + interesesCarenciaTecnica);

  // TAE aproximada · (1 + TIN/12)^12 − 1 más coste comisión apertura prorrateado anualmente.
  const comApertura = (input.comisiones?.apertura || 0) * capital / 100;
  const tinEfectivoAnualPct = round2(tinAnual * 100);
  const taeBase = Math.pow(1 + tinMensual, 12) - 1;
  const añosPlazo = numCuotas / 12;
  const taeComision = añosPlazo > 0 ? comApertura / (capital * añosPlazo) : 0;
  const taeCarencia = capital > 0 && añosPlazo > 0
    ? interesesCarenciaTecnica / (capital * añosPlazo)
    : 0;
  const tae = round2((taeBase + taeComision + taeCarencia) * 100);

  const ultimaLinea = lineas[lineas.length - 1];

  return {
    lineas,
    resumen: {
      cuotaMensual: cuota,
      totalCuotas: round2(totalCuotas),
      totalIntereses,
      interesesCuadro: round2(interesesCuadro),
      interesesCarenciaTecnica: round2(interesesCarenciaTecnica),
      tae,
      tinEfectivo: tinEfectivoAnualPct,
      fechaUltimaCuota: ultimaLinea ? ultimaLinea.fecha : primerCargoCuadro,
      capitalTotal: round2(capital),
      numLineas: lineas.length,
    },
  };
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

export interface PrestamoParaEventos {
  id: string;
  alias: string;
  capital: number;
  fechaFirma: string;
  primerCargoCuadro: string;
  diaCobro: number;
  tinAnual: number;
  numCuotas: number;
  cuentaCargoId: number | undefined;
}

/**
 * Genera la lista completa de descriptores de eventos para tesorería:
 *   1 ingreso (disposición · día firma)
 * + 1 gasto carencia técnica si aplica (día liquidación)
 * + N gastos cuotas del cuadro (1..N).
 */
export function generarTreasuryEventDescriptors(
  prestamo: PrestamoParaEventos,
): TreasuryEventDescriptor[] {
  const descriptors: TreasuryEventDescriptor[] = [];

  descriptors.push({
    fecha: prestamo.fechaFirma,
    tipo: 'ingreso',
    importe: round2(prestamo.capital),
    cuentaId: prestamo.cuentaCargoId,
    concepto: `Disposición préstamo · ${prestamo.alias}`,
    prestamoId: prestamo.id,
  });

  const cuadro = generarCuadroAmortizacion({
    capital: prestamo.capital,
    tinAnual: prestamo.tinAnual,
    numCuotas: prestamo.numCuotas,
    fechaFirma: prestamo.fechaFirma,
    primerCargoCuadro: prestamo.primerCargoCuadro,
    diaCobro: prestamo.diaCobro,
  });

  for (const linea of cuadro.lineas) {
    if (linea.tipo === 'carencia_tecnica') {
      descriptors.push({
        fecha: linea.fecha,
        tipo: 'gasto',
        importe: linea.cuota,
        cuentaId: prestamo.cuentaCargoId,
        concepto: `Liquidación carencia técnica · ${prestamo.alias}`,
        prestamoId: prestamo.id,
        esCarenciaTecnica: true,
      });
    } else {
      descriptors.push({
        fecha: linea.fecha,
        tipo: 'gasto',
        importe: linea.cuota,
        cuentaId: prestamo.cuentaCargoId,
        concepto: `Cuota ${linea.numero}/${prestamo.numCuotas} · ${prestamo.alias}`,
        prestamoId: prestamo.id,
        numeroCuota: linea.numero,
        desglose: {
          capital: linea.capitalAmortizado,
          intereses: linea.intereses,
        },
      });
    }
  }

  return descriptors;
}
