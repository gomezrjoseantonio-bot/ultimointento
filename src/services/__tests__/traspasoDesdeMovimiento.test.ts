// Convertir un movimiento que YA existe en una transferencia interna.
//
// El caso: la retirada de cajero que llega en el extracto. `processFile` ya la
// insertó como `Movement`, así que crear el traspaso desde cero duplicaría el
// apunte y el saldo dejaría de cuadrar con el banco. Lo que hay que hacer es lo
// contrario: quedarse con ese movimiento como pata de SALIDA y escribir solo la
// de ENTRADA.

import {
  convertirEnTraspaso,
  NoEsUnCargoError,
  TraspasoALaMismaCuentaError,
} from '../traspasoDesdeMovimiento';
import { initDB } from '../db';

jest.mock('../db', () => ({ initDB: jest.fn() }));

let movimientos: Record<number, any>;
let siguienteId: number;

const CARGO = {
  id: 5,
  accountId: 1,
  date: '2026-08-02',
  amount: -200,
  description: 'REINTEGRO CAJERO 4B',
  source: 'import',
  unifiedStatus: 'conciliado',
  statusConciliacion: 'match_manual',
  type: 'Gasto',
  origin: 'CSV',
  category: { tipo: 'Gastos' },
  reference: 'linea-extracto-77',
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => {
  movimientos = { 5: { ...CARGO } };
  siguienteId = 6;
  (initDB as jest.Mock).mockResolvedValue({
    get: async (_store: string, id: number) => movimientos[id],
    put: async (_store: string, value: any) => {
      movimientos[value.id] = value;
      return value.id;
    },
    add: async (_store: string, value: any) => {
      const id = siguienteId++;
      movimientos[id] = { ...value, id };
      return id;
    },
  });
});

describe('el cargo del extracto pasa a ser la salida', () => {
  it('no se duplica · se transforma el que ya estaba', async () => {
    const r = await convertirEnTraspaso(5, 9);

    expect(r.movementId).toBe(5);
    // Dos movimientos en total: el del banco y su espejo. Ni uno más.
    expect(Object.keys(movimientos)).toHaveLength(2);
  });

  // Lo que dice el banco no se toca: el saldo tiene que seguir cuadrando con el
  // extracto.
  it('respeta importe y fecha del banco', async () => {
    await convertirEnTraspaso(5, 9);
    expect(movimientos[5].amount).toBe(-200);
    expect(movimientos[5].date).toBe('2026-08-02');
  });

  // Quien suma ingresos y gastos mira esta key para dejar fuera los traspasos.
  // Sin ella, la retirada seguiría contando como gasto.
  it('queda marcado como traspaso · deja de ser un gasto', async () => {
    await convertirEnTraspaso(5, 9);
    expect(movimientos[5].categoryKey).toBe('traspaso_salida');
    expect(movimientos[5].type).toBe('Transferencia');
    // Emparejado con su espejo · esa huella es lo que hace la conversión
    // repetible sin duplicar nada.
    expect(movimientos[5].transferMetadata).toEqual({ targetAccountId: 9, pairMovementId: 6 });
  });
});

describe('la pata de entrada', () => {
  it('es el mismo dinero, del otro lado', async () => {
    const { movementIdDestino } = await convertirEnTraspaso(5, 9);
    const entrada = movimientos[movementIdDestino];

    expect(entrada.accountId).toBe(9);
    expect(entrada.amount).toBe(200);
    expect(entrada.categoryKey).toBe('traspaso_entrada');
    // La otra cuenta es la de ORIGEN · de ahí vino el dinero.
    expect(entrada.transferMetadata).toEqual({ targetAccountId: 1 });
  });

  // El banco no sabe nada de tu bolsillo: en su extracto solo está el cargo.
  // Decir que está conciliada sería afirmar que hay un extracto detrás.
  it('nace CONFIRMADA, no conciliada · no hay extracto que la respalde', async () => {
    const { movementIdDestino } = await convertirEnTraspaso(5, 9);
    expect(movimientos[movementIdDestino].source).toBe('manual');
  });

  // La huella del extracto identifica el CARGO. Heredarla haría que al
  // reimportar el fichero se diera por duplicada la línea equivocada.
  it('no hereda la referencia del extracto', async () => {
    const { movementIdDestino } = await convertirEnTraspaso(5, 9);
    expect(movimientos[movementIdDestino].reference).toBeUndefined();
  });
});

it('a la misma cuenta no es un traspaso', async () => {
  await expect(convertirEnTraspaso(5, 1)).rejects.toBeInstanceOf(TraspasoALaMismaCuentaError);
  expect(Object.keys(movimientos)).toHaveLength(1);
});


// El guardado del extracto hace varias cosas seguidas y puede fallar en
// cualquiera. Si el usuario reintenta, esto se vuelve a ejecutar: sin guarda,
// nacería una segunda pata de entrada y el efectivo subiría dos veces por la
// misma retirada.
describe('repetir la conversión no duplica nada', () => {
  it('la segunda vez devuelve el par que ya existe', async () => {
    const primera = await convertirEnTraspaso(5, 9);
    const segunda = await convertirEnTraspaso(5, 9);

    expect(segunda).toEqual(primera);
    expect(Object.keys(movimientos)).toHaveLength(2);
  });
});

// La salida de un traspaso es un CARGO · sobre un ingreso esto escribiría una
// entrada de signo imposible en la cuenta destino.
it('un ingreso no puede ser la salida de un traspaso', async () => {
  movimientos[7] = { ...CARGO, id: 7, amount: 300 };
  await expect(convertirEnTraspaso(7, 9)).rejects.toBeInstanceOf(NoEsUnCargoError);
  expect(Object.keys(movimientos)).toHaveLength(2);
});

// El cargo puede venir conciliado por el extracto y su espejo no lo está —nadie
// lo ha visto en ningún banco—, así que heredar sus estados afirmaría lo
// contrario de lo que dice `source: 'manual'`.
it('la entrada no hereda los estados del cargo', async () => {
  movimientos[5].movementState = 'Conciliado';
  movimientos[5].status = 'conciliado';
  const { movementIdDestino } = await convertirEnTraspaso(5, 9);

  expect(movimientos[movementIdDestino].movementState).toBe('Confirmado');
  expect(movimientos[movementIdDestino].status).toBe('pendiente');
  expect(movimientos[movementIdDestino].unifiedStatus).toBe('no_planificado');
});
