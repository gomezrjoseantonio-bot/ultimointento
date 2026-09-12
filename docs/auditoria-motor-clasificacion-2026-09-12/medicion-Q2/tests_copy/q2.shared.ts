// AUDITORÍA Q2 · helper temporal · NO forma parte del repo · se borra al terminar.
import * as fs from 'fs';
import type { Movement } from '../services/db';
import type { LineaExtractoPersistida } from '../services/db/types-lineasExtracto';
import type { ClasificacionLinea } from '../services/clasificacion/tipos';
import { estaClasificada } from '../services/clasificacion/clasificada';

export const Q = '/tmp/claude-0/-home-user-ultimointento/b09a8ec1-b131-5948-b88c-6929826bb6b8/scratchpad/q2/';

export interface LineaCorpus {
  fichero: string;
  fecha: string;
  fechaValor?: string;
  concepto: string;
  importe: number;
  referencia1: string;
  referencia2: string;
}

export const FICHEROS = ['santander_pdf', 'sabadell_xls', 'unicaja_pdf', 'unicaja_xls'];
export const CUENTA: Record<string, number> = { santander_pdf: 1, sabadell_xls: 2, unicaja_pdf: 3, unicaja_xls: 3 };

export function corpus(): LineaCorpus[] {
  return JSON.parse(fs.readFileSync(Q + 'corpus.json', 'utf8')) as LineaCorpus[];
}

/** Como `bankParser` (E2.4.2): las columnas de referencia se juntan con « · ». */
export function referenciaDe(l: LineaCorpus): string | undefined {
  const refs = [l.referencia1, l.referencia2].map((r) => (r ?? '').trim()).filter(Boolean);
  return refs.length > 0 ? refs.join(' · ') : undefined;
}

export function movementDe(l: LineaCorpus, i: number): Movement {
  return {
    id: i + 1,
    accountId: CUENTA[l.fichero],
    date: l.fecha,
    valueDate: l.fechaValor || l.fecha,
    amount: l.importe,
    description: l.concepto,
    reference: referenciaDe(l),
    naturaleza: l.importe >= 0 ? 'ingreso' : 'gasto',
    ambito: 'personal',
  } as unknown as Movement;
}

const AHORA = '2026-09-12T00:00:00.000Z';
export function lineaDe(l: LineaCorpus, i: number): LineaExtractoPersistida {
  const id = i + 1;
  return {
    id,
    fechaOperacion: l.fecha,
    fechaValor: l.fechaValor || l.fecha,
    importe: l.importe,
    conceptoLiteral: l.concepto,
    referencia: referenciaDe(l),
    importBatchId: 'lote-q2-' + l.fichero,
    accountId: CUENTA[l.fichero],
    hashLinea: `h-${id}`,
    hashMovement: `m-${id}`,
    estado: 'pendiente',
    movementIds: [],
    createdAt: AHORA,
    updatedAt: AHORA,
  } as unknown as LineaExtractoPersistida;
}

export function pasoDe(c: ClasificacionLinea): string {
  if (!estaClasificada(c)) return 'ninguno';
  return c.naturaleza === 'movimiento_interno' ? `${c.origen.naturaleza}` : `${c.origen.familia}`;
}

export interface Fila { l: LineaCorpus; c: ClasificacionLinea }

export interface Resumen {
  fichero: string;
  total: number;
  clasificadas: number;
  pct: string;
  conFamilia: number;
  interno: number;
  conMetodo: number;
  porPaso: Record<string, number>;
  sinClasificar: Array<{ concepto: string; n: number; importes: string }>;
}

export function resumir(fichero: string, filas: Fila[]): Resumen {
  const porPaso: Record<string, number> = {};
  const sin = new Map<string, { n: number; importes: number[] }>();
  let clasificadas = 0;
  for (const f of filas) {
    const p = pasoDe(f.c);
    porPaso[p] = (porPaso[p] ?? 0) + 1;
    if (p !== 'ninguno') clasificadas++;
    else {
      // agrupar conceptos casi iguales · sin fechas/cifras variables para leerlos
      const clave = f.l.concepto.replace(/\d{2}\/\d{2}\/\d{2,4}/g, '').replace(/\s+/g, ' ').trim().slice(0, 70);
      const e = sin.get(clave) ?? { n: 0, importes: [] };
      e.n++; e.importes.push(f.l.importe);
      sin.set(clave, e);
    }
  }
  const sinClasificar = [...sin.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([concepto, e]) => ({ concepto, n: e.n, importes: e.importes.slice(0, 4).join(', ') + (e.importes.length > 4 ? ', …' : '') }));
  return {
    fichero,
    total: filas.length,
    clasificadas,
    pct: filas.length ? ((100 * clasificadas) / filas.length).toFixed(1) + '%' : '-',
    conFamilia: filas.filter((f) => f.c.familia).length,
    interno: filas.filter((f) => f.c.naturaleza === 'movimiento_interno').length,
    conMetodo: filas.filter((f) => f.c.metodo).length,
    porPaso,
    sinClasificar,
  };
}

export function informe(nombre: string, porFichero: Record<string, Fila[]>): Resumen[] {
  const res = FICHEROS.map((f) => resumir(f, porFichero[f] ?? []));
  const todas = FICHEROS.flatMap((f) => porFichero[f] ?? []);
  res.push(resumir('TOTAL', todas));
  const out: string[] = [`\n##### ${nombre} #####`];
  out.push('fichero        | total | clasif | %      | conFam | interno | conMetodo | por paso');
  for (const r of res) {
    out.push(`${r.fichero.padEnd(14)} | ${String(r.total).padStart(5)} | ${String(r.clasificadas).padStart(6)} | ${r.pct.padStart(6)} | ${String(r.conFamilia).padStart(6)} | ${String(r.interno).padStart(7)} | ${String(r.conMetodo).padStart(9)} | ${JSON.stringify(r.porPaso)}`);
  }
  for (const r of res) {
    if (r.fichero === 'TOTAL') continue;
    out.push(`-- sin clasificar · ${r.fichero} (${r.total - r.clasificadas} líneas, ${r.sinClasificar.length} conceptos distintos):`);
    for (const s of r.sinClasificar) out.push(`   ${String(s.n).padStart(3)}× ${s.concepto}  [${s.importes}]`);
  }
  process.stdout.write(out.join('\n') + '\n');
  fs.writeFileSync(Q + `resultado_${nombre}.json`, JSON.stringify(res, null, 1));
  return res;
}
