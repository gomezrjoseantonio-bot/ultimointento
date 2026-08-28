// ============================================================================
// B9 · corregir el ciclo no puede tirar el trabajo pendiente
// ============================================================================
//
// Al editar un gasto recurrente las previsiones se regeneran, y el borrado
// previo no miraba la fecha: se llevaba también los VENCIDOS (lo que ya debería
// haber salido y sigue sin puntear). El motor solo proyecta desde el mes en
// curso hacia delante, así que no volvían nunca — el pendiente desaparecía sin
// que nadie lo hubiera decidido.
//
// La regla que se fija aquí es la del propio ciclo, aplicada también hacia
// atrás: el vencido de un mes que el nuevo ciclo YA NO contempla se limpia (era
// una predicción falsa), y el de un mes que SÍ contempla se conserva.
import 'fake-indexeddb/auto';
import { initDB } from '../../db';
import type { TreasuryEvent } from '../../db';
import { crearCompromiso, actualizarCompromiso } from '../compromisosRecurrentesService';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';

const base = (over: Partial<CompromisoRecurrente> = {}): Omit<
  CompromisoRecurrente,
  'id' | 'createdAt' | 'updatedAt'
> =>
  ({
    ambito: 'personal',
    personalDataId: 1,
    alias: 'Comunidad',
    tipo: 'suministro',
    proveedor: { nombre: 'Fincas SL' },
    patron: { tipo: 'mensualDiaFijo', dia: 5 },
    importe: { modo: 'fijo', importe: 60 },
    cuentaCargo: 7,
    conceptoBancario: 'FINCAS',
    metodoPago: 'domiciliacion',
    categoria: 'personal.vivienda',
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    fechaInicio: '2020-01-01',
    estado: 'activo',
    ...over,
  }) as unknown as Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>;

/** Mes de hoy menos `n`, como `{ año, mes }` (mes 1-12). */
function mesAtras(n: number): { año: number; mes: number } {
  const h = new Date();
  const d = new Date(h.getFullYear(), h.getMonth() - n, 1);
  return { año: d.getFullYear(), mes: d.getMonth() + 1 };
}

const iso = ({ año, mes }: { año: number; mes: number }, dia = 5) =>
  `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/** Un vencido: la previsión de un mes pasado que sigue sin puntear. */
async function sembrarVencido(
  sourceId: number,
  periodo: { año: number; mes: number },
  over: Partial<TreasuryEvent> = {},
): Promise<void> {
  const db = await initDB();
  await db.add('treasuryEvents', {
    type: 'expense',
    amount: -60,
    predictedDate: iso(periodo),
    description: 'Comunidad',
    sourceType: 'gasto_recurrente',
    sourceId,
    año: periodo.año,
    mes: periodo.mes,
    accountId: 7,
    status: 'predicted',
    certeza: 'estimado',
    createdAt: '',
    updatedAt: '',
    ...over,
  } as TreasuryEvent);
}

async function periodosVivos(sourceId: number): Promise<string[]> {
  const db = await initDB();
  const evs = (await db.getAllFromIndex('treasuryEvents', 'sourceId', sourceId)) as TreasuryEvent[];
  return evs
    .filter((e) => e.sourceType === 'gasto_recurrente')
    .map((e) => `${e.año}-${String(e.mes).padStart(2, '0')}`)
    .sort();
}

beforeEach(async () => {
  const db = await initDB();
  await db.clear('treasuryEvents');
  await db.clear('compromisosRecurrentes');
});

describe('B9 · el nuevo ciclo se aplica también a lo vencido', () => {
  it('mensual→bimensual: el mes que el bimensual no tiene se limpia; los que sí, se conservan', async () => {
    // Tres meses cerrados detrás. El bimensual anclado en el más antiguo
    // contempla el primero y el tercero, pero NO el de en medio.
    const p1 = mesAtras(3);
    const p2 = mesAtras(2);
    const p3 = mesAtras(1);

    const c = await crearCompromiso(base());
    await sembrarVencido(c.id!, p1);
    await sembrarVencido(c.id!, p2);
    await sembrarVencido(c.id!, p3);

    await actualizarCompromiso(c.id!, {
      patron: { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: p1.mes, dia: 5 },
    });

    const vivos = await periodosVivos(c.id!);
    const clave = (p: { año: number; mes: number }) =>
      `${p.año}-${String(p.mes).padStart(2, '0')}`;
    expect(vivos).toContain(clave(p1));
    expect(vivos).toContain(clave(p3));
    expect(vivos).not.toContain(clave(p2));
  });

  it('cambiar el importe no toca los vencidos · el ciclo sigue contemplándolos', async () => {
    const p1 = mesAtras(2);
    const p2 = mesAtras(1);

    const c = await crearCompromiso(base());
    await sembrarVencido(c.id!, p1);
    await sembrarVencido(c.id!, p2);

    await actualizarCompromiso(c.id!, { importe: { modo: 'fijo', importe: 75 } });

    const vivos = await periodosVivos(c.id!);
    expect(vivos).toContain(`${p1.año}-${String(p1.mes).padStart(2, '0')}`);
    expect(vivos).toContain(`${p2.año}-${String(p2.mes).padStart(2, '0')}`);
  });

  it('poner fin en el pasado limpia el vencido posterior y conserva el anterior', async () => {
    const p1 = mesAtras(3);
    const p2 = mesAtras(1);

    const c = await crearCompromiso(base());
    await sembrarVencido(c.id!, p1);
    await sembrarVencido(c.id!, p2);

    // El gasto dejó de cobrarse al final del mes de `p1`.
    await actualizarCompromiso(c.id!, { fechaFin: iso(p1, 28) });

    const vivos = await periodosVivos(c.id!);
    expect(vivos).toContain(`${p1.año}-${String(p1.mes).padStart(2, '0')}`);
    expect(vivos).not.toContain(`${p2.año}-${String(p2.mes).padStart(2, '0')}`);
  });

  it('poner fin en el futuro corta desde ahí y conserva todo lo anterior', async () => {
    // «Deja de cobrarse el» NO es «dar de baja»: el gasto sigue vivo hasta esa
    // fecha. Lo de después se limpia; lo de antes —vencidos incluidos— se
    // queda, porque es de cuando el gasto seguía cobrándose.
    const vencido = mesAtras(1);
    const h = new Date();
    const finMes = new Date(h.getFullYear(), h.getMonth() + 3, 1);
    const fin = { año: finMes.getFullYear(), mes: finMes.getMonth() + 1 };
    const despues = new Date(h.getFullYear(), h.getMonth() + 4, 1);

    const c = await crearCompromiso(base());
    await sembrarVencido(c.id!, vencido);

    await actualizarCompromiso(c.id!, { fechaFin: iso(fin, 28) });

    const vivos = await periodosVivos(c.id!);
    expect(vivos).toContain(`${vencido.año}-${String(vencido.mes).padStart(2, '0')}`);
    expect(vivos).toContain(`${fin.año}-${String(fin.mes).padStart(2, '0')}`);
    expect(vivos).not.toContain(
      `${despues.getFullYear()}-${String(despues.getMonth() + 1).padStart(2, '0')}`,
    );
  });

  it('lo intocable nunca se borra al recalcular · confirmado, conciliado y descartado', async () => {
    // Los tres en el mes de en medio, que el bimensual NO contempla: ni así se
    // tocan. Una previsión confirmada o descartada dejó de ser una previsión.
    const p1 = mesAtras(3);
    const p2 = mesAtras(2);

    const c = await crearCompromiso(base());
    await sembrarVencido(c.id!, p2, { status: 'confirmed' });
    await sembrarVencido(c.id!, p2, { executedMovementId: 501 });
    await sembrarVencido(c.id!, p2, { descartado: true });

    await actualizarCompromiso(c.id!, {
      patron: { tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: p1.mes, dia: 5 },
    });

    const db = await initDB();
    const evs = (await db.getAllFromIndex('treasuryEvents', 'sourceId', c.id!)) as TreasuryEvent[];
    const enP2 = evs.filter((e) => e.año === p2.año && e.mes === p2.mes);
    expect(enP2).toHaveLength(3);
  });
});
