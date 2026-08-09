import { calcularRentabilidadInmueble } from '../rentabilidadInmuebleAdapter';

describe('calcularRentabilidadInmueble', () => {
  it('distingue resultado estimado (previsto) del real (cobrado/pagado)', () => {
    const r = calcularRentabilidadInmueble({
      costeAdquisicion: 200000,
      ejercicio: 2026,
      ingresosPrevistosAnual: 12000,
      ingresosCobradosAnual: 9000,
      gastosPrevistosAnual: 3000,
      gastosPagadosAnual: 2500,
      cuotaPrestamoAnual: 7800,
    });

    expect(r.resultadoOperativoEstimado).toBe(9000); // 12000 − 3000
    expect(r.resultadoOperativoReal).toBe(6500); // 9000 − 2500
    // Bruta prefiere lo cobrado (real): 9000/200000 = 4.5 %
    expect(r.rentabilidadBruta).toEqual({ valor: 4.5, etiqueta: 'real' });
    // Neta prefiere el resultado real: 6500/200000 = 3.25 %
    expect(r.rentabilidadNeta).toEqual({ valor: 3.25, etiqueta: 'real' });
    expect(r.cashflowEstimado).toBe(1200); // 9000 − 7800
    expect(r.cashflowReal).toBe(-1300); // 6500 − 7800
  });

  it('cae a previsto/estimado cuando no hay datos reales', () => {
    const r = calcularRentabilidadInmueble({
      costeAdquisicion: 200000,
      ejercicio: 2026,
      ingresosPrevistosAnual: 12000,
      gastosPrevistosAnual: 3000,
    });

    expect(r.ingresosCobrados).toBeUndefined();
    expect(r.resultadoOperativoReal).toBeUndefined();
    expect(r.rentabilidadBruta).toEqual({ valor: 6, etiqueta: 'previsto' });
    expect(r.rentabilidadNeta).toEqual({ valor: 4.5, etiqueta: 'estimado' }); // 9000/200000
    expect(r.cashflowReal).toBeUndefined();
    expect(r.cashflowEstimado).toBe(9000); // sin cuota
  });

  it('sin coste no calcula rentabilidades pero sí resultados', () => {
    const r = calcularRentabilidadInmueble({
      costeAdquisicion: 0,
      ejercicio: 2026,
      ingresosCobradosAnual: 9000,
      gastosPagadosAnual: 2500,
    });
    expect(r.rentabilidadBruta).toBeUndefined();
    expect(r.rentabilidadNeta).toBeUndefined();
    expect(r.resultadoOperativoReal).toBe(6500);
  });

  it('no calcula resultado si falta uno de los dos lados', () => {
    const r = calcularRentabilidadInmueble({
      costeAdquisicion: 200000,
      ejercicio: 2026,
      ingresosCobradosAnual: 9000, // sin gastosPagados
      gastosPrevistosAnual: 3000, // sin ingresosPrevistos
    });
    expect(r.resultadoOperativoReal).toBeUndefined();
    expect(r.resultadoOperativoEstimado).toBeUndefined();
    // Bruta sí, porque hay ingresos cobrados y coste.
    expect(r.rentabilidadBruta).toEqual({ valor: 4.5, etiqueta: 'real' });
  });
});
