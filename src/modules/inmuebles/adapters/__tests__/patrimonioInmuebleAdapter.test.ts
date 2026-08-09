import type { MejoraInmueble, MuebleInmueble, Property } from '../../../../services/db';
import {
  calcularCosteAdquisicion,
  calcularMejorasAcumuladas,
  calcularMobiliarioAcumulado,
  calcularPatrimonioInmueble,
  type FinanciacionLineaInmueble,
  type ValoracionPunto,
} from '../patrimonioInmuebleAdapter';

const acquisitionCosts = (
  over: Partial<Property['acquisitionCosts']> = {},
): Property['acquisitionCosts'] => ({
  price: 200000,
  ...over,
});

const mejora = (over: Partial<MejoraInmueble> = {}): MejoraInmueble => ({
  inmuebleId: 1,
  ejercicio: 2024,
  descripcion: 'Reforma cocina',
  tipo: 'mejora',
  importe: 5000,
  fecha: '2024-03-01',
  createdAt: '2024-03-01',
  updatedAt: '2024-03-01',
  ...over,
});

const mueble = (over: Partial<MuebleInmueble> = {}): MuebleInmueble => ({
  inmuebleId: 1,
  ejercicio: 2024,
  descripcion: 'Sofá',
  fechaAlta: '2024-01-01',
  importe: 1200,
  vidaUtil: 10,
  activo: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...over,
});

const linea = (over: Partial<FinanciacionLineaInmueble> = {}): FinanciacionLineaInmueble => ({
  id: 'prestamo_1',
  nombre: 'Hipoteca BBVA',
  deudaPendiente: 120000,
  principalInicial: 160000,
  cuotaMensual: 650,
  porcentajeAfectacion: 100,
  ...over,
});

describe('calcularCosteAdquisicion', () => {
  it('suma precio, impuestos y todos los gastos incluyendo otros', () => {
    const total = calcularCosteAdquisicion(
      acquisitionCosts({
        itp: 12000,
        notary: 1000,
        registry: 500,
        management: 300,
        psi: 0,
        realEstate: 4000,
        other: [{ concept: 'Tasación', amount: 350 }],
      }),
    );
    expect(total).toBe(200000 + 12000 + 1000 + 500 + 300 + 4000 + 350);
  });

  it('devuelve 0 si no hay costes', () => {
    expect(calcularCosteAdquisicion(undefined)).toBe(0);
  });
});

describe('calcularMejorasAcumuladas', () => {
  it('excluye las reparaciones del CAPEX', () => {
    const total = calcularMejorasAcumuladas([
      mejora({ tipo: 'mejora', importe: 5000 }),
      mejora({ tipo: 'ampliacion', importe: 3000 }),
      mejora({ tipo: 'reparacion', importe: 800 }),
    ]);
    expect(total).toBe(8000);
  });
});

describe('calcularMobiliarioAcumulado', () => {
  it('excluye el mobiliario dado de baja', () => {
    const total = calcularMobiliarioAcumulado([
      mueble({ importe: 1200, activo: true }),
      mueble({ importe: 900, activo: false }),
    ]);
    expect(total).toBe(1200);
  });
});

describe('calcularPatrimonioInmueble', () => {
  const valoraciones: ValoracionPunto[] = [
    { fecha: '2022-01', valor: 205000 },
    { fecha: '2024-06', valor: 240000 },
  ];

  it('toma la última valoración como valor actual y calcula revalorización', () => {
    const r = calcularPatrimonioInmueble({
      acquisitionCosts: acquisitionCosts({ itp: 12000 }),
      valoraciones,
      financiacion: [linea({ deudaPendiente: 120000 })],
      mejoras: [],
      mobiliario: [],
    });

    expect(r.valorActual).toBe(240000);
    expect(r.fechaValorActual).toBe('2024-06');
    expect(r.costeAdquisicion).toBe(212000);
    expect(r.revalorizacion).toBe(28000);
    // Redondeado a 2 decimales por el adaptador.
    expect(r.revalorizacionPct).toBe(13.21);
    expect(r.deudaPendiente).toBe(120000);
    expect(r.patrimonioNeto).toBe(120000); // 240000 − 120000
    expect(r.patrimonioNetoEsEstimado).toBe(false);
    expect(r.ltv).toBeCloseTo(50, 4);
  });

  it('ordena el histórico descendente aunque la entrada venga desordenada', () => {
    const r = calcularPatrimonioInmueble({
      acquisitionCosts: acquisitionCosts(),
      valoraciones: [
        { fecha: '2024-06', valor: 240000 },
        { fecha: '2022-01', valor: 205000 },
      ],
      financiacion: [],
      mejoras: [],
      mobiliario: [],
    });
    expect(r.historicoValoraciones.map((v) => v.fecha)).toEqual(['2024-06', '2022-01']);
    expect(r.valorActual).toBe(240000);
  });

  it('usa el coste como proxy y marca estimado cuando no hay valoración', () => {
    const r = calcularPatrimonioInmueble({
      acquisitionCosts: acquisitionCosts({ itp: 12000 }),
      valoraciones: [],
      financiacion: [linea({ deudaPendiente: 100000 })],
      mejoras: [],
      mobiliario: [],
    });

    expect(r.valorActual).toBeNull();
    expect(r.revalorizacion).toBeNull();
    expect(r.revalorizacionPct).toBeNull();
    expect(r.ltv).toBeNull();
    expect(r.patrimonioNetoEsEstimado).toBe(true);
    expect(r.patrimonioNeto).toBe(112000); // 212000 coste − 100000 deuda
  });

  it('no cuenta mejoras ni mobiliario dentro del patrimonio neto', () => {
    const r = calcularPatrimonioInmueble({
      acquisitionCosts: acquisitionCosts(),
      valoraciones: [{ fecha: '2024-06', valor: 240000 }],
      financiacion: [],
      mejoras: [mejora({ importe: 5000 })],
      mobiliario: [mueble({ importe: 1200 })],
    });

    expect(r.mejorasAcumuladas).toBe(5000);
    expect(r.mobiliarioAcumulado).toBe(1200);
    expect(r.patrimonioNeto).toBe(240000); // sin sumar mejoras/mobiliario
    expect(r.tieneFinanciacion).toBe(false);
    expect(r.deudaPendiente).toBe(0);
  });
});
