// Onboarding día 0 · C6 / FIX PUNTO 7 · creación de inversiones desde la plantilla.
//
// Crea la posición vía `inversionesService.createPosicion` y su valoración
// inicial (valor de hoy) vía `valoracionesService.upsertByDate` (§2.5). La
// familia de la plantilla (espejo del modal) se traduce al `TipoPosicion`
// canónico del store de inversiones · NUNCA al store de préstamos-deuda (P4).
import { inversionesService } from './inversionesService';
import { upsertByDate } from './valoracionesService';
import type { TipoActivoValoracion } from '../types/valoracionActivo';
import type { TipoPosicion } from '../types/inversiones';
import type { InversionTemplateRow, FamiliaInversionTemplate } from './inversionesTemplateParserService';

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

// Familia (espejo modal) + subtipo libre → TipoPosicion canónico del store.
export function tipoCanonico(familia: FamiliaInversionTemplate, subtipo: string | null): TipoPosicion {
  const sub = (subtipo ?? '').toLowerCase();
  switch (familia) {
    case 'plan_pensiones':
      return /ppe|emple/.test(sub) ? 'plan_empleo' : 'plan_pensiones';
    case 'fondo':
      return 'fondo_inversion';
    case 'accion_etf_reit':
      if (sub.includes('etf')) return 'etf';
      if (sub.includes('reit')) return 'reit';
      return 'accion';
    case 'prestamo_activo':
      return 'prestamo_p2p';
    case 'deposito_cuenta':
      return sub.includes('cuenta') ? 'cuenta_remunerada' : 'deposito_plazo';
    case 'crypto':
      return 'crypto';
    default:
      return 'otro';
  }
}

function tipoValoracion(tipo: TipoPosicion): TipoActivoValoracion {
  if (tipo === 'plan_pensiones' || tipo === 'plan_empleo') return 'plan_pensiones';
  if (tipo === 'deposito_plazo' || tipo === 'cuenta_remunerada' || tipo === 'deposito') return 'deposito';
  return 'inversion';
}

// Datos propios sin campo nativo en el store (% atribución · TAE · plazo) se
// preservan en `notas` para no perderlos sin tocar el esquema del módulo.
function notasExtra(row: InversionTemplateRow): string {
  const partes: string[] = [];
  if (row.porcentajeAtribucion != null) partes.push(`% atribución: ${row.porcentajeAtribucion}`);
  if (row.tae != null) partes.push(`TAE/TIN: ${row.tae}%`);
  if (row.plazoMeses != null) partes.push(`plazo: ${row.plazoMeses} meses`);
  return partes.length ? `Aportación inicial · ${partes.join(' · ')}` : 'Aportación inicial';
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
    const tipo = tipoCanonico(row.tipo, row.subtipo);
    const valor = row.valorHoy > 0 ? row.valorHoy : row.costeAdquisicion;
    const fechaCompra = row.fechaCompra ?? hoy;
    const id = await inversionesService.createPosicion({
      nombre: row.producto,
      tipo,
      entidad: row.entidad ?? '',
      valor_actual: valor,
      fecha_valoracion: hoy,
      fecha_compra: fechaCompra,
      total_aportado: row.costeAdquisicion,
      importe_inicial: row.costeAdquisicion,
      notas: notasExtra(row),
      aportaciones: [],
      ...(row.isin ? { isin: row.isin } : {}),
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
      tipoActivo: tipoValoracion(tipo),
      fecha: hoy,
      valor,
      origen: 'manual',
    });

    r.creadas += 1;
    r.idsCreados.push(id);
  }
  return r;
}
