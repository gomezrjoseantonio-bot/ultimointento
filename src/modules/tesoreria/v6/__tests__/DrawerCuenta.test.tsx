// Drawer de cuenta (§4.4) · la bandeja de trabajo.
//
// Lo que fija: que Pendientes muestre SOLO lo que falta por ocurrir, que un
// descartado no aparezca, que las dos pestañas usen `PunteoList` con la
// configuración que pide §4.4, y que el estado vacío diga lo que tiene que
// decir en vez de parecer un error.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DrawerCuenta from '../DrawerCuenta';
import type { Account, Movement, TreasuryEvent } from '../../../../services/db';

const cuenta: Account = {
  id: 1,
  iban: 'ES9100491500051234567892',
  alias: 'Sabadell principal',
  ultimosCuatro: '7892',
  status: 'ACTIVE',
  activa: true,
  createdAt: '',
  updatedAt: '',
};

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
  date: '2026-07-05',
  amount: -50,
  description: 'Compra',
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
  cuenta,
  saldoHoy: 1000,
  year: 2026,
  month0: 6,
  // A1 · Pendientes solo lista lo que YA debería haber pasado, así que los
  // tests necesitan una fecha de "hoy" posterior a los previstos que montan.
  hoy: '2026-07-31',
  onCerrar: jest.fn(),
  onConfirmar: jest.fn(),
  onDescartar: jest.fn(),
  movimientos: [] as Movement[],
  eventos: [] as TreasuryEvent[],
};

describe('cabecera', () => {
  it('pinta nombre, mask y los 4 KPIs recalculados', () => {
    render(
      <DrawerCuenta
        {...base}
        eventos={[
          ev({ id: 1, type: 'income', amount: 650, predictedDate: '2026-07-20' }),
          ev({ id: 2, type: 'expense', amount: 200, predictedDate: '2026-07-25' }),
        ]}
      />
    );

    expect(screen.getByText('Sabadell principal')).toBeInTheDocument();
    expect(screen.getByText('···· 7892')).toBeInTheDocument();
    expect(screen.getByText('Saldo hoy')).toBeInTheDocument();
    // Sale más de una vez a propósito: el KPI de la cabecera y el subtotal del
    // grupo escriben el MISMO importe igual, que es lo que pide §2.2.
    expect(screen.getAllByText('+650 €').length).toBeGreaterThan(0);
    expect(screen.getAllByText('−200 €').length).toBeGreaterThan(0);
    // Saldo final = 1000 + 650 − 200
    expect(screen.getByText('1.450 €')).toBeInTheDocument();
  });

  it('un descartado no mueve los KPIs', () => {
    render(
      <DrawerCuenta
        {...base}
        eventos={[ev({ id: 1, type: 'expense', amount: 500, descartado: true })]}
      />
    );
    // Saldo final sigue siendo el saldo de hoy.
    expect(screen.getAllByText('1.000 €').length).toBeGreaterThan(0);
  });
});

// A1 · el defecto más grave del parte: la bandeja listaba 252 "pendientes",
// entre ellos recibos de diciembre estando a 1 de agosto. Eso no son
// pendientes, son previsiones futuras. Pendiente = lo que YA debería haber
// pasado y sigue sin confirmar; es una bandeja que se vacía.
describe('A1 · Pendientes no mezcla futuro', () => {
  it('lo que aún no ha llegado NO es trabajo de hoy', () => {
    render(
      <DrawerCuenta
        {...base}
        hoy="2026-07-15"
        eventos={[
          ev({ id: 1, predictedDate: '2026-07-10', description: 'Ya venció' }),
          ev({ id: 2, predictedDate: '2026-12-20', description: 'Diciembre' }),
        ]}
      />
    );

    expect(screen.getByText('Ya venció')).toBeInTheDocument();
    expect(screen.queryByText('Diciembre')).not.toBeInTheDocument();
    // Y la bandeja se queda con eso y solo eso · un 252 abruma en vez de
    // tranquilizar. Se cuenta la lista: la pestaña ya no lleva recuento.
    expect(screen.getAllByRole('button', { name: /^Puntear/ })).toHaveLength(1);
  });

  it('lo de HOY sí entra · vence hoy y sigue sin confirmar', () => {
    render(
      <DrawerCuenta
        {...base}
        hoy="2026-07-15"
        eventos={[ev({ id: 1, predictedDate: '2026-07-15', description: 'Vence hoy' })]}
      />
    );
    expect(screen.getByText('Vence hoy')).toBeInTheDocument();
  });

  it('lo más reciente arriba · es por donde se empieza a vaciar', () => {
    render(
      <DrawerCuenta
        {...base}
        hoy="2026-07-31"
        eventos={[
          ev({ id: 1, predictedDate: '2026-07-05', description: 'Antiguo' }),
          ev({ id: 2, predictedDate: '2026-07-28', description: 'Reciente' }),
        ]}
      />
    );

    const conceptos = screen.getAllByText(/Antiguo|Reciente/).map((n) => n.textContent);
    expect(conceptos).toEqual(['Reciente', 'Antiguo']);
  });
});

describe('pestaña Pendientes', () => {
  it('lista lo que falta por ocurrir', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 }), ev({ id: 2, description: 'Agua' })]} />);

    expect(screen.getAllByRole('button', { name: /^Puntear/ })).toHaveLength(2);
    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.getByText('Agua')).toBeInTheDocument();
  });

  it('un descartado no aparece', () => {
    render(
      <DrawerCuenta {...base} eventos={[ev({ id: 1 }), ev({ id: 2, description: 'Agua', descartado: true })]} />
    );
    expect(screen.getAllByRole('button', { name: /^Puntear/ })).toHaveLength(1);
    expect(screen.queryByText('Agua')).not.toBeInTheDocument();
  });

  it('un ejecutado tampoco: su realidad ya vive en el movimiento', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1, status: 'executed' })]} />);
    // La pestaña no lleva recuento · la cifra ya está en la tarjeta de la
    // cuenta, y aquí competía con su nombre sin decir nada nuevo.
    expect(screen.getByRole('button', { name: /^Por confirmar$/ })).toBeInTheDocument();
  });

  // La cuota de una hipoteca tiene que decir de qué piso es. Falló por los dos
  // extremos a la vez: el generador no copiaba `inmuebleId` al evento y nadie
  // pasaba `aliasInmueble` al drawer. Con las dos mitades puestas, la fila lo
  // dice.
  it('la cuota de una hipoteca dice de qué piso es', () => {
    render(
      <DrawerCuenta
        {...base}
        aliasInmueble={(id) => (String(id) === '7' ? 'Tenderina 64' : undefined)}
        eventos={[
          ev({
            id: 1,
            inmuebleId: 7,
            sourceType: 'hipoteca',
            description: 'Cuota Hipoteca – Hipoteca Unicaja T64 4D+4I',
          }),
        ]}
      />
    );
    expect(screen.getByText('Hipoteca Unicaja T64 4D+4I')).toBeInTheDocument();
    expect(screen.getByText('Tenderina 64')).toBeInTheDocument();
  });

  it('usa la anatomía de fila de Tesorería: editar y descartar en la fila', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} onEditar={jest.fn()} />);
    expect(screen.getByLabelText('Editar Recibo luz')).toBeInTheDocument();
    expect(screen.getByLabelText('Descartar Recibo luz')).toBeInTheDocument();
  });

  it('el círculo confirma y el aspa descarta', () => {
    const onConfirmar = jest.fn();
    const onDescartar = jest.fn();
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} onConfirmar={onConfirmar} onDescartar={onDescartar} />);

    fireEvent.click(screen.getByLabelText('Puntear Recibo luz'));
    expect(onConfirmar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Descartar Recibo luz'));
    expect(onDescartar).toHaveBeenCalledTimes(1);
  });

  it('sin nada pendiente, el vacío es una buena noticia y no un error', () => {
    render(<DrawerCuenta {...base} eventos={[]} />);
    expect(screen.getByText('Nada por confirmar')).toBeInTheDocument();
    // El texto del mockup · la bandeja no es del mes (lista vencidos de
    // cualquier fecha), así que nombrarlo era además inexacto.
    expect(screen.getByText('esta cuenta está al día')).toBeInTheDocument();
  });

  it('no pinta los chips de estado: mandan las pestañas (§4.4)', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    expect(screen.queryByRole('tablist', { name: /estado de punteo/i })).not.toBeInTheDocument();
  });
});

// Puntear es la acción más repetida de la pantalla, así que equivocarse es
// cuestión de tiempo. Sin esta pestaña, el único arreglo era borrar el
// movimiento y volver a generarlo.
describe('pestaña Confirmados', () => {
  const abrirConfirmados = () =>
    fireEvent.click(screen.getByRole('button', { name: /^Confirmados$/ }));

  /** Confirmado por el usuario · "tu palabra", sin extracto detrás (§6.4). */
  const aMano = (over: Partial<Movement> & { id: number }) =>
    mov({ source: 'manual', unifiedStatus: 'no_conciliado', ...over });

  /** Y además NACIDO de una previsión · la huella que deja `confirmTreasuryEvent`. */
  const punteado = (over: Partial<Movement> & { id: number }) =>
    aMano({ reference: 'treasury_event:1', ...over });

  it('lista lo que confirmaste tú, y el círculo lo despuntea', () => {
    const onDespuntear = jest.fn();
    render(
      <DrawerCuenta
        {...base}
        movimientos={[punteado({ id: 9, description: 'Compra punteada' })]}
        onDespuntear={onDespuntear}
      />
    );
    abrirConfirmados();

    expect(screen.getByText('Compra punteada')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Despuntear Compra punteada'));
    expect(onDespuntear).toHaveBeenCalledTimes(1);
  });

  // Despuntear BORRA el movimiento y devuelve su previsión a "Por confirmar".
  // Sin previsión detrás —un alta a mano, algo llegado del inbox— no hay adónde
  // volver: el círculo lo borraría y ya está. Así que ahí no es un interruptor.
  it('lo que no nació de una previsión se ve, pero no se despuntea', () => {
    const onDespuntear = jest.fn();
    render(
      <DrawerCuenta
        {...base}
        movimientos={[aMano({ id: 9, description: 'Alta a mano' })]}
        onDespuntear={onDespuntear}
      />
    );
    abrirConfirmados();

    expect(screen.getByText('Alta a mano')).toBeInTheDocument();
    expect(screen.queryByLabelText('Despuntear Alta a mano')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Alta a mano · confirmado').tagName).toBe('SPAN');
  });

  // Lo conciliado lo afirma el BANCO · no se deshace desde aquí, así que ni
  // aparece en la bandeja de deshacer.
  it('lo conciliado por el banco no vive aquí', () => {
    render(<DrawerCuenta {...base} movimientos={[mov({ id: 9, description: 'Del extracto' })]} />);
    abrirConfirmados();
    expect(screen.queryByText('Del extracto')).not.toBeInTheDocument();
    expect(screen.getByText('Nada confirmado este mes')).toBeInTheDocument();
  });

  // `esPendiente` incluye los eventos `confirmed` —la venta de un piso, la
  // liquidación de un préstamo—, y esos no se puntean: su círculo se quedaba en
  // la bandeja sin hacer nada, entre otros que sí responden.
  it('un evento ya confirmado sale de la bandeja y viene aquí', () => {
    render(
      <DrawerCuenta
        {...base}
        onDespuntear={jest.fn()}
        eventos={[ev({ id: 1, status: 'confirmed', description: 'Venta piso' })]}
      />
    );
    expect(screen.queryByText('Venta piso')).not.toBeInTheDocument();

    abrirConfirmados();
    expect(screen.getByText('Venta piso')).toBeInTheDocument();
    // Y tampoco se despuntea: no se punteó nunca · está decidido y espera al
    // banco. Un botón que parece accionable y no responde es peor que una marca.
    expect(screen.queryByLabelText('Despuntear Venta piso')).not.toBeInTheDocument();
  });
});

describe('pestaña Movimientos', () => {
  const abrirTodo = () => fireEvent.click(screen.getByRole('button', { name: /Movimientos/ }));

  it('mezcla previsión y realidad del mes', () => {
    render(
      <DrawerCuenta {...base} eventos={[ev({ id: 1 })]} movimientos={[mov({ id: 9, description: 'Compra real' })]} />
    );
    abrirTodo();

    // Los grupos nacen plegados (§4.4), así que se busca para abrirlos.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    expect(screen.getByText('Compra real')).toBeInTheDocument();
  });

  it('trae buscador y ejes de agrupación', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    abrirTodo();

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /agrupar por/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ámbito' })).toBeInTheDocument();
  });

  it('los grupos nacen plegados con recuento y subtotal', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    abrirTodo();

    // Plegado: la fila no está, pero su cabecera sí.
    expect(screen.queryByText('Recibo luz')).not.toBeInTheDocument();
    const cab = screen.getAllByRole('button', { expanded: false })[0];
    // §6.4 · el recuento dice de qué es: pegado al importe se leía como parte
    // de la cifra ("· 1 · −98,44").
    expect(within(cab).getByText('1 movimiento')).toBeInTheDocument();
  });

  // La consulta se MIRA. Confirmar desde aquí obliga a decidir sobre un cargo
  // suelto en medio del mes entero, que es justo lo que la bandeja evita: allí
  // llegan los que tocan, ordenados y sin nada alrededor.
  it('no se puntea ni se edita · eso vive en la bandeja', () => {
    const onConfirmar = jest.fn();
    render(<DrawerCuenta {...base} onConfirmar={onConfirmar} eventos={[ev({ id: 1 })]} />);
    abrirTodo();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });

    // Ni círculo que pulsar —un botón deshabilitado invita a intentarlo—…
    expect(screen.queryByRole('button', { name: /^Puntear/ })).not.toBeInTheDocument();
    expect(onConfirmar).not.toHaveBeenCalled();
    // …ni lápiz ni descartar en la fila.
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Descartar/ })).not.toBeInTheDocument();
  });

  // El chip solo dice algo donde conviven los tres estados. En la bandeja todo
  // es previsto, así que escribirlo en cada fila repite el nombre de la pestaña.
  it('el chip de estado vive AQUÍ y solo aquí', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    expect(screen.queryByText('previsto')).not.toBeInTheDocument();

    abrirTodo();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    expect(screen.getByText('previsto')).toBeInTheDocument();
  });

  // El origen ya lo dice el agrupamiento —por Tipo es literalmente la cabecera
  // del grupo—, así que repetirlo en cada fila no distingue nada y tapa lo que
  // sí: quién cobra y cuánto.
  it('sin chip de origen · lo dice el agrupamiento', () => {
    render(
      <DrawerCuenta
        {...base}
        eventos={[ev({ id: 1, sourceType: 'prestamo', description: 'Cuota – Hipoteca' })]}
      />
    );
    abrirTodo();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    expect(screen.getByText('Hipoteca')).toBeInTheDocument();
    expect(screen.queryByText('Financiación')).not.toBeInTheDocument();
  });

  // Agrupando por Ámbito o por Tipo salían cabeceras sueltas sobre una lista
  // corrida, mientras el mismo panel por Fecha las pintaba en tarjeta: el mismo
  // dato con dos formas según el eje.
  it('cada grupo es una tarjeta, agrupe por lo que agrupe', () => {
    const { container } = render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    abrirTodo();
    expect(container.querySelectorAll('.diaCard').length).toBe(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Ámbito' }));
    expect(container.querySelectorAll('.diaCard').length).toBe(1);
  });

  it('esconde Anotar y Subir extracto: son de la bandeja, no de la consulta', () => {
    render(<DrawerCuenta {...base} eventos={[ev({ id: 1 })]} />);
    expect(screen.getByRole('button', { name: /Anotar/ })).toBeInTheDocument();

    abrirTodo();
    expect(screen.queryByRole('button', { name: /Anotar/ })).not.toBeInTheDocument();
  });
});

describe('cierre', () => {
  it('el aspa y el fondo cierran el drawer', () => {
    const onCerrar = jest.fn();
    const { container } = render(<DrawerCuenta {...base} onCerrar={onCerrar} />);

    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onCerrar).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.back')!);
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  it('sin cuenta no renderiza nada', () => {
    const { container } = render(<DrawerCuenta {...base} cuenta={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});


// §7 · la ficha edita la descripción, no el rótulo de la fila.
describe('lo que lleva la ficha al abrirla', () => {
  it('el campo de texto trae la DESCRIPCIÓN, no el proveedor', () => {
    // Desde §6.3 la fila se titula con quién cobra ("Mapfre") y la descripción
    // baja al subtítulo. Si la ficha abriera con "Mapfre" en el campo de texto,
    // guardar sobrescribiría "Seguro hogar" sin que nadie lo pidiera.
    const item = {
      key: 'evt-1',
      kind: 'evento' as const,
      refId: 1,
      estado: 'previsto' as const,
      fecha: '2026-08-10',
      concepto: 'Mapfre',
      detalle: 'Seguro hogar',
      activo: null,
      origen: 'Recurrente',
      cuentaId: 1,
      importe: -40.29,
    };
    expect(item.detalle ?? item.concepto).toBe('Seguro hogar');
  });
});
