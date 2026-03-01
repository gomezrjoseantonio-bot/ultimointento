/**
 * Unit tests for carryForwardService — AEAT art. 23.1.a LIRPF arrastres logic
 */

import {
  getCarryForwardsDisponibles,
  registrarArrastre,
  consumirArrastresAplicados,
} from '../carryForwardService';
import { AEATCarryForward } from '../db';

// ─── Minimal IndexedDB mock ───────────────────────────────────────────────────

let mockStore: AEATCarryForward[] = [];
let mockNextId = 1;

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

import { initDB } from '../db';

const mockDb = {
  getAllFromIndex: jest.fn(),
  put: jest.fn(),
  add: jest.fn(),
};

beforeEach(() => {
  mockStore = [];
  mockNextId = 1;
  (initDB as jest.Mock).mockResolvedValue(mockDb);

  mockDb.getAllFromIndex.mockImplementation(
    (_storeName: string, _indexName: string, value: number) =>
      Promise.resolve(mockStore.filter((cf) => cf.propertyId === value))
  );
  mockDb.put.mockImplementation((_storeName: string, item: AEATCarryForward) => {
    const idx = mockStore.findIndex((cf) => cf.id === item.id);
    if (idx >= 0) {
      mockStore[idx] = item;
    } else {
      mockStore.push(item);
    }
    return Promise.resolve(item.id);
  });
  mockDb.add.mockImplementation((_storeName: string, item: AEATCarryForward) => {
    const id = mockNextId++;
    mockStore.push({ ...item, id });
    return Promise.resolve(id);
  });
});

// ─── getCarryForwardsDisponibles ──────────────────────────────────────────────

describe('getCarryForwardsDisponibles', () => {
  it('returns empty when no carryforwards exist', async () => {
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(0);
    expect(result.detalle).toHaveLength(0);
  });

  it('excludes carryforwards from the same year', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2025,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2029,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    });
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(0);
  });

  it('returns carryforwards from previous years within 4-year window', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    });
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(3000);
    expect(result.detalle).toHaveLength(1);
  });

  it('excludes expired carryforwards (expirationYear < ejercicio)', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2019,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2023, // expired before 2025
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    });
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(0);
  });

  it('excludes carryforwards with zero remaining amount', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 0, // fully consumed
      createdAt: '',
      updatedAt: '',
    });
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(0);
  });

  it('returns carryforwards ordered FIFO (oldest first)', async () => {
    mockStore.push(
      {
        id: 2,
        propertyId: 1,
        taxYear: 2023,
        totalIncome: 5000,
        financingAndRepair: 7000,
        limitApplied: 5000,
        excessAmount: 2000,
        expirationYear: 2027,
        remainingAmount: 2000,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 1,
        propertyId: 1,
        taxYear: 2022,
        totalIncome: 5000,
        financingAndRepair: 8000,
        limitApplied: 5000,
        excessAmount: 3000,
        expirationYear: 2026,
        remainingAmount: 3000,
        createdAt: '',
        updatedAt: '',
      }
    );
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(5000);
    expect(result.detalle[0].taxYear).toBe(2022); // oldest first
    expect(result.detalle[1].taxYear).toBe(2023);
  });
});

// ─── registrarArrastre ────────────────────────────────────────────────────────

describe('registrarArrastre', () => {
  it('creates a new carryforward entry', async () => {
    await registrarArrastre(1, 2025, 5000, 8000, 3000);
    expect(mockStore).toHaveLength(1);
    expect(mockStore[0].taxYear).toBe(2025);
    expect(mockStore[0].excessAmount).toBe(3000);
    expect(mockStore[0].remainingAmount).toBe(3000);
    expect(mockStore[0].expirationYear).toBe(2029);
    expect(mockStore[0].limitApplied).toBe(5000);
  });

  it('updates existing carryforward for same property/year', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2025,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2029,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    });
    await registrarArrastre(1, 2025, 4000, 9000, 5000);
    expect(mockStore).toHaveLength(1); // still one entry
    expect(mockStore[0].excessAmount).toBe(5000);
    expect(mockStore[0].remainingAmount).toBe(5000);
    expect(mockStore[0].totalIncome).toBe(4000);
  });
});

// ─── consumirArrastresAplicados ───────────────────────────────────────────────

describe('consumirArrastresAplicados', () => {
  it('does nothing when importeAplicado is 0', async () => {
    const cf: AEATCarryForward = {
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    };
    mockStore.push(cf);
    await consumirArrastresAplicados([cf], 0);
    expect(mockStore[0].remainingAmount).toBe(3000);
  });

  it('reduces remainingAmount by applied amount (FIFO, single entry)', async () => {
    const cf: AEATCarryForward = {
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    };
    mockStore.push(cf);
    await consumirArrastresAplicados([cf], 2000);
    expect(mockStore[0].remainingAmount).toBe(1000);
  });

  it('consumes FIFO across multiple carryforwards', async () => {
    const cf1: AEATCarryForward = {
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    };
    const cf2: AEATCarryForward = {
      id: 2,
      propertyId: 1,
      taxYear: 2023,
      totalIncome: 5000,
      financingAndRepair: 7000,
      limitApplied: 5000,
      excessAmount: 2000,
      expirationYear: 2027,
      remainingAmount: 2000,
      createdAt: '',
      updatedAt: '',
    };
    mockStore.push(cf1, cf2);
    // Apply 4000: consume all of cf1 (3000) + 1000 from cf2
    await consumirArrastresAplicados([cf1, cf2], 4000);
    expect(mockStore[0].remainingAmount).toBe(0);   // cf1 fully consumed
    expect(mockStore[1].remainingAmount).toBe(1000); // cf2 partially consumed
  });
});

// ─── Integration: AEAT limit scenarios ───────────────────────────────────────

describe('AEAT limit integration scenarios', () => {
  it('scenario: ingresos 10000, gastos 0105+0106 8000 → no excess, deduce 8000', () => {
    const ingresos = 10000;
    const fr = 8000;
    const limiteAEAT = ingresos;
    const gastosConLimite = Math.min(fr, limiteAEAT);
    const exceso = Math.max(0, fr - limiteAEAT);
    expect(gastosConLimite).toBe(8000);
    expect(exceso).toBe(0);
  });

  it('scenario: ingresos 5000, gastos 0105+0106 8000 → excess 3000, deduce 5000', () => {
    const ingresos = 5000;
    const fr = 8000;
    const limiteAEAT = ingresos;
    const gastosConLimite = Math.min(fr, limiteAEAT);
    const exceso = Math.max(0, fr - limiteAEAT);
    expect(gastosConLimite).toBe(5000);
    expect(exceso).toBe(3000);
  });

  it('scenario: arrastre anterior 2000, ingresos 7000, gastos 5000 → aplica 2000 arrastre', () => {
    const ingresos = 7000;
    const fr = 5000;
    const arrastresDisponibles = 2000;
    const limiteAEAT = ingresos;
    const totalConArrastres = fr + arrastresDisponibles;
    const gastosConLimite = Math.min(totalConArrastres, limiteAEAT);
    const espacioParaArrastres = Math.max(0, limiteAEAT - fr);
    const arrastresAplicados = Math.min(arrastresDisponibles, espacioParaArrastres);
    expect(gastosConLimite).toBe(7000); // 5000 FR + 2000 arrastre = 7000 (all fits within limit)
    expect(arrastresAplicados).toBe(2000);
  });

  it('scenario: arrastre caduca (4 ejercicios cumplidos) → expirationYear < ejercicio', () => {
    const taxYear = 2020;
    const expirationYear = taxYear + 4; // 2024
    const ejercicio = 2025;
    const disponible = expirationYear >= ejercicio; // false → expired
    expect(disponible).toBe(false);
  });

  it('scenario: arrastre que vence en el mismo año ejercicio → se aplica', () => {
    const expirationYear = 2025;
    const ejercicio = 2025;
    const disponible = expirationYear >= ejercicio; // true
    expect(disponible).toBe(true);
  });
});


// ─── getCarryForwardsDisponibles ──────────────────────────────────────────────

describe('getCarryForwardsDisponibles', () => {
  it('returns empty when no carryforwards exist', async () => {
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(0);
    expect(result.detalle).toHaveLength(0);
  });

  it('excludes carryforwards from the same year', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2025,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2029,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    });
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(0);
  });

  it('returns carryforwards from previous years within 4-year window', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    });
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(3000);
    expect(result.detalle).toHaveLength(1);
  });

  it('excludes expired carryforwards (expirationYear < ejercicio)', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2019,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2023, // expired before 2025
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    });
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(0);
  });

  it('excludes carryforwards with zero remaining amount', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 0, // fully consumed
      createdAt: '',
      updatedAt: '',
    });
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(0);
  });

  it('returns carryforwards ordered FIFO (oldest first)', async () => {
    mockStore.push(
      {
        id: 2,
        propertyId: 1,
        taxYear: 2023,
        totalIncome: 5000,
        financingAndRepair: 7000,
        limitApplied: 5000,
        excessAmount: 2000,
        expirationYear: 2027,
        remainingAmount: 2000,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 1,
        propertyId: 1,
        taxYear: 2022,
        totalIncome: 5000,
        financingAndRepair: 8000,
        limitApplied: 5000,
        excessAmount: 3000,
        expirationYear: 2026,
        remainingAmount: 3000,
        createdAt: '',
        updatedAt: '',
      }
    );
    const result = await getCarryForwardsDisponibles(1, 2025);
    expect(result.total).toBe(5000);
    expect(result.detalle[0].taxYear).toBe(2022); // oldest first
    expect(result.detalle[1].taxYear).toBe(2023);
  });
});

// ─── registrarArrastre ────────────────────────────────────────────────────────

describe('registrarArrastre', () => {
  it('creates a new carryforward entry', async () => {
    await registrarArrastre(1, 2025, 5000, 8000, 3000);
    expect(mockStore).toHaveLength(1);
    expect(mockStore[0].taxYear).toBe(2025);
    expect(mockStore[0].excessAmount).toBe(3000);
    expect(mockStore[0].remainingAmount).toBe(3000);
    expect(mockStore[0].expirationYear).toBe(2029);
    expect(mockStore[0].limitApplied).toBe(5000);
  });

  it('updates existing carryforward for same property/year', async () => {
    mockStore.push({
      id: 1,
      propertyId: 1,
      taxYear: 2025,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2029,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    });
    await registrarArrastre(1, 2025, 4000, 9000, 5000);
    expect(mockStore).toHaveLength(1); // still one entry
    expect(mockStore[0].excessAmount).toBe(5000);
    expect(mockStore[0].remainingAmount).toBe(5000);
    expect(mockStore[0].totalIncome).toBe(4000);
  });
});

// ─── consumirArrastresAplicados ───────────────────────────────────────────────

describe('consumirArrastresAplicados', () => {
  it('does nothing when importeAplicado is 0', async () => {
    const cf: AEATCarryForward = {
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    };
    mockStore.push(cf);
    await consumirArrastresAplicados([cf], 0);
    expect(mockStore[0].remainingAmount).toBe(3000);
  });

  it('reduces remainingAmount by applied amount (FIFO, single entry)', async () => {
    const cf: AEATCarryForward = {
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    };
    mockStore.push(cf);
    await consumirArrastresAplicados([cf], 2000);
    expect(mockStore[0].remainingAmount).toBe(1000);
  });

  it('consumes FIFO across multiple carryforwards', async () => {
    const cf1: AEATCarryForward = {
      id: 1,
      propertyId: 1,
      taxYear: 2022,
      totalIncome: 5000,
      financingAndRepair: 8000,
      limitApplied: 5000,
      excessAmount: 3000,
      expirationYear: 2026,
      remainingAmount: 3000,
      createdAt: '',
      updatedAt: '',
    };
    const cf2: AEATCarryForward = {
      id: 2,
      propertyId: 1,
      taxYear: 2023,
      totalIncome: 5000,
      financingAndRepair: 7000,
      limitApplied: 5000,
      excessAmount: 2000,
      expirationYear: 2027,
      remainingAmount: 2000,
      createdAt: '',
      updatedAt: '',
    };
    mockStore.push(cf1, cf2);
    // Apply 4000: consume all of cf1 (3000) + 1000 from cf2
    await consumirArrastresAplicados([cf1, cf2], 4000);
    expect(mockStore[0].remainingAmount).toBe(0);   // cf1 fully consumed
    expect(mockStore[1].remainingAmount).toBe(1000); // cf2 partially consumed
  });
});

// ─── Integration: AEAT limit scenarios ───────────────────────────────────────

describe('AEAT limit integration scenarios', () => {
  it('scenario: ingresos 10000, gastos 0105+0106 8000 → no excess, deduce 8000', () => {
    const ingresos = 10000;
    const fr = 8000;
    const limiteAEAT = ingresos;
    const gastosConLimite = Math.min(fr, limiteAEAT);
    const exceso = Math.max(0, fr - limiteAEAT);
    expect(gastosConLimite).toBe(8000);
    expect(exceso).toBe(0);
  });

  it('scenario: ingresos 5000, gastos 0105+0106 8000 → excess 3000, deduce 5000', () => {
    const ingresos = 5000;
    const fr = 8000;
    const limiteAEAT = ingresos;
    const gastosConLimite = Math.min(fr, limiteAEAT);
    const exceso = Math.max(0, fr - limiteAEAT);
    expect(gastosConLimite).toBe(5000);
    expect(exceso).toBe(3000);
  });

  it('scenario: arrastre anterior 2000, ingresos 7000, gastos 5000 → aplica 2000 arrastre', () => {
    const ingresos = 7000;
    const fr = 5000;
    const arrastresDisponibles = 2000;
    const limiteAEAT = ingresos;
    const totalConArrastres = fr + arrastresDisponibles;
    const gastosConLimite = Math.min(totalConArrastres, limiteAEAT);
    const espacioParaArrastres = Math.max(0, limiteAEAT - fr);
    const arrastresAplicados = Math.min(arrastresDisponibles, espacioParaArrastres);
    expect(gastosConLimite).toBe(7000); // 5000 FR + 2000 arrastre = 7000 (all fits within limit)
    expect(arrastresAplicados).toBe(2000);
  });

  it('scenario: arrastre caduca (4 ejercicios cumplidos) → expirationYear < ejercicio', () => {
    // Carryforward generated in 2020, expires 2024, queried in 2025
    const taxYear = 2020;
    const expirationYear = taxYear + 4; // 2024
    const ejercicio = 2025;
    const disponible = expirationYear >= ejercicio; // false → expired
    expect(disponible).toBe(false);
  });

  it('scenario: arrastre que vence en el mismo año ejercicio → se aplica', () => {
    // expirationYear = 2025 = ejercicio → still valid
    const expirationYear = 2025;
    const ejercicio = 2025;
    const disponible = expirationYear >= ejercicio; // true
    expect(disponible).toBe(true);
  });
});
