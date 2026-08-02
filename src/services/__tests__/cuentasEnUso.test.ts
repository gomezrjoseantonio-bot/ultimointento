// §4.8 · qué cuentas siguen en uso.
//
// La baja es SUAVE: `deactivate` deja la cuenta con `status: 'INACTIVE'` para
// que Deshacer sea inmediato. Tres pantallas comprobaban `status !== 'DELETED'`
// cada una por su lado, y una cuenta dada de baja no es una cuenta borrada: la
// baja se guardaba de verdad, el aviso decía la verdad, y la cuenta seguía en
// pantalla como si nada.

import { cuentasEnUso, estaDeBaja } from '../cuentasEnUso';
import type { Account } from '../db';

const cuenta = (over: Partial<Account> = {}): Account => ({
  id: 1,
  iban: 'ES9100491500051234567892',
  alias: 'Santander Nómina',
  status: 'ACTIVE',
  activa: true,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('estaDeBaja', () => {
  it('la que está activa, no', () => {
    expect(estaDeBaja(cuenta())).toBe(false);
  });

  // El caso que fallaba: `INACTIVE` pasaba los tres filtros de pantalla.
  it('la dada de baja, sí · aunque no esté borrada', () => {
    expect(estaDeBaja(cuenta({ status: 'INACTIVE', activa: false }))).toBe(true);
  });

  it('la borrada, sí', () => {
    expect(estaDeBaja(cuenta({ status: 'DELETED' }))).toBe(true);
    expect(estaDeBaja(cuenta({ deleted_at: '2026-08-01' }))).toBe(true);
  });

  // Cuentas anteriores al sistema de estados: solo traen el campo heredado.
  // El tipo de entrada admite `status` ausente justamente para esto — si lo
  // exigiera, esta rama sería inalcanzable sobre el papel mientras sigue
  // ocurriendo en los datos.
  it('la que solo trae `activa: false`, también', () => {
    expect(estaDeBaja({ activa: false })).toBe(true);
  });

  it('la que no trae nada se considera en uso · no se inventa una baja', () => {
    expect(estaDeBaja({})).toBe(false);
  });
});

describe('cuentasEnUso', () => {
  it('deja fuera las de baja y conserva el orden de las demás', () => {
    const lista = [
      cuenta({ id: 1, alias: 'Primera' }),
      cuenta({ id: 2, alias: 'De baja', status: 'INACTIVE', activa: false }),
      cuenta({ id: 3, alias: 'Segunda' }),
    ];
    expect(cuentasEnUso(lista).map((c) => c.alias)).toEqual(['Primera', 'Segunda']);
  });
});
