// PANTALLA-PRESUPUESTO · la vista del año · CAPA DE DATOS
// =====================================================================
// Ensambla los OCHO grupos del presupuesto mes a mes SIN crear modelo nuevo:
//   · Previsto → motor `proyeccionMensualService` (decisión 1 · único con
//     desglose por fila y mes) + los desgloses de las funciones canónicas.
//   · Real por grupo → agregador nuevo (sección 4.3) sobre `treasuryEvents`
//     ejecutados + `movements` conciliados sin evento. NO toca `getActualData`;
//     su neto sigue saliendo de ahí y las sumas por grupo cuadran con él.
//
// Reglas duras aplicadas (sección 5):
//   · Regla 1 · si una cifra no se puede calcular, la fila sale VACÍA con motivo
//     (no cero mudo).
//   · Regla 2 · toda cuota con `prestamoId` o categoría con "hipoteca" vive solo
//     en Deuda; se excluye de su grupo aquí (el dedup de Tesorería no cubre este
//     motor).
//   · Regla 4.3.4 · lo real no clasificable va a un residuo VISIBLE, no se
//     esconde dentro de un grupo.
//
// Ninguna cifra se teclea: todo se lee de lo ya registrado.

import {
  generateProyeccionMensual,
} from '../../horizon/proyeccion/mensual/services/proyeccionMensualService';
import type {
  ProyeccionAnual,
  MonthlyProjectionRow,
} from '../../horizon/proyeccion/mensual/types/proyeccionMensual';
import { comparativaService } from '../../horizon/proyeccion/comparativa/services/comparativaService';
import { personalDataService } from '../../../services/personalDataService';
import { nominaService } from '../../../services/nominaService';
import { autonomoService } from '../../../services/autonomoService';
import { calcularNetoMesNomina } from '../../../services/nominaCalculoService';
import { calcularNetoMesAutonomo } from '../../../services/autonomoCalculoService';
import { listarCompromisos } from '../../../services/personal/compromisosRecurrentesService';
import { gastoPersonalCompromisoEnMes, bolsaForCategoria } from '../../personal/helpers';
import { initDB } from '../../../services/db';
import type { TreasuryEvent, Movement } from '../../../services/db';
import { calculateTotalInitialCash } from '../../../services/accountBalanceService';

export type GrupoKey =
  | 'nomina' | 'autonomo' | 'alquileres'   // ENTRA
  | 'hogar' | 'inmuebles' | 'deuda' | 'impuestos' | 'deseos'; // SALE

export type Signo = 'entra' | 'sale';

export interface LineaDesglose {
  concepto: string;
  importe: number;
  fuente?: string;
}

/** Una celda mes×grupo: previsto siempre; real solo en meses cerrados. */
export interface CeldaGrupo {
  previsto: number;
  real: number | null;          // null → mes aún no cerrado (sin real)
  desglose: LineaDesglose[];    // sublíneas del previsto de ese mes
}

export interface FilaGrupo {
  key: GrupoKey;
  label: string;
  signo: Signo;
  desplegable: boolean;         // Impuestos = false (sección 4.2 · sin chevron)
  meses: CeldaGrupo[];          // 12
  /** Si la fila no tiene datos, sale vacía DICIENDO por qué (regla 1). */
  vacio?: { motivo: string };
}

export interface CeldaNeta { previsto: number; real: number | null; }

export interface TiraResumen {
  previstoAcumulado: number;                 // ahorro previsto hasta el mes actual
  realAcumulado: number;                     // ahorro real hasta el mes actual
  mesesCerrados: number;
  desviacion: number;                        // real − previsto acumulado
  desviacionConceptos: LineaDesglose[];      // los 2 que más pesan
  mesMasJusto: { mes: number; teQueda: number } | null;
  cierreAnio: { previsto: number; inicioCaja: number };
}

export type Modo = 'natural' | 'rodante';

/** El ancla · la observación con fecha del saldo de las cuentas (sección 1.1).
 *  `month` es 0-11. Es la MÁXIMA `openingBalanceDate` de las cuentas activas: el
 *  único instante en que TODAS están observadas, así el total de partida es
 *  completo. `null` si ninguna cuenta tiene fecha de observación. */
export interface Ancla { year: number; month: number; dateISO: string; }

export interface PresupuestoAnual {
  year: number;
  modo: Modo;
  /** El ancla del saldo · `null` si no hay ninguna observación con fecha. */
  ancla: Ancla | null;
  /** Primera columna PINTADA (0-11). En modo natural del año del ancla vale el
   *  mes del ancla (recorte · sección 1.3); en el resto vale 0. */
  desdeMes: number;
  /** Etiqueta de cada columna (12) · en rodante son los meses rodantes. */
  mesLabels: string[];
  /** Etiqueta de la columna de total: «Año» (natural) o «Total 12 meses» (rodante · sección 2). */
  columnaAnioLabel: string;
  /** Índice 0-11 de la columna del mes en curso; −1 si no cae en la vista. Marca
   *  la columna «hoy» (borde oro · sección 1.4). NO recorta el previsto. */
  mesActualIndex: number;
  /** Qué meses están PUNTEADOS en Tesorería (reconciliados). Esta pantalla lo
   *  refleja, no lo decide (sección 1.3). Determina la marca y la cabecera. */
  punteado: boolean[];          // 12
  /** Saldo observado en el ancla · única lectura de cuentas (sección 1.1). */
  saldoPartida: number;
  grupos: FilaGrupo[];
  teQueda: CeldaNeta[];         // 12 · flujo: Total entra − Total sale del mes
  saldoFinMes: CeldaNeta[];     // 12 · stock: escalera desde el saldo de partida
  residuoReal: number[];        // 12 · real no clasificable (regla 4.3.4)
  tira: TiraResumen;
  pie: string[];                // hasta 3 frases · [] si no hay nada que decir
  /** Avisos de acción · meses ya transcurridos y sin puntear (sección 4.5). */
  sinPuntear: string[];
}

const MESES = 12;
const MES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const LABELS: Record<GrupoKey, string> = {
  nomina: 'Nómina',
  autonomo: 'Actividad de autónomo',
  alquileres: 'Alquileres',
  hogar: 'Hogar y familia',
  inmuebles: 'Tus inmuebles',
  deuda: 'Deuda',
  impuestos: 'Impuestos',
  deseos: 'Deseos',
};
const ORDEN: GrupoKey[] = [
  'nomina', 'autonomo', 'alquileres',
  'hogar', 'inmuebles', 'deuda', 'impuestos', 'deseos',
];
const ENTRA: GrupoKey[] = ['nomina', 'autonomo', 'alquileres'];

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const emptyMeses = (): CeldaGrupo[] =>
  Array.from({ length: MESES }, () => ({ previsto: 0, real: null as number | null, desglose: [] }));

/** ¿Una cuota/compromiso pertenece SOLO a Deuda? (regla 2) */
function esDeuda(c: { prestamoId?: unknown; categoria?: string }): boolean {
  if (c.prestamoId != null && c.prestamoId !== 0 && c.prestamoId !== '') return true;
  if (typeof c.categoria === 'string' && c.categoria.toLowerCase().includes('hipoteca')) return true;
  return false;
}

// ── Mapeo bolsa/ámbito → grupo (sección 4.4 · ámbito manda · decisión 3) ──
function grupoDeGastoReal(ev: {
  ambito?: 'PERSONAL' | 'INMUEBLE';
  bolsaPresupuesto?: string;
  categoria?: string;
  prestamoId?: unknown;
}): GrupoKey | 'residuo' {
  if (esDeuda(ev)) return 'deuda';
  if (ev.ambito === 'INMUEBLE') return 'inmuebles';        // ámbito manda (decisión 3)
  const bolsa = ev.bolsaPresupuesto
    ?? (ev.categoria ? bolsaForCategoria(ev.categoria) : undefined);
  switch (bolsa) {
    case 'necesidades': return 'hogar';
    case 'deseos': return 'deseos';
    case 'inmueble': return 'inmuebles';
    case 'obligaciones': return 'impuestos';
    // ahorroInversion no es un grupo (sección 1) → residuo visible
    default: return 'residuo';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PREVISTO · desde el motor + desgloses canónicos
// ─────────────────────────────────────────────────────────────────────────

async function buildPrevisto(
  year: number,
  anual: ProyeccionAnual,
): Promise<{ grupos: Map<GrupoKey, CeldaGrupo[]>; comprVacios: boolean }> {
  const g = new Map<GrupoKey, CeldaGrupo[]>();
  for (const k of ORDEN) g.set(k, emptyMeses());

  const meses: MonthlyProjectionRow[] = anual.months ?? [];

  // Desglose de nómina (bruto·IRPF·SS·plan de pensiones) y autónomo, por mes,
  // desde las funciones canónicas (misma fuente que usa el motor).
  const pd = await personalDataService.getPersonalData();
  const personalDataId = pd?.id ?? 1;
  const nominas = (await nominaService.getNominas(personalDataId)).filter((n) => n.activa);
  const autonomos = (await autonomoService.getAutonomos(personalDataId)).filter((a) => a.activo);

  for (let i = 0; i < MESES; i++) {
    const r = meses[i];
    if (!r) continue;
    const mes = i + 1;

    // ENTRA · Nómina
    const nomCell = g.get('nomina')![i];
    nomCell.previsto = round2(r.ingresos.nomina);
    for (const nom of nominas) {
      const d = calcularNetoMesNomina(nom, mes, year).desglose;
      const bruto = d.pagaNormal + d.variablesAplicables + d.pagaExtra + d.bonusAplicable;
      const pp = d.aportacionPPEmpleado;
      const ss = d.ssEmpleado + d.cuotaSolidaridad;
      if (bruto === 0 && d.irpfRetenido === 0 && ss === 0 && pp === 0) continue;
      nomCell.desglose.push(
        { concepto: 'Bruto', importe: round2(bruto), fuente: nom.nombre },
        { concepto: 'IRPF', importe: round2(-d.irpfRetenido), fuente: nom.nombre },
        { concepto: 'Seguridad Social', importe: round2(-ss), fuente: nom.nombre },
        { concepto: 'Plan de pensiones', importe: round2(-pp), fuente: nom.nombre },
      );
    }

    // ENTRA · Autónomo
    const autCell = g.get('autonomo')![i];
    autCell.previsto = round2(r.ingresos.serviciosFreelance);
    for (const aut of autonomos) {
      const d = calcularNetoMesAutonomo(aut, mes, year).desglose;
      if (d.ingresoMes === 0 && d.cuotaRETA === 0 && d.gastosDeducibles === 0 && d.retencionIRPF === 0) continue;
      autCell.desglose.push(
        { concepto: 'Ingreso', importe: round2(d.ingresoMes) },
        { concepto: 'Cuota RETA', importe: round2(-d.cuotaRETA) },
        { concepto: 'Gastos deducibles', importe: round2(-d.gastosDeducibles) },
        { concepto: 'Retención IRPF', importe: round2(-d.retencionIRPF) },
      );
    }

    // ENTRA · Alquileres (una línea por unidad · motor drillDown)
    const alqCell = g.get('alquileres')![i];
    alqCell.previsto = round2(r.ingresos.rentasAlquiler);
    alqCell.desglose = (r.ingresos.drillDown?.rentasAlquiler ?? []).map((it) => ({
      concepto: it.concepto, importe: round2(it.importe), fuente: it.fuente,
    }));

    // SALE · Tus inmuebles (opex por inmueble+concepto · motor) · signo negativo
    const inmCell = g.get('inmuebles')![i];
    inmCell.previsto = round2(-Math.abs(r.gastos.gastosOperativos));
    inmCell.desglose = (r.gastos.opexDesglose ?? [])
      .filter((it) => !esDeuda({ categoria: (it as { concepto?: string }).concepto }))
      .map((it) => ({
        concepto: (it as { concepto?: string }).concepto ?? 'Gasto inmueble',
        importe: round2(-Math.abs((it as { importe?: number }).importe ?? 0)),
        fuente: (it as { fuente?: string }).fuente,
      }));

    // SALE · Deuda (una línea por préstamo · motor) · signo negativo
    const deuCell = g.get('deuda')![i];
    deuCell.previsto = round2(-Math.abs(r.financiacion.total));
    deuCell.desglose = (r.financiacion.drillDown?.prestamos ?? []).map((it) => ({
      concepto: it.concepto, importe: round2(-Math.abs(it.importe)), fuente: it.fuente,
    }));

    // SALE · Impuestos (escalar · SIN chevron · sección 4.2) · signo negativo
    g.get('impuestos')![i].previsto = round2(-Math.abs(r.gastos.irpf));
  }

  // SALE · Hogar y familia + Deseos · desde compromisos personales, split por
  // bolsa, con exclusión de Deuda (regla 2). El motor suma gastosPersonales pero
  // no separa bolsa; aquí se re-deriva por compromiso.
  const persComp = await listarCompromisos({ ambito: 'personal', soloActivos: true });
  const comprVacios = persComp.length === 0;
  for (const c of persComp) {
    if (esDeuda(c as { prestamoId?: unknown; categoria?: string })) continue; // solo Deuda
    const bolsa = (c as { bolsaPresupuesto?: string }).bolsaPresupuesto
      ?? bolsaForCategoria((c as { categoria?: string }).categoria ?? '');
    const destino: GrupoKey | null =
      bolsa === 'necesidades' ? 'hogar' : bolsa === 'deseos' ? 'deseos' : null;
    if (!destino) continue; // obligaciones/ahorro personal no son Hogar/Deseos
    const cells = g.get(destino)!;
    for (let i = 0; i < MESES; i++) {
      const imp = gastoPersonalCompromisoEnMes(c, year, i);
      if (imp === 0) continue;
      cells[i].previsto = round2(cells[i].previsto - Math.abs(imp)); // gasto = negativo
      cells[i].desglose.push({
        concepto: (c as { nombre?: string; alias?: string }).nombre
          ?? (c as { alias?: string }).alias ?? 'Compromiso',
        importe: round2(-Math.abs(imp)),
      });
    }
  }

  // Regla 3/4/5 · los 8 inmuebles se resuelven: los que no rentan salen a 0
  // DICIENDO que no tienen contrato; los accesorios no aparecen solos (van con su
  // principal); los vendidos quedan fuera desde su fecha de venta.
  try {
    const db = await initDB();
    const [props, ventas, vinculos] = await Promise.all([
      db.getAll('properties') as Promise<Array<{ id?: number; alias?: string; state?: string }>>,
      db.getAll('property_sales').catch(() => []) as Promise<Array<{ propertyId?: number; saleDate?: string }>>,
      db.getAll('vinculosAccesorio').catch(() => []) as Promise<Array<{ inmuebleAccesorioId?: number }>>,
    ]);
    const accesorios = new Set(vinculos.map((v) => v.inmuebleAccesorioId));
    // P4 · vendido/baja se lee de dos fuentes: property_sales (hoy vacío) Y el
    // campo `Property.state` ('vendido'|'baja'). Un inmueble vendido queda fuera.
    const vendidos = new Set(
      ventas.filter((v) => v.saleDate && new Date(v.saleDate).getFullYear() <= year).map((v) => v.propertyId),
    );
    const alqCells = g.get('alquileres')!;
    const rentadas = new Set<string>();
    for (const cell of alqCells) for (const d of cell.desglose) if (d.fuente) rentadas.add(d.fuente);
    for (const p of props) {
      if (p.id == null || accesorios.has(p.id) || vendidos.has(p.id)) continue;
      if (p.state === 'vendido' || p.state === 'baja') continue; // fuera desde la venta (regla 5)
      const alias = p.alias ?? `Inmueble ${p.id}`;
      if (rentadas.has(alias)) continue;
      // Fila a cero visible (regla 3): se añade una línea 0 · el pivote la pinta `.cero`.
      alqCells[0].desglose.push({ concepto: `${alias} · sin contrato`, importe: 0, fuente: alias });
    }
  } catch {
    // sin inmuebles legibles → la fila Alquileres queda como esté
  }

  // Normalización · el previsto del grupo es la SUMA de su desglose (garantiza
  // padre = suma de hijos · criterio 1, y da el neto correcto en autónomo · P7).
  // Impuestos no tiene desglose: conserva el escalar del motor.
  for (const key of ORDEN) {
    if (key === 'impuestos') continue;
    const cells = g.get(key)!;
    for (let i = 0; i < MESES; i++) {
      // Solo si HAY desglose: así el padre cuadra con sus hijos (criterio 1). Si
      // un grupo trae escalar del motor sin drilldown, se conserva ese escalar (no
      // se pisa con 0 · un cálculo válido no se pierde).
      if (cells[i].desglose.length > 0) {
        cells[i].previsto = round2(cells[i].desglose.reduce((s, d) => s + d.importe, 0));
      }
    }
  }

  return { grupos: g, comprVacios };
}

// ─────────────────────────────────────────────────────────────────────────
// REAL POR GRUPO · agregador nuevo (sección 4.3)
// ─────────────────────────────────────────────────────────────────────────

export interface RealMes {
  porGrupo: Map<GrupoKey, number>;
  residuo: number;
}

/** Importe real de un evento ejecutado, con la misma prioridad que getActualData. */
function importeRealEvento(ev: TreasuryEvent, mvById: Map<number, Movement>): number {
  const linkedId = ev.executedMovementId ?? ev.movementId;
  const mv = linkedId != null ? mvById.get(linkedId) : undefined;
  const base = ev.actualAmount ?? (mv ? Math.abs(mv.amount) : Math.abs(ev.amount));
  return Math.abs(base);
}

function grupoDeIngresoReal(ev: TreasuryEvent): GrupoKey | 'residuo' {
  const st = String(ev.sourceType ?? '').toLowerCase();
  if (st.includes('nomina')) return 'nomina';
  if (st.includes('autonomo') || st.includes('freelance')) return 'autonomo';
  if (st.includes('contrato') || st.includes('renta') || st.includes('alquiler')) return 'alquileres';
  return 'residuo';
}

export async function buildReal(year: number): Promise<RealMes[]> {
  const db = await initDB();
  const allEvents = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
  const allMovs = (await db.getAll('movements')) as Movement[];
  const mvById = new Map<number, Movement>();
  for (const m of allMovs) if (m.id != null) mvById.set(m.id as number, m);

  const out: RealMes[] = Array.from({ length: MESES }, () => ({
    porGrupo: new Map<GrupoKey, number>(),
    residuo: 0,
  }));
  const add = (i: number, grp: GrupoKey | 'residuo', val: number) => {
    if (i < 0 || i >= MESES) return;
    if (grp === 'residuo') { out[i].residuo = round2(out[i].residuo + val); return; }
    out[i].porGrupo.set(grp, round2((out[i].porGrupo.get(grp) ?? 0) + val));
  };

  const usados = new Set<number>(); // movements ya atribuidos vía evento

  // 1) Previsiones ejecutadas · el grupo sale de la bolsa/ámbito del evento
  for (const ev of allEvents) {
    if (ev.status !== 'executed') continue;
    if ((ev.año ?? null) !== year) continue;
    const i = (ev.mes ?? 0) - 1;
    const real = importeRealEvento(ev, mvById);
    const linkedId = ev.executedMovementId ?? ev.movementId;
    if (typeof linkedId === 'number') usados.add(linkedId);
    if (ev.type === 'income') {
      add(i, grupoDeIngresoReal(ev), real);          // ingreso = +
    } else {
      const grp = grupoDeGastoReal(ev as unknown as Parameters<typeof grupoDeGastoReal>[0]);
      add(i, grp, -real);                             // gasto/financiación = −
    }
  }

  // 2) Movimientos conciliados SIN evento asociado · inferir bolsa por categoría
  for (const mv of allMovs) {
    if (mv.unifiedStatus !== 'conciliado') continue;
    if (mv.id != null && usados.has(mv.id as number)) continue;
    const d = mv.date ? new Date(mv.date) : null;
    if (!d || d.getFullYear() !== year) continue;
    const i = d.getMonth();
    const amount = mv.amount ?? 0;
    if (amount >= 0) {
      add(i, grupoDeIngresoRealMovimiento(mv), amount);
    } else {
      const grp = grupoDeGastoReal({
        ambito: (mv as { ambito?: 'PERSONAL' | 'INMUEBLE' }).ambito,
        categoria: (mv as { categoria?: string }).categoria,
      });
      add(i, grp, amount);
    }
  }

  return out;
}

function grupoDeIngresoRealMovimiento(mv: Movement): GrupoKey | 'residuo' {
  const cat = String((mv as { categoria?: string }).categoria ?? '').toLowerCase();
  if (cat.includes('nomina') || cat.includes('nómina')) return 'nomina';
  if (cat.includes('autonomo') || cat.includes('autónomo')) return 'autonomo';
  if (cat.includes('alquiler') || cat.includes('renta')) return 'alquileres';
  return 'residuo';
}

// ─────────────────────────────────────────────────────────────────────────
// ENSAMBLADO FINAL
// ─────────────────────────────────────────────────────────────────────────

export async function buildPresupuestoAnual(year: number): Promise<PresupuestoAnual> {
  const proyecciones = await generateProyeccionMensual();
  const anual = proyecciones.find((p) => p.year === year)
    ?? ({ year, months: [] } as unknown as ProyeccionAnual);

  const { grupos } = await buildPrevisto(year, anual);
  const real = await buildReal(year);

  // Punteado (1.3) · un mes está punteado si Tesorería tiene actividad reconciliada
  // ese mes (evento ejecutado o movimiento conciliado). Esta pantalla lo REFLEJA;
  // no decide el cierre. Reemplaza al índice por calendario del código anterior.
  const punteado = real.map((r) => r.porGrupo.size > 0 || r.residuo !== 0);

  // Neto real por mes de getActualData (canónico · NO se toca). Se usa SOLO para
  // el real acumulado de la cabecera; NUNCA para Te queda ni Saldo (eso es flujo /
  // stock del previsto · corrige P2).
  let netoRealOficial: (number | null)[] = Array.from({ length: MESES }, () => null);
  try {
    const comp = await comparativaService.getComparativaData({ year, scope: 'consolidado' });
    const monthly = (comp as { monthly?: Array<{ actual?: number }> }).monthly ?? [];
    // Longitud SIEMPRE 12 (se indexa por mes en buildTira) · aunque `monthly` venga corto.
    netoRealOficial = Array.from({ length: MESES }, (_, i) =>
      typeof monthly[i]?.actual === 'number' ? (monthly[i].actual as number) : null);
  } catch {
    // sin comparativa → cabecera sin real
  }

  // Real por grupo en las celdas · solo meses punteados (el resto no ha pasado · no
  // se rellena con nada).
  for (const key of ORDEN) {
    const cells = grupos.get(key)!;
    for (let i = 0; i < MESES; i++) {
      cells[i].real = punteado[i] ? (real[i].porGrupo.get(key) ?? 0) : null;
    }
  }
  const residuoReal = real.map((r, i) => (punteado[i] ? r.residuo : 0));

  // El ANCLA (sección 1.1) · la observación con fecha del saldo. Recorta la vista:
  // en el año del ancla, la tabla empieza en el mes del ancla (sección 1.3).
  const ancla = await computeAncla();
  const desdeMes = ancla && year === ancla.year ? ancla.month : 0;

  // Mes en curso del calendario · SOLO para marcar la columna «hoy». No recorta el
  // previsto (que está completo de enero a diciembre · corrige P1).
  const now = new Date();
  const mesActualIndex = year === now.getFullYear() ? now.getMonth() : -1;

  // Construir las FilaGrupo con motivo de vacío (regla 1).
  const filas: FilaGrupo[] = ORDEN.map((key) => makeFila(key, grupos.get(key)!));

  // Saldo de PARTIDA · la ÚNICA lectura de cuentas (sección 1.1). En el año del
  // ancla se lee en la FECHA DE LA OBSERVACIÓN (no el 1 de enero · sección 4.1):
  // ese saldo ya contiene todo lo anterior. En años posteriores, el 1 de enero.
  const cutoff = ancla && year === ancla.year ? ancla.dateISO : `${year}-01-01`;
  let saldoPartida = 0;
  try { saldoPartida = round2(await calculateTotalInitialCash(cutoff)); } catch { saldoPartida = 0; }

  // Te queda (FLUJO) + Saldo a fin de mes (STOCK · escalera desde el saldo de
  // partida, que NACE en el mes del ancla · sección 1.4). Ninguna celda lee saldo.
  const { teQueda, saldoFinMes, tira } = ensamblarFlujoStock(
    filas, punteado, residuoReal, netoRealOficial, saldoPartida, desdeMes,
  );
  const pie = buildPie(filas);
  const sinPuntear = buildSinPuntear(year, desdeMes, punteado, now);

  return {
    year,
    modo: 'natural',
    ancla,
    desdeMes,
    mesLabels: MES_ABBR.slice(),
    columnaAnioLabel: 'Año',
    mesActualIndex,
    punteado,
    saldoPartida,
    grupos: filas,
    teQueda,
    saldoFinMes,
    residuoReal,
    tira,
    pie,
    sinPuntear,
  };
}

// ── El ancla · MÁX(openingBalanceDate) de las cuentas activas (sección 1.1) ──
// Es el único instante en que TODAS las cuentas están observadas, así el saldo de
// partida es completo. `null` si ninguna cuenta tiene fecha de observación → la
// escalera cae al comportamiento previo (1 de enero), sin recorte.
async function computeAncla(): Promise<Ancla | null> {
  try {
    const db = await initDB();
    const accounts = (await db.getAll('accounts')) as Array<{
      id?: number; status?: string; activa?: boolean; openingBalanceDate?: string;
    }>;
    const fechas = accounts
      .filter((a) => a.id != null && (a.status === 'ACTIVE' || a.activa))
      .map((a) => a.openingBalanceDate)
      .filter((d): d is string => typeof d === 'string' && d.length >= 7)
      .map((d) => (d.includes('T') ? d.split('T')[0] : d));
    if (fechas.length === 0) return null;
    const maxFecha = fechas.reduce((m, d) => (d > m ? d : m));
    const [y, mo] = maxFecha.split('-').map((n) => parseInt(n, 10));
    if (!Number.isFinite(y) || !Number.isFinite(mo)) return null;
    return { year: y, month: mo - 1, dateISO: maxFecha };
  } catch {
    return null;
  }
}

// ── Motivo de vacío por grupo (regla 1 · criterio 9). Nunca cero mudo ──
function motivoVacio(key: GrupoKey): { motivo: string } {
  if (key === 'hogar' || key === 'deseos') return { motivo: 'Sin compromisos recurrentes registrados' };
  if (key === 'inmuebles') return { motivo: 'Sin gastos de inmueble registrados' };
  if (key === 'alquileres') return { motivo: 'Sin inmuebles ni contratos' };
  if (key === 'impuestos') return { motivo: 'Sin previsión de impuestos calculable' };
  return { motivo: 'Sin datos registrados' };
}

function makeFila(key: GrupoKey, cells: CeldaGrupo[]): FilaGrupo {
  const previstoAnio = round2(cells.reduce((s, c) => s + c.previsto, 0));
  const fila: FilaGrupo = {
    key,
    label: LABELS[key],
    signo: ENTRA.includes(key) ? 'entra' : 'sale',
    desplegable: key !== 'impuestos',
    meses: cells,
  };
  if (previstoAnio === 0 && cells.every((c) => c.desglose.length === 0)) {
    fila.vacio = motivoVacio(key);
  }
  return fila;
}

// ── Flujo (Te queda) + Stock (Saldo) · compartido por natural y rodante ──
// La escalera del saldo SOLO acumula desde `desdeMes` (nace en el ancla · 1.4).
// Los meses anteriores al recorte no se pintan (el componente los omite).
function ensamblarFlujoStock(
  filas: FilaGrupo[],
  punteado: boolean[],
  residuoReal: number[],
  netoRealOficial: (number | null)[],
  saldoPartida: number,
  desdeMes: number,
): { teQueda: CeldaNeta[]; saldoFinMes: CeldaNeta[]; tira: TiraResumen } {
  const teQueda: CeldaNeta[] = [];
  const saldoFinMes: CeldaNeta[] = [];
  let acc = saldoPartida;
  for (let i = 0; i < MESES; i++) {
    const netoPrev = round2(filas.reduce((s, f) => s + f.meses[i].previsto, 0)); // firmado
    const netoReal = punteado[i]
      ? round2(filas.reduce((s, f) => s + (f.meses[i].real ?? 0), 0) + residuoReal[i])
      : null;
    teQueda.push({ previsto: netoPrev, real: netoReal });
    if (i >= desdeMes) acc = round2(acc + netoPrev);   // escalera de PREVISTO (stock)
    saldoFinMes.push({ previsto: i >= desdeMes ? acc : 0, real: null });
  }
  const tira = buildTira(filas, teQueda, punteado, netoRealOficial, saldoPartida, desdeMes);
  return { teQueda, saldoFinMes, tira };
}

// ── Meses ya transcurridos y sin puntear · acción, en TEXTO (sección 4.5) ──
// «marzo lleva cuatro meses sin puntear». Solo meses pintados (>= recorte) que ya
// pasaron por calendario. Si está punteado, no dice nada. En rodante no hay
// transcurridos (empieza en el mes en curso), así que sale vacío.
function buildSinPuntear(
  year: number, desdeMes: number, punteado: boolean[], now: Date,
): string[] {
  const cy = now.getFullYear();
  const cm = now.getMonth();
  const out: string[] = [];
  for (let i = desdeMes; i < MESES; i++) {
    const transcurrido = year < cy || (year === cy && i < cm);
    if (!transcurrido || punteado[i]) continue;
    const n = (cy - year) * 12 + (cm - i);            // meses que lleva sin puntear
    out.push(`${cap(NOMBRE_MES[i])} lleva ${n === 1 ? 'un mes' : `${n} meses`} sin puntear`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// MODO RODANTE · doce meses desde el mes en curso hacia delante (sección 2)
// ─────────────────────────────────────────────────────────────────────────
// Cose dos años naturales y recompone la escalera de forma CONTINUA a través del
// cambio de año. La columna de total se llama «Total 12 meses» (no es año fiscal).
async function buildPresupuestoRodante(): Promise<PresupuestoAnual> {
  const now = new Date();
  const yA = now.getFullYear();
  const startMonth = now.getMonth();
  const yB = yA + 1;

  // Los dos años naturales que cubre la ventana rodante.
  const [a, b] = await Promise.all([buildPresupuestoAnual(yA), buildPresupuestoAnual(yB)]);
  // columna j (0-11) → mes calendario del año A (si startMonth+j<12) o del B.
  const src = (j: number): { p: PresupuestoAnual; m: number; yr: number } => {
    const t = startMonth + j;
    return t < 12 ? { p: a, m: t, yr: yA } : { p: b, m: t - 12, yr: yB };
  };

  // Grupos recompuestos columna a columna (mismas celdas, reordenadas).
  const filas: FilaGrupo[] = ORDEN.map((key) => {
    const gA = a.grupos.find((f) => f.key === key)!;
    const gB = b.grupos.find((f) => f.key === key)!;
    const cells: CeldaGrupo[] = Array.from({ length: MESES }, (_, j) => {
      const { p, m } = src(j);
      return (p === a ? gA : gB).meses[m];
    });
    return makeFila(key, cells);
  });

  const punteado = Array.from({ length: MESES }, (_, j) => { const { p, m } = src(j); return p.punteado[m]; });
  const residuoReal = Array.from({ length: MESES }, (_, j) => { const { p, m } = src(j); return p.residuoReal[m]; });
  // La cabecera usa el real por grupo de las celdas (teQueda.real) · sin comparativa
  // por año cruzado. Se pasa null para que buildTira caiga a teQueda.real.
  const netoRealOficial: (number | null)[] = Array.from({ length: MESES }, () => null);

  // Saldo de partida · observado en el mes en curso (nace aquí · 1.4). Si el mes en
  // curso es el mes del ancla, se lee en la fecha exacta de la observación.
  const ancla = a.ancla;
  const startFirst = `${yA}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const cutoff = ancla && ancla.year === yA && ancla.month === startMonth ? ancla.dateISO : startFirst;
  let saldoPartida = 0;
  try { saldoPartida = round2(await calculateTotalInitialCash(cutoff)); } catch { saldoPartida = 0; }

  // Escalera continua · desdeMes = 0 (las 12 columnas se pintan).
  const { teQueda, saldoFinMes, tira } = ensamblarFlujoStock(
    filas, punteado, residuoReal, netoRealOficial, saldoPartida, 0,
  );

  // Etiquetas de columna rodantes · el año se marca en cada enero (cruce · 2).
  const mesLabels = Array.from({ length: MESES }, (_, j) => {
    const { m, yr } = src(j);
    return m === 0 ? `${MES_ABBR[0]} ${String(yr).slice(2)}` : MES_ABBR[m];
  });

  return {
    year: yA,
    modo: 'rodante',
    ancla,
    desdeMes: 0,
    mesLabels,
    columnaAnioLabel: 'Total 12 meses',
    mesActualIndex: 0,             // la primera columna ES el mes en curso
    punteado,
    saldoPartida,
    grupos: filas,
    teQueda,
    saldoFinMes,
    residuoReal,
    tira,
    pie: buildPie(filas),
    sinPuntear: [],               // rodante empieza en el mes en curso · nada transcurrido
  };
}

/** Punto de entrada único del componente · elige natural o rodante (sección 2). */
export async function buildPresupuesto(opts: { modo: Modo; year: number }): Promise<PresupuestoAnual> {
  return opts.modo === 'rodante' ? buildPresupuestoRodante() : buildPresupuestoAnual(opts.year);
}

// ── La tira superior (sección 4.1) ──
function buildTira(
  filas: FilaGrupo[],
  teQueda: CeldaNeta[],
  punteado: boolean[],
  netoRealOficial: (number | null)[],
  saldoPartida: number,
  desdeMes: number,
): TiraResumen {
  // Las cifras se derivan de la tabla PINTADA; los meses «cerrados» son los
  // PUNTEADOS dentro del recorte, no los que han pasado por calendario (P3 · 1.3).
  const idx = punteado.map((p, i) => (p && i >= desdeMes ? i : -1)).filter((i) => i >= 0);
  let previstoAcc = 0;
  let realAcc = 0;
  for (const i of idx) {
    previstoAcc = round2(previstoAcc + teQueda[i].previsto);
    const r = netoRealOficial[i] ?? teQueda[i].real ?? 0;
    realAcc = round2(realAcc + r);
  }
  const desviacion = round2(realAcc - previstoAcc);

  // Dos conceptos que más pesan (real − previsto por grupo, sobre meses punteados).
  const pesos: LineaDesglose[] = filas.map((f) => {
    let dp = 0;
    let dr = 0;
    for (const i of idx) { dp += f.meses[i].previsto; dr += f.meses[i].real ?? 0; }
    return { concepto: f.label, importe: round2(dr - dp) };
  }).filter((x) => Math.abs(x.importe) >= 0.01)
    .sort((a, b) => Math.abs(b.importe) - Math.abs(a.importe))
    .slice(0, 2);

  // Mes más justo del año (menor "Te queda" previsto) · solo meses pintados.
  let mesMasJusto: { mes: number; teQueda: number } | null = null;
  for (let i = desdeMes; i < MESES; i++) {
    if (mesMasJusto == null || teQueda[i].previsto < mesMasJusto.teQueda) {
      mesMasJusto = { mes: i + 1, teQueda: teQueda[i].previsto };
    }
  }

  // Cierre = saldo final = saldo de partida + Σ Te queda previsto pintado (stock).
  const cierrePrevisto = round2(
    saldoPartida + teQueda.reduce((s, c, i) => (i >= desdeMes ? s + c.previsto : s), 0),
  );

  return {
    previstoAcumulado: previstoAcc,
    realAcumulado: realAcc,
    mesesCerrados: idx.length,
    desviacion,
    desviacionConceptos: pesos,
    mesMasJusto,
    cierreAnio: { previsto: cierrePrevisto, inicioCaja: saldoPartida },
  };
}

// ── El pie de lectura (sección 4.1) · hasta 3 frases · [] si no hay nada ──
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function buildPie(filas: FilaGrupo[]): string[] {
  const frases: string[] = [];

  // Frase 1 · el mes más duro por concentración de gastos de inmueble.
  const inm = filas.find((f) => f.key === 'inmuebles');
  if (inm && !inm.vacio) {
    let peor = -1;
    let peorImp = 0;
    for (let i = 0; i < MESES; i++) {
      const imp = Math.abs(inm.meses[i].previsto);
      if (imp > peorImp) { peorImp = imp; peor = i; }
    }
    if (peor >= 0 && peorImp > 0) {
      const conceptos = inm.meses[peor].desglose
        .filter((d) => d.importe < 0)
        .slice(0, 3)
        .map((d) => d.concepto.toLowerCase());
      if (conceptos.length >= 2) {
        frases.push(`${cap(NOMBRE_MES[peor])} es el mes duro: ${conceptos.join(', ')} caen juntos`);
      }
    }
  }

  // Frase 2 · inmuebles sin rentar · el contador coincide con las LÍNEAS PINTADAS
  // (misma clave `concepto|fuente` que el pivote del componente · corrige P8).
  const alq = filas.find((f) => f.key === 'alquileres');
  if (alq?.vacio) {
    frases.push('Ninguna unidad tiene contrato activo este año');
  } else if (alq) {
    const lineas = new Map<string, number>();
    for (const cell of alq.meses) {
      for (const d of cell.desglose) {
        const k = `${d.concepto}|${d.fuente ?? ''}`;
        lineas.set(k, (lineas.get(k) ?? 0) + Math.abs(d.importe));
      }
    }
    const total = lineas.size;
    const sinRentar = [...lineas.values()].filter((v) => v < 0.005).length;
    if (total > 0 && sinRentar > 0) {
      frases.push(`${sinRentar} de ${total} ${total === 1 ? 'unidad no renta' : 'unidades no rentan'}`);
    }
  }

  return frases.slice(0, 3);
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
