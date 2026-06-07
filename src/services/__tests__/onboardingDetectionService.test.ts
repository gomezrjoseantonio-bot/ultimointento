/**
 * Onboarding día 0 · C5 · motor de detección (préstamo · nómina · decisiones).
 *
 * Cubre (§5 · C5):
 *   · detector préstamo · cuota idéntica mensual → propuesta con pre-relleno
 *   · detector nómina · abono periódico → propuesta con pre-relleno
 *   · abono que cuadra con la renta de un contrato → NO se propone
 *   · confirmar recurrente → crea entidad (servicio canónico) + learning rule + no reaparece
 *   · descartar → persiste y no reaparece
 *
 * El detector de recurrentes se ORQUESTA desde `compromisoDetectionService`
 * (mockeado aquí · su algoritmo se prueba en su propia suite).
 */
import type { Movement } from '../db';

const mockKeyval = new Map<string, unknown>();
const mockMovements = new Map<number, Movement>();
let mockContracts: Array<{ rentaMensual?: number }> = [];
let mockReportCandidatos: unknown[] = [];
const mockCreateFromCandidatos = jest.fn(async () => ({ creados: [{ id: 1 }], duplicadosOmitidos: [], erroresValidacion: [] }));
const mockCreateRule = jest.fn(async () => ({}));

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    get: async (store: string, key: unknown) =>
      store === 'keyval' ? mockKeyval.get(key as string) : store === 'movements' ? mockMovements.get(key as number) : undefined,
    put: async (store: string, value: unknown, key: string) => {
      if (store === 'keyval') mockKeyval.set(key, value);
    },
    getAll: async (store: string) =>
      store === 'movements' ? [...mockMovements.values()] : store === 'contracts' ? mockContracts : [],
  }),
}));

jest.mock('../compromisoDetectionService', () => ({
  __esModule: true,
  detectCompromisos: async () => ({ candidatos: mockReportCandidatos, estadisticas: {}, warnings: [] }),
}));
jest.mock('../compromisoCreationService', () => ({
  __esModule: true,
  createCompromisosFromCandidatos: (...args: unknown[]) => mockCreateFromCandidatos(...args),
}));
jest.mock('../movementLearningService', () => ({
  __esModule: true,
  createOrUpdateRule: (...args: unknown[]) => mockCreateRule(...args),
  buildLearnKey: () => 'learnkey',
}));

import {
  detectarPrestamosDesdeMovimientos,
  detectarNominasDesdeMovimientos,
  detectarSugerencias,
  confirmarSugerencia,
  descartarSugerencia,
  type Sugerencia,
} from '../onboardingDetectionService';

const mov = (id: number, date: string, amount: number, description: string, counterparty: string, accountId = 4127): Movement =>
  ({ id, accountId, date, amount, description, counterparty } as unknown as Movement);

/** N cargos/abonos mensuales día 1, ene→…, mismo concepto. */
function mensuales(amount: number, desc: string, cp: string, n: number, accountId = 4127): Movement[] {
  return Array.from({ length: n }, (_, i) =>
    mov(100 + i, `2024-${String(i + 1).padStart(2, '0')}-01`, amount, desc, cp, accountId),
  );
}

beforeEach(() => {
  mockKeyval.clear();
  mockMovements.clear();
  mockContracts = [];
  mockReportCandidatos = [];
  mockCreateFromCandidatos.mockClear();
  mockCreateRule.mockClear();
});

describe('detector de préstamos', () => {
  it('6 cuotas idénticas mensuales con concepto hipoteca → 1 propuesta con pre-relleno', () => {
    const movs = mensuales(-486.2, 'PRESTAMO HIPOTECARIO', 'BANCO X', 6);
    const sugs = detectarPrestamosDesdeMovimientos(movs);
    expect(sugs).toHaveLength(1);
    expect(sugs[0].tipo).toBe('prestamo');
    expect(sugs[0].importe).toBe(486.2);
    expect(sugs[0].needs).toMatch(/TIN/);
    expect(sugs[0].prefill).toMatchObject({ cuota: 486.2, dia: 1, cuentaId: 4127 });
  });

  it('cuotas NO idénticas → no se propone como préstamo', () => {
    const movs = [
      ...mensuales(-486.2, 'PRESTAMO HIPOTECARIO', 'BANCO X', 3),
      mov(200, '2024-04-01', -500.0, 'PRESTAMO HIPOTECARIO', 'BANCO X'),
      mov(201, '2024-05-01', -510.0, 'PRESTAMO HIPOTECARIO', 'BANCO X'),
      mov(202, '2024-06-01', -520.0, 'PRESTAMO HIPOTECARIO', 'BANCO X'),
    ];
    expect(detectarPrestamosDesdeMovimientos(movs)).toHaveLength(0);
  });
});

describe('detector de nómina', () => {
  it('abono periódico grande del mismo pagador → 1 propuesta con pre-relleno', () => {
    const movs = mensuales(2340, 'NOMINA', 'EMPRESA SL', 6, 8830);
    const sugs = detectarNominasDesdeMovimientos(movs);
    expect(sugs).toHaveLength(1);
    expect(sugs[0].tipo).toBe('nomina');
    expect(sugs[0].prefill).toMatchObject({ neto: 2340, cuentaId: 8830 });
  });

  it('abono que cuadra con la renta de un contrato → NO se propone', () => {
    const movs = mensuales(950, 'TRANSFERENCIA INQUILINO', 'JUAN PEREZ', 6);
    expect(detectarNominasDesdeMovimientos(movs, [950])).toHaveLength(0);
  });
});

describe('decisiones · confirmar / descartar', () => {
  const recurrente: Sugerencia = {
    tipo: 'recurrente',
    clave: 'recurrente:abc',
    nombre: 'Comunidad',
    meta: '',
    contraparte: 'comunidad',
    accountId: 4127,
    importe: 68,
    cadencia: 'mensual',
    candidato: {
      id: 'abc',
      conceptoNormalizado: 'comunidad',
      cuentaCargo: 4127,
      ocurrencias: [{ movementId: 100, fecha: '2024-01-05', importe: -68, descripcionRaw: 'COMUNIDAD' }],
      propuesta: { ambito: 'personal', categoria: 'vivienda.comunidad', alias: 'Comunidad' },
    } as unknown as Sugerencia['candidato'],
  };

  it('confirmar recurrente crea entidad + learning rule + no reaparece', async () => {
    await confirmarSugerencia(recurrente);
    expect(mockCreateFromCandidatos).toHaveBeenCalledTimes(1);
    expect(mockCreateRule).toHaveBeenCalledTimes(1);

    // No reaparece: el motor canónico propone el mismo, pero queda filtrado.
    mockReportCandidatos = [recurrente.candidato];
    const sugs = await detectarSugerencias();
    expect(sugs.find((s) => s.clave === 'recurrente:abc')).toBeUndefined();
  });

  it('descartar persiste y no reaparece', async () => {
    const prestamo: Sugerencia = { ...recurrente, tipo: 'prestamo', clave: 'prestamo:x', candidato: undefined };
    await descartarSugerencia(prestamo);
    mockMovements.clear();
    // Aunque el detector lo volviera a encontrar, queda filtrado por el descarte.
    mensuales(-486.2, 'PRESTAMO HIPOTECARIO', 'BANCO X', 6).forEach((m) => mockMovements.set(m.id as number, m));
    const sugs = await detectarSugerencias();
    expect(sugs.some((s) => s.clave === 'prestamo:x')).toBe(false);
  });
});
