// ─── Supuestos de proyección · fuente única (C-PROY-5 · Fase B1) ─────────────
//
// UN solo tipo para todos los supuestos económicos de proyección. Sustituye a
// los tres sitios antiguos que se contradecían (borrados en B1 · git es el
// archivo):
//   · `SupuestosLibertad` + `SUPUESTOS_NEUTROS_LIBERTAD` (types/libertad.ts)
//   · `BaseAssumptions` + keyval 'base-assumptions' (proyeccion/base)
//   · `Escenario.inflacionAnualAsumida` (types/miPlan.ts)
//
// Persistencia: `Escenario.supuestos` (Partial · solo lo que el usuario tocó).
// Resolución: `escenariosService.getSupuestosProyeccion()` merge con DEFAULTS.
// Los defaults son visibles: la UI puede distinguir "default" (ausente en el
// Partial) de "fijado por el usuario" (presente), y mostrar "por defecto X %".
//
// Regla C-PROY-5: si algo necesita un supuesto y no está aquí, se añade AQUÍ.
// Lección PR #326 (B0.2): ninguna dinámica puede traer su propia constante
// escondida — toda tasa vive en este tipo, visible y editable.

export interface SupuestosProyeccion {
  /** Revalorización anual de inmuebles en % · global (por inmueble: lista C-PROY). */
  revalorizacionInmueblesPct: number;

  /**
   * Subida anual de rentas en % · global.
   * B3: sobrescribible por contrato vía su campo `indexacion` cuando exista.
   */
  subidaRentasPct: number;

  /**
   * Inflación anual de gastos en % · global. También deflacta valores a € de
   * hoy (antes `Escenario.inflacionAnualAsumida`).
   * Sobrescribible por compromiso vía su `variacion` (ipcAnual/aniversario).
   */
  inflacionGastosPct: number;

  /** Vacancia en % sobre la renta anual · global. */
  vacanciaPct: number;

  /** Rentabilidad anual del ahorro (caja acumulada) en %. */
  rentabilidadAhorroPct: number;

  /**
   * Subida anual de nómina en % (B0.1 · dos fuentes → dos mandos).
   * Cubre solo lo NO registrado: las subidas conocidas con fecha viven en
   * `Nomina.historial[].vigenciaDesde` y tienen prioridad.
   */
  subidaNominaPct: number;

  /** Subida anual de ingresos de actividad (autónomo) en % (B0.1). */
  subidaAutonomoPct: number;
}

/**
 * Defaults declarados de la spec C-PROY-5 · Fase B1.
 * Salario: la spec delega en B0.1 el nº de campos (dos); el valor 2,0 replica
 * el único precedente del repo (el 2 % de FIXED_ASSUMPTIONS retirado en
 * PR #326 por oculto, no por erróneo) — aquí es visible y editable.
 */
export const SUPUESTOS_PROYECCION_DEFAULTS: SupuestosProyeccion = {
  revalorizacionInmueblesPct: 3.0,
  subidaRentasPct: 2.5,
  inflacionGastosPct: 2.5,
  vacanciaPct: 5.0,
  rentabilidadAhorroPct: 2.0,
  subidaNominaPct: 2.0,
  subidaAutonomoPct: 2.0,
};
