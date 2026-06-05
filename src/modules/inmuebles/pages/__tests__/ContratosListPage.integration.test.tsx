// REORG Contratos · Commit 8 · integración/E2E de la página.
// Render completo con contexto de outlet · valida banda navy + filtrado por
// estado efectivo + cambio de tabs. El día de hoy es 2026-06-03 (mock).
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
    inquilino: { nombre: 'N', apellidos: 'A', dni: '', telefono: '', email: '' },
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
    firma: { metodo: 'digital', estado: 'firmado' },
    ...over,
  }) as Contract;

const property = (id: number, alias: string): Property =>
  ({ id, alias, bedrooms: 1, state: 'activo', modoExplotacion: 'piso_completo' } as Property);

const VIGENTE = contrato({
  id: 1,
  inquilino: { nombre: 'Ivan', apellidos: 'Vigente', dni: '1', telefono: '', email: 'i@v.es' },
  fechaInicio: '2025-01-01',
  fechaFin: '2027-01-01',
});
const PROXIMO = contrato({
  id: 2,
  inmuebleId: 2,
  inquilino: { nombre: 'Pedro', apellidos: 'Proximo', dni: '2', telefono: '', email: 'p@p.es' },
  fechaInicio: '2026-07-01',
  fechaFin: '2028-07-01',
});
const FINALIZADO = contrato({
  id: 3,
  inmuebleId: 1,
  inquilino: { nombre: 'Aroa', apellidos: 'Finalizada', dni: '3', telefono: '', email: 'a@f.es' },
  fechaInicio: '2022-01-01',
  fechaFin: '2023-04-20',
});
// Placeholder AEAT · renta declarada sin inquilino real · NO debe salir en
// Histórico ni Vigentes (§ 1.4) · su sitio es Por conciliar.
const SIN_IDENTIFICAR = contrato({
  id: 4,
  inmuebleId: 1,
  estadoContrato: 'sin_identificar',
  inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' },
  fechaInicio: '2021-01-01',
  fechaFin: '2022-06-30',
});

const renderPage = (): void => {
  const ctx: InmueblesOutletContext = {
    properties: [property(1, 'FA32'), property(2, 'Sant Joan')],
    contracts: [VIGENTE, PROXIMO, FINALIZADO, SIN_IDENTIFICAR],
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

describe('ContratosListPage · integración', () => {
  it('banda navy muestra Vigentes=1 (Rentila finalizado NO cuenta)', () => {
    renderPage();
    const banda = screen.getByLabelText('Resumen de contratos');
    expect(within(banda).getByText('Mis contratos')).toBeInTheDocument();
    // Vigentes = 1 (solo Ivan; Aroa finalizado y Pedro próximo no cuentan).
    expect(within(banda).getByText('1')).toBeInTheDocument();
  });

  it('tab Vigentes por defecto muestra el vigente y NO el finalizado', () => {
    renderPage();
    expect(screen.getByText('Ivan Vigente')).toBeInTheDocument();
    expect(screen.queryByText('Aroa Finalizada')).not.toBeInTheDocument();
    expect(screen.queryByText('Pedro Proximo')).not.toBeInTheDocument();
  });

  it('cambiar a Próximos muestra el contrato por empezar', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Próximos' }));
    expect(screen.getByText('Pedro Proximo')).toBeInTheDocument();
    expect(screen.queryByText('Ivan Vigente')).not.toBeInTheDocument();
  });

  it('cambiar a Histórico muestra el ex-inquilino real (el AEAT sin identificar se excluye · § 1.4)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(screen.getByText('Aroa Finalizada')).toBeInTheDocument();
  });

  it('cambiar a Análisis renderiza los bloques (ranking por inmueble)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Análisis' }));
    expect(screen.getByText('Ingresos por inmueble · ranking anual')).toBeInTheDocument();
  });
});
