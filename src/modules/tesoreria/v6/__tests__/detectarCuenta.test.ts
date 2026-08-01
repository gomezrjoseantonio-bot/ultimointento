// Detección de cuenta por IBAN (§4.7, puerta global).
//
// La regla que fija: ante duda NO se adivina. Importar en la cuenta equivocada
// mueve saldos que no son y no se deshace solo, así que todo lo que no sea una
// única coincidencia limpia acaba pidiendo al usuario que elija.

import { cuentaPorIban, ibansEn, normalizarIban } from '../detectarCuenta';
import type { Account } from '../../../../services/db';

const cuenta = (id: number, alias: string, iban: string): Account =>
  ({
    id,
    alias,
    iban,
    ultimosCuatro: iban.slice(-4),
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
  }) as Account;

const SABADELL = 'ES9100491500051234567891';
const SANTANDER = 'ES7620770024003102575766';

describe('encontrar IBANs en el texto', () => {
  it('los reconoce con espacios, guiones y en minúsculas', () => {
    expect(ibansEn('Titular: ES91 0049 1500 0512 3456 7891')).toEqual([SABADELL]);
    expect(ibansEn('IBAN es91-0049-1500-0512-3456-7891')).toEqual([SABADELL]);
  });

  it('no repite el mismo IBAN escrito de dos formas', () => {
    const texto = `Cuenta ${SABADELL}\nResumen de ES91 0049 1500 0512 3456 7891`;
    expect(ibansEn(texto)).toHaveLength(1);
  });

  it('normalizar quita separadores y sube a mayúsculas', () => {
    expect(normalizarIban('es91 0049-1500 0512 3456 7891')).toBe(SABADELL);
  });
});

describe('cruzar con las cuentas del usuario', () => {
  const cuentas = [cuenta(1, 'Sabadell', SABADELL), cuenta(2, 'Santander', SANTANDER)];

  it('una sola coincidencia · se detecta', () => {
    const d = cuentaPorIban(`Extracto de ${SABADELL} · marzo`, cuentas);
    expect(d).toEqual({ estado: 'detectada', cuenta: cuentas[0] });
  });

  it('el fichero menciona dos cuentas mías · ambigua, no elige', () => {
    const d = cuentaPorIban(`${SABADELL} y ${SANTANDER}`, cuentas);
    expect(d.estado).toBe('ambigua');
  });

  it('IBAN que no es de ninguna cuenta mía · lo dice, no cae en la primera', () => {
    const d = cuentaPorIban('ES2100810001234567890123', cuentas);
    expect(d).toEqual({ estado: 'iban-desconocido', iban: 'ES2100810001234567890123' });
  });

  it('sin IBAN en el texto · sin detectar', () => {
    expect(cuentaPorIban('fecha;concepto;importe', cuentas).estado).toBe('sin-iban');
  });

  it('no propone una cuenta dada de baja', () => {
    const baja = { ...cuenta(1, 'Sabadell', SABADELL), status: 'DELETED' } as Account;
    expect(cuentaPorIban(SABADELL, [baja]).estado).toBe('iban-desconocido');
  });

  it('el mismo IBAN repetido en el fichero sigue siendo UNA cuenta', () => {
    const d = cuentaPorIban(`${SABADELL}\n${SABADELL}\n${SABADELL}`, cuentas);
    expect(d.estado).toBe('detectada');
  });
});
