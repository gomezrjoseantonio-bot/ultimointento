import {
  siglaComunidad,
  referenciaInmueble,
  SIGLA_SIN_COMUNIDAD,
} from '../referenciaInmueble';

describe('siglaComunidad', () => {
  it('mapea las comunidades por su nombre almacenado', () => {
    expect(siglaComunidad('Asturias')).toBe('AST');
    expect(siglaComunidad('Madrid')).toBe('MAD');
    expect(siglaComunidad('Cataluña')).toBe('CAT');
    expect(siglaComunidad('Galicia')).toBe('GAL');
    expect(siglaComunidad('Murcia')).toBe('MUR');
  });

  it('tolera variantes de nombre (idioma, acentos, prefijos)', () => {
    expect(siglaComunidad('Catalunya')).toBe('CAT');
    expect(siglaComunidad('CATALUÑA')).toBe('CAT');
    expect(siglaComunidad('Comunidad de Madrid')).toBe('MAD');
    expect(siglaComunidad('Comunitat Valenciana')).toBe('VAL');
    expect(siglaComunidad('Illes Balears')).toBe('BAL');
    expect(siglaComunidad('Islas Baleares')).toBe('BAL');
    expect(siglaComunidad('Principado de Asturias')).toBe('AST');
  });

  it('resuelve las que el normalizador fiscal no mapea explícitamente', () => {
    expect(siglaComunidad('País Vasco')).toBe('PVA');
    expect(siglaComunidad('Euskadi')).toBe('PVA');
    expect(siglaComunidad('Navarra')).toBe('NAV');
    expect(siglaComunidad('Comunidad Foral de Navarra')).toBe('NAV');
    expect(siglaComunidad('Ceuta')).toBe('CEU');
    expect(siglaComunidad('Melilla')).toBe('MEL');
  });

  it('usa el prefijo genérico cuando no hay comunidad informada', () => {
    expect(siglaComunidad('')).toBe(SIGLA_SIN_COMUNIDAD);
    expect(siglaComunidad(null)).toBe(SIGLA_SIN_COMUNIDAD);
    expect(siglaComunidad(undefined)).toBe(SIGLA_SIN_COMUNIDAD);
    expect(siglaComunidad('   ')).toBe(SIGLA_SIN_COMUNIDAD);
  });
});

describe('referenciaInmueble', () => {
  it('compone sigla de comunidad + id con dos dígitos', () => {
    expect(referenciaInmueble({ id: 1, ccaa: 'Asturias' })).toBe('AST-01');
    expect(referenciaInmueble({ id: 12, ccaa: 'Cataluña' })).toBe('CAT-12');
    expect(referenciaInmueble({ id: 7, ccaa: 'Madrid' })).toBe('MAD-07');
  });

  it('es estable: el mismo inmueble da la misma referencia (no depende de la posición)', () => {
    const inmueble = { id: 4, ccaa: 'Asturias' };
    expect(referenciaInmueble(inmueble)).toBe('AST-04');
    expect(referenciaInmueble(inmueble)).toBe('AST-04');
  });

  it('cae al prefijo genérico cuando el inmueble no tiene comunidad (p. ej. importados)', () => {
    expect(referenciaInmueble({ id: 3, ccaa: '' })).toBe('INM-03');
  });
});
