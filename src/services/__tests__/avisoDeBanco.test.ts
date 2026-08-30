// ============================================================================
// El aviso de banco no desautoriza al usuario con una corazonada
// ============================================================================
//
// `bankProfileMatcher.match` devuelve el perfil que más puntúe SEA CUAL SEA su
// puntuación (`bankProfileMatcher.ts:76`): como todos los extractos españoles
// llevan cabeceras parecidas —fecha, concepto, importe—, cualquier fichero saca
// algún punto con algún perfil.
//
// Con eso, el aviso contradecía la cuenta que el usuario había elegido a mano
// —y que se le pidió elegir porque el IBAN no se detectó— diciéndole que
// descartara y empezara de nuevo. Un fichero de BBVA anunciado como Santander.
//
// La incoherencia: dos líneas más arriba, el mismo fichero exige 60 puntos
// (`PROFILE_CONFIDENCE_THRESHOLD`) para creerse una detección propia. Para
// decidir pedía 60; para desautorizar al usuario le valía con 1.

import { contradiceLaCuentaElegida } from '../deteccionDeBanco';

describe('el aviso solo salta con una detección creíble', () => {
  it('con confianza suficiente y banco distinto, avisa', () => {
    expect(contradiceLaCuentaElegida('BBVA', { profile: 'Santander', confidence: 85 })).toBe(true);
  });

  // El caso real: un .xls de BBVA que saca 8 puntos con el perfil de Santander.
  it('por debajo del umbral NO avisa · manda la cuenta que eligió el usuario', () => {
    expect(contradiceLaCuentaElegida('BBVA', { profile: 'Santander', confidence: 8 })).toBe(false);
  });

  it('justo en el umbral sí avisa · 60 es creíble', () => {
    expect(contradiceLaCuentaElegida('BBVA', { profile: 'Santander', confidence: 60 })).toBe(true);
  });

  it('mismo banco no avisa, por muy seguro que esté', () => {
    expect(contradiceLaCuentaElegida('BBVA', { profile: 'BBVA', confidence: 100 })).toBe(false);
  });

  it('mismo banco con otra caja tampoco', () => {
    expect(contradiceLaCuentaElegida('bbva', { profile: 'BBVA', confidence: 100 })).toBe(false);
  });

  it('sin cuenta elegida no hay a quién contradecir', () => {
    expect(contradiceLaCuentaElegida(null, { profile: 'Santander', confidence: 100 })).toBe(false);
  });

  it('sin perfil detectado tampoco', () => {
    expect(contradiceLaCuentaElegida('BBVA', { profile: null, confidence: 0 })).toBe(false);
  });
});
