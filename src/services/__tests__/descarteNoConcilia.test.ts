// ============================================================================
// Un descarte no se deshace solo · B12
// ============================================================================
//
// Decir «esto no va a ocurrir» y que el extracto lo deshaga en silencio es la
// peor combinación posible: la previsión descartada seguía siendo candidata al
// conciliar, casaba con el cargo, y quedaba `executed` CON la marca de descarte
// puesta. Un evento así no sale en confirmados (`DrawerCuenta:185`), ni en
// pendientes (`:205`), ni en los KPIs (`tesoreriaV6Metrics:589`) — mientras su
// movimiento sí mueve el saldo. Dinero moviéndose sin nada que lo explique.
//
// Antes se autolimitaba: el descartado del mes pasado lo borraba la purga del
// bootstrap. #1813 hizo que los descartes vivan para siempre, y con ellos el
// fallo.
//
// Dos cierres, no uno: el descartado deja de ofrecerse, y si por cualquier otra
// vía acaba materializándose, la marca se limpia. Un `executed` con marca de
// descarte no puede existir.
// ============================================================================

import 'fake-indexeddb/auto';
import { initDB, type TreasuryEvent, type Movement } from '../db';
import { matchBatch } from '../movementMatchingService';
import { confirmTreasuryEvent } from '../treasuryConfirmationService';
import { esConciliable, sinMarcaDeDescarte } from '../descarteDePrevision';

const PREVISION = {
  type: 'expense', amount: 60, predictedDate: '2026-08-15', description: 'Comunidad',
  accountId: 1, status: 'predicted', sourceType: 'gasto_recurrente', sourceId: 1,
  createdAt: '', updatedAt: '',
} as const;

const CARGO = {
  accountId: 1, date: '2026-09-03', amount: -60, description: 'RECIBO COMUNIDAD',
  unifiedStatus: 'no_planificado', createdAt: '', updatedAt: '',
} as const;

async function limpiar() {
  const db = await initDB();
  for (const e of (await db.getAll('treasuryEvents')) as TreasuryEvent[]) {
    if (e.id != null) await db.delete('treasuryEvents', e.id);
  }
  for (const m of (await db.getAll('movements')) as Movement[]) {
    if (m.id != null) await db.delete('movements', m.id);
  }
}

beforeEach(limpiar);

// ─── las piezas ─────────────────────────────────────────────────────────────

describe('esConciliable · a qué previsión se le puede casar un cargo', () => {
  const ev = (over: Partial<TreasuryEvent>) => ({ ...PREVISION, ...over }) as TreasuryEvent;

  it('a una prevista, sí', () => {
    expect(esConciliable(ev({}))).toBe(true);
  });

  it('a una DESCARTADA, no · dijiste que no iba a ocurrir', () => {
    expect(esConciliable(ev({ descartado: true }))).toBe(false);
  });

  it('a una ya ejecutada tampoco · su cargo ya está', () => {
    expect(esConciliable(ev({ status: 'executed' as never }))).toBe(false);
  });
});

describe('sinMarcaDeDescarte · lo que queda al materializarse', () => {
  it('quita la marca, la fecha y el motivo', () => {
    const limpio = sinMarcaDeDescarte({
      ...PREVISION, id: 1, descartado: true,
      descartadoAt: '2026-08-20T00:00:00.000Z', motivoDescarte: 'no llegó',
    } as TreasuryEvent);
    expect(limpio.descartado).toBeUndefined();
    expect(limpio.descartadoAt).toBeUndefined();
    expect(limpio.motivoDescarte).toBeUndefined();
  });

  it('y no toca nada más', () => {
    const limpio = sinMarcaDeDescarte({ ...PREVISION, id: 1, amount: 60 } as TreasuryEvent);
    expect(limpio.amount).toBe(60);
    expect(limpio.description).toBe('Comunidad');
  });
});

// ─── el emparejamiento ──────────────────────────────────────────────────────

describe('el extracto NO resucita un descarte', () => {
  async function sembrarYCasar(over: Partial<TreasuryEvent>) {
    const db = await initDB();
    await db.add('treasuryEvents', { ...PREVISION, ...over } as never);
    const movementId = (await db.add('movements', { ...CARGO } as never)) as number;
    return matchBatch([movementId]);
  }

  it('una previsión DESCARTADA no se propone como cuadre', async () => {
    const r = await sembrarYCasar({ descartado: true });
    expect(r.matches).toHaveLength(0);
    expect(r.multiMatches).toHaveLength(0);
    expect(r.sinMatch).toHaveLength(1);
  });

  // El control: sin este test, excluir descartados podría haberse llevado por
  // delante el cuadre de un vencido normal, que es lo que #1813 vino a permitir.
  it('pero un VENCIDO normal sí · no se rompe lo de #1813', async () => {
    const r = await sembrarYCasar({});
    expect(r.matches).toHaveLength(1);
  });

  it('y sigue descartada después · nadie la ha tocado', async () => {
    await sembrarYCasar({ descartado: true });
    const db = await initDB();
    const [ev] = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
    expect(ev.descartado).toBe(true);
    expect(ev.status).toBe('predicted');
  });
});

// ─── la red de seguridad ────────────────────────────────────────────────────

describe('si un descarte se materializa igualmente, la marca se va', () => {
  // La jerarquía ya estaba escrita en el modelo: `descartarPrevisto` se niega
  // sobre un `executed` («no se puede descartar algo que ya ocurrió»). Lo que
  // faltaba era el otro lado — que confirmarlo limpie el descarte — para que no
  // pueda existir un evento que es las dos cosas a la vez.
  it('confirmar a mano un descartado lo deja `executed` y SIN marca', async () => {
    const db = await initDB();
    const id = (await db.add('treasuryEvents', {
      ...PREVISION, descartado: true, descartadoAt: '2026-08-20T00:00:00.000Z',
      motivoDescarte: 'no llegó el recibo',
    } as never)) as number;

    await confirmTreasuryEvent(id);

    const ev = (await db.get('treasuryEvents', id)) as TreasuryEvent;
    expect(ev.status).toBe('executed');
    expect(ev.descartado).toBeUndefined();
    expect(ev.motivoDescarte).toBeUndefined();
  });

  it('confirmar uno normal sigue igual que siempre', async () => {
    const db = await initDB();
    const id = (await db.add('treasuryEvents', { ...PREVISION } as never)) as number;

    await confirmTreasuryEvent(id);

    const ev = (await db.get('treasuryEvents', id)) as TreasuryEvent;
    expect(ev.status).toBe('executed');
    expect(ev.executedMovementId).toBeDefined();
  });
});
