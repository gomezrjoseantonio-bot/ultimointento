import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TabDisponibilidad from '../TabDisponibilidad';
import type { Contract, Property } from '../../../../../services/db';

const prop = (
  id: number,
  alias: string,
  bedrooms: number,
  overrides: Partial<Property> = {},
): Property =>
  ({
    id,
    alias,
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
    ...overrides,
  }) as Property;

const c = (id: number, overrides: Partial<Contract> = {}): Contract & { id: number } =>
  ({
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '', telefono: '', email: '' },
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
    cuentaCobroId: 0,
    estadoContrato: 'activo',
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract & { id: number };

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe('TabDisponibilidad', () => {
  test('empty state global cuando no hay propiedades alquilables', () => {
    const onIr = jest.fn();
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={onIr}
        />,
      ),
    );
    expect(screen.getByText('Sin propiedades alquilables')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ir a Inmuebles/i }));
    expect(onIr).toHaveBeenCalled();
  });

  test('render con 1 propiedad de 1 habitación · cabecera "1 unidades"', () => {
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 1)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    expect(screen.getByText(/1 unidades/)).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
    expect(screen.getByText('Piso')).toBeInTheDocument();
  });

  test('propiedad bedrooms=5 con contratos por habitación · 5 líneas Hab', () => {
    const contratos = [
      c(1, { unidadTipo: 'habitacion', habitacionId: 'hab-1' }),
      c(2, { unidadTipo: 'habitacion', habitacionId: 'hab-2' }),
    ];
    render(
      wrap(
        <TabDisponibilidad
          contratos={contratos}
          properties={[prop(1, 'FA32', 5)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    expect(screen.getByText('Hab 1')).toBeInTheDocument();
    expect(screen.getByText('Hab 5')).toBeInTheDocument();
  });

  test('toggle 3m/6m/12m cambia el rango activo', () => {
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 1)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    expect(screen.getByText(/próximos 6 meses/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '3 m' }));
    expect(screen.getByText(/próximos 3 meses/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '12 m' }));
    expect(screen.getByText(/próximos 12 meses/)).toBeInTheDocument();
  });

  test('línea HOY visible cuando hoy está en el rango', () => {
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 1)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    expect(screen.getByText('HOY')).toBeInTheDocument();
  });

  test('leyenda renderiza con 6 items', () => {
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 1)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    expect(screen.getByText(/Vigente · larga/)).toBeInTheDocument();
    expect(screen.getByText(/Renovado · últimos 30 d/)).toBeInTheDocument();
    expect(screen.getByText(/Libre · click para crear contrato/)).toBeInTheDocument();
  });

  test('click en barra de contrato abre drawer ficha contrato', () => {
    const ct = c(1, { unidadTipo: 'habitacion', habitacionId: 'hab-1' });
    render(
      wrap(
        <TabDisponibilidad
          contratos={[ct]}
          properties={[prop(1, 'Casa', 2)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    const bar = screen.getByRole('button', { name: /Juan Calvo/ });
    fireEvent.click(bar);
    // DrawerFichaContrato renderiza "Contrato de alquiler"
    expect(screen.getByText('Contrato de alquiler')).toBeInTheDocument();
  });

  test('click en hueco libre llama onNuevoContrato con inmuebleId', () => {
    const onNuevo = jest.fn();
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 1)]}
          onNuevoContrato={onNuevo}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    // El segmento libre tiene aria-label que empieza con "libre"
    const libre = screen.getAllByRole('button').find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('libre'),
    );
    expect(libre).toBeDefined();
    fireEvent.click(libre!);
    expect(onNuevo).toHaveBeenCalledWith(1);
  });

  test('propiedad sin bedrooms · CTA "Configurar inmueble"', () => {
    const onIr = jest.fn();
    const sinBedrooms = { ...prop(1, 'X', 0), bedrooms: undefined } as unknown as Property;
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[sinBedrooms]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={onIr}
        />,
      ),
    );
    expect(
      screen.getByText(/Indica el número de habitaciones/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Configurar inmueble/ }));
    expect(onIr).toHaveBeenCalled();
  });
});
