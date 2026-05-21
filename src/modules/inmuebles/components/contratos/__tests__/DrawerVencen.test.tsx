import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DrawerVencen from '../DrawerVencen';
import type { ContratoConVencimiento } from '../../../utils/filtrosVencimiento';
import type { Contract } from '../../../../../services/db';

const mockShowToast = jest.fn();
jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: (m: string) => mockShowToast(m) };
});

const contract = (
  id: number,
  diasRestantes: number,
  overrides: Partial<Contract> = {},
): ContratoConVencimiento => ({
  contrato: {
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'L', apellidos: 'Sanz', dni: '', telefono: '', email: '' },
    fechaInicio: '2024-01-01',
    fechaFin: '2026-06-15',
    rentaMensual: 750,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 750,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    ...overrides,
  } as Contract & { id: number },
  diasRestantes,
  inquilinoNombre: 'L. Sanz',
  inmuebleId: 1,
  rentaMensual: 750,
  modalidad: 'habitual',
});

const aliasMap = new Map<number, string>([[1, 'Uría 14']]);

describe('DrawerVencen', () => {
  beforeEach(() => mockShowToast.mockReset());

  test('variant d30 · hero label "Decisión urgente" · render filas', () => {
    render(
      <DrawerVencen
        variant="d30"
        open
        onClose={() => {}}
        contratos={[contract(1, 15), contract(2, 25)]}
        inmuebleAliasById={aliasMap}
      />,
    );
    expect(screen.getByText('Decisión urgente')).toBeInTheDocument();
    expect(screen.getByText(/Vencen en 30 días · 2 contratos/)).toBeInTheDocument();
    expect(screen.getAllByText(/L\. Sanz · Uría 14/)).toHaveLength(2);
    expect(screen.getAllByText('15 d').length).toBeGreaterThan(0);
    expect(screen.getByText('25 d')).toBeInTheDocument();
  });

  test('variant d3090 · hero label "Planificar"', () => {
    render(
      <DrawerVencen
        variant="d3090"
        open
        onClose={() => {}}
        contratos={[contract(1, 45)]}
        inmuebleAliasById={aliasMap}
      />,
    );
    expect(screen.getAllByText('Planificar').length).toBeGreaterThan(0);
    expect(screen.getByText(/Vencen en 30-90 días · 1 contrato/)).toBeInTheDocument();
  });

  test('empty state cuando no hay contratos', () => {
    render(
      <DrawerVencen
        variant="d30"
        open
        onClose={() => {}}
        contratos={[]}
        inmuebleAliasById={aliasMap}
      />,
    );
    expect(screen.getByText('Sin contratos en este rango')).toBeInTheDocument();
  });

  test('botón fila Proponer renovación lanza toast proximamente', () => {
    render(
      <DrawerVencen
        variant="d30"
        open
        onClose={() => {}}
        contratos={[contract(1, 10)]}
        inmuebleAliasById={aliasMap}
      />,
    );
    const fila = screen.getByRole('button', { name: 'Proponer renovación' });
    fireEvent.click(fila);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Funcionalidad disponible próximamente desde el Tablero',
    );
  });

  test('botón footer primary lanza toast cuando hay contratos', () => {
    render(
      <DrawerVencen
        variant="d3090"
        open
        onClose={() => {}}
        contratos={[contract(1, 60)]}
        inmuebleAliasById={aliasMap}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Agendar reuniones' }));
    expect(mockShowToast).toHaveBeenCalled();
  });

  test('footer primary NO renderiza en empty state', () => {
    render(
      <DrawerVencen
        variant="d30"
        open
        onClose={() => {}}
        contratos={[]}
        inmuebleAliasById={aliasMap}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Enviar renovación a todos' })).toBeNull();
  });
});
