import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TablaActivos from '../TablaActivos';
import TabProximos from '../TabProximos';
import TabAnalisis from '../TabAnalisis';
import type { Contract, Property } from '../../../../../services/db';

// Regla global 1 · CERO emojis pictográficos · solo iconos Lucide.
// → (U+2192), ▲ (U+25B2) y ⋯ (U+22EF) quedan fuera de estos rangos · tolerados.
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u;

const contract = (
  id: number,
  overrides: Partial<Contract> = {},
): Contract & { id: number } =>
  ({
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: {
      nombre: 'Juan',
      apellidos: 'Calvo',
      dni: '1',
      telefono: '600111222',
      email: 'j@c.es',
    },
    fechaInicio: '2024-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 800,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 800,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract & { id: number };

const property = (id: number, bedrooms = 1): Property =>
  ({
    id,
    alias: `Casa ${id}`,
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '2020-01-01',
    squareMeters: 50,
    bedrooms,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 100000 },
    documents: [],
  }) as Property;

const aliasMap = new Map<number, string>([[1, 'Casa 1']]);
const day = (n: number): string => {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

describe('Contratos · cero emojis pictográficos', () => {
  it('TablaActivos no contiene ningún emoji pictográfico', () => {
    const { container } = render(
      <TablaActivos
        contratos={[
          contract(1),
          contract(2, { unidadTipo: 'habitacion', habitacionId: 'hab-3' }),
        ]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(container.textContent ?? '').not.toMatch(EMOJI_REGEX);
  });

  it('TabProximos no contiene ningún emoji pictográfico', () => {
    const { container } = render(
      <MemoryRouter>
        <TabProximos
          contratos={[contract(1, { fechaInicio: day(12), fechaFin: day(400) })]}
          inmuebleAliasById={aliasMap}
        />
      </MemoryRouter>,
    );
    expect(container.textContent ?? '').not.toMatch(EMOJI_REGEX);
  });

  it('TabAnalisis (4 bloques) no contiene ningún emoji pictográfico', () => {
    const { container } = render(
      <TabAnalisis
        contratos={[
          contract(1),
          contract(2, { unidadTipo: 'habitacion', habitacionId: 'hab-3' }),
        ]}
        properties={[property(1, 3)]}
      />,
    );
    expect(container.textContent ?? '').not.toMatch(EMOJI_REGEX);
  });
});
