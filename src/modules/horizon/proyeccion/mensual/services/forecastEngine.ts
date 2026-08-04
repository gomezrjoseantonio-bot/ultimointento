// src/modules/horizon/proyeccion/mensual/services/forecastEngine.ts
// La forma del desglose de gastos por inmueble y concepto.

export interface OpexDetalleItem {
  propertyId: number;
  propertyAlias: string;
  concepto: string;
  importe: number;
}

// ─── Lo que había aquí ──────────────────────────────────────────────────────
//
// Siete funciones que decían si una regla de gasto —de inmueble o personal—
// caía en un mes y por cuánto. Todas alimentaban las dos secciones del
// sincronizador de tesorería que se han retirado (4 ago 2026), y ninguna tenía
// otro llamador: lo que parecía uso desde `treasuryForecastService` y
// `dashboardService` son funciones locales con el mismo nombre, no estas.
//
// Quien hace hoy ese cálculo es `compromisosRecurrentesService` con
// `patronCalendario`, sobre `compromisosRecurrentes`, que es donde viven los
// gastos recurrentes desde V62.
//
// Se queda `OpexDetalleItem`, que sí se usa: es la forma del desglose por
// inmueble y concepto que enseña la proyección mensual.
