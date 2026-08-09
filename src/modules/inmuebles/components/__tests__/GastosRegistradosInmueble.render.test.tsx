import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GastosRegistradosInmueble, {
  registroInmuebleBloqueado,
} from '../GastosRegistradosInmueble';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../../services/db';

const gasto = (over: Partial<GastoInmueble> = {}): GastoInmueble => ({
  id: 1,
  inmuebleId: 10,
  fecha: '2026-03-01',
  concepto: 'Agua',
  importe: 45,
  categoria: 'suministro',
  casillaAEAT: '0113',
  estado: 'confirmado',
  ejercicio: 2026,
  origen: 'manual',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...over,
});

const mejora = (over: Partial<MejoraInmueble> = {}): MejoraInmueble => ({
  id: 2,
  inmuebleId: 10,
  fecha: '2026-04-01',
  descripcion: 'Reforma cocina',
  importe: 3000,
  tipo: 'mejora',
  ejercicio: 2026,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...over,
});

const mueble = (over: Partial<MuebleInmueble> = {}): MuebleInmueble => ({
  id: 3,
  inmuebleId: 10,
  descripcion: 'Sofá',
  importe: 500,
  fechaAlta: '2026-05-01',
  activo: true,
  vidaUtil: 10,
  ejercicio: 2026,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('registroInmuebleBloqueado', () => {
  it('bloquea por ejercicio declarado/prescrito', () => {
    expect(registroInmuebleBloqueado({ tipo: 'real', registro: gasto() }, [2026])).toBe(true);
    expect(registroInmuebleBloqueado({ tipo: 'mejora', registro: mejora() }, [2026])).toBe(true);
    expect(registroInmuebleBloqueado({ tipo: 'mobiliario', registro: mueble() }, [])).toBe(false);
  });

  it('bloquea gasto real de origen XML AEAT', () => {
    expect(
      registroInmuebleBloqueado({ tipo: 'real', registro: gasto({ origen: 'xml_aeat' }) }, []),
    ).toBe(true);
  });

  it('bloquea gasto real ya declarado', () => {
    expect(
      registroInmuebleBloqueado({ tipo: 'real', registro: gasto({ estado: 'declarado' }) }, []),
    ).toBe(true);
  });
});

describe('GastosRegistradosInmueble · operativa', () => {
  it('sin callbacks es solo consulta (sin botones ni bloqueo)', () => {
    render(
      <GastosRegistradosInmueble inmuebleId={10} gastosReales={[gasto()]} mejoras={[mejora()]} />,
    );
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Bloqueado/i)).not.toBeInTheDocument();
  });

  it('muestra editar/borrar por fila cuando hay callbacks', () => {
    render(
      <GastosRegistradosInmueble
        inmuebleId={10}
        gastosReales={[gasto()]}
        mejoras={[mejora()]}
        mobiliario={[mueble()]}
        onEditar={jest.fn()}
        onBorrar={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Editar Agua' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar Agua' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Reforma cocina' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Sofá' })).toBeInTheDocument();
  });

  it('invoca onEditar con la referencia tipada de la fila', () => {
    const onEditar = jest.fn();
    render(
      <GastosRegistradosInmueble
        inmuebleId={10}
        gastosReales={[gasto()]}
        onEditar={onEditar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar Agua' }));
    expect(onEditar).toHaveBeenCalledWith({ tipo: 'real', registro: expect.objectContaining({ id: 1 }) });
  });

  it('bloquea las filas de un ejercicio declarado', () => {
    render(
      <GastosRegistradosInmueble
        inmuebleId={10}
        gastosReales={[gasto()]}
        ejerciciosBloqueados={[2026]}
        onEditar={jest.fn()}
        onBorrar={jest.fn()}
      />,
    );
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Borrar/i })).not.toBeInTheDocument();
  });

  it('bloquea gastos de origen XML aunque el ejercicio esté abierto', () => {
    render(
      <GastosRegistradosInmueble
        inmuebleId={10}
        gastosReales={[gasto({ origen: 'xml_aeat' })]}
        onEditar={jest.fn()}
        onBorrar={jest.fn()}
      />,
    );
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
  });
});
