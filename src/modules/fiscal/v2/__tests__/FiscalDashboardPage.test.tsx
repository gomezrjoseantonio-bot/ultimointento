/**
 * Tests F1 dashboard · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2 §4.7.
 * Cubre · render con datos mock · 4 KPIs · 3 tabs · navegación · localStorage nota.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import * as fiscalResolver from '../../../../services/fiscalResolverService';
import * as deudasService from '../../../../services/deudasFiscalesService';
import * as arrastresHelper from '../helpers/arrastresVivosService';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../../../services/fiscalResolverService');
jest.mock('../../../../services/deudasFiscalesService');
jest.mock('../helpers/arrastresVivosService');
jest.mock('../helpers/paralelaService');

import FiscalDashboardPage from '../FiscalDashboardPage';
import * as paralelaSvc from '../helpers/paralelaService';

const mockedParalelaMulti = paralelaSvc.getParalelaInfoMultiAño as jest.MockedFunction<
  typeof paralelaSvc.getParalelaInfoMultiAño
>;

const mockedGetResumen = fiscalResolver.getResumenGlobal as jest.MockedFunction<
  typeof fiscalResolver.getResumenGlobal
>;
const mockedResolverTodos = fiscalResolver.resolverTodosLosEjercicios as jest.MockedFunction<
  typeof fiscalResolver.resolverTodosLosEjercicios
>;
const mockedGetDeudas = deudasService.getDeudasAbiertas as jest.MockedFunction<
  typeof deudasService.getDeudasAbiertas
>;
const mockedGetArrastres = arrastresHelper.getArrastresVivos as jest.MockedFunction<
  typeof arrastresHelper.getArrastresVivos
>;

function buildEjercicio(año: number, estado: 'en_curso' | 'pendiente' | 'declarado', resultado: number | null) {
  return {
    año,
    estado,
    fuente: 'xml_aeat' as const,
    resultado,
    tipoResultado: resultado === null ? null : (resultado < 0 ? 'devolver' as const : 'pagar' as const),
    resumen: {
      baseLiquidableGeneral: null,
      baseLiquidableAhorro: null,
      cuotaIntegraEstatal: null,
      cuotaIntegraAutonomica: null,
      cuotaLiquidaEstatal: null,
      cuotaLiquidaAutonomica: null,
    },
    rendimientosTrabajo: null,
    rendimientosInmuebles: null,
    rendimientosActividades: null,
    rendimientosAhorro: null,
    baseImponibleGeneral: null,
    baseImponibleAhorro: null,
    cuotaIntegra: null,
    retenciones: null,
    casillas: null,
    inmuebles: null,
    declaracionCompleta: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/fiscal']}>
      <FiscalDashboardPage />
    </MemoryRouter>,
  );
}

const NOTE_KEY = 'fiscal.note.arrastres-orden.dismissed';

describe('FiscalDashboardPage · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();
    try { localStorage.removeItem(NOTE_KEY); } catch { /* noop */ }

    mockedGetResumen.mockResolvedValue({
      totalEjercicios: 7,
      enCurso: 1,
      pendientes: 1,
      declarados: 4,
      prescritos: 1,
      proyeccionAñoActual: -1180.0,
      borradorAñoPendiente: 5847.0,
      deudaAbierta: 977.7,
      arrastresVivos: 29109.22,
      campañaActual: {
        ejercicio: 2025,
        ventana: { from: '2026-04-02', to: '2026-06-30' },
        abierta: true,
      },
    });

    mockedResolverTodos.mockResolvedValue([
      buildEjercicio(2026, 'en_curso', -1180.0),
      buildEjercicio(2025, 'pendiente', 5847.0),
      buildEjercicio(2024, 'declarado', -2899.75),
      buildEjercicio(2023, 'declarado', 5509.89),
      buildEjercicio(2022, 'declarado', 5268.20),
      buildEjercicio(2021, 'declarado', 1842.10),
      buildEjercicio(2020, 'declarado', 2120.00),
    ]);

    mockedGetDeudas.mockResolvedValue([
      {
        id: 1,
        modelo: '303',
        ejercicio: 2024,
        periodo: '3T',
        principal: 931.14,
        recargoTipo: 'ejecutivo_5',
        recargoImporte: 46.56,
        total: 977.70,
        estado: 'ejecutivo',
        notificada: '2024-11-23',
        createdAt: '2024-11-23T00:00:00Z',
        updatedAt: '2024-11-23T00:00:00Z',
      },
    ]);

    mockedParalelaMulti.mockResolvedValue(new Map());

    mockedGetArrastres.mockResolvedValue({
      rows: [
        {
          id: 'perdida-1',
          tipo: 'perdida_ahorro',
          origen: 2022,
          concepto: 'Pérdida patrimonial ahorro',
          importeOriginal: 1418.35,
          importeAplicado: 73.36,
          importePendiente: 1344.99,
          caduca: '31/12/2026',
          caducaEsteAño: true,
        },
        {
          id: 'perdida-2',
          tipo: 'perdida_ahorro',
          origen: 2023,
          concepto: 'Pérdida patrimonial ahorro',
          importeOriginal: 27764.23,
          importeAplicado: 0,
          importePendiente: 27764.23,
          caduca: '31/12/2027',
          caducaEsteAño: false,
        },
      ],
      totalPendiente: 29109.22,
    });
  });

  it('renderiza el header "Fiscal" y la campaña activa', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Fiscal/i })).toBeInTheDocument();
    expect(await screen.findByText(/Campaña IRPF 2025/i)).toBeInTheDocument();
  });

  it('renderiza el link "Acciones fiscales →" en el header (NO botones)', async () => {
    renderPage();
    const link = await screen.findByRole('button', { name: /Acciones fiscales/i });
    expect(link).toBeInTheDocument();
    fireEvent.click(link);
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal/configuracion');
  });

  it('renderiza los 4 KPIs con los importes de getResumenGlobal', async () => {
    renderPage();
    // Espera a que cargue (la campaña aparece tras loading=false)
    await screen.findByText(/Campaña IRPF 2025/i);
    // Regex tolerantes con/sin separador de miles (jsdom puede no tener
    // ICU completo · es-ES con/sin punto en grupos).
    // KPI 1 · Proyección año actual (negativo · a pagar)
    expect(screen.getAllByText(/1\.?180,00 €/).length).toBeGreaterThan(0);
    // KPI 2 · Borrador año pendiente (positivo · a devolver)
    expect(screen.getAllByText(/5\.?847,00 €/).length).toBeGreaterThan(0);
    // KPI 3 · Deuda abierta
    expect(screen.getAllByText(/977,70 €/).length).toBeGreaterThan(0);
    // KPI 4 · Arrastres vivos
    expect(screen.getAllByText(/29\.?109,22 €/).length).toBeGreaterThan(0);
  });

  it('navega al click de cada KPI', async () => {
    renderPage();
    const proyeccion = await screen.findByLabelText(/proyección IRPF/i);
    fireEvent.click(proyeccion);
    const añoActual = new Date().getFullYear();
    expect(mockNavigate).toHaveBeenCalledWith(`/fiscal/ejercicio/${añoActual}`);

    fireEvent.click(screen.getByLabelText(/borrador pendiente/i));
    expect(mockNavigate).toHaveBeenCalledWith(`/fiscal/ejercicio/${añoActual - 1}`);

    fireEvent.click(screen.getByLabelText(/Deuda abierta/i));
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal/configuracion?section=deudas');

    fireEvent.click(screen.getByLabelText(/Arrastres vivos/i));
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal/configuracion?section=arrastres');
  });

  it('renderiza 3 tabs SIN iconos (texto + contador) y permite cambiar', async () => {
    renderPage();
    const tabEjercicios = await screen.findByRole('tab', { name: /Ejercicios/ });
    const tabDeudas = screen.getByRole('tab', { name: /Deudas/ });
    const tabArrastres = screen.getByRole('tab', { name: /Arrastres/ });

    expect(tabEjercicios).toHaveAttribute('aria-selected', 'true');
    expect(tabDeudas).toHaveAttribute('aria-selected', 'false');
    expect(tabArrastres).toHaveAttribute('aria-selected', 'false');

    // Contadores (7 ejercicios · 1 deuda · 2 arrastres)
    expect(tabEjercicios).toHaveTextContent('7');
    expect(tabDeudas).toHaveTextContent('1');
    expect(tabArrastres).toHaveTextContent('2');

    fireEvent.click(tabDeudas);
    expect(tabDeudas).toHaveAttribute('aria-selected', 'true');
  });

  it('lista 7 ejercicios y navega al hacer click', async () => {
    renderPage();
    // Espera a que el tab activo (Ejercicios) renderice las filas
    const row2024 = await screen.findByLabelText(/Abrir ejercicio 2024/);
    fireEvent.click(row2024);
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal/ejercicio/2024');
  });

  it('tab Deudas muestra la deuda IVA 3T-2024', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Deudas/ }));
    expect(screen.getByText(/IVA 3T-2024/)).toBeInTheDocument();
    expect(screen.getByText(/ejecutivo 5%/)).toBeInTheDocument();
  });

  it('tab Arrastres muestra los 2 arrastres con importes correctos', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Arrastres/ }));
    // 1.344,99 + 27.764,23 (importes pendientes) · regex tolerante a separador de miles
    expect((await screen.findAllByText(/1\.?344,99 €/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/27\.?764,23 €/).length).toBeGreaterThan(0);
    // Caduca este año
    expect(screen.getByText(/caduca este año/)).toBeInTheDocument();
  });

  it('nota descartable persiste en localStorage al cerrar', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Arrastres/ }));
    const close = await screen.findByLabelText(/Descartar nota/);
    fireEvent.click(close);
    await waitFor(() => {
      expect(localStorage.getItem(NOTE_KEY)).toBe('true');
    });
  });

  it('nota descartable NO se muestra si ya fue descartada', async () => {
    localStorage.setItem(NOTE_KEY, 'true');
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: /Arrastres/ }));
    expect(screen.queryByLabelText(/Descartar nota/)).not.toBeInTheDocument();
  });

  // ── Sub-tarea 3.x · ajustes Jose ───────────────────────────────────────
  it('AJUSTE 1 · pill "Complementaria" para años con esComplementaria=true', async () => {
    mockedParalelaMulti.mockResolvedValue(new Map([
      [2023, { esComplementaria: true, justificanteAnterior: '1234567890123', versionLabel: 'v2' as const }],
      [2022, { esComplementaria: true, versionLabel: 'v2' as const }],
    ]));
    renderPage();
    // El tab Ejercicios es default · esperamos a que cargue
    await screen.findByLabelText(/Abrir ejercicio 2023/);
    // Pill Complementaria visible al menos 2 veces (2022 + 2023)
    expect(screen.getAllByText(/Complementaria/).length).toBeGreaterThanOrEqual(2);
    // El justificante anterior está como tooltip (title attr)
    const pill2023 = screen.getAllByTitle(/justificante anterior 1234567890123/i);
    expect(pill2023.length).toBeGreaterThan(0);
  });

  it('AJUSTE 2 · año en curso muestra "prescribe en {año+5}"', async () => {
    renderPage();
    const añoActual = new Date().getFullYear();
    await screen.findByLabelText(`Abrir ejercicio ${añoActual}`);
    // Esperamos el texto "prescribe en {añoActual + 5}" para el año en curso
    const esperado = new RegExp(`prescribe en ${añoActual + 5}`);
    expect(screen.getAllByText(esperado).length).toBeGreaterThan(0);
  });

  it('AJUSTE 2 · año pendiente muestra "prescribe en {año+5}"', async () => {
    renderPage();
    const añoActual = new Date().getFullYear();
    const añoPendiente = añoActual - 1;
    await screen.findByLabelText(`Abrir ejercicio ${añoPendiente}`);
    // 2025 pendiente → prescribe en 2030
    const esperado = new RegExp(`prescribe en ${añoPendiente + 5}`);
    expect(screen.getAllByText(esperado).length).toBeGreaterThan(0);
  });

  it('AJUSTE 2 · año declarado sigue mostrando fecha completa de prescripción', async () => {
    renderPage();
    await screen.findByLabelText(/Abrir ejercicio 2024/);
    // 2024 declarado · texto "prescribe DD/MM/YYYY"
    expect(screen.getAllByText(/prescribe \d{2}\/\d{2}\/\d{4}/).length).toBeGreaterThan(0);
  });
});
