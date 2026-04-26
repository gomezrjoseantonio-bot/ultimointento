// src/services/ejercicioFiscalMigration.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub para evitar romper consumers.

export async function ejecutarMigracionFiscal(): Promise<{
  migrado: boolean;
  ejerciciosMigrados: number[];
  ejercicioActualCreado: boolean;
  ejerciciosCerrados: number[];
}> {
  console.warn('[ejercicioFiscalMigration] Store eliminado en V62 · migración obsoleta');
  return {
    migrado: false,
    ejerciciosMigrados: [],
    ejercicioActualCreado: false,
    ejerciciosCerrados: [],
  };
}

export async function migrarEjerciciosLegacy(): Promise<void> {
  console.warn('[ejercicioFiscalMigration] Store eliminado en V62 · migración obsoleta');
}

export function resetMigracion(): void {
  console.warn('[ejercicioFiscalMigration] Store eliminado en V62 · operación no-op');
}

