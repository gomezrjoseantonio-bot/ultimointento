// Tests · derivarSeriePatrimonio (C-PROY-5 · Fase B4)
// La salida canónica: un punto por año (cierre a diciembre) desde ProyeccionAnual[].

import { derivarSeriePatrimonio } from '../proyeccionMensualService';
import type { MonthlyProjectionRow, ProyeccionAnual } from '../../types/proyeccionMensual';

function mes(month: string, overrides: {
  rentas?: number;
  opex?: number;
  patrimonioNeto?: number;
  caja?: number;
  inmuebles?: number;
  planes?: number;
  otras?: number;
  deuda?: number;
} = {}): MonthlyProjectionRow {
  const {
    rentas = 1000, opex = 100, patrimonioNeto = 0,
    caja = 0, inmuebles = 0, planes = 0, otras = 0, deuda = 0,
  } = overrides;
  return {
    month,
    ingresos: {
      nomina: 0, serviciosFreelance: 0, pensiones: 0,
      rentasAlquiler: rentas, dividendosInversiones: 0, otrosIngresos: 0,
      total: rentas,
    },
    gastos: {
      gastosOperativos: opex, opexDesglose: [], gastosPersonales: 0,
      gastosAutonomo: 0, irpf: 0, total: opex,
    },
    financiacion: { cuotasHipotecas: 500, cuotasPrestamos: 0, total: 500 },
    tesoreria: { flujoCajaMes: rentas - opex - 500, cajaInicial: 0, cajaFinal: caja },
    patrimonio: {
      caja, inmuebles, planesPension: planes, otrasInversiones: otras,
      deudaInmuebles: deuda, deudaPersonal: 0, deudaTotal: deuda, patrimonioNeto,
    },
  };
}

function anual(year: number): ProyeccionAnual {
  const months = Array.from({ length: 12 }, (_, i) =>
    mes(`${year}-${String(i + 1).padStart(2, '0')}`, {
      rentas: 1000,
      opex: 100,
      // Diciembre lleva la foto de cierre que debe ganar
      ...(i === 11
        ? { patrimonioNeto: 250000, caja: 20000, inmuebles: 300000, planes: 15000, otras: 5000, deuda: 90000 }
        : { patrimonioNeto: 111111 }),
    }),
  );
  return {
    year,
    months,
    totalesAnuales: {
      ingresosTotales: 12000,
      gastosTotales: 1200,
      financiacionTotal: 6000,
      flujoNetoAnual: 4800,
      patrimonioNetoFinal: 250000,
    },
  };
}

describe('derivarSeriePatrimonio', () => {
  it('un punto por año · cierre a diciembre · sumas anuales correctas', () => {
    const serie = derivarSeriePatrimonio([anual(2026), anual(2027)]);

    expect(serie).toHaveLength(2);
    const p = serie[0];
    expect(p.año).toBe(2026);
    // Cierre = diciembre, no cualquier otro mes
    expect(p.patrimonioNeto).toBe(250000);
    expect(p.caja).toBe(20000);
    expect(p.inmuebles).toBe(300000);
    expect(p.inversiones).toBe(20000); // planes 15k + otras 5k
    expect(p.deudaTotal).toBe(90000);
    expect(p.activosTotales).toBe(20000 + 300000 + 15000 + 5000);
    // Flujos anuales
    expect(p.rentasAnuales).toBe(12000);
    expect(p.gastosOperativosAnuales).toBe(1200);
    expect(p.servicioDeudaAnual).toBe(6000);
    expect(p.flujoNetoAnual).toBe(4800);
    expect(serie[1].año).toBe(2027);
  });

  it('serie vacía si no hay proyecciones', () => {
    expect(derivarSeriePatrimonio([])).toEqual([]);
  });
});
