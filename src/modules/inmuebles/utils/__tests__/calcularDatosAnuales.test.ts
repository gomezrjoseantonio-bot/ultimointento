import {
  calcularDatosAnuales,
  mapearClaseOcupacion,
} from '../calcularDatosAnuales';
import type { Contract, Property } from '../../../../services/db';

const ANO = 2026;

const prop = (id: number, overrides: Partial<Property> = {}): Property =>
  ({
    id,
    alias: `Casa ${id}`,
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '2020-01-01',
    squareMeters: 60,
    bedrooms: 1,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 100000 },
    documents: [],
    ...overrides,
  }) as Property;

const con = (id: number, overrides: Partial<Contract> = {}): Contract =>
  ({
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '1', telefono: '', email: '' },
    fechaInicio: `${ANO - 1}-01-01`,
    fechaFin: '2099-12-31',
    rentaMensual: 800,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 800,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    ...overrides,
  }) as Contract;

const todasLasCeldasExistentes = (d: ReturnType<typeof calcularDatosAnuales>) =>
  d.meses.flatMap((m) => m.celdas.filter((c) => c.existe));

describe('calcularDatosAnuales', () => {
  it('1 · sin propiedades · ocupación media y stats a 0', () => {
    const d = calcularDatosAnuales([], [], ANO);
    expect(d.ocupacionMedia).toBe(0);
    expect(d.diasVaciosProyectados).toBe(0);
    expect(d.ingresosPerdidosProyectados).toBe(0);
    expect(d.meses).toHaveLength(12);
  });

  it('2 · vivienda con contrato indefinido · ocupación 100% · todo o100', () => {
    const d = calcularDatosAnuales([con(1)], [prop(1)], ANO);
    expect(d.ocupacionMedia).toBe(1);
    expect(d.diasVaciosProyectados).toBe(0);
    expect(todasLasCeldasExistentes(d).every((c) => c.clase === 'o100')).toBe(true);
  });

  it('3 · 5 habitaciones con 3 ocupadas indefinidas · ocupación 60% · o60', () => {
    const propiedad = prop(1, {
      bedrooms: 5,
      alquilerPorHabitaciones: { activo: true, numeroHabitaciones: 5 },
    });
    const contratos = [
      con(1, { unidadTipo: 'habitacion', habitacionId: 'h1' }),
      con(2, { unidadTipo: 'habitacion', habitacionId: 'h2' }),
      con(3, { unidadTipo: 'habitacion', habitacionId: 'h3' }),
    ];
    const d = calcularDatosAnuales(contratos, [propiedad], ANO);
    expect(d.ocupacionMedia).toBeCloseTo(0.6, 5);
    expect(todasLasCeldasExistentes(d).every((c) => c.clase === 'o60')).toBe(true);
  });

  it('4 · contrato hasta junio · 100% ene-jun · 0% jul-dic', () => {
    const c = con(1, { fechaInicio: `${ANO}-01-01`, fechaFin: `${ANO}-06-30` });
    const d = calcularDatosAnuales([c], [prop(1)], ANO);
    const ene1 = d.meses[0].celdas[0];
    const dic1 = d.meses[11].celdas[0];
    expect(ene1.ocupacion).toBe(1);
    expect(ene1.clase).toBe('o100');
    expect(dic1.ocupacion).toBe(0);
    expect(dic1.clase).toBe('o0');
  });

  it('5 · propiedad vendida no cuenta como arrendable', () => {
    const d = calcularDatosAnuales([con(1)], [prop(1, { state: 'vendido' })], ANO);
    expect(d.ocupacionMedia).toBe(0);
  });

  it('6 · piso completo solapado con habitaciones · cuenta como completo (sin doble conteo)', () => {
    const propiedad = prop(1, {
      bedrooms: 3,
      alquilerPorHabitaciones: { activo: true, numeroHabitaciones: 3 },
    });
    const contratos = [
      con(1, { unidadTipo: 'vivienda' }),
      con(2, { unidadTipo: 'habitacion', habitacionId: 'h1' }),
      con(3, { unidadTipo: 'habitacion', habitacionId: 'h2' }),
    ];
    const d = calcularDatosAnuales(contratos, [propiedad], ANO);
    expect(d.ocupacionMedia).toBe(1);
    expect(todasLasCeldasExistentes(d).every((c) => c.ocupacion <= 1)).toBe(true);
  });

  it('7 · el día de HOY se marca con esHoy y tooltip "HOY"', () => {
    const hoy = new Date();
    const anoActual = hoy.getFullYear();
    const c = con(1, { fechaInicio: `${anoActual - 1}-01-01` });
    const d = calcularDatosAnuales([c], [prop(1)], anoActual);
    const celdaHoy = d.meses[hoy.getMonth()].celdas[hoy.getDate() - 1];
    expect(celdaHoy.esHoy).toBe(true);
    expect(celdaHoy.tooltip.startsWith('HOY')).toBe(true);
  });

  it('8 · 30 de febrero no existe · clase n', () => {
    const d = calcularDatosAnuales([], [prop(1)], ANO);
    const feb30 = d.meses[1].celdas[29]; // índice 29 = día 30
    expect(feb30.existe).toBe(false);
    expect(feb30.clase).toBe('n');
    expect(feb30.ocupacion).toBe(-1);
  });

  it('9 · tooltip contiene fecha, ocupación y porcentaje', () => {
    const d = calcularDatosAnuales([con(1)], [prop(1)], ANO);
    const ene2 = d.meses[0].celdas[1]; // 2 ene · no es hoy en 2026
    expect(ene2.tooltip).toContain('ene');
    expect(ene2.tooltip).toContain('%');
    expect(ene2.tooltip).toContain('1/1');
  });

  it('10 · ingresos perdidos · 0 si lleno · positivo si hay huecos', () => {
    const lleno = calcularDatosAnuales([con(1)], [prop(1)], ANO);
    expect(lleno.ingresosPerdidosProyectados).toBe(0);

    const propiedad = prop(1, {
      bedrooms: 2,
      alquilerPorHabitaciones: { activo: true, numeroHabitaciones: 2 },
    });
    const conHueco = calcularDatosAnuales(
      [con(1, { unidadTipo: 'habitacion', habitacionId: 'h1', rentaMensual: 500 })],
      [propiedad],
      ANO,
    );
    expect(conHueco.ingresosPerdidosProyectados).toBeGreaterThan(0);
  });
});

describe('mapearClaseOcupacion', () => {
  it('mapea cada rango a su clase', () => {
    expect(mapearClaseOcupacion(1)).toBe('o100');
    expect(mapearClaseOcupacion(0.95)).toBe('o90');
    expect(mapearClaseOcupacion(0.85)).toBe('o80');
    expect(mapearClaseOcupacion(0.75)).toBe('o70');
    expect(mapearClaseOcupacion(0.6)).toBe('o60');
    expect(mapearClaseOcupacion(0.3)).toBe('o0');
    expect(mapearClaseOcupacion(0)).toBe('o0');
  });
});
