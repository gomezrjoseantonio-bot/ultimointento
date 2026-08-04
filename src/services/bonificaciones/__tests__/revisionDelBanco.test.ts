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
