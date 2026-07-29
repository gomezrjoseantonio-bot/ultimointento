// ============================================================================
// Tests · alquiler de la vivienda habitual (Fase 3 · funciones puras)
// ============================================================================

import {
  esCompromisoAlquilerVH,
  sumarEventosAlquilerEjercicio,
} from '../alquilerViviendaHabitualService';

describe('Fase 3 VH · esCompromisoAlquilerVH', () => {
  const base = {
    ambito: 'personal' as const,
    categoria: 'vivienda.alquiler',
    estado: 'activo' as const,
  };

  test('alquiler personal activo sin flag · default-true → SÍ', () => {
    expect(esCompromisoAlquilerVH({ ...base })).toBe(true);
  });

  test('flag true explícito · SÍ', () => {
    expect(esCompromisoAlquilerVH({ ...base, esViviendaHabitual: true })).toBe(true);
  });

  test('desmarcado explícito (false) · NO (trastero, segunda vivienda…)', () => {
    expect(esCompromisoAlquilerVH({ ...base, esViviendaHabitual: false })).toBe(false);
  });

  test('otra categoría · NO', () => {
    expect(esCompromisoAlquilerVH({ ...base, categoria: 'vivienda.suministros' })).toBe(false);
  });

  test('ámbito inmueble · NO (eso es un gasto del inmueble de inversión)', () => {
    expect(esCompromisoAlquilerVH({ ...base, ambito: 'inmueble' })).toBe(false);
  });

  test('dado de baja · NO', () => {
    expect(esCompromisoAlquilerVH({ ...base, estado: 'baja' as never })).toBe(false);
  });
});

describe('Fase 3 VH · sumarEventosAlquilerEjercicio', () => {
  const eventos = [
    { amount: -800, predictedDate: '2024-01-01', sourceType: 'gasto_recurrente' as const },
    { amount: -800, predictedDate: '2024-06-01', sourceType: 'gasto_recurrente' as const },
    { amount: -820, predictedDate: '2025-01-01', sourceType: 'gasto_recurrente' as const }, // otro año
    { amount: -100, predictedDate: '2024-03-01', sourceType: 'manual' as const },           // otra fuente
  ];

  test('suma |importe| solo de gasto_recurrente del ejercicio', () => {
    expect(sumarEventosAlquilerEjercicio(eventos, 2024)).toBe(1600);
  });

  test('año por slice del ISO · 2024-01-01 cae en 2024 (sin shift TZ)', () => {
    expect(sumarEventosAlquilerEjercicio(
      [{ amount: -500, predictedDate: '2024-01-01', sourceType: 'gasto_recurrente' }],
      2024,
    )).toBe(500);
  });

  test('ejercicio sin eventos · 0', () => {
    expect(sumarEventosAlquilerEjercicio(eventos, 2030)).toBe(0);
  });
});
