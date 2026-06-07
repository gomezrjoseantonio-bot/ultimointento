// Onboarding día 0 · C6 · creación de inversiones desde la plantilla.
//
// Crea la posición vía `inversionesService.createPosicion` y su valoración
// inicial (valor de hoy) vía `valoracionesService.upsertByDate` (§2.5).
import { inversionesService } from './inversionesService';
import { upsertByDate } from './valoracionesService';
import type { TipoActivoValoracion } from '../types/valoracionActivo';
import type { InversionTemplateRow, TipoInversionTemplate } from './inversionesTemplateParserService';

export interface ResultadoInversiones {
  creadas: number;
  errores: Array<{ fila: number; producto: string; motivo: string }>;
  idsCreados: number[];
}

export const resultadoInversionesVacio = (): ResultadoInversiones => ({
  creadas: 0,
  errores: [],
  idsCreados: [],
});

export interface InversionRevision {
  row: InversionTemplateRow;
  valido: boolean;
  motivo?: string;
}

export function revisarRow(row: InversionTemplateRow): InversionRevision {
  if (!row.producto) return { row, valido: false, motivo: 'Falta el producto' };
  if (row.valorHoy <= 0 && row.costeAdquisicion <= 0) {
    return { row, valido: false, motivo: 'Falta el valor de hoy o el coste de adquisición' };
  }
  return { row, valido: true };
}

export function revisarRows(rows: InversionTemplateRow[]): InversionRevision[] {
  return rows.map(revisarRow);
}

function tipoValoracion(tipo: TipoInversionTemplate): TipoActivoValoracion {
  if (tipo === 'plan_pensiones') return 'plan_pensiones';
  if (tipo === 'deposito') return 'deposito';
  return 'inversion';
}

export async function crearInversionesDesdeRows(rows: InversionTemplateRow[]): Promise<ResultadoInversiones> {
  const r = resultadoInversionesVacio();
  const hoy = new Date().toISOString().split('T')[0];

  for (const row of rows) {
    const revision = revisarRow(row);
    if (!revision.valido) {
      r.errores.push({ fila: row.filaOriginal, producto: row.producto, motivo: revision.motivo ?? 'Fila inválida' });
      continue;
    }
    const valor = row.valorHoy > 0 ? row.valorHoy : row.costeAdquisicion;
    const fechaCompra = row.fechaCompra ?? hoy;
    const id = await inversionesService.createPosicion({
      nombre: row.producto,
      tipo: row.tipo,
      entidad: row.entidad ?? '',
      valor_actual: valor,
      fecha_valoracion: hoy,
      fecha_compra: fechaCompra,
      total_aportado: row.costeAdquisicion,
      importe_inicial: row.costeAdquisicion,
      aportaciones: [],
      ...(row.unidades > 0
        ? {
            numero_participaciones: row.unidades,
            precio_medio_compra: row.costeAdquisicion > 0 ? row.costeAdquisicion / row.unidades : 0,
          }
        : {}),
    } as unknown as Parameters<typeof inversionesService.createPosicion>[0]);

    // Valoración inicial (valor de hoy) en el store canónico de valoraciones.
    await upsertByDate({
      activoId: String(id),
      tipoActivo: tipoValoracion(row.tipo),
      fecha: hoy,
      valor,
      origen: 'manual',
    });

    r.creadas += 1;
    r.idsCreados.push(id);
  }
  return r;
}
