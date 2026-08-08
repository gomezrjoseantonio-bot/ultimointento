// INVERSIONES V1 · Fase 2 · tests de las agregaciones puras del hero de galería.

import type { CartaItem } from '../../types/cartaItem';
import type { PosicionInversion, TipoPosicion } from '../../../../types/inversiones';
import {
  resumenCartera,
  familiasResumen,
  rentaPasivaAnual,
  serieTrayectoria,
} from '../galeriaHero';
import {
  tasaNominalPosicion,
  PROY_HORIZONTE_AÑOS,
  type SupuestosGaleria,
} from '../supuestosProyeccion';

// ── Fixture helper ──────────────────────────────────────────────────────────
function item(partial: Partial<CartaItem> & { tipo: TipoPosicion; valor_actual: number }): CartaItem {
  const original = (partial._original ?? {}) as PosicionInversion;
  return {
    _origen: 'inversiones',
    _idOriginal: partial._idOriginal ?? Math.random(),
    _original: original,
    nombre: partial.nombre ?? 'Pos',
    tipo: partial.tipo,
    entidad: partial.entidad ?? 'Ent',
    valor_actual: partial.valor_actual,
    total_aportado: partial.total_aportado ?? 0,
    rentabilidad_euros: partial.rentabilidad_euros ?? 0,
    rentabilidad_porcentaje: partial.rentabilidad_porcentaje ?? 0,
    fecha_apertura: partial.fecha_apertura,
    tin: partial.tin,
    interes_anual: partial.interes_anual,
    cagr_pct: partial.cagr_pct,
    ...partial,
  };
}

const SUP: SupuestosGaleria = {
  inflacionPct: 2.5,
  rentabilidadAhorroPct: 2.0,
  rentabilidadObjetivoPct: null,
};

describe('galeriaHero · resumenCartera', () => {
  it('suma valor, aportado, rentabilidad y calcula el %', () => {
    const items = [
      item({ tipo: 'plan_pensiones', valor_actual: 100, total_aportado: 80, rentabilidad_euros: 20 }),
      item({ tipo: 'accion', valor_actual: 50, total_aportado: 20, rentabilidad_euros: 30 }),
    ];
    const r = resumenCartera(items);
    expect(r.valorTotal).toBe(150);
    expect(r.aportadoTotal).toBe(100);
    expect(r.rentabilidadEur).toBe(50);
    expect(r.rentabilidadPct).toBeCloseTo(50);
  });

  it('% = 0 si no hay aportado (no divide por cero)', () => {
    expect(resumenCartera([]).rentabilidadPct).toBe(0);
  });
});

describe('galeriaHero · familiasResumen', () => {
  it('agrupa en planes / prestamos / acciones y pondera el % por valor', () => {
    const items = [
      item({ tipo: 'plan_pensiones', valor_actual: 100, total_aportado: 60, cagr_pct: 8 }),
      item({ tipo: 'prestamo_p2p', valor_actual: 90, total_aportado: 90, tin: 9 }),
      item({ tipo: 'accion', valor_actual: 10, total_aportado: 5, cagr_pct: 12 }),
      item({ tipo: 'crypto', valor_actual: 5, total_aportado: 5 }), // 'otros' · no chip
    ];
    const f = familiasResumen(items);
    expect(f.planes.hoy).toBe(100);
    expect(f.planes.aportado).toBe(60);
    expect(f.planes.pctAnual).toBeCloseTo(8);
    expect(f.prestamos.hoy).toBe(90);
    expect(f.prestamos.pctAnual).toBeCloseTo(9); // TIN
    expect(f.acciones.pctAnual).toBeCloseTo(12);
  });

  it('pctAnual null si ninguna posición de la familia aporta tasa', () => {
    const f = familiasResumen([item({ tipo: 'plan_pensiones', valor_actual: 100 })]);
    expect(f.planes.pctAnual).toBeNull();
  });

  it('un fondo de inversión va a su propio chip "fondos", no a "acciones"', () => {
    const f = familiasResumen([
      item({ tipo: 'fondo_inversion', valor_actual: 1065, total_aportado: 1065, cagr_pct: 5 }),
      item({ tipo: 'accion', valor_actual: 500, total_aportado: 400, cagr_pct: 12 }),
    ]);
    expect(f.fondos.hoy).toBe(1065);
    expect(f.fondos.aportado).toBe(1065);
    expect(f.fondos.pctAnual).toBeCloseTo(5);
    // No se mezcla con acciones (otra familia).
    expect(f.acciones.hoy).toBe(500);
    expect(f.acciones.pctAnual).toBeCloseTo(12);
  });
});

describe('galeriaHero · rentaPasivaAnual', () => {
  it('suma intereses (renta fija) y dividendos (equity)', () => {
    const items = [
      item({ tipo: 'prestamo_p2p', valor_actual: 1000, interes_anual: 90 }),
      item({ tipo: 'deposito_plazo', valor_actual: 1000, tin: 3 }), // 30 €/año
      item({
        tipo: 'accion',
        valor_actual: 500,
        numero_participaciones: 100,
        _original: {
          numero_participaciones: 100,
          dividendos: {
            paga_dividendos: true,
            dividendo_por_accion: 0.5,
            frecuencia_dividendos: 'trimestral',
            politica_dividendos: 'distribucion',
          },
        } as unknown as PosicionInversion,
      }),
    ];
    const r = rentaPasivaAnual(items);
    expect(r.intereses).toBeCloseTo(120); // 90 + 30
    expect(r.dividendos).toBeCloseTo(200); // 0.5 * 100 * 4
    expect(r.total).toBeCloseTo(320);
    expect(r.mensual).toBeCloseTo(320 / 12);
  });

  it('dividendo cae al campo base dividendo_anual_estimado si no hay config', () => {
    const items = [
      item({
        tipo: 'accion',
        valor_actual: 100,
        numero_participaciones: 10,
        _original: { numero_participaciones: 10, dividendo_anual_estimado: 2 } as unknown as PosicionInversion,
      }),
    ];
    expect(rentaPasivaAnual(items).dividendos).toBeCloseTo(20); // 2 €/título × 10
  });
});

describe('galeriaHero · serieTrayectoria', () => {
  const baseYear = 2026;

  it('genera horizonte + 1 años y vmax positivo', () => {
    const s = serieTrayectoria([item({ tipo: 'accion', valor_actual: 1000, cagr_pct: 8 })], SUP, baseYear);
    expect(s.years).toHaveLength(PROY_HORIZONTE_AÑOS + 1);
    expect(s.years[0]).toBe(baseYear);
    expect(s.vmax).toBeGreaterThan(0);
  });

  it('renta fija: plana hasta vencimiento y 0 después (no reinvierte)', () => {
    const s = serieTrayectoria(
      [
        item({
          tipo: 'prestamo_p2p',
          valor_actual: 5000,
          fecha_apertura: '2024-01-01',
          _original: { duracion_meses: 36 } as unknown as PosicionInversion, // vence 2027
        }),
      ],
      SUP,
      baseYear,
    );
    const banda = s.bandas[0];
    expect(banda.vencYear).toBe(2027);
    expect(banda.valores[0]).toBe(5000); // 2026
    expect(banda.valores[1]).toBe(5000); // 2027 · vencimiento
    expect(banda.valores[2]).toBe(0); // 2028 · fuera de la gráfica
  });

  it('equity crece a su tasa nominal (CAGR)', () => {
    const s = serieTrayectoria([item({ tipo: 'accion', valor_actual: 1000, cagr_pct: 10 })], SUP, baseYear);
    const banda = s.bandas[0];
    expect(banda.valores[0]).toBeCloseTo(1000);
    expect(banda.valores[1]).toBeCloseTo(1100); // +10%
    expect(banda.valores[2]).toBeCloseTo(1210);
  });
});

describe('supuestosProyeccion · tasaNominalPosicion', () => {
  it('usa la CAGR saneada al rango [ahorro, 15]', () => {
    expect(tasaNominalPosicion(8, SUP)).toBeCloseTo(0.08);
    expect(tasaNominalPosicion(30, SUP)).toBeCloseTo(0.15); // techo
    // suelo = rentabilidadAhorroPct (2%) · una CAGR negativa no baja de ahí.
    expect(tasaNominalPosicion(-5, SUP)).toBeCloseTo(0.02);
    expect(tasaNominalPosicion(1, SUP)).toBeCloseTo(0.02); // CAGR < suelo → suelo
  });

  it('cae al suelo de ahorro del escenario si no hay CAGR', () => {
    expect(tasaNominalPosicion(null, SUP)).toBeCloseTo(0.02);
  });

  it('usa la rentabilidad objetivo del escenario si existe', () => {
    expect(tasaNominalPosicion(8, { ...SUP, rentabilidadObjetivoPct: 6 })).toBeCloseTo(0.06);
  });
});
