// Fiscalidad derivada del concepto (§3.2/§4 · decisiones Jose).
import { fiscalidadDeConcepto, conceptoPregunta } from '../fiscalidadConcepto';

describe('fiscalidadConcepto · derivación del catálogo', () => {
  it('un suministro cuenta como suministros y es deducible directo', () => {
    const f = fiscalidadDeConcepto('suministros', 'luz');
    expect(f.familia).toBe('suministros');
    expect(f.tratamiento).toBe('deducibleDirecto');
    expect(f.pregunta).toBe(false);
    expect(f.frase).toMatch(/deducible/);
  });

  it('IBI y basuras caen en IBI y tasas', () => {
    expect(fiscalidadDeConcepto('tributos', 'ibi').familia).toBe('ibi_tasas');
    expect(fiscalidadDeConcepto('tributos', 'tasa_basuras').familia).toBe('ibi_tasas');
  });

  it('la cuota de comunidad cuenta como comunidad', () => {
    expect(fiscalidadDeConcepto('comunidad', 'cuota_ordinaria').familia).toBe('comunidad');
  });
});

describe('fiscalidadConcepto · la excepción que pregunta', () => {
  it('la derrama pregunta y, sin respuesta, queda sin resolver', () => {
    const f = fiscalidadDeConcepto('comunidad', 'derrama');
    expect(f.pregunta).toBe(true);
    expect(f.esDerrama).toBe(true);
    expect(f.familia).toBeNull();
  });

  it('derrama marcada como mejora → mejora, amortizable al 3 %', () => {
    const f = fiscalidadDeConcepto('comunidad', 'derrama', 'mejora');
    expect(f.familia).toBe('mejora');
    expect(f.tratamiento).toBe('amortizable3');
    expect(f.frase).toMatch(/3 %/);
  });

  it('«Otro» también pregunta', () => {
    expect(conceptoPregunta('otros', 'personalizado')).toBe(true);
    expect(fiscalidadDeConcepto('otros', 'personalizado').pregunta).toBe(true);
  });
});

describe('fiscalidadConcepto · la elección manual SIEMPRE manda (seguro de vida)', () => {
  it('un seguro (que no pregunta) con familia manual de financiación → financiación', () => {
    // Seguro de vida vinculado a la hipoteca: el alta fija intereses_financiacion.
    const f = fiscalidadDeConcepto('seguros', 'vida', 'intereses_financiacion');
    expect(f.familia).toBe('intereses_financiacion');
    expect(f.frase).toMatch(/intereses de financiación/i);
  });

  it('seguro de vida NO vinculado → no deducible', () => {
    const f = fiscalidadDeConcepto('seguros', 'vida', 'no_deducible');
    expect(f.familia).toBe('no_deducible');
    expect(f.frase).toMatch(/no deducible/);
  });
});

describe('desde la unificación · se deriva del concepto', () => {
  it('acepta el id de concepto directamente', () => {
    expect(fiscalidadDeConcepto('luz').familia).toBe('suministros');
    expect(fiscalidadDeConcepto('gestoria').familia).toBe('servicios_profesionales');
  });

  it('«Servicios y explotación» cuenta como servicios profesionales', () => {
    // Familia nueva de la unificación · antes caía en `no_deducible` porque
    // `familiaBaseDe` no la conocía, y sus gastos van a la casilla 0112.
    expect(fiscalidadDeConcepto('limpieza').familia).toBe('servicios_profesionales');
    expect(fiscalidadDeConcepto('lavanderia').tratamiento).toBe('deducibleDirecto');
  });

  it('el mobiliario se amortiza al 10 %, no es «no deducible» ni «mejora»', () => {
    // Casilla 0117 · la mejora amortiza al 3 % sobre el inmueble, el mobiliario
    // al 10 % en diez años. Meterlos en el mismo saco los declara mal.
    const f = fiscalidadDeConcepto('muebles');
    expect(f.familia).toBe('amortizacion_muebles');
    expect(f.tratamiento).toBe('amortizable10');
  });

  it('un gasto personal corriente no se resta de nada', () => {
    expect(fiscalidadDeConcepto('supermercado').tratamiento).toBe('noDeducible');
    expect(fiscalidadDeConcepto('gimnasio').tratamiento).toBe('noDeducible');
  });

  it('sólo preguntan la derrama y el personalizado', () => {
    expect(conceptoPregunta('derrama')).toBe(true);
    expect(conceptoPregunta('personalizado')).toBe(true);
    // Un «otros» de familia SÍ tiene tratamiento · lo trae su familia. Antes
    // preguntaba por llamarse `otros`, aunque la capa de persistencia ya
    // hubiera decidido su casilla — el desacuerdo que la unificación quita.
    expect(conceptoPregunta('otros_suministros')).toBe(false);
    expect(conceptoPregunta('otros_gestion')).toBe(false);
    expect(fiscalidadDeConcepto('otros_suministros').familia).toBe('suministros');
  });

  it('un concepto desconocido pregunta · no se deriva de la nada', () => {
    expect(conceptoPregunta('no_existe')).toBe(true);
    expect(conceptoPregunta(undefined)).toBe(true);
    expect(fiscalidadDeConcepto('no_existe').familia).toBeNull();
  });
});
