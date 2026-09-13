// E3.2 · §7.4 · la renta del inquilino cuando el banco no escribe su nombre.
//
// V85 ya aprendía quién es quién: cuando confirmas «BIZUM DE MPARWEZ» contra la
// renta de «Adnan Parwez Khan», ATLAS guarda que son la misma persona. Pero ese
// alias solo lo leía el emparejador contra las PREVISIONES — y las rentas del
// pasado no tienen previsión, que es precisamente para lo que existe
// `rentasQueCuadran`. Resultado: enseñárselo una vez no servía para el resto de
// sus meses, y había que decírselo otra vez en cada uno.
//
// El alias no relaja nada más: el importe sigue teniendo que ser exacto y la
// fecha, dentro de la vigencia del contrato.

import { rentasQueCuadran } from '../rentas';
import { claveDeNombre } from '../../coincidenciaNombre';
import type { Movement } from '../../db';
import type { Contract } from '../../db/types-contratos';

const contrato = (over: Partial<Contract> = {}): Contract =>
  ({
    id: 7,
    inmuebleId: 32,
    estadoContrato: 'activo',
    fechaInicio: '2025-01-01',
    fechaFin: '2027-01-01',
    rentaMensual: 395,
    cuentaCobroId: 1,
    inquilino: { nombre: 'Adnan', apellidos: 'Parwez Khan' },
    ...over,
  }) as unknown as Contract;

const abono = (description: string, amount = 395): Movement =>
  ({ id: 1, accountId: 1, date: '2025-06-05', amount, description }) as unknown as Movement;

const ALIAS = new Map([[claveDeNombre('MPARWEZ ADNAN'), new Set([claveDeNombre('Adnan Parwez Khan')])]]);

describe('la renta reconocida por el alias que el usuario enseñó', () => {
  it('sin alias no se reconoce · el banco no escribe el nombre del contrato', () => {
    // «MPARWEZ ADNAN» comparte UNA palabra con «Adnan Parwez Khan», y una no
    // basta: podría ser otra persona. Sin el alias, esto se pregunta.
    expect(rentasQueCuadran([abono('BIZUM DE MPARWEZ ADNAN')], [contrato()])).toHaveLength(0);
  });

  it('con el alias sí · y trae su piso', () => {
    const r = rentasQueCuadran([abono('BIZUM DE MPARWEZ ADNAN')], [contrato()], ALIAS);

    expect(r).toHaveLength(1);
    expect(r[0].familia).toBe('alquiler');
    expect(r[0].inmuebleId).toBe(32);
    expect(r[0].renta?.contratoId).toBe(7);
  });

  it('el alias NO relaja el importe · 395 es 395', () => {
    expect(rentasQueCuadran([abono('BIZUM DE MPARWEZ ADNAN', 400)], [contrato()], ALIAS)).toHaveLength(0);
  });

  it('el alias NO relaja la vigencia del contrato', () => {
    const fuera = { ...abono('BIZUM DE MPARWEZ ADNAN'), date: '2028-06-05' } as Movement;
    expect(rentasQueCuadran([fuera], [contrato()], ALIAS)).toHaveLength(0);
  });

  it('el alias de otro no sirve · apunta a otro inquilino', () => {
    const otro = contrato({ id: 9, inquilino: { nombre: 'Miguel', apellidos: 'Lorenzo Cabanelas' } } as Partial<Contract>);
    expect(rentasQueCuadran([abono('BIZUM DE MPARWEZ ADNAN')], [otro], ALIAS)).toHaveLength(0);
  });

  it('el nombre que se escribe entero sigue funcionando sin alias ninguno', () => {
    expect(rentasQueCuadran([abono('Transferencia De Adnan Parwez Khan')], [contrato()])).toHaveLength(1);
  });

  it('dos contratos que lo explicarían igual siguen sin elegirse', () => {
    const gemelo = contrato({ id: 8, inmuebleId: 33 } as Partial<Contract>);
    expect(rentasQueCuadran([abono('BIZUM DE MPARWEZ ADNAN')], [contrato(), gemelo], ALIAS)).toHaveLength(0);
  });
});
