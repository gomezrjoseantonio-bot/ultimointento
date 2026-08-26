// La reducción del rendimiento del alquiler · art. 23.2 LIRPF, Ley 12/2023.
//
// Esto decide cuánto IRPF paga el arrendador por cada euro de renta: entre el
// 50 % y el 90 % del rendimiento no tributa según qué condiciones cumpla el
// contrato. Equivocarse aquí no da un número raro en pantalla, da una
// declaración mal presentada.
//
// Estos tests son LA RED mientras no haya XML de declaraciones reales cargados
// contra los que contrastar: cubren una rama por cada supuesto de la ley, la
// frontera exacta de la fecha en que cambia el régimen, y el impacto en euros.

import {
  proponerReduccion,
  rendimientoTrasReduccion,
  type CondicionesReduccion,
} from '../reduccionAlquiler';

/** Habitual firmado bajo la Ley de Vivienda, sin ninguna condición especial. */
const base = (extra?: Partial<CondicionesReduccion>): CondicionesReduccion => ({
  regimen: 'habitual',
  fechaFirma: '2026-08-15',
  ...extra,
});

describe('qué reducción propone ATLAS', () => {
  it('temporada · no hay reducción, no cubre una necesidad permanente de vivienda', () => {
    const r = proponerReduccion(base({ regimen: 'temporada' }));
    expect(r.porcentaje).toBe(0);
    expect(r.motivo).toBe('sin_reduccion');
  });

  it('turístico · tampoco', () => {
    expect(proponerReduccion(base({ regimen: 'turistico' })).porcentaje).toBe(0);
  });

  it('el régimen manda sobre cualquier condición marcada', () => {
    // Un turístico en zona tensionada con inquilino joven sigue sin reducción:
    // marcar condiciones no convierte en vivienda habitual lo que no lo es.
    const r = proponerReduccion(
      base({ regimen: 'turistico', zonaTensionada: true, primeraVez: true, joven18a35: true }),
    );
    expect(r.porcentaje).toBe(0);
  });

  it('firmado antes de la Ley de Vivienda · 60 % del régimen transitorio', () => {
    const r = proponerReduccion(base({ fechaFirma: '2022-03-01' }));
    expect(r.porcentaje).toBe(60);
    expect(r.motivo).toBe('transitorio_pre_2023');
  });

  it('zona tensionada · había contrato anterior · rebaja de más del 5 % → 90 %', () => {
    const r = proponerReduccion(
      base({ zonaTensionada: true, primeraVez: false, rebajaMas5: true }),
    );
    expect(r.porcentaje).toBe(90);
    expect(r.motivo).toBe('zona_tensionada_rebaja');
  });

  it('zona tensionada · primera vez · inquilino de 18 a 35 → 70 %', () => {
    const r = proponerReduccion(
      base({ zonaTensionada: true, primeraVez: true, joven18a35: true }),
    );
    expect(r.porcentaje).toBe(70);
    expect(r.motivo).toBe('zona_tensionada_joven');
  });

  it('rehabilitada en los 2 años previos → 60 %', () => {
    const r = proponerReduccion(base({ rehabilitada2a: true }));
    expect(r.porcentaje).toBe(60);
    expect(r.motivo).toBe('rehabilitacion');
  });

  it('habitual sin condiciones especiales → 50 % general', () => {
    const r = proponerReduccion(base());
    expect(r.porcentaje).toBe(50);
    expect(r.motivo).toBe('general_post_2023');
  });

  // ── Dónde una rama pisa a otra ───────────────────────────────────────────
  it('el 90 % exige que HUBIERA contrato anterior · con «primera vez» no aplica', () => {
    // Sin alquiler previo no hay renta que rebajar: la rebaja del 5 % se mide
    // contra el contrato anterior, y aquí no lo hay.
    const r = proponerReduccion(
      base({ zonaTensionada: true, primeraVez: true, rebajaMas5: true }),
    );
    expect(r.porcentaje).not.toBe(90);
    expect(r.porcentaje).toBe(50);
  });

  it('joven sin zona tensionada no llega al 70 %', () => {
    expect(proponerReduccion(base({ primeraVez: true, joven18a35: true })).porcentaje).toBe(50);
  });

  it('la fecha anterior a la ley manda sobre las condiciones nuevas', () => {
    // Un contrato de 2022 va por el transitorio aunque cumpla lo del 90 %.
    const r = proponerReduccion(
      base({ fechaFirma: '2022-01-01', zonaTensionada: true, rebajaMas5: true }),
    );
    expect(r.porcentaje).toBe(60);
  });

  it('el 90 % pasa por delante del 70 % cuando se cumplen los dos supuestos', () => {
    const r = proponerReduccion(
      base({ zonaTensionada: true, primeraVez: false, rebajaMas5: true, joven18a35: true }),
    );
    expect(r.porcentaje).toBe(90);
  });

  // ── La frontera exacta de la ley ─────────────────────────────────────────
  describe('26 de mayo de 2023 · el día en que cambia el régimen', () => {
    it('el 24 de mayo todavía es régimen anterior · 60 %', () => {
      expect(proponerReduccion(base({ fechaFirma: '2023-05-24' })).porcentaje).toBe(60);
    });

    it('el 25 de mayo, el último día del transitorio · 60 %', () => {
      expect(proponerReduccion(base({ fechaFirma: '2023-05-25' })).porcentaje).toBe(60);
    });

    it('el 26 de mayo YA rige la Ley de Vivienda · 50 %', () => {
      expect(proponerReduccion(base({ fechaFirma: '2023-05-26' })).porcentaje).toBe(50);
    });

    it('el 27 de mayo · 50 %', () => {
      expect(proponerReduccion(base({ fechaFirma: '2023-05-27' })).porcentaje).toBe(50);
    });

    it('una fecha con hora se lee igual · sin desfase de zona horaria', () => {
      expect(proponerReduccion(base({ fechaFirma: '2023-05-25T23:30:00Z' })).porcentaje).toBe(60);
    });
  });

  it('sin fecha de firma se aplica el régimen vigente, no se inventa una anterior', () => {
    const r = proponerReduccion({ regimen: 'habitual' });
    expect(r.porcentaje).toBe(50);
  });

  it('cada propuesta viene con su explicación y su base legal', () => {
    const r = proponerReduccion(base({ zonaTensionada: true, primeraVez: true, joven18a35: true }));
    expect(r.explicacion).toMatch(/primera vez/i);
    expect(r.baseLegal).toMatch(/23\.2/);
  });
});

describe('el impacto en euros', () => {
  it('6.000 € de rendimiento con el 70 % · se tributa por 1.800 €', () => {
    expect(rendimientoTrasReduccion(6000, 70)).toBe(1800);
  });

  it('con el 90 % · 600 €', () => {
    expect(rendimientoTrasReduccion(6000, 90)).toBe(600);
  });

  it('con el 50 % · 3.000 €', () => {
    expect(rendimientoTrasReduccion(6000, 50)).toBe(3000);
  });

  it('sin reducción se tributa por todo', () => {
    expect(rendimientoTrasReduccion(6000, 0)).toBe(6000);
  });

  it('un rendimiento negativo no se toca · la reducción solo se aplica a los positivos', () => {
    // Art. 23.2: la reducción opera sobre rendimiento neto POSITIVO. Reducir una
    // pérdida la haría más pequeña, que es lo contrario de lo que dice la ley.
    expect(rendimientoTrasReduccion(-1200, 70)).toBe(-1200);
  });
});
