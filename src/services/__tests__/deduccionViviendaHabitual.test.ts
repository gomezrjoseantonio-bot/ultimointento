// ============================================================================
// Tests · deducción por inversión en vivienda habitual (DT 18ª LIRPF)
// Fase 2 del modelo de vivienda habitual · funciones puras
// ============================================================================

import {
  DT18_LIMITE_BASE,
  esElegibleDT18,
  sumarPagosEjercicio,
  pctTitularidadComputable,
  calcularImportesDT18,
  prestamosVinculadosAInmueble,
  factorPrestamoParaInmueble,
} from '../deduccionViviendaHabitualService';
import type { Prestamo } from '../../types/prestamos';

// ─── esElegibleDT18 ─────────────────────────────────────────────────────────

describe('DT18 · esElegibleDT18', () => {
  test('adquisición 2012 · elegible', () => {
    expect(esElegibleDT18('2012-12-31')).toBe(true);
  });
  test('adquisición exactamente 2013-01-01 · NO elegible', () => {
    expect(esElegibleDT18('2013-01-01')).toBe(false);
  });
  test('adquisición posterior · NO elegible', () => {
    expect(esElegibleDT18('2019-06-15')).toBe(false);
  });
  test('sin fecha · NO elegible', () => {
    expect(esElegibleDT18(undefined)).toBe(false);
    expect(esElegibleDT18(null)).toBe(false);
    expect(esElegibleDT18('')).toBe(false);
  });
});

// ─── sumarPagosEjercicio ────────────────────────────────────────────────────

describe('DT18 · sumarPagosEjercicio', () => {
  const plan = {
    periodos: [
      { fechaCargo: '2024-01-05', interes: 100, amortizacion: 400 },
      { fechaCargo: '2024-06-05', interes: 90, amortizacion: 410 },
      { fechaCargo: '2025-01-05', interes: 80, amortizacion: 420 }, // otro año
      { fechaCargo: '2023-12-05', interes: 110, amortizacion: 390 }, // otro año
    ],
  };

  test('solo suma los periodos cuyo cargo cae en el ejercicio', () => {
    const r = sumarPagosEjercicio(plan, 2024);
    expect(r.intereses).toBe(190);
    expect(r.capital).toBe(810);
    expect(r.total).toBe(1000);
  });

  test('ejercicio sin cuotas · 0', () => {
    const r = sumarPagosEjercicio(plan, 2030);
    expect(r.total).toBe(0);
  });
});

// ─── pctTitularidadComputable ───────────────────────────────────────────────

describe('DT18 · pctTitularidadComputable (modelo titularidad #1493)', () => {
  test('individual · solo el % del declarante', () => {
    expect(
      pctTitularidadComputable(
        { porcentajePropiedad: 50, porcentajePropiedadPareja: 50 },
        'individual',
      ),
    ).toBe(50);
  });

  test('conjunta · declarante + pareja', () => {
    expect(
      pctTitularidadComputable(
        { porcentajePropiedad: 50, porcentajePropiedadPareja: 50 },
        'conjunta',
      ),
    ).toBe(100);
  });

  test('conjunta con titularidad "yo" (pareja 0) · suma inocua', () => {
    expect(
      pctTitularidadComputable(
        { porcentajePropiedad: 100, porcentajePropiedadPareja: 0 },
        'conjunta',
      ),
    ).toBe(100);
  });

  test('inmueble legado sin campos · default 100 declarante', () => {
    expect(pctTitularidadComputable({}, 'individual')).toBe(100);
  });

  test('titularidad parcial · 10% se respeta (nunca se fuerza a 100)', () => {
    expect(
      pctTitularidadComputable(
        { porcentajePropiedad: 10, porcentajePropiedadPareja: 0 },
        'individual',
      ),
    ).toBe(10);
  });

  test('clamp superior a 100', () => {
    expect(
      pctTitularidadComputable(
        { porcentajePropiedad: 80, porcentajePropiedadPareja: 80 },
        'conjunta',
      ),
    ).toBe(100);
  });
});

// ─── calcularImportesDT18 ───────────────────────────────────────────────────

describe('DT18 · calcularImportesDT18', () => {
  test('por debajo del límite · base = pagos · 15% (7,5 + 7,5)', () => {
    const r = calcularImportesDT18(6000);
    expect(r.base).toBe(6000);
    expect(r.tramoEstatal).toBe(450);
    expect(r.tramoAutonomico).toBe(450);
    expect(r.deduccion).toBe(900);
  });

  test('por encima del límite · base capada a 9.040 · deducción máx 1.356', () => {
    const r = calcularImportesDT18(12000);
    expect(r.base).toBe(DT18_LIMITE_BASE);
    expect(r.deduccion).toBe(1356);
    expect(r.tramoEstatal).toBe(678);
    expect(r.tramoAutonomico).toBe(678);
  });

  test('pagos 0 o negativos · todo 0', () => {
    expect(calcularImportesDT18(0).deduccion).toBe(0);
    expect(calcularImportesDT18(-500).deduccion).toBe(0);
  });
});

// ─── prestamosVinculadosAInmueble + factorPrestamoParaInmueble ─────────────

const mkPrestamo = (partial: Partial<Prestamo>): Prestamo =>
  ({ id: 'p1', principalInicial: 100000, ...partial } as Prestamo);

describe('DT18 · descubrimiento de préstamos vinculados', () => {
  const propiedad = {
    id: 7,
    estructuraCompra: { prestamoVinculadoId: 'p-fk' },
  };

  test('vincula por FK directa (estructuraCompra)', () => {
    const prestamos = [mkPrestamo({ id: 'p-fk' }), mkPrestamo({ id: 'otro' })];
    const r = prestamosVinculadosAInmueble(propiedad, prestamos);
    expect(r.map((p) => p.id)).toEqual(['p-fk']);
  });

  test('vincula por destinos v2', () => {
    const prestamos = [
      mkPrestamo({
        id: 'p-dest',
        destinos: [{ tipo: 'ADQUISICION', inmuebleId: '7', importe: 100000 }] as Prestamo['destinos'],
      }),
    ];
    const r = prestamosVinculadosAInmueble({ id: 7 }, prestamos);
    expect(r.map((p) => p.id)).toEqual(['p-dest']);
  });

  test('vincula por legacy inmuebleId · y dedupe si coincide con FK', () => {
    const prestamos = [mkPrestamo({ id: 'p-fk', inmuebleId: '7' })];
    const r = prestamosVinculadosAInmueble(propiedad, prestamos);
    expect(r).toHaveLength(1);
  });

  test('sin vínculo · vacío', () => {
    const prestamos = [mkPrestamo({ id: 'x', inmuebleId: '99' })];
    expect(prestamosVinculadosAInmueble({ id: 7 }, prestamos)).toHaveLength(0);
  });
});

describe('DT18 · factorPrestamoParaInmueble', () => {
  test('destinos parciales · fracción proporcional (hipoteca para dos pisos)', () => {
    const prestamo = mkPrestamo({
      id: 'p2',
      principalInicial: 100000,
      destinos: [
        { tipo: 'ADQUISICION', inmuebleId: '7', importe: 60000 },
        { tipo: 'ADQUISICION', inmuebleId: '8', importe: 40000 },
      ] as Prestamo['destinos'],
    });
    expect(factorPrestamoParaInmueble({ id: 7 }, prestamo)).toBeCloseTo(0.6);
    expect(factorPrestamoParaInmueble({ id: 8 }, prestamo)).toBeCloseTo(0.4);
  });

  test('solo FK directa sin destinos/legacy · asume 100%', () => {
    const prestamo = mkPrestamo({ id: 'p-fk' });
    expect(
      factorPrestamoParaInmueble(
        { id: 7, estructuraCompra: { prestamoVinculadoId: 'p-fk' } },
        prestamo,
      ),
    ).toBe(1);
  });

  test('préstamo ajeno · 0', () => {
    const prestamo = mkPrestamo({ id: 'ajeno', inmuebleId: '99' });
    expect(factorPrestamoParaInmueble({ id: 7 }, prestamo)).toBe(0);
  });
});

// ─── integración de importes (caso realista) ────────────────────────────────

describe('DT18 · caso realista end-to-end (puras)', () => {
  test('hipoteca 2010 · cuotas 2024 = 7.200 € · titularidad ambos 50/50 · conjunta', () => {
    // 12 cuotas de 600 € (150 interés + 450 capital)
    const plan = {
      periodos: Array.from({ length: 12 }, (_, i) => ({
        fechaCargo: `2024-${String(i + 1).padStart(2, '0')}-05`,
        interes: 150,
        amortizacion: 450,
      })),
    };
    const pagos = sumarPagosEjercicio(plan, 2024);
    expect(pagos.total).toBe(7200);

    const pct = pctTitularidadComputable(
      { porcentajePropiedad: 50, porcentajePropiedadPareja: 50 },
      'conjunta',
    );
    const r = calcularImportesDT18(pagos.total * (pct / 100));
    expect(r.base).toBe(7200);
    expect(r.deduccion).toBe(1080); // 15% de 7.200

    // La misma casa en individual: solo el 50% del declarante
    const pctInd = pctTitularidadComputable(
      { porcentajePropiedad: 50, porcentajePropiedadPareja: 50 },
      'individual',
    );
    const rInd = calcularImportesDT18(pagos.total * (pctInd / 100));
    expect(rInd.base).toBe(3600);
    expect(rInd.deduccion).toBe(540);
  });
});
