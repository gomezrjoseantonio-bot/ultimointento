// src/services/__tests__/limitesFiscalesPlanesService.test.ts
// TAREA 13 v4 · Commit 5 (G+H) · tests del servicio fiscal de planes de
// pensiones (territorio común 2026).

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('limitesFiscalesPlanesService', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedNomina(personalDataId: number, salarioBrutoAnual: number, fechaAntiguedad = '2020-01-01') {
    const { initDB } = await import('../db');
    const db = await initDB();
    await (db as any).add('ingresos', {
      tipo: 'nomina',
      personalDataId,
      titular: 'yo',
      nombre: 'Empresa X',
      salarioBrutoAnual,
      fechaAntiguedad,
      activa: true,
    });
  }

  async function seedPlan(planId: string, personalDataId: number, tipo = 'PPI', subtipoPPE?: string) {
    const { initDB } = await import('../db');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: planId,
      nombre: `Plan ${tipo}`,
      titular: 'yo',
      personalDataId,
      tipoAdministrativo: tipo,
      subtipoPPE,
      gestoraActual: 'X',
      fechaContratacion: '2020-01-01',
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });
  }

  async function seedAportacion(
    planId: string,
    ejercicio: number,
    importeTitular: number,
    importeEmpresa = 0,
    importeConyuge = 0,
  ) {
    const { initDB } = await import('../db');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('aportacionesPlan', {
      id: `ap-${Math.random()}`,
      planId,
      fecha: `${ejercicio}-12-31`,
      ejercicioFiscal: ejercicio,
      importeTitular,
      importeEmpresa,
      importeConyuge,
      origen: 'manual',
      granularidad: 'anual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });
  }

  describe('getLimitesPorTipo', () => {
    it('PPI → 1.500 €', async () => {
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const l = limitesFiscalesPlanesService.getLimitesPorTipo('PPI');
      expect(l.limiteEconomico).toBe(1500);
      expect(l.limite30Rendimientos).toBe(0.30);
    });
    it('PPE empleador único → 8.500 € empresa / 10.000 € conjunto', async () => {
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const l = limitesFiscalesPlanesService.getLimitesPorTipo('PPE', 'empleador_unico');
      expect(l.limiteEconomico).toBe(8500);
      expect(l.limiteEfectivo).toBe(10000);
    });
    it('PPES autónomos → adicional 4.250 / total 5.750', async () => {
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const l = limitesFiscalesPlanesService.getLimitesPorTipo('PPES', undefined, 'autonomos');
      expect(l.limiteEconomico).toBe(4250);
      expect(l.limiteEfectivo).toBe(5750);
    });
    it('Discapacidad → 24.250 €', async () => {
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const l = limitesFiscalesPlanesService.getLimitesPorTipo('PPI', undefined, undefined, true);
      expect(l.limiteEconomico).toBe(24250);
    });
  });

  describe('validarAportacionDeducible · objeto detallado', () => {
    it('aportación 1.500 € a PPI con sueldo 60k · esDeducible=true · sin exceso', async () => {
      await seedNomina(1, 60_000);
      await seedPlan('plan-ppi', 1, 'PPI');
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = await limitesFiscalesPlanesService.validarAportacionDeducible(
        'plan-ppi',
        1500,
        2026,
        'titular',
      );
      expect(r.esDeducible).toBe(true);
      expect(r.importeDeducible).toBe(1500);
      expect(r.excesoNoDeducible).toBe(0);
      expect(r.topeEconomico).toBe(1500);
      expect(r.tope30Rendimientos).toBe(60_000 * 0.30); // 18.000 €
      expect(r.limiteAplicable).toBe(1500); // económico es más restrictivo
    });

    it('aportación 2.000 € a PPI · 500 € de exceso', async () => {
      await seedNomina(1, 60_000);
      await seedPlan('plan-ppi', 1, 'PPI');
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = await limitesFiscalesPlanesService.validarAportacionDeducible(
        'plan-ppi',
        2000,
        2026,
        'titular',
      );
      expect(r.esDeducible).toBe(false);
      expect(r.importeDeducible).toBe(1500);
      expect(r.excesoNoDeducible).toBe(500);
    });

    it('tope 30 % de rendimientos · sueldo 3k al año · solo 900 € deducibles aunque PPE permite 10k', async () => {
      await seedNomina(1, 3_000);
      await seedPlan('plan-ppe', 1, 'PPE', 'empleador_unico');
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = await limitesFiscalesPlanesService.validarAportacionDeducible(
        'plan-ppe',
        2000,
        2026,
        'titular',
      );
      expect(r.tope30Rendimientos).toBe(900); // 30% de 3000
      expect(r.limiteAplicable).toBe(900);
      expect(r.importeDeducible).toBe(900);
      expect(r.excesoNoDeducible).toBe(1100);
      expect(r.motivo).toContain('Tope del 30 %');
    });

    it('empresa NO aplica tope 30 % · solo límite económico 8.500 €', async () => {
      // Sin seed de nómina · rendimientos = 0. Si aplicáramos 30% bloquearía
      // a la empresa indebidamente. Verificamos que NO se aplica.
      await seedPlan('plan-ppe', 1, 'PPE', 'empleador_unico');
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = await limitesFiscalesPlanesService.validarAportacionDeducible(
        'plan-ppe',
        5000,
        2026,
        'empresa',
      );
      expect(r.esDeducible).toBe(true);
      expect(r.importeDeducible).toBe(5000);
      expect(r.tope30Rendimientos).toBeUndefined();
      expect(r.topeEconomico).toBe(8500);
    });
  });

  describe('calcularReduccionBaseImponible · objeto rico', () => {
    it('PPI 1.500 € · sueldo 60k · totalDeducibleAplicado=1500 · sin exceso', async () => {
      await seedNomina(1, 60_000);
      await seedPlan('plan-ppi', 1, 'PPI');
      await seedAportacion('plan-ppi', 2026, 1500);
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = await limitesFiscalesPlanesService.calcularReduccionBaseImponible(1, 2026);
      expect(r.totalAportadoTitular).toBe(1500);
      expect(r.totalAportadoEmpresa).toBe(0);
      expect(r.desgloseDeduciblesPorTipo.PPI).toBe(1500);
      expect(r.totalDeducibleAplicado).toBe(1500);
      expect(r.excesoArrastrable).toBe(0);
    });

    it('PPE empleador único · titular 1.500 + empresa 8.500 · todo deducible · 0 exceso', async () => {
      await seedNomina(1, 60_000);
      await seedPlan('plan-ppe', 1, 'PPE', 'empleador_unico');
      await seedAportacion('plan-ppe', 2026, 1500, 8500);
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = await limitesFiscalesPlanesService.calcularReduccionBaseImponible(1, 2026);
      expect(r.totalAportadoTitular).toBe(1500);
      expect(r.totalAportadoEmpresa).toBe(8500);
      expect(r.desgloseDeduciblesPorTipo.PPE).toBe(10_000);
      expect(r.totalDeducibleAplicado).toBe(10_000);
      expect(r.excesoArrastrable).toBe(0);
    });

    it('PPI 2.000 € · 500 € de exceso arrastrable · alerta', async () => {
      await seedNomina(1, 60_000);
      await seedPlan('plan-ppi', 1, 'PPI');
      await seedAportacion('plan-ppi', 2026, 2000);
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = await limitesFiscalesPlanesService.calcularReduccionBaseImponible(1, 2026);
      expect(r.desgloseDeduciblesPorTipo.PPI).toBe(1500);
      expect(r.totalDeducibleAplicado).toBe(1500);
      expect(r.excesoArrastrable).toBe(500);
      expect(r.alertas.some((a) => a.includes('5 ejercicios'))).toBe(true);
    });

    // Consulta vinculante AEAT V0186-23: el límite general de 1.500 € puede
    // aplicarse a PPI o al propio PPES · por eso PPES autónomos admite hasta
    // 5.750 € en un solo plan (4.250 € adicional + 1.500 € general absorbido).
    // No es bug · es by-design.
    it('PPES autónomos · 5.000 € · 4.250 € PPES + 750 € exceso', async () => {
      await seedNomina(1, 30_000);
      await seedPlan('plan-ppes', 1, 'PPES', undefined);
      const { initDB } = await import('../db');
      const db = await initDB();
      // Update with subtipoPPES
      const plan = await (db as any).get('planesPensiones', 'plan-ppes');
      await (db as any).put('planesPensiones', { ...plan, subtipoPPES: 'autonomos' });

      await seedAportacion('plan-ppes', 2026, 5000);
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = await limitesFiscalesPlanesService.calcularReduccionBaseImponible(1, 2026);
      // PPES autónomos · limiteEfectivo 5.750 € · titular 5.000 está dentro
      // del tope efectivo (5.750) pero el limiteEconomico es 4.250 (adicional).
      // El servicio aplica limiteEfectivo para titular · 5.000 < 5.750 → todo deducible.
      expect(r.totalAportadoTitular).toBe(5000);
      expect(r.desgloseDeduciblesPorTipo.PPES_autonomos).toBe(5000);
    });

    // TAREA 13 v4 · Acción 4 · caso real Jose 2024 · PPE Orange (CIF
    // A82009812 · planId fijo del registro productivo). Aportaciones tras el
    // split de la migración fixCasillaAEATOficial · un row 0426 titular y un
    // row 0427 empresa. Validamos paridad fiscal end-to-end: validación
    // individual y reducción agregada.
    it('caso real Jose 2024 · PPE Orange · titular 1.396,68 + empresa 1.862,16 · todo deducible', async () => {
      // Rendimiento neto del trabajo del XML AEAT 2024 ≫ 30k € · el helper
      // `getRendimientosNetosAprox` aproxima por `salarioBrutoAnual` como cota
      // superior conservadora. 50.000 € deja el 30 % en 15.000 € · más que
      // suficiente para que el tope económico (10.000 €) sea el restrictivo.
      await seedNomina(1, 50_000);

      const { initDB } = await import('../db');
      const db = await initDB();
      const ahora = new Date().toISOString();
      const planId = 'dcc95e8a-f408-4cb8-a52e-bfcec6b3517b';
      await (db as any).add('planesPensiones', {
        id: planId,
        nombre: 'Plan PPE Orange',
        titular: 'yo',
        personalDataId: 1,
        tipoAdministrativo: 'PPE',
        subtipoPPE: 'empleador_unico',
        empresaPagadora: { cif: 'A82009812', nombre: 'Orange' },
        gestoraActual: 'Orange',
        fechaContratacion: '2020-01-01',
        estado: 'activo',
        origen: 'xml_aeat',
        fechaCreacion: ahora,
        fechaActualizacion: ahora,
      });
      // Aportaciones split-shape (canónico post-migración) · un row 0426 con
      // sólo titular y un row 0427 con sólo empresa.
      await seedAportacion(planId, 2024, 1396.68, 0);
      await seedAportacion(planId, 2024, 0, 1862.16);

      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');

      // 1. Reducción agregada del ejercicio · todo deducible · sin exceso.
      const r = await limitesFiscalesPlanesService.calcularReduccionBaseImponible(1, 2024);
      expect(r.totalAportadoTitular).toBeCloseTo(1396.68, 2);
      expect(r.totalAportadoEmpresa).toBeCloseTo(1862.16, 2);
      expect(r.desgloseDeduciblesPorTipo.PPE).toBeCloseTo(3258.84, 2);
      expect(r.totalDeducibleAplicado).toBeCloseTo(3258.84, 2);
      expect(r.excesoArrastrable).toBeCloseTo(0, 2);
      // 30 % de 50.000 = 15.000 € · holgura amplia · sin alerta de tope 30 %.
      expect(r.alertas.some((a) => a.includes('30 %'))).toBe(false);

      // 2. Validación individual titular · simulamos añadir 100 € sobre los
      //    1.396,68 ya aportados · total 1.496,68 sigue dentro del conjunto
      //    10.000 € · esDeducible=true (importe > 0 + sin exceso) · tope
      //    económico es el restrictivo, NO el 30 %.
      const vT = await limitesFiscalesPlanesService.validarAportacionDeducible(
        planId,
        100,
        2024,
        'titular',
      );
      expect(vT.esDeducible).toBe(true);
      expect(vT.totalAportadoEjercicio).toBeCloseTo(1496.68, 2);
      expect(vT.excesoNoDeducible).toBe(0);
      expect(vT.topeEconomico).toBe(10000); // PPE empleador único · conjunto
      expect(vT.tope30Rendimientos).toBeCloseTo(15000, 2); // 30% de 50k
      expect(vT.limiteAplicable).toBe(10000); // económico es más restrictivo

      // 3. Validación individual empresa · simulamos añadir 100 € sobre los
      //    1.862,16 ya aportados · total 1.962,16 dentro de 8.500 € ·
      //    empresa NO aplica tope 30 % (rolAportante='empresa') ·
      //    esDeducible=true.
      const vE = await limitesFiscalesPlanesService.validarAportacionDeducible(
        planId,
        100,
        2024,
        'empresa',
      );
      expect(vE.esDeducible).toBe(true);
      expect(vE.totalAportadoEjercicio).toBeCloseTo(1962.16, 2);
      expect(vE.excesoNoDeducible).toBe(0);
      expect(vE.topeEconomico).toBe(8500);
      expect(vE.tope30Rendimientos).toBeUndefined();
    });
  });

  describe('validarAportacionConyuge', () => {
    it('cónyuge con base 5.000 € · OK aportar 1.000 €', async () => {
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = limitesFiscalesPlanesService.validarAportacionConyuge(1000, 5000);
      expect(r.esValido).toBe(true);
      expect(r.limite).toBe(1000);
    });
    it('cónyuge con base 9.000 € · NO procede régimen', async () => {
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = limitesFiscalesPlanesService.validarAportacionConyuge(800, 9000);
      expect(r.esValido).toBe(false);
      expect(r.motivo).toContain('8.000');
    });
    it('cónyuge con base 5.000 € · aportar 1.500 € excede 1.000 €/año', async () => {
      const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');
      const r = limitesFiscalesPlanesService.validarAportacionConyuge(1500, 5000);
      expect(r.esValido).toBe(false);
      expect(r.motivo).toContain('1.000');
    });
  });
});
