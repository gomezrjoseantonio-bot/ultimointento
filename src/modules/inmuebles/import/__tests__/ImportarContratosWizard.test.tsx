// FIX P5/P1 · tests del importador de 3 pasos (sin paso "Origen").
// Entrada única en "Subir" · autodetección por cabecera · lote mixto ·
// incidencia para formato no reconocido · y vuelta a /empezar con ?from=empezar.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import ImportarContratosWizard from '../ImportarContratosWizard';

const RENTILA_HEADER = [
  'ID', 'Propiedad', 'Tipo', 'Inicio de alquiler', 'Fin del alquiler',
  'Nombre o compañía', 'Alquiler', 'Alquiler', 'Gastos', 'IVA', 'Fianza', 'Otros gastos',
];
const ATLAS_HEADER = [
  'Inmueble (nombre o ref. catastral)', 'Habitación', 'Tipo de contrato',
  'Fecha inicio', 'Fecha fin', 'Inquilino nombre completo', 'DNI/NIF inquilino',
  'Email inquilino', 'Teléfono inquilino', 'Renta mensual €', 'Fianza €',
];

function xlsxFile(name: string, aoa: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File([out], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => out });
  return file;
}

const rentilaFile = (name: string, n: number): File =>
  xlsxFile(name, [
    RENTILA_HEADER,
    ...Array.from({ length: n }, (_, i) => [
      '', `Inmueble ${i}`, 'Contrato de arrendamiento de vivienda',
      '01/01/2024', '31/12/2028', `INQUILINO ${i}`, 300 + i, 300 + i, 0, '', 300 + i, 0,
    ]),
  ]);
const atlasFile = (name: string, n: number): File =>
  xlsxFile(name, [
    ATLAS_HEADER,
    ...Array.from({ length: n }, (_, i) => [
      `Piso ${i}`, '', 'Vivienda LAU', '01/01/2024', '', `TENANT ${i}`, '', '', '', 900 + i, 0,
    ]),
  ]);
const otroFile = (name: string): File =>
  xlsxFile(name, [['Fecha', 'Cliente', 'Importe'], ['01/01/2024', 'Juan', 100]]);

const renderWizard = (initialPath = '/inmuebles/importar-contratos') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/inmuebles/importar-contratos" element={<ImportarContratosWizard onBack={() => {}} onComplete={() => {}} />} />
        <Route path="/empezar/contratos" element={<div>BLOQUE CONTRATOS</div>} />
      </Routes>
    </MemoryRouter>,
  );

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe('ImportarContratosWizard · 3 pasos + autodetección', () => {
  it('arranca en "Subir" · sin paso Origen ni card "Otro Excel"', () => {
    renderWizard();
    expect(screen.getByText('Sube tus contratos')).toBeInTheDocument();
    expect(screen.getByText('Subir fichero')).toBeInTheDocument();
    // El paso Origen y la card muerta ya no existen.
    expect(screen.queryByText('Otro Excel')).not.toBeInTheDocument();
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument();
    // El enlace de descarga de la plantilla vive en el paso Subir.
    expect(screen.getByRole('button', { name: /Descargar plantilla/ })).toBeInTheDocument();
  });

  it('reconoce un fichero Rentila como "Rentila · N contratos"', async () => {
    renderWizard();
    fireEvent.change(fileInput(), { target: { files: [rentilaFile('Rentila-activos.xlsx', 10)] } });
    await waitFor(() => expect(screen.getByText('Rentila-activos.xlsx')).toBeInTheDocument());
    expect(screen.getByText(/Rentila · 10 contratos/)).toBeInTheDocument();
    expect(screen.getByText('10 contratos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar a revisión/ })).not.toBeDisabled();
  });

  it('reconoce la plantilla ATLAS como "Plantilla ATLAS · N contratos"', async () => {
    renderWizard();
    fireEvent.change(fileInput(), { target: { files: [atlasFile('plantilla.xlsx', 3)] } });
    await waitFor(() => expect(screen.getByText('plantilla.xlsx')).toBeInTheDocument());
    expect(screen.getByText(/Plantilla ATLAS · 3 contratos/)).toBeInTheDocument();
  });

  it('lote mixto (Rentila + ATLAS) · procesa ambos y suma el total', async () => {
    renderWizard();
    fireEvent.change(fileInput(), {
      target: { files: [rentilaFile('r.xlsx', 2), atlasFile('a.xlsx', 3)] },
    });
    await waitFor(() => expect(screen.getByText('r.xlsx')).toBeInTheDocument());
    expect(screen.getByText(/Rentila · 2 contratos/)).toBeInTheDocument();
    expect(screen.getByText(/Plantilla ATLAS · 3 contratos/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('5 contratos')).toBeInTheDocument());
  });

  it('Excel no reconocido → incidencia con plantilla a mano · no bloquea el resto', async () => {
    renderWizard();
    fireEvent.change(fileInput(), {
      target: { files: [otroFile('cualquiera.xlsx'), rentilaFile('r.xlsx', 4)] },
    });
    await waitFor(() => expect(screen.getByText('cualquiera.xlsx')).toBeInTheDocument());
    expect(screen.getByText(/Formato no reconocido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar plantilla ATLAS/ })).toBeInTheDocument();
    // El Rentila válido sigue contando · el botón continúa habilitado.
    expect(screen.getByText('4 contratos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar a revisión/ })).not.toBeDisabled();
  });

  it('continuar a revisión deshabilitado sin ficheros reconocidos', async () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /Continuar a revisión/ })).toBeDisabled();
    fireEvent.change(fileInput(), { target: { files: [otroFile('solo-incidencia.xlsx')] } });
    await waitFor(() => expect(screen.getByText('solo-incidencia.xlsx')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Continuar a revisión/ })).toBeDisabled();
  });

  it('permite quitar un fichero de la lista', async () => {
    renderWizard();
    fireEvent.change(fileInput(), { target: { files: [rentilaFile('r.xlsx', 4)] } });
    await waitFor(() => expect(screen.getByText('r.xlsx')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('Quitar'));
    await waitFor(() => expect(screen.queryByText('r.xlsx')).not.toBeInTheDocument());
  });

  it('FIX P1 · con ?from=empezar el botón cancelar vuelve a /empezar/contratos', async () => {
    renderWizard('/inmuebles/importar-contratos?from=empezar');
    // El botón inferior dice "Volver a Empezar" en lugar de "Cancelar".
    const volver = screen.getAllByRole('button', { name: /Volver a Empezar/ })[0];
    await userEvent.click(volver);
    await waitFor(() => expect(screen.getByText('BLOQUE CONTRATOS')).toBeInTheDocument());
  });
});
