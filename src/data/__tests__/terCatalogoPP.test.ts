// T-FICHA-PP-PULIDO v1 · Bug #1 · tests del catálogo de TER + lookup.

import {
  TER_CATALOGO_PP,
  TER_MEDIA_MERCADO,
  lookupTerCatalogo,
  lookupTerCatalogoFromNames,
  normalizeGestoraSlug,
  normalizePlanSlug,
} from '../terCatalogoPP';

describe('normalizeGestoraSlug / normalizePlanSlug', () => {
  test('lowercase + sin tildes + guiones', () => {
    expect(normalizeGestoraSlug('Indexa Capital')).toBe('indexa-capital');
    expect(normalizeGestoraSlug('myinvestor')).toBe('myinvestor');
    expect(normalizeGestoraSlug('BBVA')).toBe('bbva');
  });

  test('quita diacríticos · "España" → "espana"', () => {
    expect(normalizeGestoraSlug('España')).toBe('espana');
    expect(normalizeGestoraSlug('Mapfré')).toBe('mapfre');
  });

  test('colapsa múltiples espacios y símbolos a un único guión', () => {
    expect(normalizePlanSlug('Plan   Orange  ')).toBe('plan-orange');
    expect(normalizePlanSlug('Plan de Pensiones Indexa')).toBe(
      'plan-de-pensiones-indexa',
    );
  });

  test('null/undefined/vacío · cadena vacía', () => {
    expect(normalizeGestoraSlug(null)).toBe('');
    expect(normalizeGestoraSlug(undefined)).toBe('');
    expect(normalizeGestoraSlug('')).toBe('');
  });
});

describe('lookupTerCatalogo · match estricto', () => {
  test('Plan Orange BBVA · 1,50 %', () => {
    const entry = lookupTerCatalogo('bbva', 'plan-orange');
    expect(entry).not.toBeNull();
    expect(entry?.ter).toBe(1.5);
    expect(entry?.tipoPlan).toBe('PPE');
  });

  test('myinvestor Indexado Global · 0,43 %', () => {
    const entry = lookupTerCatalogo('myinvestor', 'indexado-global');
    expect(entry?.ter).toBe(0.43);
  });

  test('miss · gestora desconocida', () => {
    expect(lookupTerCatalogo('caixabank', 'plan-x')).toBeNull();
  });

  test('miss · slug parcial sin guiones', () => {
    expect(lookupTerCatalogo('bbva', 'planorange')).toBeNull();
  });

  test('argumentos vacíos · null', () => {
    expect(lookupTerCatalogo('', 'plan-orange')).toBeNull();
    expect(lookupTerCatalogo('bbva', '')).toBeNull();
  });
});

describe('lookupTerCatalogoFromNames · normaliza primero', () => {
  test('"BBVA" + "Plan Orange" → match', () => {
    const entry = lookupTerCatalogoFromNames('BBVA', 'Plan Orange');
    expect(entry?.ter).toBe(1.5);
  });

  test('"myinvestor" + "Indexado Global" (mayúsculas/espacios) → match', () => {
    const entry = lookupTerCatalogoFromNames('myinvestor', '  Indexado Global ');
    expect(entry?.ter).toBe(0.43);
  });

  test('plan desconocido · null', () => {
    expect(lookupTerCatalogoFromNames('Banco X', 'Plan Y')).toBeNull();
  });
});

describe('TER_MEDIA_MERCADO · fallback estadístico', () => {
  test('tiene los 4 tipos administrativos', () => {
    expect(TER_MEDIA_MERCADO.PPI).toBeGreaterThan(0);
    expect(TER_MEDIA_MERCADO.PPE).toBeGreaterThan(0);
    expect(TER_MEDIA_MERCADO.PPES).toBeGreaterThan(0);
    expect(TER_MEDIA_MERCADO.PPA).toBeGreaterThan(0);
  });
});

describe('TER_CATALOGO_PP · invariantes', () => {
  test('todas las entradas tienen TER en rango razonable (0,1 % - 5 %)', () => {
    for (const e of TER_CATALOGO_PP) {
      expect(e.ter).toBeGreaterThan(0.1);
      expect(e.ter).toBeLessThan(5);
    }
  });

  test('no hay duplicados (gestoraId, planSlug)', () => {
    const keys = new Set<string>();
    for (const e of TER_CATALOGO_PP) {
      const k = `${e.gestoraId}::${e.planSlug}`;
      expect(keys.has(k)).toBe(false);
      keys.add(k);
    }
  });
});

// T-FICHA-PP-DEUDA v1 · Fix #5 · ampliación con 4 gestoras españolas grandes.
describe('TER_CATALOGO_PP · Fix #5 · gestoras españolas grandes', () => {
  const NUEVAS_GESTORAS = [
    'caixabank',
    'santander',
    'sabadell',
    'kutxabank',
  ];

  test.each(NUEVAS_GESTORAS)(
    'gestora %s · al menos una entrada PPI y otra PPE',
    (slug) => {
      const entradas = TER_CATALOGO_PP.filter((e) => e.gestoraId === slug);
      expect(entradas.length).toBeGreaterThanOrEqual(2);
      expect(entradas.some((e) => e.tipoPlan === 'PPI')).toBe(true);
      expect(entradas.some((e) => e.tipoPlan === 'PPE')).toBe(true);
    },
  );

  test('todas las entradas nuevas con TER en rango razonable (0,1 % - 2,5 %)', () => {
    const nuevas = TER_CATALOGO_PP.filter((e) =>
      NUEVAS_GESTORAS.includes(e.gestoraId),
    );
    expect(nuevas.length).toBeGreaterThanOrEqual(8);
    for (const e of nuevas) {
      expect(e.ter).toBeGreaterThanOrEqual(0.1);
      expect(e.ter).toBeLessThanOrEqual(2.5);
    }
  });

  test('matching loose · "CaixaBank Tendencias RV" → entrada concreta', () => {
    const entry = lookupTerCatalogoFromNames(
      'CaixaBank',
      'CaixaBank Tendencias RV',
    );
    expect(entry).not.toBeNull();
    expect(entry?.gestoraId).toBe('caixabank');
    expect(entry?.tipoPlan).toBe('PPI');
  });

  test('matching loose · "Santander" + "Santander Mi Jubilación RV" → match', () => {
    const entry = lookupTerCatalogoFromNames(
      'Santander',
      'Santander Mi Jubilación RV',
    );
    expect(entry?.gestoraId).toBe('santander');
  });
});
