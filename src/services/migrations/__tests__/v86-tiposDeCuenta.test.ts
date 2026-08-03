// V86 · `AHORRO` y `OTRA` dejan de existir · VOCABULARIO §1.
//
// La migración toca DATOS de verdad, así que lo que vigila este candado es que
// no se lleve nada por delante: la cuenta cambia de etiqueta y conserva saldo,
// IBAN, alias y lo demás. Un tipo que desaparece no puede costarle a nadie su
// dinero.

import { migrarTiposDeCuenta } from '../v86-tiposDeCuenta';
import { initDB } from '../../db';

const cuenta = (over: Record<string, unknown>) => ({
  alias: 'Una cuenta',
  banco: { name: 'Santander' },
  iban: 'ES9121000418450200051332',
  openingBalance: 1234.56,
  openingBalanceDate: '2026-01-01',
  activa: true,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const guardar = async (c: Record<string, unknown>): Promise<number> => {
  const db = await initDB();
  return (await db.add('accounts', c as never)) as number;
};

const leer = async (id: number): Promise<Record<string, unknown> | undefined> => {
  const db = await initDB();
  return (await db.get('accounts', id)) as Record<string, unknown> | undefined;
};

describe('los tipos retirados pasan a CORRIENTE', () => {
  it.each(['AHORRO', 'OTRA'])('%s → CORRIENTE', async (tipo) => {
    const id = await guardar(cuenta({ tipo }));
    const db = await initDB();

    await migrarTiposDeCuenta(db as never);

    expect((await leer(id))?.tipo).toBe('CORRIENTE');
  });

  // Lo que de verdad importa: la cuenta cambia de etiqueta, no de contenido.
  it('no se pierde nada por el camino', async () => {
    const id = await guardar(cuenta({ tipo: 'AHORRO', alias: 'Mis ahorros' }));
    const db = await initDB();

    await migrarTiposDeCuenta(db as never);

    const c = await leer(id);
    expect(c?.alias).toBe('Mis ahorros');
    expect(c?.iban).toBe('ES9121000418450200051332');
    expect(c?.openingBalance).toBe(1234.56);
    expect(c?.openingBalanceDate).toBe('2026-01-01');
    expect(c?.activa).toBe(true);
  });
});

describe('lo que no se toca', () => {
  it.each(['CORRIENTE', 'EFECTIVO', 'TARJETA_CREDITO'])('%s se queda igual', async (tipo) => {
    const id = await guardar(cuenta({ tipo }));
    const db = await initDB();

    await migrarTiposDeCuenta(db as never);

    expect((await leer(id))?.tipo).toBe(tipo);
  });

  it('una cuenta sin tipo se queda sin tipo · no se le inventa uno', async () => {
    const id = await guardar(cuenta({}));
    const db = await initDB();

    await migrarTiposDeCuenta(db as never);

    expect((await leer(id))?.tipo).toBeUndefined();
  });
});

describe('repetirla no hace daño', () => {
  it('la segunda pasada no toca nada', async () => {
    await guardar(cuenta({ tipo: 'AHORRO' }));
    const db = await initDB();

    const primera = await migrarTiposDeCuenta(db as never);
    const segunda = await migrarTiposDeCuenta(db as never);

    expect(primera).toBeGreaterThan(0);
    expect(segunda).toBe(0);
  });
});
