// E3.2 · §7.4 · la clave de aprendizaje agrupa por QUIÉN, no por el texto.
//
// El fallo que esto arregla se midió sobre los diez extractos reales: UNA sola
// clave agrupaba 203 apuntes de 34 conceptos distintos —«Transferencia
// Inmediata A Favor De Concepción», «… De Gonzalo», «… De José»— porque el
// trigrama que manda es «transferencia inmediata favor», que es la cabecera del
// banco y no la persona. Clasificar uno clasificaba los 203, de 33 personas
// distintas. Es el cajón común de #1866 reapareciendo por otra puerta.
//
// Al revés también: los apuntes de una misma persona se partían en varias
// reglas porque el banco los encabeza de formas distintas.

import { buildLearnKey, buildLearnKeyV1, claveDeContraparteDelMovimiento, reglaEncaja, patronesDeRegla } from '../movementLearningService';
import { claveDeContraparte } from '../coincidenciaNombre';
import type { Movement, MovementLearningRule } from '../db';

const mov = (description: string, amount = -50): Movement =>
  ({ id: 1, accountId: 1, date: '2026-03-10', amount, description, counterparty: '' }) as unknown as Movement;

describe('el cajón que agrupaba a 33 personas', () => {
  it('dos personas distintas bajo la misma cabecera son DOS claves', () => {
    const aConcepcion = mov('Transferencia Inmediata A Favor De Concepcion Ramirez Guerrero');
    const aGonzalo = mov('Transferencia Inmediata A Favor De Gonzalo Javier Gonzalez Guedan');

    expect(buildLearnKey(aConcepcion)).not.toBe(buildLearnKey(aGonzalo));
    // Y por el texto solo, que es como se agrupaba antes, eran la MISMA.
    expect(buildLearnKeyV1(aConcepcion)).toBe(buildLearnKeyV1(aGonzalo));
  });

  it('la misma persona con dos cabeceras distintas es UNA clave', () => {
    // El banco escribe una vez «TRANSFERENCIA A» y otra «Bizum A Favor De»:
    // antes eran dos reglas, y enseñarle una no enseñaba la otra.
    const transferencia = mov('TRANSFERENCIA A Eloy Gomez Ramirez');
    const bizum = mov('Bizum A Favor De Eloy Gomez Ramirez Concepto: Sin Concepto');

    expect(buildLearnKey(transferencia)).toBe(buildLearnKey(bizum));
    expect(buildLearnKeyV1(transferencia)).not.toBe(buildLearnKeyV1(bizum));
  });

  it('dos hermanos no se juntan · el segundo apellido los separa', () => {
    expect(buildLearnKey(mov('Bizum De Eloy Gomez Ramirez', 20))).not.toBe(
      buildLearnKey(mov('Transferencia De Eloy Gomez Lopez, Concepto Pago', 20))
    );
  });

  it('el signo sigue separando · un bizum que sale no es uno que entra', () => {
    expect(buildLearnKey(mov('Bizum A Favor De Victor Lada Horrillo', -30))).not.toBe(
      buildLearnKey(mov('Bizum De Victor Lada Horrillo', 30))
    );
  });

  it('el identificador manda sobre el nombre · un CUPS agrupa mejor que quien paga', () => {
    const conContrato = mov('Transferencia A Favor De Banco Cetelem S.a. Concepto: Contrato 40070968660905');
    expect(buildLearnKey(conContrato)).not.toBe(buildLearnKey(mov('Transferencia A Favor De Banco Cetelem S.a.')));
  });
});

describe('el nombre que se usa como clave', () => {
  it('el mismo hombre escrito al revés por dos bancos da la misma clave', () => {
    expect(claveDeContraparte('JOSE ANTONIO GOMEZ RAMIREZ')).toBe(claveDeContraparte('GOMEZ RAMIREZ JOSE ANTONIO'));
  });

  it('la cola que el banco pega detrás del nombre no estrena clave', () => {
    // ING escribe el concepto pegado al nombre, sin decir dónde acaba uno.
    const base = claveDeContraparte('GOMEZ RAMIREZ JOSE ANTONIO');
    expect(claveDeContraparte('GOMEZ RAMIREZ JOSE ANTONIO Ahorro')).toBe(base);
    expect(claveDeContraparte('GOMEZ RAMIREZ JOSE ANTONIO Enviado por Banco Santander')).toBe(base);
  });

  it('el mismo pagador cada mes es UNA regla, no doce', () => {
    // «FEEBBO SOLUTIONS SL PAGO MEDUX MAYO» · con el nombre entero, cada mes
    // estrenaba clave. Medido: doce reglas para un solo pagador.
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO'].map((m) =>
      claveDeContraparte(`FEEBBO SOLUTIONS SL PAGO MEDUX ${m}`)
    );
    expect(new Set(meses).size).toBe(1);
  });

  it('un nombre de pila suelto no agrupa a nadie', () => {
    // «CONCEPCIÓN» a secas puede ser dos personas distintas · sin clave, y el
    // movimiento se queda con la agrupación por texto de siempre.
    expect(claveDeContraparte('CONCEPCION')).toBe('');
    expect(claveDeContraparteDelMovimiento(mov('Transferencia Inmediata A Favor De Concepcion'))).toBe('');
  });
});

describe('el tercer candado con la clave por contraparte', () => {
  const regla = (m: Movement): MovementLearningRule =>
    ({ ...patronesDeRegla(m), learnKey: 'x', ambito: 'personal', source: 'IMPLICIT', createdAt: '', updatedAt: '', appliedCount: 1 }) as MovementLearningRule;

  it('la regla de una persona encaja con otro apunte suyo, aunque el banco lo escriba distinto', () => {
    const r = regla(mov('Bizum A Favor De Eloy Gomez Ramirez Concepto: Sin Concepto'));
    expect(r.contraparteClave).toBe('eloy gomez ramirez');
    expect(reglaEncaja(mov('TRANSFERENCIA A Eloy Gomez Ramirez'), r)).toBe(true);
  });

  it('y NO encaja con otra persona de la misma cabecera', () => {
    const r = regla(mov('Bizum A Favor De Eloy Gomez Ramirez'));
    expect(reglaEncaja(mov('Bizum A Favor De Victor Lada Horrillo'), r)).toBe(false);
  });

  it('una regla de ANTES de E3.2 —sin nombre guardado— sigue encajando por su texto', () => {
    // Es lo que sostiene el respaldo de lectura: la regla vieja se encuentra
    // por su clave v1 y se confirma por lo mismo que la creó.
    const m = mov('Bizum A Favor De Victor Lada Horrillo Concepto: Loteria');
    const vieja = regla(m);
    delete vieja.contraparteClave;

    expect(reglaEncaja(m, vieja)).toBe(true);
  });
});
