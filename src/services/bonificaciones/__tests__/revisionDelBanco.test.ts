// Cuándo revisa el banco · VOCABULARIO §6 ter.
//
// Lo que vigila esto es que la fecha sea de verdad. Una fecha inventada se lee
// igual que una real, y esta manda a alguien a gastar antes de un día que nadie
// le ha puesto.

import { proximaRevision } from '../revisionDelBanco';

const cal = (over: Partial<Parameters<typeof proximaRevision>[0]> = {}) => ({
  desdeLaFirma: '2025-03-10',
  cadaMeses: 12,
  ...over,
});

describe('la próxima revisión', () => {
  it('cae al cumplirse el periodo desde la firma', () => {
    expect(proximaRevision(cal(), '2025-08-04')?.fecha).toBe('2026-03-10');
  });

  it('la ya pasada no vale · se va a la siguiente', () => {
    expect(proximaRevision(cal(), '2026-06-01')?.fecha).toBe('2027-03-10');
  });

  it('cada seis meses son dos al año', () => {
    expect(proximaRevision(cal({ cadaMeses: 6 }), '2025-08-04')?.fecha).toBe('2025-09-10');
    expect(proximaRevision(cal({ cadaMeses: 6 }), '2025-09-20')?.fecha).toBe('2026-03-10');
  });

  // El día de la revisión el banco todavía está mirando · la siguiente es la
  // siguiente, no esa misma.
  it('el mismo día de una revisión ya mira a la próxima', () => {
    expect(proximaRevision(cal(), '2026-03-10')?.fecha).toBe('2027-03-10');
  });
});

// Una firma el 31 no puede correr las revisiones siguientes: si «+1 mes» se
// desborda al 3 de marzo, todas las citas posteriores llegan tarde.
describe('los meses que no tienen ese día', () => {
  it('el 31 de enero más un mes es el último de febrero', () => {
    expect(proximaRevision(cal({ desdeLaFirma: '2025-01-31', cadaMeses: 1 }), '2025-02-01')?.fecha)
      .toBe('2025-02-28');
  });

  it('en año bisiesto es el 29', () => {
    expect(proximaRevision(cal({ desdeLaFirma: '2024-01-31', cadaMeses: 1 }), '2024-02-01')?.fecha)
      .toBe('2024-02-29');
  });

  // La serie sale de cada revisión, no de multiplicar: recortada una vez a 28,
  // no debe volver al 31 y desbordar en el siguiente mes corto.
  it('recortado un mes, la serie sigue desde ahí', () => {
    expect(proximaRevision(cal({ desdeLaFirma: '2025-01-31', cadaMeses: 1 }), '2025-03-01')?.fecha)
      .toBe('2025-03-28');
  });
});

// §6 ter · durante el periodo inicial la cuota rebajada no demuestra nada, y
// una revisión que cae dentro no cambia nada: anunciarla sería una alarma falsa.
describe('el periodo inicial', () => {
  const conGracia = (over = {}) => cal({ graciaMeses: 12, cadaMeses: 6, ...over });

  it('se dice que estamos en él, y hasta cuándo', () => {
    const r = proximaRevision(conGracia(), '2025-08-04');
    expect(r?.enGracia).toBe(true);
    expect(r?.finDeGracia).toBe('2026-03-10');
  });

  it('las revisiones de dentro no se anuncian · la primera que decide es la de después', () => {
    // Con revisión semestral hay una a los 6 meses (10 sep 2025), pero cae en
    // gracia. La que manda es la de 12 meses… que también es el fin de gracia,
    // así que la primera que decide es la de 18 meses.
    expect(proximaRevision(conGracia(), '2025-08-04')?.fecha).toBe('2026-09-10');
  });

  it('pasado el periodo, deja de estar en gracia', () => {
    const r = proximaRevision(conGracia(), '2026-05-01');
    expect(r?.enGracia).toBe(false);
    expect(r?.fecha).toBe('2026-09-10');
  });

  it('sin periodo inicial no se inventa ninguno', () => {
    const r = proximaRevision(cal(), '2025-08-04');
    expect(r?.enGracia).toBe(false);
    expect(r?.finDeGracia).toBeUndefined();
  });

  it('cero meses de gracia es no tener gracia', () => {
    const r = proximaRevision(cal({ graciaMeses: 0 }), '2025-08-04');
    expect(r?.enGracia).toBe(false);
    expect(r?.finDeGracia).toBeUndefined();
  });
});

// Sin saber cada cuánto revisa no hay fecha, y una inventada es peor que
// ninguna: se lee igual que una real. Misma razón que el `no_verificable`.
describe('lo que no se sabe no se inventa', () => {
  it.each([
    ['sin periodo', undefined],
    ['cero', 0],
    ['negativo', -6],
    ['no numérico', NaN],
  ])('%s no da fecha', (_caso, cadaMeses) => {
    expect(proximaRevision(cal({ cadaMeses: cadaMeses as number }), '2025-08-04')).toBeNull();
  });

  it('sin fecha de firma tampoco', () => {
    expect(proximaRevision(cal({ desdeLaFirma: '' }), '2025-08-04')).toBeNull();
  });

  // Una firma muy antigua no puede colgar la pantalla que la pinta.
  it('una firma de hace décadas termina', () => {
    const r = proximaRevision(cal({ desdeLaFirma: '1970-01-15', cadaMeses: 12 }), '2026-08-04');
    expect(r?.fecha).toBe('2027-01-15');
  });
});

// Lo que dice el banco MANDA · la carta del Santander dice «REVISIÓN ANUAL» y
// «desde el 31/03/2026 hasta el 30/03/2027». La revisión es regular, pero esa
// fecha es la SUYA y no tiene por qué caer en el aniversario de la firma:
// deducirla acierta solo si coinciden, y una fecha equivocada es peor que
// ninguna porque se lee igual que la buena.
describe('la fecha que da el banco', () => {
  it('gana a la que saldría de la periodicidad', () => {
    const r = proximaRevision(
      cal({ desdeLaFirma: '2025-03-10', cadaMeses: 12, proximaSegunElBanco: '2027-08' }),
      '2026-08-04'
    );

    expect(r?.fecha).toBe('2027-08');
    expect(r?.precision).toBe('mes');
  });

  // Nadie ha dicho qué DÍA de agosto mira · hasta que acabe el mes sigue siendo
  // la próxima, no una que ya pasó.
  it('dentro de su mes sigue siendo la próxima', () => {
    expect(
      proximaRevision(cal({ proximaSegunElBanco: '2027-08' }), '2027-08-20')?.fecha
    ).toBe('2027-08');
  });

  it('pasada de mes, cede a la periodicidad', () => {
    const r = proximaRevision(
      cal({ desdeLaFirma: '2025-03-10', cadaMeses: 12, proximaSegunElBanco: '2026-01' }),
      '2026-09-01'
    );

    expect(r?.fecha).toBe('2027-03-10');
    expect(r?.precision).toBe('dia');
  });

  // El caso de la carta · «REVISIÓN ANUAL», tipo aplicado del 31/03/2026 al
  // 30/03/2027. La firma de esa hipoteca no cae en marzo, así que deducir desde
  // ella habría dado otro mes.
  it('la revisión anual del Santander se dice tal cual', () => {
    const r = proximaRevision(
      {
        desdeLaFirma: '2021-06-15',
        cadaMeses: 12,
        proximaSegunElBanco: '2027-03',
      },
      '2026-08-05'
    );

    expect(r?.fecha).toBe('2027-03');
    expect(r?.precision).toBe('mes');
  });

  it('sin periodicidad, la del banco basta', () => {
    expect(
      proximaRevision({ desdeLaFirma: '2025-03-10', proximaSegunElBanco: '2027-08' }, '2026-08-04')
        ?.fecha
    ).toBe('2027-08');
  });

  it.each(['2027-8', '08/2027', '2027-13', 'agosto', ''])('«%s» no es una fecha del banco', (v) => {
    expect(
      proximaRevision({ desdeLaFirma: '2025-03-10', proximaSegunElBanco: v }, '2026-08-04')
    ).toBeNull();
  });
});

// Quien no sabe cada cuánto revisan su hipoteca —lo más habitual— puede saber
// perfectamente que tiene el primer año regalado. Callar el periodo inicial por
// no tener fecha sería callar justo en el caso más probable.
describe('el periodo inicial vale por sí solo', () => {
  it('sin periodicidad se sigue diciendo que estamos en gracia', () => {
    const r = proximaRevision({ desdeLaFirma: '2025-03-10', graciaMeses: 12 }, '2025-08-04');

    expect(r?.enGracia).toBe(true);
    expect(r?.finDeGracia).toBe('2026-03-10');
    expect(r?.fecha).toBeUndefined();
  });

  it('sin periodicidad ni gracia no hay nada que decir', () => {
    expect(proximaRevision({ desdeLaFirma: '2025-03-10' }, '2025-08-04')).toBeNull();
  });
});

// Un 11,6 guardado por error se convertiría en un calendario de doce meses sin
// que nadie se entere, y de ahí saldría una fecha que se lee igual que la buena.
describe('los meses que no son meses', () => {
  it.each([11.6, 0.5, -12.2])('%s no es un calendario', (cadaMeses) => {
    expect(proximaRevision(cal({ cadaMeses }), '2025-08-04')).toBeNull();
  });
});
