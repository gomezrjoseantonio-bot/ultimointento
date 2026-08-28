// ============================================================================
// Un previsto vencido es TRABAJO, no basura
// ============================================================================
//
// El bootstrap barría, en cada pasada, todo `predicted` con fecha anterior al
// primer día del mes en curso. La idea era «forward-only»: la proyección mira
// hacia delante. Pero un cargo previsto para el 30 de septiembre que a día 1 de
// octubre no ha llegado **no es basura**: es un pendiente que sigues esperando,
// y el silencio significa justo eso. Al barrerlo, ATLAS decidía por ti que no
// iba a ocurrir, y encima sin dejar rastro.
//
// Se llevaba también los DESCARTADOS del mes anterior, que son lo contrario:
// la constancia explícita de que algo NO ocurrió. Perderla es volver a
// preguntar por lo mismo el mes que viene.
//
// La pantalla ya contaba con esto. `limiteMeses.ts` dice, literal: «El único
// motivo legítimo para mirar atrás es que quede TRABAJO ahí: un previsto
// vencido sin confirmar» — y `mesMinimo` retrocede hasta el más antiguo. Con la
// purga en medio, eso no podía dispararse nunca.
//
// Estos tests van contra la base de verdad (`fake-indexeddb`), no contra un
// mock: lo que se vigila es qué SOBREVIVE a una pasada real del bootstrap.
// ============================================================================

import 'fake-indexeddb/auto';
import { initDB, type TreasuryEvent } from '../db';
import { regenerateForecastsForward } from '../treasuryBootstrapService';
import { esPendiente } from '../tesoreriaV6Metrics';
import { mesMinimo } from '../../modules/tesoreria/v6/limiteMeses';

const hoy = new Date();
const diaDelMes = (delta: number, dia = 15): string =>
  new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + delta, dia))
    .toISOString()
    .slice(0, 10);

const MES_PASADO = diaDelMes(-1);
const MES_ANTERIOR_AL_PASADO = diaDelMes(-2);
const MES_EN_CURSO = diaDelMes(0, 1);
const MES_QUE_VIENE = diaDelMes(1);

const evento = (over: Partial<TreasuryEvent>): Omit<TreasuryEvent, 'id'> =>
  ({
    type: 'expense',
    amount: -60,
    predictedDate: MES_PASADO,
    description: 'Comunidad',
    accountId: 1,
    status: 'predicted',
    sourceType: 'gasto_recurrente',
    sourceId: 1,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Omit<TreasuryEvent, 'id'>;

/** Siembra los eventos, pasa el bootstrap y devuelve qué queda vivo. */
async function trasElBootstrap(
  eventos: Array<Partial<TreasuryEvent>>,
): Promise<Array<TreasuryEvent | undefined>> {
  const db = await initDB();
  for (const e of (await db.getAll('treasuryEvents')) as TreasuryEvent[]) {
    if (e.id != null) await db.delete('treasuryEvents', e.id);
  }
  const ids: number[] = [];
  for (const e of eventos) ids.push((await db.add('treasuryEvents', evento(e) as never)) as number);

  await regenerateForecastsForward();

  const vivos: Array<TreasuryEvent | undefined> = [];
  for (const id of ids) vivos.push((await db.get('treasuryEvents', id)) as TreasuryEvent | undefined);
  return vivos;
}

// ─── lo que sobrevive ───────────────────────────────────────────────────────

describe('lo que queda vivo tras una pasada del bootstrap', () => {
  it('un PENDIENTE del mes pasado sigue vivo · lo sigues esperando', async () => {
    const [pendiente] = await trasElBootstrap([{ predictedDate: MES_PASADO }]);
    expect(pendiente).toBeDefined();
    expect(pendiente?.status).toBe('predicted');
  });

  // La constancia de «esto no ocurrió» es un dato, no un apunte caducado.
  it('un DESCARTADO del mes pasado sigue vivo · es el rastro', async () => {
    const [descartado] = await trasElBootstrap([
      { predictedDate: MES_PASADO, descartado: true, descartadoAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(descartado).toBeDefined();
    expect(descartado?.descartado).toBe(true);
  });

  it('y uno de hace dos meses, también · no hay fecha de caducidad', async () => {
    const [pendiente, descartado] = await trasElBootstrap([
      { predictedDate: MES_ANTERIOR_AL_PASADO },
      { predictedDate: MES_ANTERIOR_AL_PASADO, descartado: true },
    ]);
    expect(pendiente).toBeDefined();
    expect(descartado).toBeDefined();
  });

  it('el descartado conserva su marca y su motivo', async () => {
    const [d] = await trasElBootstrap([
      { predictedDate: MES_PASADO, descartado: true, motivoDescarte: 'no llegó el recibo' },
    ]);
    expect(d?.motivoDescarte).toBe('no llegó el recibo');
  });

  // Lo de siempre, que no cambia.
  it('un descartado del futuro sigue vivo · ya sobrevivía', async () => {
    const [d] = await trasElBootstrap([{ predictedDate: MES_QUE_VIENE, descartado: true }]);
    expect(d).toBeDefined();
  });

  it('lo CONFIRMADO y lo EJECUTADO del pasado no se tocan', async () => {
    const [confirmado, ejecutado] = await trasElBootstrap([
      { predictedDate: MES_PASADO, status: 'confirmed' as never },
      { predictedDate: MES_PASADO, status: 'executed' as never, executedMovementId: 7 },
    ]);
    expect(confirmado).toBeDefined();
    expect(ejecutado).toBeDefined();
  });
});

// ─── lo que se sigue barriendo ──────────────────────────────────────────────

describe('el barrido hacia delante sigue intacto', () => {
  // Es el que evita duplicar: borra los `predicted` del horizonte para que la
  // regeneración los vuelva a emitir sin dejar dos copias. Sin él, cada pasada
  // añadiría otra tanda.
  it('un `predicted` huérfano del mes en curso se sigue barriendo', async () => {
    const [huerfano] = await trasElBootstrap([{ predictedDate: MES_EN_CURSO }]);
    expect(huerfano).toBeUndefined();
  });

  it('y uno del mes que viene, también', async () => {
    const [huerfano] = await trasElBootstrap([{ predictedDate: MES_QUE_VIENE }]);
    expect(huerfano).toBeUndefined();
  });

  it('pero NO lo confirmado ni lo ejecutado del horizonte', async () => {
    const [confirmado, ejecutado] = await trasElBootstrap([
      { predictedDate: MES_QUE_VIENE, status: 'confirmed' as never },
      { predictedDate: MES_QUE_VIENE, status: 'executed' as never, executedMovementId: 9 },
    ]);
    expect(confirmado).toBeDefined();
    expect(ejecutado).toBeDefined();
  });
});

// ─── que se vea ─────────────────────────────────────────────────────────────

describe('un pendiente atrasado que sobrevive se VE', () => {
  it('cuenta como pendiente · el descartado no', async () => {
    const [pendiente, descartado] = await trasElBootstrap([
      { predictedDate: MES_PASADO },
      { predictedDate: MES_PASADO, descartado: true },
    ]);
    expect(esPendiente(pendiente as TreasuryEvent)).toBe(true);
    expect(esPendiente(descartado as TreasuryEvent)).toBe(false);
  });

  // `mesMinimo` retrocede hasta el mes del pendiente vencido más antiguo. Antes
  // de esto no podía llegar nunca al mes pasado: la purga lo había borrado.
  it('el drawer puede retroceder hasta su mes', async () => {
    const [pendiente] = await trasElBootstrap([{ predictedDate: MES_PASADO }]);
    const hoyIso = new Date().toISOString().slice(0, 10);
    const { year, month0 } = mesMinimo({ eventos: [pendiente as TreasuryEvent], hoy: hoyIso });
    const [y, m] = MES_PASADO.split('-').map(Number);
    expect({ year, month0 }).toEqual({ year: y, month0: m - 1 });
  });

  it('un descartado NO hace retroceder · no queda trabajo ahí', async () => {
    const [descartado] = await trasElBootstrap([{ predictedDate: MES_PASADO, descartado: true }]);
    const hoyIso = new Date().toISOString().slice(0, 10);
    const { year, month0 } = mesMinimo({ eventos: [descartado as TreasuryEvent], hoy: hoyIso });
    expect({ year, month0 }).toEqual({ year: hoy.getUTCFullYear(), month0: hoy.getUTCMonth() });
  });
});
