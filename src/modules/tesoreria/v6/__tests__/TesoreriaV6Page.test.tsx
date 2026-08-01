// Render de la pantalla de Tesorería V6 (§4.1 · 4.2 · 4.3 · 4.10).
//
// Los cálculos ya tienen su candado en `tesoreriaV6Metrics.test.ts`. Aquí se
// comprueba lo que solo se ve al pintar: que el vocabulario es el de la tarea
// ("Cierre" en todo el módulo), que el estado de la tarjeta es UNO solo, y que
// el bloque de realidad cierra con la desviación y no con el cierre.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import TesoreriaV6Page from '../TesoreriaV6Page';
import { initDB, type Account, type Movement, type TreasuryEvent } from '../../../../services/db';

jest.mock('../../../../services/db', () => ({ initDB: jest.fn() }));

const HOY = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const enEsteMes = (dia: number) =>
  iso(new Date(HOY.getFullYear(), HOY.getMonth(), dia));
const ultimoDia = new Date(HOY.getFullYear(), HOY.getMonth() + 1, 0).getDate();

const cuenta = (id: number, over: Partial<Account> = {}): Account => ({
  id,
  iban: `ES9100491500051234567${id}`,
  alias: `Cuenta ${id}`,
  status: 'ACTIVE',
  activa: true,
  openingBalance: 1000,
  openingBalanceDate: '2020-01-01',
  createdAt: '',
  updatedAt: '',
  ...over,
});

const evento = (over: Partial<TreasuryEvent> = {}): TreasuryEvent => ({
  type: 'expense',
  amount: 100,
  predictedDate: enEsteMes(Math.min(28, ultimoDia)),
  description: 'Recibo',
  sourceType: 'manual',
  status: 'predicted',
  createdAt: '',
  updatedAt: '',
  ...over,
});

function montarDb(datos: {
  accounts?: Account[];
  treasuryEvents?: TreasuryEvent[];
  movements?: Movement[];
  keyval?: Record<string, unknown>;
}) {
  const stores: Record<string, unknown[]> = {
    accounts: datos.accounts ?? [],
    treasuryEvents: datos.treasuryEvents ?? [],
    movements: datos.movements ?? [],
  };
  const keyval = datos.keyval ?? {};
  (initDB as jest.Mock).mockResolvedValue({
    getAll: async (name: string) => stores[name] ?? [],
    get: async (name: string, key: string) => (name === 'keyval' ? keyval[key] : undefined),
    put: async () => undefined,
  });
}

describe('§4.1 · hero', () => {
  it('pinta los 4 KPIs con el cierre proyectado al último día', async () => {
    montarDb({
      accounts: [cuenta(1), cuenta(2)],
      treasuryEvents: [
        evento({ type: 'income', amount: 650, predictedDate: enEsteMes(Math.min(20, ultimoDia)) }),
      ],
    });
    render(<TesoreriaV6Page />);

    await waitFor(() => expect(screen.getByText('Saldo')).toBeInTheDocument());
    expect(screen.getByText('2 cuentas · hoy')).toBeInTheDocument();
    expect(screen.getByText('Pendiente entrar')).toBeInTheDocument();
    expect(screen.getByText('Pendiente salir')).toBeInTheDocument();
    expect(screen.getByText(`proyectado a día ${ultimoDia}`)).toBeInTheDocument();
  });

  it('singulariza "1 cuenta", que si no queda "1 cuentas"', async () => {
    montarDb({ accounts: [cuenta(1)] });
    render(<TesoreriaV6Page />);
    await waitFor(() => expect(screen.getByText('1 cuenta · hoy')).toBeInTheDocument());
  });
});

describe('§4.2 · tarjetas de cuenta', () => {
  it('muestra saldo y "al día" cuando no queda nada pendiente', async () => {
    montarDb({ accounts: [cuenta(1, { alias: 'Sabadell principal' })] });
    render(<TesoreriaV6Page />);

    await waitFor(() => expect(screen.getByText('Sabadell principal')).toBeInTheDocument());
    expect(screen.getByText('al día')).toBeInTheDocument();
  });

  it('avisa de que la cuenta se queda corta, con importe y día', async () => {
    montarDb({
      accounts: [cuenta(1, { openingBalance: 50 })],
      treasuryEvents: [
        evento({ type: 'expense', amount: 500, accountId: 1, predictedDate: enEsteMes(Math.min(28, ultimoDia)) }),
      ],
    });
    render(<TesoreriaV6Page />);

    await waitFor(() => expect(screen.getByText(/se queda en/)).toBeInTheDocument());
    // Un solo estado por tarjeta: si avisa de que se queda corta, no dice
    // además "N por confirmar" (§4.2).
    expect(screen.queryByText(/por confirmar/)).not.toBeInTheDocument();
    expect(screen.queryByText('al día')).not.toBeInTheDocument();
  });

  it('cuenta los pendientes cuando el saldo aguanta', async () => {
    montarDb({
      accounts: [cuenta(1, { openingBalance: 10000 })],
      treasuryEvents: [
        evento({ accountId: 1, predictedDate: enEsteMes(Math.min(27, ultimoDia)) }),
        evento({ accountId: 1, predictedDate: enEsteMes(Math.min(28, ultimoDia)) }),
      ],
    });
    render(<TesoreriaV6Page />);
    await waitFor(() => expect(screen.getByText(/por confirmar/)).toBeInTheDocument());
  });
});

describe('§4.3 · rejilla de meses', () => {
  it('pinta 6 meses, marca el actual y usa el vocabulario "Cierre"', async () => {
    montarDb({ accounts: [cuenta(1)] });
    render(<TesoreriaV6Page />);

    await waitFor(() => expect(screen.getByText('en curso')).toBeInTheDocument());
    // Vocabulario único en todo el módulo: nunca "saldo a fin de mes" (§4.3).
    expect(screen.getAllByText('Cierre')).toHaveLength(6);
    expect(screen.queryByText(/saldo a fin de mes/i)).not.toBeInTheDocument();
  });
});

describe('§4.10 · cómo va el mes', () => {
  it('cierra con la DESVIACIÓN, no repitiendo el cierre del hero', async () => {
    montarDb({
      accounts: [cuenta(1)],
      treasuryEvents: [
        evento({ type: 'expense', amount: 1838.42, predictedDate: enEsteMes(5), status: 'executed' }),
      ],
      movements: [
        {
          accountId: 1,
          date: enEsteMes(5),
          amount: -1473.42,
          description: 'Pago',
          status: 'pendiente',
          unifiedStatus: 'conciliado',
          source: 'import',
          category: { tipo: 'Gastos' },
          type: 'Gasto',
          origin: 'CSV',
          movementState: 'Confirmado',
          ambito: 'PERSONAL',
          statusConciliacion: 'sin_match',
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    render(<TesoreriaV6Page />);

    const veredicto = await screen.findByText(/Acabarás/);
    expect(veredicto).toHaveTextContent('+365 €');
    expect(veredicto).toHaveTextContent('mejor de lo previsto');
    // La explicación compara iguales: lo previsto DE LO YA CONFIRMADO.
    expect(screen.getByText(/habías previsto pagar/)).toHaveTextContent('1.838,42 €');
  });

  it('escala cada línea contra su propio previsto', async () => {
    montarDb({
      accounts: [cuenta(1)],
      treasuryEvents: [evento({ type: 'income', amount: 1000, predictedDate: enEsteMes(5) })],
      movements: [],
    });
    render(<TesoreriaV6Page />);

    await waitFor(() => expect(screen.getByText('Ingresos')).toBeInTheDocument());
    expect(screen.getByText('Gastos')).toBeInTheDocument();
    expect(screen.getByText('Neto')).toBeInTheDocument();
  });
});

describe('§4.7 · la puerta global del extracto', () => {
  it('el botón del hero abre el drawer, sin cuenta fijada', async () => {
    montarDb({ accounts: [cuenta(1)] });
    render(<TesoreriaV6Page />);

    const subir = await screen.findByRole('button', { name: /Subir extracto/ });
    expect(subir).not.toBeDisabled();
    fireEvent.click(subir);

    const drawer = await screen.findByRole('dialog', { name: 'Subir extracto' });
    expect(drawer).toBeInTheDocument();
    // Entrando por el hero la cuenta aún no se sabe · la dice el IBAN (§4.7).
    expect(screen.getByText('La cuenta se detecta por el IBAN del fichero')).toBeInTheDocument();
    expect(
      screen.getByText('Arrastra aquí el extracto o haz clic para elegir')
    ).toBeInTheDocument();
  });
});

describe('§4.9 · la puerta del calendario', () => {
  it('tocar un mes abre los días de ESE mes, sin cerrar la pantalla', async () => {
    montarDb({ accounts: [cuenta(1)] });
    render(<TesoreriaV6Page />);

    // Hay 6 tarjetas · se abre la del mes en curso, que es la primera.
    const meses = await screen.findAllByRole('button', { name: /Ver los días de/ });
    fireEvent.click(meses[0]);

    expect(await screen.findByRole('dialog', { name: 'Calendario' })).toBeInTheDocument();
    // Navegación ‹ › · el drawer cambia de mes sin cerrarse (§4.9).
    expect(screen.getByLabelText('Mes anterior')).toBeInTheDocument();
    expect(screen.getByLabelText('Mes siguiente')).toBeInTheDocument();
  });

  it('el resumen del mes habla de Cierre · vocabulario único del módulo', async () => {
    montarDb({ accounts: [cuenta(1)] });
    render(<TesoreriaV6Page />);
    fireEvent.click((await screen.findAllByRole('button', { name: /Ver los días de/ }))[0]);

    const drawer = await screen.findByRole('dialog', { name: 'Calendario' });
    expect(within(drawer).getByText('Queda entrar')).toBeInTheDocument();
    expect(within(drawer).getByText('Queda salir')).toBeInTheDocument();
    expect(within(drawer).getByText('Cierre')).toBeInTheDocument();
  });

  it('en el día NO se concilia · conciliar es por cuenta y por fichero (§4.9)', async () => {
    montarDb({ accounts: [cuenta(1)] });
    render(<TesoreriaV6Page />);
    fireEvent.click((await screen.findAllByRole('button', { name: /Ver los días de/ }))[0]);

    const drawer = await screen.findByRole('dialog', { name: 'Calendario' });
    expect(within(drawer).queryByText(/concilia/i)).not.toBeInTheDocument();
  });
});

describe('estado vacío', () => {
  it('no revienta sin cuentas ni movimientos', async () => {
    montarDb({});
    render(<TesoreriaV6Page />);
    await waitFor(() => expect(screen.getByText('0 cuentas · hoy')).toBeInTheDocument());
  });
});

describe('§4.2 · orden guardado de las tarjetas', () => {
  it('respeta el orden que dejó el usuario', async () => {
    montarDb({
      accounts: [cuenta(1, { alias: 'Primera' }), cuenta(2, { alias: 'Segunda' })],
      keyval: { 'tesoreria.v6.ordenCuentas': [2, 1] },
    });
    const { container } = render(<TesoreriaV6Page />);

    await waitFor(() => expect(screen.getByText('Segunda')).toBeInTheDocument());
    const nombres = Array.from(container.querySelectorAll('.accNm')).map((n) => n.textContent);
    expect(nombres).toEqual(['Segunda', 'Primera']);
  });
});
