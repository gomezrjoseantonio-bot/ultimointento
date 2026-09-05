// E2.4 · Recurrentes contra su DEFINICIÓN · sobre todo el histórico.
//
// El seguro de decesos aparece 21 veces en el fichero y hasta E2.4 se reconocía
// una: la del mes que tenía previsión. La definición del recurrente —su nº de
// mandato, su día 2, sus 24,90 €— es la misma para las 21. Aquí se casa la
// línea contra esa definición, con el juicio de E2.3 (`reconocerRecurrente`:
// identidad > texto > importe según modo > calendario del patrón), y se da por
// bueno SOLO cuando el juicio no deja hueco:
//
//   · IDENTIDAD por CUPS o nº de contrato/póliza · el identificador solo puede
//     ser de ese contrato. Cuadra salvo que el importe CONTRADIGA a un fijo
//     (entonces algo cambió: la vía A lo propone, pero no se cierra solo).
//   · Sin identidad (o solo NIF, que una aseguradora comparte entre pisos):
//     texto del proveedor/concepto Y el importe que la definición dice —exacto
//     o ±1 % en un fijo; en un variable, plausible Y el día del patrón—, sin
//     que el calendario diga que no es este mes.
//
// Lo que no llega a eso no se reconoce: sigue en «te necesitan» con la
// propuesta de la vía A, que es donde el usuario decide. Un gasto de inmueble
// cuya categoría no tiene casilla tampoco se cierra solo: la fila fiscal se
// quedaría sin casilla, y en automático no hay a quién pedírsela (misma regla
// que `reglaResuelveSola`).
//
// Puro. `compromisos` deben venir ya filtrados a los activos.

import type { Movement } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import type { OrigenDeterminista } from './tipos';
import { reconocerRecurrente, type RecurrenteReconocido } from '../recurrentes/reconocerRecurrente';
import { resolveCasillaAEAT } from '../treasuryConfirmationService';
import { identificadoresDeMovimiento, normalizarIdentificador } from '../identificadoresDelConcepto';

/**
 * ¿Este juicio basta para cerrar la línea sin preguntar?
 *
 * Es más estricto que «proponer» (la vía A propone con confianza ≥ 60): aquí
 * nadie va a mirar antes de que se escriba la fila fiscal.
 */
export function cierraSola(r: RecurrenteReconocido): boolean {
  if (r.porIdentidad === 'cups' || r.porIdentidad === 'numeroContrato') {
    return r.importe !== 'no_cuadra';
  }
  // NIF o solo texto · hace falta que la definición cuadre en importe.
  if (!r.porTexto && !r.porIdentidad) return false;
  if (r.calendario === 'lejos') return false;
  if (r.importe === 'exacto' || r.importe === 'tolerancia') return true;
  if (r.importe === 'plausible') return r.calendario === 'cuadra';
  return false;
}

/**
 * ¿El recibo trae un identificador del MISMO tipo que el compromiso, y es OTRO?
 *
 * Un compromiso con CUPS y un recibo con un CUPS distinto no son el mismo
 * contrato aunque el proveedor, el importe y el día coincidan: es la luz de
 * otro piso. Eso se propone (vía A), pero no se cierra solo. `referencia` (el
 * campo legacy) cuenta como valor propio.
 */
export function identidadContradicha(m: Movement, c: CompromisoRecurrente): boolean {
  const propios = new Set(
    [c.cups, c.numeroContrato, c.proveedor?.referencia].map((v) => normalizarIdentificador(v ?? '')).filter(Boolean),
  );
  if (propios.size === 0) return false;
  const tieneCups = !!normalizarIdentificador(c.cups ?? '') || !!normalizarIdentificador(c.proveedor?.referencia ?? '');
  const tieneContrato = !!normalizarIdentificador(c.numeroContrato ?? '') || !!normalizarIdentificador(c.proveedor?.referencia ?? '');
  for (const id of identificadoresDeMovimiento(m)) {
    if (id.tipo === 'cups' && tieneCups && !propios.has(id.valor)) return true;
    if (id.tipo === 'contrato' && tieneContrato && !propios.has(id.valor)) return true;
  }
  return false;
}

/** Cómo se llama en pantalla · «Seguro decesos · Segurcaixa». Sin ids. */
export function tituloDeRecurrente(c: CompromisoRecurrente): string {
  const alias = c.alias?.trim();
  const proveedor = c.proveedor?.nombre?.trim();
  if (alias && proveedor && alias.toLowerCase() !== proveedor.toLowerCase()) return `${alias} · ${proveedor}`;
  return alias || proveedor || 'recurrente';
}

/** Un gasto de inmueble necesita casilla para que nazca su fila fiscal. */
function puedeCerrarse(c: CompromisoRecurrente): boolean {
  if (!c.categoria) return false;
  if (c.ambito === 'inmueble' || c.inmuebleId != null || (c.reparto?.length ?? 0) > 0) {
    return !!resolveCasillaAEAT(c.categoria);
  }
  return true;
}

/**
 * Reconoce los cargos que son un recurrente definido, sin previsión.
 *
 * `reconocerRecurrente` ya elige un único ganador o ninguno (dos candidatos
 * pegados = no se elige), así que aquí no hay empate que resolver.
 */
export function recurrentesQueCuadran(
  movimientos: Movement[],
  compromisos: CompromisoRecurrente[],
): OrigenDeterminista[] {
  const out: OrigenDeterminista[] = [];
  if (compromisos.length === 0) return out;

  for (const m of movimientos) {
    if (m.id == null) continue;
    if (m.amount >= 0) continue; // un recurrente de estos es un cargo

    const r = reconocerRecurrente(m, compromisos);
    if (!r || !cierraSola(r)) continue;
    const c = r.compromiso;
    if (c.id == null || !puedeCerrarse(c)) continue;
    // Un NIF no es identidad de contrato: con otro CUPS en el recibo, tampoco.
    if (r.porIdentidad !== 'cups' && r.porIdentidad !== 'numeroContrato' && identidadContradicha(m, c)) continue;

    out.push({
      movementId: m.id,
      fuente: 'recurrente',
      origenId: String(c.id),
      titulo: tituloDeRecurrente(c),
      como: r.porIdentidad === 'cups' || r.porIdentidad === 'numeroContrato' ? 'identidad' : 'definicion',
      categoryKey: c.categoria,
      ...(r.inmuebleId != null ? { inmuebleId: r.inmuebleId } : {}),
    });
  }

  return out;
}
