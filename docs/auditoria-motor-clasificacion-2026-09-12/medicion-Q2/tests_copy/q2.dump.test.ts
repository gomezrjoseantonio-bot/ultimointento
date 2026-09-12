// AUDITORÍA Q2 · volcado de la pasada (a) por concepto · temporal
import * as fs from 'fs';
import { clasificarLinea, type ContextoClasificacion } from '../services/clasificacion/clasificarLinea';
import { corpus, movementDe, Q } from './q2.shared';
it('dump (a)', () => {
  const VACIO: ContextoClasificacion = { cuentas: [], tarjetas: [], nombresTitular: [] };
  const agg = new Map<string, { fichero: string; n: number; ej: string; importes: number[]; naturaleza: string; familia?: string; subtipo?: string; metodo?: string; motivo: string }>();
  corpus().forEach((l, i) => {
    const c = clasificarLinea(movementDe(l, i), VACIO);
    const clave = l.fichero + '|' + l.concepto.replace(/\d{2}\/\d{2}\/\d{2,4}/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) + '|' + (l.importe < 0 ? '-' : '+') + '|' + (c.familia ?? '') + '|' + (c.subtipo ?? '');
    const e = agg.get(clave) ?? { fichero: l.fichero, n: 0, ej: l.concepto, importes: [], naturaleza: c.naturaleza, familia: c.familia, subtipo: c.subtipo, metodo: c.metodo, motivo: c.motivos.join(' | ') };
    e.n++; if (e.importes.length < 3) e.importes.push(l.importe);
    agg.set(clave, e);
  });
  const rows = [...agg.values()].sort((a, b) => a.fichero.localeCompare(b.fichero) || (a.familia ?? '~').localeCompare(b.familia ?? '~') || b.n - a.n);
  fs.writeFileSync(Q + 'dump_a.tsv', rows.map((r) => [r.fichero, r.n, r.naturaleza, r.familia ?? '', r.subtipo ?? '', r.metodo ?? '', r.ej.slice(0, 80), r.importes.join(','), r.motivo].join('\t')).join('\n'));
});
