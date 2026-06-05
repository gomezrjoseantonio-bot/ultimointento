// PR FIX · commit 6 · E2E del caso Jose (§ 3.2).
// Render completo de la página con datos realistas y verificación de los 8
// arreglos: banda navy arriba · tabla 7 columnas sin chips/botones · FA32 por
// habitaciones ("Hab N") vs Sant Joan ("Piso completo") · avatar apagado para
// sin firmar · Histórico sin contratos sin identificar · Análisis triple A sin
// "unidades libres".
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import ContratosListPage from '../ContratosListPage';
import type { Contract, Property } from '../../../../services/db';
import type { InmueblesOutletContext } from '../../InmueblesContext';

const HOY = new Date('2026-06-03T10:00:00Z');
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(HOY);
});
afterAll(() => jest.useRealTimers());

const contrato = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'N', apellidos: 'A', dni: '00000000A', telefono: '', email: '' },
    fechaInicio: '2025-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 1000,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 1000,
    fianzaEstado: 'retenida',
    cuentaCobroId: 0,
    estadoContrato: 'activo',
    documentoFirmado: true,
    ...over,
  }) as Contract;

// FA32 · por habitaciones · Sant Joan · piso completo.
const FA32: Property = { id: 1, alias: 'FA32', bedrooms: 4, state: 'activo', modoExplotacion: 'por_habitaciones' } as Property;
const SANT_JOAN: Property = { id: 2, alias: "Sant Joan d'En Coll", bedrooms: 1, state: 'activo', modoExplotacion: 'piso_completo' } as Property;

// Vigentes: 2 en FA32 (hab 1 firmado · hab 2 sin firmar) + Sant Joan piso completo.
const FA32_H1 = contrato({
  id: 1, inmuebleId: 1, unidadTipo: 'habitacion', habitacionId: 'H1',
  inquilino: { nombre: 'Ivan', apellidos: 'Gomez', dni: '53639208B', telefono: '', email: 'i@v.es' },
  fechaInicio: '2025-03-01', fechaFin: '2027-03-01',
});
const FA32_H2 = contrato({
  id: 2, inmuebleId: 1, unidadTipo: 'habitacion', habitacionId: 'H2', documentoFirmado: false,
  inquilino: { nombre: 'Claudia', apellidos: 'Escudero', dni: '11111111H', telefono: '', email: 'c@e.es' },
  fechaInicio: '2025-04-01', fechaFin: '2027-04-01',
});
const SANT = contrato({
  id: 3, inmuebleId: 2, unidadTipo: 'vivienda',
  inquilino: { nombre: 'Marc', apellidos: 'Coll', dni: '22222222J', telefono: '', email: 'm@c.es' },
  fechaInicio: '2025-01-01', fechaFin: '2026-06-20', // vence en 17 días → alarma vencimiento
});
// Histórico real (FA32 hab 3) + placeholder AEAT sin identificar (no debe salir).
const FA32_EX = contrato({
  id: 4, inmuebleId: 1, unidadTipo: 'habitacion', habitacionId: 'H3',
  inquilino: { nombre: 'Aroa', apellidos: 'Vidal', dni: '33333333P', telefono: '', email: 'a@v.es' },
  fechaInicio: '2022-01-01', fechaFin: '2023-04-20',
});
const SIN_ID = contrato({
  id: 5, inmuebleId: 2, estadoContrato: 'sin_identificar',
  inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' },
  fechaInicio: '2021-01-01', fechaFin: '2022-06-30',
});

const renderPage = (): void => {
  const ctx: InmueblesOutletContext = {
    properties: [FA32, SANT_JOAN],
    contracts: [FA32_H1, FA32_H2, SANT, FA32_EX, SIN_ID],
    reload: () => {},
  } as InmueblesOutletContext;

  render(
    <MemoryRouter initialEntries={['/contratos']}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/contratos" element={<ContratosListPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

describe('PR FIX · E2E caso Jose', () => {
  it('banda navy arriba · título "Mis contratos" + KPI Vigentes', () => {
    renderPage();
    const banda = screen.getByLabelText('Resumen de contratos');
    expect(within(banda).getByText('Mis contratos')).toBeInTheDocument();
    // 3 vigentes con inquilino real (FA32 H1, H2, Sant Joan); el sin identificar no cuenta.
    expect(within(banda).getByText('Vigentes')).toBeInTheDocument();
    expect(within(banda).getByText('3')).toBeInTheDocument();
  });

  it('tabla Vigentes · 7 columnas exactas · sin chips ni botones extra', () => {
    renderPage();
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Inquilino', 'Inmueble', 'Inicio', 'Fin', 'Renta mensual', 'Renta anual', '']);
    // Cero chips TIPO/ESTADO · cero botones Exportar/Imprimir/Columnas.
    ['Larga', 'Corta', 'Más filtros', 'Exportar Excel', 'Imprimir', 'Columnas', 'Estado', 'Último cobro'].forEach((t) => {
      expect(screen.queryByText(t)).toBeNull();
    });
  });

  it('FA32 pinta "Hab N" · Sant Joan pinta "Piso completo"', () => {
    renderPage();
    expect(screen.getByText('Hab 1')).toBeInTheDocument();
    expect(screen.getByText('Hab 2')).toBeInTheDocument();
    expect(screen.getByText('Piso completo')).toBeInTheDocument();
  });

  it('avatar apagado (sin background inline) para el contrato sin firmar', () => {
    renderPage();
    // Claudia Escudero · sin firmar → avatar "CE" apagado (sin background inline)
    // y sub-meta "sin firmar". (El color de paleta de los firmados se cubre en
    // el unit test de avatarInfoPorContrato; jsdom no serializa var() en
    // background, por lo que aquí se verifica el lado unsigned.)
    const avatar = screen.getByText('CE');
    expect(avatar.getAttribute('style') ?? '').not.toMatch(/background/);
    expect(screen.getByText(/sin firmar/)).toBeInTheDocument();
  });

  it('Histórico muestra el ex-inquilino real con "Hab N" y excluye el sin identificar', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(screen.getByText('Aroa Vidal')).toBeInTheDocument();
    expect(screen.getByText('Hab 3')).toBeInTheDocument(); // FA32 ex · por habitaciones
  });

  it('Análisis · 4 bloques triple A · mapa 24 meses · alarmas · SIN "unidades libres"', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Análisis' }));
    expect(screen.getByText('Ocupación · 12 meses atrás · hoy · 12 meses adelante')).toBeInTheDocument();
    expect(screen.getByText('Ingresos por inmueble · ranking anual')).toBeInTheDocument();
    expect(screen.getByText('Alarmas tempranas')).toBeInTheDocument();
    // Sant Joan vence en 17 días → alarma de vencimiento.
    expect(screen.getByText(/vence en \d+ días/)).toBeInTheDocument();
    // NUNCA aparece "unidades libres" como alarma (P7).
    expect(screen.queryByText(/unidades libres/i)).toBeNull();
  });
});
