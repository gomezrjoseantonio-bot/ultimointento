// E1.3 · las decisiones de la sesión, persistidas en la línea.
//
// Lo que fija:
//   · que guardar y volver a cargar devuelve EXACTAMENTE la misma sesión, para
//     cualquier combinación de las siete estructuras (ida y vuelta);
//   · que tras un gesto solo se persisten las líneas tocadas;
//   · §29 · ignorar es `atencion: 'silenciada'`: no toca `estado`, ni
//     `movementIds`, ni nada que cuente en el saldo, y es reversible;
//   · que `lotesAMedias` enseña solo lo retomable (sin guardar y con líneas).

import {
  atencionDe,
  cambiosDeDecision,
  comoSeResolvioDe,
  decisionDeLinea,
  decisionesDesdeFilas,
  guardarDecisionDeLinea,
  lotesAMedias,
  mismaDecision,
} from '../decisionesPersistidas';
import { decisionesVacias, type DecisionesSesion } from '../extractoSesion';
import { initDB } from '../../../../services/db';
import type { LineaExtractoPersistida } from '../../../../services/db';

jest.mock('../../../../services/db', () => ({ initDB: jest.fn() }));

const AHORA = '2026-09-04T10:00:00.000Z';

const fila = (id: number, over: Partial<LineaExtractoPersistida> = {}): LineaExtractoPersistida => ({
  id,
  fechaOperacion: '2026-08-05',
  fechaValor: '2026-08-05',
  importe: -50,
  conceptoLiteral: `LINEA ${id}`,
  importBatchId: 'import_a',
  accountId: 7,
  hashLinea: `v1:h${id}`,
  hashMovement: `7|2026-08-05|-5000|LINEA ${id}`,
  estado: 'resuelta',
  movementIds: [id * 10],
  createdAt: AHORA,
  updatedAt: AHORA,
  ...over,
});

function sesionCompleta(): DecisionesSesion {
  const d = decisionesVacias();
  d.asignados.set(101, 5);
  d.ignorados.add(102);
  d.creados.add(103);
  d.recuperados.add(104);
  d.aEfectivo.add(105);
  d.aTraspaso.set(106, 9);
  d.desemparejados.add(107);
  // Combinaciones que la sesión permite y hay que conservar tal cual.
  d.recuperados.add(102); // recuperada y vuelta a ignorar
  d.creados.add(101); // creada y además asignada
  d.desemparejados.add(105); // «no es esto» y luego efectivo
  return d;
}

describe('ida y vuelta · guardar y cargar devuelve la misma sesión', () => {
  it('cada línea se serializa con TODAS sus marcas, y sin marcas es undefined', () => {
    const d = sesionCompleta();
    expect(decisionDeLinea(d, 101, AHORA)).toEqual({ asignadoA: 5, creada: true, decididaAt: AHORA });
    expect(decisionDeLinea(d, 102, AHORA)).toEqual({ ignorada: true, recuperada: true, decididaAt: AHORA });
    expect(decisionDeLinea(d, 105, AHORA)).toEqual({ aEfectivo: true, desemparejada: true, decididaAt: AHORA });
    expect(decisionDeLinea(d, 106, AHORA)).toEqual({ traspasoA: 9, decididaAt: AHORA });
    expect(decisionDeLinea(d, 999, AHORA)).toBeUndefined();
  });

  it('decisionesDesdeFilas(decisionDeLinea(d)) ≡ d · para las siete estructuras y sus combinaciones', () => {
    const d = sesionCompleta();
    const filas = [101, 102, 103, 104, 105, 106, 107, 108].map((id) =>
      fila(id, { decision: decisionDeLinea(d, id, AHORA) })
    );
    const vuelta = decisionesDesdeFilas(filas);
    expect(vuelta).toEqual(d);
    // Y la línea sin decisión (108) no ha metido nada.
    expect([...vuelta.ignorados, ...vuelta.creados]).not.toContain(108);
  });

  it('una fila sin id o sin decisión no aporta nada', () => {
    const vuelta = decisionesDesdeFilas([
      { id: undefined, decision: { ignorada: true, decididaAt: AHORA } },
      { id: 5, decision: undefined },
    ]);
    expect(vuelta).toEqual(decisionesVacias());
  });
});

describe('tras un gesto · solo se persisten las líneas tocadas', () => {
  it('ignorar una línea produce UN cambio con su decisión', () => {
    const antes = decisionesVacias();
    const despues = decisionesVacias();
    despues.ignorados.add(102);
    expect(cambiosDeDecision(antes, despues, AHORA)).toEqual([
      { lineaId: 102, decision: { ignorada: true, decididaAt: AHORA } },
    ]);
  });

  it('deshacer produce el cambio con decisión undefined · para borrarla de la fila', () => {
    const antes = decisionesVacias();
    antes.aEfectivo.add(105);
    const despues = decisionesVacias();
    expect(cambiosDeDecision(antes, despues, AHORA)).toEqual([{ lineaId: 105, decision: undefined }]);
  });

  it('cambiar la cuenta de un traspaso es un cambio · repetir el mismo gesto no lo es', () => {
    const a = decisionesVacias();
    a.aTraspaso.set(106, 9);
    const b = decisionesVacias();
    b.aTraspaso.set(106, 11);
    expect(cambiosDeDecision(a, b, AHORA)).toHaveLength(1);
    expect(cambiosDeDecision(a, a, AHORA)).toEqual([]);
    expect(mismaDecision({ traspasoA: 9, decididaAt: 'x' }, { traspasoA: 9, decididaAt: 'y' })).toBe(true);
  });

  it('un gesto en bloque toca sus N líneas y ninguna más', () => {
    const antes = decisionesVacias();
    antes.asignados.set(101, 5);
    const despues = decisionesVacias();
    despues.asignados.set(101, 5);
    for (const id of [102, 103, 104]) despues.ignorados.add(id);
    expect(cambiosDeDecision(antes, despues, AHORA).map((c) => c.lineaId).sort()).toEqual([102, 103, 104]);
  });
});

describe('§29 · ignorar silencia el recordatorio · no es un estado de dinero', () => {
  it('ignorada → silenciada · recuperada → recordar · sin decisión → nada', () => {
    expect(atencionDe({ ignorada: true, decididaAt: AHORA })).toBe('silenciada');
    expect(atencionDe({ recuperada: true, decididaAt: AHORA })).toBe('recordar');
    expect(atencionDe({ ignorada: true, recuperada: true, decididaAt: AHORA })).toBe('silenciada');
    expect(atencionDe(undefined)).toBeUndefined();
    expect(atencionDe({ asignadoA: 5, decididaAt: AHORA })).toBeUndefined();
  });

  it('lo resuelto con la mano se anota como a_mano · ignorar o desemparejar no resuelven', () => {
    expect(comoSeResolvioDe({ asignadoA: 5, decididaAt: AHORA })).toBe('a_mano');
    expect(comoSeResolvioDe({ creada: true, decididaAt: AHORA })).toBe('a_mano');
    expect(comoSeResolvioDe({ aEfectivo: true, decididaAt: AHORA })).toBe('a_mano');
    expect(comoSeResolvioDe({ traspasoA: 9, decididaAt: AHORA })).toBe('a_mano');
    expect(comoSeResolvioDe({ ignorada: true, decididaAt: AHORA })).toBeUndefined();
    expect(comoSeResolvioDe({ desemparejada: true, decididaAt: AHORA })).toBeUndefined();
  });

  it('guardar «ignorada» en la fila NO toca estado, movementIds ni el crudo · y es reversible', async () => {
    const filas = new Map<number, LineaExtractoPersistida>([[102, fila(102)]]);
    (initDB as jest.Mock).mockResolvedValue({
      get: async (_s: string, id: number) => filas.get(id),
      put: async (_s: string, row: LineaExtractoPersistida) => {
        filas.set(row.id as number, row);
        return row.id;
      },
    });

    await guardarDecisionDeLinea(102, { ignorada: true, decididaAt: AHORA }, '2026-09-04T11:00:00.000Z');
    const tras = filas.get(102)!;
    expect(tras.atencion).toBe('silenciada');
    expect(tras.decision).toEqual({ ignorada: true, decididaAt: AHORA });
    expect(tras.comoSeResolvio).toBeUndefined();
    // Lo que cuenta en el saldo y lo que escribió el banco, intactos.
    expect(tras.estado).toBe('resuelta');
    expect(tras.movementIds).toEqual([1020]);
    expect(tras.conceptoLiteral).toBe('LINEA 102');
    expect(tras.importe).toBe(-50);
    expect(tras.updatedAt).toBe('2026-09-04T11:00:00.000Z');

    // Reversible · deshacer borra la decisión y la atención.
    await guardarDecisionDeLinea(102, undefined);
    const deshecha = filas.get(102)!;
    expect(deshecha.decision).toBeUndefined();
    expect(deshecha.atencion).toBeUndefined();
    expect(deshecha.movementIds).toEqual([1020]);

    // Y clasificarla después la deja a_mano.
    await guardarDecisionDeLinea(102, { creada: true, decididaAt: AHORA });
    expect(filas.get(102)!.comoSeResolvio).toBe('a_mano');
    expect(filas.get(102)!.atencion).toBeUndefined();
  });

  it('guardar sobre una línea que no existe revienta · no se inventa una fila', async () => {
    (initDB as jest.Mock).mockResolvedValue({ get: async () => undefined, put: jest.fn() });
    await expect(guardarDecisionDeLinea(999, { ignorada: true, decididaAt: AHORA })).rejects.toThrow(/999/);
  });
});

describe('lotesAMedias · solo lo retomable', () => {
  it('sin guardar y con líneas con movimiento · con el recuento de decididas · del más reciente al más antiguo', async () => {
    const batches = [
      { id: 'import_viejo', filename: 'marzo.xlsx', accountId: 7, timestampImport: '2026-03-01T10:00:00.000Z' },
      { id: 'import_nuevo', filename: 'agosto.xlsx', accountId: 7, timestampImport: '2026-08-30T10:00:00.000Z' },
      { id: 'import_guardado', filename: 'julio.xlsx', accountId: 7, timestampImport: '2026-07-01T10:00:00.000Z', consolidadoAt: '2026-07-01T11:00:00.000Z' },
      { id: 'import_preV91', filename: 'enero.xlsx', accountId: 7, timestampImport: '2026-01-01T10:00:00.000Z' },
      { id: 'import_solo_descartes', filename: 'dup.xlsx', accountId: 7, timestampImport: '2026-08-31T10:00:00.000Z' },
    ];
    const lineas: LineaExtractoPersistida[] = [
      fila(1, { importBatchId: 'import_viejo' }),
      fila(2, { importBatchId: 'import_viejo', decision: { ignorada: true, decididaAt: AHORA } }),
      fila(3, { importBatchId: 'import_nuevo', decision: { asignadoA: 5, decididaAt: AHORA } }),
      fila(4, { importBatchId: 'import_guardado', decision: { ignorada: true, decididaAt: AHORA } }),
      fila(5, { importBatchId: 'import_solo_descartes', movementIds: [], descarte: 'duplicada', estado: 'sin_procesar' }),
    ];
    (initDB as jest.Mock).mockResolvedValue({
      getAll: async (store: string) => (store === 'importBatches' ? batches : lineas),
    });

    const lotes = await lotesAMedias();
    expect(lotes.map((l) => l.importBatchId)).toEqual(['import_nuevo', 'import_viejo']);
    expect(lotes[0]).toMatchObject({ filename: 'agosto.xlsx', accountId: 7, lineas: 1, decididas: 1 });
    expect(lotes[1]).toMatchObject({ filename: 'marzo.xlsx', lineas: 2, decididas: 1 });
  });

  it('usa el índice importBatchId cuando el handle lo ofrece', async () => {
    const getAllFromIndex = jest.fn(async () => [fila(1, { importBatchId: 'import_x' })]);
    (initDB as jest.Mock).mockResolvedValue({
      getAll: async () => [{ id: 'import_x', filename: 'x.xlsx', accountId: 7, timestampImport: AHORA }],
      getAllFromIndex,
    });
    const lotes = await lotesAMedias();
    expect(getAllFromIndex).toHaveBeenCalledWith('lineasExtracto', 'importBatchId', 'import_x');
    expect(lotes).toHaveLength(1);
  });
});
