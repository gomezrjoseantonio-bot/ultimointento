// Tests · getCopyPorTipo (T-INVERSIONES-DETALLE-PP-v1 PR 4 · §5.4 + §5.6.1).
// Cubre la decisión tipo-aware que pide la spec §11 fila 7
// (PPE muestra "Lo que cuesta tener este plan" · PPI muestra "Lo que te cobra
// la gestora") sin necesidad de renderizar FichaPlanPensiones completa.

import { getCopyPorTipo } from '../tipoPlanCopy';

describe('getCopyPorTipo · §5.4 títulos tipo-aware', () => {
  test('PPI · accionable · "Lo que te cobra la gestora" + botón TER menor', () => {
    const c = getCopyPorTipo({ tipoAdministrativo: 'PPI' });
    expect(c.costesTitulo).toBe('Lo que te cobra la gestora');
    expect(c.p1Modo).toBe('accionable');
    expect(c.mostrarBotonBuscarTerMenor).toBe(true);
    expect(c.costesBannerTono).toBe('accionable');
  });

  test('PPE · informativo · "Lo que cuesta tener este plan" · sin botón', () => {
    const c = getCopyPorTipo({
      tipoAdministrativo: 'PPE',
      nombreEmpresa: 'Orange España',
    });
    expect(c.costesTitulo).toBe('Lo que cuesta tener este plan');
    expect(c.p1Modo).toBe('informativo');
    expect(c.mostrarBotonBuscarTerMenor).toBe(false);
    expect(c.costesBannerTono).toBe('educativo');
    expect(c.costesBannerTemplate).toContain('Orange España');
  });

  test('PPE sin nombreEmpresa · copy genérico "la empresa"', () => {
    const c = getCopyPorTipo({ tipoAdministrativo: 'PPE' });
    expect(c.costesBannerTemplate).toContain('la empresa');
  });

  test('PPES · accionable · botón sí', () => {
    const c = getCopyPorTipo({ tipoAdministrativo: 'PPES' });
    expect(c.costesTitulo).toBe('Lo que te cobra la gestora');
    expect(c.mostrarBotonBuscarTerMenor).toBe(true);
  });

  test('PPA garantizado · banner info-garantizado · sin botón', () => {
    const c = getCopyPorTipo({ tipoAdministrativo: 'PPA', garantizado: true });
    expect(c.costesBannerTono).toBe('info-garantizado');
    expect(c.mostrarBotonBuscarTerMenor).toBe(false);
    expect(c.costesBannerTemplate).toContain('garantizado');
  });

  test('PPA NO garantizado · banner accionable', () => {
    const c = getCopyPorTipo({ tipoAdministrativo: 'PPA', garantizado: false });
    expect(c.costesBannerTono).toBe('accionable');
    expect(c.mostrarBotonBuscarTerMenor).toBe(true);
  });
});

describe('getCopyPorTipo · §5.6.1 topes de aportación', () => {
  test('PPI base · 1.500 € · con discapacidad · 24.250 €', () => {
    expect(getCopyPorTipo({ tipoAdministrativo: 'PPI' }).topeAportacionAnualBase).toBe(1500);
    expect(
      getCopyPorTipo({ tipoAdministrativo: 'PPI', discapacidad: true }).topeAportacionAnualBase,
    ).toBe(24250);
  });

  test('PPA base · 1.500 € · con discapacidad · 24.250 €', () => {
    expect(getCopyPorTipo({ tipoAdministrativo: 'PPA' }).topeAportacionAnualBase).toBe(1500);
  });

  test('PPES base · 1.500 € · autónomo · 5.750 € · discapacidad · 24.250 €', () => {
    expect(getCopyPorTipo({ tipoAdministrativo: 'PPES' }).topeAportacionAnualBase).toBe(1500);
    expect(
      getCopyPorTipo({ tipoAdministrativo: 'PPES', esAutonomo: true }).topeAportacionAnualBase,
    ).toBe(5750);
    expect(
      getCopyPorTipo({
        tipoAdministrativo: 'PPES',
        esAutonomo: true,
        discapacidad: true,
      }).topeAportacionAnualBase,
    ).toBe(24250);
  });

  test('PPE · 10.000 € (1.500 titular + 8.500 empresa) · discapacidad · 24.250 €', () => {
    expect(getCopyPorTipo({ tipoAdministrativo: 'PPE' }).topeAportacionAnualBase).toBe(10000);
    expect(
      getCopyPorTipo({ tipoAdministrativo: 'PPE', discapacidad: true }).topeAportacionAnualBase,
    ).toBe(24250);
  });
});
