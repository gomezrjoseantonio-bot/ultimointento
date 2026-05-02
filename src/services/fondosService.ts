// fondosService · CRUD para el store 'fondos_ahorro' (Mi Plan v3)
// Gestiona los 6 tipos: colchon · compra · reforma · impuestos · capricho · custom
//
// V67 (T27.3) · vinculación bidireccional con `objetivos`:
//   - createFondo con objetivoVinculadoId sincroniza el `objetivo.fondoId`
//   - updateFondo limpia el fondo anterior si el objetivo cambia
//   - deleteFondo limpia el `objetivo.fondoId` antes de borrar
//   - Si el objetivo ya tenía OTRO fondo · ese fondo pierde su vinculación.

import { initDB } from './db';
import type { FondoAhorro, FondoTipo, CuentaAsignada, Objetivo } from '../types/miPlan';

// ── UUID helper ───────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Helpers de saldo de cuenta ────────────────────────────────────────────────

async function getSaldoCuenta(cuentaId: number): Promise<number> {
  const db = await initDB();
  try {
    const cuenta = await db.get('accounts', cuentaId);
    if (!cuenta) return 0;
    // El balance real se calcula con accountBalanceService; aquí usamos
    // el saldo disponible estimado del objeto Account (campo openingBalance
    // + movimientos, pero como aproximación usamos openingBalance si no hay más info).
    return (cuenta as { openingBalance?: number }).openingBalance ?? 0;
  } catch {
    return 0;
  }
}

// ── Validaciones de no-solapamiento de cuentas ───────────────────────────────

async function validateCuentasAsignadas(
  cuentasNuevas: CuentaAsignada[],
  excludeFondoId?: string,
): Promise<void> {
  const db = await initDB();
  const fondos = (await db.getAll('fondos_ahorro')).filter(
    (f) => (f as FondoAhorro).activo && f.id !== excludeFondoId,
  ) as FondoAhorro[];

  for (const asignNueva of cuentasNuevas) {
    const cuentaId = asignNueva.cuentaId;

    // Regla: una cuenta NO puede estar en modo 'completo' en más de un fondo
    if (asignNueva.modo === 'completo') {
      const conflicto = fondos.find((f) =>
        f.cuentasAsignadas.some((ca) => ca.cuentaId === cuentaId && ca.modo === 'completo'),
      );
      if (conflicto) {
        throw new Error(
          `La cuenta ${cuentaId} ya está asignada en modo 'completo' al fondo '${conflicto.nombre}'`,
        );
      }
    }

    // Regla: suma de porcentajeAsignado sobre la misma cuenta no puede superar 100
    const porcentajesExistentes = fondos
      .flatMap((f) => f.cuentasAsignadas)
      .filter(
        (ca): ca is Extract<CuentaAsignada, { modoImporte: 'porcentaje' }> =>
          ca.cuentaId === cuentaId && ca.modo === 'parcial' && ca.modoImporte === 'porcentaje',
      )
      .reduce((sum, ca) => sum + ca.porcentajeAsignado, 0);

    if (
      asignNueva.modo === 'parcial' &&
      asignNueva.modoImporte === 'porcentaje'
    ) {
      const nuevoPct = asignNueva.porcentajeAsignado;
      if (porcentajesExistentes + nuevoPct > 100) {
        throw new Error(
          `La suma de porcentajes asignados a la cuenta ${cuentaId} superaría el 100% ` +
            `(existente: ${porcentajesExistentes}%, nuevo: ${nuevoPct}%)`,
        );
      }
    }
  }
}

// ── Vinculación bidireccional fondo ↔ objetivo (T27.3) ────────────────────────
//
// Si `nuevoFondoId` se vincula a `objetivoId`:
//   1. Si el objetivo ya tenía otro fondo · ese fondo pierde su `objetivoVinculadoId`
//   2. El objetivo escribe `fondoId = nuevoFondoId`
//
// Internamente sin recursión · usa db directo · NO llama a updateFondo de nuevo.
async function _sincronizarVinculacionObjetivo(
  nuevoFondoId: string,
  objetivoId: string,
): Promise<void> {
  const db = await initDB();
  const objetivo = (await db.get('objetivos', objetivoId)) as Objetivo | undefined;
  if (!objetivo) return;

  // 1. Si el objetivo ya tenía otro fondo distinto · ese fondo pierde la vinculación
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fondoIdActual = (objetivo as any).fondoId as string | undefined;
  if (fondoIdActual && fondoIdActual !== nuevoFondoId) {
    const fondoAnterior = (await db.get('fondos_ahorro', fondoIdActual)) as
      | FondoAhorro
      | undefined;
    if (fondoAnterior) {
      const { objetivoVinculadoId: _omit, ...rest } = fondoAnterior;
      void _omit;
      await db.put('fondos_ahorro', {
        ...rest,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 2. El objetivo apunta al nuevo fondo
  // (esquivamos validación FK · sabemos que ambos existen)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objetivoActualizado = {
    ...objetivo,
    fondoId: nuevoFondoId,
    updatedAt: new Date().toISOString(),
  } as Objetivo;
  await db.put('objetivos', objetivoActualizado);
}

// Limpia la vinculación inversa cuando un fondo se desvincula o se elimina.
async function _limpiarVinculacionObjetivo(objetivoId: string): Promise<void> {
  const db = await initDB();
  const objetivo = (await db.get('objetivos', objetivoId)) as Objetivo | undefined;
  if (!objetivo) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = { ...objetivo };
  delete obj.fondoId;
  obj.updatedAt = new Date().toISOString();
  await db.put('objetivos', obj as Objetivo);
}

// ── createFondo ───────────────────────────────────────────────────────────────

export async function createFondo(
  input: Omit<FondoAhorro, 'id' | 'createdAt' | 'updatedAt' | 'activo'>,
): Promise<FondoAhorro> {
  await validateCuentasAsignadas(input.cuentasAsignadas);
  const db = await initDB();
  const now = new Date().toISOString();
  const fondo: FondoAhorro = {
    ...input,
    id: generateId(),
    activo: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.put('fondos_ahorro', fondo);

  // V67 · sincronizar vinculación bidireccional
  if (fondo.objetivoVinculadoId) {
    await _sincronizarVinculacionObjetivo(fondo.id, fondo.objetivoVinculadoId);
  }

  return fondo;
}

// ── getFondoByObjetivoId (T27.3) ──────────────────────────────────────────────

export async function getFondoByObjetivoId(
  objetivoId: string,
): Promise<FondoAhorro | undefined> {
  const db = await initDB();
  const all = (await db.getAll('fondos_ahorro')) as FondoAhorro[];
  return all.find((f) => f.activo && f.objetivoVinculadoId === objetivoId);
}

// ── getFondo ──────────────────────────────────────────────────────────────────

export async function getFondo(id: string): Promise<FondoAhorro | undefined> {
  const db = await initDB();
  return (await db.get('fondos_ahorro', id)) as FondoAhorro | undefined;
}

// ── listFondos ────────────────────────────────────────────────────────────────

export async function listFondos(filters?: {
  tipo?: FondoTipo;
  activo?: boolean;
}): Promise<FondoAhorro[]> {
  const db = await initDB();
  let all = (await db.getAll('fondos_ahorro')) as FondoAhorro[];
  if (filters?.tipo !== undefined) {
    all = all.filter((f) => f.tipo === filters.tipo);
  }
  if (filters?.activo !== undefined) {
    all = all.filter((f) => f.activo === filters.activo);
  }
  return all;
}

// ── updateFondo ───────────────────────────────────────────────────────────────

export async function updateFondo(
  id: string,
  patch: Partial<FondoAhorro>,
): Promise<FondoAhorro> {
  const db = await initDB();
  const current = (await db.get('fondos_ahorro', id)) as FondoAhorro | undefined;
  if (!current) {
    throw new Error(`Fondo con id '${id}' no encontrado`);
  }
  if (patch.cuentasAsignadas) {
    await validateCuentasAsignadas(patch.cuentasAsignadas, id);
  }
  const updated: FondoAhorro = {
    ...current,
    ...patch,
    id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await db.put('fondos_ahorro', updated);

  // V67 · sincronizar vinculación bidireccional cuando cambia el objetivo
  const objetivoAnteriorId = current.objetivoVinculadoId;
  const objetivoNuevoId = updated.objetivoVinculadoId;
  if (objetivoAnteriorId !== objetivoNuevoId) {
    if (objetivoAnteriorId) {
      await _limpiarVinculacionObjetivo(objetivoAnteriorId);
    }
    if (objetivoNuevoId) {
      await _sincronizarVinculacionObjetivo(id, objetivoNuevoId);
    }
  }

  return updated;
}

// ── archiveFondo ──────────────────────────────────────────────────────────────

export async function archiveFondo(id: string): Promise<void> {
  // V67 · al archivar · limpiar vinculación inversa del objetivo (si la había)
  const current = await getFondo(id);
  if (current?.objetivoVinculadoId) {
    await _limpiarVinculacionObjetivo(current.objetivoVinculadoId);
  }
  await updateFondo(id, { activo: false, objetivoVinculadoId: undefined });
}

// ── reactivateFondo ───────────────────────────────────────────────────────────

export async function reactivateFondo(id: string): Promise<void> {
  await updateFondo(id, { activo: true });
}

// ── getSaldoActualFondo ───────────────────────────────────────────────────────

function calcularAportacionAsignacion(asig: CuentaAsignada, saldoCuenta: number): number {
  if (asig.modo === 'completo') return saldoCuenta;
  if (asig.modo === 'parcial' && asig.modoImporte === 'fijo') return asig.importeAsignado;
  if (asig.modo === 'parcial' && asig.modoImporte === 'porcentaje') {
    return (asig.porcentajeAsignado / 100) * saldoCuenta;
  }
  return 0;
}

export async function getSaldoActualFondo(fondoId: string): Promise<number> {
  const fondo = await getFondo(fondoId);
  if (!fondo) throw new Error(`Fondo '${fondoId}' no encontrado`);

  let total = 0;
  for (const asig of fondo.cuentasAsignadas) {
    const saldoCuenta = await getSaldoCuenta(asig.cuentaId);
    total += calcularAportacionAsignacion(asig, saldoCuenta);
  }
  return total;
}

// ── getDistribucionFondos ─────────────────────────────────────────────────────

export async function getDistribucionFondos(): Promise<{
  total: number;
  porFondo: Array<{ fondoId: string; nombre: string; importe: number; tipo: FondoTipo }>;
  sinProposito: number;
}> {
  const db = await initDB();
  const fondosActivos = (await listFondos({ activo: true }));

  let totalAsignado = 0;
  const porFondo: Array<{ fondoId: string; nombre: string; importe: number; tipo: FondoTipo }> = [];

  for (const fondo of fondosActivos) {
    const importe = await getSaldoActualFondo(fondo.id);
    porFondo.push({ fondoId: fondo.id, nombre: fondo.nombre, importe, tipo: fondo.tipo });
    totalAsignado += importe;
  }

  // Calcular saldo total de todas las cuentas activas
  let saldoTotalCuentas = 0;
  try {
    const cuentas = (await db.getAll('accounts')) as Array<{
      activa?: boolean;
      openingBalance?: number;
    }>;
    for (const cuenta of cuentas) {
      if (cuenta.activa !== false) {
        saldoTotalCuentas += cuenta.openingBalance ?? 0;
      }
    }
  } catch {
    saldoTotalCuentas = totalAsignado;
  }

  const sinProposito = Math.max(saldoTotalCuentas - totalAsignado, 0);

  return {
    total: saldoTotalCuentas,
    porFondo,
    sinProposito,
  };
}
