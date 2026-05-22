import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TabTablero from '../TabTablero';
import type { Contract, Property } from '../../../../../services/db';

const mockToast = jest.fn();
jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: (m: string) => mockToast(m) };
});

const HOY = new Date();
const day = (n: number): string => {
  const d = new Date(HOY.getTime() + n * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

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

const aliasMap = new Map<number, string>([[1, 'Casa 1']]);

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe('TabTablero', () => {
  beforeEach(() => mockToast.mockReset());

  test('caso Jose · todo silencioso · empty state "Todo en calma"', () => {
    const cs = Array.from({ length: 6 }, (_, i) => contract(i + 1));
    render(
      wrap(
        <TabTablero
          contratos={cs}
          properties={[property(1, 6)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    expect(screen.getByText('Todo en calma')).toBeInTheDocument();
  });

  test('contrato vence en 5 días · bloque Urgente hoy visible', () => {
    const cs = [contract(1, { fechaFin: day(5) })];
    render(
      wrap(
        <TabTablero
          contratos={cs}
          properties={[property(1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    // "Urgente hoy" aparece en cabecera (label) y en el header del bloque
    expect(screen.getAllByText('Urgente hoy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Vencen en menos de 15 días')).toBeInTheDocument();
    expect(screen.getByText(/Vence en 5 d/)).toBeInTheDocument();
  });

  test('habitación libre · subgrupo "Habitación libre sin candidato"', () => {
    // 2 bedrooms · 0 contratos · 2 libres
    render(
      wrap(
        <TabTablero
          contratos={[]}
          properties={[property(1, 2)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    expect(screen.getByText('Habitación libre sin candidato')).toBeInTheDocument();
  });

  test('bloque Planificar usa lista compacta · botón "Sondear →" lanza toast T4.2', () => {
    const cs = [contract(1, { fechaFin: day(60) })];
    render(
      wrap(
        <TabTablero
          contratos={cs}
          properties={[property(1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    expect(screen.getAllByText('Planificar este mes').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: /Sondear/ }));
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('T4.2'));
  });

  test('renovación reciente · bloque Buenas noticias con footer analítico', () => {
    const cs = [contract(1, {
      historicoRentas: [
        { fechaDesde: day(-10), importe: 850, origen: 'renegociacion' },
      ],
    })];
    render(
      wrap(
        <TabTablero
          contratos={cs}
          properties={[property(1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    expect(screen.getAllByText('Buenas noticias').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tasa renovación YTD')).toBeInTheDocument();
    expect(screen.getByText(/Duración media/)).toBeInTheDocument();
  });

  test('nota silenciosos · link a Activos llama callback', () => {
    const onSwitch = jest.fn();
    const cs = [
      contract(1, { fechaFin: day(5) }), // urgente
      contract(2, { id: 2, fechaFin: '2099-12-31' }), // silencioso
    ];
    render(
      wrap(
        <TabTablero
          contratos={cs}
          properties={[property(1, 2)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={onSwitch}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Activos' }));
    expect(onSwitch).toHaveBeenCalled();
  });

  test('cabecera muestra 4 contadores con labels correctos', () => {
    const cs = [
      contract(1, { fechaFin: day(5) }), // urgente
      contract(2, { id: 2, fechaFin: day(20) }), // decisión
      contract(3, { id: 3, fechaFin: day(60) }), // planificar
    ];
    render(
      wrap(
        <TabTablero
          contratos={cs}
          properties={[property(1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    expect(screen.getByLabelText(/Urgente hoy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Decisión esta semana/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Planificar este mes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Buenas noticias/i)).toBeInTheDocument();
  });

  test('botón "+ Nuevo contrato" en habitación libre llama callback con inmuebleId', () => {
    const onNuevo = jest.fn();
    render(
      wrap(
        <TabTablero
          contratos={[]}
          properties={[property(1, 1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={onNuevo}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo contrato' }));
    expect(onNuevo).toHaveBeenCalledWith(1);
  });

  test('click en card de vencimiento abre drawer ficha contrato', () => {
    const cs = [contract(1, { fechaFin: day(5) })];
    render(
      wrap(
        <TabTablero
          contratos={cs}
          properties={[property(1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    fireEvent.click(screen.getByLabelText(/Vencimiento · Juan Calvo/));
    // El drawer ficha contrato renderiza "Contrato de alquiler"
    expect(screen.getByText('Contrato de alquiler')).toBeInTheDocument();
  });

  test('botón "Proponer renovación" lanza toast T4.2', () => {
    const cs = [contract(1, { fechaFin: day(20) })];
    render(
      wrap(
        <TabTablero
          contratos={cs}
          properties={[property(1)]}
          inmuebleAliasById={aliasMap}
          onSwitchTabActivos={() => {}}
          onNuevoContrato={() => {}}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Proponer renovación' }));
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('T4.2'));
  });
});
