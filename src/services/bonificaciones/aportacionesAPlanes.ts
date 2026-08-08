// ============================================================================
// Lo aportado a planes y productos · la quinta forma de comprobar · §6 ter
// ============================================================================
//
// «Hay una aportación a un producto · planes, fondos, unit-linked» era la
// quinta de las cinco formas que ATLAS sabe mirar, y la única que nunca se
// montó: `SIN_FUENTE` decía «la aportación al plan todavía no se sigue en
// tesorería» y toda condición de plan salía sin comprobar.
//
// Pero sí se sigue: el store `aportacionesPlan` lleva cada aportación con su
// ejercicio fiscal y su importe, y el plan lleva su **gestora**. Lo que faltaba
// no era el dato, era la pregunta.
//
// La gestora importa tanto como el importe. El anexo no dice «aporta 1.500 € al
// año a un plan cualquiera»: dice a UNO SUYO. Un plan en otra entidad no le
// entra a este banco, igual que la nómina domiciliada fuera o la tarjeta de
// otro (§3.6). Sin saber de quién es el préstamo no se puede responder, y
// entonces se dice — que es la tercera respuesta, no un no.
// ============================================================================

import type { PlanPensiones, AportacionPlan } from '../../types/planesPensiones';

/** Lo aportado a un plan en un ejercicio, con la entidad que lo gestiona. */
export interface AportacionDeUnAnio {
  planId: string;
  /** Quién gestiona el plan · es lo que decide si le entra a ESTE banco. */
  gestora: string;
  anio: number;
  /** Titular + empresa + cónyuge · todo lo que entró ese año. */
  importe: number;
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Lo aportado a cada plan en un ejercicio.
 *
 * Un plan sin aportaciones ese año **también sale**, con importe cero: tenerlo
 * contratado y no haber aportado son dos cosas distintas, y hay anexos que
 * bonifican por lo primero.
 */
export function aportacionesPorPlan(
  planes: PlanPensiones[],
  aportaciones: AportacionPlan[],
  anio: number
): AportacionDeUnAnio[] {
  const delAnio = aportaciones.filter((a) => a.ejercicioFiscal === anio);

  return planes.map((p) => ({
    planId: p.id,
    gestora: (p.gestoraActual || '').trim(),
    anio,
    importe: Math.round(
      delAnio
        .filter((a) => a.planId === p.id)
        .reduce(
          (s, a) => s + num(a.importeTitular) + num(a.importeEmpresa) + num(a.importeConyuge),
          0
        ) * 100
    ) / 100,
  }));
}

/**
 * Normaliza un nombre de entidad para poder compararlo.
 *
 * «Unicaja», «UNICAJA BANCO», «Unicaja Banco, S.A.» son la misma entidad
 * escritos por tres sitios distintos —el préstamo lo trae de la FEIN, el plan lo
 * escribió el usuario—, y compararlos tal cual diría que no lo son.
 */
const claveDeEntidad = (nombre: string): string =>
  nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(banco|bank|s\.?a\.?|sa|seguros|vida|pensiones|gestora|group|grupo)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * Los planes que gestiona ESTA entidad.
 *
 * Se comparan las claves por contención en los dos sentidos: «unicaja» está
 * dentro de «unicajabanco» y al revés, y con eso basta para reconocer la misma
 * entidad sin inventarse un catálogo de bancos que habría que mantener.
 */
export function deLaEntidad(
  lista: AportacionDeUnAnio[],
  entidad: string
): AportacionDeUnAnio[] {
  const clave = claveDeEntidad(entidad || '');
  if (!clave) return [];
  return lista.filter((a) => {
    const suya = claveDeEntidad(a.gestora);
    return suya.length > 0 && (suya.includes(clave) || clave.includes(suya));
  });
}

/** Lo aportado en total · lo que se compara contra el mínimo del anexo. */
export function totalAportado(lista: AportacionDeUnAnio[]): number {
  return Math.round(lista.reduce((s, a) => s + a.importe, 0) * 100) / 100;
}
