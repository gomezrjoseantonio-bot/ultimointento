// ============================================================================
// S-WIZARD-NOMINA-V3 · sub-tarea 4
// ============================================================================
//
// Helper puro · transforma el state del wizard en el payload `Nomina` que
// `nominaService.saveNomina` o `nominaService.addCambioNomina` esperan.
//
// Responsabilidades:
//   · Mapear campos del form a la forma canónica `Nomina` (incluyendo
//     `distribucion.tipo`, `pagasExtra.mesesExtra`, desglose SS, etc.).
//   · NO toca IndexedDB · NO genera ids · NO consulta servicios.
//
// La sub-tarea 4 extrae esta lógica de `NominaPage.tsx` para poder testearla
// aislada y mantener el componente UI lo más fino posible.
// ============================================================================

import type { Nomina, Variable, BeneficioSocial, PlanPensionesNomina } from '../types/personal';
import type { getSSDefaults } from '../constants/cotizacionSS';

export interface FormVariableState {
  id: string;
  nombre: string;
  tipo: 'porcentaje' | 'importe';
  valorRaw: string;
  mes: number;
}

export interface FormEspecieState {
  id: string;
  concepto: string;
  importeRaw: string;
  sumaIRPF: boolean;
  tipo?: BeneficioSocial['tipo'];
}

export interface NominaFormState {
  pid: number;
  titular: 'yo' | 'pareja';
  empresa: string;
  cuentaId: number | null;
  vigenteDesde: string; // YYYY-MM
  diaCobro: string;
  brutoRaw: string;
  numeroPagas: number;
  mesesExtra: number[];
  irpfRaw: string;
  ssRaw: string;
  solidaridadRaw: string;
  variables: FormVariableState[];
  planActivo: boolean;
  planVinculadoId: string;
  planVinculadoNombre?: string;
  planAportTuyaRaw: string;
  planAportEmpresaRaw: string;
  especieActivo: boolean;
  especies: FormEspecieState[];
}

export interface SSContext {
  ssTope: number;
  ssDefaults: ReturnType<typeof getSSDefaults>;
  /** Suma del % por defecto para detectar el delta a aplicar a MEI. */
  ssPctSugerido: number;
}

const parseNum = (raw: string): number => {
  if (!raw || typeof raw !== 'string') return 0;
  const normalized = raw.replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Construye el payload `Nomina` a partir del estado del form. Devuelve
 * `null` si falta `pid` (situación que el caller debe controlar antes).
 */
export function buildNominaPayload(
  state: NominaFormState,
  ss: SSContext,
): Omit<Nomina, 'id' | 'fechaCreacion' | 'fechaActualizacion'> | null {
  if (state.pid === null || state.pid === undefined) return null;

  const dia = parseInt(state.diaCobro, 10);
  const day = Number.isFinite(dia) ? Math.min(28, Math.max(1, dia)) : 1;
  const fecha = `${state.vigenteDesde}-${String(day).padStart(2, '0')}`;

  const formVars: Variable[] = state.variables
    .filter((v) => parseNum(v.valorRaw) !== 0 || v.tipo === 'porcentaje')
    .map((v) => ({
      id: v.id,
      nombre: v.nombre || 'Variable',
      tipo: v.tipo,
      valor: parseNum(v.valorRaw),
      distribucionMeses: [{ mes: v.mes, porcentaje: 100 }],
    }));

  const beneficios: BeneficioSocial[] = state.especieActivo
    ? state.especies.map((e) => ({
        id: e.id,
        concepto: e.concepto || 'Beneficio',
        tipo: e.tipo ?? 'otro',
        importeMensual: parseNum(e.importeRaw),
        incrementaBaseIRPF: e.sumaIRPF,
      }))
    : [];

  const ssPctTotal = parseNum(state.ssRaw);
  // Mantener pesos por defecto y aplicar el delta sobre MEI para que la
  // suma coincida con lo que el usuario introdujo.
  const meiAjustado = (ss.ssDefaults.mei.trabajador ?? 0) + (ssPctTotal - ss.ssPctSugerido);

  const distribucion: Nomina['distribucion'] =
    state.numeroPagas === 12
      ? { tipo: 'doce', meses: 12 }
      : state.numeroPagas === 14
        ? { tipo: 'catorce', meses: 14 }
        : { tipo: 'personalizado', meses: state.numeroPagas };

  const planPensiones: PlanPensionesNomina | undefined =
    state.planActivo && state.planVinculadoId && state.planVinculadoId !== '__nuevo__'
      ? {
          aportacionEmpleado: { tipo: 'importe', valor: parseNum(state.planAportTuyaRaw) },
          aportacionEmpresa:  { tipo: 'importe', valor: parseNum(state.planAportEmpresaRaw) },
          productoDestinoId: state.planVinculadoId,
          productoDestinoNombre: state.planVinculadoNombre,
        }
      : undefined;

  return {
    personalDataId: state.pid,
    titular: state.titular,
    nombre: state.empresa,
    fechaAntiguedad: fecha,
    salarioBrutoAnual: parseNum(state.brutoRaw),
    distribucion,
    variables: formVars,
    bonus: [],
    beneficiosSociales: beneficios,
    retencion: {
      irpfPorcentaje: parseNum(state.irpfRaw),
      ss: {
        baseCotizacionMensual: ss.ssTope,
        contingenciasComunes: ss.ssDefaults.contingenciasComunes.trabajador,
        desempleo: ss.ssDefaults.desempleo.trabajador,
        formacionProfesional: ss.ssDefaults.formacionProfesional.trabajador,
        mei: Math.max(0, meiAjustado),
        overrideManual: false,
      },
      cuotaSolidaridadMensual: parseNum(state.solidaridadRaw) / 12,
    },
    planPensiones,
    deduccionesAdicionales: [],
    cuentaAbono: state.cuentaId ?? 0,
    reglaCobroDia: parseInt(state.diaCobro, 10) === 31
      ? { tipo: 'ultimo-habil' }
      : { tipo: 'fijo', dia: parseInt(state.diaCobro, 10) },
    activa: true,
    pagasExtra: state.numeroPagas > 12 ? { mesesExtra: state.mesesExtra.slice() } : undefined,
    cuotaSolidaridadMensual: parseNum(state.solidaridadRaw) / 12,
  };
}

export interface ValidacionResult {
  ok: boolean;
  errs: string[];
  errFields: Set<string>;
}

/**
 * Valida los campos obligatorios del form. Devuelve mensajes y un set de
 * field ids inválidos para resaltar visualmente cada input.
 */
export function validarFormNomina(state: Pick<
  NominaFormState,
  'empresa' | 'cuentaId' | 'brutoRaw' | 'diaCobro' | 'numeroPagas' | 'mesesExtra'
>): ValidacionResult {
  const errs: string[] = [];
  const errFields = new Set<string>();

  if (!state.empresa.trim()) {
    errs.push('Empresa es obligatoria');
    errFields.add('empresa');
  }
  if (state.cuentaId === null) {
    errs.push('Cuenta destino es obligatoria');
    errFields.add('cuenta');
  }
  if (parseNum(state.brutoRaw) <= 0) {
    errs.push('Bruto anual debe ser mayor que 0');
    errFields.add('bruto');
  }
  const dia = parseInt(state.diaCobro, 10);
  if (!Number.isFinite(dia) || dia < 1 || dia > 31) {
    errs.push('Día cobro fuera de rango');
    errFields.add('dia');
  }
  const extrasNecesarias = Math.max(0, state.numeroPagas - 12);
  if (state.mesesExtra.length !== extrasNecesarias) {
    errs.push(
      `Selecciona ${extrasNecesarias} mes${extrasNecesarias === 1 ? '' : 'es'} de paga extra`,
    );
    errFields.add('mesesExtra');
  }

  return { ok: errs.length === 0, errs, errFields };
}
