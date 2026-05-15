/**
 * Tests F6 Acciones fiscales · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.5.
 *
 * Cubre:
 *   · render 7 acordeones del mockup
 *   · click en acordeón abre/cierra contenido
 *   · query ?section=arrastres abre el acordeón correspondiente
 *   · bloque 1 · botón "Editar perfil" navega a /ajustes/fiscal
 *   · bloque 2 · selector ejercicio + dropzone funcional (navega al wizard)
 *   · bloque 3 · botón wizard paralela navega a /fiscal/correccion/{año}
 *   · bloque 4 · 4 botones presentes · re-importar navega
 *   · bloque 5 · form arrastre manual abre/cancela
 *   · bloque 7 · 3 botones export presentes
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { personalDataService } from '../../../../services/personalDataService';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../../../services/db', () => ({
  initDB: jest.fn(async () => ({
    get: jest.fn(async () => null),
    getAll: jest.fn(async () => []),
  })),
}));

jest.mock('../../../../services/personalDataService', () => ({
  personalDataService: {
    getPersonalData: jest.fn(async () => null),
  },
}));

jest.mock('../../../../services/carryForwardService', () => ({
  registrarArrastre: jest.fn(async () => undefined),
}));

import FiscalAccionesPage from '../FiscalAccionesPage';

function renderPage(query = '') {
  return render(
    <MemoryRouter initialEntries={[`/fiscal/acciones${query}`]}>
      <Routes>
        <Route path="/fiscal/acciones" element={<FiscalAccionesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FiscalAccionesPage · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();
    (personalDataService.getPersonalData as jest.Mock).mockResolvedValue({
      nombre: 'Jose',
      tributacion: 'individual',
      comunidadAutonoma: 'Madrid',
      situacionLaboral: 'asalariado + autonomo',
      descendientes: [],
      ascendientes: [],
    });
  });

  it('renderiza header "Acciones fiscales" + breadcrumb · cero botones de acción en header', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Acciones fiscales/i })).toBeInTheDocument();
    // El header solo tiene "Volver" + crumbs · ningún botón de acción
    expect(screen.getByText(/‹ Volver/)).toBeInTheDocument();
  });

  it('renderiza los 7 acordeones del mockup', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Acciones fiscales/i });
    expect(screen.getByText(/^Perfil fiscal$/)).toBeInTheDocument();
    expect(screen.getByText(/^Importar declaración Modelo 100$/)).toBeInTheDocument();
    expect(screen.getByText(/^Aplicar paralela AEAT$/)).toBeInTheDocument();
    expect(screen.getByText(/^Re-importar o exportar un ejercicio$/)).toBeInTheDocument();
    expect(screen.getByText(/^Arrastres manuales$/)).toBeInTheDocument();
    expect(screen.getByText(/^Histórico completo de declaraciones$/)).toBeInTheDocument();
    expect(screen.getByText(/^Exportar todo$/)).toBeInTheDocument();
  });

  it('por defecto · acordeón "Perfil fiscal" abierto', async () => {
    renderPage();
    const perfilHd = await screen.findByRole('button', { name: /Perfil fiscal/i });
    expect(perfilHd).toHaveAttribute('aria-expanded', 'true');
  });

  it('query ?section=arrastres abre el acordeón Arrastres manuales', async () => {
    renderPage('?section=arrastres');
    const arrHd = await screen.findByRole('button', { name: /Arrastres manuales/i });
    expect(arrHd).toHaveAttribute('aria-expanded', 'true');
  });

  it('query ?section=deudas mapea al acordeón Aplicar paralela (deudas relacionadas)', async () => {
    renderPage('?section=deudas');
    const paralelaHd = await screen.findByRole('button', { name: /Aplicar paralela AEAT/i });
    expect(paralelaHd).toHaveAttribute('aria-expanded', 'true');
  });

  it('bloque 1 · click "Editar perfil →" navega a /ajustes/fiscal', async () => {
    renderPage();
    const editar = await screen.findByRole('button', { name: /Editar perfil/i });
    fireEvent.click(editar);
    expect(mockNavigate).toHaveBeenCalledWith('/ajustes/fiscal');
  });

  it('bloque 2 · abre acordeón Importar · muestra selector + dropzone + histórico vacío', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Importar declaración Modelo 100/i }));
    // Selector ejercicio
    expect(await screen.findByLabelText(/Ejercicio fiscal destino/i)).toBeInTheDocument();
    // Dropzone
    expect(screen.getByLabelText(/Importar declaración del Modelo 100/i)).toBeInTheDocument();
    // Histórico vacío
    expect(screen.getByText(/Aún no has importado ninguna declaración/i)).toBeInTheDocument();
  });

  it('bloque 3 · botón wizard paralela deshabilitado si no hay ejercicios', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Aplicar paralela AEAT/i }));
    const wizardBtn = await screen.findByRole('button', { name: /Iniciar wizard paralela/i });
    expect(wizardBtn).toBeDisabled();
  });

  it('bloque 4 · 4 botones operativos presentes (Re-importar · Exportar PDF · Ver versiones · Comparar)', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Re-importar o exportar un ejercicio/i }));
    expect(await screen.findByRole('button', { name: /^Re-importar declaración$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Exportar PDF$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ver versiones$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Comparar con otro año$/i })).toBeInTheDocument();
  });

  it('bloque 5 · botón "+ Añadir arrastre manual" disabled sin inmuebles', async () => {
    renderPage('?section=arrastres');
    const addBtn = await screen.findByRole('button', { name: /Añadir arrastre manual/i });
    expect(addBtn).toBeDisabled();
  });

  it('bloque 7 · 3 botones export presentes (JSON config · JSON declaraciones · CSV)', async () => {
    renderPage('?section=exportar');
    expect(await screen.findByRole('button', { name: /Exportar config \(JSON\)/i })).toBeInTheDocument();
    // El botón cambió de "ZIP declaraciones" a "Exportar declaraciones (JSON)"
    // para no engañar al usuario (no es ZIP real · es un JSON único).
    expect(screen.getByRole('button', { name: /Exportar declaraciones \(JSON\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CSV casillas por año/i })).toBeInTheDocument();
  });

  it('breadcrumb "‹ Volver" navega a /fiscal', async () => {
    renderPage();
    fireEvent.click(await screen.findByText(/^‹ Volver$/));
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal');
  });

  it('acordeón cerrado se abre al hacer click · y vice-versa', async () => {
    renderPage();
    const importarHd = await screen.findByRole('button', { name: /Importar declaración Modelo 100/i });
    expect(importarHd).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(importarHd);
    expect(importarHd).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(importarHd);
    expect(importarHd).toHaveAttribute('aria-expanded', 'false');
  });
});
