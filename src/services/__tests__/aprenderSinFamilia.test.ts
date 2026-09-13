// E3.2 · §7.4 · decir SOLO el piso también enseña, y no poder aprender se dice.
//
// Dos silencios que costaban aprendizaje sin que nadie lo supiera:
//
//   · marcar «esto es de Fuertes Acevedo 32» sin decir de qué familia era no
//     dejaba regla ninguna. El piso es la mitad del trabajo y la que más cuesta,
//     y se tiraba entera;
//   · cuando del concepto no quedaba con qué agrupar, `feedLearningRule` volvía
//     en silencio. El usuario clasificaba la misma línea todos los meses sin
//     entender por qué ATLAS no aprendía, y nadie podía contar cuántas veces
//     pasaba.

import { deriveCategoryFromMovement, deriveCategoryFromEvent, feedLearningRule } from '../aplicarSugerencia';
import type { Movement } from '../db';
import type { TreasuryEvent } from '../db';

jest.mock('../movementLearningService', () => ({
  ...jest.requireActual('../movementLearningService'),
  createOrUpdateRule: jest.fn().mockResolvedValue({}),
}));

const mov = (over: Partial<Movement>): Movement =>
  ({ id: 1, accountId: 1, date: '2026-03-10', amount: -50, description: 'X', ...over }) as unknown as Movement;

describe('lo que se puede aprender de un movimiento', () => {
  it('solo el piso ya es algo que aprender', () => {
    const d = deriveCategoryFromMovement(mov({ inmuebleId: '32', familia: undefined }));

    expect(d).not.toBeNull();
    expect(d?.inmuebleId).toBe('32');
    expect(d?.ambito).toBe('inmueble');
    expect(d?.familia).toBeUndefined();
  });

  it('solo la familia, como siempre', () => {
    expect(deriveCategoryFromMovement(mov({ familia: 'suministro' }))?.familia).toBe('suministro');
  });

  it('sin familia y sin piso no hay nada · «personal» es lo que ya se supone', () => {
    expect(deriveCategoryFromMovement(mov({ ambito: 'personal' }))).toBeNull();
  });

  it('lo mismo para un previsto', () => {
    const soloPiso = { inmuebleId: 32, ambito: 'inmueble' } as unknown as TreasuryEvent;
    expect(deriveCategoryFromEvent(soloPiso)?.inmuebleId).toBe('32');
    expect(deriveCategoryFromEvent({} as TreasuryEvent)).toBeNull();
  });
});

describe('cuando no se puede aprender, se dice', () => {
  const avisos: unknown[][] = [];
  let original: typeof console.warn;

  beforeEach(() => {
    avisos.length = 0;
    original = console.warn;
    console.warn = (...args: unknown[]) => { avisos.push(args); };
  });
  afterEach(() => { console.warn = original; });

  it('un concepto sin con qué agrupar deja aviso, no silencio', async () => {
    // Una palabra y sin nombre de nadie: no hay clave posible, y está bien que
    // no la haya — lo que no puede ser es que no se entere nadie.
    await feedLearningRule(mov({ description: 'BOTEMANIA' }), { familia: 'ocio', ambito: 'personal' });

    expect(avisos).toHaveLength(1);
    expect(String(avisos[0][0])).toContain('no se ha aprendido nada');
    expect(avisos[0][1]).toMatchObject({ concepto: 'BOTEMANIA' });
  });

  it('un concepto con nombre SÍ se aprende · no avisa de nada', async () => {
    await feedLearningRule(
      mov({ description: 'Bizum A Favor De Victor Lada Horrillo' }),
      { familia: 'ocio', ambito: 'personal' }
    );

    expect(avisos).toHaveLength(0);
  });
});
