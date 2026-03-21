import {
  buildFiscalExerciseContext,
  getCarryForwardSource,
  getDeclarationBootstrapCopy,
  getTruthPriority,
  getVisibleTruthColumns,
  shouldOfferDeclarationBootstrap,
  shouldRecalculateFiscalExercise,
  summarizeFiscalLifecycle,
} from '../modules/horizon/fiscalidad/modeloFundacional';

describe('modeloFundacional fiscal', () => {
  it('muestra las tres columnas en ejercicios declarados', () => {
    expect(getVisibleTruthColumns('declarado')).toEqual(['calculado', 'declarado', 'documentado']);
    expect(getVisibleTruthColumns('cerrado')).toEqual(['calculado']);
    expect(getVisibleTruthColumns('en_curso')).toEqual(['calculado']);
  });

  it('solo recalcula ejercicios en curso o cerrados', () => {
    expect(shouldRecalculateFiscalExercise('en_curso')).toBe(true);
    expect(shouldRecalculateFiscalExercise('cerrado')).toBe(true);
    expect(shouldRecalculateFiscalExercise('declarado')).toBe(false);
  });

  it('prioriza AEAT para verdad vigente y arrastres cuando existe declaración', () => {
    const context = buildFiscalExerciseContext(2024, 2026, {
      ejercicio: 2024,
      estado: 'declarado',
      calculoAtlas: {} as any,
      declaracionAeat: {} as any,
      declaracionAeatOrigen: 'pdf_importado',
      arrastresRecibidos: { porAnio: [], porInmueble: [] },
      arrastresGenerados: { porAnio: [], porInmueble: [] },
      documentos: [],
      createdAt: '2025-06-24T00:00:00.000Z',
      updatedAt: '2025-06-24T00:00:00.000Z',
    });

    expect(getTruthPriority(context)).toBe('aeat');
    expect(getCarryForwardSource(context)).toBe('casillas_aeat');

    const summary = summarizeFiscalLifecycle(context);
    expect(summary.calculadoCongelado).toBe(true);
    expect(summary.allowsEdits).toBe(false);
    expect(summary.visibleColumns).toEqual(['calculado', 'declarado', 'documentado']);
  });

  it('usa ATLAS como fallback cuando no hay AEAT importada', () => {
    const context = buildFiscalExerciseContext(2025, 2026, {
      ejercicio: 2025,
      estado: 'cerrado',
      calculoAtlas: {} as any,
      declaracionAeatOrigen: 'no_presentada',
      arrastresRecibidos: { porAnio: [], porInmueble: [] },
      arrastresGenerados: { porAnio: [], porInmueble: [] },
      documentos: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(getTruthPriority(context)).toBe('atlas');
    expect(getCarryForwardSource(context)).toBe('calculo_atlas');
    expect(summarizeFiscalLifecycle(context).recalculaMotor).toBe(true);
  });

  it('ofrece bootstrap completo cuando la primera declaración llega con la app vacía', () => {
    expect(shouldOfferDeclarationBootstrap(0, true)).toBe(true);
    expect(getDeclarationBootstrapCopy(0, true)).toMatch(/crear inmuebles, contratos, préstamos/i);
    expect(getDeclarationBootstrapCopy(0, false)).toMatch(/sin onboarding forzado/i);
    expect(getDeclarationBootstrapCopy(4, true)).toMatch(/evitar duplicados/i);
  });
});
