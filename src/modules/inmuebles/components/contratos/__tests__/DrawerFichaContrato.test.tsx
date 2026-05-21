import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DrawerFichaContrato from '../DrawerFichaContrato';
import type { Contract } from '../../../../../services/db';

const mockToast = jest.fn();
jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: (m: string) => mockToast(m) };
});

const contrato: Contract & { id: number } = {
  id: 1,
  inmuebleId: 7,
  unidadTipo: 'vivienda',
  modalidad: 'habitual',
  inquilino: {
    nombre: 'Laura',
    apellidos: 'Sanz',
    dni: '99887766X',
    telefono: '600123456',
    email: 'laura@example.com',
  },
  fechaInicio: '2024-01-01',
  fechaFin: '2099-12-31',
  rentaMensual: 950,
  diaPago: 5,
  margenGraciaDias: 5,
  indexacion: 'none',
  historicoIndexaciones: [],
  fianzaMeses: 1,
  fianzaImporte: 950,
  fianzaEstado: 'retenida',
  cuentaCobroId: 1,
  estadoContrato: 'activo',
  firma: { metodo: 'digital', estado: 'firmado' },
} as Contract & { id: number };

describe('DrawerFichaContrato', () => {
  beforeEach(() => mockToast.mockReset());

  test('no renderiza cuando open=false', () => {
    render(
      <DrawerFichaContrato
        contrato={contrato}
        open={false}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText('Laura Sanz')).toBeNull();
  });

  test('renderiza ficha con nombre, alias inmueble y pill estado', () => {
    render(
      <DrawerFichaContrato
        contrato={contrato}
        inmuebleAlias="Uría 14"
        open
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Laura Sanz')).toBeInTheDocument();
    expect(screen.getByText(/Uría 14/)).toBeInTheDocument();
    expect(screen.getByText('Al día')).toBeInTheDocument();
  });

  test('cambio a tab Actividad muestra placeholder', () => {
    render(
      <DrawerFichaContrato contrato={contrato} open onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Actividad/ }));
    expect(screen.getByText('Registro de actividad próximamente')).toBeInTheDocument();
  });

  test('ESC invoca onClose', () => {
    const onClose = jest.fn();
    render(
      <DrawerFichaContrato contrato={contrato} open onClose={onClose} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('botón "Editar datos" muestra toast', () => {
    render(
      <DrawerFichaContrato contrato={contrato} open onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Editar datos/ }));
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('T3.2'));
  });

  test('botón Renovar (al-dia) muestra toast T4', () => {
    render(
      <DrawerFichaContrato contrato={contrato} open onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Renovar/ }));
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('T4'));
  });

  test('contrato sin firmar · botón cambia a "Enviar a firma"', () => {
    const sinFirma = { ...contrato, firma: undefined, fechaFirmaContrato: undefined };
    render(
      <DrawerFichaContrato contrato={sinFirma} open onClose={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Enviar a firma/ })).toBeInTheDocument();
  });
});
