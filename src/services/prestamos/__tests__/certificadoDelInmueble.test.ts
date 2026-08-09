// El certificado energético · la única condición de una hipoteca que no se
// prueba con dinero.
//
// «Si se tiene o no se tiene se dice una vez · podemos implementarlo en el alta
// del piso» *(Jose · 8 ago 2026)*.

import { inmuebleDelPrestamo, letraAlcanza } from '../certificadoDelInmueble';
import type { Prestamo } from '../../../types/prestamos';

const prestamo = (over: Partial<Prestamo> = {}): Prestamo =>
  ({ id: 'p1', ...over }) as Prestamo;

describe('qué inmueble financia el préstamo', () => {
  it('el del destino', () => {
    const p = prestamo({
      destinos: [{ tipo: 'ADQUISICION', inmuebleId: '7' }],
    } as Partial<Prestamo>);

    expect(inmuebleDelPrestamo(p)).toBe('7');
  });

  // Los préstamos anteriores a que existieran los destinos lo llevan en la raíz
  // · sin el respaldo, su certificado no se miraría nunca.
  it('y si no hay destinos, el de la raíz', () => {
    expect(inmuebleDelPrestamo(prestamo({ inmuebleId: '3' }))).toBe('3');
  });

  it('un préstamo personal no financia ninguno', () => {
    expect(inmuebleDelPrestamo(prestamo())).toBeUndefined();
  });
});

// A→G es el orden que publica el propio certificado · «al menos C» se cumple
// con A, con B y con C. Lo que sí sería inventarse una equivalencia es
// traducirlas a números.
describe('si la letra alcanza la que pide el anexo', () => {
  it('una A cumple una condición de «al menos C»', () => {
    expect(letraAlcanza('A', 'C')).toBe(true);
  });

  it('la propia letra pedida cumple', () => {
    expect(letraAlcanza('C', 'C')).toBe(true);
  });

  it('y una peor no', () => {
    expect(letraAlcanza('E', 'C')).toBe(false);
  });

  it('sin importar mayúsculas ni espacios', () => {
    expect(letraAlcanza(' b ', 'c')).toBe(true);
  });

  // Ni el anexo ni el dato guardado se resuelven adivinando · de aquí sale un
  // «no se puede comprobar», no un veredicto.
  it('una letra que no está en la escala no se resuelve', () => {
    expect(letraAlcanza('A', 'B+')).toBeNull();
    expect(letraAlcanza('Z', 'C')).toBeNull();
  });
});
