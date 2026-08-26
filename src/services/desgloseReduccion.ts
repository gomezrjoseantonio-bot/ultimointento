// ============================================================================
// La forma del dato de reducción · un solo sitio, un solo lenguaje
// ============================================================================
//
// `reduccionAlquiler.ts` dice CUÁNTO reduce un contrato. Este módulo dice cómo
// se cuenta eso en pantalla, y es el único sitio donde se decide.
//
// Antes viajaban dos formas por la app, y ninguna decía nada:
//
//   · `porcentajeReduccion: number` — un 60 fijo que no salía de ningún
//     contrato, solo del modo de declaración.
//   · `porcentajeReduccionHabitual` — el % EFECTIVO: reducción ÷ rendimiento.
//     De ahí salía el «26 %», que es la media entre un tramo al 60 % y otro al
//     0 %. Ese número no aparece en el art. 23.2 ni en la declaración: no es el
//     porcentaje de nada, es el resultado de haber sumado peras y manzanas.
//
// Lo que se cuenta ahora es lo que el arrendador puede reconocer en su Modelo
// 100: el IMPORTE reducido —dato principal— y un tramo por cada régimen con su
// porcentaje NOMINAL, el de la ley. Dos tramos son dos chips, no una media.
//
// Las tres reglas que sostienen el módulo:
//
//   1. El importe es el dato. El porcentaje acompaña.
//   2. Un porcentaje solo se enseña si es NOMINAL y consta. Nunca se infiere
//      dividiendo, salvo cuando la división no puede mezclar nada (§ derivar).
//   3. `null` no es 0. «No hubo reducción» y «no lo sabemos» son cosas
//      distintas y la estructura las distingue; rellenar la segunda con un cero
//      —o con un 60 %— es justo el error que esto viene a cerrar.
// ============================================================================

import { calcularPorcentajeReduccionContrato } from './reduccionAlquiler';

/**
 * El régimen de un tramo.
 *
 * `temporada_o_turistico` no es un cajón de sastre: es el par que NUNCA se puede
 * separar cuando el tramo no reduce. En un año importado el Modelo 100 no los
 * distingue, y para el art. 23.2 se comportan igual —ninguno de los dos reduce—,
 * así que el chip los nombra a los dos en vez de elegir uno.
 */
export type TipoTramo =
  | 'vivienda_habitual'
  | 'temporada'
  | 'turistico'
  | 'temporada_o_turistico';

export interface TramoReduccion {
  tipo: TipoTramo;
  /** % NOMINAL del art. 23.2. `null` = no consta y no se infiere. */
  pct: number | null;
  /** Rendimiento neto que le corresponde al tramo, cuando se sabe repartir. */
  base?: number;
}

export interface DesgloseReduccion {
  /** Importe total reducido, en euros. `null` = dato ausente. */
  importe: number | null;
  tramos: TramoReduccion[];
  /** `declarado` = leído del Modelo 100. `atlas` = calculado por el motor. */
  origen: 'declarado' | 'atlas';
  /** Rendimiento antes de reducir (0149) al que se refiere el importe. */
  rendimientoAntes?: number | null;
}

/** Los únicos porcentajes que el art. 23.2 LIRPF admite. */
const NOMINALES = [50, 60, 70, 90] as const;

/**
 * Cuánto puede desviarse una división de un nominal para seguir siendo ese
 * nominal, en puntos porcentuales. La AEAT redondea a céntimos, así que la
 * desviación real es de milésimas; medio punto deja sitio de sobra sin llegar
 * a confundir un 50 con un 60.
 */
const TOLERANCIA_PP = 0.5;

const NOMBRE_TRAMO: Record<TipoTramo, string> = {
  vivienda_habitual: 'vivienda habitual',
  temporada: 'temporada',
  turistico: 'turístico',
  temporada_o_turistico: 'temporada/turístico',
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const finito = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/** Cómo se rotula un tramo · el mismo texto para lo declarado y lo calculado. */
export function etiquetaTramo(tramo: Pick<TramoReduccion, 'tipo' | 'pct'>): string {
  const nombre = NOMBRE_TRAMO[tramo.tipo];
  return tramo.pct === null ? nombre : `${tramo.pct}% ${nombre}`;
}

/** Si hay algo que enseñar. Sin esto, la pantalla dice «sin datos», no «0 €». */
export function hayDato(desglose: DesgloseReduccion): boolean {
  return desglose.importe !== null;
}

/** El desglose de lo que no se sabe. Explícito, para no confundirlo con un 0. */
export function desgloseAusente(origen: DesgloseReduccion['origen'] = 'atlas'): DesgloseReduccion {
  return { importe: null, tramos: [], origen, rendimientoAntes: null };
}

/**
 * El desglose de algo que no reduce y se sabe que no reduce.
 *
 * Distinto de `desgloseAusente`: aquí el 0 es un dato, no un hueco. Lo usan los
 * rendimientos que no son un arrendamiento propio —capital inmobiliario
 * atribuido por una entidad, por ejemplo—, donde no hay art. 23.2 que aplicar.
 */
export function desgloseSinReduccion(
  origen: DesgloseReduccion['origen'] = 'atlas',
): DesgloseReduccion {
  return { importe: 0, tramos: [], origen };
}

/**
 * El tipo de tramo de un contrato de ATLAS, por su modalidad.
 *
 * Aquí sí se sabe cuál de los dos regímenes cortos es, porque el contrato lo
 * dice. Una modalidad que no reconocemos no reduce y no se puede afinar: cae en
 * el mismo par que en importado.
 */
export function tipoDeModalidad(modalidad: string | undefined | null): TipoTramo {
  if (modalidad === 'habitual') return 'vivienda_habitual';
  if (modalidad === 'temporada') return 'temporada';
  if (modalidad === 'vacacional' || modalidad === 'turistico') return 'turistico';
  return 'temporada_o_turistico';
}

/** Mayor reducción primero · el tramo que más pesa encabeza el rótulo. */
const ordenar = (tramos: TramoReduccion[]): TramoReduccion[] =>
  [...tramos].sort((a, b) => (b.pct ?? Number.MAX_SAFE_INTEGER) - (a.pct ?? Number.MAX_SAFE_INTEGER));

export interface ArrendamientoDeclaradoTramo {
  /** `PORCF`/`C_REDARR` del XML: si ese arrendamiento llevaba reducción. */
  conReduccion: boolean;
}

export interface EntradaDesgloseDeclarado {
  arrendamientos: ArrendamientoDeclaradoTramo[];
  /** Casilla 0150 · el importe que se declaró. Verdad cerrada. */
  reduccion: number | null | undefined;
  /** Casilla 0149 · rendimiento antes de reducir. */
  rendimientoAntes: number | null | undefined;
}

/**
 * El desglose de un año YA DECLARADO.
 *
 * El importe sale del XML tal cual: es lo que se presentó y no se recalcula.
 * Los chips salen del tipo de cada arrendamiento y de si llevaba reducción.
 *
 * § derivar — el porcentaje nominal solo se pone cuando la división no puede
 * mezclar nada: UN único arrendamiento, con reducción, y 0150 ÷ 0149 cayendo
 * dentro de tolerancia sobre un nominal de la ley. En cuanto hay dos tramos, el
 * 0149 es la suma de bases que el XML no reparte, así que la división daría el
 * % efectivo —el «26 %»— y el chip va sin cifra. El importe sigue siendo exacto:
 * lo que se pierde es el adorno, no el dato.
 */
export function desgloseDeclarado(entrada: EntradaDesgloseDeclarado): DesgloseReduccion {
  const importe = finito(entrada.reduccion) ? round2(entrada.reduccion) : null;
  const antes = finito(entrada.rendimientoAntes) ? round2(entrada.rendimientoAntes) : null;

  if (importe === null && entrada.arrendamientos.length === 0) {
    return desgloseAusente('declarado');
  }

  // Un chip por «reduce o no»: dos arrendamientos reducidos son un solo tramo,
  // no dos chips iguales. El régimen se deriva de ahí y no del TAR — solo la
  // vivienda habitual reduce, así que un tramo con reducción ES habitual, y uno
  // sin reducción es temporada o turístico sin que el XML diga cuál.
  const grupos = new Map<boolean, { conReduccion: boolean; n: number }>();
  for (const arr of entrada.arrendamientos) {
    const previo = grupos.get(arr.conReduccion);
    if (previo) previo.n += 1;
    else grupos.set(arr.conReduccion, { conReduccion: arr.conReduccion, n: 1 });
  }

  const unicoArrendamiento = entrada.arrendamientos.length === 1;

  const tramos: TramoReduccion[] = [...grupos.values()].map((g) => {
    if (!g.conReduccion) return { tipo: 'temporada_o_turistico' as TipoTramo, pct: 0 };
    const pct =
      unicoArrendamiento && importe !== null && importe > 0 && antes !== null && antes > 0
        ? nominalMasCercano((importe / antes) * 100)
        : null;
    const tipo: TipoTramo = 'vivienda_habitual';
    return antes !== null && unicoArrendamiento ? { tipo, pct, base: antes } : { tipo, pct };
  });

  return { importe, tramos: ordenar(tramos), origen: 'declarado', rendimientoAntes: antes };
}

/** El nominal al que corresponde un porcentaje, o `null` si no es ninguno. */
function nominalMasCercano(efectivo: number): number | null {
  for (const nominal of NOMINALES) {
    if (Math.abs(efectivo - nominal) <= TOLERANCIA_PP) return nominal;
  }
  return null;
}

export interface ContratoDelTramo {
  tipo: TipoTramo;
  /** % nominal que el motor de reducción propone para ese contrato. */
  pct: number;
  /** Ingresos íntegros del contrato en el ejercicio · reparten el rendimiento. */
  ingresos: number;
}

/**
 * El desglose del año EN CURSO, con el nominal que da el motor.
 *
 * Aquí no hay nada que derivar: cada contrato sabe su porcentaje por sus
 * condiciones, y lo único que hay que repartir es el rendimiento neto, que es
 * del inmueble entero. Se reparte por ingresos —el mismo criterio que ya usa
 * `irpfCalculationService`— y cada tramo aplica SU porcentaje a SU parte.
 *
 * Un rendimiento negativo no se reduce: el art. 23.2 opera sobre el rendimiento
 * neto positivo, y aplicarle un porcentaje a una pérdida la encogería.
 */
export function desgloseEnCurso(
  contratos: ContratoDelTramo[],
  rendimientoAntes: number | null | undefined,
): DesgloseReduccion {
  // Sin contratos no se sabe NADA del régimen del inmueble, y decir «0 €
  // reducidos» sería afirmar que no había derecho a reducción. Es el mismo
  // agujero que el motor viejo tapaba al revés, devolviendo un 60 % por defecto:
  // los dos rellenan una ausencia con un número.
  if (contratos.length === 0) return desgloseAusente('atlas');
  if (!finito(rendimientoAntes)) return desgloseAusente('atlas');
  const antes = round2(rendimientoAntes);

  // Un chip por (tipo, nominal): dos larga estancia al 60 % y al 50 % son dos
  // tramos distintos, porque promediarlos daría un 55 % que no existe.
  const grupos = new Map<string, { tipo: TipoTramo; pct: number; ingresos: number }>();
  for (const c of contratos) {
    const pct = finito(c.pct) ? Math.min(Math.max(c.pct, 0), 100) : 0;
    const clave = `${c.tipo}|${pct}`;
    const previo = grupos.get(clave);
    if (previo) previo.ingresos += finito(c.ingresos) ? c.ingresos : 0;
    else grupos.set(clave, { tipo: c.tipo, pct, ingresos: finito(c.ingresos) ? c.ingresos : 0 });
  }

  const totalIngresos = [...grupos.values()].reduce((s, g) => s + g.ingresos, 0);
  const reparte = totalIngresos > 0 && antes > 0;

  let importe = 0;
  const tramos: TramoReduccion[] = [...grupos.values()].map((g) => {
    if (!reparte) return { tipo: g.tipo, pct: g.pct };
    const base = round2(antes * (g.ingresos / totalIngresos));
    importe = round2(importe + base * (g.pct / 100));
    return { tipo: g.tipo, pct: g.pct, base };
  });

  return { importe: round2(importe), tramos: ordenar(tramos), origen: 'atlas', rendimientoAntes: antes };
}

/**
 * Los ingresos íntegros que un contrato aporta a un ejercicio.
 *
 * Renta por meses de solape, que es el criterio con el que la declaración
 * reparte el rendimiento entre contratos. Está aquí, y no en el servicio de
 * IRPF, porque el reparto por tramos lo necesita y duplicarlo sería tener dos
 * formas de contar los mismos meses.
 */
export function ingresosDelContratoEnEjercicio(contract: any, ejercicio: number): number {
  const renta = contract.rentaMensual ?? 0;
  if (!finito(renta) || renta <= 0) return 0;

  const inicio = new Date(contract.fechaInicio ?? contract.startDate);
  const fin = new Date(contract.fechaFin ?? contract.endDate ?? `${ejercicio}-12-31`);
  if (Number.isNaN(inicio.getTime())) return 0;
  if (inicio.getFullYear() > ejercicio) return 0;
  if (!Number.isNaN(fin.getTime()) && fin.getFullYear() < ejercicio) return 0;

  const mesInicio = inicio.getFullYear() < ejercicio ? 1 : inicio.getMonth() + 1;
  const mesFin = Number.isNaN(fin.getTime()) || fin.getFullYear() > ejercicio ? 12 : fin.getMonth() + 1;
  const meses = Math.max(0, mesFin - mesInicio + 1);
  return round2(renta * meses);
}

/**
 * De los contratos de un ejercicio a los tramos que rotula la pantalla.
 *
 * El porcentaje de cada uno lo da el motor —`calcularPorcentajeReduccionContrato`,
 * que respeta lo confirmado en el alta y si no propone según el art. 23.2—, y el
 * tipo sale de la modalidad. Ninguno de los dos se adivina aquí.
 *
 * Una lista vacía devuelve una lista vacía, y de ahí sale un desglose AUSENTE:
 * sin contratos no se sabe nada del régimen del inmueble. Es exactamente lo que
 * el motor viejo tapaba devolviendo un 60 % por defecto.
 */
export function tramosDeContratos(contratos: any[], ejercicio: number): ContratoDelTramo[] {
  return contratos.map((c) => ({
    tipo: tipoDeModalidad(c.modalidad ?? c.type),
    pct: calcularPorcentajeReduccionContrato(c),
    ingresos: ingresosDelContratoEnEjercicio(c, ejercicio),
  }));
}

/**
 * El mismo desglose sobre otro rendimiento · lo que necesita el simulador.
 *
 * Preguntar «¿y si cobro 200 € más?» no cambia el régimen del contrato ni las
 * condiciones del art. 23.2: cambia la base sobre la que se aplican. Así que los
 * tipos y los porcentajes NOMINALES viajan intactos y solo se reparte el
 * rendimiento nuevo con las mismas proporciones.
 *
 * Un desglose cuyos tramos no traen `base` no se puede escalar: es el caso de un
 * año declarado mixto, donde el Modelo 100 da el importe agregado pero no lo
 * parte por arrendamiento. Repartirlo a ojo sería inventarse el desglose, así
 * que la respuesta es «no se sabe».
 */
export function escalarDesglose(
  desglose: DesgloseReduccion,
  rendimientoNuevo: number | null | undefined,
): DesgloseReduccion {
  if (!finito(rendimientoNuevo)) return desgloseAusente(desglose.origen);
  if (desglose.tramos.length === 0) return desgloseAusente(desglose.origen);
  if (desglose.tramos.some((t) => t.pct === null || !finito(t.base))) {
    return desgloseAusente(desglose.origen);
  }

  return desgloseEnCurso(
    desglose.tramos.map((t) => ({
      tipo: t.tipo,
      pct: t.pct as number,
      ingresos: t.base as number,
    })),
    rendimientoNuevo,
  );
}
