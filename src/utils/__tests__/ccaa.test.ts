// H2 · mapeo CCAA AEAT (codigoCADeclaracion → nombre legible).
import { nombreCCAA, CCAA_AEAT } from '../ccaa';

describe('nombreCCAA', () => {
  it('mapea el código real del XML · 12 = Madrid', () => {
    expect(nombreCCAA('12')).toBe('Madrid');
    expect(nombreCCAA(12)).toBe('Madrid');
  });

  it('mapea otros códigos de régimen común', () => {
    expect(nombreCCAA('01')).toBe('Andalucía');
    expect(nombreCCAA('9')).toBe('Cataluña'); // normaliza a 2 dígitos
    expect(nombreCCAA('11')).toBe('Galicia');
    expect(nombreCCAA('15')).toBe('Comunitat Valenciana');
  });

  it('sin valor → "No especificada"', () => {
    expect(nombreCCAA(undefined)).toBe('No especificada');
    expect(nombreCCAA(null)).toBe('No especificada');
    expect(nombreCCAA('')).toBe('No especificada');
  });

  it('código desconocido → fallback legible', () => {
    expect(nombreCCAA('99')).toBe('CCAA 99');
  });

  it('si ya recibe un nombre, lo devuelve tal cual', () => {
    expect(nombreCCAA('Madrid')).toBe('Madrid');
  });

  it('la tabla cubre los 15 códigos de régimen común', () => {
    expect(Object.keys(CCAA_AEAT)).toHaveLength(15);
  });
});
