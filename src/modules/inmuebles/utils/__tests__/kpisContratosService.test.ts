import { calcularKpisContratos } from '../kpisContratosService';
import type { Contract, Property } from '../../../../services/db';

// Fecha fija · el estado efectivo se calcula por fechas.
const HOY = new Date('2026-06-03T00:00:00Z');

const contrato = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'larga_estancia',
    inquilino: { nombre: 'Real', apellidos: 'Inquilino', dni: 'X', telefono: '', email: '' },
    fechaInicio: '2025-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 1000,
    diaPago: 1,
    estadoContrato: 'activo',
    ...over,
  }) as Contract;

const prop = (over: Partial<Property>): Property =>
  ({ id: 1, alias: 'P', bedrooms: 1, state: 'activo', modoExplotacion: 'piso_completo', ...over } as Property);

describe('calcularKpisContratos · KPIs operativos (Fase C)', () => {
  it('inmueblesActivos, unidadesArrendables y unidadesLibres', () => {
    const properties = [
      prop({ id: 1, alias: 'FA32', bedrooms: 4, modoExplotacion: 'por_habitaciones' }), // 4 unidades
      prop({ id: 2, alias: 'Piso', modoExplotacion: 'piso_completo' }), // 1 unidad
    ];
    const contracts = [
      contrato({ id: 1, inmuebleId: 1, unidadTipo: 'habitacion', habitacionId: 'H1' }),
      contrato({ id: 2, inmuebleId: 2 }),
    ];
    const kpis = calcularKpisContratos(contracts, properties, HOY);
    expect(kpis.inmueblesActivos).toBe(2);
    expect(kpis.unidadesArrendables).toBe(5);
    expect(kpis.vigentes).toBe(2);
    expect(kpis.unidadesLibres).toBe(3); // 5 - 2
    expect(kpis.ocupacion).toBe(40); // round(2/5*100)
  });

  it('inmuebles no activos no cuentan como inmuebles ni unidades', () => {
    const properties = [
      prop({ id: 1, state: 'activo' }),
      prop({ id: 2, state: 'vendido' }),
    ];
    const kpis = calcularKpisContratos([], properties, HOY);
    expect(kpis.inmueblesActivos).toBe(1);
    expect(kpis.unidadesArrendables).toBe(1);
    expect(kpis.unidadesLibres).toBe(1);
  });

  it('unidadesLibres nunca es negativo (sobre-ocupación defensiva)', () => {
    const properties = [prop({ id: 1, modoExplotacion: 'piso_completo' })]; // 1 unidad
    const contracts = [
      contrato({ id: 1, inmuebleId: 1 }),
      contrato({ id: 2, inmuebleId: 1 }),
    ];
    const kpis = calcularKpisContratos(contracts, properties, HOY);
    expect(kpis.unidadesLibres).toBe(0);
  });

  it('los borradores (sin_firmar) no cuentan en la ocupación ni en vigentes', () => {
    const properties = [prop({ id: 1, modoExplotacion: 'piso_completo' })]; // 1 unidad
    const contracts = [
      // Contrato real en vigor · ocupa la unidad.
      contrato({ id: 1, inmuebleId: 1, estadoContrato: 'activo' }),
      // Borrador con inquilino real y fechas en vigor: antes inflaba a 200 %.
      contrato({ id: 2, inmuebleId: 1, estadoContrato: 'sin_firmar', rentaMensual: 500 }),
    ];
    const kpis = calcularKpisContratos(contracts, properties, HOY);
    expect(kpis.vigentes).toBe(1); // solo el firmado
    expect(kpis.ocupacion).toBe(100); // no 200 %
    expect(kpis.unidadesLibres).toBe(0);
    expect(kpis.rentaMensual).toBe(1000); // la renta del borrador no se prevé
  });

  it('los subcontratos anexados (gestión delegada) no cuentan en el operativo', () => {
    const properties = [prop({ id: 1, modoExplotacion: 'piso_completo' })]; // 1 unidad
    const contracts = [
      // Contrato de gestión (padre) · renta garantizada · ocupa la unidad.
      contrato({
        id: 1,
        inmuebleId: 1,
        rentaMensual: 1350,
        gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] },
      }),
      // Subcontratos de inquilinos anexados al padre · fiscales · no operativo.
      contrato({ id: 2, inmuebleId: 1, gestionPadreId: 1, rentaMensual: 500 }),
      contrato({ id: 3, inmuebleId: 1, gestionPadreId: 1, rentaMensual: 450 }),
    ];
    const kpis = calcularKpisContratos(contracts, properties, HOY);
    expect(kpis.vigentes).toBe(1); // solo el padre
    expect(kpis.ocupacion).toBe(100); // no 300 %
    expect(kpis.rentaMensual).toBe(1350); // la renta garantizada, no la suma de subcontratos
  });

  it('los contratos sin identificar (AEAT) no cuentan en vigentes ni libres', () => {
    const properties = [prop({ id: 1, bedrooms: 2, modoExplotacion: 'por_habitaciones' })]; // 2 unidades
    const contracts = [
      contrato({ id: 1, inmuebleId: 1, unidadTipo: 'habitacion', habitacionId: 'H1' }),
      contrato({
        id: 2,
        inmuebleId: 1,
        estadoContrato: 'sin_identificar',
        inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' },
      }),
    ];
    const kpis = calcularKpisContratos(contracts, properties, HOY);
    expect(kpis.vigentes).toBe(1); // solo el identificado
    expect(kpis.unidadesLibres).toBe(1); // 2 - 1
  });
});
