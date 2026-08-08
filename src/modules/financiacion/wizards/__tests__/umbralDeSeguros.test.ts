// La casilla de la condición de seguros · una sola, y dos umbrales posibles.
//
// `SEGUROS` admite «cuántas pólizas» y «cuánta prima al año», y la fila del
// asistente solo tiene una casilla. Enseñaba siempre el número: una condición
// que venía del anexo con una prima mínima aparecía VACÍA, y al teclear
// cualquier cosa se perdía la mitad de la condición sin decir nada.

import { __private__ } from '../PrestamoPageV2';
import type { ReglaBonificacion } from '../../../../types/prestamos';

const { reglaDeCondicion, umbralDeRegla, condicionDeLaRegla } = __private__;

describe('la casilla habla del umbral que la regla usa', () => {
  it('con número de pólizas, se teclea el número', () => {
    const r: ReglaBonificacion = { tipo: 'SEGUROS', minimoPolizas: 2 };

    expect(umbralDeRegla(r)).toBe('2');
    expect(condicionDeLaRegla(r).unidad).toBe('nº');
  });

  // Este es el que salía vacío · el anexo dice «primas por 600 € al año» y la
  // casilla no enseñaba nada.
  it('con prima mínima y sin número, se teclea la prima', () => {
    const r: ReglaBonificacion = { tipo: 'SEGUROS', primaAnualMinima: 600 };

    expect(umbralDeRegla(r)).toBe('600');
    expect(condicionDeLaRegla(r).unidad).toBe('€/año');
  });
});

describe('editar un umbral no borra el otro', () => {
  it('teclear el número conserva la prima que trajo el anexo', () => {
    const previa: ReglaBonificacion = {
      tipo: 'SEGUROS',
      minimoPolizas: 1,
      primaAnualMinima: 600,
    };
    const nueva = reglaDeCondicion('SEGUROS', '3', 'Seguros', previa);

    expect(nueva).toEqual({ tipo: 'SEGUROS', minimoPolizas: 3, primaAnualMinima: 600 });
  });

  it('y una fila que edita la prima escribe la prima, no el número', () => {
    const previa: ReglaBonificacion = { tipo: 'SEGUROS', primaAnualMinima: 600 };
    const nueva = reglaDeCondicion('SEGUROS', '900', 'Seguros', previa);

    expect(nueva).toEqual({ tipo: 'SEGUROS', primaAnualMinima: 900 });
  });

  // Sin regla anterior —una fila recién creada— la casilla es el número, que es
  // lo que ofrece el catálogo.
  it('una fila nueva edita el número de pólizas', () => {
    expect(reglaDeCondicion('SEGUROS', '2', 'Seguros')).toEqual({
      tipo: 'SEGUROS',
      minimoPolizas: 2,
      primaAnualMinima: undefined,
    });
  });
});
