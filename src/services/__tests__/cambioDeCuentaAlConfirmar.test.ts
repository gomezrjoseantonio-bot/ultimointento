// ============================================================================
// Cobrar en otra cuenta no puede contar el dinero dos veces · B13
// ============================================================================
//
// Al confirmar una previsión cambiando la cuenta de cobro, el override viajaba
// a todo menos al propio evento: el movimiento nacía en la cuenta nueva, la
// línea de inmueble también, y hasta el recálculo de saldos miraba las dos —
// pero el `treasuryEvent` se quedaba marcado `executed` en la cuenta VIEJA.
//
// El saldo de una cuenta suma «los eventos comprometidos + los movimientos», y
// para no contar dos veces lo mismo excluye el movimiento de cada evento
// comprometido. Ese apaño solo funciona si los dos están en la misma cuenta:
// con el evento en la 1 y su movimiento en la 2, la cuenta origen sumaba el
// evento, la destino sumaba el movimiento, y la exclusión no llegaba a actuar.
// Medido antes de arreglarlo: 607 € cobrados, 1.214 € de consolidado.
// ============================================================================

import 'fake-indexeddb/auto';
import { initDB, type Account, type Movement, type TreasuryEvent } from '../db';
import { confirmTreasuryEvent } from '../treasuryConfirmationService';
import { calculateAccountBalanceAtDate, corteParaSaldoVivo } from '../accountBalanceService';

const HOY = '2026-09-15';
const ORIGEN = 1;
const DESTINO = 2;

const cuenta = (id: number, alias: string) =>
  ({
    id, iban: `ES910049150005123456789${id}`, alias, status: 'ACTIVE', activa: true,
    openingBalance: 0, openingBalanceDate: '2026-01-01', createdAt: '', updatedAt: '',
  }) as Account;

const PREVISION = {
  type: 'income', amount: 607, predictedDate: '2026-09-01',
  description: 'Alquiler Acevedo 32', accountId: ORIGEN, status: 'predicted',
  sourceType: 'contrato', sourceId: 1, createdAt: '', updatedAt: '',
} as const;

async function sembrar(): Promise<number> {
  const db = await initDB();
  for (const e of (await db.getAll('treasuryEvents')) as TreasuryEvent[]) {
    if (e.id != null) await db.delete('treasuryEvents', e.id);
  }
  for (const m of (await db.getAll('movements')) as Movement[]) {
    if (m.id != null) await db.delete('movements', m.id);
  }
  await db.put('accounts', cuenta(ORIGEN, 'Origen') as never);
  await db.put('accounts', cuenta(DESTINO, 'Destino') as never);
  return (await db.add('treasuryEvents', { ...PREVISION } as never)) as number;
}

/** El saldo vivo de una cuenta · el mismo cálculo que pinta la V6. */
async function saldo(id: number): Promise<number> {
  const db = await initDB();
  const eventos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
  const movs = (await db.getAll('movements')) as Movement[];
  const cuentas = (await db.getAll('accounts')) as Account[];
  return calculateAccountBalanceAtDate({
    account: cuentas.find((c) => c.id === id)!,
    cutoffDate: corteParaSaldoVivo(HOY),
    treasuryEvents: eventos.filter((e) => e.accountId === id),
    movements: movs.filter((m) => m.accountId === id),
    incluirRealesFuturos: true,
  });
}

describe('confirmar cobrando en OTRA cuenta', () => {
  it('el evento se va con su dinero · queda en la cuenta destino', async () => {
    const id = await sembrar();
    await confirmTreasuryEvent(id, { accountId: DESTINO });

    const db = await initDB();
    const ev = (await db.get('treasuryEvents', id)) as TreasuryEvent;
    expect(ev.accountId).toBe(DESTINO);
    expect(ev.status).toBe('executed');
  });

  it('y el movimiento nace ahí mismo · los dos en la misma cuenta', async () => {
    const id = await sembrar();
    const { movementId } = await confirmTreasuryEvent(id, { accountId: DESTINO });

    const db = await initDB();
    const mov = (await db.get('movements', movementId)) as Movement;
    const ev = (await db.get('treasuryEvents', id)) as TreasuryEvent;
    expect(mov.accountId).toBe(DESTINO);
    expect(ev.accountId).toBe(mov.accountId);
  });

  // El caso de Jose, con su cifra: 607 € de alquiler que se cobraron en otra
  // cuenta salían como 1.214 € en el consolidado, que es el KPI de la portada.
  it('EL CASO · 607 cobrados son 607, no 1.214', async () => {
    const id = await sembrar();
    await confirmTreasuryEvent(id, { accountId: DESTINO });

    expect(await saldo(ORIGEN)).toBe(0);
    expect(await saldo(DESTINO)).toBe(607);
    expect((await saldo(ORIGEN)) + (await saldo(DESTINO))).toBe(607);
  });

  it('la línea de la cuenta origen se queda vacía · ahí no se cobró nada', async () => {
    const id = await sembrar();
    await confirmTreasuryEvent(id, { accountId: DESTINO });

    const db = await initDB();
    const eventos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
    const movs = (await db.getAll('movements')) as Movement[];
    expect(eventos.filter((e) => e.accountId === ORIGEN)).toHaveLength(0);
    expect(movs.filter((m) => m.accountId === ORIGEN)).toHaveLength(0);
  });
});

describe('confirmar en la MISMA cuenta · nada cambia', () => {
  it('sin override, el evento conserva su cuenta', async () => {
    const id = await sembrar();
    await confirmTreasuryEvent(id);

    const db = await initDB();
    const ev = (await db.get('treasuryEvents', id)) as TreasuryEvent;
    expect(ev.accountId).toBe(ORIGEN);
    expect(ev.status).toBe('executed');
  });

  it('con el override apuntando a la suya, tampoco', async () => {
    const id = await sembrar();
    await confirmTreasuryEvent(id, { accountId: ORIGEN });

    const db = await initDB();
    const ev = (await db.get('treasuryEvents', id)) as TreasuryEvent;
    expect(ev.accountId).toBe(ORIGEN);
  });

  it('y el saldo sigue contando una sola vez', async () => {
    const id = await sembrar();
    await confirmTreasuryEvent(id);

    expect(await saldo(ORIGEN)).toBe(607);
    expect(await saldo(DESTINO)).toBe(0);
  });
});
