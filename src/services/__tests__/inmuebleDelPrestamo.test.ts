// De qué inmueble es un préstamo.
//
// El dato vive en `destinos[].inmuebleId`. El campo raíz `Prestamo.inmuebleId`
// está `@deprecated` y en los préstamos creados con la ficha actual viene
// vacío: el piso se elige en "Destino del capital", no en un campo suelto.
//
// Mirando solo el campo raíz —que es lo que hice— una hipoteca con su piso
// perfectamente puesto seguía sin decir de cuál era.

import { inmuebleDelPrestamo } from '../inmuebleDelPrestamo';

describe('inmuebleDelPrestamo', () => {
  // El caso real: hipoteca con destino "Adquisición inmueble · Fuertes
  // Acevedo 32" y el campo raíz sin nada.
  it('lo saca de `destinos` aunque el campo raíz esté vacío', () => {
    expect(
      inmuebleDelPrestamo({ destinos: [{ inmuebleId: '32' }] })
    ).toBe(32);
  });

  it('el campo raíz sigue valiendo para los préstamos antiguos', () => {
    expect(inmuebleDelPrestamo({ inmuebleId: '7' })).toBe(7);
  });

  it('manda `destinos` sobre el campo raíz', () => {
    expect(
      inmuebleDelPrestamo({ inmuebleId: '7', destinos: [{ inmuebleId: '32' }] })
    ).toBe(32);
  });

  it('con varios destinos coge el primero que apunte a un inmueble', () => {
    expect(
      inmuebleDelPrestamo({
        destinos: [{ inmuebleId: null }, { inmuebleId: '32' }, { inmuebleId: '48' }],
      })
    ).toBe(32);
  });

  // `'standalone'` es el centinela heredado de "sin inmueble". Convertirlo
  // daría NaN y dejaría el evento peor que sin tocar.
  it('no confunde el centinela `standalone` con un id', () => {
    expect(inmuebleDelPrestamo({ inmuebleId: 'standalone' })).toBeUndefined();
    expect(inmuebleDelPrestamo({ destinos: [{ inmuebleId: 'standalone' }] })).toBeUndefined();
  });

  it('un préstamo personal sin destino de inmueble no inventa ninguno', () => {
    expect(inmuebleDelPrestamo({})).toBeUndefined();
    expect(inmuebleDelPrestamo({ destinos: [] })).toBeUndefined();
    expect(inmuebleDelPrestamo({ inmuebleId: '' })).toBeUndefined();
  });
});
