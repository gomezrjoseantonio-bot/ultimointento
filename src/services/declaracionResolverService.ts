import { initDB, SnapshotDeclaracion } from './db';
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

  const declaracion = await calcularDeclaracionIRPF(ejercicio);
  return { declaracion, fuente: 'vivo' };
}
