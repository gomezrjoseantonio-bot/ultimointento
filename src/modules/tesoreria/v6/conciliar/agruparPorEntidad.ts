// ============================================================================
// Agrupar por ENTIDAD · no por texto ni por familia
// ============================================================================
//
// Un grupo = una entidad del mundo del usuario: un punto de suministro (CUPS),
// un contrato o préstamo (nº de contrato), una persona o empresa (NIF, o su
// nombre cuando el banco solo da eso), lo que casó con un previsto, y «los
// traspasos entre tus cuentas». Confirmar la entidad UNA vez coloca todos sus
// movimientos, sean 24 o 1, cada uno en su fecha. Con 4.000 movimientos salen
// ~45 entidades; con 5, tres o cuatro. Misma pantalla, escala sola.
//
// Por qué no por texto: el banco mete el nº de recibo, el CUPS y el mes dentro
// del concepto, así que dos recibos de la misma luz llegan con textos distintos
// y dos CUPS distintos de Iberdrola llegan con el mismo. Por qué no solo por
// familia: «Suministro · Luz» junta el piso A con el piso B, y eso es
// exactamente lo que el usuario tiene que poder separar.
//
// El identificador NO viene guardado en la línea (el motor lo extrae al
// clasificar y no lo persiste); se deriva aquí con la misma función que usa el
// motor (`identificadoresDeMovimiento`), que es pura. Nada nuevo que persistir.
// ============================================================================

import { identificadoresDeMovimiento, type Identificador, type TipoIdentificador } from '../../../../services/identificadoresDelConcepto';
import { labelClasificacion, labelFamilia, LABEL_METODO, type FamiliaId } from '../../../../services/catalogo/catalogoUnico';
import type { ClasificacionLinea } from '../../../../services/clasificacion/clasificarLinea';
import { estaClasificada, etiquetaDeClasificacion } from '../../../../services/clasificacion/clasificada';
import type { LineaExtracto } from '../extractoSesion';
import { claveDeGrupo } from './agruparResueltas';

export type TipoEntidad = 'identificador' | 'previsto' | 'contraparte' | 'interno';

/** El icono habla de QUÉ es la entidad · lo decide quien pinta, aquí solo el nombre. */
export type IconoEntidad = 'suministro' | 'inmueble' | 'prestamo' | 'inversion' | 'persona' | 'traspaso' | 'otro';

export interface Entidad {
  /** Clave estable · no se enseña. */
  clave: string;
  tipo: TipoEntidad;
  /** «Iberdrola · luz» · «Víctor Lada · bizums» · «Traspasos entre tus cuentas». */
  nombre: string;
  /** El renglón pequeño · «CUPS ES00…614000 · domiciliación · 24 recibos de ene a dic». */
  sub: string;
  /** Adónde va · la etiqueta de los ejes, o el piso si lo sabe. */
  destino: string;
  inmuebleId?: number;
  /** La clasificación que representa al grupo · la de la primera línea con familia. */
  clasificacion?: ClasificacionLinea;
  /** Movimiento interno · no cuenta como gasto ni ingreso. */
  interno: boolean;
  icono: IconoEntidad;
  cuantas: number;
  total: number;
  desde: string;
  hasta: string;
  lineas: LineaExtracto[];
}

// ─── la clave ────────────────────────────────────────────────────────────────

/** De más a menos identificador · un CUPS dice más que un NIF, y un NIF más que una tarjeta. */
const FUERZA: Record<TipoIdentificador, number> = { cups: 5, contrato: 4, nif: 3, iban: 2, tarjeta: 1 };

function identificadorMasFuerte(l: LineaExtracto): Identificador | undefined {
  const ids = identificadoresDeMovimiento({
    description: l.textoBanco,
    counterparty: l.contraparte,
    reference: l.referencia,
  });
  return ids.slice().sort((a, b) => FUERZA[b.tipo] - FUERZA[a.tipo])[0];
}

function esInterno(l: LineaExtracto): boolean {
  return l.clasificacion?.naturaleza === 'movimiento_interno';
}

/**
 * El nombre de la contraparte cuando el banco no da identificador · la
 * columna de contraparte si la hay, y si no el concepto sin lo que cambia en
 * cada recibo (números, referencias).
 */
export function quienEs(l: LineaExtracto): string {
  const c = l.contraparte?.trim();
  if (c) return c;
  const texto = l.textoBanco.trim();
  // Primero fuera los TOKENS con dígitos enteros («Y8CSFFT», «08/2026»,
  // «0182-5322»): son referencias, no nombre. Si no queda nada (la línea es
  // toda referencias), se quitan solo los dígitos y se ve qué letras quedan.
  const sinTokens = texto.replace(/\S*\d\S*/g, ' ').replace(/[^\p{L}\s&.'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (sinTokens) return sinTokens;
  const sinDigitos = texto.replace(/[0-9]+/g, ' ').replace(/[^\p{L}\s&.'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return sinDigitos || texto;
}

/** Lo que casó · el previsto o el confirmado, sin el número que cambia. */
function conQueCaso(l: LineaExtracto): string | undefined {
  const d = l.previsto?.descripcion ?? l.confirmado?.descripcion;
  return d ? claveDeGrupo(d) || d.toLowerCase() : undefined;
}

export interface ClaveDeEntidad {
  clave: string;
  tipo: TipoEntidad;
  identificador?: Identificador;
}

export function claveDeEntidad(l: LineaExtracto): ClaveDeEntidad {
  if (esInterno(l)) {
    return { clave: `interno:${l.clasificacion?.subtipo ?? 'traspaso'}`, tipo: 'interno' };
  }
  const id = identificadorMasFuerte(l);
  if (id) return { clave: `${id.tipo}:${id.valor}`, tipo: 'identificador', identificador: id };
  const caso = conQueCaso(l);
  if (caso) return { clave: `previsto:${caso}`, tipo: 'previsto' };
  const quien = claveDeGrupo(quienEs(l)) || quienEs(l).toLowerCase();
  const familia = l.clasificacion?.familia;
  return { clave: familia ? `quien:${quien}|${familia}` : `quien:${quien}`, tipo: 'contraparte' };
}

// ─── el nombre, el destino, el icono ─────────────────────────────────────────

const NOMBRE_INTERNO: Record<string, string> = {
  a_otra_cuenta: 'Traspasos entre tus cuentas',
  a_ahorro: 'Ahorro · lo que apartas',
  a_efectivo: 'Retiradas de efectivo',
  a_tarjeta: 'Pagos de la tarjeta',
};

/** La clasificación que representa al grupo · la primera que tenga familia. */
function clasificacionDelGrupo(lineas: LineaExtracto[]): ClasificacionLinea | undefined {
  return lineas.find((l) => l.clasificacion && estaClasificada(l.clasificacion))?.clasificacion
    ?? lineas.find((l) => l.clasificacion?.familia)?.clasificacion;
}

const INMUEBLE: ReadonlySet<string> = new Set<FamiliaId>([
  'comunidad', 'impuestos_tasas', 'reparacion_mantenimiento', 'reforma_mejora', 'seguros_alarmas', 'limpieza', 'mobiliario_enseres', 'alquiler',
]);

export function iconoDeEntidad(tipo: TipoEntidad, c: ClasificacionLinea | undefined, id?: Identificador): IconoEntidad {
  if (tipo === 'interno') return 'traspaso';
  const f = c?.familia;
  if (f === 'suministro' || id?.tipo === 'cups') return 'suministro';
  if (f === 'prestamo_hipoteca' || f === 'disposicion_prestamo') return 'prestamo';
  if (f === 'inversion' || f === 'rendimiento' || f === 'venta' || f === 'aportacion') return 'inversion';
  if (f && INMUEBLE.has(f)) return 'inmueble';
  if (c?.ambito === 'inmueble' || c?.inmuebleId != null) return 'inmueble';
  if (id?.tipo === 'nif' || tipo === 'contraparte' || f === 'nomina' || f === 'pension' || f === 'autonomo') return 'persona';
  return 'otro';
}

function nombreDeEntidad(k: ClaveDeEntidad, lineas: LineaExtracto[], c: ClasificacionLinea | undefined): string {
  const primera = lineas[0];
  if (k.tipo === 'interno') {
    const sub = c?.subtipo ?? '';
    return NOMBRE_INTERNO[sub] ?? (c ? etiquetaDeClasificacion(c) : 'Traspasos entre tus cuentas');
  }
  if (k.tipo === 'previsto') return primera.previsto?.descripcion ?? primera.confirmado?.descripcion ?? quienEs(primera);
  const quien = quienEs(primera);
  // «Iberdrola · luz» · el subtipo en minúscula detrás del nombre, si lo hay.
  const subtipo = c?.familia && c.subtipo ? labelClasificacion(c.familia, c.subtipo).split(' · ').pop() : undefined;
  return subtipo && !quien.toLowerCase().includes(subtipo.toLowerCase()) ? `${quien} · ${subtipo.toLowerCase()}` : quien;
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y.slice(2)}` : iso;
}

function subDeEntidad(k: ClaveDeEntidad, lineas: LineaExtracto[], c: ClasificacionLinea | undefined): string {
  const partes: string[] = [];
  if (k.identificador) {
    const v = k.identificador.valor;
    const corto = v.length > 12 ? `${v.slice(0, 4)}…${v.slice(-6)}` : v;
    partes.push(`${k.identificador.tipo.toUpperCase()} ${corto}`);
  }
  if (c?.metodo) partes.push(LABEL_METODO[c.metodo].toLowerCase());
  const fechas = lineas.map((l) => l.fecha).filter(Boolean).sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];
  if (desde) partes.push(desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} a ${fechaCorta(hasta)}`);
  return partes.join(' · ');
}

function destinoDeEntidad(k: ClaveDeEntidad, c: ClasificacionLinea | undefined, aliasPorInmueble?: ReadonlyMap<number, string>): string {
  if (k.tipo === 'interno') return 'movimiento interno · no cuenta como gasto ni ingreso';
  if (!c || !c.familia) return 'sin clasificar';
  const que = etiquetaDeClasificacion(c);
  if (c.inmuebleId != null) {
    const alias = aliasPorInmueble?.get(c.inmuebleId);
    return alias ? `${alias} · ${que}` : que;
  }
  return c.ambito === 'personal' && c.origen.ambito !== 'defecto' ? `${que} · tuyo` : que;
}

// ─── agrupar ─────────────────────────────────────────────────────────────────

/**
 * Agrupa por entidad. Orden: más líneas primero, y a igualdad más dinero en
 * valor absoluto: lo que más se repite y lo que más pesa es lo que el usuario
 * quiere ver sin desplegar.
 */
export function agruparPorEntidad(
  lineas: LineaExtracto[],
  aliasPorInmueble?: ReadonlyMap<number, string>,
): Entidad[] {
  const porClave = new Map<string, { k: ClaveDeEntidad; lineas: LineaExtracto[] }>();
  for (const l of lineas) {
    const k = claveDeEntidad(l);
    const ya = porClave.get(k.clave);
    if (ya) ya.lineas.push(l);
    else porClave.set(k.clave, { k, lineas: [l] });
  }

  const out: Entidad[] = [];
  for (const { k, lineas: delGrupo } of Array.from(porClave.values())) {
    const c = clasificacionDelGrupo(delGrupo);
    const fechas = delGrupo.map((l) => l.fecha).filter(Boolean).sort();
    out.push({
      clave: k.clave,
      tipo: k.tipo,
      nombre: nombreDeEntidad(k, delGrupo, c),
      sub: subDeEntidad(k, delGrupo, c),
      destino: destinoDeEntidad(k, c, aliasPorInmueble),
      ...(c?.inmuebleId != null ? { inmuebleId: c.inmuebleId } : {}),
      ...(c ? { clasificacion: c } : {}),
      interno: k.tipo === 'interno',
      icono: iconoDeEntidad(k.tipo, c, k.identificador),
      cuantas: delGrupo.length,
      total: delGrupo.reduce((a, l) => a + l.importe, 0),
      desde: fechas[0] ?? '',
      hasta: fechas[fechas.length - 1] ?? '',
      lineas: delGrupo,
    });
  }
  out.sort((a, b) => b.cuantas - a.cuantas || Math.abs(b.total) - Math.abs(a.total));
  return out;
}

// ─── el hero · entró / salió por familia ─────────────────────────────────────

export interface FlujoPorFamilia {
  familia: FamiliaId | null;
  etiqueta: string;
  total: number;
}

export interface ResumenFlujo {
  entro: { total: number; familias: FlujoPorFamilia[] };
  salio: { total: number; familias: FlujoPorFamilia[] };
  /** Cuántas líneas son movimiento interno · no cuentan ni como entrada ni como salida. */
  internos: number;
  desde: string;
  hasta: string;
  cuantas: number;
}

const FAMILIAS_GORDAS = 3;

function ladoDelFlujo(lineas: LineaExtracto[]): { total: number; familias: FlujoPorFamilia[] } {
  const porFamilia = new Map<FamiliaId | null, number>();
  let total = 0;
  for (const l of lineas) {
    total += l.importe;
    const f = l.clasificacion?.familia ?? null;
    porFamilia.set(f, (porFamilia.get(f) ?? 0) + l.importe);
  }
  const familias = Array.from(porFamilia.entries())
    .filter(([f]) => f !== null)
    .map(([f, t]) => ({ familia: f, etiqueta: labelFamilia(f as FamiliaId), total: t }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    .slice(0, FAMILIAS_GORDAS);
  return { total, familias };
}

/** Lo gordo del extracto · para el hero. Los internos van aparte: dinero que cambia de sitio. */
export function resumenDelFlujo(lineas: LineaExtracto[]): ResumenFlujo {
  const noInternos = lineas.filter((l) => !esInterno(l));
  const fechas = lineas.map((l) => l.fecha).filter(Boolean).sort();
  return {
    entro: ladoDelFlujo(noInternos.filter((l) => l.importe > 0)),
    salio: ladoDelFlujo(noInternos.filter((l) => l.importe < 0)),
    internos: lineas.length - noInternos.length,
    desde: fechas[0] ?? '',
    hasta: fechas[fechas.length - 1] ?? '',
    cuantas: lineas.length,
  };
}
