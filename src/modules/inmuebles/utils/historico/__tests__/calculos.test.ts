import type { Contract, Property } from '../../../../../services/db';
import {
  calcularDiasDesdeSalida,
  calcularDistribucionMotivosSalida,
  calcularDuracionMeses,
  calcularDuracionPorTipo,
  calcularKpisHistorico,
  calcularRotacionPorHabitacion,
  fechaCierreEfectiva,
  generarInsights,
  obtenerStatsPagos,
  textoCortoSalida,
  textoFianzaDevuelta,
  textoSalida,
} from '../calculos';

const c = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 1,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Ana', apellidos: 'García', dni: '', telefono: '', email: '' },
    fechaInicio: '2023-01-01',
    fechaFin: '2024-01-01',
    rentaMensual: 900,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 900,
    fianzaEstado: 'devuelta_total',
    cuentaCobroId: 0,
    estadoContrato: 'finalizado',
    ...overrides,
  }) as Contract;

const prop = (id: number, overrides: Partial<Property> = {}): Property =>
  ({
    id,
    alias: `INM-${id}`,
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '2020-01-01',
    squareMeters: 60,
    bedrooms: 3,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 100000 },
    documents: [],
    ...overrides,
  }) as Property;

describe('fechaCierreEfectiva', () => {
  it('prioriza fechaCierre sobre rescisión y fechaFin', () => {
    expect(
      fechaCierreEfectiva(c({ fechaCierre: '2023-11-15', rescision: { fecha: '2023-10-01', motivo: 'x' } })),
    ).toBe('2023-11-15');
  });
  it('usa rescisión cuando no hay fechaCierre', () => {
    expect(fechaCierreEfectiva(c({ rescision: { fecha: '2023-10-01', motivo: 'x' } }))).toBe('2023-10-01');
  });
  it('cae a fechaFin si no hay nada más', () => {
    expect(fechaCierreEfectiva(c())).toBe('2024-01-01');
  });
});

describe('calcularDuracionMeses', () => {
  it('un año ≈ 12 meses', () => {
    expect(Math.round(calcularDuracionMeses(c()))).toBe(12);
  });
  it('respeta fechaCierre anterior', () => {
    expect(Math.round(calcularDuracionMeses(c({ fechaCierre: '2023-07-01' })))).toBe(6);
  });
  it('0 si fechas inválidas', () => {
    expect(calcularDuracionMeses(c({ fechaInicio: 'x', fechaFin: 'y', fechaCierre: undefined }))).toBe(0);
  });
});

describe('calcularDiasDesdeSalida', () => {
  it('positivo para salida pasada', () => {
    const hoy = new Date('2024-02-01T00:00:00Z');
    expect(calcularDiasDesdeSalida(c({ fechaCierre: '2024-01-01' }), hoy)).toBe(31);
  });
  it('negativo para salida futura', () => {
    const hoy = new Date('2024-01-01T00:00:00Z');
    expect(calcularDiasDesdeSalida(c({ fechaCierre: '2024-01-11' }), hoy)).toBe(-10);
  });
});

describe('textoSalida / textoCortoSalida', () => {
  it('días recientes', () => {
    expect(textoSalida(47, c())).toBe('salió hace 47 días');
    expect(textoCortoSalida(47, c())).toBe('hace 47d');
  });
  it('hoy / ayer', () => {
    expect(textoSalida(0, c())).toBe('salió hoy');
    expect(textoSalida(1, c())).toBe('salió ayer');
  });
  it('convierte a meses pasados 60 días', () => {
    expect(textoSalida(90, c())).toMatch(/meses$/);
    expect(textoCortoSalida(90, c())).toMatch(/m$/);
  });
});

describe('textoFianzaDevuelta', () => {
  it('— si pendiente (undefined)', () => {
    expect(textoFianzaDevuelta(c({ fianzaDevuelta: undefined }))).toBe('—');
  });
  it('retenida total si 0', () => {
    expect(textoFianzaDevuelta(c({ fianzaDevuelta: 0 }))).toBe('Retenida total');
  });
  it('íntegra cuando coincide con la original', () => {
    expect(textoFianzaDevuelta(c({ fianzaImporte: 900, fianzaDevuelta: 900 }))).toMatch(/íntegra/);
  });
  it('parcial muestra "de"', () => {
    expect(textoFianzaDevuelta(c({ fianzaImporte: 900, fianzaDevuelta: 600 }))).toContain('de');
  });
  it('sin fianza original muestra solo el importe', () => {
    expect(textoFianzaDevuelta(c({ fianzaImporte: 0, fianzaDevuelta: 300 }))).toBe('300 €');
  });
});

describe('obtenerStatsPagos', () => {
  it('placeholder honesto · nulls mientras no hay servicio de cobros', () => {
    expect(obtenerStatsPagos(c())).toEqual({ alDia: null, conRetraso: null, impagos: null });
  });
});

describe('calcularKpisHistorico', () => {
  it('agrega total, duración media y valoración media', () => {
    const kpis = calcularKpisHistorico([
      c({ id: 1, valoracion: 4 }),
      c({ id: 2, fechaCierre: '2023-07-01', valoracion: 2 }),
    ]);
    expect(kpis.totalFinalizados).toBe(2);
    expect(kpis.duracionMediaMeses).toBeGreaterThan(0);
    expect(kpis.valoracionMedia).toBe(3);
  });
  it('valoración media null si ninguno la tiene', () => {
    expect(calcularKpisHistorico([c()]).valoracionMedia).toBeNull();
  });
});

describe('calcularDistribucionMotivosSalida', () => {
  it('siempre devuelve 6 barras con porcentaje', () => {
    const dist = calcularDistribucionMotivosSalida([
      c({ id: 1, motivoFin: 'fin_natural' }),
      c({ id: 2, motivoFin: 'fin_natural' }),
      c({ id: 3, motivoFin: 'rescision_impago' }),
      c({ id: 4 }),
    ]);
    expect(dist).toHaveLength(6);
    const finNatural = dist.find((d) => d.motivo === 'fin_natural');
    expect(finNatural?.count).toBe(2);
    expect(finNatural?.pct).toBe(50);
  });
});

describe('calcularDuracionPorTipo', () => {
  it('separa larga y corta', () => {
    const rows = calcularDuracionPorTipo([
      c({ id: 1, modalidad: 'habitual' }),
      c({ id: 2, modalidad: 'temporada', fechaCierre: '2023-04-01' }),
    ]);
    const larga = rows.find((r) => r.tipo === 'larga');
    const corta = rows.find((r) => r.tipo === 'corta');
    expect(larga?.count).toBe(1);
    expect(corta?.count).toBe(1);
    expect(larga!.duracionMediaMeses).toBeGreaterThan(corta!.duracionMediaMeses);
  });
});

describe('calcularRotacionPorHabitacion', () => {
  it('cuenta por habitación cuando el inmueble es por habitaciones', () => {
    const p = prop(1, { alquilerPorHabitaciones: { activo: true, numeroHabitaciones: 3 } });
    const rot = calcularRotacionPorHabitacion(
      [
        c({ id: 1, inmuebleId: 1, unidadTipo: 'habitacion', habitacionId: 'hab-1' }),
        c({ id: 2, inmuebleId: 1, unidadTipo: 'habitacion', habitacionId: 'hab-1' }),
        c({ id: 3, inmuebleId: 1, unidadTipo: 'habitacion', habitacionId: 'hab-2' }),
      ],
      [p],
    );
    expect(rot).toHaveLength(1);
    expect(rot[0].celdas).toHaveLength(3);
    expect(rot[0].celdas[0].rotaciones).toBe(2);
    expect(rot[0].celdas[1].rotaciones).toBe(1);
    expect(rot[0].celdas[2].rotaciones).toBe(0);
  });
  it('una celda piso completo cuando no es por habitaciones', () => {
    const rot = calcularRotacionPorHabitacion([c({ inmuebleId: 1 })], [prop(1)]);
    expect(rot[0].celdas).toHaveLength(1);
    expect(rot[0].celdas[0].habitacion).toBeNull();
  });
});

describe('generarInsights', () => {
  it('vacío sin contratos', () => {
    const kpis = calcularKpisHistorico([]);
    expect(generarInsights([], kpis, [], [])).toEqual([]);
  });
  it('detecta motivo dominante y duración', () => {
    const contratos = [
      c({ id: 1, motivoFin: 'rescision_impago' }),
      c({ id: 2, motivoFin: 'rescision_impago' }),
    ];
    const kpis = calcularKpisHistorico(contratos);
    const motivos = calcularDistribucionMotivosSalida(contratos);
    const insights = generarInsights(contratos, kpis, [], motivos);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.length).toBeLessThanOrEqual(3);
  });
});
