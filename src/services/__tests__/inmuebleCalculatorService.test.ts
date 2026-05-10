import { calcularInmuebleResumen } from '../inmuebleCalculatorService';

describe('calcularInmuebleResumen · S-WIZARD-INMUEBLE-V4', () => {
  it('caso del mockup · Piso Centro Madrid · coincide al céntimo', () => {
    const r = calcularInmuebleResumen({
      precio: 245000,
      valorReferencia: 245000,
      formalizacion: { notaria: 1250, registro: 850, gestoria: 600, otros: 350 },
      impuestos: 14700,
      valorCatastralTotal: 89500,
      valorCatastralConstruccion: 53700,
      diasArrendado: 365,
      mejorasPosteriores: [],
    });
    // 245000 + (1250+850+600+350=3050) + 14700 = 262750
    expect(r.costeBaseAdquisicion).toBe(262750);
    expect(r.costeTotalFormalizacion).toBe(3050);
    // 53700 / 89500 = 60%
    expect(r.porcentajeConstruccion).toBe(60);
    // costeConstruccion = 262750 * 60% = 157650
    // baseAmortizable = max(157650, 53700) = 157650
    expect(r.baseAmortizable).toBe(157650);
    // amortización 3% = 4729.50
    expect(r.amortizacionAnual).toBe(4729.5);
    expect(r.amortizacionProrrateada).toBe(4729.5);
    expect(r.porcentajeOcupacion).toBe(100);
  });

  it('mejoras tipo "mejora" suman a base de cálculo, "reparacion" no', () => {
    const r = calcularInmuebleResumen({
      precio: 245000,
      valorReferencia: 245000,
      formalizacion: { notaria: 1250, registro: 850, gestoria: 600, otros: 350 },
      impuestos: 14700,
      valorCatastralTotal: 89500,
      valorCatastralConstruccion: 53700,
      diasArrendado: 365,
      mejorasPosteriores: [
        { importe: 8500, tipo: 'mejora' },
        { importe: 1200, tipo: 'reparacion' },
      ],
    });
    expect(r.costeMejorasPosteriores).toBe(8500);
    // (262750 + 8500) * 60% = 162750
    expect(r.costeConstruccion).toBe(162750);
    expect(r.baseAmortizable).toBe(162750);
  });

  it('si V.cat construcción > coste construcción · base = V.cat construcción', () => {
    const r = calcularInmuebleResumen({
      precio: 100000,
      valorReferencia: 100000,
      formalizacion: { notaria: 0, registro: 0, gestoria: 0, otros: 0 },
      impuestos: 0,
      valorCatastralTotal: 200000,
      valorCatastralConstruccion: 150000,
      diasArrendado: 365,
      mejorasPosteriores: [],
    });
    // costeConstruccion = 100000 * 75% = 75000
    // V.cat construcción = 150000 → base = 150000
    expect(r.baseAmortizable).toBe(150000);
    expect(r.amortizacionAnual).toBe(4500);
  });

  it('días arrendado prorratea amortización', () => {
    const r = calcularInmuebleResumen({
      precio: 100000,
      valorReferencia: 100000,
      formalizacion: { notaria: 0, registro: 0, gestoria: 0, otros: 0 },
      impuestos: 0,
      valorCatastralTotal: 100000,
      valorCatastralConstruccion: 60000,
      diasArrendado: 180,
      mejorasPosteriores: [],
    });
    // base = 60000 (=60% de 100000), amortAnual = 1800
    expect(r.amortizacionAnual).toBe(1800);
    // prorrateada = 1800 * 180/365 = 887.67
    expect(r.amortizacionProrrateada).toBeCloseTo(887.67, 1);
    expect(r.porcentajeOcupacion).toBeCloseTo(49.32, 1);
  });

  it('valor catastral total a 0 · % construcción = 0 · base = 0', () => {
    const r = calcularInmuebleResumen({
      precio: 100000,
      valorReferencia: 100000,
      formalizacion: { notaria: 0, registro: 0, gestoria: 0, otros: 0 },
      impuestos: 0,
      valorCatastralTotal: 0,
      valorCatastralConstruccion: 0,
      diasArrendado: 365,
      mejorasPosteriores: [],
    });
    expect(r.porcentajeConstruccion).toBe(0);
    expect(r.baseAmortizable).toBe(0);
    expect(r.amortizacionAnual).toBe(0);
  });

  it('inputs vacíos / undefined no rompen · todo a 0', () => {
    // @ts-expect-error · simula entrada incompleta
    const r = calcularInmuebleResumen({});
    expect(r.costeBaseAdquisicion).toBe(0);
    expect(r.amortizacionAnual).toBe(0);
    expect(r.porcentajeOcupacion).toBe(0);
  });
});
