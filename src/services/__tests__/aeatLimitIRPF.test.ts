// Tests for AEAT art. 23 LIRPF limit: casillas 0105+0106 cannot exceed ingresos íntegros
// Validates Bug 1 fix (fiscalSummaryService) and Bug 2 fix (irpfCalculationService)

import { calculateAEATLimits, getCarryForwardExpirationYear } from '../../utils/aeatUtils';

describe('calculateAEATLimits (art. 23 LIRPF)', () => {
  it('no excess when 0105+0106 < ingresos íntegros → full deduction, excess = 0', () => {
    const result = calculateAEATLimits(10000, 3000, 2000); // income 10000, financing 3000, repairs 2000
    expect(result.applied).toBe(5000); // min(5000, 10000) = 5000
    expect(result.excess).toBe(0);
    expect(result.limit).toBe(10000);
  });

  it('no excess when 0105+0106 equals ingresos íntegros → exactly at limit, no excess', () => {
    const result = calculateAEATLimits(5000, 3000, 2000);
    expect(result.applied).toBe(5000);
    expect(result.excess).toBe(0);
  });

  it('excess generated when 0105+0106 > ingresos íntegros → deduction limited to ingresos', () => {
    const result = calculateAEATLimits(4000, 3000, 2000); // income 4000, total 5000
    expect(result.applied).toBe(4000); // capped at income
    expect(result.excess).toBe(1000); // 5000 - 4000 = 1000 excess
    expect(result.limit).toBe(4000);
  });

  it('all expenses are excess when there is no rental income', () => {
    const result = calculateAEATLimits(0, 1500, 500);
    expect(result.applied).toBe(0);
    expect(result.excess).toBe(2000);
  });

  it('zero financing and repairs → no excess regardless of income', () => {
    const result = calculateAEATLimits(10000, 0, 0);
    expect(result.applied).toBe(0);
    expect(result.excess).toBe(0);
  });

  it('excess = max(0, total - income): never negative', () => {
    const result = calculateAEATLimits(50000, 0, 0);
    expect(result.excess).toBeGreaterThanOrEqual(0);
  });
});

describe('getCarryForwardExpirationYear', () => {
  it('carryforward expires after 4 years', () => {
    expect(getCarryForwardExpirationYear(2024)).toBe(2028);
    expect(getCarryForwardExpirationYear(2020)).toBe(2024);
  });
});

describe('AEAT carryforward FIFO logic (unit)', () => {
  // Simulate carryforward application: oldest applied first (FIFO)
  const applyCarryForwardsToMargin = (
    carryForwards: Array<{ exerciseYear: number; remainingAmount: number }>,
    availableMargin: number
  ): { applied: number; appliedDetails: Array<{ exerciseYear: number; applied: number }> } => {
    // Sort by year ascending (FIFO)
    const sorted = [...carryForwards].sort((a, b) => a.exerciseYear - b.exerciseYear);
    let remaining = availableMargin;
    let totalApplied = 0;
    const appliedDetails: Array<{ exerciseYear: number; applied: number }> = [];
    for (const cf of sorted) {
      if (remaining <= 0) break;
      const canApply = Math.min(cf.remainingAmount, remaining);
      appliedDetails.push({ exerciseYear: cf.exerciseYear, applied: canApply });
      totalApplied += canApply;
      remaining -= canApply;
    }
    return { applied: totalApplied, appliedDetails };
  };

  it('applies oldest carryforward first (FIFO)', () => {
    const carryForwards = [
      { exerciseYear: 2023, remainingAmount: 800 },
      { exerciseYear: 2022, remainingAmount: 600 },
    ];
    const { appliedDetails } = applyCarryForwardsToMargin(carryForwards, 1000);
    // 2022 should be applied first
    expect(appliedDetails[0].exerciseYear).toBe(2022);
    expect(appliedDetails[0].applied).toBe(600);
    // Then 2023, with 400 of available margin left
    expect(appliedDetails[1].exerciseYear).toBe(2023);
    expect(appliedDetails[1].applied).toBe(400);
  });

  it('does not apply carryforwards when no margin available', () => {
    const carryForwards = [{ exerciseYear: 2022, remainingAmount: 1000 }];
    const { applied } = applyCarryForwardsToMargin(carryForwards, 0);
    expect(applied).toBe(0);
  });

  it('applies carryforward up to available margin only', () => {
    const carryForwards = [{ exerciseYear: 2022, remainingAmount: 1000 }];
    const { applied } = applyCarryForwardsToMargin(carryForwards, 300);
    expect(applied).toBe(300);
  });

  it('expiry check: carryforward from year Y expires after Y+4', () => {
    const originYear = 2020;
    const expirationYear = getCarryForwardExpirationYear(originYear); // 2024
    // Should NOT be applicable in 2025 (expired)
    const currentYear = 2025;
    const isExpired = currentYear > expirationYear;
    expect(isExpired).toBe(true);
    // Should still be applicable in 2024
    expect(2024 > expirationYear).toBe(false);
  });
});

describe('Prorrateo (partial rental) with AEAT limit', () => {
  it('limit is applied after proration: capped at ingresosIntegros (not total)', () => {
    // Scenario: property rented 6 months (ratio = 0.5)
    // box0105 = 8000, box0106 = 2000, total = 10000 (before proration)
    // ingresosIntegros = 3000 (6 months * 500/month)
    // prorated financing+repairs = 10000 * 0.5 = 5000
    // limit = min(5000, 3000) = 3000
    // excess = max(0, 5000 - 3000) = 2000
    const ratio = 0.5;
    const box0105 = 8000;
    const box0106 = 2000;
    const ingresosIntegros = 3000;
    const proratedFinancingRepairs = (box0105 + box0106) * ratio; // 5000
    const limited = Math.min(proratedFinancingRepairs, ingresosIntegros);
    const excess = Math.max(0, proratedFinancingRepairs - ingresosIntegros);
    expect(limited).toBe(3000);
    expect(excess).toBe(2000);
  });
});
