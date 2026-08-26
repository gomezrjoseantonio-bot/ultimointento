import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TabDisponibilidad from '../TabDisponibilidad';
import type { Contract, Property, ExplotacionAlquiler } from '../../../../../services/db';
import * as explotacionService from '../../../../../services/explotacionAlquilerService';

// La pestaña carga las explotaciones desde el servicio (IndexedDB); se mockea
// para controlar qué inmuebles están marcados como alquilables en cada test.
jest.mock('../../../../../services/explotacionAlquilerService');

const mockService = explotacionService as jest.Mocked<typeof explotacionService>;

/** Marca por defecto todos los inmuebles como alquilables (modo completo). */
let explotacionesActuales: Map<number, ExplotacionAlquiler> = new Map();
const explotacion = (
  inmuebleId: number,
  over: Partial<ExplotacionAlquiler> = {},
): ExplotacionAlquiler => ({
  id: inmuebleId,
  inmuebleId,
  modo: 'completo',
  estado: 'operativo',
  createdAt: 'x',
  updatedAt: 'x',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  explotacionesActuales = new Map();
  mockService.getExplotacionesPorInmueble.mockImplementation(
    async () => explotacionesActuales,
  );
  mockService.marcarAlquilable.mockResolvedValue(explotacion(1));
  mockService.actualizarExplotacion.mockResolvedValue(explotacion(1));
  mockService.desmarcarAlquilable.mockResolvedValue(undefined);
  mockService.anadirHabitacion.mockResolvedValue(explotacion(1));
  mockService.actualizarHabitacion.mockResolvedValue(explotacion(1));
  mockService.eliminarHabitacion.mockResolvedValue(explotacion(1));
});

const marcarHabitaciones = (id: number, habitaciones: ExplotacionAlquiler['habitaciones']) => {
  explotacionesActuales = new Map([
    [id, explotacion(id, { modo: 'habitaciones', habitaciones })],
  ]);
};

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
    modalidad: 'larga_estancia',
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

const marcar = (...ids: number[]) => {
  explotacionesActuales = new Map(ids.map((id) => [id, explotacion(id)]));
};

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

  test('render con 1 propiedad marcada de 1 habitación · cabecera "1 unidad"', async () => {
    marcar(1);
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
    expect(await screen.findByText(/1 unidad/)).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
    expect(screen.getByText('Piso')).toBeInTheDocument();
  });

  test('modo habitaciones con 5 habitaciones · una línea por habitación con su nombre', async () => {
    marcarHabitaciones(
      1,
      Array.from({ length: 5 }, (_, i) => ({ id: `hab-${i + 1}`, nombre: `Habitación ${i + 1}` })),
    );
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
    // El nombre sale en la línea de la timeline y en el input del editor.
    expect((await screen.findAllByText('Habitación 1')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Habitación 5').length).toBeGreaterThan(0);
  });

  test('toggle 3m/6m/12m cambia el rango activo', () => {
    marcar(1);
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

  test('click en barra de contrato abre drawer ficha contrato', async () => {
    marcar(1);
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
    const bar = await screen.findByRole('button', { name: /Juan Calvo/ });
    fireEvent.click(bar);
    expect(screen.getByText('Inquilino actual · contrato vigente')).toBeInTheDocument();
  });

  test('click en hueco libre llama onNuevoContrato con inmuebleId', async () => {
    marcar(1);
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
    await screen.findByText('Piso');
    const libre = screen.getAllByRole('button').find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('libre'),
    );
    expect(libre).toBeDefined();
    fireEvent.click(libre!);
    expect(onNuevo).toHaveBeenCalledWith(1);
  });

  test('propiedad marcada completo sin bedrooms · dibuja la línea "Piso" (rooms desde la explotación)', async () => {
    marcar(1); // modo completo · las habitaciones ya no dependen de bedrooms
    const sinBedrooms = { ...prop(1, 'X', 0), bedrooms: undefined } as unknown as Property;
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[sinBedrooms]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    expect(await screen.findByText('Piso')).toBeInTheDocument();
    expect(screen.queryByText(/Indica el número de habitaciones/)).not.toBeInTheDocument();
  });

  // ── R2 · marcar / editar / desmarcar ──────────────────────────────────────

  test('inmueble NO marcado enseña "Poner en alquiler" y no dibuja disponibilidad', () => {
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
    expect(screen.getByRole('button', { name: /Poner en alquiler/ })).toBeInTheDocument();
    expect(screen.getByText(/No está en alquiler/)).toBeInTheDocument();
    expect(screen.queryByText('Piso')).not.toBeInTheDocument();
    expect(screen.getByText(/0 unidades/)).toBeInTheDocument();
  });

  test('"Poner en alquiler" llama a marcarAlquilable con modo completo · vacante', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Poner en alquiler/ }));
    await waitFor(() =>
      expect(mockService.marcarAlquilable).toHaveBeenCalledWith(1, {
        modo: 'completo',
        estado: 'vacante',
      }),
    );
  });

  test('inmueble marcado enseña selects de modo y estado', async () => {
    marcar(1);
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
    const modo = (await screen.findByDisplayValue('Piso completo')) as HTMLSelectElement;
    expect(modo).toBeInTheDocument();
    expect(screen.getByDisplayValue('Operativo')).toBeInTheDocument();

    fireEvent.change(modo, { target: { value: 'habitaciones' } });
    await waitFor(() =>
      expect(mockService.marcarAlquilable).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ modo: 'habitaciones' }),
      ),
    );
  });

  test('cambiar estado llama actualizarExplotacion', async () => {
    marcar(1);
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
    const estado = await screen.findByDisplayValue('Operativo');
    fireEvent.change(estado, { target: { value: 'en_reforma' } });
    await waitFor(() =>
      expect(mockService.actualizarExplotacion).toHaveBeenCalledWith(1, {
        estado: 'en_reforma',
      }),
    );
  });

  test('"Quitar del alquiler" llama desmarcarAlquilable', async () => {
    marcar(1);
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
    const quitar = await screen.findByRole('button', { name: /Quitar del alquiler/ });
    fireEvent.click(quitar);
    await waitFor(() => expect(mockService.desmarcarAlquilable).toHaveBeenCalledWith(1));
  });

  // ── R3 · editor de habitaciones ───────────────────────────────────────────

  test('modo habitaciones · muestra las habitaciones por nombre en la timeline', async () => {
    marcarHabitaciones(1, [
      { id: 'hab-1', nombre: 'Suite', rentaObjetivo: 395 },
      { id: 'hab-2', nombre: 'Exterior' },
    ]);
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 3)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    // El nombre aparece en la línea de la timeline (rowName) y en el input del editor.
    expect((await screen.findAllByText('Suite')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Exterior').length).toBeGreaterThan(0);
  });

  test('editar el nombre de una habitación llama actualizarHabitacion', async () => {
    marcarHabitaciones(1, [{ id: 'hab-1', nombre: 'Suite', rentaObjetivo: 395 }]);
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 3)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    const input = (await screen.findByLabelText('Nombre de Suite')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Máster' } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(mockService.actualizarHabitacion).toHaveBeenCalledWith(1, 'hab-1', {
        nombre: 'Máster',
      }),
    );
  });

  test('editar la renta objetivo llama actualizarHabitacion', async () => {
    marcarHabitaciones(1, [{ id: 'hab-1', nombre: 'Suite', rentaObjetivo: 395 }]);
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 3)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    const renta = (await screen.findByLabelText('Renta objetivo de Suite')) as HTMLInputElement;
    fireEvent.change(renta, { target: { value: '420' } });
    fireEvent.blur(renta);
    await waitFor(() =>
      expect(mockService.actualizarHabitacion).toHaveBeenCalledWith(1, 'hab-1', {
        rentaObjetivo: 420,
      }),
    );
  });

  test('"Añadir habitación" llama anadirHabitacion', async () => {
    marcarHabitaciones(1, [{ id: 'hab-1', nombre: 'Suite' }]);
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 3)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    const add = await screen.findByRole('button', { name: /Añadir habitación/ });
    fireEvent.click(add);
    await waitFor(() => expect(mockService.anadirHabitacion).toHaveBeenCalledWith(1));
  });

  test('quitar una habitación llama eliminarHabitacion', async () => {
    marcarHabitaciones(1, [{ id: 'hab-1', nombre: 'Suite' }]);
    render(
      wrap(
        <TabDisponibilidad
          contratos={[]}
          properties={[prop(1, 'Casa', 3)]}
          onNuevoContrato={() => {}}
          onIrAInmuebles={() => {}}
        />,
      ),
    );
    const quitar = await screen.findByRole('button', { name: /Quitar Suite/ });
    fireEvent.click(quitar);
    await waitFor(() => expect(mockService.eliminarHabitacion).toHaveBeenCalledWith(1, 'hab-1'));
  });
});
