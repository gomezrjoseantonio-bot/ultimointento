// Commit 5 · tests del wizard · paso 1 (origen) + paso 2 (subida multi-fichero).
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import ImportarContratosWizard from '../ImportarContratosWizard';

const HEADER_ES = [
  'ID', 'Propiedad', 'Tipo', 'Inicio de alquiler', 'Fin del alquiler',
  'Nombre o compañía', 'Alquiler', 'Alquiler', 'Gastos', 'IVA', 'Fianza', 'Otros gastos',
];

function rentilaXlsxFile(name: string, nContratos: number): File {
  const data = Array.from({ length: nContratos }, (_, i) => [
    '', `Inmueble ${i}`, 'Contrato de arrendamiento de vivienda',
    '01/01/2024', '31/12/2028', `INQUILINO ${i}`, 300 + i, 300 + i, 0, '', 300 + i, 0,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([HEADER_ES, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File([out], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  // jsdom no implementa File.arrayBuffer en todas las versiones · garantizarlo.
  Object.defineProperty(file, 'arrayBuffer', { value: async () => out });
  return file;
}

describe('ImportarContratosWizard', () => {
  it('paso 1 muestra los 3 orígenes con Rentila seleccionado y Otro Excel deshabilitado', () => {
    render(<ImportarContratosWizard onBack={() => {}} onComplete={() => {}} />);

    expect(screen.getByText('Importar contratos de alquiler')).toBeInTheDocument();
    expect(screen.getByText('Rentila')).toBeInTheDocument();
    expect(screen.getByText('Plantilla ATLAS')).toBeInTheDocument();
    expect(screen.getByText('Otro Excel')).toBeInTheDocument();
    expect(screen.getByText('Próximamente')).toBeInTheDocument();

    // El banner de Rentila se muestra por defecto.
    expect(screen.getByText(/Desde Rentila ve a/)).toBeInTheDocument();
  });

  it('cambia a Plantilla ATLAS y oculta el banner Rentila', async () => {
    render(<ImportarContratosWizard onBack={() => {}} onComplete={() => {}} />);
    await userEvent.click(screen.getByText('Plantilla ATLAS'));
    expect(screen.queryByText(/Desde Rentila ve a/)).not.toBeInTheDocument();
  });

  it('sube 2 ficheros Rentila y los lista con sus contadores', async () => {
    render(<ImportarContratosWizard onBack={() => {}} onComplete={() => {}} />);

    // Ir al paso 2.
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByText('Sube tus exportaciones de Rentila')).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const activos = rentilaXlsxFile('Rentila-activos.xlsx', 10);
    const archivados = rentilaXlsxFile('Rentila-archivados.xlsx', 50);

    fireEvent.change(input, { target: { files: [activos, archivados] } });

    await waitFor(() => expect(screen.getByText('Rentila-activos.xlsx')).toBeInTheDocument());
    expect(screen.getByText('Rentila-archivados.xlsx')).toBeInTheDocument();

    // Contadores por fichero.
    expect(screen.getByText(/10 contratos detectados/)).toBeInTheDocument();
    expect(screen.getByText(/50 contratos detectados/)).toBeInTheDocument();

    // Banner total: 60 contratos (texto en <strong> dentro del banner verde).
    await waitFor(() => expect(screen.getByText('60 contratos')).toBeInTheDocument());
    expect(screen.getByText(/listos para revisión en el siguiente paso/)).toBeInTheDocument();

    // El botón continuar a revisión queda habilitado.
    const continuar = screen.getByRole('button', { name: /Continuar a revisión/ });
    expect(continuar).not.toBeDisabled();
  });

  it('permite quitar un fichero de la lista', async () => {
    render(<ImportarContratosWizard onBack={() => {}} onComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [rentilaXlsxFile('Rentila-activos.xlsx', 10)] } });

    await waitFor(() => expect(screen.getByText('Rentila-activos.xlsx')).toBeInTheDocument());

    await userEvent.click(screen.getByTitle('Quitar'));

    await waitFor(() => expect(screen.queryByText('Rentila-activos.xlsx')).not.toBeInTheDocument());
  });

  it('el botón continuar a revisión está deshabilitado sin ficheros', async () => {
    render(<ImportarContratosWizard onBack={() => {}} onComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByRole('button', { name: /Continuar a revisión/ })).toBeDisabled();
  });
});
