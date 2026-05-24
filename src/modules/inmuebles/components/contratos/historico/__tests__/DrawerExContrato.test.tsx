import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { Contract } from '../../../../../../services/db';
import DrawerExContrato from '../DrawerExContrato';

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{22EE}-\u{22EF}]/u;

const c = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 1,
    inmuebleId: 1,
    unidadTipo: 'habitacion',
    habitacionId: 'hab-1',
    modalidad: 'habitual',
    inquilino: { nombre: 'Luis', apellidos: 'Pérez', dni: '11111111H', telefono: '600100200', email: 'luis@x.com' },
    fechaInicio: '2022-01-01',
    fechaFin: '2024-01-01',
    fechaCierre: '2024-01-01',
    rentaMensual: 850,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 850,
    fianzaEstado: 'devuelta_total',
    cuentaCobroId: 0,
    estadoContrato: 'finalizado',
    motivoFin: 'rescision_impago',
    valoracion: 2,
    fianzaDevuelta: 850,
    ...overrides,
  }) as Contract;

describe('DrawerExContrato', () => {
  it('hero muestra stats inline (Duró · Salió · Valoración)', () => {
    render(<DrawerExContrato contrato={c()} inmuebleAlias="FA32" open onClose={() => {}} />);
    expect(screen.getByText('Duró')).toBeInTheDocument();
    expect(screen.getByText('Salió')).toBeInTheDocument();
    expect(screen.getByText('Valoración')).toBeInTheDocument();
  });

  it('sección ex-inquilino con botones de contacto', () => {
    render(<DrawerExContrato contrato={c()} open onClose={() => {}} />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Invitar a volver')).toBeInTheDocument();
  });

  it('resumen incluye fianza devuelta y ¿volverías?', () => {
    render(<DrawerExContrato contrato={c()} open onClose={() => {}} />);
    expect(screen.getByText('Fianza devuelta')).toBeInTheDocument();
    expect(screen.getByText('¿Volverías a alquilarle?')).toBeInTheDocument();
  });

  it('sin volveriaAAlquilar muestra "— sin respuesta"', () => {
    render(<DrawerExContrato contrato={c({ volveriaAAlquilar: undefined })} open onClose={() => {}} />);
    expect(screen.getByText('— sin respuesta')).toBeInTheDocument();
  });

  it('caja motivo de salida con título según motivo', () => {
    render(<DrawerExContrato contrato={c()} open onClose={() => {}} />);
    expect(screen.getByText('Rescisión por impago')).toBeInTheDocument();
  });

  it('historial de pagos muestra mensaje cuando no hay servicio', () => {
    render(<DrawerExContrato contrato={c()} open onClose={() => {}} />);
    expect(screen.getByText(/módulo de cobros/)).toBeInTheDocument();
  });

  it('footer con 3 botones', () => {
    render(<DrawerExContrato contrato={c()} open onClose={() => {}} />);
    expect(screen.getByText('Cerrar')).toBeInTheDocument();
    expect(screen.getByText('Descargar contrato')).toBeInTheDocument();
    expect(screen.getByText('Reactivar contrato')).toBeInTheDocument();
  });

  it('no usa ningún emoji ni carácter icon-like', () => {
    const { container } = render(<DrawerExContrato contrato={c()} open onClose={() => {}} />);
    expect(container.textContent ?? '').not.toMatch(EMOJI_REGEX);
  });

  it('no renderiza nada cuando open=false', () => {
    const { container } = render(<DrawerExContrato contrato={c()} open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
