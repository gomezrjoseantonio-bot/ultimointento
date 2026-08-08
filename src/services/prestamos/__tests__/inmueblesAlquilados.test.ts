// Qué inmuebles estuvieron alquilados en un ejercicio · la pregunta que decide
// si los intereses de un préstamo reducen el IRPF.
//
// Antes no se hacía: bastaba con que el destino del capital fuera «adquisición»
// *(Jose · 8 ago 2026: «la deducción fiscal de un préstamo la genera si el
// inmueble está alquilado, no si el destino es adquisición»)*.

import { inmueblesAlquiladosEn } from '../inmueblesAlquilados';
import { initDB } from '../../db';

jest.mock('../../db', () => ({ initDB: jest.fn() }));

const contrato = (over: Record<string, unknown> = {}) => ({
  id: 1,
  inmuebleId: 7,
  fechaInicio: '2024-01-01',
  fechaFin: '2028-12-31',
  estadoContrato: 'activo',
  ...over,
});

const conContratos = (contratos: unknown[]): void => {
  (initDB as jest.Mock).mockResolvedValue({ getAll: jest.fn().mockResolvedValue(contratos) });
};

describe('cuenta el que alquiló de verdad', () => {
  it('un contrato activo que cubre el año', async () => {
    conContratos([contrato()]);

    expect(await inmueblesAlquiladosEn(2026)).toEqual(new Set(['7']));
  });

  // El id llega numérico de los contratos y en texto de los destinos de un
  // préstamo · compararlos sin normalizar es la frontera donde el dato se tira.
  it('y lo devuelve en texto, que es como lo guarda el préstamo', async () => {
    conContratos([contrato({ inmuebleId: 7 })]);
    const alquilados = await inmueblesAlquiladosEn(2026);

    expect(alquilados.has('7')).toBe(true);
  });

  // Un contrato que terminó en junio produjo renta hasta junio · ese año se
  // declara igual, y los intereses de esos meses deducen.
  it('un contrato finalizado dentro del año también cuenta', async () => {
    conContratos([
      contrato({ estadoContrato: 'finalizado', fechaInicio: '2023-01-01', fechaFin: '2026-06-30' }),
    ]);

    expect(await inmueblesAlquiladosEn(2026)).toEqual(new Set(['7']));
  });

  it('sin fecha de fin apuntada, sigue vivo · no se inventa un final', async () => {
    conContratos([contrato({ fechaFin: undefined })]);

    expect(await inmueblesAlquiladosEn(2030)).toEqual(new Set(['7']));
  });
});

describe('y no cuenta lo que no fue un alquiler', () => {
  it('un año anterior al contrato no cuenta', async () => {
    conContratos([contrato({ fechaInicio: '2025-03-01' })]);

    expect(await inmueblesAlquiladosEn(2024)).toEqual(new Set());
  });

  it('un año posterior a su fin, tampoco', async () => {
    conContratos([contrato({ fechaFin: '2025-12-31' })]);

    expect(await inmueblesAlquiladosEn(2026)).toEqual(new Set());
  });

  // `sin_identificar` y `sin_firmar` son marcadores del importador, no
  // arrendamientos. Un rescindido terminó antes de su `fechaFin` sin que se
  // apunte cuándo, así que contarlo hasta esa fecha alargaría el alquiler más
  // de lo que duró.
  it.each(['sin_identificar', 'sin_firmar', 'rescindido'])('ni un contrato %s', async (estado) => {
    conContratos([contrato({ estadoContrato: estado })]);

    expect(await inmueblesAlquiladosEn(2026)).toEqual(new Set());
  });
});

// Afirmar una deducción porque no se pudo comprobar sería poner un número en la
// renta de alguien · el lado por el que hay que equivocarse es el otro.
describe('si no se puede leer, no se afirma nada', () => {
  it('un fallo de base de datos deja el conjunto vacío', async () => {
    (initDB as jest.Mock).mockRejectedValue(new Error('sin base'));

    expect(await inmueblesAlquiladosEn(2026)).toEqual(new Set());
  });
});
