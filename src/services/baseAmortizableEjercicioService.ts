// V82 · TAREA CC · Bloque B · Base amortizable POR EJERCICIO
//
// La base amortizable pasa de ser el campo único del inmueble
// (`aeatAmortization.baseAmortizacion`, last-write-wins) a un dato por
// (inmueble · ejercicio) con procedencia. Fuente de verdad = la casilla 0130
// declarada de cada año (decisión Jose · P1). Reglas:
//   1. El import escribe SOLO la base del año que importa (`upsertBaseEjercicio`).
//   2. La paralela sobrescribe SOLO la del año corregido (`aplicarCorreccionParalela`).
//   3. Una corrección (`paralela`) no se pisa por un re-import de XML (rule 3).
//   4. Si un ejercicio no tiene base propia, hereda la del anterior EN LECTURA,
//      sin inventar filas (`getBaseParaCalculo`).
//   · Un año en `conflicto` (0130 del año ≠ campo único = huella de paralela) no
//     se usa para calcular hasta resolverse: `getBaseParaCalculo` lo marca
//     `bloqueado: true`.
//
// Este módulo es SOLO el modelo + migración (Bloque B). Los motores que leen la
// base (Bloque C) consumirán `getBaseParaCalculo`; aquí no se cambia ninguno.

import type { IDBPDatabase } from 'idb';
import { initDB } from './db';
import type { AtlasHorizonDB } from './db';
import type {
  BaseAmortizableEjercicio,
  BaseAmortizableOrigen,
  GastoInmueble,
  Property,
} from './db';

const EPS = 0.005;
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Resultado de resolver la base de un ejercicio para un cálculo (Bloque C). */
export interface BaseParaCalculo {
  /** Base amortizable a usar, o `null` si no hay dato utilizable. */
  base: number | null;
  origen: BaseAmortizableOrigen;
  /** `true` → el cálculo debe declararse bloqueado y NO devolver una cifra firme. */
  bloqueado: boolean;
  /** `true` → la base proviene de herencia/campo único sin verificar. */
  heredada: boolean;
  /** Si se heredó, de qué ejercicio salió la base. */
  ejercicioFuente?: number;
}

type DB = IDBPDatabase<AtlasHorizonDB>;

const sortByEjercicioAsc = (a: BaseAmortizableEjercicio, b: BaseAmortizableEjercicio) =>
  a.ejercicio - b.ejercicio;

export const baseAmortizableEjercicioService = {
  async getPorInmueble(inmuebleId: number): Promise<BaseAmortizableEjercicio[]> {
    const db = await initDB();
    const rows = await db.getAllFromIndex('baseAmortizableEjercicio', 'inmuebleId', inmuebleId);
    return (rows as BaseAmortizableEjercicio[]).sort(sortByEjercicioAsc);
  },

  async getPorInmuebleYEjercicio(
    inmuebleId: number,
    ejercicio: number,
  ): Promise<BaseAmortizableEjercicio | undefined> {
    const db = await initDB();
    const row = await db.getFromIndex('baseAmortizableEjercicio', 'inmueble-ejercicio', [
      inmuebleId,
      ejercicio,
    ]);
    return row as BaseAmortizableEjercicio | undefined;
  },

  /**
   * Escribe la base de UN ejercicio (regla 1: el import escribe solo su año).
   * Protege las correcciones: si ya existe una fila `paralela` para ese año, un
   * re-import de XML NO la pisa (regla 3 · la corrección manda).
   */
  async upsertBaseEjercicio(
    inmuebleId: number,
    ejercicio: number,
    base: number,
    origen: BaseAmortizableOrigen = 'xml',
    extras: Partial<Pick<BaseAmortizableEjercicio, 'baseDeclarada' | 'baseCampoUnico' | 'actaRef' | 'fechaActa'>> = {},
  ): Promise<BaseAmortizableEjercicio> {
    const db = await initDB();
    const now = new Date().toISOString();
    const existing = await this.getPorInmuebleYEjercicio(inmuebleId, ejercicio);

    // Regla 3: una corrección de inspección no se pisa por un re-import de XML.
    if (existing && existing.origen === 'paralela' && origen === 'xml') {
      return existing;
    }

    const base2 = round2(base);
    if (existing) {
      const updated: BaseAmortizableEjercicio = {
        ...existing,
        base: base2,
        origen,
        baseDeclarada: extras.baseDeclarada ?? existing.baseDeclarada,
        baseCampoUnico: extras.baseCampoUnico ?? existing.baseCampoUnico,
        actaRef: extras.actaRef ?? existing.actaRef,
        fechaActa: extras.fechaActa ?? existing.fechaActa,
        updatedAt: now,
      };
      await db.put('baseAmortizableEjercicio', updated);
      return updated;
    }

    const row: BaseAmortizableEjercicio = {
      inmuebleId,
      ejercicio,
      base: base2,
      origen,
      baseDeclarada: extras.baseDeclarada,
      baseCampoUnico: extras.baseCampoUnico,
      actaRef: extras.actaRef,
      fechaActa: extras.fechaActa,
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.add('baseAmortizableEjercicio', row);
    return { ...row, id: id as number };
  },

  /**
   * Aplica una corrección de inspección al año corregido (regla 2), sobrescribiendo
   * SOLO ese año y dejando trazabilidad (`reemplazaA`, `actaRef`). Resuelve el
   * `conflicto` de ese año.
   */
  async aplicarCorreccionParalela(
    inmuebleId: number,
    ejercicio: number,
    base: number,
    actaRef?: string,
    fechaActa?: string,
  ): Promise<BaseAmortizableEjercicio> {
    const db = await initDB();
    const now = new Date().toISOString();
    const existing = await this.getPorInmuebleYEjercicio(inmuebleId, ejercicio);
    const base2 = round2(base);
    const row: BaseAmortizableEjercicio = {
      ...(existing ?? { inmuebleId, ejercicio, createdAt: now }),
      inmuebleId,
      ejercicio,
      base: base2,
      origen: 'paralela',
      actaRef,
      fechaActa,
      reemplazaA: existing?.base,
      updatedAt: now,
    } as BaseAmortizableEjercicio;
    if (existing?.id != null) {
      await db.put('baseAmortizableEjercicio', row);
      return row;
    }
    const id = await db.add('baseAmortizableEjercicio', row);
    return { ...row, id: id as number };
  },

  /**
   * Resuelve la base a usar en un cálculo del ejercicio dado (Bloque C).
   *  · fila propia no-conflicto → esa base.
   *  · fila propia en conflicto → bloqueado (no devuelve cifra firme).
   *  · sin fila → hereda del ejercicio anterior resuelto (no de un conflicto),
   *    sin inventar filas; si no hay, cae al campo único del inmueble como
   *    `heredada` sin verificar; si tampoco, bloqueado.
   */
  async getBaseParaCalculo(
    inmuebleId: number,
    ejercicio: number,
    property?: Property | null,
  ): Promise<BaseParaCalculo> {
    const row = await this.getPorInmuebleYEjercicio(inmuebleId, ejercicio);
    if (row) {
      if (row.origen === 'conflicto') {
        return { base: row.base, origen: 'conflicto', bloqueado: true, heredada: false };
      }
      return {
        base: row.base,
        origen: row.origen,
        bloqueado: false,
        heredada: row.origen === 'heredada',
      };
    }

    // Herencia en lectura: ejercicio anterior más cercano que NO esté en conflicto.
    const rows = await this.getPorInmueble(inmuebleId);
    const prev = rows
      .filter((r) => r.ejercicio < ejercicio && r.origen !== 'conflicto')
      .sort((a, b) => b.ejercicio - a.ejercicio)[0];
    if (prev) {
      return {
        base: prev.base,
        origen: 'heredada',
        bloqueado: false,
        heredada: true,
        ejercicioFuente: prev.ejercicio,
      };
    }

    // Fallback: campo único del inmueble (sin verificar).
    const campoUnico = property?.aeatAmortization?.baseAmortizacion;
    if (typeof campoUnico === 'number' && campoUnico > 0) {
      return { base: round2(campoUnico), origen: 'heredada', bloqueado: false, heredada: true };
    }

    return { base: null, origen: 'heredada', bloqueado: true, heredada: true };
  },
};

/**
 * Migración V82 (POST-open, idempotente vía flag en el llamador).
 * Siembra la base por ejercicio desde la casilla 0130 declarada de cada año y
 * marca `conflicto` los años cuyo 0130 difiere del campo único del inmueble
 * (huella de una paralela). No inventa filas para años sin 0130. Idempotente:
 * no re-siembra un (inmueble·ejercicio) que ya tenga fila.
 *
 * @returns número de filas sembradas.
 */
export async function migrarBaseAmortizableEjercicio(db: DB): Promise<number> {
  const now = new Date().toISOString();
  const props = (await db.getAll('properties')) as Property[];
  let sembradas = 0;

  for (const p of props) {
    if (p?.id == null) continue;
    const inmuebleId = p.id as number;
    const campoUnico = p.aeatAmortization?.baseAmortizacion;

    // casillas 0130 (base amortizable declarada) del inmueble, una por ejercicio.
    const gastos = (await db.getAllFromIndex(
      'gastosInmueble',
      'inmuebleId',
      inmuebleId,
    )) as GastoInmueble[];
    const base0130: Map<number, number> = new Map();
    const base0130Id: Map<number, number> = new Map();
    for (const g of gastos) {
      if (g.casillaAEAT !== '0130') continue;
      const imp = Number(g.importe) || 0;
      if (imp <= 0) continue;
      // Si hubiera varias 0130 del mismo año (re-imports), gana la de id mayor
      // (comparación explícita contra el id ganador · no depende del orden del array).
      const gid = Number(g.id ?? 0);
      const prevId = base0130Id.get(g.ejercicio);
      if (prevId === undefined || gid >= prevId) {
        base0130.set(g.ejercicio, imp);
        base0130Id.set(g.ejercicio, gid);
      }
    }

    for (const [ejercicio, baseDeclarada] of base0130) {
      const existente = await db.getFromIndex('baseAmortizableEjercicio', 'inmueble-ejercicio', [
        inmuebleId,
        ejercicio,
      ]);
      if (existente) continue; // idempotente

      const enConflicto =
        typeof campoUnico === 'number' && Math.abs(baseDeclarada - campoUnico) > EPS;

      const row: BaseAmortizableEjercicio = {
        inmuebleId,
        ejercicio,
        base: round2(baseDeclarada),
        origen: enConflicto ? 'conflicto' : 'xml',
        baseDeclarada: round2(baseDeclarada),
        baseCampoUnico: typeof campoUnico === 'number' ? round2(campoUnico) : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await db.add('baseAmortizableEjercicio', row);
      sembradas += 1;
    }
  }

  return sembradas;
}
