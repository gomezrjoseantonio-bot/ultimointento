// ============================================================================
// El suelo de la reconstrucción · la tabla de verdad de C0
// ============================================================================
//
// Lo que manda es LA FRANJA del año en que cae hoy respecto a la campaña de
// IRPF del ejercicio anterior. El estado del ejercicio solo desempata dentro de
// la franja abierta, que es la única ventana de duda.
// ============================================================================

import {
  calcularSueloReconstruccion,
  franjaDeCampaña,
} from '../sueloReconstruccion';

describe('franjaDeCampaña · en qué momento del año estamos', () => {
  it('antes de que abra la campaña de N-1', () => {
    expect(franjaDeCampaña('2026-03-10').franja).toBe('antes');
  });

  it('con la campaña abierta', () => {
    expect(franjaDeCampaña('2026-04-17').franja).toBe('abierta');
  });

  it('con la campaña ya cerrada', () => {
    expect(franjaDeCampaña('2026-08-28').franja).toBe('cerrada');
  });

  it('el ejercicio en duda es siempre el anterior al de hoy', () => {
    expect(franjaDeCampaña('2026-08-28').ejercicioN1).toBe(2025);
    expect(franjaDeCampaña('2027-01-05').ejercicioN1).toBe(2026);
  });

  // Los bordes exactos salen de la tabla oficial AEAT: la campaña de 2025 va
  // del 1/4/2026 al 30/6/2026. Un día antes o un día después cambia la franja.
  it('los bordes de la ventana son inclusivos', () => {
    expect(franjaDeCampaña('2026-03-31').franja).toBe('antes');
    expect(franjaDeCampaña('2026-04-01').franja).toBe('abierta');
    expect(franjaDeCampaña('2026-06-30').franja).toBe('abierta');
    expect(franjaDeCampaña('2026-07-01').franja).toBe('cerrada');
  });
});

// ─── La tabla de verdad ─────────────────────────────────────────────────────

describe('calcularSueloReconstruccion · tabla de verdad', () => {
  it('1 · campaña no abierta · el estado da igual · baja a N-1', () => {
    expect(calcularSueloReconstruccion('2026-03-10')).toBe('2025-01-01');
    expect(calcularSueloReconstruccion('2026-03-10', 'declarado')).toBe('2025-01-01');
    expect(calcularSueloReconstruccion('2026-03-10', 'pendiente')).toBe('2025-01-01');
  });

  it('2 · campaña abierta · consta declarado · sube a N', () => {
    expect(calcularSueloReconstruccion('2026-04-17', 'declarado')).toBe('2026-01-01');
  });

  it('2 · campaña abierta · pendiente · baja a N-1', () => {
    expect(calcularSueloReconstruccion('2026-04-17', 'pendiente')).toBe('2025-01-01');
  });

  it('2 · campaña abierta · cerrado · baja a N-1 · un cierre ATLAS no es una declaración', () => {
    expect(calcularSueloReconstruccion('2026-04-17', 'cerrado')).toBe('2025-01-01');
  });

  it('2 · campaña abierta · no consta · ANTE LA DUDA baja a N-1', () => {
    expect(calcularSueloReconstruccion('2026-04-17')).toBe('2025-01-01');
    expect(calcularSueloReconstruccion('2026-04-17', undefined)).toBe('2025-01-01');
    expect(calcularSueloReconstruccion('2026-04-17', null)).toBe('2025-01-01');
  });

  it('3 · campaña cerrada · el estado da igual · sube a N', () => {
    expect(calcularSueloReconstruccion('2026-08-28')).toBe('2026-01-01');
    expect(calcularSueloReconstruccion('2026-08-28', 'pendiente')).toBe('2026-01-01');
    expect(calcularSueloReconstruccion('2026-08-28', 'declarado')).toBe('2026-01-01');
  });
});

// ─── Los bordes de la prudencia ─────────────────────────────────────────────

describe('ante la duda, el suelo baja', () => {
  // El store no valida lo que se escribe: hay código que guarda estados fuera
  // del enum (`db/__tests__/backup.test.ts:83` escribe 'abierto'). Cualquier
  // cosa que no sea exactamente 'declarado' es duda.
  it('un estado desconocido cuenta como no declarado', () => {
    expect(calcularSueloReconstruccion('2026-04-17', 'abierto')).toBe('2025-01-01');
    expect(calcularSueloReconstruccion('2026-04-17', 'en_curso')).toBe('2025-01-01');
    expect(calcularSueloReconstruccion('2026-04-17', 'prescrito')).toBe('2025-01-01');
    expect(calcularSueloReconstruccion('2026-04-17', '')).toBe('2025-01-01');
  });

  // Solo el valor exacto sube el suelo · sin trucos de mayúsculas ni espacios.
  it('«declarado» tiene que venir tal cual para subir el suelo', () => {
    expect(calcularSueloReconstruccion('2026-04-17', 'Declarado')).toBe('2025-01-01');
    expect(calcularSueloReconstruccion('2026-04-17', ' declarado')).toBe('2025-01-01');
  });
});

// ─── Años sin tabla oficial ─────────────────────────────────────────────────

describe('un año fuera de la tabla AEAT cae al respaldo', () => {
  // `VENTANAS_IRPF` llega hasta el ejercicio 2026. Para 2027 en adelante no hay
  // fecha publicada, y el respaldo (1 abril → 30 junio) mantiene las tres
  // franjas en su sitio en vez de dejar la función sin criterio.
  it('respaldo 1/4 → 30/6 para ejercicios no tabulados', () => {
    expect(calcularSueloReconstruccion('2028-02-10')).toBe('2027-01-01');
    expect(calcularSueloReconstruccion('2028-05-10', 'declarado')).toBe('2028-01-01');
    expect(calcularSueloReconstruccion('2028-05-10', 'pendiente')).toBe('2027-01-01');
    expect(calcularSueloReconstruccion('2028-09-10')).toBe('2028-01-01');
  });
});

// ─── El techo NO es cosa de esta función ────────────────────────────────────

describe('el suelo es siempre el 1 de enero de su año', () => {
  it('nunca devuelve otra cosa que un 1 de enero', () => {
    for (const hoy of ['2026-01-02', '2026-04-17', '2026-08-28', '2026-12-31']) {
      expect(calcularSueloReconstruccion(hoy)).toMatch(/^\d{4}-01-01$/);
    }
  });

  it('el suelo nunca baja más allá de N-1', () => {
    // Aunque el ATLAS tenga ejercicios antiguos sin declarar, esta fase no
    // reconstruye más atrás: su campaña cerró y ya no se toca.
    expect(calcularSueloReconstruccion('2026-08-28')).toBe('2026-01-01');
    expect(calcularSueloReconstruccion('2026-03-10')).toBe('2025-01-01');
  });
});
