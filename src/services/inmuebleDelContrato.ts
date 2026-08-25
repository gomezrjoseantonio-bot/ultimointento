// ============================================================================
// De qué inmueble es un contrato
// ============================================================================
//
// El dato vive en `Contract.inmuebleId`. `Contract.propertyId` es el espejo
// LEGACY: los wizards modernos no lo escriben (`contratoWizardPayload.ts:55,91`
// sólo pone `inmuebleId`) y el importador escribe los dos
// (`contractImportCreationService.ts:148`). Resultado: hay contratos con uno,
// con otro o con ambos, y por eso once sitios repetían el mismo
// `c.inmuebleId === X || c.propertyId === X` — cada uno con su matiz (`||`,
// `??`, cuatro campos en `dashboardService`), y uno de ellos, el generador de
// ingresos de `treasuryCreationService`, mirando SÓLO `propertyId`: para
// cualquier contrato creado con el wizard eso era `undefined`.
//
// Escrito una vez, aquí. Es el hermano de `inmuebleDelPrestamo`, que ya avisaba
// en su cabecera de que este mismo criterio hacía falta «allí donde se copia el
// inmueble de un CONTRATO. Escribirlo dos veces es exactamente cómo nació este
// fallo».
//
// Se reutiliza `idDeInmueble` para no repetir tampoco la validación: entero
// POSITIVO, porque `properties` es autoIncrement (sus ids empiezan en 1) y hay
// flujos que escriben `inmuebleId: 0` como marcador de «aún sin vincular».
//
// NO se toca el esquema: el store `contracts` conserva su índice legacy
// `propertyId` (`db/upgrade-a.ts:48`), que hoy no lee nadie —cero
// `getAllFromIndex('contracts', …)` en todo el repo—. Cambiarlo exigiría bump de
// `DB_VERSION` + backfill, y la política es carga limpia: no se migra nada. El
// coste real de dejarlo es un `getAll` + filtro en memoria sobre decenas de
// contratos, que no duele.
// ============================================================================

import { idDeInmueble } from './inmuebleDelPrestamo';

/** Lo mínimo que hace falta mirar de un contrato para saber de qué piso es. */
export interface ContratoConInmueble {
  inmuebleId?: string | number | null;
  /** @deprecated Espejo legacy de `inmuebleId` · sólo lo escriben los importadores. */
  propertyId?: string | number | null;
}

/**
 * El inmueble del contrato · `undefined` si no lo tiene.
 *
 * Manda `inmuebleId`; `propertyId` sólo como respaldo para los contratos
 * antiguos e importados que aún lo traen.
 */
export function inmuebleDelContrato(contrato: ContratoConInmueble): number | undefined {
  return idDeInmueble(contrato.inmuebleId) ?? idDeInmueble(contrato.propertyId);
}

/**
 * ¿Este contrato es de este inmueble?
 *
 * La forma que piden casi todos los llamantes, que lo que hacen es filtrar los
 * contratos de un piso. Un `inmuebleId` que no resuelve no es de ninguno: no
 * empareja ni siquiera contra otro sin resolver.
 */
export function esContratoDelInmueble(
  contrato: ContratoConInmueble,
  inmuebleId: number | undefined,
): boolean {
  const propio = inmuebleDelContrato(contrato);
  return propio != null && propio === idDeInmueble(inmuebleId);
}
