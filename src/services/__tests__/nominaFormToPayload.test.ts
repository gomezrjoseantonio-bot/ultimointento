// ============================================================================
// S-WIZARD-NOMINA-V3 · sub-tarea 4 · tests builder + validación
// ============================================================================

import {
  buildNominaPayload,
  validarFormNomina,
  type NominaFormState,
  type SSContext,
} from '../nominaFormToPayload';

const ssCtx: SSContext = {
  ssTope: 5101.20,
  ssDefaults: {
    contingenciasComunes: { trabajador: 4.70, empresa: 23.60 },
    desempleo: { trabajador: 1.55, empresa: 5.50 },
    formacionProfesional: { trabajador: 0.10, empresa: 0.60 },
    mei: { trabajador: 0.15, empresa: 0.67 },
  } as ReturnType<SSContext['ssDefaults'] extends infer T ? () => T : never>,
  ssPctSugerido: 6.50,
};

function baseState(overrides: Partial<NominaFormState> = {}): NominaFormState {
  return {
    pid: 1,
    titular: 'yo',
    empresa: 'Orange Espagne SAU',
    cuentaId: 42,
    vigenteDesde: '2026-01',
    diaCobro: '25',
    brutoRaw: '95178,16',
    numeroPagas: 14,
    mesesExtra: [6, 12],
    irpfRaw: '34,25',
    ssRaw: '6,50',
    solidaridadRaw: '91,80',
    variables: [],
    planActivo: false,
    planVinculadoId: '',
    planAportTuyaRaw: '0',
    planAportEmpresaRaw: '0',
    especieActivo: false,
    especies: [],
    ...overrides,
  };
}

describe('buildNominaPayload', () => {
  test('payload mínimo · sin plan, sin especie, 14 pagas', () => {
    const p = buildNominaPayload(baseState(), ssCtx);
    expect(p).not.toBeNull();
    expect(p!.personalDataId).toBe(1);
    expect(p!.titular).toBe('yo');
    expect(p!.nombre).toBe('Orange Espagne SAU');
    expect(p!.salarioBrutoAnual).toBeCloseTo(95178.16, 2);
    expect(p!.distribucion).toEqual({ tipo: 'catorce', meses: 14 });
    expect(p!.pagasExtra).toEqual({ mesesExtra: [6, 12] });
    expect(p!.cuentaAbono).toBe(42);
    expect(p!.reglaCobroDia).toEqual({ tipo: 'fijo', dia: 25 });
    expect(p!.retencion.irpfPorcentaje).toBeCloseTo(34.25, 2);
    expect(p!.retencion.cuotaSolidaridadMensual).toBeCloseTo(7.65, 2);
    expect(p!.planPensiones).toBeUndefined();
    expect(p!.beneficiosSociales).toEqual([]);
    expect(p!.activa).toBe(true);
  });

  test('null si pid no está disponible', () => {
    const p = buildNominaPayload(baseState({ pid: null as unknown as number }), ssCtx);
    expect(p).toBeNull();
  });

  test('día 31 mapea a regla "ultimo-habil"', () => {
    const p = buildNominaPayload(baseState({ diaCobro: '31' }), ssCtx);
    expect(p!.reglaCobroDia).toEqual({ tipo: 'ultimo-habil' });
  });

  test('12 pagas · NO genera pagasExtra', () => {
    const p = buildNominaPayload(
      baseState({ numeroPagas: 12, mesesExtra: [] }),
      ssCtx,
    );
    expect(p!.distribucion).toEqual({ tipo: 'doce', meses: 12 });
    expect(p!.pagasExtra).toBeUndefined();
  });

  test('15 pagas · distribucion personalizada + pagasExtra', () => {
    const p = buildNominaPayload(
      baseState({ numeroPagas: 15, mesesExtra: [3, 6, 12] }),
      ssCtx,
    );
    expect(p!.distribucion).toEqual({ tipo: 'personalizado', meses: 15 });
    expect(p!.pagasExtra).toEqual({ mesesExtra: [3, 6, 12] });
  });

  test('plan activo + plan id válido · genera planPensiones', () => {
    const p = buildNominaPayload(
      baseState({
        planActivo: true,
        planVinculadoId: 'plan-uuid-123',
        planVinculadoNombre: 'PPC DE OSP Y OSFI',
        planAportTuyaRaw: '122,76',
        planAportEmpresaRaw: '163,68',
      }),
      ssCtx,
    );
    expect(p!.planPensiones).toBeDefined();
    expect(p!.planPensiones!.productoDestinoId).toBe('plan-uuid-123');
    expect(p!.planPensiones!.productoDestinoNombre).toBe('PPC DE OSP Y OSFI');
    expect(p!.planPensiones!.aportacionEmpleado).toEqual({ tipo: 'importe', valor: 122.76 });
    expect(p!.planPensiones!.aportacionEmpresa).toEqual({ tipo: 'importe', valor: 163.68 });
  });

  test('plan activo pero "__nuevo__" seleccionado · NO genera planPensiones', () => {
    const p = buildNominaPayload(
      baseState({
        planActivo: true,
        planVinculadoId: '__nuevo__',
      }),
      ssCtx,
    );
    expect(p!.planPensiones).toBeUndefined();
  });

  test('especie activa con conceptos · genera beneficiosSociales', () => {
    const p = buildNominaPayload(
      baseState({
        especieActivo: true,
        especies: [
          { id: 'e1', concepto: 'Seguro vida', importeRaw: '13,36', sumaIRPF: false, tipo: 'seguro-vida' },
          { id: 'e2', concepto: 'Vehículo', importeRaw: '60,00', sumaIRPF: true, tipo: 'vehiculo-empresa' },
        ],
      }),
      ssCtx,
    );
    expect(p!.beneficiosSociales).toHaveLength(2);
    expect(p!.beneficiosSociales[0]).toMatchObject({
      concepto: 'Seguro vida', importeMensual: 13.36, incrementaBaseIRPF: false,
    });
    expect(p!.beneficiosSociales[1]).toMatchObject({
      concepto: 'Vehículo', importeMensual: 60, incrementaBaseIRPF: true,
    });
  });

  test('especie inactiva ignora la lista de especies', () => {
    const p = buildNominaPayload(
      baseState({
        especieActivo: false,
        especies: [
          { id: 'e1', concepto: 'Seguro vida', importeRaw: '13', sumaIRPF: false },
        ],
      }),
      ssCtx,
    );
    expect(p!.beneficiosSociales).toEqual([]);
  });

  test('variables · porcentaje y importe se mapean con distribucionMeses', () => {
    const p = buildNominaPayload(
      baseState({
        variables: [
          { id: 'v1', nombre: 'Variable 60%', tipo: 'porcentaje', valorRaw: '14,28', mes: 3 },
          { id: 'v2', nombre: 'Bonus único',  tipo: 'importe',    valorRaw: '5000',  mes: 6 },
        ],
      }),
      ssCtx,
    );
    expect(p!.variables).toHaveLength(2);
    expect(p!.variables[0]).toEqual({
      id: 'v1', nombre: 'Variable 60%', tipo: 'porcentaje', valor: 14.28,
      distribucionMeses: [{ mes: 3, porcentaje: 100 }],
    });
    expect(p!.variables[1]).toEqual({
      id: 'v2', nombre: 'Bonus único', tipo: 'importe', valor: 5000,
      distribucionMeses: [{ mes: 6, porcentaje: 100 }],
    });
  });

  test('SS · mei se ajusta por el delta del % introducido', () => {
    // Por defecto suma 6.50; el usuario mete 7.00 → mei sube 0.50
    const p = buildNominaPayload(baseState({ ssRaw: '7,00' }), ssCtx);
    expect(p!.retencion.ss.contingenciasComunes).toBe(4.70);
    expect(p!.retencion.ss.desempleo).toBe(1.55);
    expect(p!.retencion.ss.formacionProfesional).toBe(0.10);
    expect(p!.retencion.ss.mei).toBeCloseTo(0.65, 2); // 0.15 + 0.50
  });

  test('SS · mei nunca negativo (clamp a 0)', () => {
    // Si el usuario mete 5.00 (menos que 6.50), el delta sería -1.50
    // y mei intentaría ser -1.35. Se clampa a 0.
    const p = buildNominaPayload(baseState({ ssRaw: '5,00' }), ssCtx);
    expect(p!.retencion.ss.mei).toBe(0);
  });

  test('cuota solidaridad anual se mensualiza /12', () => {
    const p = buildNominaPayload(baseState({ solidaridadRaw: '120' }), ssCtx);
    expect(p!.retencion.cuotaSolidaridadMensual).toBeCloseTo(10, 2);
    expect(p!.cuotaSolidaridadMensual).toBeCloseTo(10, 2);
  });

  test('vigenteDesde + diaCobro genera fechaAntiguedad bien formada', () => {
    const p = buildNominaPayload(
      baseState({ vigenteDesde: '2026-04', diaCobro: '15' }),
      ssCtx,
    );
    expect(p!.fechaAntiguedad).toBe('2026-04-15');
  });

  test('día > 28 se clampa a 28 en fechaAntiguedad para evitar fechas inválidas', () => {
    const p = buildNominaPayload(
      baseState({ vigenteDesde: '2026-02', diaCobro: '31' }),
      ssCtx,
    );
    expect(p!.fechaAntiguedad).toBe('2026-02-28');
    expect(p!.reglaCobroDia).toEqual({ tipo: 'ultimo-habil' });
  });
});

describe('validarFormNomina', () => {
  test('caso válido', () => {
    const v = validarFormNomina({
      empresa: 'Orange',
      cuentaId: 1,
      brutoRaw: '95000',
      diaCobro: '25',
      numeroPagas: 14,
      mesesExtra: [6, 12],
    });
    expect(v.ok).toBe(true);
    expect(v.errs).toEqual([]);
    expect(v.errFields.size).toBe(0);
  });

  test('campos vacíos · marca cada uno', () => {
    const v = validarFormNomina({
      empresa: '   ',
      cuentaId: null,
      brutoRaw: '0',
      diaCobro: '50',
      numeroPagas: 14,
      mesesExtra: [],
    });
    expect(v.ok).toBe(false);
    expect(v.errFields.has('empresa')).toBe(true);
    expect(v.errFields.has('cuenta')).toBe(true);
    expect(v.errFields.has('bruto')).toBe(true);
    expect(v.errFields.has('dia')).toBe(true);
    expect(v.errFields.has('mesesExtra')).toBe(true);
  });

  test('14 pagas requiere exactamente 2 meses extra', () => {
    const v1 = validarFormNomina({
      empresa: 'X', cuentaId: 1, brutoRaw: '1000', diaCobro: '1',
      numeroPagas: 14, mesesExtra: [6],
    });
    expect(v1.ok).toBe(false);
    expect(v1.errFields.has('mesesExtra')).toBe(true);

    const v2 = validarFormNomina({
      empresa: 'X', cuentaId: 1, brutoRaw: '1000', diaCobro: '1',
      numeroPagas: 14, mesesExtra: [6, 12],
    });
    expect(v2.ok).toBe(true);
  });

  test('16 pagas requiere 4 meses extra', () => {
    const v = validarFormNomina({
      empresa: 'X', cuentaId: 1, brutoRaw: '1000', diaCobro: '1',
      numeroPagas: 16, mesesExtra: [3, 6, 9, 12],
    });
    expect(v.ok).toBe(true);
  });

  test('12 pagas no debe tener meses extra', () => {
    const v = validarFormNomina({
      empresa: 'X', cuentaId: 1, brutoRaw: '1000', diaCobro: '1',
      numeroPagas: 12, mesesExtra: [6],
    });
    expect(v.ok).toBe(false);
    expect(v.errFields.has('mesesExtra')).toBe(true);
  });
});
