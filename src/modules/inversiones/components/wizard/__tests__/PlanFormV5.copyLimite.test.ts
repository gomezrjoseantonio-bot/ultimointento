// Pulido T13 v4 final · issue 1 · tests del helper `getCopyLimiteFiscal`.
// El helper traduce tipo administrativo + subtipo PPES + flag discapacidad a
// la leyenda de límite fiscal correcta. Discapacidad gana siempre.

import { getCopyLimiteFiscal } from '../PlanFormV5';

describe('getCopyLimiteFiscal', () => {
  describe('sin discapacidad', () => {
    it('PPI · 1.500 € art. 51.6', () => {
      expect(getCopyLimiteFiscal('PPI', undefined, false))
        .toBe('Límite anual deducible · 1.500 € (art. 51.6 LIRPF).');
    });
    it('PPA · 1.500 € art. 51.6', () => {
      expect(getCopyLimiteFiscal('PPA', undefined, false))
        .toBe('Límite anual deducible · 1.500 € (art. 51.6 LIRPF).');
    });
    it('PPE · 1.500 titular + 8.500 empresa = 10.000 € art. 51.7', () => {
      expect(getCopyLimiteFiscal('PPE', undefined, false))
        .toBe('Límite conjunto · 1.500 € titular + 8.500 € empresa = 10.000 € (art. 51.7 LIRPF).');
    });
    it('PPES sectorial · 1.500 €', () => {
      expect(getCopyLimiteFiscal('PPES', 'sectorial', false))
        .toBe('Límite anual deducible · 1.500 € (art. 51.6 LIRPF).');
    });
    it('PPES sector_publico · 1.500 €', () => {
      expect(getCopyLimiteFiscal('PPES', 'sector_publico', false))
        .toBe('Límite anual deducible · 1.500 € (art. 51.6 LIRPF).');
    });
    it('PPES cooperativas · 1.500 €', () => {
      expect(getCopyLimiteFiscal('PPES', 'cooperativas', false))
        .toBe('Límite anual deducible · 1.500 € (art. 51.6 LIRPF).');
    });
    it('PPES autonomos · 5.750 € (1.500 + 4.250) Ley 12/2022', () => {
      expect(getCopyLimiteFiscal('PPES', 'autonomos', false))
        .toBe('Límite anual deducible · hasta 5.750 € · 1.500 € + 4.250 € adicionales (art. 51.8 · Ley 12/2022).');
    });
  });

  describe('discapacidad gana siempre', () => {
    it('PPI con discapacidad · 24.250 €', () => {
      expect(getCopyLimiteFiscal('PPI', undefined, true))
        .toBe('Límite especial discapacidad · hasta 24.250 € (art. 52.1.c LIRPF).');
    });
    it('PPE con discapacidad · 24.250 €', () => {
      expect(getCopyLimiteFiscal('PPE', undefined, true))
        .toBe('Límite especial discapacidad · hasta 24.250 € (art. 52.1.c LIRPF).');
    });
    it('PPES autonomos con discapacidad · 24.250 €', () => {
      expect(getCopyLimiteFiscal('PPES', 'autonomos', true))
        .toBe('Límite especial discapacidad · hasta 24.250 € (art. 52.1.c LIRPF).');
    });
  });
});
