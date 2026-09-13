// E2.4 · La renta del inquilino contra su CONTRATO · sin previsión.
//
// La previsión de la renta («Renta – Miguel») existe del mes en curso hacia
// delante (`treasurySyncService`). Las 18 rentas de Tenderina del fichero son
// del pasado: no hay previsión y el emparejador no las ve. El CONTRATO sí
// existe para todas: quién paga (`inquilino`), cuánto (`rentaMensual` o el
// `historicoRentas` vigente en la fecha), cuándo (`fechaInicio`..`fechaFin`) y
// dónde (`cuentaCobroId`).
//
// Se reconoce cuando:
//   · el abono cae dentro de la vigencia del contrato (con su margen de gracia),
//   · el importe es EXACTO al céntimo con la renta vigente ese mes, y
//   · el texto del banco nombra al inquilino (dos palabras del nombre · el
//     mismo criterio que `coincidenciaNombre`: nombre de pila y un apellido), o
//     bien dice «alquiler»/«renta» y entra en la cuenta de cobro del contrato.
//
// Con dos contratos que lo expliquen igual no se elige. Un contrato
// `sin_identificar` o `sin_firmar` no explica nada: todavía no es un contrato.
//
// Puro. No toca la base; el cobro se registra al Guardar (`cierrePorDefinicion`).

import type { Movement } from '../db';
import type { Contract } from '../db/types-contratos';
import type { OrigenDeterminista } from './tipos';
import { mismoImporte } from './igualdad';
import { parteDeLaTransferencia } from './traspasosPropios';
import { normalizarTexto } from './texto';
import { claveDeNombre, nivelDeCoincidencia } from '../coincidenciaNombre';
import { contraparteDeBizum } from '../bizum';

const MS_DIA = 86_400_000;
const MARGEN_GRACIA_DEFECTO = 5;
const PALABRAS_DE_RENTA = /\b(ALQUILER|ALQ|RENTA|ARRENDAMIENTO|MENSUALIDAD)\b/;

/** El nombre completo del inquilino, tal como lo escribió el usuario. */
export function nombreDelInquilino(c: Contract): string {
  return `${c.inquilino?.nombre ?? ''} ${c.inquilino?.apellidos ?? ''}`.trim();
}

/** ¿Es un contrato que puede explicar un cobro? */
export function contratoQueCobra(c: Contract): boolean {
  if (c.id == null) return false;
  if (c.estadoContrato === 'sin_identificar' || c.estadoContrato === 'sin_firmar') return false;
  return !!c.fechaInicio && !!c.fechaFin;
}

function dia(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** ¿Cae la fecha dentro de la vigencia, con el margen de gracia a cada lado? */
export function vigenteEn(c: Contract, fecha: string): boolean {
  const margen = (c.margenGraciaDias ?? MARGEN_GRACIA_DEFECTO) * MS_DIA;
  const t = dia(fecha);
  return t >= dia(c.fechaInicio) - margen && t <= dia(c.fechaFin) + margen;
}

/**
 * La renta que el contrato dice para esa fecha · el tramo del histórico
 * vigente, o `rentaMensual` si no hay histórico.
 */
export function rentaVigenteEn(c: Contract, fecha: string): number {
  const f = fecha.slice(0, 10);
  const tramos = (c.historicoRentas ?? [])
    .filter((h) => h.fechaDesde && h.fechaDesde.slice(0, 10) <= f && Number.isFinite(h.importe))
    .sort((a, b) => a.fechaDesde.localeCompare(b.fechaDesde));
  const tramo = tramos[tramos.length - 1];
  return tramo ? tramo.importe : c.rentaMensual;
}

/** Cómo se llama en pantalla · «Renta · Miguel Lorenzo». */
export function tituloDeRenta(c: Contract): string {
  const quien = nombreDelInquilino(c);
  return quien ? `Renta · ${quien}` : 'Renta de alquiler';
}

/**
 * E3.2 · §7.4 · los alias que el usuario YA enseñó · clave del banco → a quién
 * resultó ser. Vacío si no se le pasan: esto sigue siendo puro.
 */
export type AliasAprendidos = ReadonlyMap<string, ReadonlySet<string>>;

/** El nombre que escribe el banco en esta línea · '' si no lo dice. */
function quienPagaSegunElBanco(m: Movement): string {
  const texto = m.description ?? '';
  return (m.counterparty?.trim() || contraparteDeBizum(texto) || parteDeLaTransferencia(normalizarTexto(texto)) || '');
}

/**
 * ¿El usuario ya enseñó que quien firma este abono es este inquilino?
 *
 * Es la otra mitad de V85. El alias se guardaba —«MPARWEZ» es «Adnan Parwez
 * Khan»— y lo leía el emparejador contra las PREVISIONES, pero no esto, que es
 * justo lo que reconoce las rentas del PASADO, donde no hay previsión que
 * emparejar. Enseñárselo una vez no servía para el resto de sus meses.
 */
function elAliasDiceQueEsEl(m: Movement, c: Contract, alias: AliasAprendidos): boolean {
  if (alias.size === 0) return false;
  const banco = claveDeNombre(quienPagaSegunElBanco(m));
  const inquilino = claveDeNombre(nombreDelInquilino(c));
  // Sin nombre a los dos lados no hay nada que preguntar: una clave vacía
  // casaría con cualquier contrato anónimo.
  if (!banco || !inquilino) return false;
  return alias.get(banco)?.has(inquilino) === true;
}

/**
 * Reconoce los abonos que son la renta de un contrato.
 */
export function rentasQueCuadran(
  movimientos: Movement[],
  contratos: Contract[],
  alias: AliasAprendidos = new Map(),
): OrigenDeterminista[] {
  const out: OrigenDeterminista[] = [];
  const vivos = contratos.filter(contratoQueCobra);
  if (vivos.length === 0) return out;

  for (const m of movimientos) {
    if (m.id == null) continue;
    if (m.amount <= 0) continue; // una renta ENTRA

    const texto = `${m.description ?? ''} ${m.counterparty ?? ''}`;
    const textoNorm = normalizarTexto(texto);
    const candidatos: OrigenDeterminista[] = [];

    for (const c of vivos) {
      if (!vigenteEn(c, m.date)) continue;
      if (!mismoImporte(rentaVigenteEn(c, m.date), m.amount)) continue;

      const porNombre =
        nivelDeCoincidencia(texto, nombreDelInquilino(c)) === 'fuerte' ||
        elAliasDiceQueEsEl(m, c, alias);
      const porPalabra = PALABRAS_DE_RENTA.test(textoNorm) && c.cuentaCobroId === m.accountId;
      if (!porNombre && !porPalabra) continue;

      candidatos.push({
        movementId: m.id,
        fuente: 'renta',
        origenId: String(c.id),
        titulo: tituloDeRenta(c),
        como: porNombre ? 'identidad' : 'definicion',
        inmuebleId: Number(c.inmuebleId),
        familia: 'alquiler',
        renta: { contratoId: c.id as number, inquilino: nombreDelInquilino(c) },
      });
    }

    // Empate = no se elige · dos inquilinos con la misma renta el mismo mes se
    // distinguen por el nombre, y si el nombre no los distingue, pregunta.
    if (candidatos.length === 1) out.push(candidatos[0]);
  }

  return out;
}
