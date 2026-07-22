// Tests · SupuestosPanel (C-PROY-5 · Fase B5)

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SupuestosPanel from '../SupuestosPanel';
import { SUPUESTOS_PROYECCION_DEFAULTS } from '../../../../types/supuestosProyeccion';
import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';

const compromisoConVariacion = {
  id: 9,
  ambito: 'inmueble',
  inmuebleId: 7,
  alias: 'Comunidad Sol',
  tipo: 'comunidad',
  proveedor: { nombre: 'CP Sol' },
  patron: { tipo: 'mensualDiaFijo', dia: 5 },
  importe: { modo: 'fijo', importe: 100 },
  variacion: { tipo: 'aniversarioContrato', mesAniversario: 1, porcentajeAnual: 4 },
  cuentaCargo: 1,
  conceptoBancario: 'CP SOL',
  metodoPago: 'domiciliacion',
  categoria: 'inmueble.comunidad',
  bolsaPresupuesto: 'inmueble',
  responsable: 'titular',
  fechaInicio: '2024-01-01',
  estado: 'activo',
  createdAt: '',
  updatedAt: '',
} as unknown as CompromisoRecurrente;

describe('SupuestosPanel', () => {
  it('pinta los 3 mandos de impacto con su default visible y los 4 secundarios plegados', () => {
    const onCambio = jest.fn();
    render(
      <SupuestosPanel
        valores={SUPUESTOS_PROYECCION_DEFAULTS}
        onCambio={onCambio}
        compromisos={[]}
      />,
    );

    expect(screen.getByLabelText(/Revalorización de inmuebles/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subida de rentas/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Inflación de gastos/)).toBeInTheDocument();
    // Default visible aunque no se haya tocado
    expect(screen.getByText('por defecto 3,0 %')).toBeInTheDocument();
    // Secundarios existen (dentro del details plegado)
    expect(screen.getByLabelText(/Vacancia/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rentabilidad del ahorro/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subida de nómina/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subida ingresos autónomo/)).toBeInTheDocument();
  });

  it('mover un mando emite onCambio con campo y valor', () => {
    const onCambio = jest.fn();
    render(
      <SupuestosPanel
        valores={SUPUESTOS_PROYECCION_DEFAULTS}
        onCambio={onCambio}
        compromisos={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Revalorización de inmuebles/), {
      target: { value: '4' },
    });
    expect(onCambio).toHaveBeenCalledWith('revalorizacionInmueblesPct', 4);
  });

  it('la nota fiscal honesta está siempre presente', () => {
    render(
      <SupuestosPanel
        valores={SUPUESTOS_PROYECCION_DEFAULTS}
        onCambio={jest.fn()}
        compromisos={[]}
      />,
    );
    expect(
      screen.getByText(/Ningún supuesto fiscal a futuro está incluido todavía/),
    ).toBeInTheDocument();
  });

  it('lista los compromisos que sobrescriben la inflación · o lo dice si no hay ninguno', () => {
    const { rerender } = render(
      <SupuestosPanel
        valores={SUPUESTOS_PROYECCION_DEFAULTS}
        onCambio={jest.fn()}
        compromisos={[compromisoConVariacion]}
      />,
    );
    expect(screen.getByText('Comunidad Sol')).toBeInTheDocument();
    expect(screen.getByText(/\+4 %\/año \(aniversario\)/)).toBeInTheDocument();

    rerender(
      <SupuestosPanel
        valores={SUPUESTOS_PROYECCION_DEFAULTS}
        onCambio={jest.fn()}
        compromisos={[]}
      />,
    );
    expect(
      screen.getByText(/Ningún gasto recurrente sobrescribe la inflación global/),
    ).toBeInTheDocument();
  });
});
