// ============================================================================
// T34/T35-fix-2 · Cleanup one-shot · `categoria` aplastada a `otros.*`
// ============================================================================
//
// Corrige los 2 patrones documentados en HANDOFF-V7-atlas.md sección
// "T34/T35-fix-2 · Micro-bugs categoria":
//
//   Caso 1 · Día a día · Otros
//     tipoFamilia: 'dia_a_dia' · subtipo: 'otros'
//     categoria actual:   'otros.otros'
//     categoria correcta: 'dia_a_dia.otros'
//
//   Caso 2 · Seguros y cuotas · Seguro otros
//     tipoFamilia: 'seguros_cuotas' · subtipo: 'seguro_otros'
//     categoria actual:   'otros.seguro_otros'
//     categoria correcta: 'seguros_cuotas.seguro_otros'
//
// La inferencia post-T38 (V68) puede haber escrito 'otros.X' en registros
// legacy donde el `tipo` legacy era 'otros' y el `subtipo` no estaba en el
// catálogo de DIA_A_DIA_SUBTIPOS o SEGUROS_CUOTAS_SUBTIPOS. Este cleanup
// solo toca registros que ya tienen `tipoFamilia` correctamente clasificada
// (por V68 o por escritura directa del wizard) pero cuya `categoria` quedó
// con el prefijo 'otros' por la fallthrough rule de `inferFromTipoSubtipo`.
//
// REGLAS INVIOLABLES
//   · Idempotente · flag keyval 'cleanup_T34_T35_fix2_categorias'
//   · DB_VERSION sin cambios · sigue 69 · 40 stores
//   · NO toca otras incoherencias · solo los 2 patrones documentados
//   · NO bumpea ni migra schema
// ============================================================================

import { initDB } from '../db';

export const T34_T35_FIX2_FLAG_KEY = 'cleanup_T34_T35_fix2_categorias';

export interface CleanupCategoriasT34T35Fix2Report {
  /** True si el flag estaba presente · resto de campos a 0/false. */
  skipped: boolean;
  /** Total de compromisos revisados en esta corrida. */
  total: number;
  /** Registros corregidos en Caso 1 (`otros.otros` → `dia_a_dia.otros`). */
  caso1Corregidos: number;
  /** Registros corregidos en Caso 2 (`otros.seguro_otros` → `seguros_cuotas.seguro_otros`). */
  caso2Corregidos: number;
  /** Errores no fatales (ej · escritura del flag falló). */
  errors: string[];
}

/**
 * Determina la categoria correcta para un compromiso si encaja en uno de los
 * 2 patrones documentados; si no encaja, devuelve undefined (no tocar).
 */
function categoriaCorrectaSiAplica(c: {
  categoria?: string;
  tipoFamilia?: string;
  subtipo?: string;
}): string | undefined {
  const cat = c.categoria ?? '';
  const familia = c.tipoFamilia;
  const subtipo = c.subtipo;

  // Caso 1 · Día a día · Otros
  if (cat === 'otros.otros' && familia === 'dia_a_dia' && subtipo === 'otros') {
    return 'dia_a_dia.otros';
  }

  // Caso 2 · Seguros y cuotas · Seguro otros
  if (
    cat === 'otros.seguro_otros' &&
    familia === 'seguros_cuotas' &&
    subtipo === 'seguro_otros'
  ) {
    return 'seguros_cuotas.seguro_otros';
  }

  return undefined;
}

export async function cleanupCategoriasT34T35Fix2(): Promise<CleanupCategoriasT34T35Fix2Report> {
  const report: CleanupCategoriasT34T35Fix2Report = {
    skipped: false,
    total: 0,
    caso1Corregidos: 0,
    caso2Corregidos: 0,
    errors: [],
  };

  try {
    const db = await initDB();

    // Idempotencia · si el flag está, skip silencioso
    const flag = await db.get('keyval', T34_T35_FIX2_FLAG_KEY);
    if (flag === 'completed') {
      report.skipped = true;
      return report;
    }

    const todos = await db.getAll('compromisosRecurrentes');
    report.total = todos.length;

    for (const raw of todos) {
      const c = raw as {
        id?: number;
        categoria?: string;
        tipoFamilia?: string;
        subtipo?: string;
      };
      if (c.id == null) continue;

      const categoriaCorrecta = categoriaCorrectaSiAplica(c);
      if (categoriaCorrecta == null) continue;

      const actualizado = { ...raw, categoria: categoriaCorrecta };
      await db.put('compromisosRecurrentes', actualizado);

      if (categoriaCorrecta === 'dia_a_dia.otros') {
        report.caso1Corregidos++;
      } else if (categoriaCorrecta === 'seguros_cuotas.seguro_otros') {
        report.caso2Corregidos++;
      }
    }

    await db.put('keyval', 'completed', T34_T35_FIX2_FLAG_KEY);
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  }

  return report;
}
