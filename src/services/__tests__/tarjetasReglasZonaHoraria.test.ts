// El ciclo de la tarjeta, visto desde MADRID.
//
// Este candado existe porque el resto de la suite no podía cazar el fallo: CI
// corre en UTC y el navegador de Jose está en UTC+1/+2. Construir la fecha con
// medianoche LOCAL y devolverla con `toISOString()` la corre un día hacia atrás
// —la medianoche del 24 en Madrid son las 22:00 del 23 en UTC—, así que todos
// los cargos habrían salido un día antes, y solo en producción.
//
// La zona se fija ANTES de importar el módulo. Si el cálculo vuelve a mezclar
// hora local con ISO, estas mismas cifras dejan de salir.

process.env.TZ = 'Europe/Madrid';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { corteQueLeToca, cuandoSeCobra } = require('../tarjetasReglas');

const del25al24 = {
  periodicidad: 'mensual' as const,
  corte: 24,
  diaCargo: 31,
  periodosHastaElCargo: 0,
};

const semanal = {
  periodicidad: 'semanal' as const,
  corte: 7,
  diaCargo: 1,
  periodosHastaElCargo: 0,
};

describe('en UTC+2 las fechas no se corren un día', () => {
  it('la medianoche local no adelanta el corte', () => {
    expect(corteQueLeToca(del25al24, '2026-07-20')).toBe('2026-07-24');
  });

  it('ni el cargo', () => {
    expect(cuandoSeCobra(del25al24, '2026-07-24')).toBe('2026-07-31');
  });

  // En invierno el desfase es +1 en vez de +2 · el resultado no puede depender
  // de eso, ni del día en que cambia la hora.
  it('tampoco en horario de invierno', () => {
    expect(corteQueLeToca(del25al24, '2026-01-20')).toBe('2026-01-24');
    expect(cuandoSeCobra(del25al24, '2026-01-24')).toBe('2026-01-31');
  });

  it('el corte semanal cae en su día, no en la víspera', () => {
    // 2026-07-08 es miércoles · el domingo de esa semana es el 12.
    expect(corteQueLeToca(semanal, '2026-07-08')).toBe('2026-07-12');
    expect(cuandoSeCobra(semanal, '2026-07-12')).toBe('2026-07-13');
  });
});
