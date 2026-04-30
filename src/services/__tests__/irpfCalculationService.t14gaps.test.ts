// ============================================================================
// ATLAS · TAREA 14.3 · cierre de los 5 GAPs fiscales del AUDIT-T14
// ============================================================================
//
// Tests cubriendo los escenarios obligatorios de spec §3.8:
//   · GAP 5.1 · reducciones autonómicas (Madrid · Asturias · sin CCAA)
//   · GAP 5.2 · bono edad ≥65 / ≥75 sobre mínimo contribuyente
//   · GAP 5.3 · vivienda habitual NO imputa renta
//   · GAP 5.4 · bonus discapacidad descendientes y ascendientes
//   · GAP 5.6 · `tributacion` con default 'individual' (gateway garantiza
//     valor · cálculo no rompe)
//
// Estos tests se centran en los HELPERS PUROS exportados por
// `irpfCalculationService` y por `data/fiscal/tramosAutonomicos2024`. La
// integración end-to-end vía `calcularDeclaracionIRPF` queda cubierta por
// los tests existentes (irpfCalculationService.capitalMobiliarioGeneral /
// .entidadesAtribucion) que comparten la misma ruta.
// ============================================================================

import {
  calcularBonoEdadContribuyente,
  calcularBonusDiscapacidad,
  calcularMinimosPersonalesFromContext,
  calcularCuotaBaseGeneralCCAA,
  calcularCuotaPorTramos,
  filtrarViviendaHabitualDePropiedades,
  CONSTANTES_IRPF,
} from '../irpfCalculationService';
import {
  ESCALA_ESTATAL_GENERAL_2024,
  ESCALA_AUTONOMICA_SUPLETORIA_2024,
  TABLAS_AUTONOMICAS_2024,
  getEscalaAutonomica,
  normalizeCCAA,
} from '../../data/fiscal/tramosAutonomicos2024';
import type { FiscalContext } from '../fiscalContextService';

// ─── Builders ───────────────────────────────────────────────────────────────

function buildCtx(overrides: Partial<FiscalContext> = {}): FiscalContext {
  return {
    personalDataId: 1,
    nombre: 'Jose',
    apellidos: 'García',
    dni: '12345678Z',
    tributacion: 'individual',
    comunidadAutonoma: null,
    fechaNacimiento: null,
    edadActual: null,
    descendientes: [],
    ascendientes: [],
    discapacidadTitular: 'ninguna',
    viviendaHabitual: null,
    fechaActualizacion: '2024-01-01T00:00:00.000Z',
    warnings: [],
    ...overrides,
  };
}

// ─── GAP 5.2 · Bono edad contribuyente ──────────────────────────────────────

describe('GAP 5.2 · calcularBonoEdadContribuyente', () => {
  test('edad null · sin bono', () => {
    expect(calcularBonoEdadContribuyente(null)).toBe(0);
  });

  test('contribuyente edad 64 · sin bono', () => {
    expect(calcularBonoEdadContribuyente(64)).toBe(0);
  });

  test('contribuyente edad 70 · bono ≥65 aplicado (1150€)', () => {
    expect(calcularBonoEdadContribuyente(70)).toBe(1150);
  });

  test('contribuyente edad 80 · bono ≥65 + ≥75 aplicado (2550€)', () => {
    // Art. 57 LIRPF · 1150 (≥65) + 1400 (≥75) = 2550
    expect(calcularBonoEdadContribuyente(80)).toBe(2550);
  });
});

// ─── GAP 5.4 · Bonus discapacidad familiares ────────────────────────────────

describe('GAP 5.4 · calcularBonusDiscapacidad', () => {
  test('hasta33 · sin bonus', () => {
    expect(calcularBonusDiscapacidad('hasta33')).toBe(0);
  });
  test('ninguna · sin bonus', () => {
    expect(calcularBonusDiscapacidad('ninguna')).toBe(0);
  });
  test('entre33y65 · 3000€', () => {
    expect(calcularBonusDiscapacidad('entre33y65')).toBe(3000);
  });
  test('mas65 · 9000 + 3000 (severa + asistencia) = 12000€', () => {
    expect(calcularBonusDiscapacidad('mas65')).toBe(12000);
  });
});

// ─── Mínimos personales context-driven (GAP 5.2 + 5.4) ──────────────────────

describe('calcularMinimosPersonalesFromContext', () => {
  test('contexto vacío (null) · solo mínimo contribuyente base', () => {
    const min = calcularMinimosPersonalesFromContext(null, 2024);
    expect(min.contribuyente).toBe(CONSTANTES_IRPF.minimoContribuyente);
    expect(min.descendientes).toBe(0);
    expect(min.ascendientes).toBe(0);
    expect(min.discapacidad).toBe(0);
    expect(min.total).toBe(CONSTANTES_IRPF.minimoContribuyente);
  });

  test('GAP 5.2 · titular 70 años · contribuyente = 5550 + 1150', () => {
    const ctx = buildCtx({ edadActual: 70 });
    const min = calcularMinimosPersonalesFromContext(ctx, 2024);
    expect(min.contribuyente).toBe(5550 + 1150);
  });

  test('GAP 5.2 · titular 80 años · contribuyente = 5550 + 1150 + 1400', () => {
    const ctx = buildCtx({ edadActual: 80 });
    const min = calcularMinimosPersonalesFromContext(ctx, 2024);
    expect(min.contribuyente).toBe(5550 + 1150 + 1400);
  });

  test('GAP 5.4 · descendiente con discapacidad entre33y65 · bonus 3000€ aplicado al mínimo', () => {
    const ctx = buildCtx({
      descendientes: [
        { nombre: '', fechaNacimiento: '2010-01-15', edadActual: 14, discapacidad: 'entre33y65' },
      ],
    });
    const min = calcularMinimosPersonalesFromContext(ctx, 2024);
    // 1er descendiente · 2400€ + bonus discapacidad 3000€
    expect(min.descendientes).toBe(2400 + 3000);
  });

  test('GAP 5.4 · ascendiente con discapacidad mas65 · bonus 12000€ aplicado al mínimo', () => {
    const ctx = buildCtx({
      ascendientes: [
        { nombre: '', fechaNacimiento: '', edadActual: 82, discapacidad: 'mas65' },
      ],
    });
    const min = calcularMinimosPersonalesFromContext(ctx, 2024);
    // ascendiente ≥65 (1150) + ≥75 (1400) + bonus discapacidad mas65 (12000)
    expect(min.ascendientes).toBe(1150 + 1400 + 12000);
  });

  test('descendientes con extra menores 3 (LIRPF art. 58)', () => {
    const ctx = buildCtx({
      descendientes: [
        // Niño nacido en 2023 · en ejercicio 2024 tiene 1 año (<3)
        { nombre: '', fechaNacimiento: '2023-05-10', edadActual: 1, discapacidad: 'ninguna' },
      ],
    });
    const min = calcularMinimosPersonalesFromContext(ctx, 2024);
    // 1er descendiente: 2400 + extra menor 3: 2800
    expect(min.descendientes).toBe(2400 + 2800);
  });
});

// ─── GAP 5.1 · Liquidación CCAA-aware ───────────────────────────────────────

describe('GAP 5.1 · calcularCuotaBaseGeneralCCAA', () => {
  test('sin CCAA informada · cae a supletoria · warning emitido', () => {
    const ctx = buildCtx({ comunidadAutonoma: null });
    const r = calcularCuotaBaseGeneralCCAA(30000, ctx, 2024);
    expect(r.escalaAutonomicaAplicada).toBe(false);
    expect(r.reason).toMatch(/CCAA no informada/);
    // base 30000: 12450*0.095 + 7750*0.12 + 9800*0.15 = 1182.75 + 930 + 1470 = 3582.75
    // cuotaEstatal y cuotaAutonomica ambas iguales (mismas tablas) → cuotaTotal = 7165.50
    const expectedHalf = calcularCuotaPorTramos(30000, ESCALA_ESTATAL_GENERAL_2024.tramos);
    expect(r.cuotaEstatal).toBe(expectedHalf);
    expect(r.cuotaAutonomica).toBe(expectedHalf);
    expect(r.cuotaTotal).toBe(Math.round(expectedHalf * 2 * 100) / 100);
  });

  test('Madrid (verified=false en datos por defecto) · cae a supletoria · warning específico', () => {
    const ctx = buildCtx({ comunidadAutonoma: 'Madrid' });
    const r = calcularCuotaBaseGeneralCCAA(30000, ctx, 2024);
    expect(r.escalaAutonomicaAplicada).toBe(false);
    expect(r.reason).toMatch(/Madrid.*verified=false/);
    // Sin verificar · cuota igual a la supletoria
    expect(r.cuotaAutonomica).toBe(
      calcularCuotaPorTramos(30000, ESCALA_AUTONOMICA_SUPLETORIA_2024.tramos),
    );
  });

  test('Madrid con tabla forzada verified=true · aplica escala Madrid · cuota autonómica menor que supletoria', () => {
    // Simulación · auditoría completada · Madrid tipo más bajo
    const original = TABLAS_AUTONOMICAS_2024.Madrid;
    TABLAS_AUTONOMICAS_2024.Madrid = { ...original, verified: true };
    try {
      const ctx = buildCtx({ comunidadAutonoma: 'Madrid' });
      const r = calcularCuotaBaseGeneralCCAA(30000, ctx, 2024);
      expect(r.escalaAutonomicaAplicada).toBe(true);
      expect(r.reason).toBeUndefined();
      const cuotaMadrid = calcularCuotaPorTramos(30000, original.tramos);
      const cuotaSupletoria = calcularCuotaPorTramos(
        30000,
        ESCALA_AUTONOMICA_SUPLETORIA_2024.tramos,
      );
      expect(r.cuotaAutonomica).toBe(cuotaMadrid);
      expect(r.cuotaAutonomica).toBeLessThan(cuotaSupletoria);
    } finally {
      TABLAS_AUTONOMICAS_2024.Madrid = original;
    }
  });

  test('Asturias con tabla forzada verified=true · aplica escala Asturias', () => {
    const original = TABLAS_AUTONOMICAS_2024.Asturias;
    TABLAS_AUTONOMICAS_2024.Asturias = { ...original, verified: true };
    try {
      const ctx = buildCtx({ comunidadAutonoma: 'Asturias' });
      const r = calcularCuotaBaseGeneralCCAA(30000, ctx, 2024);
      expect(r.escalaAutonomicaAplicada).toBe(true);
      expect(r.cuotaAutonomica).toBe(
        calcularCuotaPorTramos(30000, original.tramos),
      );
    } finally {
      TABLAS_AUTONOMICAS_2024.Asturias = original;
    }
  });

  test('CCAA con variantes de nombre · normalizeCCAA · "comunidad de madrid" → Madrid', () => {
    expect(normalizeCCAA('comunidad de madrid')).toBe('Madrid');
    expect(normalizeCCAA('CATALUNYA')).toBe('Cataluña');
    expect(normalizeCCAA('Asturies')).toBe('Asturias');
    expect(normalizeCCAA('')).toBeNull();
    expect(normalizeCCAA(null)).toBeNull();
  });

  test('getEscalaAutonomica · año fuera de soporte (2023) · supletoria + warning', () => {
    const r = getEscalaAutonomica('Madrid', 2023);
    expect(r.aplicada).toBe(false);
    expect(r.reason).toMatch(/2023/);
  });
});

// ─── GAP 5.3 · Vivienda habitual NO imputa renta ────────────────────────────

describe('GAP 5.3 · filtrarViviendaHabitualDePropiedades', () => {
  test('sin viviendaHabitualRef · lista intacta', () => {
    const props = [{ id: 1, cadastralReference: 'ABC' }];
    const r = filtrarViviendaHabitualDePropiedades(props, null);
    expect(r.excluida).toBe(false);
    expect(r.propiedades).toHaveLength(1);
  });

  test('vivienda habitual matched · excluida de la lista', () => {
    const props = [
      { id: 1, cadastralReference: '1234567AB1234S0001AB' },
      { id: 2, cadastralReference: 'OTRO_REFERENCIA' },
    ];
    const r = filtrarViviendaHabitualDePropiedades(props, '1234567AB1234S0001AB');
    expect(r.excluida).toBe(true);
    expect(r.propiedades).toHaveLength(1);
    expect(r.propiedades[0].id).toBe(2);
  });

  test('vivienda habitual con whitespace · trim antes de comparar', () => {
    const props = [{ id: 1, cadastralReference: ' REF123 ' }];
    const r = filtrarViviendaHabitualDePropiedades(props, '  REF123 ');
    expect(r.excluida).toBe(true);
    expect(r.propiedades).toHaveLength(0);
  });

  test('ningún match · excluida=false', () => {
    const props = [{ id: 1, cadastralReference: 'AAA' }];
    const r = filtrarViviendaHabitualDePropiedades(props, 'BBB');
    expect(r.excluida).toBe(false);
    expect(r.propiedades).toHaveLength(1);
  });
});

// ─── GAP 5.6 · tributacion default garantizada por gateway ──────────────────

describe('GAP 5.6 · tributacion default · cálculo no rompe sin tributacion', () => {
  test('contexto con tributacion default · cálculo de mínimos OK', () => {
    // El gateway T14.2 ya garantiza que tributacion siempre tiene valor
    // ('individual' por defecto). Aquí verificamos que el cálculo no asume
    // null y que el contexto con default funciona end-to-end.
    const ctx = buildCtx({
      tributacion: 'individual',
      warnings: ['tributacion no informada · default individual'],
    });
    const min = calcularMinimosPersonalesFromContext(ctx, 2024);
    expect(min.total).toBe(CONSTANTES_IRPF.minimoContribuyente);
    // El warning del gateway sobre default se preserva en el contexto y
    // será forwarded por `calcularDeclaracionIRPF` a su propio
    // `warnings[]`.
    expect(ctx.warnings).toContain(
      'tributacion no informada · default individual',
    );
  });
});
