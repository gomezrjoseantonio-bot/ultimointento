/**
 * Atlas Navigation Audit · alineado a la navegación v5 canónica
 * (T20 Phase 0-3g). Ver `src/config/navigation.ts`.
 *
 * Las 11 rutas canónicas v5 · Panel · Inmuebles · Inversiones · Tesorería
 * · Financiación · Personal · Alquileres · Mi Plan · Fiscal · Archivo ·
 * Ajustes. El módulo operativo se muestra visualmente como "Alquileres"
 * (consolidación Contratos → Alquileres) conservando la ruta `/contratos`
 * y el icono `Icons.Contratos`. Items legacy ('Dashboard' · 'Previsiones' ·
 * 'Impuestos' · 'Documentación' · 'Herramientas' · 'Glosario') han sido
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
      'Alquileres',
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

  test('Alquileres apunta a /contratos directamente · no via redirect', () => {
    // Consolidación Contratos → Alquileres · nombre visual "Alquileres",
    // ruta conservada `/contratos` (sin renombrado de rutas ni redirects).
    const alquileres = navigation.find((item) => item.name === 'Alquileres');
    expect(alquileres).toBeDefined();
    expect(alquileres?.href).toBe('/contratos');
  });

  test('items usan el diccionario Icons v5 · no Lucide directo', () => {
    expect(navigationConfig[0].icon).toBe(Icons.Panel);
    expect(navigationConfig.find((i) => i.name === 'Inmuebles')?.icon).toBe(Icons.Inmuebles);
    expect(navigationConfig.find((i) => i.name === 'Inversiones')?.icon).toBe(Icons.Inversiones);
    expect(navigationConfig.find((i) => i.name === 'Tesorería')?.icon).toBe(Icons.Tesoreria);
    expect(navigationConfig.find((i) => i.name === 'Financiación')?.icon).toBe(Icons.Financiacion);
    expect(navigationConfig.find((i) => i.name === 'Personal')?.icon).toBe(Icons.Personal);
    // "Alquileres" (nombre visual) conserva el icono interno `Icons.Contratos`.
    expect(navigationConfig.find((i) => i.name === 'Alquileres')?.icon).toBe(Icons.Contratos);
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

  test('Financiación es UNA sola vista · sin sub-páginas', () => {
    // TAREA-CC-UI-financiacion-v1 §5.5 · las 4 pestañas (Dashboard · Listado ·
    // Snowball · Calendario) y sus tablas de 12 y 18 columnas se retiran: lo
    // que valía de ellas vive ahora en la escalera y en el detalle, y el
    // Snowball se va a Mi Plan. Mockup · atlas-financiacion-v10.html.
    const financiacion = navigation.find((item) => item.name === 'Financiación');
    expect(financiacion?.href).toBe('/financiacion');
    expect(financiacion?.subTabs).toBeUndefined();
  });

  test('Mi Plan expone sus 5 sub-páginas v5 (Retos postpuesto en T27.2-skip)', () => {
    // T27.2-skip · "Retos" oculto del menú principal mientras
    // `SHOW_RETOS` (src/modules/mi-plan/featureFlags) esté en false.
    // Al revivir · añadir 'Retos' al final del array esperado.
    const miPlan = navigation.find((item) => item.name === 'Mi Plan');
    const subs = miPlan?.subTabs?.map((t) => t.name) ?? [];
    expect(subs).toEqual([
      'Mi Plan',
      'Proyección',
      'Libertad financiera',
      'Objetivos',
      'Fondos de ahorro',
    ]);
  });

  test('Fiscal expone sus 4 sub-páginas v5', () => {
    const fiscal = navigation.find((item) => item.name === 'Fiscal');
    const subs = fiscal?.subTabs?.map((t) => t.name) ?? [];
    // Sub-tarea 6 SPEC-CC-FISCAL-UI-REPLACE-v1 · "Configuración" renombrado
    // a "Acciones" alineado con F6 del mockup atlas-fiscal-v3.
    expect(subs).toEqual(['Calendario', 'Ejercicios', 'Deudas', 'Acciones']);
  });

  // Taxonomía T22.1 §2.1 · 4 secciones canónicas: panel · mis-activos ·
  // operativa · ajustes. (Los nombres antiguos 'documentation' / 'horizon' /
  // 'pulse' ya no existen en `navigation.ts`.)
  test('Sección operativa · Alquileres · Mi Plan · Fiscal · Archivo', () => {
    const operativa = navigation.filter((item) => item.section === 'operativa');
    expect(operativa.map((i) => i.name)).toEqual([
      'Alquileres',
      'Mi Plan',
      'Fiscal',
      'Archivo',
    ]);
  });

  test('Sección ajustes · solo Ajustes', () => {
    const ajustes = navigation.filter((item) => item.section === 'ajustes');
    expect(ajustes.map((i) => i.name)).toEqual(['Ajustes']);
  });

  test('9 módulos principales · secciones mis-activos + operativa', () => {
    const principales = navigation.filter(
      (item) => item.section === 'mis-activos' || item.section === 'operativa',
    );
    expect(principales).toHaveLength(9);
  });

  test('solo usa las 4 secciones canónicas v5', () => {
    const sections = Array.from(new Set(navigation.map((i) => i.section))).sort();
    expect(sections).toEqual(['ajustes', 'mis-activos', 'operativa', 'panel']);
  });

  test('No incluye items legacy de pre-T20', () => {
    const names = navigation.map((item) => item.name);
    expect(names).not.toContain('Dashboard');
    expect(names).not.toContain('Previsiones');
    expect(names).not.toContain('Impuestos');
    expect(names).not.toContain('Documentación');
    expect(names).not.toContain('Herramientas');
    expect(names).not.toContain('Glosario');
    // 'Alquileres' es ahora el nombre visual del módulo operativo
    // (consolidación Contratos → Alquileres), ya no un item legacy retirado.
    expect(names).not.toContain('Informes');
    expect(names).not.toContain('Configuración');
    expect(names).not.toContain('Tareas');
  });
});
