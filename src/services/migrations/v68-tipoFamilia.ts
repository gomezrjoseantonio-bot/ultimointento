// ============================================================================
// T38 · Migración V68 · tipoFamilia en compromisosRecurrentes
// ============================================================================
//
// Infiere el campo `tipoFamilia` para todos los registros existentes en el
// store `compromisosRecurrentes` que no lo tengan aún. También normaliza
// `categoria` cuando está vacío o es un valor genérico de una sola palabra.
//
// Idempotente: usa keyval 'migration_v68_tipoFamilia_v1' como flag.
// No destructiva: `tipo`, `subtipo`, `responsable` y demás campos legacy
// quedan intactos. Solo ESCRIBE `tipoFamilia` (nuevo) y, en casos muy
// concretos, normaliza `categoria` (vacía o single-word sin información).
//
// Rendimiento: procesa en lotes de 100 si hay >1000 registros.
// ============================================================================

import { initDB } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const MIGRATION_KEY = 'migration_v68_tipoFamilia_v1';
const BATCH_SIZE = 100;

// ─── Subtipos canónicos por familia para inferencia ─────────────────────────

const SUMINISTROS_SUBTIPOS = new Set(['luz', 'gas', 'agua', 'internet', 'movil', 'tv']);

const DIA_A_DIA_SUBTIPOS = new Set([
  'supermercado', 'transporte', 'restaurantes', 'ocio',
  'salud', 'ropa', 'cuidado_personal',
]);

const SEGUROS_CUOTAS_SUBTIPOS = new Set([
  'gimnasio', 'educacion', 'profesional', 'ong',
  'seguro_salud', 'seguro_coche', 'seguro_vida', 'seguro_otros',
]);

const VIVIENDA_SUBTIPOS = new Set([
  'alquiler', 'ibi', 'comunidad', 'seguro_hogar',
]);

// ─── Mapping inverso categoria inmueble legacy → familia ────────────────────

const INMUEBLE_CATEGORIA_TO_FAMILIA: Record<string, string> = {
  'inmueble.ibi':             'tributos',
  'inmueble.comunidad':       'comunidad',
  'inmueble.suministros':     'suministros',
  'inmueble.seguros':         'seguros',
  'inmueble.gestionAlquiler': 'gestion',
  'inmueble.opex':            'reparacion',
  'inmueble.otros':           'otros',
};

// ─── Inferencia de tipoFamilia ───────────────────────────────────────────────

/**
 * Intenta inferir tipoFamilia desde el campo `categoria`.
 * Retorna la familia inferida o `undefined` si no se puede determinar.
 */
function inferFromCategoria(
  c: CompromisoRecurrente,
): { tipoFamilia: string; source: 'categoria' } | undefined {
  const cat = c.categoria ?? '';
  if (!cat) return undefined;

  if (c.ambito === 'personal') {
    // Single-word genérico
    if (cat === 'salud' || cat === 'alimentacion' || cat === 'transporte') {
      return { tipoFamilia: 'dia_a_dia', source: 'categoria' };
    }
    if (cat === 'suscripciones') {
      return { tipoFamilia: 'suscripciones', source: 'categoria' };
    }
    if (cat === 'personal') {
      const tf = c.tipo === 'suscripcion' ? 'suscripciones' : 'otros';
      return { tipoFamilia: tf, source: 'categoria' };
    }
    if (cat === 'ocio' || cat === 'viajes' || cat === 'tecnologia' || cat === 'regalos') {
      return { tipoFamilia: 'dia_a_dia', source: 'categoria' };
    }
    if (cat === 'educacion') {
      return { tipoFamilia: 'seguros_cuotas', source: 'categoria' };
    }

    // Dot-format
    const parts = cat.split('.');
    if (parts.length < 2) return undefined;
    const prefix = parts[0];

    // vivienda.suministros con subtipo de suministros → reclasificar a 'suministros'
    if (prefix === 'vivienda' && parts[1] === 'suministros') {
      if (c.subtipo && SUMINISTROS_SUBTIPOS.has(c.subtipo)) {
        return { tipoFamilia: 'suministros', source: 'categoria' };
      }
    }
    if (prefix === 'vivienda') return { tipoFamilia: 'vivienda', source: 'categoria' };
    if (prefix === 'suministros') return { tipoFamilia: 'suministros', source: 'categoria' };
    if (prefix === 'dia_a_dia') return { tipoFamilia: 'dia_a_dia', source: 'categoria' };
    if (prefix === 'suscripciones') return { tipoFamilia: 'suscripciones', source: 'categoria' };
    if (prefix === 'seguros_cuotas') return { tipoFamilia: 'seguros_cuotas', source: 'categoria' };
    if (prefix === 'otros') return { tipoFamilia: 'otros', source: 'categoria' };
    if (prefix === 'obligaciones' || prefix === 'ahorro') {
      return { tipoFamilia: 'otros', source: 'categoria' };
    }
  } else if (c.ambito === 'inmueble') {
    // Nuevo formato T38: inmueble.familia.subtipo
    const parts = cat.split('.');
    if (parts.length >= 3 && parts[0] === 'inmueble') {
      const familia = parts[1];
      const validFamilias = ['tributos', 'comunidad', 'suministros', 'seguros', 'gestion', 'reparacion', 'otros'];
      if (validFamilias.includes(familia)) {
        return { tipoFamilia: familia, source: 'categoria' };
      }
    }
    // Formato legacy: inmueble.X
    if (cat in INMUEBLE_CATEGORIA_TO_FAMILIA) {
      const familia = INMUEBLE_CATEGORIA_TO_FAMILIA[cat];
      if (familia) return { tipoFamilia: familia, source: 'categoria' };
    }
  }

  return undefined;
}

/**
 * Intenta inferir tipoFamilia desde `tipo` legacy + `subtipo`.
 * Retorna la familia inferida o `undefined`.
 */
function inferFromTipoSubtipo(
  c: CompromisoRecurrente,
): { tipoFamilia: string; source: 'tipoSubtipo' } | undefined {
  const tipo = c.tipo;
  const subtipo = c.subtipo ?? '';

  if (tipo === 'suministro') return { tipoFamilia: 'suministros', source: 'tipoSubtipo' };
  if (tipo === 'suscripcion') return { tipoFamilia: 'suscripciones', source: 'tipoSubtipo' };

  if (tipo === 'seguro') {
    const tf = c.ambito === 'inmueble' ? 'seguros' : 'seguros_cuotas';
    return { tipoFamilia: tf, source: 'tipoSubtipo' };
  }

  if (tipo === 'impuesto') {
    const tf = c.ambito === 'inmueble' ? 'tributos' : 'otros';
    return { tipoFamilia: tf, source: 'tipoSubtipo' };
  }

  if (tipo === 'comunidad') {
    const tf = c.ambito === 'inmueble' ? 'comunidad' : 'vivienda';
    return { tipoFamilia: tf, source: 'tipoSubtipo' };
  }

  if (tipo === 'cuota') {
    return { tipoFamilia: 'seguros_cuotas', source: 'tipoSubtipo' };
  }

  if (tipo === 'otros') {
    if (c.ambito === 'inmueble') {
      if (subtipo === 'honorarios_agencia' || subtipo === 'gestoria' || subtipo === 'asesoria') {
        return { tipoFamilia: 'gestion', source: 'tipoSubtipo' };
      }
      if (
        subtipo === 'mantenimiento_caldera' ||
        subtipo === 'mantenimiento_integral' ||
        subtipo === 'limpieza'
      ) {
        return { tipoFamilia: 'reparacion', source: 'tipoSubtipo' };
      }
      return { tipoFamilia: 'otros', source: 'tipoSubtipo' };
    }

    // Personal: revisar subtipo
    if (VIVIENDA_SUBTIPOS.has(subtipo)) return { tipoFamilia: 'vivienda', source: 'tipoSubtipo' };
    if (DIA_A_DIA_SUBTIPOS.has(subtipo)) return { tipoFamilia: 'dia_a_dia', source: 'tipoSubtipo' };
    if (SEGUROS_CUOTAS_SUBTIPOS.has(subtipo)) return { tipoFamilia: 'seguros_cuotas', source: 'tipoSubtipo' };
    if (subtipo === 'personalizado') return { tipoFamilia: 'otros', source: 'tipoSubtipo' };
    return { tipoFamilia: 'otros', source: 'tipoSubtipo' };
  }

  return undefined;
}

/**
 * Determina si la categoria debe normalizarse dado el tipoFamilia inferido.
 * Solo normaliza cuando categoria está vacía o es single-word genérica que
 * no aporta información más allá de la familia.
 */
function normalizarCategoria(
  c: CompromisoRecurrente,
  tipoFamilia: string,
): string | undefined {
  const cat = c.categoria ?? '';
  const subtipo = c.subtipo ?? 'otros';

  // Si ya tiene formato "familia.subfamilia" coherente con tipoFamilia → dejar igual
  if (cat.startsWith(`${tipoFamilia}.`)) return undefined;

  // Si está vacía → escribir "tipoFamilia.subtipo"
  if (!cat) return `${tipoFamilia}.${subtipo}`;

  // Si es single-word genérico → normalizar
  const SINGLE_WORD_GENERICS = new Set([
    'salud', 'alimentacion', 'transporte', 'ocio', 'viajes',
    'personal', 'regalos', 'tecnologia', 'educacion', 'suscripciones',
  ]);
  if (!cat.includes('.') && SINGLE_WORD_GENERICS.has(cat)) {
    return `${tipoFamilia}.${subtipo}`;
  }

  // En cualquier otro caso (vivienda.suministros con tipoFamilia='suministros', etc.) → dejar igual
  return undefined;
}

// ─── Función principal de migración ─────────────────────────────────────────

export interface V68MigrationReport {
  total: number;
  migrados: number;
  sinClasificar: number;
  inferidosDesdeCategoria: number;
  inferidosDesdeTipoSubtipo: number;
  categoriasNormalizadas: number;
  skipped: boolean;
}

export async function runV68TipoFamiliaMigration(): Promise<V68MigrationReport> {
  const report: V68MigrationReport = {
    total: 0,
    migrados: 0,
    sinClasificar: 0,
    inferidosDesdeCategoria: 0,
    inferidosDesdeTipoSubtipo: 0,
    categoriasNormalizadas: 0,
    skipped: false,
  };

  try {
    const db = await initDB();

    // Idempotencia: si ya se ejecutó, salir
    const status = await db.get('keyval', MIGRATION_KEY);
    if (status === 'completed') {
      report.skipped = true;
      return report;
    }

    const todos = await db.getAll('compromisosRecurrentes');
    report.total = todos.length;

    // Filtrar solo los que no tienen tipoFamilia
    const sinTipoFamilia = todos.filter(
      (c) => (c as CompromisoRecurrente & { tipoFamilia?: string }).tipoFamilia == null,
    );

    if (sinTipoFamilia.length === 0) {
      await db.put('keyval', 'completed', MIGRATION_KEY);
      console.info('[T38 migration v68]', { ...report, skipped: false });
      return report;
    }

    // Procesar en lotes de BATCH_SIZE para no bloquear el event loop
    for (let i = 0; i < sinTipoFamilia.length; i += BATCH_SIZE) {
      const lote = sinTipoFamilia.slice(i, i + BATCH_SIZE);

      for (const raw of lote) {
        const c = raw as CompromisoRecurrente;
        if (c.id == null) continue;

        // Paso 1: intentar inferir desde categoria
        const fromCat = inferFromCategoria(c);
        let tipoFamilia: string | undefined;
        let source: 'categoria' | 'tipoSubtipo' | undefined;

        if (fromCat) {
          tipoFamilia = fromCat.tipoFamilia;
          source = 'categoria';
          report.inferidosDesdeCategoria++;
        } else {
          // Paso 2: intentar inferir desde tipo+subtipo
          const fromTipo = inferFromTipoSubtipo(c);
          if (fromTipo) {
            tipoFamilia = fromTipo.tipoFamilia;
            source = 'tipoSubtipo';
            report.inferidosDesdeTipoSubtipo++;
          }
        }

        if (tipoFamilia == null || source == null) {
          report.sinClasificar++;
          continue;
        }

        // Paso 3: normalizar categoria si aplica
        const nuevaCategoria = normalizarCategoria(c, tipoFamilia);

        const actualizado = {
          ...c,
          tipoFamilia,
          ...(nuevaCategoria != null ? { categoria: nuevaCategoria } : {}),
        };

        await db.put('compromisosRecurrentes', actualizado);
        report.migrados++;
        if (nuevaCategoria != null) report.categoriasNormalizadas++;
      }

      // Yield al event loop entre lotes
      if (sinTipoFamilia.length > BATCH_SIZE) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    await db.put('keyval', 'completed', MIGRATION_KEY);

    console.info('[T38 migration v68]', {
      total: report.total,
      migrados: report.migrados,
      sinClasificar: report.sinClasificar,
      inferidosDesdeCategoria: report.inferidosDesdeCategoria,
      inferidosDesdeTipoSubtipo: report.inferidosDesdeTipoSubtipo,
      categoriasNormalizadas: report.categoriasNormalizadas,
    });
  } catch (error) {
    console.error('[T38 migration v68] falló:', error);
  }

  return report;
}
