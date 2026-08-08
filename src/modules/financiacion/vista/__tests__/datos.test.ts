// La cartera · a qué familia pertenece cada préstamo.
//
// Manda la garantía —un inmueble responde o no responde—, después lo que el
// préstamo dice de sí mismo, y solo al final el ámbito.
//
// `tipoPrestamoV2` lo escriben el asistente, la importación y la FEIN, y no lo
// leía nadie: una hipoteca dada de alta desde su FEIN llega con `'hipotecario'`
// y **sin garantía apuntada** —la escritura se firma después—, así que la
// cartera la llamaba «personal» teniendo el dato delante.

import { alPulsarCabecera, familiaDe, ordenar, ORDEN_POR_DEFECTO } from '../datos';
import type { FilaCartera } from '../datos';
import type { Prestamo } from '../../../../types/prestamos';

const prestamo = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'p1',
    nombre: 'Préstamo',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    tipo: 'FIJO',
    tipoNominalAnualFijo: 3,
    ...over,
  }) as unknown as Prestamo;

describe('la garantía manda sobre todo lo demás', () => {
  it('con garantía hipotecaria es hipoteca', () => {
    expect(familiaDe(prestamo({ garantias: [{ tipo: 'HIPOTECARIA' }] } as Partial<Prestamo>))).toBe(
      'hipoteca'
    );
  });

  // Una prenda no es una hipoteca · la cartera solo tiene dos filtros.
  it('una pignoraticia cuenta como personal', () => {
    expect(
      familiaDe(prestamo({ garantias: [{ tipo: 'PIGNORATICIA' }] } as Partial<Prestamo>))
    ).toBe('personal');
  });

  // Y manda de verdad: una garantía personal apuntada gana al tipo declarado,
  // porque la garantía es lo que firmaste.
  it('y una personal gana al tipo declarado', () => {
    expect(
      familiaDe(
        prestamo({
          garantias: [{ tipo: 'PERSONAL' }],
          tipoPrestamoV2: 'hipotecario',
        } as Partial<Prestamo>)
      )
    ).toBe('personal');
  });
});

describe('sin garantía apuntada, lo que el préstamo dice de sí mismo', () => {
  // El caso de la FEIN: hipotecario, sin garantía todavía, ámbito sin poner.
  it('un hipotecario sin garantía sigue siendo hipoteca', () => {
    expect(familiaDe(prestamo({ tipoPrestamoV2: 'hipotecario' }))).toBe('hipoteca');
  });

  it('y un personal, personal', () => {
    expect(familiaDe(prestamo({ tipoPrestamoV2: 'personal', ambito: 'INMUEBLE' } as Partial<Prestamo>))).toBe(
      'personal'
    );
  });
});

describe('y si el préstamo no dice nada, el ámbito', () => {
  it('ámbito inmueble es hipoteca', () => {
    expect(familiaDe(prestamo({ ambito: 'INMUEBLE' } as Partial<Prestamo>))).toBe('hipoteca');
  });

  it('sin nada de nada, personal', () => {
    expect(familiaDe(prestamo())).toBe('personal');
  });
});

// ── Ordenar por columna ─────────────────────────────────────────────────────
//
// El desplegable «Ordenar · …» repetía los nombres de las columnas en una lista
// aparte y no decía por cuál se estaba ordenando ahora. Se pide pulsando la
// columna, y la flecha lo dice.

const fila = (over: Partial<FilaCartera>): FilaCartera =>
  ({
    id: 'x',
    nombre: 'Préstamo',
    meta: '',
    familia: 'personal',
    banco: { abbr: 'XX', bg: '#000', fg: '#fff' },
    capitalVivo: 1000,
    cuota: 100,
    tin: 3,
    pctAmortizado: 10,
    vencimiento: '2030-01-01',
    revision: null,
    ...over,
  }) as unknown as FilaCartera;

describe('cada columna ordena hacia donde interesa', () => {
  // De la deuda y la cuota interesa lo GRANDE; del vencimiento, lo PRÓXIMO.
  // Arrancar todas ascendentes obliga a pulsar dos veces en las que más se
  // miran.
  it('el capital arranca de mayor a menor', () => {
    expect(alPulsarCabecera(ORDEN_POR_DEFECTO, 'capital')).toEqual({ campo: 'capital', asc: false });
  });

  it('y el nombre, de la A a la Z', () => {
    expect(alPulsarCabecera(ORDEN_POR_DEFECTO, 'nombre')).toEqual({ campo: 'nombre', asc: true });
  });

  it('la misma columna otra vez le da la vuelta', () => {
    const primera = alPulsarCabecera(ORDEN_POR_DEFECTO, 'tin');
    expect(alPulsarCabecera(primera, 'tin')).toEqual({ campo: 'tin', asc: true });
  });
});

describe('y ordena de verdad', () => {
  const filas = [
    fila({ id: 'a', nombre: 'Zeta', capitalVivo: 100, vencimiento: '2040-01-01' }),
    fila({ id: 'b', nombre: 'Alfa', capitalVivo: 900, vencimiento: '2028-01-01' }),
  ];

  it('por capital, el más gordo primero', () => {
    expect(ordenar(filas, { campo: 'capital', asc: false }).map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('por nombre, con la Ñ y los acentos en su sitio', () => {
    expect(ordenar(filas, { campo: 'nombre', asc: true }).map((f) => f.id)).toEqual(['b', 'a']);
  });

  // Un préstamo sin fecha no es «el que antes acaba» ni «el que más tarda»: va
  // al final EN LAS DOS DIRECCIONES. Con un '9999-99-99' de relleno quedaba al
  // final ascendiendo y el primero descendiendo — y esta prueba solo miraba una
  // dirección, así que lo dejaba pasar.
  const conHueco = () => [...filas, fila({ id: 'c', vencimiento: null })];

  it('el que no tiene vencimiento se va al final · ascendiendo', () => {
    expect(ordenar(conHueco(), { campo: 'vencimiento', asc: true }).map((f) => f.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('y también descendiendo', () => {
    expect(ordenar(conHueco(), { campo: 'vencimiento', asc: false }).map((f) => f.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
