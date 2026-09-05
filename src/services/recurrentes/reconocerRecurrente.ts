// ============================================================================
// E2.3 · Reconocer un RECURRENTE de verdad · identidad, calendario, tolerancia
// ============================================================================
//
// Hasta E2.3 la vía A del sugeridor casaba un cargo con un compromiso
// recurrente por «misma cuenta + importe ±5 % + nombre del proveedor», e
// ignoraba justo lo que lo haría fiable: el CUPS y el nº de contrato (V83), el
// `conceptoBancario` que el usuario escribió, el calendario del `patron`, el
// modo del importe y el `reparto[]`. Dos Iberdrola de dos pisos eran una
// moneda al aire.
//
// Aquí se usa lo que ya existe, por orden de fuerza:
//
//   1 · IDENTIDAD · los identificadores que E2.1 extrae del texto (CUPS,
//       contrato, NIF) contra `cups` / `numeroContrato` / `proveedor.nif` del
//       compromiso. Identidad exacta > cualquier heurística. El NIF solo es
//       concluyente si señala a un único compromiso (una aseguradora cubre
//       varios pisos), igual que hace el clasificador de facturas.
//   2 · TEXTO · `conceptoBancario` (todas sus palabras dentro del texto del
//       banco, como la nómina) o el nombre del proveedor.
//   3 · IMPORTE · según el modo: FIJO casa exacto (o ±1 %); VARIABLE solo
//       valida plausibilidad (un rango), no descarta; los demás modos dan la
//       cifra del mes (`calcularImporte`) y se tratan como fijo.
//   4 · CALENDARIO · las fechas que el patrón proyecta alrededor del cargo
//       (`expandirPatron`). Cuadrar suma; que un patrón no mensual (bimestral,
//       anual) no tenga fecha cerca RESTA: el agua bimestral de Tenderina en
//       meses pares y la de Carles Buigas en impares se distinguen por el mes.
//   5 · REPARTO · un recibo repartido entre pisos viaja con su reparto.
//
// Con varios candidatos gana el que más puntúa; si dos van pegados no se elige
// (§13 · proponer el piso equivocado es peor que preguntar).
//
// Solo GASTO: `CompromisoRecurrente` modela salidas (todas las categorías son
// de gasto y `importe` es magnitud). Un abono nunca es un recurrente de estos.
//
// Puro. No toca la base. El emparejador de previsiones
// (`movementMatchingService`) queda fuera a propósito: es otro motor.
// ============================================================================

import type { Movement } from '../db';
import type { CompromisoRecurrente, PatronRecurrente } from '../../types/compromisosRecurrentes';
import { identificadoresDeMovimiento, normalizarIdentificador, type Identificador } from '../identificadoresDelConcepto';
import { contieneConcepto, normalizarTexto } from '../deterministas/texto';
import { calcularImporte, expandirPatron } from '../personal/patronCalendario';

export type PorIdentidad = 'cups' | 'numeroContrato' | 'nif';

export interface RecurrenteReconocido {
  compromiso: CompromisoRecurrente;
  /** 0-100 · ≥ 60 cortocircuita las demás vías del sugeridor. */
  confianza: number;
  porIdentidad?: PorIdentidad;
  porTexto: boolean;
  /** 'exacto' · 'tolerancia' (±1 %) · 'plausible' (variable, en rango) · 'no_cuadra' · 'desconocido'. */
  importe: 'exacto' | 'tolerancia' | 'plausible' | 'no_cuadra' | 'desconocido';
  /** 'cuadra' · 'lejos' (patrón no mensual sin fecha cerca) · 'neutro'. */
  calendario: 'cuadra' | 'lejos' | 'neutro';
  /** El piso al que se atribuye · el del compromiso, o el primero del reparto. */
  inmuebleId?: number;
  reparto?: CompromisoRecurrente['reparto'];
  razones: string[];
}

/** Margen por defecto al cuadrar el cargo con la fecha del patrón (sección 3.2). */
const MARGEN_GRACIA_DIAS_DEFECTO = 5;
/** Un patrón NO mensual sin fecha a menos de esto se considera «lejos». */
const DIAS_PARA_ESTAR_LEJOS = 20;
/** Ventana en la que se proyecta el patrón alrededor del cargo. */
const VENTANA_CALENDARIO_DIAS = 45;
/** Dos candidatos a menos de esto no se distinguen · no se elige. */
const MARGEN_GANADOR = 5;
const TOLERANCIA_FIJO = 0.01;
/** Un variable es plausible entre la cuarta parte y el triple de su media. */
const RANGO_VARIABLE = { min: 0.25, max: 3 };

// ─── 1 · identidad ──────────────────────────────────────────────────────────

function identidadDe(
  ids: Identificador[],
  c: CompromisoRecurrente
): PorIdentidad | undefined {
  const cups = normalizarIdentificador(c.cups ?? '');
  const contrato = normalizarIdentificador(c.numeroContrato ?? '');
  // `proveedor.referencia` es el campo legacy donde CUPS/póliza/cliente iban
  // mezclados · se acepta como cualquiera de los dos.
  const referencia = normalizarIdentificador(c.proveedor?.referencia ?? '');
  const nif = normalizarIdentificador(c.proveedor?.nif ?? '');
  for (const id of ids) {
    if (id.tipo === 'cups' && cups && id.valor === cups) return 'cups';
    if (id.tipo === 'cups' && referencia && id.valor === referencia) return 'cups';
  }
  for (const id of ids) {
    if (id.tipo === 'contrato' && contrato && id.valor === contrato) return 'numeroContrato';
    if (id.tipo === 'contrato' && referencia && id.valor === referencia) return 'numeroContrato';
  }
  for (const id of ids) {
    if (id.tipo === 'nif' && nif && id.valor === nif) return 'nif';
  }
  return undefined;
}

// ─── 2 · texto ──────────────────────────────────────────────────────────────

/**
 * Cómo casa el texto · el `conceptoBancario` (lo que el usuario escribió que
 * pone el banco) pesa más que el nombre del proveedor: «IBERDROLA GAS» y
 * «IBERDROLA LUZ» comparten proveedor y solo el concepto los separa.
 */
function textoCuadra(m: Movement, c: CompromisoRecurrente): 'concepto' | 'proveedor' | false {
  const texto = normalizarTexto(`${m.description ?? ''} ${m.counterparty ?? ''}`);
  const concepto = c.conceptoBancario?.trim();
  if (concepto && contieneConcepto(texto, concepto)) return 'concepto';
  const proveedor = normalizarTexto(c.proveedor?.nombre ?? '');
  return proveedor.length >= 3 && texto.includes(proveedor) ? 'proveedor' : false;
}

// ─── 3 · importe ────────────────────────────────────────────────────────────

function importeEsperado(c: CompromisoRecurrente, fecha: Date): number | null {
  try {
    const v = calcularImporte(c.importe, fecha);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function juzgarImporte(m: Movement, c: CompromisoRecurrente, fecha: Date): RecurrenteReconocido['importe'] {
  const real = Math.abs(m.amount);
  const esperado = importeEsperado(c, fecha);
  if (esperado == null) return 'desconocido';
  const diff = Math.abs(real - esperado);
  if (diff < 0.005) return 'exacto';
  if (c.importe.modo === 'variable') {
    return real >= esperado * RANGO_VARIABLE.min && real <= esperado * RANGO_VARIABLE.max ? 'plausible' : 'no_cuadra';
  }
  return diff / esperado <= TOLERANCIA_FIJO ? 'tolerancia' : 'no_cuadra';
}

// ─── 4 · calendario ─────────────────────────────────────────────────────────

const MS_DIA = 86_400_000;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaLocal(isoDate: string): Date {
  const [y, mo, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, mo - 1, d);
}

function esMensual(p: PatronRecurrente): boolean {
  return p.tipo === 'mensualDiaFijo' || p.tipo === 'mensualDiaRelativo';
}

/** Días hasta la fecha del patrón más cercana al cargo · `null` si no proyecta. */
export function diasALaFechaMasCercana(c: CompromisoRecurrente, fecha: Date): number | null {
  const patron = c.patron;
  if (!patron || patron.tipo === 'puntual' || patron.tipo === 'variablePorMes' || patron.tipo === 'pagasExtra') return null;
  if (c.diaCargoIncierto) return null;
  const desde = new Date(fecha.getTime() - VENTANA_CALENDARIO_DIAS * MS_DIA);
  const hasta = new Date(fecha.getTime() + VENTANA_CALENDARIO_DIAS * MS_DIA);
  let fechas: Date[];
  try {
    fechas = expandirPatron(patron, iso(desde), iso(hasta));
  } catch {
    return null;
  }
  if (fechas.length === 0) return VENTANA_CALENDARIO_DIAS + 1;
  let mejor = Number.POSITIVE_INFINITY;
  for (const f of fechas) {
    const d = Math.abs(Math.round((f.getTime() - fecha.getTime()) / MS_DIA));
    if (d < mejor) mejor = d;
  }
  return mejor;
}

function juzgarCalendario(c: CompromisoRecurrente, fecha: Date): RecurrenteReconocido['calendario'] {
  const dias = diasALaFechaMasCercana(c, fecha);
  if (dias == null) return 'neutro';
  const margen = c.margenGraciaDias ?? MARGEN_GRACIA_DIAS_DEFECTO;
  if (dias <= margen) return 'cuadra';
  // Un mensual que no clava el día no dice nada (el banco lo mueve); uno
  // bimestral, trimestral o anual sin fecha cerca dice que NO es este mes.
  if (!esMensual(c.patron) && dias > DIAS_PARA_ESTAR_LEJOS) return 'lejos';
  return 'neutro';
}

// ─── el juicio ──────────────────────────────────────────────────────────────

function juzgar(m: Movement, c: CompromisoRecurrente, ids: Identificador[], fecha: Date): RecurrenteReconocido | null {
  const porIdentidad = identidadDe(ids, c);
  const texto = textoCuadra(m, c);
  const porTexto = texto !== false;
  const importe = juzgarImporte(m, c, fecha);
  const calendario = juzgarCalendario(c, fecha);

  // Sin identidad hace falta texto E importe que no contradiga · la cuenta
  // sola con un importe parecido ya no basta (así nacían los falsos positivos).
  if (!porIdentidad && !porTexto) return null;
  if (!porIdentidad && importe === 'no_cuadra') return null;

  const razones: string[] = [];
  let confianza: number;
  if (porIdentidad) {
    confianza = 90;
    razones.push(`identidad:${porIdentidad}`);
    if (porTexto) razones.push('texto');
    if (texto === 'concepto') razones.push('concepto_bancario');
    // Un FIJO con identidad y otro importe se propone, pero como algo a
    // confirmar: la identidad dice qué es, el importe dice que algo cambió.
    if (importe === 'no_cuadra') {
      confianza = 75;
      razones.push('importe_no_cuadra');
    }
  } else {
    confianza = 80; // 70 de base + 10 por el texto
    razones.push('texto');
    if (texto === 'concepto') {
      confianza += 5;
      razones.push('concepto_bancario');
    }
  }
  if (importe === 'exacto') {
    confianza += 10;
    razones.push('importe_exacto');
  } else if (importe === 'tolerancia' || importe === 'plausible') {
    razones.push(`importe_${importe}`);
  }
  if (calendario === 'cuadra') {
    confianza += 5;
    razones.push('calendario_cuadra');
  } else if (calendario === 'lejos') {
    confianza -= 20;
    razones.push('calendario_lejos');
  }
  confianza = Math.max(0, Math.min(95, confianza));

  const inmuebleId = c.inmuebleId ?? c.reparto?.[0]?.inmuebleId;
  return {
    compromiso: c,
    confianza,
    porIdentidad,
    porTexto,
    importe,
    calendario,
    ...(inmuebleId != null ? { inmuebleId } : {}),
    ...(c.reparto && c.reparto.length > 0 ? { reparto: c.reparto } : {}),
    razones,
  };
}

/**
 * El compromiso recurrente que explica este cargo, o `null`.
 *
 * `compromisos` deben venir ya filtrados a los activos. Un abono nunca casa.
 * La cuenta se exige salvo que haya identidad: un CUPS es el mismo aunque el
 * usuario haya cambiado la domiciliación de cuenta.
 */
export function reconocerRecurrente(
  m: Movement,
  compromisos: CompromisoRecurrente[]
): RecurrenteReconocido | null {
  if (m.amount >= 0 || compromisos.length === 0) return null;
  const ids = identificadoresDeMovimiento(m);
  const fecha = fechaLocal(m.date);

  const candidatos: RecurrenteReconocido[] = [];
  for (const c of compromisos) {
    const j = juzgar(m, c, ids, fecha);
    if (!j) continue;
    if (!j.porIdentidad && c.cuentaCargo !== m.accountId) continue;
    candidatos.push(j);
  }
  if (candidatos.length === 0) return null;

  // El NIF solo es concluyente si señala a UN compromiso · una aseguradora
  // cubre varios pisos. Si varios casan solo por NIF, se les quita la
  // identidad y compiten por texto/calendario como los demás.
  const porNif = candidatos.filter((j) => j.porIdentidad === 'nif');
  if (porNif.length > 1) {
    for (const j of porNif) {
      if (!j.porTexto) {
        j.confianza = 0;
        continue;
      }
      j.porIdentidad = undefined;
      // Pasa a puntuar como un candidato por texto · con su extra si casó el
      // concepto bancario, que es lo que separa gas de luz del mismo acreedor.
      j.confianza = Math.max(0, j.confianza - 10 + (j.razones.includes('concepto_bancario') ? 5 : 0));
      j.razones = j.razones.map((r) => (r === 'identidad:nif' ? 'nif_ambiguo' : r));
    }
  }

  const vivos = candidatos.filter((j) => j.confianza > 0).sort((a, b) => b.confianza - a.confianza);
  if (vivos.length === 0) return null;
  if (vivos.length > 1 && vivos[0].confianza - vivos[1].confianza < MARGEN_GANADOR) return null;
  return vivos[0];
}
