/**
 * ATLAS Navigation Audit Test
 * 
 * This test validates the ATLAS navigation requirements:
 * 1. Exactly 9 navigation entries
 * 2. Correct separators: "Horizon — Supervisión", "Pulse — Gestión", "Documentación"
 * 3. Configuración and Tareas are NOT in the sidebar
 * 4. Correct order of items
 */

import { navigationConfig, getNavigationForModule } from '../config/navigation';

describe('ATLAS Navigation Audit', () => {
  const navigation = getNavigationForModule();

  test('should have exactly 9 navigation entries', () => {
    expect(navigation).toHaveLength(9);
  });

  test('should have correct navigation items in exact order', () => {
    const expectedItems = [
      'Dashboard',
      'Personal',
      'Inmuebles', 
      'Tesorería',
      'Proyecciones',
      'Fiscalidad',
      'Financiación',
      'Alquileres',
      'Documentación'
    ];

    const actualItems = navigation.map(item => item.name);
    expect(actualItems).toEqual(expectedItems);
  });

  test('should have correct section groupings', () => {
    const horizonItems = navigation.filter(item => item.section === 'horizon');
    const pulseItems = navigation.filter(item => item.section === 'pulse');
    const documentationItems = navigation.filter(item => item.section === 'documentation');

    // HORIZON — Supervisión should have 7 items
    expect(horizonItems).toHaveLength(7);
    
    // PULSE — Gestión should have 1 item
    expect(pulseItems).toHaveLength(1);
    
    // DOCUMENTACIÓN should have 1 item
    expect(documentationItems).toHaveLength(1);
  });

  test('should not include Configuración in sidebar navigation', () => {
    const hasConfiguracion = navigation.some(item => item.name === 'Configuración');
    expect(hasConfiguracion).toBe(false);
  });

  test('should not include standalone Tareas in sidebar navigation', () => {
    const hasStandaloneTareas = navigation.some(item => item.name === 'Tareas');
    expect(hasStandaloneTareas).toBe(false);
  });

  test('should include Tareas as subtab in Inmuebles', () => {
    const inmuebles = navigation.find(item => item.name === 'Inmuebles');
    expect(inmuebles).toBeDefined();
    expect(inmuebles?.subTabs).toBeDefined();
    
    const tareasSubtab = inmuebles?.subTabs?.find(subtab => subtab.name === 'Tareas');
    expect(tareasSubtab).toBeDefined();
  });

  test('should have correct Horizon section items', () => {
    const horizonItems = navigation.filter(item => item.section === 'horizon');
    const expectedHorizonItems = [
      'Dashboard',
      'Personal', 
      'Inmuebles',
      'Tesorería',
      'Proyecciones',
      'Fiscalidad',
      'Financiación'
    ];
    
    const actualHorizonItems = horizonItems.map(item => item.name);
    expect(actualHorizonItems).toEqual(expectedHorizonItems);
  });

  test('should have correct Pulse section items', () => {
    const pulseItems = navigation.filter(item => item.section === 'pulse');
    expect(pulseItems).toHaveLength(1);
    expect(pulseItems[0].name).toBe('Alquileres');
  });

  test('should have correct Documentation section items', () => {
    const documentationItems = navigation.filter(item => item.section === 'documentation');
    expect(documentationItems).toHaveLength(1);
    expect(documentationItems[0].name).toBe('Documentación');
  });

  test('should have Tesorería with Cobros/Pagos and Importar subtabs', () => {
    const tesoreria = navigation.find(item => item.name === 'Tesorería');
    expect(tesoreria).toBeDefined();
    expect(tesoreria?.subTabs).toBeDefined();
    
    const subtabNames = tesoreria?.subTabs?.map(subtab => subtab.name) || [];
    expect(subtabNames).toContain('Cobros/Pagos');
    expect(subtabNames).toContain('Importar');
  });

  test('should have Alquileres with required management subtabs', () => {
    const alquileres = navigation.find(item => item.name === 'Alquileres');
    expect(alquileres).toBeDefined();
    expect(alquileres?.subTabs).toBeDefined();
    
    const subtabNames = alquileres?.subTabs?.map(subtab => subtab.name) || [];
    expect(subtabNames).toContain('Renovación');
    expect(subtabNames).toContain('Subidas');
    expect(subtabNames).toContain('Envío a firmar');
  });

  test('should have Documentación with repository and filter subtabs', () => {
    const documentacion = navigation.find(item => item.name === 'Documentación');
    expect(documentacion).toBeDefined();
    expect(documentacion?.subTabs).toBeDefined();
    
    const subtabNames = documentacion?.subTabs?.map(subtab => subtab.name) || [];
    expect(subtabNames).toContain('Repositorio');
    expect(subtabNames).toContain('Filtros');
    expect(subtabNames).toContain('Extracción fiscal');
    expect(subtabNames).toContain('Inspecciones');
  });
});