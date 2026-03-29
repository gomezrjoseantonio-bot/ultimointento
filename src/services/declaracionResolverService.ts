import { initDB, SnapshotDeclaracion, EjercicioFiscal as DbEjercicioFiscal } from './db';
import { calcularDeclaracionIRPF, DeclaracionIRPF } from './irpfCalculationService';

export type FuenteDeclaracion = 'vivo' | 'declarado' | 'importado';

export async function obtenerDeclaracionParaEjercicio(
  ejercicio: number,
): Promise<{ declaracion: DeclaracionIRPF; fuente: FuenteDeclaracion }> {
  const currentYear = new Date().getFullYear();

  if (ejercicio >= currentYear) {
    const declaracion = await calcularDeclaracionIRPF(ejercicio);
    return { declaracion, fuente: 'vivo' };
  }

  const db = await initDB();

  // 1. Check snapshots store (from fiscalLifecycleService imports)
  const snapshots = (await db.getAllFromIndex('snapshotsDeclaracion', 'ejercicio', ejercicio)) as SnapshotDeclaracion[];

  const snapshotDeclarado = snapshots
    .filter((snapshot) => snapshot.origen === 'importacion_manual' && snapshot.datos?.declaracionCompleta)
    .sort((a, b) => b.fechaSnapshot.localeCompare(a.fechaSnapshot))[0];

  if (snapshotDeclarado?.datos?.declaracionCompleta) {
    return {
      declaracion: snapshotDeclarado.datos.declaracionCompleta as DeclaracionIRPF,
      fuente: 'declarado',
    };
  }

  const snapshotImportado = snapshots
    .filter((snapshot) => snapshot.datos?.declaracionCompleta)
    .sort((a, b) => b.fechaSnapshot.localeCompare(a.fechaSnapshot))[0];

  if (snapshotImportado?.datos?.declaracionCompleta) {
    return {
      declaracion: snapshotImportado.datos.declaracionCompleta as DeclaracionIRPF,
      fuente: 'importado',
    };
  }

  // 2. Check ejerciciosFiscales store (from declararEjercicio / PDF import)
  try {
    const ejFiscal = (await db.get('ejerciciosFiscales', ejercicio)) as DbEjercicioFiscal | undefined;
    if (ejFiscal?.declaracionAeat) {
      return {
        declaracion: ejFiscal.declaracionAeat as unknown as DeclaracionIRPF,
        fuente: 'importado',
      };
    }
    if (ejFiscal?.calculoAtlas) {
      return {
        declaracion: ejFiscal.calculoAtlas as unknown as DeclaracionIRPF,
        fuente: 'vivo',
      };
    }
  } catch {
    // Store may not exist in older DB versions — fall through
  }

  const declaracion = await calcularDeclaracionIRPF(ejercicio);
  return { declaracion, fuente: 'vivo' };
}
