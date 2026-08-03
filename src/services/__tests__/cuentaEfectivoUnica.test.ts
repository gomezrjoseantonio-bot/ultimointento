// El efectivo vive en UNA cuenta · docs/VOCABULARIO-dinero.md §1.
//
// No es una regla de ATLAS: el dinero físico es uno. Dos colchones no se
// distinguen entre sí, y en cuanto existen hay que elegir de cuál sale cada
// pago en efectivo — una pregunta sin respuesta buena.
//
// Y hay un motivo más concreto: el método «efectivo» ofrece la PRIMERA cuenta
// de efectivo que encuentra, así que la segunda quedaría muerta — recibiría
// traspasos de cajero y no pagaría nada, con el dinero atrapado dentro.

import { __private__ } from '../cuentasService';
import type { Account } from '../db';

const { efectivoQueYaExiste } = __private__;

const cuenta = (id: number, over: Partial<Account> = {}): Account =>
  ({
    id,
    iban: `ES9${id}`,
    tipo: 'CORRIENTE',
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Account;

const efectivo = (id: number, over: Partial<Account> = {}): Account =>
  cuenta(id, { tipo: 'EFECTIVO', alias: 'Efectivo', ...over });

describe('cuándo ya hay un colchón', () => {
  it('lo encuentra · no se puede crear otro', () => {
    const yaHay = efectivoQueYaExiste([cuenta(1), efectivo(2)]);
    expect(yaHay?.id).toBe(2);
  });

  it('sin ninguno, se puede crear', () => {
    expect(efectivoQueYaExiste([cuenta(1), cuenta(2)])).toBeUndefined();
  });
});

describe('las que no cuentan', () => {
  // Una cuenta dada de baja no ocupa el sitio: si borraste el colchón, tienes
  // que poder volver a tenerlo.
  it.each([
    ['marcada como DELETED', { status: 'DELETED' }],
    ['con fecha de borrado', { deleted_at: '2026-01-01T00:00:00.000Z' }],
  ])('una %s no bloquea', (_caso, marca) => {
    expect(efectivoQueYaExiste([efectivo(2, marca as Partial<Account>)])).toBeUndefined();
  });

  // Una cuenta en PAUSA sigue siendo tu colchón: su baja se puede deshacer, y
  // el dinero sigue ahí. Si esto no la contara, la ficha ofrecería el tipo y el
  // guardado lo rechazaría — dos criterios para la misma pregunta.
  it('una dada de baja SÍ sigue ocupando el sitio', () => {
    const enPausa = efectivo(2, { status: 'INACTIVE', activa: false });

    expect(efectivoQueYaExiste([enPausa])?.id).toBe(2);
  });

  // Guardar la cuenta de efectivo otra vez no puede chocar consigo misma.
  it('la que se está editando no se bloquea a sí misma', () => {
    expect(efectivoQueYaExiste([efectivo(2)], 2)).toBeUndefined();
  });

  // Pero sí bloquea a OTRA: convertir una corriente en efectivo teniendo ya un
  // colchón es la misma regla por la puerta de atrás.
  it('pero sí bloquea a otra distinta', () => {
    expect(efectivoQueYaExiste([efectivo(2)], 5)?.id).toBe(2);
  });
});
