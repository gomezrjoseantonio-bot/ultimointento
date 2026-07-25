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
  totalAnio: { previsto: number; real: number | null };
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

export interface PresupuestoAnual {
  year: number;
  esFuturo: boolean;            // año sin ningún mes cerrado
  mesActualIndex: number;       // 0-11 del último mes con real (−1 si ninguno)
  grupos: FilaGrupo[];
  teQueda: CeldaNeta[];         // 12
  saldoFinMes: CeldaNeta[];     // 12
  residuoReal: number[];        // 12 · real no clasificable (regla 4.3.4)
  tira: TiraResumen;
  pie: string[];                // hasta 3 frases · [] si no hay nada que decir
}

const MESES = 12;
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
      db.getAll('properties') as Promise<Array<{ id?: number; alias?: string }>>,
      db.getAll('property_sales').catch(() => []) as Promise<Array<{ propertyId?: number; saleDate?: string }>>,
      db.getAll('vinculosAccesorio').catch(() => []) as Promise<Array<{ inmuebleAccesorioId?: number }>>,
    ]);
    const accesorios = new Set(vinculos.map((v) => v.inmuebleAccesorioId));
    const vendidos = new Set(
      ventas.filter((v) => v.saleDate && new Date(v.saleDate).getFullYear() <= year).map((v) => v.propertyId),
    );
    const alqCells = g.get('alquileres')!;
    const rentadas = new Set<string>();
    for (const cell of alqCells) for (const d of cell.desglose) if (d.fuente) rentadas.add(d.fuente);
    for (const p of props) {
      if (p.id == null || accesorios.has(p.id) || vendidos.has(p.id)) continue;
      const alias = p.alias ?? `Inmueble ${p.id}`;
      if (rentadas.has(alias)) continue;
      // Fila a cero visible (regla 3): se añade una línea 0 · el pivote la pinta `.cero`.
      alqCells[0].desglose.push({ concepto: `${alias} · sin contrato`, importe: 0, fuente: alias });
    }
  } catch {
    // sin inmuebles legibles → la fila Alquileres queda como esté
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

  const { grupos, comprVacios } = await buildPrevisto(year, anual);
  const real = await buildReal(year);

  // Neto real por mes de getActualData (público vía getComparativaData) para la
  // reconciliación · NO se recalcula, se compara.
  let netoRealOficial: (number | null)[] = Array.from({ length: MESES }, () => null);
  let mesActualIndex = -1;
  try {
    const comp = await comparativaService.getComparativaData({ year, scope: 'consolidado' });
    const monthly = (comp as { monthly?: Array<{ actual?: number; isPast?: boolean; isClosed?: boolean }> }).monthly ?? [];
    netoRealOficial = monthly.map((m) => (typeof m.actual === 'number' ? m.actual : null));
    mesActualIndex = monthly.reduce((acc, m, i) => (m.isPast || m.isClosed ? i : acc), -1);
  } catch {
    // sin comparativa → todos los meses futuros (real null)
  }
  // Fallback del índice de mes cerrado: último mes con algún real agregado.
  if (mesActualIndex < 0) {
    for (let i = 0; i < MESES; i++) {
      const hasReal = real[i].residuo !== 0 || real[i].porGrupo.size > 0;
      if (hasReal) mesActualIndex = i;
    }
  }
  const esCerrado = (i: number): boolean => mesActualIndex >= 0 && i <= mesActualIndex;

  // Volcar el real por grupo en las celdas (solo meses cerrados).
  for (const key of ORDEN) {
    const cells = grupos.get(key)!;
    for (let i = 0; i < MESES; i++) {
      cells[i].real = esCerrado(i) ? (real[i].porGrupo.get(key) ?? 0) : null;
    }
  }
  const residuoReal = real.map((r, i) => (esCerrado(i) ? r.residuo : 0));

  // Construir las FilaGrupo con totales de año y motivo de vacío (regla 1).
  const filas: FilaGrupo[] = ORDEN.map((key) => {
    const cells = grupos.get(key)!;
    const previstoAnio = round2(cells.reduce((s, c) => s + c.previsto, 0));
    const realAnio = cells.some((c) => c.real != null)
      ? round2(cells.reduce((s, c) => s + (c.real ?? 0), 0))
      : null;
    const fila: FilaGrupo = {
      key,
      label: LABELS[key],
      signo: ENTRA.includes(key) ? 'entra' : 'sale',
      desplegable: key !== 'impuestos',
      meses: cells,
      totalAnio: { previsto: previstoAnio, real: realAnio },
    };
    // Filas sin datos → vacías CON motivo (sección 2 · criterio 5).
    const sinPrevisto = previstoAnio === 0 && cells.every((c) => c.desglose.length === 0);
    const sinReal = realAnio == null || realAnio === 0;
    if (sinPrevisto && sinReal) {
      if ((key === 'hogar' || key === 'deseos' || key === 'inmuebles') && comprVacios) {
        fila.vacio = { motivo: 'Sin compromisos recurrentes registrados' };
      } else if (key === 'alquileres') {
        fila.vacio = { motivo: 'Sin contratos activos' };
      } else {
        fila.vacio = { motivo: 'Sin datos registrados' };
      }
    }
    return fila;
  });

  // Te queda / Saldo a fin de mes.
  const teQueda: CeldaNeta[] = [];
  const saldoFinMes: CeldaNeta[] = [];
  let accPrev = 0;
  let accReal = 0;
  for (let i = 0; i < MESES; i++) {
    // Todos los grupos ya vienen firmados (ingreso +, gasto −).
    const netoPrev = round2(filas.reduce((s, f) => s + f.meses[i].previsto, 0));
    const cerrado = esCerrado(i);
    const netoRealCell = cerrado
      ? (netoRealOficial[i] ?? round2(
          filas.reduce((s, f) => s + (f.meses[i].real ?? 0), 0) + residuoReal[i],
        ))
      : null;
    teQueda.push({ previsto: netoPrev, real: netoRealCell });
    accPrev = round2(accPrev + netoPrev);
    accReal = netoRealCell != null ? round2(accReal + netoRealCell) : accReal;
    saldoFinMes.push({ previsto: accPrev, real: cerrado ? accReal : null });
  }

  const tira = buildTira(filas, teQueda, mesActualIndex);
  const pie = buildPie(filas, teQueda, mesActualIndex);

  return {
    year,
    esFuturo: mesActualIndex < 0,
    mesActualIndex,
    grupos: filas,
    teQueda,
    saldoFinMes,
    residuoReal,
    tira,
    pie,
  };
}

// ── La tira superior (sección 4.1) ──
function buildTira(
  filas: FilaGrupo[],
  teQueda: CeldaNeta[],
  mesActualIndex: number,
): TiraResumen {
  const cerrados = mesActualIndex + 1;
  let previstoAcc = 0;
  let realAcc = 0;
  for (let i = 0; i < Math.max(0, cerrados); i++) {
    previstoAcc = round2(previstoAcc + teQueda[i].previsto);
    if (teQueda[i].real != null) realAcc = round2(realAcc + (teQueda[i].real ?? 0));
  }
  const desviacion = round2(realAcc - previstoAcc);

  // Los dos conceptos que más pesan en la desviación: por grupo, real − previsto
  // acumulado hasta el mes cerrado.
  const pesos: LineaDesglose[] = filas.map((f) => {
    let dp = 0;
    let dr = 0;
    for (let i = 0; i < Math.max(0, cerrados); i++) {
      dp += f.meses[i].previsto;       // ya firmado (ingreso +, gasto −)
      dr += f.meses[i].real ?? 0;
    }
    return { concepto: f.label, importe: round2(dr - dp) };
  }).filter((x) => Math.abs(x.importe) >= 0.01)
    .sort((a, b) => Math.abs(b.importe) - Math.abs(a.importe))
    .slice(0, 2);

  // Mes más justo del año (menor "Te queda" previsto).
  let mesMasJusto: { mes: number; teQueda: number } | null = null;
  for (let i = 0; i < MESES; i++) {
    if (mesMasJusto == null || teQueda[i].previsto < mesMasJusto.teQueda) {
      mesMasJusto = { mes: i + 1, teQueda: teQueda[i].previsto };
    }
  }

  const cierrePrevisto = round2(teQueda.reduce((s, c) => s + c.previsto, 0));

  return {
    previstoAcumulado: previstoAcc,
    realAcumulado: realAcc,
    mesesCerrados: Math.max(0, cerrados),
    desviacion,
    desviacionConceptos: pesos,
    mesMasJusto,
    cierreAnio: { previsto: cierrePrevisto, inicioCaja: 0 },
  };
}

// ── El pie de lectura (sección 4.1) · hasta 3 frases · [] si no hay nada ──
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function buildPie(
  filas: FilaGrupo[],
  teQueda: CeldaNeta[],
  mesActualIndex: number,
): string[] {
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

  // Frase 2 · inmuebles sin rentar (unidades a 0 · regla 3).
  const alq = filas.find((f) => f.key === 'alquileres');
  if (alq?.vacio) {
    frases.push('Ninguna unidad tiene contrato activo este año');
  } else if (alq) {
    const conceptos = new Map<string, number>();
    for (const cell of alq.meses) {
      for (const d of cell.desglose) {
        conceptos.set(d.concepto, (conceptos.get(d.concepto) ?? 0) + Math.abs(d.importe));
      }
    }
    const total = conceptos.size;
    const sinRentar = [...conceptos.values()].filter((v) => v < 0.005).length;
    if (total > 0 && sinRentar > 0) {
      frases.push(`${sinRentar} de ${total} ${total === 1 ? 'unidad no renta' : 'unidades no rentan'}`);
    }
  }

  return frases.slice(0, 3);
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
