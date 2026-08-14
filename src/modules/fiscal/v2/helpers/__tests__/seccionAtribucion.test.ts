import { buildSeccionB, buildSeccionAtribucion, buildSecciones } from '../ejercicioCasillasService';

/**
 * Régimen de atribución de rentas (Comunidad de Bienes) en la página Fiscal:
 * NO debe aparecer como un inmueble más en la sección B, sino en su propio
 * apartado del Modelo 100. El rendimiento atribuido llega del cálculo como un
 * inmueble sintético (inmuebleId === -1).
 *
 * Caso real: 1 inmueble propio (rendimiento 1.000) + CB Cangas atribuida 1.682,80.
 */
const buildDatos = (): any => ({
  casillas: null,
  resumen: {},
  declaracionCompleta: {
    baseGeneral: {
      rendimientosInmuebles: [
        { inmuebleId: 1, alias: 'Fuertes Acevedo', rendimientoNetoReducido: 1000, rendimientoNeto: 1000, diasAlquilado: 365, diasVacio: 0 },
        { inmuebleId: -1, alias: 'Entidades en atribución (1)', rendimientoNetoReducido: 1682.8, rendimientoNeto: 1682.8, diasAlquilado: 365, diasVacio: 0 },
      ],
    },
  },
});

describe('atribución de rentas en la página Fiscal', () => {
  it('la sección B NO cuenta ni lista la atribución como inmueble', () => {
    const { section, data } = buildSeccionB(buildDatos());
    expect(data.inmuebles).toHaveLength(1); // solo el inmueble propio
    expect(data.inmuebles[0].inmuebleId).toBe(1);
    expect(section.title).toContain('1 inmueble');
    expect(data.inmuebles.some((i: any) => i.inmuebleId === -1)).toBe(false);
    // Total de B = solo el rendimiento directo.
    expect(section.total).toBeCloseTo(1000, 2);
  });

  it('se crea el apartado "Régimen de atribución de rentas" con el importe atribuido', () => {
    const sec = buildSeccionAtribucion(buildDatos());
    expect(sec).not.toBeNull();
    expect(sec!.title).toBe('Régimen de atribución de rentas');
    expect(sec!.total).toBeCloseTo(1682.8, 2);
    expect(sec!.rows[0].concepto).toContain('atribución');
  });

  it('sin atribución no se crea el apartado', () => {
    const d: any = { casillas: null, resumen: {}, declaracionCompleta: { baseGeneral: { rendimientosInmuebles: [{ inmuebleId: 1, rendimientoNetoReducido: 1000 }] } } };
    expect(buildSeccionAtribucion(d)).toBeNull();
  });

  it('buildSecciones inserta el apartado entre D y E cuando hay atribución', () => {
    const { secciones } = buildSecciones(buildDatos());
    const letras = secciones.map((s) => s.letter);
    expect(letras).toContain('AR');
    // Va después de D (actividad) y antes de E (ganancias).
    expect(letras.indexOf('AR')).toBe(letras.indexOf('D') + 1);
    expect(letras.indexOf('E')).toBe(letras.indexOf('AR') + 1);
  });
});
