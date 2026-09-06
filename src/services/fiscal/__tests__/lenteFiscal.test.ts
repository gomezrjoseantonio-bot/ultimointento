// E2.4.1c · la lente fiscal · lo único que convierte una clasificación del
// catálogo único en casilla del Modelo 100. El catálogo no sabe de casillas;
// esta lente lee familia + subtipo + ámbito y decide.

import {
  casillaDe,
  clasificacionDeCasilla,
  fiscalidadDe,
  storeDestinoDe,
  tratamientoDe,
} from '../lenteFiscal';
import { FAMILIAS, familiasDe } from '../../catalogo/catalogoUnico';

describe('casillaDe · sólo un gasto de INMUEBLE tiene casilla', () => {
  it('un gasto personal nunca lleva casilla, sea cual sea la familia', () => {
    for (const f of familiasDe('gasto')) {
      expect(casillaDe({ familia: f.id, ambito: 'personal' })).toBeUndefined();
    }
  });

  it('sin familia no hay casilla', () => {
    expect(casillaDe({ ambito: 'inmueble' })).toBeUndefined();
    expect(casillaDe({ familia: null, ambito: 'inmueble' })).toBeUndefined();
  });

  it('cada familia deducible va a su casilla', () => {
    const inm = (familia: Parameters<typeof casillaDe>[0]['familia'], subtipo?: string) =>
      casillaDe({ familia, subtipo, ambito: 'inmueble' });
    expect(inm('comunidad')).toBe('0109');
    expect(inm('comunidad', 'derrama')).toBe('0109');
    expect(inm('suministro', 'luz')).toBe('0113');
    expect(inm('seguros_alarmas', 'hogar')).toBe('0114');
    expect(inm('impuestos_tasas', 'ibi')).toBe('0115');
    expect(inm('reparacion_mantenimiento')).toBe('0106');
    expect(inm('gestion', 'gestoria')).toBe('0112');
    expect(inm('limpieza')).toBe('0112');
    expect(inm('mobiliario_enseres')).toBe('0117');
  });

  it('el seguro de VIDA va con la financiación y la ALARMA es un servicio', () => {
    expect(casillaDe({ familia: 'seguros_alarmas', subtipo: 'vida', ambito: 'inmueble' })).toBe('0105');
    expect(casillaDe({ familia: 'seguros_alarmas', subtipo: 'alarma', ambito: 'inmueble' })).toBe('0112');
  });

  it('la reforma, la cuota del préstamo y las familias personales no se restan por casilla', () => {
    expect(casillaDe({ familia: 'reforma_mejora', ambito: 'inmueble' })).toBeUndefined();
    expect(casillaDe({ familia: 'prestamo_hipoteca', ambito: 'inmueble' })).toBeUndefined();
    expect(casillaDe({ familia: 'supermercado', ambito: 'inmueble' })).toBeUndefined();
    expect(casillaDe({ familia: 'otros', ambito: 'inmueble' })).toBeUndefined();
  });
});

describe('storeDestinoDe · en qué tabla nace la línea', () => {
  it('la reforma se capitaliza · el mobiliario se amortiza · el resto es gasto', () => {
    expect(storeDestinoDe('reforma_mejora')).toBe('mejorasInmueble');
    expect(storeDestinoDe('mobiliario_enseres')).toBe('mueblesInmueble');
    expect(storeDestinoDe('comunidad')).toBe('gastosInmueble');
    expect(storeDestinoDe(undefined)).toBe('gastosInmueble');
  });
});

describe('tratamientoDe · cómo cuenta en la previsión de impuestos', () => {
  it('directo · 3 % · 10 % · nada', () => {
    expect(tratamientoDe({ familia: 'suministro', ambito: 'inmueble' })).toBe('deducibleDirecto');
    expect(tratamientoDe({ familia: 'reforma_mejora', ambito: 'inmueble' })).toBe('amortizable3');
    expect(tratamientoDe({ familia: 'mobiliario_enseres', ambito: 'inmueble' })).toBe('amortizable10');
    expect(tratamientoDe({ familia: 'prestamo_hipoteca', ambito: 'inmueble' })).toBe('noDeducible');
    expect(tratamientoDe({ familia: 'suministro', ambito: 'personal' })).toBe('noDeducible');
    expect(tratamientoDe({ ambito: 'inmueble' })).toBe('noDeducible');
  });
});

describe('fiscalidadDe · la frase que enseña una fila', () => {
  it('habla de la casilla y del tratamiento', () => {
    expect(fiscalidadDe({ familia: 'seguros_alarmas', subtipo: 'hogar', ambito: 'inmueble' })).toEqual({
      casilla: '0114',
      tratamiento: 'deducibleDirecto',
      frase: 'cuenta como seguros · deducible',
    });
    expect(fiscalidadDe({ familia: 'mobiliario_enseres', ambito: 'inmueble' }).frase).toMatch(/se amortiza al 10 %/);
    expect(fiscalidadDe({ familia: 'reforma_mejora', ambito: 'inmueble' }).frase).toBe(
      'cuenta como mejora · no se resta · se amortiza al 3 %',
    );
  });

  it('personal y sin clasificar lo dicen tal cual', () => {
    expect(fiscalidadDe({ familia: 'suministro', ambito: 'personal' }).frase).toBe('gasto personal · no deducible');
    expect(fiscalidadDe({ ambito: 'inmueble' }).frase).toBe('sin clasificar');
  });
});

describe('clasificacionDeCasilla · el camino inverso', () => {
  it('cada casilla de gasto vuelve a una familia del catálogo', () => {
    const ids = new Set(FAMILIAS.map((f) => f.id));
    for (const casilla of ['0105', '0106', '0109', '0112', '0113', '0114', '0115', '0117']) {
      const c = clasificacionDeCasilla(casilla);
      expect(c).toBeDefined();
      expect(ids.has(c!.familia)).toBe(true);
    }
  });

  it('ida y vuelta: la familia que da una casilla vuelve de ella (salvo las que comparten casilla)', () => {
    for (const familia of ['comunidad', 'suministro', 'seguros_alarmas', 'impuestos_tasas', 'reparacion_mantenimiento', 'mobiliario_enseres'] as const) {
      const casilla = casillaDe({ familia, ambito: 'inmueble' });
      expect(clasificacionDeCasilla(casilla)?.familia).toBe(familia);
    }
    // 0112 la comparten gestión y limpieza · vuelve a gestión.
    expect(clasificacionDeCasilla('0112')?.familia).toBe('gestion');
  });

  it('una casilla que no es de gasto no se etiqueta', () => {
    expect(clasificacionDeCasilla('0130')).toBeUndefined();
    expect(clasificacionDeCasilla(undefined)).toBeUndefined();
  });
});
