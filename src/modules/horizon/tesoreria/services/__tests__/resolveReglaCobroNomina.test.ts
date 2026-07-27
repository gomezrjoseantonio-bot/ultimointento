import { resolveReglaCobroNomina } from '../treasurySyncService';
import { getBusinessDayForRule } from '../treasurySyncHelpers';

// El usuario marca «día de cobro = 28» y en Tesorería veía el 25. El 25 era el
// valor por defecto que se colaba cuando la regla del día no se resolvía bien.
// Estos tests fijan que el día configurado manda y que solo se usa el default
// cuando NO hay absolutamente nada configurado.
describe('resolveReglaCobroNomina · día de cobro de la nómina', () => {
  it('usa reglaCobroDia cuando está presente (día 28 → 28)', () => {
    const regla = resolveReglaCobroNomina({ reglaCobroDia: { tipo: 'fijo', dia: 28 } });
    expect(regla).toEqual({ tipo: 'fijo', dia: 28 });
    expect(getBusinessDayForRule(2026, 7, regla, 25)).toBe('2026-07-28');
  });

  it('respeta último hábil desde reglaCobroDia', () => {
    const regla = resolveReglaCobroNomina({ reglaCobroDia: { tipo: 'ultimo-habil' } });
    expect(regla).toEqual({ tipo: 'ultimo-habil' });
  });

  it('nómina legacy sin reglaCobroDia · cae a cuentaCobroIBAN.diaAbono numérico', () => {
    const regla = resolveReglaCobroNomina({ cuentaCobroIBAN: { diaAbono: 28 } });
    expect(regla).toEqual({ tipo: 'fijo', dia: 28 });
  });

  it('diaAbono = ultimoHabil → regla de último hábil', () => {
    const regla = resolveReglaCobroNomina({ cuentaCobroIBAN: { diaAbono: 'ultimoHabil' } });
    expect(regla).toEqual({ tipo: 'ultimo-habil' });
  });

  it('sin nada configurado → undefined (el llamante aplica su default)', () => {
    expect(resolveReglaCobroNomina({})).toBeUndefined();
    // Y ahí — y SOLO ahí — getBusinessDayForRule usa el fallback.
    expect(getBusinessDayForRule(2026, 7, undefined, 25)).toBe('2026-07-25');
  });

  it('reglaCobroDia manda sobre diaAbono si ambos existen', () => {
    const regla = resolveReglaCobroNomina({
      reglaCobroDia: { tipo: 'fijo', dia: 28 },
      cuentaCobroIBAN: { diaAbono: 5 },
    });
    expect(regla).toEqual({ tipo: 'fijo', dia: 28 });
  });
});
