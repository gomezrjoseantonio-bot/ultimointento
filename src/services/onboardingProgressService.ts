/**
 * Onboarding día 0 · servicio único de progreso (§2.1 / §3.2 de la tarea).
 *
 * Espacio temporal · PRESENTE (meta · estado del alta). NO toca entidades del
 * pasado ni previsiones. Fuente de verdad del % del topbar y del semáforo del
 * Panel. Persistencia EXCLUSIVA en `keyval` (sin store nuevo · §0.1.6):
 *   · `keyval['onboarding_v1']`           → estado de progreso (este archivo)
 *   · `keyval['onboarding_v1_descartes']` → decisiones de descarte (§2.4 · C5)
 *
 * Cálculo del % (§2.1): bloques ponderados · el núcleo (persona · inmuebles ·
 * contratos · cuentas) pesa DOBLE. Un bloque `completado` aporta su peso entero;
 * `parcial` aporta la mitad; `pendiente` aporta 0. Con 4 bloques de núcleo (peso
 * 2) y 3 de resto (peso 1), el peso total es 11.
 *
 * FIX PUNTO 4 (fusión cuentas+extractos) · el bloque `finanzas` ("Tu vida
 * financiera") desaparece: sus extractos y sugerencias viven ahora DENTRO del
 * bloque `cuentas`. El hub pasa de 8 a 7 bloques · el % se recalcula solo
 * (PESO_TOTAL es derivado, no hardcodeado).
 */

import { initDB } from './db';

// ── Tipos (shape §2.1) ───────────────────────────────────────────────────────

export type BloqueId =
  | 'persona'
  | 'inmuebles'
  | 'contratos'
  | 'cuentas'
  | 'prestamos'
  | 'nomina'
  | 'inversiones';

export type BloqueEstado = 'pendiente' | 'parcial' | 'completado';

export type CuentaVia = 'con_extracto' | 'declarada_a_mano';

export interface BloqueProgreso {
  estado: BloqueEstado;
  detalle?: string;
}

export interface OnboardingState {
  bloques: Record<BloqueId, BloqueProgreso>;
  cuentas: Record<number, CuentaVia>; // accountId → vía
  nucleoCompleto: boolean; // persona + inmuebles + contratos + cuentas
  revealVisto: boolean;
  updatedAt: string;
}

// ── Tipos de descartes (shape §2.4 · usado a fondo en C5) ────────────────────

export type DescarteTipo = 'recurrente' | 'prestamo' | 'nomina';

export interface OnboardingDescarte {
  tipo: DescarteTipo;
  /** Clave de identidad estable de la sugerencia (p.ej. learnKey o hash contraparte+importe). */
  clave: string;
  descartadoAt: string;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const ONBOARDING_KEY = 'onboarding_v1';
const DESCARTES_KEY = 'onboarding_v1_descartes';

/** Orden canónico de los 7 bloques (fusión cuentas+extractos · PUNTO 4). */
export const BLOQUES_ORDEN: BloqueId[] = [
  'persona',
  'inmuebles',
  'contratos',
  'cuentas',
  'prestamos',
  'nomina',
  'inversiones',
];

/** Los 4 bloques que desbloquean el reveal (§0.1.5) · pesan doble. */
export const NUCLEO_BLOQUES: BloqueId[] = ['persona', 'inmuebles', 'contratos', 'cuentas'];

const PESO_NUCLEO = 2;
const PESO_RESTO = 1;

function pesoBloque(b: BloqueId): number {
  return NUCLEO_BLOQUES.includes(b) ? PESO_NUCLEO : PESO_RESTO;
}

/** Peso total (núcleo×2 + resto×1 = 11). Derivado, no hardcodeado. */
const PESO_TOTAL = BLOQUES_ORDEN.reduce((acc, b) => acc + pesoBloque(b), 0);

function contribucion(estado: BloqueEstado): number {
  if (estado === 'completado') return 1;
  if (estado === 'parcial') return 0.5;
  return 0;
}

// ── Estado por defecto / normalización ───────────────────────────────────────

export function defaultOnboardingState(): OnboardingState {
  const bloques = {} as Record<BloqueId, BloqueProgreso>;
  for (const b of BLOQUES_ORDEN) bloques[b] = { estado: 'pendiente' };
  return {
    bloques,
    cuentas: {},
    nucleoCompleto: false,
    revealVisto: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Garantiza que un estado leído de keyval tenga todos los bloques presentes
 * (forward-compat si en el futuro se añaden bloques). No persiste.
 */
function normalize(raw: Partial<OnboardingState> | undefined): OnboardingState {
  const base = defaultOnboardingState();
  if (!raw) return base;
  const bloques = { ...base.bloques };
  if (raw.bloques) {
    for (const b of BLOQUES_ORDEN) {
      if (raw.bloques[b]) bloques[b] = raw.bloques[b];
    }
  }
  const state: OnboardingState = {
    bloques,
    cuentas: raw.cuentas ?? {},
    nucleoCompleto: false, // se recalcula abajo (single source of truth)
    revealVisto: raw.revealVisto ?? false,
    updatedAt: raw.updatedAt ?? base.updatedAt,
  };
  state.nucleoCompleto = isNucleoCompleto(state);
  return state;
}

// ── Cálculo de progreso (servicio único · §2.1) ──────────────────────────────

export interface OnboardingProgress {
  /** % de completitud 0-100 (entero redondeado) para el topbar y el widget. */
  pct: number;
  nucleoCompleto: boolean;
  /** Bloques aún no `completado` (para el semáforo y los deep-links). */
  pendientes: BloqueId[];
  /** Nº de bloques en estado `completado`. */
  completados: number;
}

export function isNucleoCompleto(state: OnboardingState): boolean {
  return NUCLEO_BLOQUES.every((b) => state.bloques[b]?.estado === 'completado');
}

export function computeProgress(state: OnboardingState): OnboardingProgress {
  let acc = 0;
  let completados = 0;
  const pendientes: BloqueId[] = [];
  for (const b of BLOQUES_ORDEN) {
    const estado = state.bloques[b]?.estado ?? 'pendiente';
    acc += pesoBloque(b) * contribucion(estado);
    if (estado === 'completado') completados += 1;
    else pendientes.push(b);
  }
  return {
    pct: Math.round((acc / PESO_TOTAL) * 100),
    nucleoCompleto: isNucleoCompleto(state),
    pendientes,
    completados,
  };
}

// ── Persistencia (keyval) ────────────────────────────────────────────────────

export async function getOnboardingState(): Promise<OnboardingState> {
  const db = await initDB();
  const raw = (await db.get('keyval', ONBOARDING_KEY)) as OnboardingState | undefined;
  return normalize(raw);
}

async function persist(state: OnboardingState): Promise<OnboardingState> {
  state.nucleoCompleto = isNucleoCompleto(state);
  state.updatedAt = new Date().toISOString();
  const db = await initDB();
  await db.put('keyval', state, ONBOARDING_KEY);
  return state;
}

/** Marca/actualiza el estado de un bloque y recalcula núcleo. */
export async function setBloqueEstado(
  bloque: BloqueId,
  estado: BloqueEstado,
  detalle?: string,
): Promise<OnboardingState> {
  const state = await getOnboardingState();
  state.bloques[bloque] = detalle !== undefined ? { estado, detalle } : { estado };
  return persist(state);
}

/** Registra la vía por la que se aportó una cuenta (extracto vs a mano · §2.4). */
export async function setCuentaVia(accountId: number, via: CuentaVia): Promise<OnboardingState> {
  const state = await getOnboardingState();
  state.cuentas = { ...state.cuentas, [accountId]: via };
  return persist(state);
}

export async function setRevealVisto(visto = true): Promise<OnboardingState> {
  const state = await getOnboardingState();
  state.revealVisto = visto;
  return persist(state);
}

export async function getProgress(): Promise<OnboardingProgress> {
  return computeProgress(await getOnboardingState());
}

// ── Descartes (§2.4 · base del modelo · lógica completa en C5) ────────────────

export async function getDescartes(): Promise<OnboardingDescarte[]> {
  const db = await initDB();
  const raw = (await db.get('keyval', DESCARTES_KEY)) as OnboardingDescarte[] | undefined;
  return Array.isArray(raw) ? raw : [];
}

export async function addDescarte(tipo: DescarteTipo, clave: string): Promise<OnboardingDescarte[]> {
  const lista = await getDescartes();
  if (!lista.some((d) => d.tipo === tipo && d.clave === clave)) {
    lista.push({ tipo, clave, descartadoAt: new Date().toISOString() });
    const db = await initDB();
    await db.put('keyval', lista, DESCARTES_KEY);
  }
  return lista;
}

export async function isDescartado(tipo: DescarteTipo, clave: string): Promise<boolean> {
  const lista = await getDescartes();
  return lista.some((d) => d.tipo === tipo && d.clave === clave);
}
