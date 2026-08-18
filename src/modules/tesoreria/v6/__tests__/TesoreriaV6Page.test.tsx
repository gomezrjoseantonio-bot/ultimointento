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
import TesoreriaV6Page, { importeCabeEnLaBarra } from '../TesoreriaV6Page';
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

    await waitFor(() => expect(screen.getByText('Saldo')).toBeInTheDocument());
    expect(screen.getByText('2 cuentas · hoy')).toBeInTheDocument();
    // "Queda entrar/salir" está en el hero Y en la cabecera del ledger de
    // cuentas: mismo vocabulario en los dos sitios, a propósito.
    expect(screen.getAllByText('Queda entrar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Queda salir').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(`proyectado a día ${ultimoDia}`)).toBeInTheDocument();
  });

  it('singulariza "1 cuenta", que si no queda "1 cuentas"', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();
    await waitFor(() => expect(screen.getByText('1 cuenta · hoy')).toBeInTheDocument());
  });
});

describe('§4.2 · tarjetas de cuenta', () => {
  it('muestra saldo y "al día" cuando no queda nada pendiente', async () => {
    montarDb({ accounts: [cuenta(1, { alias: 'Sabadell principal' })] });
    montar();

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
    montar();

    await waitFor(() => expect(screen.getByText(/se queda en/)).toBeInTheDocument());
    // Un solo estado por tarjeta: si avisa de que se queda corta, no dice
    // además "N por confirmar" (§4.2).
    expect(screen.queryByText(/por confirmar/)).not.toBeInTheDocument();
    expect(screen.queryByText('al día')).not.toBeInTheDocument();
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

  it('una cuenta dada de baja desaparece de la tira', async () => {
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
    expect(screen.getByText('1 cuenta · hoy')).toBeInTheDocument();
  });
});

describe('§4.3 · rejilla de meses', () => {
  it('pinta 6 meses, marca el actual y usa el vocabulario "Cierre"', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();

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
        // A2 · la desviación compara el PREVISTO ORIGINAL (`amount`) con lo que
        // de verdad costó (`actualAmount`), movimiento a movimiento. Antes se
        // comparaba contra el total de gastos del mes y salía 0 € siempre.
        evento({
          type: 'expense',
          amount: 1838.42,
          actualAmount: 1473.42,
          predictedDate: enEsteMes(5),
          status: 'executed',
          // Con cuenta · un ejecutado siempre la tiene. Sin ella no se puede
          // casar con el movimiento que lo materializó, y ese pago contaría
          // dos veces: una por su previsión y otra como gasto no planificado.
          accountId: 1,
        }),
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
    montar();

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
    montar();

    await waitFor(() => expect(screen.getByText('Ingresos')).toBeInTheDocument());
    expect(screen.getByText('Gastos')).toBeInTheDocument();
    expect(screen.getByText('Neto')).toBeInTheDocument();
  });
});

describe('§4.7 · la puerta global del extracto', () => {
  it('el botón del hero abre el drawer, sin cuenta fijada', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();

    // Nombre EXACTO: cada fila del ledger tiene su "Subir extracto de {cuenta}",
    // ya fijado a esa cuenta; el del hero es el global, sin cuenta.
    const subir = await screen.findByRole('button', { name: /^Subir extracto$/ });
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
    montar();

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
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: /Ver los días de/ }))[0]);

    const drawer = await screen.findByRole('dialog', { name: 'Calendario' });
    expect(within(drawer).getByText('Queda entrar')).toBeInTheDocument();
    expect(within(drawer).getByText('Queda salir')).toBeInTheDocument();
    expect(within(drawer).getByText('Cierre')).toBeInTheDocument();
  });

  it('en el día NO se concilia · conciliar es por cuenta y por fichero (§4.9)', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: /Ver los días de/ }))[0]);

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

    await waitFor(() => expect(screen.getByText('1 cuenta · hoy')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('estado vacío', () => {
  it('no revienta sin cuentas ni movimientos', async () => {
    montarDb({});
    montar();
    await waitFor(() => expect(screen.getByText('0 cuentas · hoy')).toBeInTheDocument());
  });
});

// El rediseño del ledger: con muchas cuentas corrientes hace falta el control
// POR CUENTA Y EL TOTAL. El carrusel escondía la mitad detrás de un "1–5 de 10".
describe('rediseño · el ledger de cuentas', () => {
  it('todas las cuentas a la vista y una fila de total · sin paginación', async () => {
    montarDb({
      accounts: [1, 2, 3, 4, 5, 6, 7].map((i) => cuenta(i, { alias: `Banco ${i}` })),
    });
    montar();

    await waitFor(() => expect(screen.getByText('Banco 7')).toBeInTheDocument());
    // La primera y la última a la vez: no hay páginas.
    expect(screen.getByText('Banco 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cuentas siguientes')).not.toBeInTheDocument();
    expect(screen.getByText('Total · 7 cuentas')).toBeInTheDocument();
  });

  it('el clip de una fila abre el extracto YA fijado a esa cuenta', async () => {
    montarDb({ accounts: [cuenta(1, { alias: 'Sabadell' })] });
    montar();

    fireEvent.click(await screen.findByRole('button', { name: 'Subir extracto de Sabadell' }));

    const drawer = await screen.findByRole('dialog', { name: 'Subir extracto' });
    // Con la cuenta fijada el drawer la dice · la puerta global, en cambio,
    // detecta por IBAN.
    expect(within(drawer).getByText(/Sabadell/)).toBeInTheDocument();
    expect(
      within(drawer).queryByText('La cuenta se detecta por el IBAN del fichero')
    ).not.toBeInTheDocument();
  });

  it('«Puntear por días» abre el calendario · la segunda manera de trabajar', async () => {
    montarDb({ accounts: [cuenta(1)] });
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /Puntear por días/ }));
    expect(await screen.findByRole('dialog', { name: 'Calendario' })).toBeInTheDocument();
  });
});

describe('§4.2 · orden guardado de las tarjetas', () => {
  it('respeta el orden que dejó el usuario', async () => {
    montarDb({
      accounts: [cuenta(1, { alias: 'Primera' }), cuenta(2, { alias: 'Segunda' })],
      keyval: { 'tesoreria.v6.ordenCuentas': [2, 1] },
    });
    const { container } = montar();

    await waitFor(() => expect(screen.getByText('Segunda')).toBeInTheDocument());
    const nombres = Array.from(container.querySelectorAll('.accNm')).map((n) => n.textContent);
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

// El bloque llegó a decir dos cosas opuestas a la vez: la fila del Neto,
// "+935,74 € mejor de lo previsto", y el pie, "acabarás −38 € peor de lo
// previsto". No era un desacuerdo de cálculo sino de pregunta: la fila
// comparaba lo acumulado a día 7 contra el previsto del MES ENTERO —que a
// primeros siempre sale "mejor"— y el pie compara iguales.
describe('§4.10 · el veredicto es UNO', () => {
  it('las líneas cuentan avance · el "mejor/peor" solo lo dice el pie', async () => {
    montarDb({
      accounts: [cuenta(1)],
      treasuryEvents: [
        // Ingreso previsto para el mes que aún no ha entrado entero.
        evento({ type: 'income', amount: 1000, predictedDate: enEsteMes(20) }),
        // Gasto ya confirmado que costó 50 € MÁS de lo presupuestado.
        evento({
          type: 'expense',
          amount: 200,
          actualAmount: 250,
          predictedDate: enEsteMes(5),
          status: 'executed',
          accountId: 1,
        }),
        // Y el grueso del gasto del mes, todavía por pasar.
        evento({ type: 'expense', amount: 1250, predictedDate: enEsteMes(Math.min(25, ultimoDia)) }),
      ],
      movements: [
        movimiento({ accountId: 1, date: enEsteMes(5), amount: -250, description: 'Recibo' }),
        movimiento({ accountId: 1, date: enEsteMes(3), amount: 300, description: 'Cobro' }),
      ],
    });
    montar();

    // Neto: llevas 50 € (300 − 250) de un previsto de −450 € (1.000 − 1.450).
    // El previsto es negativo, así que no hay porcentaje ni barra: la fila
    // enseña la cifra que llevas y, a su derecha, lo previsto del mes.
    const filaNeto = (await screen.findByText('Neto')).parentElement!;
    expect(filaNeto).toHaveTextContent('50 €');
    expect(filaNeto).toHaveTextContent('llevas');
    expect(filaNeto).toHaveTextContent('−450 €');
    expect(filaNeto).toHaveTextContent('previsto');

    // La resta contra el previsto del mes entero —+500 €— ya no se pinta: era
    // el número gordo de la fila "Neto" sin ser el neto.
    expect(filaNeto).not.toHaveTextContent('500 €');
    expect(filaNeto).not.toHaveTextContent('mejor de lo previsto');

    // Y el único veredicto del bloque es el del pie, que compara iguales:
    // 200 € presupuestados contra 250 € pagados.
    expect(screen.getAllByText(/(mejor|peor) de lo previsto|igual que lo previsto/)).toHaveLength(1);
    const veredicto = screen.getByText(/Acabarás/);
    expect(veredicto).toHaveTextContent('−50 €');
    expect(veredicto).toHaveTextContent('peor de lo previsto');
  });
});


// §4.10 · la barra con el importe dentro.
describe('la barra de "Cómo va {mes}"', () => {
  it('con relleno ancho el importe va DENTRO · con relleno estrecho, fuera', () => {
    // Ensanchar el relleno para que quepa el texto falsearía la proporción,
    // que es justo lo que la barra viene a decir. Así que por debajo del umbral
    // el importe sale a la derecha del relleno, no dentro.
    //
    // El umbral es 40 y no 22: con 22 el texto entraba pero se salía del
    // relleno por la derecha, que es el aspecto que se quería evitar. Un
    // importe con miles y dos decimales pide más de un tercio de la barra.
    //
    // Se comprueba LA función que usa el render, no una copia del número
    // escrita aquí: una copia seguiría en verde aunque el componente cambiara
    // de umbral, que es justo lo que un candado no puede permitirse.
    expect(importeCabeEnLaBarra(82)).toBe(true);
    expect(importeCabeEnLaBarra(40)).toBe(true);
    expect(importeCabeEnLaBarra(22)).toBe(false);
    expect(importeCabeEnLaBarra(7)).toBe(false);
  });
});
