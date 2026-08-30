// Lo que el usuario declaró el año pasado · señal de ATRIBUCIÓN, no de cuadre.
//
// Su declaración dice qué gastos tiene cada piso. Eso no permite conciliar nada
// —el IBI de 2026 no es el de 2025, ni en importe ni en día—, pero sí responde
// a la pregunta que de verdad atasca el extracto: cuando entra «RECIBO IBI AYTO
// OVIEDO», ¿de qué piso es? Si solo uno declaró IBI, la respuesta ya estaba
// escrita.
//
// Por eso esto NO devuelve `OrigenDeterminista`: no reconoce, atribuye. La línea
// sigue en «te necesitan» y el usuario decide; lo único que cambia es que la
// tarjeta ya llega con el piso puesto.
//
// ── Dos cosas que el encargo daba por otras ────────────────────────────────
//
// 1 · `GastosInmueble` NO es una lista de `{concepto, importe}`: son siete cubos
//     numéricos fijos (`ibiTasas`, `comunidad`, `suministros`…). Se atribuye por
//     cubo, no por concepto libre.
// 2 · `InmuebleDeclarado` NO lleva `inmuebleId`: identifica por `refCatastral`.
//     El puente a ATLAS es `Property.cadastralReference`. Un piso sin referencia
//     catastral guardada no se puede atribuir, y eso es un dato que falta, no un
//     fallo que tapar.

import type { Movement } from '../db';
import type { Property } from '../db/types';
import type { AtribucionDeterminista } from './tipos';
import { normalizarTexto } from './texto';

/** Los cubos de gasto de la declaración, con cómo los escribe un banco. */
const CUBOS: Array<{ campo: string; concepto: string; pistas: string[] }> = [
  { campo: 'ibiTasas', concepto: 'IBI', pistas: ['IBI', 'CONTRIBUCION', 'BASURA', 'TASA'] },
  { campo: 'comunidad', concepto: 'Comunidad', pistas: ['COMUNIDAD', 'CCPP', 'PROPIETARIOS', 'FINQUES', 'FINCAS'] },
  { campo: 'suministros', concepto: 'Suministros', pistas: ['IBERDROLA', 'ENDESA', 'NATURGY', 'AQUALIA', 'AGUA', 'LUZ', 'GAS'] },
  { campo: 'seguros', concepto: 'Seguro', pistas: ['SEGURO', 'MAPFRE', 'ALLIANZ', 'AXA', 'ZURICH'] },
  { campo: 'interesesFinanciacion', concepto: 'Intereses', pistas: ['INTERESES', 'PRESTAMO', 'HIPOTECA'] },
];

/** Qué cubo sugiere el texto del banco · como mucho uno. */
export function cuboDelTexto(descripcion: string | null | undefined): { campo: string; concepto: string } | null {
  const t = normalizarTexto(descripcion);
  if (!t) return null;
  const tocados = CUBOS.filter((c) => c.pistas.some((p) => t.includes(p)));
  // Dos cubos a la vez («SEGURO HOGAR COMUNIDAD») no identifican nada.
  return tocados.length === 1 ? { campo: tocados[0].campo, concepto: tocados[0].concepto } : null;
}

interface EjercicioLeido {
  año: number;
  aeat?: {
    declaracionCompleta?: {
      inmuebles?: Array<{ refCatastral?: string; gastos?: Record<string, number> }>;
    };
  };
}

/**
 * Quién declaró cada cubo, según el ejercicio MÁS RECIENTE que lo tenga.
 *
 * El más reciente y no todos: si un piso se vendió hace tres años, lo que
 * declaró entonces ya no atribuye nada hoy.
 */
function quienDeclaroCada(
  ejercicios: EjercicioLeido[],
  porCatastro: Map<string, number>,
): Map<string, { inmuebleIds: Set<number>; ejercicio: number }> {
  const conDeclaracion = ejercicios
    .filter((e) => e.aeat?.declaracionCompleta?.inmuebles?.length)
    .sort((a, b) => b.año - a.año);
  const ultimo = conDeclaracion[0];
  if (!ultimo) return new Map();

  const out = new Map<string, { inmuebleIds: Set<number>; ejercicio: number }>();
  for (const inm of ultimo.aeat!.declaracionCompleta!.inmuebles!) {
    const ref = inm.refCatastral?.trim().toUpperCase();
    if (!ref) continue;
    const inmuebleId = porCatastro.get(ref);
    if (inmuebleId == null) continue;

    for (const cubo of CUBOS) {
      const importe = inm.gastos?.[cubo.campo];
      if (!importe || importe <= 0) continue;
      const ya = out.get(cubo.campo);
      if (ya) ya.inmuebleIds.add(inmuebleId);
      else out.set(cubo.campo, { inmuebleIds: new Set([inmuebleId]), ejercicio: ultimo.año });
    }
  }
  return out;
}

/**
 * Atribuye piso a las líneas cuyo gasto solo declaró UN inmueble.
 *
 * Con dos o más no se elige: proponer el piso equivocado es peor que no proponer
 * ninguno, porque el usuario lo acepta de un toque sin releerlo.
 */
export function atribucionesDeclaradas(
  movimientos: Movement[],
  ejercicios: EjercicioLeido[],
  inmuebles: Property[] = [],
): AtribucionDeterminista[] {
  const porCatastro = new Map<string, number>();
  for (const p of inmuebles) {
    const ref = p.cadastralReference?.trim().toUpperCase();
    if (ref && p.id != null) porCatastro.set(ref, p.id);
  }

  const declarantes = quienDeclaroCada(ejercicios, porCatastro);
  if (declarantes.size === 0) return [];

  const out: AtribucionDeterminista[] = [];
  for (const m of movimientos) {
    if (m.id == null) continue;
    // Un gasto declarado es un gasto: sale de la cuenta.
    if (m.amount >= 0) continue;

    const cubo = cuboDelTexto(m.description);
    if (!cubo) continue;
    const quien = declarantes.get(cubo.campo);
    if (!quien || quien.inmuebleIds.size !== 1) continue;

    out.push({
      movementId: m.id,
      inmuebleId: Array.from(quien.inmuebleIds)[0],
      concepto: cubo.concepto,
      ejercicio: quien.ejercicio,
    });
  }
  return out;
}
