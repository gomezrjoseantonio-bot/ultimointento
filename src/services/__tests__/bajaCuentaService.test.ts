// Candado de la baja de cuenta (§4.8).
//
// Lo que protege: que no se pueda cerrar una cuenta con previsiones abiertas.
// Un previsto vive colgado de su cuenta; si la cuenta desaparece de la vista,
// esas previsiones NO desaparecen del motor —siguen proyectando cierre— y el
// usuario se queda sin sitio donde verlas ni resolverlas. Bloquear es peor UX
// que avisar, y mucho mejor que dejar cifras huérfanas moviéndose solas.

import {
  motivoParaNoDarDeBaja,
  darDeBajaCuenta,
  deshacerBajaCuenta,
  mensajeDeBloqueo,
  CuentaConPendientesError,
} from '../bajaCuentaService';
import { initDB, type TreasuryEvent } from '../db';
import { cuentasService } from '../cuentasService';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../cuentasService', () => ({
  cuentasService: { deactivate: jest.fn(), reactivate: jest.fn() },
}));

let eventos: TreasuryEvent[];

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    accountId: 1,
    type: 'expense',
    amount: 100,
    predictedDate: '2026-08-10',
    description: 'Recibo luz',
    sourceType: 'manual',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

beforeEach(() => {
  jest.clearAllMocks();
  eventos = [];
  (initDB as jest.Mock).mockResolvedValue({ getAll: async () => eventos });
});

describe('cuándo se puede dar de baja', () => {
  it('sin previsiones abiertas · se puede', async () => {
    expect(await motivoParaNoDarDeBaja(1)).toBeNull();
  });

  it('con un previsto abierto · bloqueada', async () => {
    eventos = [ev()];
    const motivo = await motivoParaNoDarDeBaja(1);
    expect(motivo?.pendientes).toBe(1);
  });

  it('un previsto ya ejecutado no bloquea · eso es histórico, no pendiente', async () => {
    eventos = [ev({ status: 'executed' })];
    expect(await motivoParaNoDarDeBaja(1)).toBeNull();
  });

  it('un previsto descartado tampoco bloquea', async () => {
    eventos = [ev({ descartado: true })];
    expect(await motivoParaNoDarDeBaja(1)).toBeNull();
  });

  it('los previstos de OTRA cuenta no bloquean esta', async () => {
    eventos = [ev({ accountId: 2 })];
    expect(await motivoParaNoDarDeBaja(1)).toBeNull();
  });

  it('nombra los primeros, en orden de fecha · contar a secas no ayuda', async () => {
    eventos = [
      ev({ id: 1, predictedDate: '2026-09-01', description: 'Seguro' }),
      ev({ id: 2, predictedDate: '2026-08-05', description: 'Luz' }),
      ev({ id: 3, predictedDate: '2026-08-20', description: 'Agua' }),
      ev({ id: 4, predictedDate: '2026-10-01', description: 'IBI' }),
    ];
    const motivo = await motivoParaNoDarDeBaja(1);

    expect(motivo?.pendientes).toBe(4);
    expect(motivo?.ejemplos.map((e) => e.concepto)).toEqual(['Luz', 'Agua', 'Seguro']);
  });

  it('el importe de los ejemplos lleva signo · un ingreso no es un gasto', async () => {
    eventos = [ev({ type: 'income', amount: 850, description: 'Alquiler' })];
    const motivo = await motivoParaNoDarDeBaja(1);
    expect(motivo?.ejemplos[0].importe).toBe(850);
  });
});

describe('el mensaje que ve el usuario', () => {
  it('dice cuántas y qué hacer, en singular y en plural', () => {
    expect(mensajeDeBloqueo({ pendientes: 1, ejemplos: [] })).toContain('1 movimiento pendiente');
    expect(mensajeDeBloqueo({ pendientes: 1, ejemplos: [] })).toContain('Confírmalo o descártalo');
    expect(mensajeDeBloqueo({ pendientes: 3, ejemplos: [] })).toContain('3 movimientos pendientes');
    expect(mensajeDeBloqueo({ pendientes: 3, ejemplos: [] })).toContain('Confírmalos o descártalos');
  });
});

describe('dar de baja', () => {
  it('desactiva · NO borra · el histórico sigue siendo del usuario', async () => {
    await darDeBajaCuenta(1);
    expect(cuentasService.deactivate).toHaveBeenCalledWith(1);
  });

  it('el bloqueo es real, no decorativo · se recomprueba al pulsar', async () => {
    // La UI ya lo comprobó al abrir la ficha, pero entre eso y el clic puede
    // haber aparecido una previsión nueva.
    eventos = [ev()];
    await expect(darDeBajaCuenta(1)).rejects.toBeInstanceOf(CuentaConPendientesError);
    expect(cuentasService.deactivate).not.toHaveBeenCalled();
  });

  it('el error lleva el motivo, para poder pintarlo sin volver a consultar', async () => {
    eventos = [ev(), ev({ id: 2 })];
    await expect(darDeBajaCuenta(1)).rejects.toMatchObject({
      motivo: { pendientes: 2 },
    });
  });

  it('deshacer reactiva · la baja era suave, no hay nada que resucitar', async () => {
    await deshacerBajaCuenta(1);
    expect(cuentasService.reactivate).toHaveBeenCalledWith(1);
  });
});
