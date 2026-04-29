/**
 * Atlas Navigation Audit · alineado a la navegación v5 canónica
 * (T20 Phase 0-3g). Ver `src/config/navigation.ts`.
 *
 * Las 11 rutas canónicas v5 · Panel · Inmuebles · Inversiones · Tesorería
 * · Financiación · Personal · Contratos · Mi Plan · Fiscal · Archivo ·
 * Ajustes. Items legacy ('Dashboard' · 'Previsiones' · 'Impuestos' ·
 * 'Documentación' · 'Herramientas' · 'Glosario' · 'Alquileres') han sido
 * eliminados o renombrados.
 */

import { Icons } from '../design-system/v5';
import { navigationConfig, getNavigationForModule } from '../config/navigation';

describe('Atlas Navigation Audit · v5', () => {
  const navigation = getNavigationForModule();

  test('expone exactamente las 11 rutas v5 canónicas', () => {
    expect(navigation).toHaveLength(11);
  });

  test('respeta el orden canónico de la guía v5', () => {
    const expected = [
      'Panel',
      'Inmuebles',
      'Inversiones',
      'Tesorería',
      'Financiación',
      'Personal',
      'Contratos',
      'Mi Plan',
      'Fiscal',
      'Archivo',
      'Ajustes',
    ];
    expect(navigation.map((item) => item.name)).toEqual(expected);
  });

  test('todos los items apuntan a rutas v5 (no legacy)', () => {
    const hrefs = navigation.map((item) => item.href);
    // Ninguna ruta legacy debe aparecer en el menú principal.
    expect(hrefs).not.toContain('/inmuebles/supervision');
    expect(hrefs).not.toContain('/personal/supervision');
    expect(hrefs).not.toContain('/fiscalidad');
    expect(hrefs).not.toContain('/inbox');
    expect(hrefs).not.toContain('/inversiones/resumen');
    expect(hrefs).not.toContain('/proyeccion');
  });

  test('Contratos apunta a /contratos directamente · no via redirect', () => {
    const contratos = navigation.find((item) => item.name === 'Contratos');
    expect(contratos).toBeDefined();
    expect(contratos?.href).toBe('/contratos');
  });

  test('items usan el diccionario Icons v5 · no Lucide directo', () => {
    expect(navigationConfig[0].icon).toBe(Icons.Panel);
    expect(navigationConfig.find((i) => i.name === 'Inmuebles')?.icon).toBe(Icons.Inmuebles);
    expect(navigationConfig.find((i) => i.name === 'Inversiones')?.icon).toBe(Icons.Inversiones);
    expect(navigationConfig.find((i) => i.name === 'Tesorería')?.icon).toBe(Icons.Tesoreria);
    expect(navigationConfig.find((i) => i.name === 'Financiación')?.icon).toBe(Icons.Financiacion);
    expect(navigationConfig.find((i) => i.name === 'Personal')?.icon).toBe(Icons.Personal);
    expect(navigationConfig.find((i) => i.name === 'Contratos')?.icon).toBe(Icons.Contratos);
    expect(navigationConfig.find((i) => i.name === 'Mi Plan')?.icon).toBe(Icons.MiPlan);
    expect(navigationConfig.find((i) => i.name === 'Fiscal')?.icon).toBe(Icons.Fiscal);
    expect(navigationConfig.find((i) => i.name === 'Archivo')?.icon).toBe(Icons.Archivo);
    expect(navigationConfig.find((i) => i.name === 'Ajustes')?.icon).toBe(Icons.Ajustes);
  });

  test('Inversiones expone sus 4 sub-páginas v5', () => {
    const inversiones = navigation.find((item) => item.name === 'Inversiones');
    const subs = inversiones?.subTabs?.map((t) => t.name) ?? [];
    expect(subs).toEqual(['Resumen', 'Cartera', 'Rendimientos', 'Individual']);
  });

  test('Financiación expone sus 4 sub-páginas v5', () => {
    const financiacion = navigation.find((item) => item.name === 'Financiación');
    const subs = financiacion?.subTabs?.map((t) => t.name) ?? [];
    expect(subs).toEqual(['Dashboard', 'Listado', 'Snowball', 'Calendario']);
  });

  test('Mi Plan expone sus 6 sub-páginas v5', () => {
    const miPlan = navigation.find((item) => item.name === 'Mi Plan');
    const subs = miPlan?.subTabs?.map((t) => t.name) ?? [];
    expect(subs).toEqual([
      'Mi Plan',
      'Proyección',
      'Libertad financiera',
      'Objetivos',
      'Fondos de ahorro',
      'Retos',
    ]);
  });

  test('Fiscal expone sus 4 sub-páginas v5', () => {
    const fiscal = navigation.find((item) => item.name === 'Fiscal');
    const subs = fiscal?.subTabs?.map((t) => t.name) ?? [];
    expect(subs).toEqual(['Calendario', 'Ejercicios', 'Deudas', 'Configuración']);
  });

  test('Archivo y Ajustes en sección documentation', () => {
    const docItems = navigation.filter((item) => item.section === 'documentation');
    expect(docItems.map((i) => i.name)).toEqual(['Archivo', 'Ajustes']);
  });

  test('Sección horizon contiene los 9 módulos principales v5', () => {
    const horizon = navigation.filter((item) => item.section === 'horizon');
    expect(horizon).toHaveLength(9);
  });

  test('Sección pulse vacía hasta Phase 4 cleanup', () => {
    const pulse = navigation.filter((item) => item.section === 'pulse');
    expect(pulse).toHaveLength(0);
  });

  test('No incluye items legacy de pre-T20', () => {
    const names = navigation.map((item) => item.name);
    expect(names).not.toContain('Dashboard');
    expect(names).not.toContain('Previsiones');
    expect(names).not.toContain('Impuestos');
    expect(names).not.toContain('Documentación');
    expect(names).not.toContain('Herramientas');
    expect(names).not.toContain('Glosario');
    expect(names).not.toContain('Alquileres');
    expect(names).not.toContain('Informes');
    expect(names).not.toContain('Configuración');
    expect(names).not.toContain('Tareas');
  });
});
