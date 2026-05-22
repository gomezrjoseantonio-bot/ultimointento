import {
  generarPropiedadGroupData,
  textoBarraContrato,
  claseBarraContrato,
} from '../timelineLineas';
import { calcularRangoFechas } from '../timelineRango';
import type { Contract, Property } from '../../../../services/db';

const HOY = new Date(Date.UTC(2026, 4, 21));

const dayOffset = (days: number): string => {
  const d = new Date(HOY.getTime() + days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const prop = (bedrooms: number, id = 1): Property =>
  ({
    id,
    alias: `Casa ${id}`,
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '2020-01-01',
    squareMeters: 50,
    bedrooms,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 100000 },
    documents: [],
  }) as Property;

const c = (id: number, overrides: Partial<Contract> = {}): Contract & { id: number } =>
  ({
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'A', apellidos: 'B', dni: '', telefono: '', email: '' },
    fechaInicio: '2026-05-01',
    fechaFin: '2099-12-31',
    rentaMensual: 800,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 800,
    fianzaEstado: 'retenida',
    cuentaCobroId: 0,
    estadoContrato: 'activo',
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract & { id: number };

const rango = calcularRangoFechas('6m', HOY);

describe('generarPropiedadGroupData', () => {
  test('propiedad bedrooms=1 + 1 contrato piso · 1 línea "Piso" con contrato', () => {
    const { lineas, overlaysCompletos } = generarPropiedadGroupData(
      prop(1),
      [c(1)],
      rango,
      HOY,
    );
    expect(lineas).toHaveLength(1);
    expect(lineas[0].esPiso).toBe(true);
    expect(lineas[0].segmentos.find((s) => s.tipo === 'contrato')).toBeDefined();
    expect(overlaysCompletos).toHaveLength(0);
  });

  test('propiedad bedrooms=5 sin contratos · 5 líneas todas libres', () => {
    const { lineas } = generarPropiedadGroupData(prop(5), [], rango, HOY);
    expect(lineas).toHaveLength(5);
    expect(lineas[0].habitacionNumero).toBe(1);
    expect(lineas[4].habitacionNumero).toBe(5);
    for (const l of lineas) {
      expect(l.segmentos.every((s) => s.tipo === 'libre')).toBe(true);
    }
  });

  test('propiedad bedrooms=5 + 5 contratos habitacion · cada uno en su línea', () => {
    const contratos = [
      c(1, { unidadTipo: 'habitacion', habitacionId: 'hab-1' }),
      c(2, { unidadTipo: 'habitacion', habitacionId: 'hab-2' }),
      c(3, { unidadTipo: 'habitacion', habitacionId: 'hab-3' }),
      c(4, { unidadTipo: 'habitacion', habitacionId: 'hab-4' }),
      c(5, { unidadTipo: 'habitacion', habitacionId: 'hab-5' }),
    ];
    const { lineas, overlaysCompletos } = generarPropiedadGroupData(
      prop(5),
      contratos,
      rango,
      HOY,
    );
    expect(lineas).toHaveLength(5);
    for (const linea of lineas) {
      expect(linea.segmentos.find((s) => s.tipo === 'contrato')).toBeDefined();
    }
    expect(overlaysCompletos).toHaveLength(0);
  });

  test('propiedad bedrooms=5 + 1 contrato piso (vacacional verano) · overlay generado', () => {
    const contratos = [c(1, { unidadTipo: 'vivienda', modalidad: 'vacacional' })];
    const { lineas, overlaysCompletos } = generarPropiedadGroupData(
      prop(5),
      contratos,
      rango,
      HOY,
    );
    expect(lineas).toHaveLength(5);
    expect(overlaysCompletos).toHaveLength(1);
    expect(overlaysCompletos[0].claseBarra).toBe('vigente-c');
  });

  test('hueco entre rango inicio y primer contrato · segmento libre', () => {
    const futuro = c(1, {
      unidadTipo: 'habitacion',
      habitacionId: 'hab-1',
      fechaInicio: dayOffset(30),
      fechaFin: '2099-12-31',
    });
    const { lineas } = generarPropiedadGroupData(
      prop(2),
      [futuro],
      rango,
      HOY,
    );
    const linea1 = lineas[0];
    expect(linea1.segmentos[0].tipo).toBe('libre');
    expect(linea1.segmentos[1].tipo).toBe('contrato');
  });

  test('contrato indefinido (2099-12-31) · NO hueco al final', () => {
    const { lineas } = generarPropiedadGroupData(
      prop(1),
      [c(1, { fechaFin: '2099-12-31', fechaInicio: dayOffset(-60) })],
      rango,
      HOY,
    );
    const libresAlFinal = lineas[0].segmentos.filter(
      (s, i, arr) => s.tipo === 'libre' && i === arr.length - 1,
    );
    expect(libresAlFinal).toHaveLength(0);
  });

  test('contrato sin firmar · clase pendiente-firma', () => {
    const sinFirmar = c(1, {
      firma: { metodo: 'digital', estado: 'enviado' },
      fechaFirmaContrato: undefined,
    });
    expect(claseBarraContrato(sinFirmar, HOY)).toBe('pendiente-firma');
  });

  test('texto de barra de contrato firmado al día · "nombre · larga · renta"', () => {
    const ct = c(1, {
      inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '', telefono: '', email: '' },
      rentaMensual: 1350,
    });
    expect(textoBarraContrato(ct, HOY)).toContain('Juan Calvo');
    expect(textoBarraContrato(ct, HOY)).toContain('larga');
    // Permitir 1350 o 1.350 según locale del entorno de test
    expect(textoBarraContrato(ct, HOY)).toMatch(/1[.\s]?350/);
  });

  test('contrato renovado en últimos 30d · clase y texto "renovado"', () => {
    const ren = c(1, {
      historicoRentas: [
        { fechaDesde: dayOffset(-10), importe: 850, origen: 'renegociacion' },
      ],
    });
    expect(claseBarraContrato(ren, HOY)).toBe('renovado');
    expect(textoBarraContrato(ren, HOY)).toContain('renovado');
  });

  test('contrato corta vacacional · clase vigente-c', () => {
    const corta = c(1, { modalidad: 'vacacional' });
    expect(claseBarraContrato(corta, HOY)).toBe('vigente-c');
  });

  test('propiedad mixta · 5 hab + 1 vivienda · cada línea sigue teniendo su segmento + overlay sobrepuesto', () => {
    const contratos = [
      c(10, {
        unidadTipo: 'vivienda',
        modalidad: 'vacacional',
        fechaInicio: dayOffset(30),
        fechaFin: dayOffset(90),
      }),
      c(11, { unidadTipo: 'habitacion', habitacionId: 'hab-1' }),
    ];
    const { lineas, overlaysCompletos } = generarPropiedadGroupData(
      prop(5),
      contratos,
      rango,
      HOY,
    );
    expect(lineas).toHaveLength(5);
    expect(overlaysCompletos).toHaveLength(1);
    // Línea 1 tiene un contrato propio (hab-1)
    expect(
      lineas[0].segmentos.find((s) => s.tipo === 'contrato'),
    ).toBeDefined();
  });

  test('ignora contratos con fechas inválidas sin crashear', () => {
    const invalido = c(1, {
      unidadTipo: 'habitacion',
      habitacionId: 'hab-1',
      fechaFin: 'invalid-date',
    });
    expect(() => generarPropiedadGroupData(prop(2), [invalido], rango, HOY)).not.toThrow();
  });
});

describe('claseBarraContrato · prioridades', () => {
  test('impago tendría prioridad sobre vencimiento si hubiese servicio (T3.6) · hoy devuelve vigente-l por ausencia de servicio', () => {
    const ct = c(1);
    expect(claseBarraContrato(ct, HOY)).toBe('vigente-l');
  });

  test('firma pendiente prioritario · clase pendiente-firma', () => {
    const ct = c(1, { firma: { metodo: 'digital', estado: 'borrador' }, fechaFirmaContrato: undefined });
    expect(claseBarraContrato(ct, HOY)).toBe('pendiente-firma');
  });
});
