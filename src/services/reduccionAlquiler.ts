// ============================================================================
// Cuánto del rendimiento del alquiler no tributa
// ============================================================================
//
// Art. 23.2 LIRPF en la redacción de la Ley 12/2023 (manual AEAT §7.3.1.4).
// Entre el 50 % y el 90 % del rendimiento neto positivo de un alquiler de
// vivienda queda fuera de la base imponible, según qué condiciones cumpla el
// contrato. No es un adorno: decide lo que el arrendador paga.
//
// FUENTE ÚNICA de estas reglas. `calcularPorcentajeReduccionContrato` llama aquí
// en vez de tener su propia copia: tenía una que no conocía «primera vez» ni
// «había contrato anterior», así que el mismo contrato podía dar 50 % o 70 %
// según por dónde se preguntara. Dos implementaciones de una ley son dos leyes.
//
// Lo que este módulo NO resuelve, y hay que saberlo al leer su respuesta:
//
//   · La VIGENCIA de la zona tensionada. La declaración de zona tiene ventana
//     temporal; aquí se toma como un sí/no del momento de la firma.
//   · El TOPE del art. 17.6 LAU. Si la renta supera el límite de la zona
//     tensionada, la reducción decae y esto no lo comprueba.
//   · Que las condiciones DEJEN de cumplirse con el tiempo.
//   · El 70 % social (arrendamiento a Administraciones o entidades sin ánimo de
//     lucro) y el alquiler a empresa para vivienda de empleados. Caben en el
//     mismo tramo del 70 %, pero no tienen dato de entrada todavía.
//   · El PRORRATEO del 70 % cuando hay varios inquilinos y solo algunos cumplen
//     la edad: la reducción aplicaría a su parte, no a todo.
//
// Todo eso llega al final del recorrido; mientras tanto la propuesta lo advierte
// en `avisos` en vez de callárselo.
// ============================================================================

import { type SubtipoAlquiler, normalizarSubtipo } from './db/types-alquiler';

/** El día en que empieza a regir la Ley 12/2023. Antes, régimen transitorio. */
const VIGENCIA_LEY_VIVIENDA = '2023-05-26';

/**
 * El régimen del art. 23.2 es el subtipo de alquiler · no son dos cosas.
 *
 * Era una lista propia (`habitual | temporada | turistico`) que decía lo mismo
 * que `Contract.modalidad` con otras palabras, y por eso hacía falta un puente
 * para pasar de una a otra. Ahora es un alias del vocabulario único: el puente
 * sobra y no puede volver a descuadrarse.
 */
export type RegimenAlquiler = SubtipoAlquiler;

/**
 * Por qué sale ese porcentaje · clave estable, para guardarla con el contrato.
 *
 * Los cinco primeros son los que ya declaraba `Contract.reduccion.motivo`;
 * `sin_reduccion` es nuevo y cubre temporada y turístico, que antes no tenían
 * forma de explicarse.
 */
export type MotivoReduccion =
  | 'sin_reduccion'
  | 'transitorio_pre_2023'
  | 'general_post_2023'
  | 'rehabilitacion'
  | 'zona_tensionada_joven'
  | 'zona_tensionada_rebaja';

export interface CondicionesReduccion {
  regimen: RegimenAlquiler;
  /** ISO `YYYY-MM-DD` (admite fecha-hora). Sin ella se aplica el régimen vigente. */
  fechaFirma?: string;
  /** Primera vez que se alquila esta vivienda · no hubo contrato anterior. */
  primeraVez?: boolean;
  zonaTensionada?: boolean;
  /** Inquilino de 18 a 35 años. */
  joven18a35?: boolean;
  /** La renta baja más de un 5 % respecto al contrato anterior. */
  rebajaMas5?: boolean;
  /** Rehabilitada en los 2 años previos · obra acreditada (art. 41.1 RIRPF). */
  rehabilitada2a?: boolean;
}

export interface PropuestaReduccion {
  porcentaje: number;
  motivo: MotivoReduccion;
  /** En llano, para enseñárselo a quien firma. */
  explicacion: string;
  baseLegal: string;
  /** Lo que este cálculo no comprueba y puede tumbar la reducción. */
  avisos: string[];
}

/** Lo que el motor todavía no vigila · se enseña, no se esconde. */
const AVISOS_GENERALES = [
  'La reducción se pierde sobre lo que se regularice en una inspección.',
  'En zona tensionada decae si la renta supera el tope del art. 17.6 LAU.',
  'La zona tensionada solo cuenta dentro de la ventana de vigencia de su declaración.',
];

/** Solo la parte de fecha del ISO · comparar textos evita el lío de zonas horarias. */
const soloFecha = (iso: string | undefined | null): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso ?? ''));
  return m ? m[1] : null;
};

/**
 * La reducción que corresponde a un contrato, con el porqué.
 *
 * El orden de las ramas es el de la ley y no es intercambiable: el régimen manda
 * sobre todo (un turístico no se vuelve vivienda habitual por marcar casillas),
 * la fecha decide qué redacción se aplica, y dentro de la nueva el 90 % pasa por
 * delante del 70 % cuando se cumplen los dos.
 */
export function proponerReduccion(cond: CondicionesReduccion): PropuestaReduccion {
  if (cond.regimen === 'temporada') {
    return {
      porcentaje: 0,
      motivo: 'sin_reduccion',
      explicacion:
        'El alquiler de temporada tributa sin reducción: no cubre una necesidad permanente de vivienda.',
      baseLegal: 'No aplica art. 23.2 LIRPF',
      avisos: [],
    };
  }

  if (cond.regimen === 'turistico') {
    return {
      porcentaje: 0,
      motivo: 'sin_reduccion',
      explicacion:
        'El alquiler turístico no tiene reducción; con servicios de hospedaje puede ser actividad económica.',
      baseLegal: 'Rendimiento de capital o actividad económica',
      avisos: [],
    };
  }

  const firma = soloFecha(cond.fechaFirma);
  if (firma != null && firma < VIGENCIA_LEY_VIVIENDA) {
    return {
      porcentaje: 60,
      motivo: 'transitorio_pre_2023',
      explicacion:
        'Contrato anterior a la Ley de Vivienda (26/05/2023): reducción general del 60 %.',
      baseLegal: 'Régimen anterior · art. 23.2 LIRPF',
      avisos: AVISOS_GENERALES,
    };
  }

  // Exige que HUBIERA contrato anterior: la rebaja del 5 % se mide contra la
  // renta de ese contrato, así que sin alquiler previo no hay nada que rebajar.
  if (cond.zonaTensionada && !cond.primeraVez && cond.rebajaMas5) {
    return {
      porcentaje: 90,
      motivo: 'zona_tensionada_rebaja',
      explicacion:
        'Zona tensionada, había contrato anterior y la renta baja más de un 5 %.',
      baseLegal: 'Art. 23.2.a) LIRPF · Ley 12/2023',
      avisos: AVISOS_GENERALES,
    };
  }

  if (cond.zonaTensionada && cond.primeraVez && cond.joven18a35) {
    return {
      porcentaje: 70,
      motivo: 'zona_tensionada_joven',
      explicacion:
        'Primera vez que se alquila la vivienda, en zona tensionada, e inquilino de 18 a 35 años.',
      baseLegal: 'Art. 23.2.b).1º LIRPF · Ley 12/2023',
      avisos: [
        ...AVISOS_GENERALES,
        'Con varios inquilinos, el 70 % aplica solo a la parte de los que cumplan la edad.',
      ],
    };
  }

  if (cond.rehabilitada2a) {
    return {
      porcentaje: 60,
      motivo: 'rehabilitacion',
      explicacion: 'Rehabilitada en los 2 años previos al contrato.',
      baseLegal: 'Art. 23.2.c) LIRPF · Ley 12/2023',
      avisos: AVISOS_GENERALES,
    };
  }

  return {
    porcentaje: 50,
    motivo: 'general_post_2023',
    explicacion:
      'Vivienda habitual bajo la Ley de Vivienda, sin condiciones especiales: reducción general del 50 %.',
    baseLegal: 'Art. 23.2 · regla general · Ley 12/2023',
    avisos: AVISOS_GENERALES,
  };
}

/**
 * Lo que queda por tributar tras aplicar la reducción.
 *
 * Un rendimiento NEGATIVO sale intacto: el art. 23.2 reduce el rendimiento neto
 * positivo, y aplicarle el porcentaje a una pérdida la encogería, que es lo
 * contrario de lo que dice la ley.
 */
export function rendimientoTrasReduccion(rendimiento: number, porcentaje: number): number {
  if (!Number.isFinite(rendimiento) || rendimiento <= 0) return rendimiento;
  const pct = Number.isFinite(porcentaje) ? Math.min(Math.max(porcentaje, 0), 100) : 0;
  return Math.round(rendimiento * (1 - pct / 100) * 100) / 100;
}

/**
 * La reducción del art. 23.2 LIRPF que corresponde a un contrato.
 *
 * Vive aquí, junto a las reglas que traduce: solo convierte la forma de un
 * `Contract` —campos legacy incluidos— en las condiciones que `proponerReduccion`
 * entiende. Estuvo en `irpfCalculationService` con su PROPIA copia de la ley, y
 * no era la misma: no conocía «primera vez», así que daba el 90 % a un contrato
 * en zona tensionada con rebaja aunque fuera el primer alquiler de la vivienda,
 * cuando sin contrato anterior no hay renta que rebajar. El mismo contrato daba
 * números distintos según por dónde se preguntara.
 *
 * `irpfCalculationService` la reexporta, que es donde la conocen sus
 * consumidores.
 */
export function calcularPorcentajeReduccionContrato(contract: any): number {
  // Lo que el arrendador confirmó al dar de alta el contrato MANDA · no se
  // recalcula por detrás. Ese % es el que se revisó y se firmó; recalcularlo al
  // leerlo convertiría un cambio de reglas en una declaración distinta de la que
  // el usuario aprobó.
  if (contract.reduccion?.activa && contract.reduccion?.porcentaje > 0) {
    return contract.reduccion.porcentaje;
  }

  const regimen = regimenDelContrato(contract);
  // Un contrato del que no sabemos si es de vivienda habitual no puede reclamar
  // la reducción de la vivienda habitual.
  if (regimen === null) return 0;

  return proponerReduccion({
    regimen,
    // La fecha, en cascada: la de firma del contrato manda sobre la de la firma
    // digital, y esa sobre la de inicio. Si no hay ninguna, el motor aplica el
    // régimen VIGENTE — presumir que un contrato sin fecha es anterior a 2023
    // sería reclamar más reducción de la que consta.
    fechaFirma:
      contract.fechaFirmaContrato ??
      contract.firma?.fechaFirma ??
      contract.fechaInicio ??
      contract.startDate,
    primeraVez: contract.primeraVez,
    zonaTensionada: contract.zonaTensionada,
    joven18a35: contract.inquilinoJoven,
    rebajaMas5: contract.rebajaRenta5pct,
    rehabilitada2a: contract.rehabilitacion,
  }).porcentaje;
}

/** `null` cuando el contrato no dice de qué tipo de alquiler es. */
export function regimenDelContrato(contract: any): RegimenAlquiler | null {
  return normalizarSubtipo(contract.modalidad ?? contract.type) ?? null;
}
