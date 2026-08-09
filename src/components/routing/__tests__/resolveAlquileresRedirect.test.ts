import { resolveAlquileresRedirect } from '../resolveAlquileresRedirect';

describe('resolveAlquileresRedirect · alias Fase B', () => {
  it('/alquileres → /contratos', () => {
    expect(resolveAlquileresRedirect('/alquileres', '')).toBe('/contratos');
  });

  it('/alquileres/nuevo → /contratos/nuevo (preserva sufijo)', () => {
    expect(resolveAlquileresRedirect('/alquileres/nuevo', '')).toBe('/contratos/nuevo');
  });

  it('/alquileres/lista → /contratos/lista', () => {
    expect(resolveAlquileresRedirect('/alquileres/lista', '')).toBe('/contratos/lista');
  });

  it('preserva el query ?tab=vigentes', () => {
    expect(resolveAlquileresRedirect('/alquileres', '?tab=vigentes')).toBe(
      '/contratos?tab=vigentes',
    );
  });

  it('preserva el query en sub-ruta (?inmueble=3 en /nuevo)', () => {
    expect(resolveAlquileresRedirect('/alquileres/nuevo', '?inmueble=3')).toBe(
      '/contratos/nuevo?inmueble=3',
    );
  });
});
