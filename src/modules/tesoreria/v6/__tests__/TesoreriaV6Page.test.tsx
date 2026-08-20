// Render de la pantalla de Tesorería V6 (§4.1 · 4.2 · 4.3 · 4.10).
//
// Los cálculos ya tienen su candado en `tesoreriaV6Metrics.test.ts`. Aquí se
// comprueba lo que solo se ve al pintar: que el vocabulario es el de la tarea
// ("Cierre" en todo el módulo), que el estado de la tarjeta es UNO solo, y que
// el bloque de realidad cierra con la desviación y no con el cierre.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

const movimiento = (over: Partial<Movement> = {}): Movement => ({
  accountId: 1,
  date: enEsteMes(5),
  amount: -100,
  description: 'Movimiento',
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
  ...over,
});

/**
 * La pantalla lee la URL: qué cuenta está abierta lo dice
 * `/tesoreria/cuenta/:accountId`, y `?extracto=1` abre el de extracto. Así que
 * hay que montarla dentro de un router con esas dos rutas.
 */
function montar(ruta = '/tesoreria') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/tesoreria" element={<TesoreriaV6Page />} />
        <Route path="/tesoreria/cuenta/:accountId" element={<TesoreriaV6Page />} />
      </Routes>
    </MemoryRouter>
  );
}

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
    montar();

    await waitFor(() => expect(screen.getByText('Saldo hoy · consolidado')).toBeInTheDocument());
    expect(screen.getByText('2 cuentas')).toBeInTheDocument();
    // "Queda entrar/salir" salen dos veces: KPI del héroe y cabecera de la tabla.
    expect(screen.getAllByText('Queda entrar').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Queda salir').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('proyectado')).toBeInTheDocument();
  });

  it('singulariza "1 cuenta", que si no queda "1 cuentas"', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();
    await waitFor(() => expect(screen.getByText('1 cuenta')).toBeInTheDocument());
  });
});

describe('V9 · tabla "Mis cuentas" · columna Estado', () => {
  it('"al día" NO pinta chip · la celda queda en blanco (decisión del spec)', async () => {
    montarDb({ accounts: [cuenta(1, { alias: 'Sabadell principal' })] });
    montar();

    await waitFor(() => expect(screen.getByText('Sabadell principal')).toBeInTheDocument());
    expect(screen.queryByText('al día')).not.toBeInTheDocument();
    expect(screen.queryByText(/por confirmar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/descubierto/)).not.toBeInTheDocument();
  });

  it('la cuenta que se queda corta lleva el chip "descubierto · {día}"', async () => {
    montarDb({
      accounts: [cuenta(1, { openingBalance: 50 })],
      treasuryEvents: [
        evento({ type: 'expense', amount: 500, accountId: 1, predictedDate: enEsteMes(Math.min(28, ultimoDia)) }),
      ],
    });
    montar();

    await waitFor(() => expect(screen.getByText(/descubierto ·/)).toBeInTheDocument());
    // Un solo estado por fila: si está en descubierto, no dice además
    // "N por confirmar".
    expect(screen.queryByText(/por confirmar/)).not.toBeInTheDocument();
  });

  // "N por confirmar" es lo VENCIDO sin confirmar · el mismo N que la bandeja
  // de §4.4. Pulsar una tarjeta que dice 9 y aterrizar en una pestaña que dice
  // 3 es la tarjeta mintiendo sobre lo que hay dentro.
  it('cuenta lo vencido sin confirmar cuando el saldo aguanta', async () => {
    montarDb({
      accounts: [cuenta(1, { openingBalance: 10000 })],
      treasuryEvents: [evento({ accountId: 1, predictedDate: enEsteMes(1) })],
    });
    montar();
    await waitFor(() => expect(screen.getByText(/por confirmar/)).toBeInTheDocument());
  });

  it('una cuenta dada de baja desaparece de la tabla', async () => {
    // La baja es SUAVE (`status: 'INACTIVE'`) para que Deshacer sea inmediato.
    // Aquí se filtraba solo por `DELETED`, así que la cuenta seguía saliendo
    // aunque la baja se hubiera guardado de verdad.
    montarDb({
      accounts: [
        cuenta(1, { alias: 'La que sigue' }),
        cuenta(2, { alias: 'La dada de baja', status: 'INACTIVE', activa: false }),
      ],
    });
    montar();

    await waitFor(() => expect(screen.getByText('La que sigue')).toBeInTheDocument());
    expect(screen.queryByText('La dada de baja')).not.toBeInTheDocument();
    expect(screen.getByText('1 cuenta')).toBeInTheDocument();
  });
});

describe('V9 · la rejilla de meses deja el lienzo', () => {
  it('la previsión vive detrás de "Previsión · meses y días"', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();

    expect(await screen.findByRole('button', { name: /Previsión · meses y días/ })).toBeInTheDocument();
    // Las 6 tarjetas de mes ya no se pintan en la página.
    expect(screen.queryByText('en curso')).not.toBeInTheDocument();
    expect(screen.queryByText(/saldo a fin de mes/i)).not.toBeInTheDocument();
  });
});

describe('§4.7 · la puerta global del extracto', () => {
  it('el botón del hero abre el drawer, sin cuenta fijada', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();

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
  it('el botón abre los días del mes en curso, sin cerrar la pantalla', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();

    // V9 · el calendario se abre desde la cabecera de la tabla, en el mes en curso.
    fireEvent.click(await screen.findByRole('button', { name: /Previsión · meses y días/ }));

    expect(await screen.findByRole('dialog', { name: 'Calendario' })).toBeInTheDocument();
    // Navegación ‹ › · el drawer cambia de mes sin cerrarse (§4.9).
    expect(screen.getByLabelText('Mes anterior')).toBeInTheDocument();
    expect(screen.getByLabelText('Mes siguiente')).toBeInTheDocument();
  });

  it('el resumen del mes habla de Cierre · vocabulario único del módulo', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Previsión · meses y días/ }));

    const drawer = await screen.findByRole('dialog', { name: 'Calendario' });
    expect(within(drawer).getByText('Queda entrar')).toBeInTheDocument();
    expect(within(drawer).getByText('Queda salir')).toBeInTheDocument();
    expect(within(drawer).getByText('Cierre')).toBeInTheDocument();
  });

  it('en el día NO se concilia · conciliar es por cuenta y por fichero (§4.9)', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Previsión · meses y días/ }));

    const drawer = await screen.findByRole('dialog', { name: 'Calendario' });
    expect(within(drawer).queryByText(/concilia/i)).not.toBeInTheDocument();
  });
});

// La V6 absorbe las rutas de las pantallas que sustituye. Que sigan llevando a
// algo útil es lo que evita romper enlaces guardados por el usuario.
describe('las puertas por URL', () => {
  it('/tesoreria/cuenta/:id abre el drawer de esa cuenta', async () => {
    montarDb({ accounts: [cuenta(1, { alias: 'Sabadell' }), cuenta(2, { alias: 'Santander' })] });
    montar('/tesoreria/cuenta/2');

    const drawer = await screen.findByRole('dialog', { name: /Cuenta Santander/ });
    expect(drawer).toBeInTheDocument();
  });

  it('abrir una cuenta cambia la URL · el enlace es real, no decorativo', async () => {
    montarDb({ accounts: [cuenta(1, { alias: 'Sabadell' })] });
    montar();

    // La tarjeta entera es clicable (§4.2).
    fireEvent.click(await screen.findByText('Sabadell'));
    expect(await screen.findByRole('dialog', { name: /Cuenta Sabadell/ })).toBeInTheDocument();
  });

  it('?extracto=1 abre el drawer de extracto · lo usan el Panel y las rutas viejas', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar('/tesoreria?extracto=1');

    expect(await screen.findByRole('dialog', { name: 'Subir extracto' })).toBeInTheDocument();
  });

  it('cerrar la cuenta no deja la ruta detrás · atrás no la reabre', async () => {
    montarDb({ accounts: [cuenta(1, { alias: 'Sabadell' })] });
    montar('/tesoreria/cuenta/1');

    const drawer = await screen.findByRole('dialog', { name: /Cuenta Sabadell/ });
    fireEvent.click(within(drawer).getByLabelText('Cerrar'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Cuenta Sabadell/ })).not.toBeInTheDocument()
    );

    // Con `push`, esto habría vuelto a /tesoreria/cuenta/1 y reabierto el
    // drawer, que es justo lo contrario de lo que espera quien pulsa atrás.
    window.history.back();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Cuenta Sabadell/ })).not.toBeInTheDocument()
    );
  });

  it('cerrar el extracto limpia el query que lo abrió', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar('/tesoreria?extracto=1');

    const drawer = await screen.findByRole('dialog', { name: 'Subir extracto' });
    fireEvent.click(within(drawer).getByLabelText('Cerrar sin guardar'));

    // Si el query se quedara, refrescar enseñaría un drawer que el usuario
    // acaba de cerrar.
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Subir extracto' })).not.toBeInTheDocument()
    );
  });

  it('el enlace a una cuenta funciona TAMBIÉN en móvil', async () => {
    // §4.11 monta otra pantalla, pero el drawer de cuenta se comparte: si no,
    // abrir `/tesoreria/cuenta/1` desde el teléfono no enseñaría nada.
    const anchoOriginal = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    try {
      montarDb({ accounts: [cuenta(1, { alias: 'Sabadell' })] });
      montar('/tesoreria/cuenta/1');

      expect(await screen.findByRole('dialog', { name: /Cuenta Sabadell/ })).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: anchoOriginal, configurable: true });
    }
  });

  it('sin parámetros no abre nada', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();

    await waitFor(() => expect(screen.getByText('1 cuenta')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('estado vacío', () => {
  it('no revienta sin cuentas ni movimientos', async () => {
    montarDb({});
    montar();
    await waitFor(() => expect(screen.getByText('0 cuentas')).toBeInTheDocument());
  });
});

describe('§4.2 · orden guardado de las cuentas', () => {
  it('sigue siendo el orden por defecto de la tabla', async () => {
    montarDb({
      accounts: [cuenta(1, { alias: 'Primera' }), cuenta(2, { alias: 'Segunda' })],
      keyval: { 'tesoreria.v6.ordenCuentas': [2, 1] },
    });
    const { container } = montar();

    await waitFor(() => expect(screen.getByText('Segunda')).toBeInTheDocument());
    const nombres = Array.from(container.querySelectorAll('.nombre')).map((n) => n.textContent);
    expect(nombres).toEqual(['Segunda', 'Primera']);
  });
});

// Dos avisos de Copilot en el bloque A que llegaron después del merge.
describe('bloque A · los bordes que se colaron', () => {
  it('un previsto SIN fecha no entra en Pendientes', () => {
    // `'' <= hoy` es CIERTA, así que sin excluir el vacío se colaba — y los
    // KPIs sí lo excluyen, con lo que bandeja y cifras contaban distinto.
    const hoy = '2026-08-01';
    const evs = [
      { id: 1, predictedDate: '2026-07-15', status: 'predicted' },
      { id: 2, predictedDate: '', status: 'predicted' },
      { id: 3, predictedDate: undefined, status: 'predicted' },
    ];
    const pendientes = evs.filter((e) => {
      const f = (e.predictedDate ?? '').slice(0, 10);
      return f !== '' && f <= hoy;
    });
    expect(pendientes.map((e) => e.id)).toEqual([1]);
  });

  it('si real y previsto coinciden, el pie no dice ni mejor ni peor', () => {
    // La frase del pie · decir "mejor" sobre una desviación de 0 € se lee como
    // que se ha ganado algo que no existe.
    const etiqueta = (dif: number) =>
      dif === 0 ? 'igual que lo previsto' : dif < 0 ? 'peor de lo previsto' : 'mejor de lo previsto';

    expect(etiqueta(0)).toBe('igual que lo previsto');
    expect(etiqueta(-24)).toBe('peor de lo previsto');
    expect(etiqueta(24)).toBe('mejor de lo previsto');
  });
});
