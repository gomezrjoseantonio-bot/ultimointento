// src/services/aeatPlanesPensionesImportService.ts
// TAREA 13 v4 · Commit 4 (F) · ampliado en Acción 1 (D6) con identidad de
// empresa pagadora (CIF + nombre) para paridad funcional con el bloque
// `declaracionDistributorService.persistirPlanPensiones` que sustituye.
//
// Cablea la importación de aportaciones a planes de pensiones desde XML/PDF
// AEAT al módulo dedicado V65. Antes de este commit el parser extraía las
// casillas (0426 aportaciones partícipe, 0427 contribuciones empresa) pero
// nadie las escribía en `aportacionesPlan`. Ahora:
//
//   1. Inferimos `tipoAdministrativo` desde la presencia de contribución
//      empresarial (PPE) o solo aportación del partícipe (PPI). Para PPES y
//      PPA con casilla origen ver TODO al final del archivo.
//   2. Buscamos un plan del titular en el ejercicio · prioridad de matching:
//        a) por CIF (`empresaPagadora.cif === nifEmpleador`) si llega
//        b) si no, por `personalDataId + titular + estado='activo' + tipo`
//      Si no existe, creamos un stub con `origen: 'xml_aeat'`,
//      `empresaPagadora`, `gestoraActual = nombreEmpleador`, y
//      `subtipoPPE: 'empleador_unico'` por defecto para PPE.
//   3. Creamos `aportacionesPlan` con `granularidad: 'anual'`,
//      `origen: 'xml_aeat'`, `casillaAEAT` ('0426' titular / '0427' empresa)
//      e `ejercicioFiscal`.
//   4. Idempotente · no duplicamos aportaciones del mismo plan + ejercicio +
//      origen='xml_aeat'.
//
// Nota AEAT casillas (sujeto a verificación contra modelo IRPF vigente · ver
// `limitesFiscalesPlanesService.getCasillaAEAT` y TODOs ahí):
//   - 0426 = aportaciones del partícipe (trabajador) · puede ser PPI/PPE/PPES
//     titular · sin más contexto asumimos PPI por defecto · si hay PPE/PPES
//     conocido, preferimos ese.
//   - 0427 = contribuciones del promotor (empresa) · siempre PPE/PPES.
//
// El usuario puede ajustar la atribución después · la entrada queda marcada
// con `origen='xml_aeat'` y `tipoFiscalInferido=true` (campo en notas).

import { initDB } from './db';
import { planesPensionesService } from './planesPensionesService';
import { aportacionesPlanService } from './aportacionesPlanService';
import type {
  AportacionPlan,
  PlanPensiones,
  TipoAdministrativo,
} from '../types/planesPensiones';

export interface ImportInput {
  /** ID del PersonalData del titular cuya declaración se importa. */
  personalDataId: number;
  /** 'yo' o 'pareja' (declaración del titular o de la pareja). */
  titular: 'yo' | 'pareja';
  /** Ejercicio fiscal de la declaración (YYYY). */
  ejercicio: number;
  /** Importe de la casilla 0426 (aportaciones del partícipe · titular). */
  aportacionesTrabajador: number;
  /** Importe de la casilla 0427 (contribuciones de la empresa · empresa). */
  contribucionesEmpresariales: number;
  /**
   * CIF de la empresa pagadora (campo `nifEmpleador` en la declaración AEAT).
   * Si llega · prioriza matching por CIF sobre matching por tipo, y se
   * propaga a `empresaPagadora.cif` del plan stub creado.
   */
  nifEmpleador?: string;
  /**
   * Nombre de la empresa pagadora (`nombreEmpleador` en la declaración AEAT).
   * Si llega · se propaga a `empresaPagadora.nombre` y a `gestoraActual`
   * del plan stub creado.
   */
  nombreEmpleador?: string;
  /**
   * Si el usuario ya seleccionó un plan al que atribuir la importación,
   * pásalo aquí · si no, el servicio decide automáticamente (ver §2 cabecera).
   */
  planIdExplicito?: string;
}

export interface ImportResult {
  planId: string;
  aportacionesCreadas: AportacionPlan[];
  /**
   * Avisos para el usuario · ej. "se ha creado un plan stub" o "atribución
   * ambigua, varios planes coincidían". El orchestrator los renderiza.
   */
  warnings: string[];
}

/**
 * Mapea casilla AEAT → tipo administrativo probable. Casillas verificadas
 * contra modelo IRPF 2025 (referencia: limitesFiscalesPlanesService.getCasillaAEAT).
 *
 * TODO · revisar contra docs AEAT IRPF 2026 cuando se publiquen. Si CC no
 * puede confirmar, mantener este mapping y dejar TODO marcado.
 */
export function inferirTipoDesdeCasilla(casilla: string): TipoAdministrativo {
  switch (casilla) {
    case '0470':
      return 'PPI';
    case '0471':
      // 0471 = aportación empresa al PPE empleador único (titular ve la
      // reducción).
      return 'PPE';
    case '0472':
      return 'PPA';
    case '0474':
      return 'PPES';
    case '0469':
      // Cónyuge sin rentas · va a un PPI del propio cónyuge (otra ficha).
      return 'PPI';
    default:
      return 'PPI'; // default conservador
  }
}

async function buscarPlanTitular(
  personalDataId: number,
  titular: 'yo' | 'pareja',
  preferTipo: TipoAdministrativo,
  nifEmpleador?: string,
): Promise<PlanPensiones | undefined> {
  const candidatos = await planesPensionesService.getAllPlanes({
    personalDataId,
    titular,
    estado: 'activo',
  });
  if (candidatos.length === 0) return undefined;
  // 1. Si llega CIF empleador, match exacto por `empresaPagadora.cif`.
  if (nifEmpleador) {
    const porCif = candidatos.find(
      (p) => p.empresaPagadora?.cif === nifEmpleador,
    );
    if (porCif) return porCif;
  }
  // 2. Si hay alguno del tipo preferido, devolverlo.
  const preferido = candidatos.find((p) => p.tipoAdministrativo === preferTipo);
  if (preferido) return preferido;
  // 3. Si solo hay 1 plan activo del titular, usarlo.
  if (candidatos.length === 1) return candidatos[0];
  // 4. Varios planes y ninguno del tipo preferido · devolver el primero PPI/PPE
  // por orden de prioridad (PPE > PPES > PPI > PPA).
  const orden: TipoAdministrativo[] = ['PPE', 'PPES', 'PPI', 'PPA'];
  for (const t of orden) {
    const p = candidatos.find((pp) => pp.tipoAdministrativo === t);
    if (p) return p;
  }
  return candidatos[0];
}

async function asegurarPlanStub(
  personalDataId: number,
  titular: 'yo' | 'pareja',
  tipo: TipoAdministrativo,
  ejercicio: number,
  nifEmpleador?: string,
  nombreEmpleador?: string,
): Promise<{ plan: PlanPensiones; created: boolean }> {
  const existing = await buscarPlanTitular(personalDataId, titular, tipo, nifEmpleador);
  if (existing) {
    // Pulido T13 v4 final · issue 2 · `fechaContratacion` retroactiva.
    // Si el plan se creó en una importación posterior (p.ej. 2024 primero) y
    // ahora se importa un ejercicio anterior (p.ej. 2020), retrocedemos la
    // fecha al 1-ene del ejercicio menor. Sin esto, la trayectoria muestra
    // "Plan abierto 2024" pero aportaciones desde 2020 · incoherente.
    const fechaEjercicio = `${ejercicio}-01-01`;
    if (existing.fechaContratacion > fechaEjercicio) {
      const actualizado = await planesPensionesService.updatePlan(existing.id, {
        fechaContratacion: fechaEjercicio,
      });
      return { plan: actualizado, created: false };
    }
    return { plan: existing, created: false };
  }
  const nombre = nombreEmpleador
    ? `Plan ${tipo} · ${nombreEmpleador}`
    : `Plan ${tipo} (importado AEAT ${ejercicio})`;
  const plan = await planesPensionesService.createPlan({
    nombre,
    titular,
    personalDataId,
    tipoAdministrativo: tipo,
    ...(tipo === 'PPE' ? { subtipoPPE: 'empleador_unico' as const } : {}),
    ...(nifEmpleador
      ? {
          empresaPagadora: {
            cif: nifEmpleador,
            nombre: nombreEmpleador ?? '',
          },
        }
      : {}),
    gestoraActual: nombreEmpleador ?? '—',
    fechaContratacion: `${ejercicio}-01-01`,
    estado: 'activo',
    origen: 'xml_aeat',
  } as Omit<PlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'>);
  return { plan, created: true };
}

async function aportacionExisteIdempotente(
  planId: string,
  ejercicio: number,
  rol: 'titular' | 'empresa',
): Promise<boolean> {
  const db = await initDB();
  const all = (await db.getAllFromIndex(
    'aportacionesPlan',
    'planId+ejercicioFiscal',
    [planId, ejercicio] as unknown as IDBValidKey,
  )) as AportacionPlan[];
  return all.some((a) => {
    if (a.origen !== 'xml_aeat') return false;
    if (rol === 'titular') return (a.importeTitular ?? 0) > 0 && (a.importeEmpresa ?? 0) === 0;
    return (a.importeEmpresa ?? 0) > 0 && (a.importeTitular ?? 0) === 0;
  });
}

/**
 * Importa aportaciones de planes de pensiones desde una declaración AEAT
 * (modelo 100 · IRPF). Idempotente · no duplica si ya se importó el mismo
 * ejercicio.
 */
export async function importarAportacionesAEAT(
  input: ImportInput,
): Promise<ImportResult> {
  const warnings: string[] = [];
  const aportacionesCreadas: AportacionPlan[] = [];

  const {
    personalDataId,
    titular,
    ejercicio,
    aportacionesTrabajador,
    contribucionesEmpresariales,
    nifEmpleador,
    nombreEmpleador,
    planIdExplicito,
  } = input;

  if (
    aportacionesTrabajador <= 0 &&
    contribucionesEmpresariales <= 0
  ) {
    return { planId: planIdExplicito ?? '', aportacionesCreadas, warnings };
  }

  // 1. Determinar plan destino
  let plan: PlanPensiones | undefined;
  let creado = false;

  if (planIdExplicito) {
    plan = await planesPensionesService.getPlan(planIdExplicito);
    if (!plan) {
      warnings.push(
        `Plan explícito ${planIdExplicito} no encontrado · se crea stub PPI.`,
      );
    }
  }

  if (!plan) {
    // Si hay contribución empresarial → PPE preferido. Si solo hay aportación
    // del partícipe → PPI por defecto.
    const tipoPreferido: TipoAdministrativo =
      contribucionesEmpresariales > 0 ? 'PPE' : 'PPI';
    const r = await asegurarPlanStub(
      personalDataId,
      titular,
      tipoPreferido,
      ejercicio,
      nifEmpleador,
      nombreEmpleador,
    );
    plan = r.plan;
    creado = r.created;
    if (creado) {
      warnings.push(
        `Se ha creado un plan stub "${plan.nombre}" · revisa gestora, ISIN y datos antes de cerrar el ejercicio.`,
      );
    } else if (
      tipoPreferido === 'PPE' &&
      plan.tipoAdministrativo !== 'PPE' &&
      plan.tipoAdministrativo !== 'PPES'
    ) {
      warnings.push(
        `Atribución ambigua · la declaración tiene contribución empresarial pero el plan ${plan.tipoAdministrativo} encontrado no admite empresa. Revisa la atribución manualmente.`,
      );
    }
  }

  // 2. Crear aportaciones idempotentes (1 entrada para titular, 1 para empresa
  //    si aplica · granularidad anual).
  const ahora = new Date().toISOString();
  void ahora;
  const fechaAnual = `${ejercicio}-12-31`;

  if (aportacionesTrabajador > 0) {
    const yaExiste = await aportacionExisteIdempotente(plan.id, ejercicio, 'titular');
    if (!yaExiste) {
      const ap = await aportacionesPlanService.crearAportacion({
        planId: plan.id,
        fecha: fechaAnual,
        ejercicioFiscal: ejercicio,
        importeTitular: aportacionesTrabajador,
        importeEmpresa: 0,
        origen: 'xml_aeat',
        granularidad: 'anual',
        casillaAEAT: '0426',
        notas: `Importado de declaración IRPF ${ejercicio} (casilla 0426 · partícipe)`,
      });
      aportacionesCreadas.push(ap);
    } else {
      warnings.push(
        `Aportación del partícipe del ejercicio ${ejercicio} ya importada previamente desde AEAT · saltada.`,
      );
    }
  }

  if (contribucionesEmpresariales > 0) {
    const yaExiste = await aportacionExisteIdempotente(plan.id, ejercicio, 'empresa');
    if (!yaExiste) {
      const ap = await aportacionesPlanService.crearAportacion({
        planId: plan.id,
        fecha: fechaAnual,
        ejercicioFiscal: ejercicio,
        importeTitular: 0,
        importeEmpresa: contribucionesEmpresariales,
        origen: 'xml_aeat',
        granularidad: 'anual',
        casillaAEAT: '0427',
        notas: `Importado de declaración IRPF ${ejercicio} (casilla 0427 · empresa)`,
      });
      aportacionesCreadas.push(ap);
    } else {
      warnings.push(
        `Contribución empresarial del ejercicio ${ejercicio} ya importada previamente desde AEAT · saltada.`,
      );
    }
  }

  return { planId: plan.id, aportacionesCreadas, warnings };
}

// TODO · TAREA 13 v4 · backlog post-Acción 1 (D6).
// `inferirTipoDesdeCasilla` está exportada pero NO se invoca internamente · el
// servicio infiere el tipo administrativo por presencia de contribución
// empresarial (`contribucionesEmpresariales > 0 ? 'PPE' : 'PPI'`). Para los
// casos PPI/PPE de Jose la inferencia actual da el resultado correcto.
// Cablearla requiere que el parser AEAT pase la casilla origen
// (0469/0470/0471/0472/0474) al servicio · eso modifica
// `irpfXmlParserService.extraerPlanPensiones`, que está fuera del alcance de
// Acción 1. Afecta a PPES (4 subtipos) y PPA cuando se modelen seriamente · no
// a los datos productivos actuales.
