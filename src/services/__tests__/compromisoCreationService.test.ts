// TAREA 9.2 · Tests for compromisoCreationService
//
// Cubre los 7 tests obligatorios del §3.3 de la spec.
//
// Estrategia:
//   - fake-indexeddb · DB real V65 in-memory · validación canónica end-to-end
//   - se usa `compromisosRecurrentesService` real (no mock) · garantiza que
//     el flujo `puedeCrearCompromiso → crearCompromiso → regenerar eventos`
//     funciona con registros generados por T9.2
//   - candidato dummy construido con la misma forma que produce
//     `compromisoDetectionService` (campo `propuesta` + `id` estable)

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CandidatoCompromiso } from '../compromisoDetectionService';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

describe('compromisoCreationService.createCompromisosFromCandidatos', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  // Helper · construye un candidato fake con la propuesta canónica que
  // genera el detector. `id` es estable ⇒ idempotencia entre runs.
  function mkCandidato(
    overrides?: Partial<CandidatoCompromiso> & { propuesta?: Partial<CandidatoCompromiso['propuesta']> },
  ): CandidatoCompromiso {
    const baseProp: CandidatoCompromiso['propuesta'] = {
      ambito: 'personal',
      personalDataId: 1,
      alias: 'Suministro Iberdrola',
      tipo: 'suministro',
      subtipo: 'luz',
      proveedor: { nombre: 'IBERDROLA' },
      patron: { tipo: 'mensualDiaFijo', dia: 5 },
      importe: { modo: 'fijo', importe: 65.5 },
      variacion: { tipo: 'sinVariacion' },
      cuentaCargo: 10,
      conceptoBancario: 'IBERDROLA CLIENTES SAU',
      metodoPago: 'domiciliacion',
      categoria: 'vivienda.suministros',
      bolsaPresupuesto: 'necesidades',
      responsable: 'titular',
      fechaInicio: '2025-01-05',
      estado: 'activo',
      derivadoDe: { fuente: 'manual', refId: 'T9-detection' },
    };
    return {
      id: 'cand:10:IBERDROLA_CLIENTES_SAU',
      conceptoNormalizado: 'IBERDROLA CLIENTES SAU',
      cuentaCargo: 10,
      ocurrencias: [],
      patronInferido: baseProp.patron,
      importeInferido: baseProp.importe,
      variacionInferida: baseProp.variacion ?? { tipo: 'sinVariacion' },
      confidence: 90,
      razonesScore: ['12 ocurrencias', 'patrón temporal estable'],
      avisos: [],
      ...overrides,
      propuesta: { ...baseProp, ...(overrides?.propuesta ?? {}) },
    } as CandidatoCompromiso;
  }

  // Seed mínimo: necesitamos 1 personalData con id=1 para que
  // puedeCrearCompromiso (ámbito='personal') no rechace por
  // personalDataId inexistente.
  async function seedPersonalData(): Promise<void> {
    const { initDB } = await import('../db');
    const db = await initDB();
    const tx = db.transaction('personalData', 'readwrite');
    await tx.objectStore('personalData').put({
      id: 1,
      nombre: 'Test',
      apellidos: 'User',
      dni: '12345678A',
      fechaActualizacion: new Date().toISOString(),
    } as any);
    await tx.done;
  }

  // ── Test 1 ────────────────────────────────────────────────────────────
  it('1. 3 candidatos sin duplicados · 3 creados · 0 omitidos', async () => {
    await seedPersonalData();
    const { createCompromisosFromCandidatos } = await import('../compromisoCreationService');

    const candidatos = [
      mkCandidato({
        id: 'cand:10:IBERDROLA',
        propuesta: { conceptoBancario: 'IBERDROLA CLIENTES SAU', alias: 'Iberdrola' },
      }),
      mkCandidato({
        id: 'cand:10:NETFLIX',
        propuesta: {
          conceptoBancario: 'NETFLIX INTERNATIONAL',
          alias: 'Netflix',
          tipo: 'suscripcion',
          subtipo: undefined,
          categoria: 'suscripciones',
          bolsaPresupuesto: 'deseos',
          proveedor: { nombre: 'NETFLIX' },
          importe: { modo: 'fijo', importe: 14.99 },
        },
      }),
      mkCandidato({
        id: 'cand:10:GIMNASIO',
        propuesta: {
          conceptoBancario: 'GIMNASIO BASIC FIT',
          alias: 'Gimnasio',
          tipo: 'cuota',
          subtipo: undefined,
          categoria: 'personal',
          bolsaPresupuesto: 'deseos',
          proveedor: { nombre: 'BASIC' },
          importe: { modo: 'fijo', importe: 39.95 },
        },
      }),
    ];

    const result = await createCompromisosFromCandidatos(candidatos);

    expect(result.creados).toHaveLength(3);
    expect(result.duplicadosOmitidos).toHaveLength(0);
    expect(result.erroresValidacion).toHaveLength(0);
    expect(result.creados.every((c) => typeof c.id === 'number')).toBe(true);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────
  it('2. 2 candidatos · 1 ya existe en store · 1 creado · 1 omitido', async () => {
    await seedPersonalData();
    const { createCompromisosFromCandidatos } = await import('../compromisoCreationService');

    // Crear el primero · simula que ya estaba antes de la 2ª ronda
    const round1 = await createCompromisosFromCandidatos([
      mkCandidato({
        id: 'cand:10:IBERDROLA',
        propuesta: { conceptoBancario: 'IBERDROLA CLIENTES SAU' },
      }),
    ]);
    expect(round1.creados).toHaveLength(1);

    const result = await createCompromisosFromCandidatos([
      mkCandidato({
        id: 'cand:10:IBERDROLA',
        propuesta: { conceptoBancario: 'IBERDROLA CLIENTES SAU' },
      }),
      mkCandidato({
        id: 'cand:10:NETFLIX',
        propuesta: {
          conceptoBancario: 'NETFLIX INTERNATIONAL',
          alias: 'Netflix',
          tipo: 'suscripcion',
          subtipo: undefined,
          categoria: 'suscripciones',
          bolsaPresupuesto: 'deseos',
          proveedor: { nombre: 'NETFLIX' },
          importe: { modo: 'fijo', importe: 14.99 },
        },
      }),
    ]);

    expect(result.creados).toHaveLength(1);
    expect(result.duplicadosOmitidos).toEqual(['cand:10:IBERDROLA']);
    expect(result.erroresValidacion).toHaveLength(0);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────
  it('3. candidato con override de alias · se persiste con el alias modificado', async () => {
    await seedPersonalData();
    const { createCompromisosFromCandidatos } = await import('../compromisoCreationService');

    const cand = mkCandidato({ id: 'cand:10:IBE' });
    const overrides = new Map<string, Partial<CompromisoRecurrente>>();
    overrides.set('cand:10:IBE', { alias: 'Mi Iberdrola Editado' });

    const result = await createCompromisosFromCandidatos([cand], {
      ajustesPorCandidato: overrides,
    });

    expect(result.creados).toHaveLength(1);
    expect(result.creados[0].alias).toBe('Mi Iberdrola Editado');
  });

  // ── Test 4 ────────────────────────────────────────────────────────────
  it('4. candidato con override de categoria · respetado', async () => {
    await seedPersonalData();
    const { createCompromisosFromCandidatos } = await import('../compromisoCreationService');

    const cand = mkCandidato({ id: 'cand:10:IBE2' });
    const overrides = new Map<string, Partial<CompromisoRecurrente>>();
    overrides.set('cand:10:IBE2', {
      categoria: 'inmueble.suministros',
      bolsaPresupuesto: 'inmueble',
    });

    const result = await createCompromisosFromCandidatos([cand], {
      ajustesPorCandidato: overrides,
    });

    expect(result.creados).toHaveLength(1);
    expect(result.creados[0].categoria).toBe('inmueble.suministros');
    expect(result.creados[0].bolsaPresupuesto).toBe('inmueble');
  });

  // ── Test 5 ────────────────────────────────────────────────────────────
  it('5. candidato con propuesta inválida (cuentaCargo=0) · error de validación · NO crea', async () => {
    await seedPersonalData();
    const { createCompromisosFromCandidatos } = await import('../compromisoCreationService');

    const cand = mkCandidato({
      id: 'cand:0:BAD',
      propuesta: { cuentaCargo: 0 },
    });

    const result = await createCompromisosFromCandidatos([cand]);

    expect(result.creados).toHaveLength(0);
    expect(result.erroresValidacion).toHaveLength(1);
    expect(result.erroresValidacion[0].candidatoId).toBe('cand:0:BAD');
    expect(result.erroresValidacion[0].motivo).toMatch(/cuentaCargo/i);
  });

  // ── Test 6 ────────────────────────────────────────────────────────────
  it('6. idempotente · 2 ejecuciones con mismos candidatos · 2ª no crea nada · todos omitidos', async () => {
    await seedPersonalData();
    const { createCompromisosFromCandidatos } = await import('../compromisoCreationService');

    const candidatos = [
      mkCandidato({
        id: 'cand:10:IBE',
        propuesta: { conceptoBancario: 'IBERDROLA CLIENTES SAU' },
      }),
      mkCandidato({
        id: 'cand:10:NF',
        propuesta: {
          conceptoBancario: 'NETFLIX INTERNATIONAL',
          alias: 'Netflix',
          tipo: 'suscripcion',
          subtipo: undefined,
          categoria: 'suscripciones',
          bolsaPresupuesto: 'deseos',
          proveedor: { nombre: 'NETFLIX' },
          importe: { modo: 'fijo', importe: 14.99 },
        },
      }),
    ];

    const r1 = await createCompromisosFromCandidatos(candidatos);
    expect(r1.creados).toHaveLength(2);

    const r2 = await createCompromisosFromCandidatos(candidatos);
    expect(r2.creados).toHaveLength(0);
    expect(r2.duplicadosOmitidos).toEqual(['cand:10:IBE', 'cand:10:NF']);
    expect(r2.erroresValidacion).toHaveLength(0);
  });

  // ── Test 7 ────────────────────────────────────────────────────────────
  it('7. creación + lectura via compromisosRecurrentesService.listarCompromisos · devuelve los nuevos', async () => {
    await seedPersonalData();
    const { createCompromisosFromCandidatos } = await import('../compromisoCreationService');
    const { listarCompromisos } = await import('../personal/compromisosRecurrentesService');

    const candidatos = [
      mkCandidato({
        id: 'cand:10:IBE',
        propuesta: { conceptoBancario: 'IBERDROLA CLIENTES SAU', alias: 'Iberdrola' },
      }),
      mkCandidato({
        id: 'cand:10:NF',
        propuesta: {
          conceptoBancario: 'NETFLIX INTERNATIONAL',
          alias: 'Netflix',
          tipo: 'suscripcion',
          subtipo: undefined,
          categoria: 'suscripciones',
          bolsaPresupuesto: 'deseos',
          proveedor: { nombre: 'NETFLIX' },
          importe: { modo: 'fijo', importe: 14.99 },
        },
      }),
    ];

    const created = await createCompromisosFromCandidatos(candidatos);
    expect(created.creados).toHaveLength(2);

    const activos = await listarCompromisos({ soloActivos: true });
    const aliases = activos.map((c) => c.alias).sort();
    expect(aliases).toEqual(['Iberdrola', 'Netflix']);
  });
});
