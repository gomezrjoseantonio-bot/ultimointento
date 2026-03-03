import { buildLayeredAmounts } from '../modules/horizon/proyeccion/presupuesto/services/planningLayerService';

describe('planningLayerService', () => {
  it('backfills plan/forecast from legacy amountByMonth', () => {
    const legacy = [100, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = buildLayeredAmounts({ amountByMonth: legacy });

    expect(result.planAmountByMonth).toEqual(legacy);
    expect(result.forecastAmountByMonth).toEqual(legacy);
    expect(result.actualAmountByMonth).toEqual(new Array(12).fill(0));
    expect(result.amountByMonth).toEqual(legacy);
    expect(result.statusCertidumbreByMonth[0]).toBe('previsto');
  });


  it('creates LRP layer from legacy data when missing', () => {
    const legacy = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    const result = buildLayeredAmounts({ amountByMonth: legacy });

    expect(result.lrpAmountByMonth).toEqual(legacy);
    expect(result.planAmountByMonth).toEqual(legacy);
  });

  it('marks month as conciliado when actual exists', () => {
    const result = buildLayeredAmounts({
      amountByMonth: new Array(12).fill(0),
      forecastAmountByMonth: [0, 120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      actualAmountByMonth: [0, 118, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    });

    expect(result.statusCertidumbreByMonth[1]).toBe('conciliado');
  });
});
