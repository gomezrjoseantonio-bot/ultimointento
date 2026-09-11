// ============================================================================
// E2.4.2 · MOTOR DE CLASIFICACIÓN · los 4 ejes de una línea, con su origen
// ============================================================================
//
// Para CADA línea, en este orden EXACTO. En cuanto un paso resuelve un eje con
// certeza, ese eje queda fijado (con su origen); los siguientes solo rellenan
// los ejes aún vacíos. No se re-pisa lo ya resuelto por una fuente más fuerte.
//
//   1 · REGLAS APRENDIDAS (`movementLearningRules` · vía B del sugeridor) ·
//       lo que el usuario YA confirmó · máxima prioridad · si casa, los ejes
//       de clasificación quedan y se para.
//   2 · IDENTIFICADOR · lo reconocido contra una definición o un cuadro por
//       CUPS / nº contrato / IBAN / nº tarjeta (deterministas · vía A por
//       identidad) · y la tarjeta o cuenta PROPIA por sus cuatro últimos.
//   3 · CONCEPTO explícito · las reglas duras (`reglasDuras`) con límite de
//       palabra.
//   4 · RECURRENCIA · un recurrente que casa por texto (vía A sin identidad) ·
//       el piso que declaraste el año pasado (atribución).
//   5 · DEFECTO · naturaleza por signo, método por el texto, «personal», sin
//       familia. No se inventa.
//
// El SIGNO manda sobre todo (regla 2): una fuente que proponga un ingreso sobre
// un cargo, o un gasto sobre un abono, no se aplica. Un movimiento interno vale
// con cualquier signo (su `sentido` lo dice).
//
// Esto NO escribe nada ni decide si la línea se cierra sola: eso sigue siendo
// del emparejador, del reconocedor y de las reglas con confianza (E2.2). Solo
// dice QUÉ es, eje a eje, y por qué. Puro.
// ============================================================================

import type { Movement } from '../db';
import type { MovementSuggestion } from '../movementSuggestionService';
import type { AtribucionDeterminista, OrigenDeterminista } from '../deterministas/tipos';
import { identificadoresDeMovimiento, normalizarIdentificador } from '../identificadoresDelConcepto';
import {
  esFamiliaId,
  naturalezaDe,
  naturalezaPorSigno,
  type Ambito,
  type FamiliaId,
  type Naturaleza,
  type Sentido,
} from '../catalogo/catalogoUnico';
import { metodoDelConcepto } from './metodoDelConcepto';
import { porConcepto } from './reglasDuras';
import type { ClasificacionLinea, OrigenEje, Parcial } from './tipos';

export type { ClasificacionLinea, OrigenEje, OrigenPorEje } from './tipos';

/** Lo que el motor necesita saber del usuario · se carga una vez por lote. */
export interface ContextoClasificacion {
  /** Las sugerencias del sugeridor para esta línea (vías A, B, C). */
  sugerencias?: ReadonlyArray<Omit<MovementSuggestion, 'movementId'>>;
  /** Lo reconocido contra un libro o una definición (deterministas). */
  origen?: Omit<OrigenDeterminista, 'movementId'>;
  /** El piso que declaró este gasto el año pasado. */
  atribucion?: Omit<AtribucionDeterminista, 'movementId'>;
  /** Cuentas propias · para «*4437» = cuatro últimos de un IBAN propio. */
  cuentas: ReadonlyArray<{ id?: number; iban?: string; status?: string }>;
  /** Tarjetas propias · para «Revolut**0940*» = tarjeta propia (regla 6). */
  tarjetas: ReadonlyArray<{ id?: number; ultimosCuatro?: string; activa?: boolean }>;
  /** Los nombres con los que el usuario aparece en un extracto. */
  nombresTitular: readonly string[];
}

// ─── el signo manda ──────────────────────────────────────────────────────────

function compatibleConSigno(naturaleza: Naturaleza | undefined, amount: number): boolean {
  if (!naturaleza || naturaleza === 'movimiento_interno' || amount === 0) return true;
  // Un GASTO en positivo es la DEVOLUCIÓN de ese gasto y cabe (E2.4.2-fix): el
  // abono de la comercializadora es del suministro, no un ingreso ajeno. Al
  // revés no: un ingreso que sale no es nada, así que ese bloqueo se queda.
  if (naturaleza === 'gasto' && amount > 0) return true;
  return naturaleza === naturalezaPorSigno(amount);
}

// ─── fundir un parcial sobre lo que ya hay ──────────────────────────────────

function aplicar(c: ClasificacionLinea, p: Parcial, origen: OrigenEje, amount: number): boolean {
  if (!compatibleConSigno(p.naturaleza, amount)) return false;
  // Una familia dice su naturaleza · si contradice el signo, tampoco vale.
  const natDeFamilia = p.familia ? naturalezaDe(p.familia) : undefined;
  if (natDeFamilia && !compatibleConSigno(natDeFamilia, amount)) return false;

  // Una regla APRENDIDA no convierte un abono en devolución. Se aprendió sobre
  // un gasto suelto y no trae punto ni proveedor que ate el dinero a nada, así
  // que sobre un ingreso solo puede equivocarse: es el mismo criterio que
  // aplica `contradiceElSigno` a las propuestas. La devolución con proveedor
  // reconocible entra por el concepto, y la del recibo de un compromiso por su
  // identificador — las dos sí saben de qué gasto vuelve el dinero.
  if (origen === 'aprendida' && amount > 0 && (p.naturaleza === 'gasto' || natDeFamilia === 'gasto')) return false;

  let tocado = false;
  const fijaNaturaleza = p.naturaleza ?? natDeFamilia;
  if (fijaNaturaleza && c.origen.naturaleza === 'defecto') {
    c.naturaleza = fijaNaturaleza;
    c.origen.naturaleza = origen;
    tocado = true;
  }
  if (p.familia && c.familia === undefined && (natDeFamilia === c.naturaleza)) {
    c.familia = p.familia;
    c.origen.familia = origen;
    if (p.subtipo) { c.subtipo = p.subtipo; c.origen.subtipo = origen; }
    tocado = true;
  }
  if (p.metodo && c.metodo === undefined) { c.metodo = p.metodo; c.origen.metodo = origen; tocado = true; }
  if (p.inmuebleId != null && c.inmuebleId == null) {
    c.inmuebleId = p.inmuebleId;
    c.origen.inmuebleId = origen;
    c.ambito = 'inmueble';
    c.origen.ambito = origen;
    tocado = true;
  } else if (p.ambito && c.origen.ambito === 'defecto' && !(p.ambito === 'inmueble' && c.inmuebleId == null)) {
    c.ambito = p.ambito;
    c.origen.ambito = origen;
    tocado = true;
  }
  if (p.sentido && c.naturaleza === 'movimiento_interno' && c.sentido === undefined) c.sentido = p.sentido;
  // Un AVISO (regla que solo trae motivo, sin ejes · el IVA) también se anota:
  // la línea se queda sin clasificar a propósito y tiene que poder decir por qué.
  if (tocado || esSoloAviso(p)) c.motivos.push(p.motivo);
  return tocado;
}

function esSoloAviso(p: Parcial): boolean {
  return p.naturaleza === undefined && p.familia === undefined && p.metodo === undefined
    && p.ambito === undefined && p.inmuebleId == null && p.sentido === undefined;
}

// ─── 1 · aprendida ───────────────────────────────────────────────────────────

function parcialDeSugerencia(s: Omit<MovementSuggestion, 'movementId'>, motivo: string): Parcial | undefined {
  const a = s.action;
  switch (a.kind) {
    case 'create_treasury_event':
      return {
        naturaleza: a.naturaleza,
        ...(a.familia && esFamiliaId(a.familia) ? { familia: a.familia, subtipo: a.subtipo } : {}),
        ambito: a.ambito,
        ...(a.inmuebleId != null ? { inmuebleId: a.inmuebleId } : {}),
        motivo,
      };
    case 'mark_personal_expense':
      return {
        naturaleza: 'gasto',
        ...(a.familia && esFamiliaId(a.familia) ? { familia: a.familia, subtipo: a.subtipo } : {}),
        ambito: 'personal',
        motivo,
      };
    case 'transfer':
      return { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_otra_cuenta', sentido: 'sale', motivo };
    case 'assign_to_contract':
      return { naturaleza: 'ingreso', familia: 'alquiler', motivo };
    default:
      return undefined;
  }
}

function aprendida(ctx: ContextoClasificacion): Parcial | undefined {
  const s = ctx.sugerencias?.find((x) => x.via === 'learning_rule');
  return s ? parcialDeSugerencia(s, 'regla aprendida · ya lo confirmaste antes') : undefined;
}

// ─── 2 · identificador ───────────────────────────────────────────────────────

function parcialDeOrigen(o: Omit<OrigenDeterminista, 'movementId'>): Parcial {
  const piso = o.inmuebleId != null ? { inmuebleId: o.inmuebleId } : {};
  switch (o.fuente) {
    case 'prestamo':
      return { naturaleza: 'gasto', familia: 'prestamo_hipoteca', metodo: 'domiciliacion', ...piso, motivo: `cuadro del préstamo · ${o.titulo}` };
    case 'venta':
      return { naturaleza: 'ingreso', familia: 'venta', subtipo: 'inmueble', ...piso, motivo: `venta registrada · ${o.titulo}` };
    case 'inversion':
      return { naturaleza: 'ingreso', familia: 'rendimiento', subtipo: o.subtipo ?? 'rendimiento_inversion', motivo: `pago de la inversión · ${o.titulo}` };
    case 'nomina':
      return { naturaleza: 'ingreso', familia: 'nomina', metodo: 'transferencia', motivo: `tu nómina · ${o.titulo}` };
    case 'traspaso':
      return {
        naturaleza: 'movimiento_interno',
        familia: 'traspaso',
        subtipo: 'a_otra_cuenta',
        sentido: o.traspaso?.sentido === 'entrada' ? 'entra' : 'sale',
        metodo: 'transferencia',
        motivo: `traspaso entre cuentas propias · ${o.titulo}`,
      };
    case 'renta':
      return { naturaleza: 'ingreso', familia: 'alquiler', ...piso, motivo: `renta del contrato · ${o.titulo}` };
    case 'recurrente':
    default:
      return {
        ...(o.familia ? { naturaleza: naturalezaDe(o.familia), familia: o.familia, subtipo: o.subtipo } : {}),
        ...piso,
        motivo: `recurrente · ${o.titulo}`,
      };
  }
}

function cuatroUltimosDe(m: Pick<Movement, 'description' | 'counterparty' | 'reference'>): string[] {
  return identificadoresDeMovimiento(m)
    .filter((id) => id.tipo === 'tarjeta')
    .map((id) => id.valor.slice(-4));
}

/** Regla 6 · «Revolut**0940*» con una tarjeta propia que acaba en 0940, o «*4437» = un IBAN propio. */
function tarjetaOCuentaPropia(m: Movement, ctx: ContextoClasificacion): Parcial | undefined {
  const cuatro = cuatroUltimosDe(m);
  if (cuatro.length === 0) return undefined;
  const tarjeta = ctx.tarjetas.find((t) => t.activa !== false && t.ultimosCuatro && cuatro.includes(t.ultimosCuatro));
  if (tarjeta) {
    return {
      naturaleza: 'movimiento_interno',
      familia: 'traspaso',
      subtipo: 'a_tarjeta',
      sentido: m.amount < 0 ? 'sale' : 'entra',
      motivo: `tarjeta propia ****${tarjeta.ultimosCuatro} · recarga, no gasto`,
    };
  }
  const cuenta = ctx.cuentas.find(
    (c) => c.status !== 'DELETED' && c.id !== m.accountId && c.iban && cuatro.includes(normalizarIdentificador(c.iban).slice(-4)),
  );
  if (cuenta) {
    return {
      naturaleza: 'movimiento_interno',
      familia: 'traspaso',
      subtipo: 'a_otra_cuenta',
      sentido: m.amount < 0 ? 'sale' : 'entra',
      motivo: `cuenta propia ····${normalizarIdentificador(cuenta.iban as string).slice(-4)} · traspaso`,
    };
  }
  return undefined;
}

function identificador(m: Movement, ctx: ContextoClasificacion): Parcial[] {
  const out: Parcial[] = [];
  if (ctx.origen) out.push(parcialDeOrigen(ctx.origen));
  const viaA = ctx.sugerencias?.find((s) => s.via === 'compromiso_recurrente' && s.metadata?.porIdentidad);
  if (viaA) {
    const p = parcialDeSugerencia(viaA, `recurrente por ${String(viaA.metadata?.porIdentidad)}`);
    if (p) out.push(p);
  }
  const propia = tarjetaOCuentaPropia(m, ctx);
  if (propia) out.push(propia);
  return out;
}

// ─── 4 · recurrencia ─────────────────────────────────────────────────────────

function recurrencia(ctx: ContextoClasificacion): Parcial[] {
  const out: Parcial[] = [];
  const viaA = ctx.sugerencias?.find((s) => s.via === 'compromiso_recurrente' && !s.metadata?.porIdentidad);
  if (viaA) {
    const p = parcialDeSugerencia(viaA, 'recurrente que casa por texto e importe');
    if (p) out.push(p);
  }
  if (ctx.atribucion) {
    out.push({
      inmuebleId: ctx.atribucion.inmuebleId,
      motivo: `lo declaraste en ${ctx.atribucion.ejercicio} para ese piso (${ctx.atribucion.concepto})`,
    });
  }
  return out;
}

// ─── el motor ────────────────────────────────────────────────────────────────

/**
 * Los 4 ejes de un movimiento en memoria, cada uno con su origen.
 */
export function clasificarLinea(m: Movement, ctx: ContextoClasificacion): ClasificacionLinea {
  // 5 · el defecto, de partida · lo que quede así, quedó por defecto.
  const c: ClasificacionLinea = {
    naturaleza: naturalezaPorSigno(m.amount),
    ambito: 'personal' as Ambito,
    origen: { naturaleza: 'defecto', ambito: 'defecto' },
    motivos: [],
  };
  const metodo = metodoDelConcepto(m.description, m.reference);
  if (metodo) { c.metodo = metodo; c.origen.metodo = 'concepto'; }

  // 1 · aprendida · si casa, los ejes de clasificación quedan y se para.
  const regla = aprendida(ctx);
  if (regla && aplicar(c, regla, 'aprendida', m.amount)) return cerrar(c);

  // 2 · identificador
  for (const p of identificador(m, ctx)) aplicar(c, p, 'identificador', m.amount);

  // 3 · concepto
  const concepto = porConcepto({ description: m.description ?? '', reference: m.reference, amount: m.amount }, ctx);
  if (concepto) aplicar(c, concepto, 'concepto', m.amount);

  // 4 · recurrencia
  for (const p of recurrencia(ctx)) aplicar(c, p, 'recurrencia', m.amount);

  return cerrar(c);
}

function cerrar(c: ClasificacionLinea): ClasificacionLinea {
  if (c.naturaleza !== 'movimiento_interno') delete c.sentido;
  if (c.motivos.length === 0) c.motivos.push('sin señal · naturaleza por el signo, personal por defecto');
  return c;
}

/** Lo que se persiste de la clasificación en la línea y en el movimiento. */
export function ejesDe(c: ClasificacionLinea): {
  naturaleza: Naturaleza;
  familia?: FamiliaId;
  subtipo?: string;
  metodo?: ClasificacionLinea['metodo'];
  ambito: Ambito;
  inmuebleId?: number;
  sentido?: Sentido;
} {
  return {
    naturaleza: c.naturaleza,
    ...(c.familia ? { familia: c.familia } : {}),
    ...(c.subtipo ? { subtipo: c.subtipo } : {}),
    ...(c.metodo ? { metodo: c.metodo } : {}),
    ambito: c.ambito,
    ...(c.inmuebleId != null ? { inmuebleId: c.inmuebleId } : {}),
    ...(c.sentido ? { sentido: c.sentido } : {}),
  };
}
