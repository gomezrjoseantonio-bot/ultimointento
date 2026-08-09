// Dos que preguntan a la vez no calculan dos veces.
//
// El Panel monta dos efectos en el mismo tick —la estimación de impuesto
// acumulado y las alertas fiscales— y los dos piden la declaración del
// ejercicio en curso. La caché solo sirve a quien llega DESPUÉS de que alguien
// termine, así que los dos la encontraban vacía y los dos calculaban el IRPF
// entero, compitiendo por el mismo hilo. Nada estaba mal escrito: era una
// carrera entre dos aciertos de caché que nunca llegaban a tiempo.

import { compartirCalculo, invalidateFiscalCache } from '../fiscalCacheService';
import type { DeclaracionIRPF } from '../irpfCalculationService';

const unaDeclaracion = (marca: number) => ({ marca }) as unknown as DeclaracionIRPF;

describe('compartirCalculo', () => {
  it('dos peticiones a la vez calculan UNA vez y reciben lo mismo', async () => {
    let veces = 0;
    const calcular = () => {
      veces++;
      return new Promise<DeclaracionIRPF>((res) =>
        setTimeout(() => res(unaDeclaracion(veces)), 20)
      );
    };

    const [a, b] = await Promise.all([
      compartirCalculo(2026, calcular),
      compartirCalculo(2026, calcular),
    ]);

    expect(veces).toBe(1);
    expect(a).toBe(b);
  });

  it('cada ejercicio va por su cuenta', async () => {
    let veces = 0;
    const calcular = () => Promise.resolve(unaDeclaracion(++veces));

    await Promise.all([compartirCalculo(2025, calcular), compartirCalculo(2026, calcular)]);

    expect(veces).toBe(2);
  });

  // Terminado el cálculo se suelta · si no, el siguiente en llegar heredaría
  // para siempre la respuesta de la primera vez, saltándose el TTL y el hash
  // que sí saben cuándo un dato ha dejado de valer.
  it('lo terminado no se queda pegado', async () => {
    let veces = 0;
    const calcular = () => Promise.resolve(unaDeclaracion(++veces));

    await compartirCalculo(2026, calcular);
    await compartirCalculo(2026, calcular);

    expect(veces).toBe(2);
  });

  // Un fallo tampoco · dejar la promesa rechazada ahí haría que todos los que
  // llegaran después heredaran un error que quizá ya no ocurre.
  it('ni lo fallado', async () => {
    let veces = 0;
    const queFalla = () => {
      veces++;
      return Promise.reject(new Error('la base no responde'));
    };

    await expect(compartirCalculo(2026, queFalla)).rejects.toThrow('la base');
    await expect(compartirCalculo(2026, queFalla)).rejects.toThrow('la base');

    expect(veces).toBe(2);
  });

  // Si el dato cambió, lo que viene en camino ya no vale · repartirlo sería
  // dar por buena una respuesta calculada sobre lo de antes.
  it('invalidar tira también lo que está a medio calcular', async () => {
    let veces = 0;
    const calcular = () => {
      veces++;
      return new Promise<DeclaracionIRPF>((res) =>
        setTimeout(() => res(unaDeclaracion(veces)), 20)
      );
    };

    const primera = compartirCalculo(2026, calcular);
    invalidateFiscalCache(2026);
    const segunda = compartirCalculo(2026, calcular);

    await Promise.all([primera, segunda]);
    expect(veces).toBe(2);
  });
});
