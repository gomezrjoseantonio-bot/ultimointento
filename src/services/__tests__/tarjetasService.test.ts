// Alta y edición de tarjetas · VOCABULARIO §3.
//
// Lo que vigila: que no se pueda guardar un imposible. Una tarjeta que se
// liquida en el colchón —o en otra tarjeta— deja un recibo que nunca podrá
// pagarse, y una de crédito sin ciclo no sabe cuándo cobra.
//
// Y lo otro: que cambiar la domiciliación sea una operación NORMAL. Si la única
// vía fuese rehacer la tarjeta, se perdería su historial de gasto — que es lo
// que prueba las bonificaciones.

import {
  actualizarTarjeta,
  crearTarjeta,
  CuentaDeLiquidacionInvalidaError,
  eliminarTarjeta,
  listarTarjetas,
  TarjetaNoEncontradaError,
  tarjetasDeLaCuenta,
  TarjetaSinCicloError,
} from '../tarjetasService';
import { initDB } from '../db';
import type { AltaTarjeta } from '../tarjetasService';

const CICLO = {
  periodicidad: 'mensual' as const,
  corte: 24,
  diaCargo: 31,
  periodosHastaElCargo: 0,
};

let bancaria = 0;
let otraBancaria = 0;
let efectivo = 0;

const sembrar = async () => {
  const db = await initDB();
  const tx = db.transaction(['accounts', 'tarjetas'], 'readwrite');
  await tx.objectStore('accounts').clear();
  await tx.objectStore('tarjetas').clear();
  await tx.done;

  const alta = async (c: Record<string, unknown>) =>
    (await (await initDB()).add('accounts', c as never)) as number;

  bancaria = await alta({ alias: 'Santander', tipo: 'CORRIENTE', activa: true });
  otraBancaria = await alta({ alias: 'Bankinter', tipo: 'CORRIENTE', activa: true });
  efectivo = await alta({ alias: 'Efectivo', tipo: 'EFECTIVO', activa: true });
};

const carrefour = (): AltaTarjeta => ({
  alias: 'Carrefour',
  emisora: 'Carrefour',
  origen: 'externa',
  modalidad: 'credito',
  cuentaLiquidacionId: bancaria,
  ciclo: CICLO,
});

describe('lo que no se puede guardar', () => {
  beforeEach(sembrar);

  it('una tarjeta no se liquida en el colchón', async () => {
    await expect(
      crearTarjeta({ ...carrefour(), cuentaLiquidacionId: efectivo })
    ).rejects.toThrow(CuentaDeLiquidacionInvalidaError);
  });

  it('ni en una cuenta que no existe', async () => {
    await expect(
      crearTarjeta({ ...carrefour(), cuentaLiquidacionId: 9999 })
    ).rejects.toThrow(CuentaDeLiquidacionInvalidaError);
  });

  // Una tarjeta domiciliada en una cuenta que ya no existe deja un recibo que
  // nadie puede pagar.
  it('ni en una cuenta borrada', async () => {
    const db = await initDB();
    const borrada = (await db.add('accounts', {
      alias: 'Vieja',
      tipo: 'CORRIENTE',
      status: 'DELETED',
    } as never)) as number;

    await expect(
      crearTarjeta({ ...carrefour(), cuentaLiquidacionId: borrada })
    ).rejects.toThrow(CuentaDeLiquidacionInvalidaError);
  });

  it('una de crédito sin ciclo no sabe cuándo cobra', async () => {
    await expect(crearTarjeta({ ...carrefour(), ciclo: undefined })).rejects.toThrow(
      TarjetaSinCicloError
    );
  });
});

describe('el débito no lleva ciclo', () => {
  beforeEach(sembrar);

  // Cobra al momento · guardarle un ciclo sería un dato que al leerlo engaña.
  it('se descarta aunque llegue relleno', async () => {
    const id = await crearTarjeta({
      ...carrefour(),
      modalidad: 'debito',
      ciclo: CICLO,
    });

    const [t] = await listarTarjetas();
    expect(t.id).toBe(id);
    expect(t.ciclo).toBeUndefined();
  });
});

describe('varias tarjetas por cuenta', () => {
  beforeEach(sembrar);

  it('caben las dos de siempre · débito y crédito', async () => {
    await crearTarjeta({ ...carrefour(), alias: 'Visa débito', modalidad: 'debito' });
    await crearTarjeta({ ...carrefour(), alias: 'Visa crédito' });

    const suyas = await tarjetasDeLaCuenta(bancaria);
    expect(suyas.map((t) => t.alias).sort()).toEqual(['Visa crédito', 'Visa débito']);
  });
});

describe('cambiar la domiciliación', () => {
  beforeEach(sembrar);

  // La de fuera se muda a menudo · y no puede costar rehacerla, porque se
  // perdería el historial que prueba las bonificaciones.
  it('es una edición normal · la tarjeta sigue siendo la misma', async () => {
    const id = await crearTarjeta(carrefour());

    await actualizarTarjeta(id, { cuentaLiquidacionId: otraBancaria });

    const [t] = await listarTarjetas();
    expect(t.id).toBe(id);
    expect(t.cuentaLiquidacionId).toBe(otraBancaria);
    expect(t.createdAt).toBeTruthy();
  });

  it('pero no a un sitio imposible', async () => {
    const id = await crearTarjeta(carrefour());

    await expect(actualizarTarjeta(id, { cuentaLiquidacionId: efectivo })).rejects.toThrow(
      CuentaDeLiquidacionInvalidaError
    );
    expect((await listarTarjetas())[0].cuentaLiquidacionId).toBe(bancaria);
  });
});

describe('borrar', () => {
  beforeEach(sembrar);

  // Callarse escondería el error: quien edita una borrada se quedaría creyendo
  // que guardó, sin forma de distinguirlo de un éxito.
  it('editar una que ya no existe se queja', async () => {
    await expect(actualizarTarjeta(9999, { alias: 'Otra' })).rejects.toThrow(
      TarjetaNoEncontradaError
    );
  });

  it('desaparece', async () => {
    const id = await crearTarjeta(carrefour());

    await eliminarTarjeta(id);

    expect(await listarTarjetas()).toEqual([]);
  });
});
