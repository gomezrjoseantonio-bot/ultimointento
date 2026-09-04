// E1.3 · las escrituras de decisiones van en fila: dos gestos seguidos sobre la
// misma línea no pueden adelantarse en la base y dejar guardado el anterior.

import { persistirCambios } from '../montarSesion';
import { guardarDecisionDeLinea } from '../decisionesPersistidas';

jest.mock('../decisionesPersistidas', () => ({
  guardarDecisionDeLinea: jest.fn(),
  lineasDelLote: jest.fn(),
  lotesAMedias: jest.fn(),
}));

const guardar = guardarDecisionDeLinea as jest.Mock;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('E1.3 · persistirCambios · en fila', () => {
  beforeEach(() => guardar.mockReset());

  it('la segunda escritura no empieza hasta que acaba la primera · y el orden se conserva', async () => {
    let acabarPrimera!: () => void;
    guardar
      .mockImplementationOnce(() => new Promise<void>((r) => { acabarPrimera = r; }))
      .mockImplementation(() => Promise.resolve());

    persistirCambios([{ lineaId: 101, decision: { ignorada: true, decididaAt: 't1' } }]);
    persistirCambios([{ lineaId: 101, decision: { asignadoA: 5, decididaAt: 't2' } }]);
    await tick();
    // Con la primera aún en vuelo, la segunda espera.
    expect(guardar).toHaveBeenCalledTimes(1);

    acabarPrimera();
    await tick();
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(guardar.mock.calls.map((c) => c[1])).toEqual([
      { ignorada: true, decididaAt: 't1' },
      { asignadoA: 5, decididaAt: 't2' },
    ]);
  });

  it('si una falla, se avisa y la siguiente se escribe igual', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    guardar
      .mockImplementationOnce(() => Promise.reject(new Error('sin fila')))
      .mockImplementation(() => Promise.resolve());

    persistirCambios([
      { lineaId: 999, decision: { ignorada: true, decididaAt: 't1' } },
      { lineaId: 102, decision: undefined },
    ]);
    await tick();
    await tick();
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(guardar).toHaveBeenLastCalledWith(102, undefined);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('no se pudo persistir'), 999, expect.any(Error));
    error.mockRestore();
  });
});
