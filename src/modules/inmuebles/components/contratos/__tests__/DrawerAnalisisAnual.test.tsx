import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DrawerAnalisisAnual from '../DrawerAnalisisAnual';
import type { Contract, Property } from '../../../../../services/db';

const prop = (id: number, overrides: Partial<Property> = {}): Property =>
  ({
    id,
    alias: `Casa ${id}`,
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '2020-01-01',
    squareMeters: 60,
    bedrooms: 1,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 100000 },
    documents: [],
    ...overrides,
  }) as Property;

const con = (id: number, overrides: Partial<Contract> = {}): Contract =>
  ({
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '1', telefono: '', email: '' },
    fechaInicio: '2020-01-01',
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
    ...overrides,
  }) as Contract;

describe('DrawerAnalisisAnual', () => {
  it('no renderiza nada cuando open=false', () => {
    const { container } = render(
      <DrawerAnalisisAnual open={false} onClose={() => {}} contratos={[]} properties={[prop(1)]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('abre con título "Ocupación anual" y los 4 stats', () => {
    render(
      <DrawerAnalisisAnual open onClose={() => {}} contratos={[con(1)]} properties={[prop(1)]} />,
    );
    expect(screen.getByText(/Ocupación anual ·/)).toBeInTheDocument();
    expect(screen.getByText('Ocupación media')).toBeInTheDocument();
    expect(screen.getByText('Objetivo')).toBeInTheDocument();
    expect(screen.getByText('Días vacíos proyectados')).toBeInTheDocument();
    expect(screen.getByText('Ingresos perdidos proyectados')).toBeInTheDocument();
  });

  it('renderiza el heatmap completo · 12×31 = 372 celdas', () => {
    render(
      <DrawerAnalisisAnual open onClose={() => {}} contratos={[con(1)]} properties={[prop(1)]} />,
    );
    expect(screen.getAllByRole('gridcell')).toHaveLength(372);
  });

  it('botón cerrar dispara onClose', () => {
    const onClose = jest.fn();
    render(
      <DrawerAnalisisAnual open onClose={onClose} contratos={[con(1)]} properties={[prop(1)]} />,
    );
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tecla Escape cierra el drawer', () => {
    const onClose = jest.fn();
    render(
      <DrawerAnalisisAnual open onClose={onClose} contratos={[con(1)]} properties={[prop(1)]} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('empty state cuando no hay propiedades alquilables', () => {
    render(
      <DrawerAnalisisAnual
        open
        onClose={() => {}}
        contratos={[]}
        properties={[prop(1, { state: 'vendido' })]}
      />,
    );
    expect(screen.getByText('Sin propiedades alquilables')).toBeInTheDocument();
    expect(screen.queryAllByRole('gridcell')).toHaveLength(0);
  });

  it('caso Jose · cartera 100% indefinida · todas las celdas existentes con ocupación llena (aria-label 1/1)', () => {
    render(
      <DrawerAnalisisAnual open onClose={() => {}} contratos={[con(1)]} properties={[prop(1)]} />,
    );
    const ocupadas = screen
      .getAllByRole('gridcell')
      .filter((c) => (c.getAttribute('aria-label') ?? '').includes('1/1'));
    // 365 días reales en 2026 (año no bisiesto)
    expect(ocupadas.length).toBeGreaterThanOrEqual(365);
  });
});
