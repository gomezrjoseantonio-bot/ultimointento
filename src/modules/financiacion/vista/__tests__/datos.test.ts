// La cartera · a qué familia pertenece cada préstamo.
//
// Manda la garantía —un inmueble responde o no responde—, después lo que el
// préstamo dice de sí mismo, y solo al final el ámbito.
//
// `tipoPrestamoV2` lo escriben el asistente, la importación y la FEIN, y no lo
// leía nadie: una hipoteca dada de alta desde su FEIN llega con `'hipotecario'`
// y **sin garantía apuntada** —la escritura se firma después—, así que la
// cartera la llamaba «personal» teniendo el dato delante.

import { familiaDe } from '../datos';
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
