// Candado del alta a mano y de la derrama-mejora.
//
// Lo que protege, por orden de gravedad:
//   · que una MEJORA no acabe guardada como gasto · deducir este año algo que
//     Hacienda amortiza a lo largo de los años es un error en la declaración,
//     no un detalle de UI;
//   · que lo anotado a mano nazca CONFIRMADO y no conciliado · conciliado
//     significa "hay un extracto detrás", y aquí solo está la palabra del
//     usuario.

import {
  altaMovimiento,
  mejoraDesdeMovimiento,
  SinCuentaError,
  MejoraSinInmuebleError,
  TraspasoALaMismaCuentaError,
} from '../altaMovimientoService';
import { initDB } from '../db';
import { createTransfer } from '../treasuryTransferService';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../treasuryTransferService', () => ({ createTransfer: jest.fn() }));

let movements: any[];
let mejoras: any[];

const base = {
  tipo: 'gasto' as const,
  concepto: 'Derrama fachada',
  importe: -300,
  fecha: '2026-08-01',
  cuentaId: 1,
};

beforeEach(() => {
  movements = [];
  mejoras = [];
  (createTransfer as jest.Mock).mockReset();
  (createTransfer as jest.Mock).mockResolvedValue({
    originEventId: 10,
    targetEventId: 11,
    originMovementId: 20,
    targetMovementId: 21,
  });
  (initDB as jest.Mock).mockResolvedValue({
    add: async (store: string, value: any) => {
      const arr = store === 'movements' ? movements : mejoras;
      const id = arr.length + 1;
      arr.push({ ...value, id });
      return id;
    },
  });
});

describe('una mejora NO se guarda como gasto', () => {
  it('va a mejorasInmueble, no a movements', async () => {
    const r = await altaMovimiento({ ...base, esMejora: true, inmuebleId: 7 });

    expect(r.mejoraId).toBe(1);
    expect(r.movementId).toBeUndefined();
    expect(movements).toHaveLength(0);
    expect(mejoras).toHaveLength(1);
  });

  it('sin categoryKey · una mejora no tiene casilla de gasto', async () => {
    await altaMovimiento({
      ...base,
      esMejora: true,
      inmuebleId: 7,
      categoryKey: 'comunidad_inmueble',
    });

    expect(mejoras[0].categoryKey).toBeUndefined();
  });

  it('se registra como mejora, no como reparación · eso es lo que se preguntó', async () => {
    await altaMovimiento({ ...base, esMejora: true, inmuebleId: 7 });
    expect(mejoras[0].tipo).toBe('mejora');
  });

  it('el importe va en positivo · es una inversión que se amortiza', async () => {
    await altaMovimiento({ ...base, importe: -300, esMejora: true, inmuebleId: 7 });
    expect(mejoras[0].importe).toBe(300);
  });

  it('el ejercicio sale de la FECHA del gasto, no del año en curso', async () => {
    // Una derrama de diciembre anotada en enero amortiza desde el ejercicio en
    // que se pagó, no desde el que se teclea.
    await altaMovimiento({
      ...base,
      fecha: '2025-12-20',
      esMejora: true,
      inmuebleId: 7,
    });
    expect(mejoras[0].ejercicio).toBe(2025);
  });

  it('una mejora SIN inmueble se rechaza · no hay nada que amortizar', async () => {
    await expect(
      altaMovimiento({ ...base, esMejora: true, inmuebleId: null })
    ).rejects.toBeInstanceOf(MejoraSinInmuebleError);

    expect(mejoras).toHaveLength(0);
    expect(movements).toHaveLength(0);
  });
});

// Caso distinto: la mejora sale de una línea de extracto, así que el apunte
// bancario YA existe. El dinero salió — eso es realidad, no una elección.
describe('la mejora que viene de un extracto', () => {
  beforeEach(() => {
    movements = [
      { id: 5, description: 'TRANSFERENCIA COMUNIDAD', amount: -300, categoryKey: 'comunidad_inmueble', subtypeKey: 'x', ambito: 'PERSONAL' },
    ];
    (initDB as jest.Mock).mockResolvedValue({
      get: async (_s: string, id: number) => movements.find((m) => m.id === id),
      put: async (_s: string, value: any) => {
        const i = movements.findIndex((m) => m.id === value.id);
        if (i >= 0) movements[i] = value;
        return value.id;
      },
      add: async (_s: string, value: any) => {
        const id = mejoras.length + 1;
        mejoras.push({ ...value, id });
        return id;
      },
    });
  });

  it('el movimiento NO se borra · el saldo tiene que cuadrar con el banco', async () => {
    await mejoraDesdeMovimiento({
      movementId: 5,
      inmuebleId: 7,
      concepto: 'Derrama fachada',
      importe: -300,
      fecha: '2026-08-01',
    });

    expect(movements).toHaveLength(1);
  });

  it('pero pierde la key de gasto · lo que se deduce es la amortización', async () => {
    await mejoraDesdeMovimiento({
      movementId: 5,
      inmuebleId: 7,
      concepto: 'Derrama fachada',
      importe: -300,
      fecha: '2026-08-01',
    });

    expect(movements[0].categoryKey).toBeUndefined();
    expect(movements[0].subtypeKey).toBeUndefined();
    expect(movements[0].ambito).toBe('INMUEBLE');
  });

  it('la mejora queda enlazada al apunte que la pagó', async () => {
    await mejoraDesdeMovimiento({
      movementId: 5,
      inmuebleId: 7,
      concepto: 'Derrama fachada',
      importe: -300,
      fecha: '2026-08-01',
    });

    expect(mejoras[0]).toMatchObject({
      movimientoId: '5',
      tipo: 'mejora',
      importe: 300,
      inmuebleId: 7,
      ejercicio: 2026,
    });
  });
});

describe('el alta normal', () => {
  it('nace CONFIRMADO, no conciliado · no hay extracto detrás', async () => {
    await altaMovimiento(base);
    // `source: 'manual'` es lo que `punteoModel.estadoDeMovimiento` lee para
    // decidir; con 'import' habría salido como conciliado, que sería mentira.
    expect(movements[0].source).toBe('manual');
  });

  it('el signo lo marca el tipo, no el importe que llegue', async () => {
    await altaMovimiento({ ...base, tipo: 'gasto', importe: 300 });
    expect(movements[0].amount).toBe(-300);

    await altaMovimiento({ ...base, tipo: 'ingreso', importe: -300 });
    expect(movements[1].amount).toBe(300);
  });

  it('guarda la clasificación cuando la hay', async () => {
    await altaMovimiento({
      ...base,
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'luz',
      inmuebleId: 7,
    });

    expect(movements[0]).toMatchObject({
      categoryKey: 'suministro_inmueble',
      subtypeKey: 'luz',
      inmuebleId: '7',
      ambito: 'INMUEBLE',
    });
  });

  it('sin inmueble es personal, y no deja campos vacíos colgando', async () => {
    await altaMovimiento(base);

    expect(movements[0].ambito).toBe('PERSONAL');
    expect(movements[0]).not.toHaveProperty('inmuebleId');
    expect(movements[0]).not.toHaveProperty('categoryKey');
  });

  it('una transferencia se guarda como tal', async () => {
    await altaMovimiento({ ...base, tipo: 'transferencia', importe: -500 });
    expect(movements[0].type).toBe('Transferencia');
  });

  it('sin cuenta se rechaza · un movimiento sin cuenta no mueve ningún saldo', async () => {
    await expect(altaMovimiento({ ...base, cuentaId: null })).rejects.toBeInstanceOf(
      SinCuentaError
    );
    expect(movements).toHaveLength(0);
  });

  it('la fecha se guarda como día, sin hora', async () => {
    await altaMovimiento({ ...base, fecha: '2026-08-01T14:32:00.000Z' });
    expect(movements[0].date).toBe('2026-08-01');
  });
});


// Externa e interna NO son lo mismo, y por eso la ficha las separa: a un
// tercero el dinero se va; entre cuentas propias cambia de sitio. `cuentaDestinoId`
// llegaba hasta aquí y se caía —el servicio lo declaraba y no lo leía—, así que
// la interna escribía la salida y nada en la cuenta destino: el dinero
// desaparecía de una cuenta sin aparecer en la otra.
describe('la transferencia interna escribe SUS DOS PATAS', () => {
  const traspaso = {
    tipo: 'transferencia' as const,
    concepto: 'A la de ahorro',
    importe: -2000,
    fecha: '2026-08-02',
    cuentaId: 1,
  };

  it('delega en createTransfer y devuelve las dos', async () => {
    const r = await altaMovimiento({ ...traspaso, cuentaDestinoId: 3 });

    expect(createTransfer).toHaveBeenCalledWith({
      date: '2026-08-02',
      // Magnitud positiva · el sentido lo dan las dos patas, no el signo.
      amount: 2000,
      originAccountId: 1,
      targetAccountId: 3,
      concept: 'A la de ahorro',
      // Lo que se anota YA ha pasado: las dos patas nacen confirmadas.
      confirm: true,
    });
    expect(r.movementId).toBe(20);
    expect(r.movementIdDestino).toBe(21);
    // Y NO se escribe además un movimiento suelto por su cuenta.
    expect(movements).toHaveLength(0);
  });

  // A un tercero el dinero se va de verdad: un apunte y ya está.
  it('la EXTERNA sigue siendo un solo movimiento', async () => {
    const r = await altaMovimiento({ ...traspaso, cuentaDestinoId: null });

    expect(createTransfer).not.toHaveBeenCalled();
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('Transferencia');
    expect(r.movementIdDestino).toBeUndefined();
  });

  it('a la misma cuenta no es un traspaso · se rechaza antes de escribir nada', async () => {
    await expect(altaMovimiento({ ...traspaso, cuentaDestinoId: 1 })).rejects.toBeInstanceOf(
      TraspasoALaMismaCuentaError
    );
    expect(createTransfer).not.toHaveBeenCalled();
    expect(movements).toHaveLength(0);
  });
});
