/**
 * prefill.ts · Wizard import XML V2 · pasos 6·7 · construcción de prefills.
 *
 * Replica los formularios simplificados de los mockups (no embebe los wizards
 * standalone) y construye payloads VÁLIDOS para los servicios destino. La
 * persistencia la hace Fase B del distribuidor vía nominaService.saveNomina /
 * autonomoService.saveAutonomo (ahí vive el reuso). `personalDataId` queda a 0:
 * Fase B inyecta el id real del titular tras crear personalData en Fase A.
 */

import type { DeclaracionCompleta } from '../../../types/declaracionCompleta';
import type { NominaPrefill, AutonomoPrefill } from '../../../types/opcionesDistribucion';
import { getBaseMaxima, getSSDefaults } from '../../../constants/cotizacionSS';
import { sugerirTramoReta, type SugerenciaReta } from '../../../constants/retaTramos';

function masReciente<T>(
  decls: DeclaracionCompleta[],
  pick: (d: DeclaracionCompleta) => T | undefined,
): { decl: DeclaracionCompleta; valor: T } | null {
  const conValor = decls
    .filter((d) => pick(d) !== undefined)
    .sort((a, b) => b.meta.ejercicio - a.meta.ejercicio);
  if (conValor.length === 0) return null;
  return { decl: conValor[0], valor: pick(conValor[0])! };
}

function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 10000) / 100;
}

// ── NÓMINA ────────────────────────────────────────────────────────────────

export interface FormNomina {
  empresaNombre: string;
  nifEmpresa: string;
  cuentaAbono?: number;
  brutoAnual: number;
  numPagas: number;
  irpfPorcentaje: number;
  ssPorcentaje: number;
  diaCobro: number;
  ppEmpresa: boolean;
  contribucionPPEmpresaAnual: number;
  beneficiosEspecie: boolean;
  especieAnual: number;
  ejercicio: number;
}

/** ¿Hay nómina detectable? (RdtoTrabajo con retribuciones > 0). */
export function detectarNomina(decls: DeclaracionCompleta[]) {
  return masReciente(decls, (d) =>
    (d.trabajo?.retribucionesDinerarias ?? 0) > 0 ? d.trabajo : undefined,
  );
}

/** Valores iniciales del formulario de nómina sugeridos desde el XML más reciente. */
export function sugerenciasNomina(decls: DeclaracionCompleta[]): FormNomina | null {
  const det = detectarNomina(decls);
  if (!det) return null;
  const t = det.valor;
  const ejercicio = det.decl.meta.ejercicio;
  const especie = (t.valoracionEspecie ?? 0) + (t.ingresosACuentaEspecie ?? 0);
  return {
    empresaNombre: t.empleador?.nombre ?? '',
    nifEmpresa: t.empleador?.nif ?? '',
    cuentaAbono: undefined,
    brutoAnual: Math.round((t.retribucionesDinerarias ?? 0) * 100) / 100,
    numPagas: 14,
    irpfPorcentaje: pct(t.retenciones ?? 0, t.retribucionesDinerarias ?? 0),
    ssPorcentaje: pct(t.cotizacionesSS ?? 0, t.retribucionesDinerarias ?? 0),
    diaCobro: 25,
    ppEmpresa: (t.contribucionesPPEmpresa ?? 0) > 0,
    contribucionPPEmpresaAnual: Math.round((t.contribucionesPPEmpresa ?? 0) * 100) / 100,
    beneficiosEspecie: especie > 0,
    especieAnual: Math.round(especie * 100) / 100,
    ejercicio,
  };
}

/** Construye un payload Nomina válido (con defaults) desde el formulario. */
export function construirNominaPrefill(f: FormNomina): NominaPrefill {
  const ssDefaults = getSSDefaults(f.ejercicio);
  const baseMensual = Math.min(f.brutoAnual / Math.max(f.numPagas, 1), getBaseMaxima(f.ejercicio));
  return {
    personalDataId: 0, // Fase B inyecta el id real del titular.
    titular: 'yo',
    nombre: f.empresaNombre.trim() || (f.nifEmpresa ? `Nómina ${f.nifEmpresa}` : 'Nómina'),
    fechaAntiguedad: `${f.ejercicio}-01-01`,
    salarioBrutoAnual: f.brutoAnual,
    distribucion: { tipo: f.numPagas === 12 ? 'doce' : 'catorce', meses: f.numPagas },
    variables: [],
    bonus: [],
    beneficiosSociales: [],
    retribucionEspecieAnual: f.beneficiosEspecie ? f.especieAnual : undefined,
    aportacionEmpresaPlanPensionesAnual: f.ppEmpresa ? f.contribucionPPEmpresaAnual : undefined,
    retencion: {
      irpfPorcentaje: f.irpfPorcentaje,
      ss: {
        baseCotizacionMensual: Math.round(baseMensual * 100) / 100,
        contingenciasComunes: ssDefaults.contingenciasComunes.trabajador,
        desempleo: ssDefaults.desempleo.trabajador,
        formacionProfesional: ssDefaults.formacionProfesional.trabajador,
        mei: ssDefaults.mei.trabajador,
        overrideManual: false,
      },
    },
    deduccionesAdicionales: [],
    cuentaAbono: f.cuentaAbono ?? 0,
    reglaCobroDia: { tipo: 'fijo', dia: f.diaCobro },
    activa: true,
    empresa: f.nifEmpresa ? { nombre: f.empresaNombre.trim() || f.nifEmpresa, cif: f.nifEmpresa } : undefined,
  } as NominaPrefill;
}

// ── AUTÓNOMOS ───────────────────────────────────────────────────────────────

export interface FormAutonomo {
  descripcion: string;
  iae: string;
  modalidad: 'normal' | 'simplificada';
  tramoIndice: number;
  cuotaMensual: number;
  irpfRetencionPorcentaje: number;
  ejercicio: number;
}

export function detectarActividad(decls: DeclaracionCompleta[]) {
  return masReciente(decls, (d) => d.actividadEconomica);
}

export interface SugerenciasAutonomo {
  form: FormAutonomo;
  sugerenciaReta: SugerenciaReta | null;
  ingresos: number;
  gastos: number;
  rendimientoNeto: number;
  totalRetaAnual: number;
}

/** Valores iniciales del formulario de autónomo + sugerencia de tramo RETA. */
export function sugerenciasAutonomo(decls: DeclaracionCompleta[]): SugerenciasAutonomo | null {
  const det = detectarActividad(decls);
  if (!det) return null;
  const a = det.valor;
  const ejercicio = det.decl.meta.ejercicio;
  const totalRetaAnual = a.gastosSS ?? 0; // E1G6 · total RETA del año
  const sug = sugerirTramoReta(totalRetaAnual);
  return {
    sugerenciaReta: sug,
    ingresos: a.totalIngresos ?? a.ingresosExplotacion ?? 0,
    gastos: a.totalGastos ?? 0,
    rendimientoNeto: a.rendimientoNeto ?? 0,
    totalRetaAnual,
    form: {
      descripcion: '',
      iae: a.iae ?? '',
      modalidad: a.modalidad ?? 'simplificada',
      tramoIndice: sug?.indice ?? 0,
      cuotaMensual: sug?.tramo.cuotaMensual ?? 0,
      irpfRetencionPorcentaje: pct(a.retenciones ?? 0, a.totalIngresos ?? a.ingresosExplotacion ?? 0),
      ejercicio,
    },
  };
}

export function construirAutonomoPrefill(f: FormAutonomo): AutonomoPrefill {
  return {
    personalDataId: 0, // Fase B inyecta el id real del titular.
    nombre: f.descripcion.trim() || `Actividad IAE ${f.iae || 's/IAE'}`,
    titular: 'yo',
    epigrafeIAE: f.iae || undefined,
    descripcionActividad: f.descripcion.trim() || undefined,
    modalidad: f.modalidad,
    ingresosFacturados: [],
    gastosDeducibles: [],
    cuotaAutonomos: f.cuotaMensual,
    irpfRetencionPorcentaje: f.irpfRetencionPorcentaje || undefined,
    cuentaCobro: 0,
    cuentaPago: 0,
    reglaCobroDia: { tipo: 'fijo', dia: 1 },
    reglaPagoDia: { tipo: 'fijo', dia: 1 },
    activo: true,
  } as AutonomoPrefill;
}
