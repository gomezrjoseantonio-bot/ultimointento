// Desglose de la declaración · gestión delegada · la comisión de la agencia
// (incluida en gastosDeducibles · casilla 0112) se muestra como línea propia,
// y las dos líneas de gasto suman el total de deducibles (sin doble cómputo).

import { buildSecciones } from '../DeclaracionCompletaPage';
import type { DatosFiscalesEjercicio } from '../../../../services/fiscalResolverService';

const datosConInmueble = (inm: Record<string, unknown>): DatosFiscalesEjercicio =>
  ({
    rendimientosTrabajo: null,
    rendimientosActividades: null,
    rendimientosInmuebles: 0,
    declaracionCompleta: { baseGeneral: { rendimientosInmuebles: [inm] } },
  }) as unknown as DatosFiscalesEjercicio;

const filasInmueble = (secciones: ReturnType<typeof buildSecciones>) =>
  secciones.find((s) => s.id === 'inmuebles')?.subsecciones?.[0]?.filas ?? [];

describe('buildSecciones · comisión de gestión como línea propia', () => {
  it('desglosa comisión + otros gastos · suman el total de deducibles', () => {
    const secciones = buildSecciones(
      datosConInmueble({
        inmuebleId: 9, alias: 'Piso 9',
        ingresosIntegros: 21600, gastosDeducibles: 6400, comisionGestion: 5400,
        amortizacion: 0, reduccionHabitual: 0, rendimientoNetoReducido: 15200,
        porcentajeReduccionHabitual: 0,
      }),
    );
    const filas = filasInmueble(secciones);
    const otros = filas.find((f) => f.label === 'Gastos deducibles');
    const comision = filas.find((f) => f.label === 'Comisión de gestión (agencia)');
    expect(otros?.valor).toBe(-1000); // 6400 − 5400
    expect(comision?.valor).toBe(-5400);
    // Las dos líneas de gasto suman el total de deducibles.
    expect((otros!.valor + comision!.valor)).toBe(-6400);
  });

  it('sin otros gastos (deducibles == comisión) · solo la línea de comisión', () => {
    const secciones = buildSecciones(
      datosConInmueble({
        inmuebleId: 9, alias: 'Piso 9',
        ingresosIntegros: 21600, gastosDeducibles: 5400, comisionGestion: 5400,
        amortizacion: 0, reduccionHabitual: 0, rendimientoNetoReducido: 16200,
        porcentajeReduccionHabitual: 0,
      }),
    );
    const filas = filasInmueble(secciones);
    expect(filas.find((f) => f.label === 'Gastos deducibles')).toBeUndefined();
    expect(filas.find((f) => f.label === 'Comisión de gestión (agencia)')?.valor).toBe(-5400);
  });

  it('sin gestión · una sola línea de gastos deducibles, sin comisión', () => {
    const secciones = buildSecciones(
      datosConInmueble({
        inmuebleId: 9, alias: 'Piso 9',
        ingresosIntegros: 9600, gastosDeducibles: 1200,
        amortizacion: 0, reduccionHabitual: 0, rendimientoNetoReducido: 8400,
        porcentajeReduccionHabitual: 0,
      }),
    );
    const filas = filasInmueble(secciones);
    expect(filas.find((f) => f.label === 'Gastos deducibles')?.valor).toBe(-1200);
    expect(filas.find((f) => f.label === 'Comisión de gestión (agencia)')).toBeUndefined();
  });
});
