import { initDB } from '../db';
import {
  generateBaseOpexForProperty,
  injectContractOpex,
  getOpexRulesForProperty,
  getCompromisosForInmueble,
} from '../opexService';

describe('opexService', () => {
  const PROPERTY_ID = 1;

  beforeEach(async () => {
    const db = await initDB();
    // V5.4+: opexRules is DEPRECATED — tests use compromisosRecurrentes
    await db.clear('compromisosRecurrentes');
  });

  describe('generateBaseOpexForProperty', () => {
    it('debe crear 7 compromisos base para un inmueble (V5.4: en compromisosRecurrentes)', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID);
      const compromisos = await getCompromisosForInmueble(PROPERTY_ID);
      expect(compromisos).toHaveLength(7);
      // All should have ambito='inmueble'
      compromisos.forEach((c) => expect(c.ambito).toBe('inmueble'));
    });

    it('debe crear 7 reglas base para un inmueble (backward compat: via getOpexRulesForProperty)', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID);
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      expect(rules).toHaveLength(7);
    });

    it('debe crear reglas con importeEstimado 0 y activo true', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID);
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      rules.forEach((rule) => {
        expect(rule.importeEstimado).toBe(0);
        expect(rule.activo).toBe(true);
        expect(rule.propertyId).toBe(PROPERTY_ID);
      });
    });

    it('debe incluir IBI (anual) como regla base', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID);
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      const ibi = rules.find((r) => r.concepto === 'IBI');
      expect(ibi).toBeDefined();
      expect(ibi?.frecuencia).toBe('anual');
      expect(ibi?.categoria).toBe('impuesto');
    });

    it('debe incluir Comunidad (mensual) como regla base', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID);
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      const comunidad = rules.find((r) => r.concepto === 'Comunidad');
      expect(comunidad).toBeDefined();
      expect(comunidad?.frecuencia).toBe('mensual');
      expect(comunidad?.categoria).toBe('comunidad');
    });

    it('no debe duplicar reglas si se llama dos veces', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID);
      await generateBaseOpexForProperty(PROPERTY_ID);
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      expect(rules).toHaveLength(7);
    });

    it('debe aceptar un accountId opcional', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID, 42);
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      rules.forEach((rule) => {
        expect(rule.accountId).toBe(42);
      });
    });

    it('V5.4: compromiso en compromisosRecurrentes tiene ambito inmueble e inmuebleId correcto', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID);
      const compromisos = await getCompromisosForInmueble(PROPERTY_ID);
      expect(compromisos.every((c) => c.inmuebleId === PROPERTY_ID)).toBe(true);
    });
  });

  describe('injectContractOpex - coliving', () => {
    it('debe añadir 5 reglas para coliving', async () => {
      await injectContractOpex(PROPERTY_ID, 'coliving');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      expect(rules).toHaveLength(5);
    });

    it('debe incluir Property Management y Seguro Impago para coliving', async () => {
      await injectContractOpex(PROPERTY_ID, 'coliving');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      const pm = rules.find((r) => r.concepto === 'Property Management');
      const seguro = rules.find((r) => r.concepto === 'Seguro Impago');
      expect(pm).toBeDefined();
      expect(pm?.categoria).toBe('gestion');
      expect(seguro).toBeDefined();
      expect(seguro?.frecuencia).toBe('anual');
    });

    it('no debe duplicar reglas coliving si se llama dos veces', async () => {
      await injectContractOpex(PROPERTY_ID, 'coliving');
      await injectContractOpex(PROPERTY_ID, 'coliving');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      expect(rules).toHaveLength(5);
    });
  });

  describe('injectContractOpex - vacacional', () => {
    it('debe añadir 5 reglas para vacacional', async () => {
      await injectContractOpex(PROPERTY_ID, 'vacacional');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      expect(rules).toHaveLength(5);
    });

    it('debe incluir Channel Manager para vacacional', async () => {
      await injectContractOpex(PROPERTY_ID, 'vacacional');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      const cm = rules.find((r) => r.concepto === 'Channel Manager');
      expect(cm).toBeDefined();
      expect(cm?.categoria).toBe('servicio');
    });
  });

  describe('injectContractOpex - tradicional', () => {
    it('debe añadir 2 reglas para tradicional', async () => {
      await injectContractOpex(PROPERTY_ID, 'tradicional');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      expect(rules).toHaveLength(2);
    });

    it('debe incluir Property Management y Seguro Impago para tradicional', async () => {
      await injectContractOpex(PROPERTY_ID, 'tradicional');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      const pm = rules.find((r) => r.concepto === 'Property Management');
      const seguro = rules.find((r) => r.concepto === 'Seguro Impago');
      expect(pm).toBeDefined();
      expect(seguro).toBeDefined();
    });
  });

  describe('injectContractOpex - tipo desconocido', () => {
    it('no debe añadir reglas para un tipo de contrato desconocido', async () => {
      await injectContractOpex(PROPERTY_ID, 'desconocido');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      expect(rules).toHaveLength(0);
    });
  });

  describe('deduplicación entre base y contrato', () => {
    it('no debe duplicar Property Management si ya existe de una llamada base + coliving', async () => {
      await generateBaseOpexForProperty(PROPERTY_ID);
      await injectContractOpex(PROPERTY_ID, 'coliving');
      const rules = await getOpexRulesForProperty(PROPERTY_ID);
      const pmRules = rules.filter((r) => r.concepto === 'Property Management');
      expect(pmRules).toHaveLength(1);
    });
  });
});

