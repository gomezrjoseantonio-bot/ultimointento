/**
 * opcionesDistribucion.ts
 *
 * Wizard import XML V2 · § 3 · contrato entre la UI del wizard y el distribuidor.
 *
 * El distribuidor (`distribuirDeclaracion`) separa dos fases:
 *  · Fase A · automática · siempre se ejecuta (verdad fiscal del XML).
 *  · Fase B · opt-in · sólo si el paso correspondiente del wizard activa el toggle.
 *
 * Los `*Prefill` son justamente las cargas (payloads) que los servicios destino
 * aceptan. La UI (pasos 6/7/8) los construye y el distribuidor se limita a
 * delegar en `nominaService.saveNomina`, `autonomoService.saveAutonomo` y
 * `confirmPropertySale`. Así el distribuidor no inventa mapeos de campos.
 */

import type { Nomina, Autonomo } from './personal';
import type { Property } from '../services/db';
import type { ConfirmPropertySaleInput } from '../services/propertySaleService';

/** Carga de nómina · = payload de `nominaService.saveNomina`. */
export type NominaPrefill = Omit<Nomina, 'id' | 'fechaCreacion' | 'fechaActualizacion'>;

/** Carga de actividad autónoma · = payload de `autonomoService.saveAutonomo`. */
export type AutonomoPrefill = Omit<Autonomo, 'id' | 'fechaCreacion' | 'fechaActualizacion'>;

/** Venta confirmada por el usuario · = payload de `confirmPropertySale`. */
export type VentaConfirmada = ConfirmPropertySaleInput;

/** Decisión por IBAN detectado en el XML (devolución / cargo). */
export interface IbanAccion {
  iban: string;
  accion: 'crear' | 'vincular' | 'ignorar';
  /** Sólo si accion === 'vincular' · id de la cuenta existente a la que asociar el IBAN. */
  cuentaIdVinculada?: number;
}

/**
 * Pre-relleno de campos físicos / de explotación del paso 2.
 * Se casa con el inmueble del XML por `refCatastral` (fallback `direccion`).
 * Los campos se mapean sobre el modelo Property existente (V77).
 */
export interface InmueblePrefill {
  refCatastral?: string;
  direccion?: string;
  tipoActivo?: Property['tipoActivo'];
  subtipoVivienda?: Property['subtipoVivienda'];
  bedrooms?: number;
  anexos?: Property['anexos'];
  usoTipo?: Property['usoTipo'];
  alquilerPorHabitaciones?: Property['alquilerPorHabitaciones'];
  explotacion?: Property['explotacion'];
}

/** Opciones de orquestación del distribuidor (§ 3.2). */
export interface OpcionesDistribucion {
  /** Paso 6 · crear/actualizar nómina activa en Personal. */
  crearNominaActiva: boolean;
  nominaPrefill?: NominaPrefill;

  /** Paso 7 · crear/actualizar actividad autónoma activa en Personal. */
  crearActividadAutonoma: boolean;
  autonomoPrefill?: AutonomoPrefill;

  /** Paso 8 · registrar venta(s) de inmueble si el XML trae transmisión. */
  registrarVentasInmueble: boolean;
  ventasConfirmadas?: VentaConfirmada[];

  /** Paso 3 · decisión por IBAN. Vacío = comportamiento legacy (crear el detectado). */
  ibanAcciones?: IbanAccion[];

  /** Paso 9 · añadir cónyuge en Personal (sólo si tributación conjunta). */
  conyugeAnadirPersonal: boolean;

  /** Paso 2 · pre-relleno de campos físicos/explotación de inmuebles. */
  inmueblesPrefill?: InmueblePrefill[];
}

/**
 * Default backwards-compatible (§ 3.3). Llamar `distribuirDeclaracion(decl)` sin
 * opciones produce exactamente el comportamiento previo: ningún opt-in activo y
 * el IBAN detectado se persiste como antes (al estar `ibanAcciones` vacío).
 */
export const OPCIONES_DEFAULT: OpcionesDistribucion = {
  crearNominaActiva: false,
  crearActividadAutonoma: false,
  registrarVentasInmueble: false,
  ibanAcciones: [],
  conyugeAnadirPersonal: false,
};

/** Resultado agregado de la fase B · se adjunta al informe final. */
export interface ResultadoFaseB {
  nominaCreada: boolean;
  actividadAutonomaCreada: boolean;
  ventasRegistradas: number;
  cuentasCreadas: number;
  cuentasVinculadas: number;
  cuentasIgnoradas: number;
  conyugeAnadido: boolean;
  errores: string[];
}
