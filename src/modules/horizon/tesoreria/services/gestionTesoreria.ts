// Gestión delegada · Fase 2 · TESORERÍA (flujo de liquidación).
//
// La vista fiscal es SIEMPRE la misma (ingresos íntegros + comisión + neto).
// Lo único que cambia es CÓMO se mueve el dinero en Tesorería, y eso lo decide
// `gestion.liquidacion` del contrato de gestión (padre):
//
//   A) 'agencia_neto'  (por defecto) · la agencia cobra a los inquilinos y te
//      ingresa el neto. → 1 apunte de INGRESO en el padre; los subcontratos NO
//      generan apunte (los cobra la agencia). Sin apunte de comisión (va neteada).
//        · garantizada → ingreso = renta garantizada (padre.rentaMensual).
//        · %/fees      → ingreso = neto del mes (facturación − comisión).
//
//   B) 'propietario_bruto' · tú cobras las rentas íntegras y pagas la comisión a
//      la agencia. → N apuntes de INGRESO (los subcontratos, agregados por piso
//      vía `inmueble-${inmuebleId}` en punteoAdapter) + 1 apunte de GASTO de
//      comisión. El padre NO genera ingreso (lo cobran los inquilinos).
//
// Servicio puro · decide QUÉ emitir; no toca persistencia. Ver
// docs/DISENO-gestion-delegada-agencias-V1.md §5 (tesorería).

import type { Contract, GestionDelegada, HonorarioAgencia } from '../../../../services/db';
import { captacionPorInquilino } from '../../../inmuebles/utils/facturacionGestionService';

/** Liquidación efectiva de un padre (por defecto 'agencia_neto'). */
export function liquidacionDe(gestion: GestionDelegada | undefined): 'agencia_neto' | 'propietario_bruto' {
  return gestion?.liquidacion === 'propietario_bruto' ? 'propietario_bruto' : 'agencia_neto';
}

/** Comisión de la agencia imputable a UN mes (no anual). */
export function comisionMensual(
  gestion: GestionDelegada | undefined,
  facturacionMes: number,
  garantizadoMes: number,
  nHabitaciones: number,
): number {
  const tipo = gestion?.comisionTipo ?? 'garantizada';
  if (tipo === 'porcentaje') {
    return Math.max(0, (facturacionMes * (gestion?.comisionPorcentaje ?? 0)) / 100);
  }
  if (tipo === 'fees') {
    return (gestion?.honorarios ?? []).reduce(
      (sum, h) => sum + honorarioMensual(h, nHabitaciones),
      0,
    );
  }
  // garantizada (default) · la comisión es lo que excede del neto garantizado.
  return Math.max(0, facturacionMes - garantizadoMes);
}

/** Importe mensual de una línea de honorarios (fees). */
function honorarioMensual(h: HonorarioAgencia, nHabitaciones: number): number {
  if (h.periodicidad === 'por_inquilino_nuevo') return 0; // evento puntual · no recurrente
  const importe = h.base === 'habitacion' ? h.valor * nHabitaciones : h.valor;
  return h.periodicidad === 'anual' ? importe / 12 : importe;
}

/** Apunte de GASTO de comisión (solo flujo B · propietario_bruto). */
export interface ApunteComision {
  padreId: number;
  inmuebleId?: number;
  agenciaNif?: string;
  importe: number;
}

/**
 * Plan de tesorería del mes para la gestión delegada. `emisorNormal` es el bucle
 * de rentas de la sección 3: este plan le dice qué contratos NO debe emitir,
 * qué importe forzar y de qué cuenta cobrar, y aparte lista los gastos de comisión.
 */
export interface PlanGestionMes {
  /** Contratos (por id) que NO deben emitir su renta en el bucle normal. */
  suprimir: Set<number>;
  /** Override del importe de ingreso de un padre (flujo A · %/fees → neto). */
  importePorContrato: Map<number, number>;
  /** Cuenta de cobro heredada del padre para un subcontrato (hijos cuentaCobroId=0). */
  cuentaPorContrato: Map<number, number>;
  /** Gastos de comisión a emitir (flujo B). */
  comisiones: ApunteComision[];
}

/**
 * Construye el plan de tesorería del mes. `esActivo` decide si un contrato solapa
 * el mes (misma lógica que la sección 3 usa para las rentas normales).
 *
 * `iniciaEnMes` (opcional) marca los subcontratos que EMPIEZAN este mes exacto,
 * para imputar la captación (honorario puntual «inquilino nuevo»). Solo aplica en
 * comisión %/fees; en garantizada la captación va absorbida por el spread. Sin
 * este predicado, no se imputa captación (comportamiento previo intacto).
 */
export function planificarGestionMes(
  contracts: (Contract & { id?: number })[],
  esActivo: (c: Contract) => boolean,
  iniciaEnMes?: (c: Contract) => boolean,
): PlanGestionMes {
  const plan: PlanGestionMes = {
    suprimir: new Set<number>(),
    importePorContrato: new Map<number, number>(),
    cuentaPorContrato: new Map<number, number>(),
    comisiones: [],
  };

  const padres = contracts.filter((c) => c.gestion != null && c.id != null);

  for (const padre of padres) {
    const padreId = padre.id!;
    const liquidacion = liquidacionDe(padre.gestion);

    const hijosActivos = contracts.filter(
      (c) => c.gestionPadreId === padreId && esActivo(c),
    );
    const facturacionMes = hijosActivos.reduce((s, h) => s + (h.rentaMensual ?? 0), 0);
    const garantizadoMes = padre.gestion?.rentaGarantizada ?? 0;
    const comision = comisionMensual(padre.gestion, facturacionMes, garantizadoMes, hijosActivos.length);

    // Captación puntual · Σ del honorario por cada subcontrato que EMPIEZA este mes.
    const captacionMes = iniciaEnMes
      ? contracts
          .filter((c) => c.gestionPadreId === padreId && iniciaEnMes(c))
          .reduce((s, h) => s + captacionPorInquilino(padre.gestion, h.rentaMensual ?? 0), 0)
      : 0;

    if (liquidacion === 'agencia_neto') {
      // La agencia cobra a los inquilinos → los subcontratos no generan apunte.
      for (const h of hijosActivos) if (h.id != null) plan.suprimir.add(h.id);
      // El padre ingresa el neto. En garantizada ya es su `rentaMensual`; en
      // %/fees (rentaMensual=0) hay que forzar el neto del mes (menos captación).
      if ((padre.gestion?.comisionTipo ?? 'garantizada') !== 'garantizada') {
        plan.importePorContrato.set(padreId, Math.max(0, facturacionMes - comision - captacionMes));
      }
    } else {
      // propietario_bruto · tú cobras las rentas íntegras (subcontratos) y pagas
      // la comisión. El padre NO ingresa.
      if (padre.id != null) plan.suprimir.add(padreId);
      // Los subcontratos heredan la cuenta de cobro del padre (llevan cuentaCobroId=0).
      const cuentaPadre = padre.cuentaCobroId;
      if (typeof cuentaPadre === 'number' && cuentaPadre > 0) {
        for (const h of hijosActivos) if (h.id != null) plan.cuentaPorContrato.set(h.id, cuentaPadre);
      }
      // La comisión del mes = recurrente + captación de los inquilinos nuevos.
      const importeComision = comision + captacionMes;
      if (importeComision > 0) {
        plan.comisiones.push({
          padreId,
          inmuebleId: padre.inmuebleId,
          agenciaNif: padre.gestion?.agenciaNif,
          importe: importeComision,
        });
      }
    }
  }

  return plan;
}
