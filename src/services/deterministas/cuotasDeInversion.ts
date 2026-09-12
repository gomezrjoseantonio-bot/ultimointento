// Cuotas de un préstamo CONCEDIDO · la posición de `inversiones` y su cuadro.
//
// E2.4.2-fix2b (Jose · 12 sep 2026): «Yo dejé un dinero a mi empresa en formato
// de préstamo. Y eso está en Inversión. Cada mes me devuelve del dinero en
// cuotas (capital + intereses − IRPF retenido). Estamos en Tesorería.»
//
// La posición `prestamo_p2p` no guarda el cuadro: se recalcula de sus campos
// (`cuadroDePosicion`), igual que lo hace la ficha y la previsión del mes. Lo
// que entra en la cuenta es el NETO de la cuota: capital devuelto + interés −
// retención. Casar una línea del extracto contra eso es una igualdad al
// céntimo; la fecha del cuadro se acepta a ±5 días, como la cuota de un
// préstamo recibido (el banco no abona el día que dice el cuadro si cae en
// festivo).
//
// La familia es la que dice el store: `ingreso · inversion · <tipo de la
// posición>`, con el nombre de la posición. Un ingreso, uno solo. El desglose
// (capital / interés / retención) viaja en `desglose` para anotarlo en el pago
// de la posición al Guardar (§32.33 en espejo); de ahí lo lee el IRPF.
//
// Lo que NO se fuerza:
//   · un periodo cuyo pago ya tiene `movimiento_id` · ya se casó; otra vez
//     contaría la cuota dos veces;
//   · dos préstamos con la misma cuota a la misma fecha · empate, no se elige;
//   · una línea de la misma empresa que no es cuota (una factura) · se queda
//     sin reconocer, que es la verdad.

import type { Movement } from '../db';
import type { PosicionInversion } from '../../types/inversiones';
import type { OrigenDeterminista } from './tipos';
import { mismoImporte } from './igualdad';
import { MARGEN_DIAS_CUOTA, diasEntre } from './cuotasDePrestamo';
import { cobrosDelCuadro, retencionDePosicion, type CobroDelCuadro } from '../prestamoInversionCuadro';

/** Lo mínimo del rendimiento que hace falta leer · no ensancha el tipo canónico. */
interface PagoApuntado {
  fecha_pago?: string;
  movimiento_id?: number;
}

/** Cómo se llama esta cuota en pantalla · «Cuota 5/60 · Préstamo Socio · Unihouser». */
export function tituloDeCuotaDeInversion(pos: PosicionInversion, periodo: number, total: number): string {
  const nombre = pos.nombre?.trim() || 'préstamo';
  const entidad = pos.entidad?.trim();
  const quien = entidad && !nombre.toLowerCase().includes(entidad.toLowerCase()) ? `${nombre} · ${entidad}` : nombre;
  return `Cuota ${periodo}/${total} · ${quien}`;
}

function origenDeCuota(m: Movement, pos: PosicionInversion, c: CobroDelCuadro, total: number): OrigenDeterminista {
  return {
    movementId: m.id as number,
    fuente: 'inversion',
    origenId: String(pos.id ?? ''),
    piezaId: `cuadro:${c.periodo}`,
    titulo: tituloDeCuotaDeInversion(pos, c.periodo, total),
    como: 'fecha_importe',
    familia: 'inversion',
    subtipo: pos.tipo,
    desglose: {
      tipo: 'cuota_inversion',
      periodo: c.periodo,
      fecha: c.fecha,
      interes: c.interesBruto,
      retencion: c.retencion,
      amortizacion: c.amortizacion,
      neto: c.neto,
    },
  };
}

/** Las fechas del cuadro que ya tienen su movimiento · no se vuelven a casar. */
function fechasYaCasadas(pos: PosicionInversion): Set<string> {
  const pagos = ((pos.rendimiento as { pagos_generados?: PagoApuntado[] } | undefined)?.pagos_generados ?? []);
  return new Set(pagos.filter((p) => p.movimiento_id != null).map((p) => String(p.fecha_pago ?? '').slice(0, 10)));
}

/**
 * Reconoce las líneas que son una cuota de algún préstamo concedido.
 *
 * Misma disciplina que `cuotasQueCuadran`: una línea con más de un candidato
 * (dos préstamos empatados) no se reconoce; un periodo del cuadro explica UNA
 * sola línea, la más cercana en fecha.
 */
export function cuotasDeInversionQueCuadran(
  movimientos: Movement[],
  posiciones: PosicionInversion[],
): OrigenDeterminista[] {
  const cuadros = posiciones
    .filter((p) => p.tipo === 'prestamo_p2p' && p.activo !== false)
    .map((pos) => ({ pos, cobros: cobrosDelCuadro(pos, retencionDePosicion(pos)), casadas: fechasYaCasadas(pos) }))
    .filter((x) => x.cobros.length > 0);
  if (cuadros.length === 0) return [];

  type Candidato = { origen: OrigenDeterminista; distancia: number; clave: string };
  const elegidos: Candidato[] = [];

  for (const m of movimientos) {
    if (m.id == null) continue;
    // Una cuota que te devuelven ENTRA en la cuenta.
    if (m.amount <= 0) continue;

    const candidatos: Candidato[] = [];
    for (const { pos, cobros, casadas } of cuadros) {
      for (const c of cobros) {
        if (c.neto <= 0 || casadas.has(c.fecha)) continue;
        if (!mismoImporte(c.neto, m.amount)) continue;
        const distancia = diasEntre(c.fecha, m.date);
        if (distancia > MARGEN_DIAS_CUOTA) continue;
        candidatos.push({ origen: origenDeCuota(m, pos, c, cobros.length), distancia, clave: `${pos.id}:${c.periodo}` });
      }
    }
    if (candidatos.length === 1) elegidos.push(candidatos[0]);
  }

  // Un periodo explica UNA línea · si dos líneas caen sobre la misma cuota
  // (un abono devuelto y vuelto a emitir), se queda la más cercana.
  const porPeriodo = new Map<string, Candidato>();
  for (const c of elegidos) {
    const previo = porPeriodo.get(c.clave);
    if (!previo || c.distancia < previo.distancia) porPeriodo.set(c.clave, c);
  }
  return [...porPeriodo.values()].map((c) => c.origen);
}
