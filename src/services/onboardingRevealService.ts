/**
 * Onboarding día 0 · C7 · datos del reveal (año previsto · FUTURO).
 *
 * Dispara el bootstrap (idempotente · forward-only) y compone las cifras de la
 * banda navy + el SVG de caja mes a mes. IRPF desde `estimacionFiscalEnCursoService`:
 * si no hay renta del trabajo ni actividad → null (la UI muestra "—" · nunca
 * inventa cifra · §2.6).
 */
import { initDB } from './db';
import type { TreasuryEvent, Property } from './db';
import { regenerateForecastsForward } from './treasuryBootstrapService';
import { calcularEstimacionEnCurso } from './estimacionFiscalEnCursoService';

export interface RevealData {
  rentasAnio: number;
  gastosAnio: number;
  ocupacion: string;
  irpf: number | null;
  mensualIngreso: number[];
  mensualGasto: number[];
}

export async function cargarRevealData(): Promise<RevealData> {
  await regenerateForecastsForward(); // idempotente · forward-only · 24m

  const db = await initDB();
  const [eventos, properties, contracts] = await Promise.all([
    db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
    db.getAll('properties') as Promise<Property[]>,
    db.getAll('contracts') as Promise<Array<{ estadoContrato?: string }>>,
  ]);

  const anio = new Date().getFullYear();
  const mensualIngreso = new Array(12).fill(0);
  const mensualGasto = new Array(12).fill(0);
  for (const ev of eventos) {
    if (!ev.predictedDate || !ev.predictedDate.startsWith(String(anio))) continue;
    const mes = new Date(ev.predictedDate).getUTCMonth();
    if (ev.type === 'income') mensualIngreso[mes] += Math.abs(ev.amount);
    else mensualGasto[mes] += Math.abs(ev.amount);
  }
  const rentasAnio = mensualIngreso.reduce((a, b) => a + b, 0);
  const gastosAnio = mensualGasto.reduce((a, b) => a + b, 0);

  const totalUnidades = properties.length;
  const contratosActivos = contracts.filter((c) => (c.estadoContrato ?? 'activo') === 'activo').length;
  const ocupacion = totalUnidades > 0 ? `${Math.min(contratosActivos, totalUnidades)} de ${totalUnidades}` : '—';

  const estimacion = await calcularEstimacionEnCurso().catch(() => null);
  const hayRentaTrabajo =
    !!estimacion &&
    (estimacion.ingresosAcumulados.trabajo > 0 ||
      estimacion.ingresosProyectados.trabajo > 0 ||
      estimacion.ingresosAcumulados.actividades > 0);
  const irpf = hayRentaTrabajo ? estimacion!.resultadoEstimado.cuotaLiquida : null;

  return { rentasAnio, gastosAnio, ocupacion, irpf, mensualIngreso, mensualGasto };
}

/** Puntos de una polilínea SVG (12 meses) escalando a `max` (regla Y · §17). */
export function puntosSVG(valores: number[], max: number): string {
  const x0 = 60;
  const dx = 45;
  const yBottom = 220;
  const altura = 200; // banda 20..220
  return valores
    .map((v, i) => {
      const x = x0 + i * dx;
      const y = yBottom - (max > 0 ? (v / max) * altura : 0);
      return `${x},${Math.round(y * 10) / 10}`;
    })
    .join(' ');
}

/** Redondeo "bonito" del máximo del eje Y. */
export function ejeMax(mensualIngreso: number[], mensualGasto: number[]): number {
  const m = Math.max(...mensualIngreso, ...mensualGasto, 1);
  const pot = Math.pow(10, Math.floor(Math.log10(m)));
  return Math.ceil(m / pot) * pot;
}
