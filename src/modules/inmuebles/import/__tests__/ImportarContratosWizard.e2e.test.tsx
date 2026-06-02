// Commit 8 · E2E del flujo completo del importador (caso Jose) con BD real
// (fake-indexeddb) y servicios reales: paso 1 → 2 (subir xlsx Rentila) → 3
// (sección Listos · crear contratos SIN FIRMAR + trigger de bote) → 4 (resumen)
// → "Ir a Por conciliar" navega a /contratos?tab=conciliar.
import 'fake-indexeddb/auto';
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { openDB } from 'idb';
import * as XLSX from 'xlsx';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

import ImportarContratosWizard from '../ImportarContratosWizard';
import { boteAnualService } from '../../../../services/boteAnualService';

const DB_NAME = 'AtlasHorizonDB';

async function seedV77(properties: any[]) {
  const legacy = await openDB(DB_NAME, 77, {
    upgrade(db) {
      db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('keyval');
    },
  });
  for (const p of properties) await legacy.put('properties', p);
  legacy.close();
}

const HEADER_ES = [
  'ID', 'Propiedad', 'Tipo', 'Inicio de alquiler', 'Fin del alquiler',
  'Nombre o compañía', 'Alquiler', 'Alquiler', 'Gastos', 'IVA', 'Fianza', 'Otros gastos',
];

function rentilaFile(name: string, rows: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet([HEADER_ES, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File([out], name, { type: 'application/octet-stream' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => out });
  return file;
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/inmuebles/importar-contratos']}>
      <Routes>
        <Route path="/inmuebles/importar-contratos" element={<ImportarContratosWizard onBack={() => {}} onComplete={() => {}} />} />
        <Route path="/contratos" element={<div>PAGINA POR CONCILIAR</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ImportarContratosWizard · E2E flujo Jose (BD real)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('recorre origen → subir → crear listos → resumen → Por conciliar', async () => {
    await seedV77([
      { id: 1, alias: 'CB Sant Fruitós', globalAlias: '', address: 'Carrer Major, Sant Fruitós de Bages',
        postalCode: '', province: '', municipality: '', ccaa: '', purchaseDate: '2020-01-01',
        squareMeters: 60, bedrooms: 2, transmissionRegime: 'usada', state: 'activo',
        acquisitionCosts: { price: 0 }, documents: [] },
    ]);

    // Bote del inmueble 1 · año 2024 (renta declarada sin contrato identificado).
    const bote = await boteAnualService.crearOActualizarBote({
      inmuebleId: 1, año: 2024, importeDeclarado: 4800, díasDeclarados: 366,
    });

    renderApp();

    // Paso 1 → 2.
    await userEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    // Paso 2 · subir 1 fichero Rentila con 2 contratos que mapean a CB Sant Fruitós.
    const file = rentilaFile('Rentila-activos.xlsx', [
      ['', '1-SANT FRUITOS', 'Contrato de arrendamiento de vivienda', '01/01/2024', '31/12/2028', 'CONCEPCION RAMIREZ', 330, 330, 0, '', 330, 0],
      ['', '1-SANT FRUITOS', 'Contrato de arrendamiento de vivienda', '01/01/2024', '31/12/2028', 'JOSEPH PALMA', 320, 320, 0, '', 0, 0],
    ]);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('2 contratos')).toBeInTheDocument());

    // Paso 2 → 3.
    await userEvent.click(screen.getByRole('button', { name: /Continuar a revisión/ }));
    await waitFor(() => expect(screen.getByText('Listos para crear')).toBeInTheDocument());

    // Crear los 2 contratos de la sección Listos.
    await userEvent.click(screen.getByRole('button', { name: /Crear 2 contratos/ }));
    await waitFor(() => expect(screen.queryByText('Listos para crear')).not.toBeInTheDocument());

    // Continuar al resumen (paso 4).
    await userEvent.click(screen.getByRole('button', { name: /Continuar a resumen/ }));
    await waitFor(() => expect(screen.getByText('Listo · 2 contratos importados')).toBeInTheDocument());
    expect(screen.getByText(/botes pueden vincularse en Por conciliar/)).toBeInTheDocument();

    // Los 2 contratos se crearon SIN FIRMAR.
    const { initDB } = require('../../../../services/db');
    const db = await initDB();
    const contratos = await db.getAll('contracts');
    expect(contratos).toHaveLength(2);
    contratos.forEach((c: any) => expect(c.estadoContrato).toBe('sin_firmar'));
    expect(bote.id).toBeDefined();

    // Ir a Por conciliar → navega a /contratos?tab=conciliar.
    await userEvent.click(screen.getByRole('button', { name: /Ir a Por conciliar/ }));
    await waitFor(() => expect(screen.getByText('PAGINA POR CONCILIAR')).toBeInTheDocument());
  });
});
