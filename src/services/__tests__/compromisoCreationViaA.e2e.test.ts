// TAREA 9.2 · Verificación end-to-end · vía A activada tras creación
//
// Spec §3.4 · CC ejecuta manualmente:
//   1. Crear 1 compromiso con `createCompromisosFromCandidatos`
//   2. Llamar `movementSuggestionService.suggestForUnmatched([movementId])`
//      con un movement que matchea ese compromiso
//   3. Verificar que devuelve sugerencia con `via='compromiso_recurrente'`
//      y `confidence ≥ 70`
//
// Esta prueba es la garantía de que la vía A se activa "sola" en cuanto
// `compromisosRecurrentes` deja de estar vacío. NO se modifica
// `movementSuggestionService` · solo se verifica el contrato T17.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CandidatoCompromiso } from '../compromisoDetectionService';

describe('T9.2 · vía A activada end-to-end', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('crea compromiso · suggestForUnmatched devuelve via=compromiso_recurrente con confidence ≥ 70', async () => {
    // Seed personalData (id=1)
    const { initDB } = await import('../db');
    const db = await initDB();
    await db.put('personalData', {
      id: 1,
      nombre: 'Test',
      apellidos: 'User',
      dni: '12345678A',
      fechaActualizacion: new Date().toISOString(),
    } as any);

    // Crear compromiso vía 9.2
    const candidato: CandidatoCompromiso = {
      id: 'cand:42:IBERDROLA',
      conceptoNormalizado: 'IBERDROLA CLIENTES SAU',
      cuentaCargo: 42,
      ocurrencias: [],
      patronInferido: { tipo: 'mensualDiaFijo', dia: 5 },
      importeInferido: { modo: 'fijo', importe: 65.5 },
      variacionInferida: { tipo: 'sinVariacion' },
      confidence: 90,
      razonesScore: ['12 ocurrencias'],
      avisos: [],
      propuesta: {
        ambito: 'personal',
        personalDataId: 1,
        alias: 'Iberdrola',
        tipo: 'suministro',
        subtipo: 'luz',
        proveedor: { nombre: 'IBERDROLA' },
        patron: { tipo: 'mensualDiaFijo', dia: 5 },
        importe: { modo: 'fijo', importe: 65.5 },
        variacion: { tipo: 'sinVariacion' },
        cuentaCargo: 42,
        conceptoBancario: 'IBERDROLA CLIENTES SAU',
        metodoPago: 'domiciliacion',
        categoria: 'vivienda.suministros',
        bolsaPresupuesto: 'necesidades',
        responsable: 'titular',
        fechaInicio: '2025-01-05',
        estado: 'activo',
        derivadoDe: { fuente: 'manual', refId: 'T9-detection' },
      },
    };

    const { createCompromisosFromCandidatos } = await import('../compromisoCreationService');
    const created = await createCompromisosFromCandidatos([candidato]);
    expect(created.creados).toHaveLength(1);

    // Insertar un movement que matchea (cuenta + importe ± 5%)
    const movId = await db.add('movements', {
      accountId: 42,
      date: '2026-04-22',
      amount: -65.5, // céntimo exacto · base 70 + 10
      description: 'RECIBO IBERDROLA CLIENTES MES ABRIL', // contiene "iberdrola" · +10
      status: 'pending',
      unifiedStatus: 'no_planificado',
      source: 'import',
      type: 'Gasto',
      origin: 'CSV',
      movementState: 'Confirmado',
      category: { tipo: 'suministros' },
      ambito: 'PERSONAL',
      statusConciliacion: 'sin_match',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
    } as any);

    // Llamar a suggestForUnmatched
    const { suggestForUnmatched } = await import('../movementSuggestionService');
    const result = await suggestForUnmatched([movId as number]);

    const sugerencias = result.get(movId as number);
    expect(sugerencias).toBeDefined();
    const viaA = sugerencias!.find((s) => s.via === 'compromiso_recurrente');
    expect(viaA).toBeDefined();
    expect(viaA!.confidence).toBeGreaterThanOrEqual(70);
    expect(viaA!.action.kind).toBe('create_treasury_event');
    if (viaA!.action.kind === 'create_treasury_event') {
      expect(viaA!.action.sourceType).toBe('gasto_recurrente');
      expect(viaA!.action.ambito).toBe('PERSONAL');
    }
  });
});
