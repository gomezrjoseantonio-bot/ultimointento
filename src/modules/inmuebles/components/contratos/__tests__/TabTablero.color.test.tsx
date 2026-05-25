import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TabTablero from '../TabTablero';
import type { Contract, Property } from '../../../../../services/db';

const day = (n: number): string => {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

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
const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe('TabTablero · una pieza de color + meta Hab N · INMUEBLE', () => {
  it('ninguna card renderiza chip de habitación junto al avatar coloreado', () => {
    const { container } = render(
      wrap(
        <TabTablero
          contratos={[
            contract(1, { fechaFin: day(5) }),
            contract(2, { id: 2, fechaFin: day(20) }),
          ]}
          properties={[property(1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    // Regla global 2 · una sola pieza de color · el avatar ya está coloreado,
    // por lo que NO debe existir además un chip de habitación coloreado.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('.room-chip')).toHaveLength(0);
  });

  it('card de vencimiento · meta muestra "Piso completo · Casa 1" (sin chip)', () => {
    render(
      wrap(
        <TabTablero
          contratos={[contract(1, { fechaFin: day(5) })]}
          properties={[property(1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    expect(screen.getByText('Piso completo · Casa 1')).toBeInTheDocument();
  });

  it('contrato por habitación · meta muestra "Hab 3 · Casa 1"', () => {
    render(
      wrap(
        <TabTablero
          contratos={[
            contract(1, {
              fechaFin: day(5),
              unidadTipo: 'habitacion',
              habitacionId: 'hab-3',
            }),
          ]}
          properties={[property(1, 3)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    expect(screen.getByText('Hab 3 · Casa 1')).toBeInTheDocument();
  });
});
