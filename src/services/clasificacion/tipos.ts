// ============================================================================
// E2.4.2 · Lo que el motor devuelve por línea · los 4 ejes, cada uno con ORIGEN
// ============================================================================
//
// Clasificar NO es todo-o-nada: se rellenan los ejes que se saben con certeza
// y se dejan en blanco los que no. Un movimiento con naturaleza + método +
// familia pero sin piso es un ÉXITO, no un fallo. Y cada eje dice DE DÓNDE
// salió, para que el usuario sepa por qué está así y pueda fiarse o corregir.
//
// Los orígenes, en el orden en que el motor los mira (`clasificarLinea`):
//   aprendida      · una regla que el usuario ya confirmó (`movementLearningRules`)
//   identificador  · CUPS / nº contrato / IBAN / nº tarjeta / cuadro del
//                    préstamo / contrato de alquiler / cuenta propia
//   concepto       · una palabra inequívoca del texto del banco
//   recurrencia    · un recurrente que casa por texto, o el piso que
//                    declaraste el año pasado
//   defecto        · el signo y «personal» · lo que queda cuando nada casó
// ============================================================================

import type { Ambito, FamiliaId, MetodoPago, Naturaleza, Sentido } from '../catalogo/catalogoUnico';

export type OrigenEje = 'aprendida' | 'identificador' | 'concepto' | 'recurrencia' | 'defecto';

export interface OrigenPorEje {
  naturaleza: OrigenEje;
  familia?: OrigenEje;
  subtipo?: OrigenEje;
  metodo?: OrigenEje;
  ambito: OrigenEje;
  inmuebleId?: OrigenEje;
}

export interface ClasificacionLinea {
  naturaleza: Naturaleza;
  familia?: FamiliaId;
  subtipo?: string;
  metodo?: MetodoPago;
  ambito: Ambito;
  inmuebleId?: number;
  /** Solo `movimiento_interno` · si el dinero entra o sale de ESTA cuenta. */
  sentido?: Sentido;
  origen: OrigenPorEje;
  /** Por qué · frases cortas, en el orden en que se decidió. Para auditar. */
  motivos: string[];
}

/** Lo que una regla del motor aporta · todo opcional · se funde sobre lo que había. */
export interface Parcial {
  naturaleza?: Naturaleza;
  familia?: FamiliaId;
  subtipo?: string;
  metodo?: MetodoPago;
  ambito?: Ambito;
  inmuebleId?: number;
  sentido?: Sentido;
  motivo: string;
}
