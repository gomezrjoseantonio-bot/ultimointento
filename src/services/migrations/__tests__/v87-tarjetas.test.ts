// V87 · la tarjeta empieza a existir · VOCABULARIO §3.
//
// Esta migración es ADITIVA a propósito: crea la `Tarjeta` y no toca la cuenta.
// Sus movimientos son compras de verdad, y borrarlos sería perder dinero de la
// vista. Que sobre una cuenta es molesto; que falte el dinero, no tiene arreglo.

import { migrarTarjetas } from '../v87-tarjetas';
import { initDB } from '../../db';
import type { Tarjeta } from '../../../types/tarjetas';

const cuentaTarjeta = (over: Record<string, unknown> = {}) => ({
  alias: 'Visa Santander',
  tipo: 'TARJETA_CREDITO',
  cardConfig: { settlementDay: 5, chargeAccountId: 42 },
  activa: true,
  createdAt: '2025-03-01T00:00:00.000Z',
  updatedAt: '2025-03-01T00:00:00.000Z',
  ...over,
});

const guardarCuenta = async (c: Record<string, unknown>): Promise<number> => {
  const db = await initDB();
  return (await db.add('accounts', c as never)) as number;
};

const tarjetas = async (): Promise<Tarjeta[]> => {
  const db = await initDB();
  return ((await db.getAll('tarjetas')) ?? []) as Tarjeta[];
};

const limpiar = async () => {
  const db = await initDB();
  const tx = db.transaction(['accounts', 'tarjetas'], 'readwrite');
  await tx.objectStore('accounts').clear();
  await tx.objectStore('tarjetas').clear();
  await tx.done;
};

describe('la cuenta que era tarjeta se convierte en una tarjeta', () => {
  beforeEach(limpiar);

  it('nace con su cuenta de liquidación y su día de cargo', async () => {
    await guardarCuenta(cuentaTarjeta());
    const db = await initDB();

    await migrarTarjetas(db as never);

    const [t] = await tarjetas();
    expect(t.alias).toBe('Visa Santander');
    expect(t.cuentaLiquidacionId).toBe(42);
    expect(t.modalidad).toBe('credito');
    expect(t.origen).toBe('banco');
    expect(t.ciclo?.diaCargo).toBe(5);
    // Lo único que había era el día del cargo · el corte real se dice a mano.
    expect(t.ciclo?.periodicidad).toBe('mensual');
    expect(t.ciclo?.periodosHastaElCargo).toBe(1);
  });

  // Lo que NO hace, y es lo que protege los datos.
  it('no toca la cuenta · sus movimientos son compras de verdad', async () => {
    const id = await guardarCuenta(cuentaTarjeta());
    const db = await initDB();

    await migrarTarjetas(db as never);

    const cuenta = (await db.get('accounts', id)) as Record<string, unknown>;
    expect(cuenta).toBeDefined();
    expect(cuenta.tipo).toBe('TARJETA_CREDITO');
    expect(cuenta.updatedAt).toBe('2025-03-01T00:00:00.000Z');
  });

  // Sin saber de qué cuenta sale el dinero no se puede inventar una tarjeta.
  it('sin cuenta de liquidación no se crea nada', async () => {
    await guardarCuenta(cuentaTarjeta({ cardConfig: undefined }));
    const db = await initDB();

    const r = await migrarTarjetas(db as never);

    expect(r.tarjetasCreadas).toBe(0);
    expect(await tarjetas()).toEqual([]);
  });
});

describe('lo que no es una tarjeta', () => {
  beforeEach(limpiar);

  it.each(['CORRIENTE', 'EFECTIVO'])('%s no genera tarjeta', async (tipo) => {
    await guardarCuenta(cuentaTarjeta({ tipo }));
    const db = await initDB();

    await migrarTarjetas(db as never);

    expect(await tarjetas()).toEqual([]);
  });
});

describe('repetirla no duplica', () => {
  beforeEach(limpiar);

  it('la segunda pasada no crea otra', async () => {
    await guardarCuenta(cuentaTarjeta());
    const db = await initDB();

    const primera = await migrarTarjetas(db as never);
    const segunda = await migrarTarjetas(db as never);

    expect(primera.tarjetasCreadas).toBe(1);
    expect(segunda.tarjetasCreadas).toBe(0);
    expect(await tarjetas()).toHaveLength(1);
  });
});
