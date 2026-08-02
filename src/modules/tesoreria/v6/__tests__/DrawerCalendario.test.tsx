// Calendario diario (§4.9) · el día elegido.
//
// Lo que fija:
//   · el calendario mira HACIA DELANTE · solo lo que el saldo de hoy no
//     incorpora todavía. Lo ya pasado vive en la cuenta (§4.4), que es donde se
//     mira el histórico; enseñándolo también aquí, un día no se vaciaba nunca
//     al terminarlo.
//   · pero un movimiento con fecha adelantada SÍ entra: no pide confirmar nada
//     y sin embargo mueve dinero ese día, y si es él quien deja la cuenta corta
//     tiene que haber una fila que lo explique.
//   · el día va agrupado POR CUENTA, como al entrar por la cuenta: bajo el
//     nombre de cada una, lo suyo.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DrawerCalendario from '../DrawerCalendario';
import type { Account, Movement, TreasuryEvent } from '../../../../services/db';

const cuenta = (id: number, alias: string): Account => ({
  id,
  iban: `ES910049150005123456789${id}`,
  alias,
  status: 'ACTIVE',
  activa: true,
  createdAt: '',
  updatedAt: '',
});

const ev = (over: Partial<TreasuryEvent> & { id: number }): TreasuryEvent => ({
  type: 'expense',
  amount: 100,
  predictedDate: '2026-07-20',
  description: 'Recibo luz',
  sourceType: 'manual',
  status: 'predicted',
  accountId: 1,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const mov = (over: Partial<Movement> & { id: number }): Movement => ({
  accountId: 1,
  date: '2026-07-20',
  amount: -50,
  description: 'Compra ya conciliada',
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

const base = {
  abierto: true,
  year: 2026,
  month0: 6,
  hoy: '2026-07-01',
  onMes: jest.fn(),
  cuentas: [cuenta(1, 'Abanca'), cuenta(2, 'Unicaja')],
  saldoPorCuenta: new Map([
    [1, 5000],
    [2, 5000],
  ]),
  saldoTotalHoy: 10000,
  onCerrar: jest.fn(),
  onConfirmar: jest.fn(),
  onDescartar: jest.fn(),
  onConfirmarDia: jest.fn(),
  movimientos: [] as Movement[],
  eventos: [] as TreasuryEvent[],
};

/** Abre el día 20 de julio, que es donde estos tests montan todo. */
function abrirDia20() {
  fireEvent.click(screen.getByRole('gridcell', { name: /^20 de julio/ }));
}

describe('solo lo que todavía no ha movido dinero', () => {
  // `hoy` es el 1 de julio, así que un movimiento del día 20 está ADELANTADO:
  // para que quede "ya pasado" hay que ponerle fecha anterior a hoy.
  const yaPasado = { ...base, hoy: '2026-07-31' };

  it('un movimiento ya pasado NO sale en el día · su sitio es la cuenta', () => {
    render(
      <DrawerCalendario
        {...yaPasado}
        eventos={[ev({ id: 1, description: 'Recibo luz' })]}
        movimientos={[mov({ id: 90, description: 'Compra ya conciliada' })]}
      />
    );
    abrirDia20();

    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.queryByText('Compra ya conciliada')).not.toBeInTheDocument();
    // Y queda UNA fila · el recuento ya no se escribe (su sitio en la cabecera
    // es el de las acciones), así que lo que se comprueba es la lista.
    expect(screen.getAllByRole('button', { name: /^Puntear/ })).toHaveLength(1);
  });

  // Las acciones colgaban al final del panel, en un blanco que no era de
  // nadie: con el día en una línea y los botones tres más abajo, no se leía
  // que "confirmar el día" fuera ESE día. Van con su nombre.
  it('las acciones del día viajan con el día, en su cabecera', () => {
    render(<DrawerCalendario {...base} eventos={[ev({ id: 1 })]} onAnotar={jest.fn()} />);
    abrirDia20();
    const cabecera = screen.getByText(/^Lunes 20/).parentElement as HTMLElement;
    expect(within(cabecera).getByRole('button', { name: /Confirmar el día/ })).toBeInTheDocument();
    expect(within(cabecera).getByRole('button', { name: /Anotar movimiento/ })).toBeInTheDocument();
  });

  it('un día que ya ocurrió entero queda vacío, y lo dice', () => {
    render(<DrawerCalendario {...yaPasado} movimientos={[mov({ id: 90 })]} />);
    abrirDia20();
    expect(screen.getByText('Nada pendiente este día')).toBeInTheDocument();
  });

  it('la celda tampoco cuenta lo ya pasado', () => {
    render(<DrawerCalendario {...yaPasado} movimientos={[mov({ id: 90 })]} />);
    expect(
      screen.getByRole('gridcell', { name: /^20 de julio · nada pendiente/ })
    ).toBeInTheDocument();
  });

  it('un movimiento ADELANTADO sí sale · es quien puede dejar la cuenta corta', () => {
    // Con hoy = 1 de julio, el del día 20 aún no está en el saldo.
    render(<DrawerCalendario {...base} movimientos={[mov({ id: 90, description: 'Recibo adelantado' })]} />);
    abrirDia20();
    expect(screen.getByText('Recibo adelantado')).toBeInTheDocument();
  });

  it('un evento ya confirmado se pinta, pero no se lee como tarea', () => {
    // `confirmed` es una venta o una liquidación: está decidido y solo espera
    // al banco. Mueve dinero, así que tiene que verse; y el chip lo separa del
    // previsto, que es el que sí hay que confirmar.
    //
    // El previsto NO lleva chip: en una pantalla que existe para enseñar
    // previsiones, escribir "previsto" en cada fila no dice nada nuevo. Solo
    // se marca el que se sale de la norma.
    render(
      <DrawerCalendario
        {...base}
        eventos={[
          ev({ id: 1, description: 'Recibo luz' }),
          ev({ id: 2, description: 'Venta piso', status: 'confirmed', type: 'income', amount: 200000 }),
        ]}
      />
    );
    abrirDia20();
    expect(screen.getByText('Venta piso')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.queryByText('Por confirmar')).not.toBeInTheDocument();
  });
});

describe('la fila dice de quién es el cargo y de qué piso', () => {
  // Un recibo trae `proveedor` y la fila sale sola. Un préstamo o una nómina no
  // lo traen, y su fila se quedaba con las dos mitades pegadas en el título y
  // el subtítulo vacío — la misma información que el recibo de al lado, con
  // otra estructura.
  it('la cuota de un préstamo pone el préstamo arriba y "Cuota" debajo', () => {
    render(
      <DrawerCalendario
        {...base}
        eventos={[
          ev({
            id: 1,
            sourceType: 'prestamo',
            description: 'Cuota Hipoteca – Hipoteca Unicaja T64 4D+4I',
          }),
        ]}
      />
    );
    abrirDia20();
    expect(screen.getByText('Hipoteca Unicaja T64 4D+4I')).toBeInTheDocument();
    expect(screen.getByText('Cuota Hipoteca')).toBeInTheDocument();
  });

  it('la nómina, igual · la empresa arriba', () => {
    render(
      <DrawerCalendario
        {...base}
        eventos={[
          ev({ id: 1, sourceType: 'nomina', type: 'income', description: 'Nómina – ORANGE ESPAGNE SA' }),
        ]}
      />
    );
    abrirDia20();
    expect(screen.getByText('ORANGE ESPAGNE SA')).toBeInTheDocument();
    expect(screen.getByText('Nómina')).toBeInTheDocument();
  });

  // §6.3 · las habitaciones cuelgan de SU PISO.
  //
  // `punteoAdapter` arma el grupo madre con `inmueble-${inmuebleId}`, pero el
  // generador no copiaba el id al evento del contrato: cada habitación salía
  // suelta, una detrás de otra, sin que se viera que son el mismo piso.
  it('las rentas de un piso por habitaciones cuelgan del piso', () => {
    const renta = (id: number, quien: string, importe: number, hab: string) =>
      ev({
        id,
        type: 'income',
        amount: importe,
        sourceType: 'contrato',
        inmuebleId: 2,
        unidadInmueble: hab,
        description: `Renta – ${quien}`,
      });

    render(
      <DrawerCalendario
        {...base}
        aliasInmueble={(id) => (String(id) === '2' ? 'Tenderina 64 4D' : undefined)}
        eventos={[
          renta(1, 'MIGUEL LORENZO CABANELAS', 395, 'hab-1'),
          renta(2, 'EMILIO CARRERA RIOS', 395, 'hab-2'),
        ]}
      />
    );
    abrirDia20();

    // La madre dice QUÉ es y DE DÓNDE, una sola vez.
    const madre = screen.getByRole('button', { name: /Alquiler . Tenderina 64 4D/ });
    expect(madre).toBeInTheDocument();
    expect(screen.getByText(/2 rentas/)).toBeInTheDocument();

    // CERRADA de entrada · el piso se resume en una línea.
    expect(madre).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('MIGUEL LORENZO CABANELAS')).not.toBeInTheDocument();

    // Se abre al pulsarla, y ahí cada hija se queda con lo suyo: el inquilino
    // —sin el "Renta – " que ya encabeza el grupo— y su habitación, con el
    // `hab-1` del contrato convertido en "Hab 1" y no en "Hab hab-1".
    fireEvent.click(madre);
    expect(screen.getByText('MIGUEL LORENZO CABANELAS')).toBeInTheDocument();
    expect(screen.getByText('EMILIO CARRERA RIOS')).toBeInTheDocument();
    expect(screen.getByText('Hab 1')).toBeInTheDocument();
    expect(screen.getByText('Hab 2')).toBeInTheDocument();
  });

  // Si el alias no se resuelve, la madre dice "Alquiler" a secas. Nunca el
  // nombre de un inquilino: el grupo volvería a titularse con una de sus
  // partes, que es justo lo que la madre viene a evitar.
  it('sin alias del piso, la madre NO se titula con un inquilino', () => {
    const renta = (id: number, quien: string) =>
      ev({
        id,
        type: 'income',
        amount: 395,
        sourceType: 'contrato',
        inmuebleId: 2,
        description: `Renta – ${quien}`,
      });

    render(
      <DrawerCalendario
        {...base}
        aliasInmueble={() => undefined}
        eventos={[renta(1, 'MIGUEL LORENZO CABANELAS'), renta(2, 'EMILIO CARRERA RIOS')]}
      />
    );
    abrirDia20();

    expect(screen.getByRole('button', { name: /Alquiler/ })).toBeInTheDocument();
    // El inquilino NO encabeza el grupo · con la madre cerrada ni siquiera se
    // ve, que para eso se pulsa.
    expect(screen.queryByText('MIGUEL LORENZO CABANELAS')).not.toBeInTheDocument();
  });

  it('un piso completo · una sola renta NO monta grupo', () => {
    render(
      <DrawerCalendario
        {...base}
        aliasInmueble={() => 'Tenderina 64 4D'}
        eventos={[
          ev({
            id: 1,
            type: 'income',
            amount: 1350,
            sourceType: 'contrato',
            inmuebleId: 2,
            description: 'Renta – ALISSER REAL ESTATE',
          }),
        ]}
      />
    );
    abrirDia20();
    // Sin habitación no hay madre que lo encabece, así que lo dice la propia
    // fila: qué es y de qué piso arriba, el inquilino debajo.
    expect(screen.getByText('Alquiler · Tenderina 64 4D')).toBeInTheDocument();
    expect(screen.getByText('ALISSER REAL ESTATE')).toBeInTheDocument();
    // Y el piso UNA vez: llevándolo el título, la marca de debajo lo repetía.
    expect(screen.getAllByText(/Tenderina 64 4D/)).toHaveLength(1);
    expect(screen.queryByText(/1 renta$/)).not.toBeInTheDocument();
  });

  // El puente que faltaba: los dos drawers declaraban `aliasInmueble` y nadie
  // se la pasaba, así que ninguna fila de la V6 decía de qué piso era.
  it('resuelve el inmueble del cargo', () => {
    render(
      <DrawerCalendario
        {...base}
        aliasInmueble={(id) => (String(id) === '7' ? 'Tenderina 64' : undefined)}
        eventos={[ev({ id: 1, inmuebleId: 7, sourceType: 'prestamo', description: 'Cuota – Hipoteca T64' })]}
      />
    );
    abrirDia20();
    expect(screen.getByText('Tenderina 64')).toBeInTheDocument();
  });
});

describe('el lápiz de la fila', () => {
  // El lápiz lo pinta `rowVariant: 'tesoreria'` desde el principio, pero el
  // drawer declaraba `onEditar` y NADIE se lo pasaba: el mismo hueco que tenía
  // `aliasInmueble`. Sin él no había forma de corregir un previsto desde el día.
  it('existe y abre la ficha del movimiento', () => {
    render(
      <DrawerCalendario
        {...base}
        onGuardarFicha={jest.fn()}
        eventos={[ev({ id: 1, description: 'Recibo luz' })]}
      />
    );
    abrirDia20();

    const lapiz = screen.getByLabelText('Editar Recibo luz');
    expect(lapiz).toBeInTheDocument();
    fireEvent.click(lapiz);
    expect(screen.getByRole('dialog', { name: /movimiento/i })).toBeInTheDocument();
  });

  // Sin dónde guardar, la ficha se abriría, se rellenaría y al pulsar Guardar
  // se cerraría sin haber guardado: el usuario se queda creyendo que lo hizo.
  it('no se ofrece si no hay dónde guardar', () => {
    render(<DrawerCalendario {...base} eventos={[ev({ id: 1, description: 'Recibo luz' })]} />);
    abrirDia20();
    expect(screen.queryByLabelText('Editar Recibo luz')).not.toBeInTheDocument();
  });
});

describe('el día, agrupado por cuenta', () => {
  it('pone cada cargo bajo el nombre de SU cuenta', () => {
    render(
      <DrawerCalendario
        {...base}
        eventos={[
          ev({ id: 1, accountId: 1, description: 'Recibo luz' }),
          ev({ id: 2, accountId: 2, description: 'Seguro hogar' }),
          ev({ id: 3, accountId: 1, description: 'Recibo agua' }),
        ]}
      />
    );
    abrirDia20();

    expect(screen.getByText('Abanca')).toBeInTheDocument();
    expect(screen.getByText('Unicaja')).toBeInTheDocument();
    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.getByText('Seguro hogar')).toBeInTheDocument();
  });

  it('con una sola cuenta la cabecera SIGUE estando · dice de dónde sale todo', () => {
    // Agrupando por fecha se calla, porque repetiría el día que ya encabeza el
    // panel. Por cuenta no repite nada: es el dato que la lista plana no daba.
    render(<DrawerCalendario {...base} eventos={[ev({ id: 1, accountId: 1 })]} />);
    abrirDia20();
    expect(screen.getByText('Abanca')).toBeInTheDocument();
  });
});
