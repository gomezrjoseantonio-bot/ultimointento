// WRAPPER TEMPORAL — este servicio delega a gastosInmuebleService
// Mantiene los mismos nombres de métodos públicos para no romper importadores
// Pendiente eliminar en fase de limpieza final

import { initDB, type AEATBox, type AEATFiscalType, type OperacionFiscal, type OpexRule, type GastoInmueble, type GastoCategoria } from './db';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';
import { OPEX_CATEGORY_TO_AEAT_BOX } from './aeatClassificationService';
import { prestamosService } from './prestamosService';
import { prestamosCalculationService } from './prestamosCalculationService';
import { gastosInmuebleService } from './gastosInmuebleService';
import { mapCompromisoToOpexRule } from './opexService';
// El calendario y el importe salen de las MISMAS funciones que usa el motor de
// previsiones de tesorería. Es el punto de todo este arreglo: mientras cada
// motor tuviera su propia aritmética, Fiscalidad y Tesorería daban cifras
// distintas del mismo recibo — y la de Fiscalidad no llevaba IPC.
import { expandirPatron } from './personal/patronCalendario';
import { importeCompromisoEnFecha } from './personal/compromisosRecurrentesService';
import { toISODateLocal } from '../utils/recurrenceDateUtils';

// ── Fechas ──────────────────────────────────────────────────────────────────

/** El mes (1-12) de una fecha ISO · leído del texto, nunca con `Date`. */
export function mesDeISO(iso: string): number {
  return Number((iso ?? '').slice(5, 7));
}

// ── Mapping helpers ──

function mapCasillaToCategoria(casilla: string): GastoCategoria {
  const map: Record<string, GastoCategoria> = {
    '0105': 'intereses', '0106': 'reparacion', '0109': 'comunidad',
    '0112': 'gestion', '0113': 'suministro', '0114': 'seguro',
    '0115': 'ibi', '0117': 'otro',
  };
  return map[casilla] || 'otro';
}

export function mapBoxToFiscalType(box: AEATBox): AEATFiscalType {
  // 0129/0130/0131 (mejoras, base amort. inmueble, amort. inmueble) no tienen
  // un AEATFiscalType propio; se representan como capex-mejora-ampliacion.
  const map: Record<AEATBox, AEATFiscalType> = {
    '0105': 'financiacion',
    '0106': 'reparacion-conservacion',
    '0109': 'comunidad',
    '0112': 'servicios-personales',
    '0113': 'suministros',
    '0114': 'seguros',
    '0115': 'tributos-locales',
    '0117': 'amortizacion-muebles',
    '0129': 'capex-mejora-ampliacion',
    '0130': 'capex-mejora-ampliacion',
    '0131': 'capex-mejora-ampliacion',
  };
  return map[box];
}

function mapGastoToOperacion(g: GastoInmueble): OperacionFiscal {
  return {
    id: g.id,
    ejercicio: g.ejercicio,
    fecha: g.fecha,
    concepto: g.concepto,
    casillaAEAT: g.casillaAEAT as AEATBox,
    categoriaFiscal: mapBoxToFiscalType(g.casillaAEAT as AEATBox),
    total: g.importe,
    inmuebleId: g.inmuebleId,
    proveedorNIF: g.proveedorNIF || 'PENDIENTE',
    proveedorNombre: g.proveedorNombre,
    documentId: g.documentId,
    movementId: g.movimientoId,
    origen: g.origen === 'xml_aeat' ? 'migracion' :
            g.origen === 'tesoreria' ? 'movimiento' :
            g.origen === 'recurrente' ? 'recurrente' :
            g.origen === 'prestamo' ? 'recurrente' : 'manual',
    origenId: g.origenId,
    estado: g.estado === 'previsto' ? 'previsto' : 'confirmado',
    patas: (g.documentId ? 1 : 0) + (g.movimientoId ? 1 : 0) + (g.inmuebleId && g.casillaAEAT && g.importe > 0 ? 1 : 0),
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  } as OperacionFiscal;
}

// ── CRUD wrappers ──

export async function crearOperacionFiscal(
  input: Omit<OperacionFiscal, 'id' | 'ejercicio' | 'estado' | 'patas' | 'createdAt' | 'updatedAt'>
): Promise<OperacionFiscal> {
  const ejercicio = new Date(input.fecha).getFullYear();
  const id = await gastosInmuebleService.add({
    inmuebleId: input.inmuebleId!,
    ejercicio,
    fecha: input.fecha,
    concepto: input.concepto || '',
    categoria: mapCasillaToCategoria(input.casillaAEAT),
    casillaAEAT: input.casillaAEAT as any,
    importe: input.total || 0,
    origen: input.origen === 'recurrente' ? 'recurrente' :
            input.origen === 'movimiento' ? 'tesoreria' :
            input.origen === 'migracion' ? 'xml_aeat' : 'manual',
    origenId: input.origenId ? String(input.origenId) : undefined,
    estado: 'confirmado',
    proveedorNIF: input.proveedorNIF,
    proveedorNombre: input.proveedorNombre,
    documentId: input.documentId,
    movimientoId: input.movementId ? String(input.movementId) : undefined,
  });
  const created = await gastosInmuebleService.getByInmuebleYEjercicio(input.inmuebleId!, ejercicio);
  const gasto = created.find(g => g.id === id);
  return gasto ? mapGastoToOperacion(gasto) : { ...input, id, ejercicio, estado: 'confirmado', patas: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as OperacionFiscal;
}

export async function actualizarOperacionFiscal(
  id: number,
  updates: Partial<Omit<OperacionFiscal, 'id' | 'createdAt'>>
): Promise<OperacionFiscal> {
  const mappedUpdates: Partial<GastoInmueble> = {};
  if (updates.fecha != null) mappedUpdates.fecha = updates.fecha;
  if (updates.concepto != null) mappedUpdates.concepto = updates.concepto;
  if (updates.casillaAEAT != null) {
    mappedUpdates.casillaAEAT = updates.casillaAEAT as any;
    mappedUpdates.categoria = mapCasillaToCategoria(updates.casillaAEAT);
  }
  if (updates.total != null) mappedUpdates.importe = updates.total;
  if (updates.proveedorNIF !== undefined) mappedUpdates.proveedorNIF = updates.proveedorNIF;
  if (updates.proveedorNombre !== undefined) mappedUpdates.proveedorNombre = updates.proveedorNombre;
  if (updates.documentId !== undefined) mappedUpdates.documentId = updates.documentId;
  if (updates.movementId !== undefined) mappedUpdates.movimientoId = updates.movementId ? String(updates.movementId) : undefined;

  await gastosInmuebleService.update(id, mappedUpdates);
  const db = await initDB();
  const gasto = await db.get('gastosInmueble', id);
  if (!gasto) throw new Error('Operación fiscal no encontrada');
  return mapGastoToOperacion(gasto);
}

export async function getOperacionesPorInmuebleYEjercicio(inmuebleId: number, ejercicio: number): Promise<OperacionFiscal[]> {
  const gastos = await gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ejercicio);
  return gastos.map(mapGastoToOperacion).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function getOperacionesPorEjercicio(ejercicio: number): Promise<OperacionFiscal[]> {
  const gastos = await gastosInmuebleService.getByEjercicio(ejercicio);
  return gastos.map(mapGastoToOperacion);
}

export async function vincularMovimiento(operacionId: number, movementId: number | string): Promise<OperacionFiscal> {
  return actualizarOperacionFiscal(operacionId, { movementId });
}

export async function vincularDocumento(operacionId: number, documentId: number): Promise<OperacionFiscal> {
  return actualizarOperacionFiscal(operacionId, { documentId });
}

export async function eliminarOperacionFiscal(id: number): Promise<void> {
  await gastosInmuebleService.delete(id);
}

export async function getResumenCasillasAEAT(inmuebleId: number, ejercicio: number): Promise<Record<string, number>> {
  return gastosInmuebleService.getSumaPorCasilla(inmuebleId, ejercicio);
}

// ── Recurring generation (writes only to gastosInmueble) ──

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * ¿Esta línea fiscal sigue siendo una PREVISIÓN viva?
 *
 * Misma idea que `esPrevisionIntocable` en tesorería, y por el mismo motivo: lo
 * que ya ocurrió es realidad y no se reescribe. Una línea confirmada, conciliada
 * o casada con un movimiento del banco se queda como está aunque el compromiso
 * cambie después — subir la cuota de la comunidad no reescribe lo que pagaste
 * en enero.
 */
function esLineaFiscalViva(g: GastoInmueble): boolean {
  return g.estado === 'previsto' && g.movimientoId == null && g.estadoTesoreria !== 'confirmed';
}

/** La mayor de dos fechas ISO · comparar cadenas `YYYY-MM-DD` ordena bien. */
function maxISO(a: string, b?: string): string {
  return b && b > a ? b : a;
}

/** La menor de dos fechas ISO. */
function minISO(a: string, b?: string): string {
  return b && b < a ? b : a;
}

/**
 * Materializa las líneas fiscales de los gastos recurrentes de un inmueble.
 *
 * REGENERA, no rellena huecos. Antes se saltaba con un `continue` cualquier mes
 * que ya tuviera línea, así que una línea escrita una vez se quedaba con aquel
 * importe PARA SIEMPRE: subir la comunidad no se reflejaba en 2030, y el
 * presupuesto a 20 años enseñaba la cifra del día en que se generó por primera
 * vez. Ahora vuelve a calcular y reescribe lo que sigue siendo previsión.
 *
 * Lo confirmado NO se toca (`esLineaFiscalViva`). Es la misma regla que ya
 * cumple tesorería: el futuro se recalcula, el pasado confirmado se queda.
 *
 * El importe sale de `importeCompromisoEnFecha` —la fuente única— y por tanto
 * lleva IPC. Antes salía de `rule.importeEstimado`, plano: `OpexRule` ni
 * siquiera tiene campo `variacion`, así que el IPC se perdía al traducir el
 * compromiso a regla y el presupuesto de 2044 costaba lo mismo que el de hoy.
 * Por eso el calendario también pasa a `expandirPatron`: si el importe viene de
 * un motor y las fechas de otro, vuelven a divergir.
 *
 * Devuelve cuántas líneas se han escrito (creadas + actualizadas).
 */
export async function generarOperacionesDesdeRecurrentes(inmuebleId: number, ejercicio: number): Promise<number> {
  const db = await initDB();
  // V5.4+: read from compromisosRecurrentes (ambito='inmueble') instead of opexRules (DEPRECATED)
  const compromisos = (await db.getAllFromIndex('compromisosRecurrentes', 'inmuebleId', inmuebleId))
    .filter((c: CompromisoRecurrente) => c.ambito === 'inmueble' && c.estado === 'activo' && c.id != null);

  // Una sola lectura de la tabla · antes se releía entera DENTRO del bucle de
  // meses, o sea doce veces por gasto y por ejercicio.
  const existentes = await gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ejercicio);
  const porOrigenId = new Map<string, GastoInmueble>();
  for (const g of existentes) {
    if (g.origen === 'recurrente' && g.origenId) porOrigenId.set(g.origenId, g);
  }

  let escritas = 0;

  for (const c of compromisos) {
    const rule = mapCompromisoToOpexRule(c);
    if (!rule) continue;

    const casillaAEAT = (rule.casillaAEAT as AEATBox | undefined) || OPEX_CATEGORY_TO_AEAT_BOX[rule.categoria as keyof typeof OPEX_CATEGORY_TO_AEAT_BOX];
    if (!casillaAEAT) continue;

    // La ventana es el ejercicio, recortada por el alta y la baja del gasto: un
    // recurrente que empieza en junio no debe tener línea de enero.
    const desde = maxISO(`${ejercicio}-01-01`, c.fechaInicio);
    const hasta = minISO(`${ejercicio}-12-31`, c.fechaFin);
    if (desde > hasta) continue;

    let fechas: Date[];
    try {
      fechas = expandirPatron(c.patron, desde, hasta);
    } catch {
      // Patrón corrupto · `expandirPatron` lanza en vez de girar sin fin. Se
      // salta este gasto, igual que hace `buildOpexPorMes`, en lugar de tumbar
      // la generación entera del inmueble.
      continue;
    }

    for (const fecha of fechas) {
      const importe = importeCompromisoEnFecha(c, fecha);
      if (importe == null || importe <= 0) continue;

      const mes = fecha.getMonth() + 1;
      const origenId = `recurrente-${c.id}-${ejercicio}-${mes}`;
      const previa = porOrigenId.get(origenId);

      // Lo ya confirmado es realidad · no se reescribe.
      if (previa && !esLineaFiscalViva(previa)) continue;

      if (!previa) {
        // Compatibilidad: líneas de antes de que existiera `origenId`. Se
        // reconocen por no tenerlo, y se dejan en paz para no duplicarlas —
        // NO se comparan por importe, que ahora lleva IPC y ya no coincidiría.
        const legacy = existentes.some(
          (g) =>
            g.origen === 'recurrente' &&
            !g.origenId &&
            g.casillaAEAT === casillaAEAT &&
            mesDeISO(g.fecha) === mes &&
            (g.concepto ?? '').includes(c.alias),
        );
        if (legacy) continue;
      }

      const fechaOp = toISODateLocal(fecha);
      const conceptoOp = `${c.alias} — ${MESES[mes - 1]}`;

      // Nada que escribir si el resultado es idéntico · evita reescribir la
      // tabla entera (y tocar `updatedAt`) en cada lectura del resumen fiscal.
      if (
        previa &&
        previa.fecha === fechaOp &&
        Math.abs(previa.importe - importe) < 0.005 &&
        previa.concepto === conceptoOp
      ) {
        continue;
      }

      // `add` hace upsert por (origen, origenId): crea si no está, actualiza si
      // ya estaba. La comprobación de intocable de arriba es la que garantiza
      // que ese upsert nunca pise una línea confirmada.
      await gastosInmuebleService.add({
        inmuebleId,
        ejercicio,
        fecha: fechaOp,
        concepto: conceptoOp,
        categoria: mapCasillaToCategoria(casillaAEAT),
        casillaAEAT: casillaAEAT as any,
        importe,
        origen: 'recurrente',
        origenId,
        estado: 'previsto',
        proveedorNIF: rule.proveedorNIF || undefined,
        proveedorNombre: rule.proveedorNombre || undefined,
      });
      escritas += 1;
    }
  }

  return escritas;
}

export async function generarOperacionesDesdeIntereses(inmuebleId: number, ejercicio: number): Promise<number> {
  const prestamos = await prestamosService.getPrestamosByProperty(String(inmuebleId));
  if (!prestamos.length) return 0;

  let creadas = 0;

  for (const prestamo of prestamos) {
    if (!prestamo.activo) continue;

    const porcentaje = prestamosService.getPorcentajeAfectacion(prestamo, String(inmuebleId));
    if (porcentaje <= 0) continue;
    const factor = porcentaje / 100;

    let plan = await prestamosService.getPaymentPlan(prestamo.id);
    if (!plan) {
      plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
    }

    const existentes = await gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ejercicio);

    for (const periodo of plan.periodos) {
      const fechaCargo = new Date(periodo.fechaCargo);
      if (fechaCargo.getFullYear() !== ejercicio || periodo.interes <= 0) continue;
      const mes = fechaCargo.getMonth() + 1;

      const origenId = `prestamo-${prestamo.id}-${ejercicio}-${mes}`;
      const yaExiste = existentes.some(g => g.origenId === origenId);
      if (yaExiste) continue;

      const interesProporcion = Math.round(periodo.interes * factor * 100) / 100;
      if (interesProporcion <= 0) continue;

      const conceptoInt = `Intereses ${prestamo.nombre} — ${MESES[mes - 1]}${factor < 1 ? ` (${porcentaje}%)` : ''}`;

      await gastosInmuebleService.add({
        inmuebleId,
        ejercicio,
        fecha: periodo.fechaCargo,
        concepto: conceptoInt,
        categoria: 'intereses',
        casillaAEAT: '0105',
        importe: interesProporcion,
        origen: 'prestamo',
        origenId,
        estado: 'previsto',
        proveedorNombre: prestamo.nombre || undefined,
      });
      creadas += 1;
    }
  }

  return creadas;
}

export async function limpiarDuplicadosRecurrentes(
  inmuebleId: number,
  ejercicio: number
): Promise<number> {
  const gastos = await gastosInmuebleService.getByInmuebleYEjercicio(inmuebleId, ejercicio);
  const recurrentes = gastos.filter(g => g.origen === 'recurrente' || g.origen === 'prestamo');

  const seen = new Map<string, number>();
  const toDelete: number[] = [];

  for (const g of recurrentes) {
    if (g.id == null) continue;
    // El mes se lee del TEXTO, no con `Date`. Una fecha imposible como
    // `2026-02-31` no da error al parsearla: rueda al 3 de marzo, y entonces
    // esta clave creía que una línea de febrero era de marzo — justo en los
    // registros que el bug de la fecha había estropeado.
    const mes = mesDeISO(g.fecha);
    const key = `${g.origenId ?? 'null'}-${g.casillaAEAT}-${mes}`;
    if (!seen.has(key)) {
      seen.set(key, g.id);
    } else {
      toDelete.push(g.id);
    }
  }

  for (const id of toDelete) {
    await gastosInmuebleService.delete(id);
  }

  return toDelete.length;
}

export async function limpiarTodosDuplicadosEjercicio(ejercicio: number): Promise<number> {
  const db = await initDB();
  const properties = await db.getAll('properties');
  let totalEliminados = 0;

  for (const prop of properties) {
    if (!prop.id) continue;
    const eliminados = await limpiarDuplicadosRecurrentes(prop.id, ejercicio);
    if (eliminados > 0) {
      console.log(`Inmueble ${prop.alias || prop.id}: ${eliminados} duplicados eliminados`);
    }
    totalEliminados += eliminados;
  }

  console.log(`Total duplicados eliminados para ${ejercicio}: ${totalEliminados}`);
  return totalEliminados;
}
