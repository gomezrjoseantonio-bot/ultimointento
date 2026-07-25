// PANTALLA-PRESUPUESTO · smoke test de render · que la vista del año no reviente
// con datos mínimos (cliente día 0: 5 grupos con dato, 3 vacíos con motivo).
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProyeccionPage from '../ProyeccionPage';

jest.mock('../../services/presupuestoAnualService', () => {
  const meses = (previsto: number) =>
    Array.from({ length: 12 }, () => ({ previsto, real: null, desglose: [] }));
  const FAKE = {
    year: 2026,
    mesActualIndex: 6,
    punteado: Array(12).fill(false),
    saldoPartida: 14740,
    grupos: [
      { key: 'nomina', label: 'Nómina', signo: 'entra', desplegable: true, meses: meses(4200) },
      { key: 'autonomo', label: 'Actividad de autónomo', signo: 'entra', desplegable: true, meses: meses(1500) },
      { key: 'alquileres', label: 'Alquileres', signo: 'entra', desplegable: true, meses: meses(500) },
      { key: 'hogar', label: 'Hogar y familia', signo: 'sale', desplegable: true, meses: meses(0), vacio: { motivo: 'Sin compromisos recurrentes registrados' } },
      { key: 'inmuebles', label: 'Tus inmuebles', signo: 'sale', desplegable: true, meses: meses(0), vacio: { motivo: 'Sin gastos de inmueble registrados' } },
      { key: 'deuda', label: 'Deuda', signo: 'sale', desplegable: true, meses: meses(-720) },
      { key: 'impuestos', label: 'Impuestos', signo: 'sale', desplegable: false, meses: meses(-137) },
      { key: 'deseos', label: 'Deseos', signo: 'sale', desplegable: true, meses: meses(0), vacio: { motivo: 'Sin compromisos recurrentes registrados' } },
    ],
    teQueda: Array.from({ length: 12 }, () => ({ previsto: 5343, real: null })),
    saldoFinMes: Array.from({ length: 12 }, (_, i) => ({ previsto: 14740 + 5343 * (i + 1), real: null })),
    residuoReal: Array(12).fill(0),
    tira: {
      previstoAcumulado: 0, realAcumulado: 0, mesesCerrados: 0, desviacion: 0,
      desviacionConceptos: [], mesMasJusto: { mes: 8, teQueda: 5343 },
      cierreAnio: { previsto: 78856, inicioCaja: 14740 },
    },
    pie: [],
  };
  // Función plana (no jest.fn) · CRA activa resetMocks y vaciaría su implementación.
  return { buildPresupuestoAnual: () => Promise.resolve(FAKE) };
});

describe('ProyeccionPage · smoke', () => {
  it('renderiza la cabecera, los 8 grupos y las filas vacías con motivo', async () => {
    render(<ProyeccionPage />);
    expect(screen.getByText('Presupuesto')).toBeTruthy();
    // Cargando → tras resolver la promesa, aparecen los grupos.
    expect(await screen.findByText('Nómina')).toBeTruthy();
    expect(screen.getByText('Deuda')).toBeTruthy();
    expect(screen.getByText('Te queda')).toBeTruthy();
    // Filas sin datos: salen con motivo, no a cero mudo (regla 1).
    expect(screen.getAllByText('Sin compromisos recurrentes registrados').length).toBeGreaterThan(0);
    // Impuestos sin chevron (no desplegable): la fila existe.
    expect(screen.getByText('Impuestos')).toBeTruthy();
  });

  it('la pestaña «A largo plazo» muestra estado vacío honesto, sin serie inventada', async () => {
    render(<ProyeccionPage />);
    await screen.findByText('Nómina');
    fireEvent.click(screen.getByText('A largo plazo'));
    expect(screen.getByText(/no está disponible/i)).toBeTruthy();
  });
});
