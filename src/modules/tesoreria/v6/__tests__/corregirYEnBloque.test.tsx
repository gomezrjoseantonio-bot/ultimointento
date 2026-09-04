// ============================================================================
// La pantalla, montada · abrir los montones, corregirlos, buscar y actuar en bloque
// ============================================================================
//
// Lo que Jose no podía hacer con 334 líneas del Santander delante:
//
//   «los ok que me das personal y no personal no veo lo que hay dentro, además
//    si te equivocas ni puedo corregirlo... no hay opción de buscar... por
//    ejemplo buscar todo lo que sean bizums y marcarlos e ignorarlos o
//    clasificarlos todos a la vez»
//
// Cuatro cosas, y las cuatro se prueban aquí sobre los componentes de verdad:
// que el montón se abre, que dentro hay líneas, que cada una tiene su vuelta
// atrás, y que se puede filtrar y coger varias de un gesto.
// ============================================================================

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PanelConciliar from '../conciliar/PanelConciliar';
import ColumnaResto from '../conciliar/ColumnaResto';
import type { LineaExtracto } from '../extractoSesion';
import type { Cuadre } from '../conciliarBuckets';

const linea = (id: number, texto: string, importe = -66.9): LineaExtracto => ({
  // E1.2b · los gestos reciben lineaId (100 + id), no movementId.
  lineaId: 100 + id,
  movementId: id,
  hashLinea: `h${id}`,
  textoBanco: texto,
  fecha: '2026-08-24',
  importe,
  veredicto: 'resolver',
});

// ─── La columna derecha · abrir y corregir ──────────────────────────────────

function pintarResto(over: Partial<React.ComponentProps<typeof ColumnaResto>> = {}) {
  return render(
    <ColumnaResto
      resueltas={[]}
      personales={[]}
      ignoradas={[]}
      aprendido={{ nuevas: [], deAntes: 0, total: 0 }}
      onRecuperar={() => undefined}
      onNoEsEsto={() => undefined}
      {...over}
    />,
  );
}

describe('el montón se abre · ver qué hay dentro de un «ok»', () => {
  // Dos cargos de la misma luz · agrupan porque casaron con la misma previsión,
  // que es como agrupa `agruparResueltas`, no por el churro del banco.
  const previsto = { id: 9, descripcion: 'Gas comercializadora', importe: -165, fecha: '2026-08-24' };
  const gas = [
    { ...linea(1, 'RECIBO GAS REGULADA 08/2026', -165.08), previsto },
    { ...linea(2, 'RECIBO GAS REGULADA 07/2026', -160.4), previsto },
  ];

  it('el grupo se presenta plegado · la fila es un botón para abrirlo', () => {
    pintarResto({ resueltas: gas });

    // Plegado: no está el texto crudo del banco de ninguna de las dos.
    expect(screen.queryByText(/08\/2026/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gas comercializadora/i })).toBeInTheDocument();
  });

  it('al abrirlo salen las líneas, una a una, con su texto del banco', () => {
    pintarResto({ resueltas: gas });

    fireEvent.click(screen.getByRole('button', { name: /gas comercializadora/i }));

    expect(screen.getByText(/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/07\/2026/)).toBeInTheDocument();
  });

  it('cada línea de dentro lleva su «No es esto» · y devuelve SU movementId', () => {
    const noEsEsto = jest.fn();
    pintarResto({ resueltas: gas, onNoEsEsto: noEsEsto });

    fireEvent.click(screen.getByRole('button', { name: /gas comercializadora/i }));
    const botones = screen.getAllByRole('button', { name: /no es esto/i });
    expect(botones).toHaveLength(2);

    fireEvent.click(botones[1]);
    expect(noEsEsto).toHaveBeenCalledWith(102);
  });

  it('el montón PERSONAL también se abre y también se corrige', () => {
    // El caso de la captura: una cuota de préstamo del piso metida en personal,
    // sin forma de sacarla de ahí.
    const noEsEsto = jest.fn();
    pintarResto({
      personales: [linea(9, 'CUOTA PRESTAMO BBVA 0182-5322', -285.4)],
      onNoEsEsto: noEsEsto,
    });

    fireEvent.click(screen.getByRole('button', { name: /CUOTA PRESTAMO/i }));
    fireEvent.click(screen.getByRole('button', { name: /no es esto/i }));

    expect(noEsEsto).toHaveBeenCalledWith(109);
  });
});

// ─── La columna izquierda · buscar y actuar en bloque ───────────────────────

const cuadreDe = (over: Partial<Cuadre> = {}): Cuadre => ({
  delBanco: 8,
  colocadas: 8,
  porBucket: { resueltas: 0, te_necesitan: 8, personal: 0, ignorados: 0 },
  cuadra: true,
  huerfanas: [],
  ...over,
});

const NECESITAN = [
  linea(1, 'Compra Bizum Iryo', -70.48),
  linea(2, 'Bizum A Favor De Luis Eduardo Montes', -15),
  linea(3, 'Bizum A Favor De Aroa Gómez', -80),
  linea(4, 'GAS Visalia-Domestica Energia', -66.9),
  linea(5, 'GAS Domestica Gas y Electricidad', -37.67),
];

function pintarPanel(over: Partial<React.ComponentProps<typeof PanelConciliar>> = {}) {
  return render(
    <PanelConciliar
      titularCuenta="Banc Sabadell · 102 líneas"
      elCuadre={cuadreDe()}
      necesitan={NECESITAN}
      resueltas={[]}
      personales={[]}
      ignoradas={[]}
      propuestas={new Map()}
      aprendido={{ nuevas: [], deAntes: 0, total: 0 }}
      avisos={[]}
      error={null}
      guardando={false}
      renderLinea={(l) => <div>{l.textoBanco}</div>}
      onRecuperar={() => undefined}
      onNoEsEsto={() => undefined}
      onIgnorarVarias={() => undefined}
      cuentasTraspaso={[{ id: 7, nombre: 'Revolut' }, { id: 8, nombre: 'Efectivo' }]}
      onTraspasarVarias={() => undefined}
      onClasificarVarias={() => undefined}
      onGuardar={() => undefined}
      onOtroFichero={() => undefined}
      {...over}
    />,
  );
}

const buscador = () => screen.getByRole('searchbox', { name: /buscar/i });

describe('buscar en las que te necesitan', () => {
  it('escribir «bizum» deja sólo los bizums', () => {
    pintarPanel();
    expect(screen.getByText('GAS Visalia-Domestica Energia')).toBeInTheDocument();

    fireEvent.change(buscador(), { target: { value: 'bizum' } });

    expect(screen.getByText('Compra Bizum Iryo')).toBeInTheDocument();
    expect(screen.queryByText('GAS Visalia-Domestica Energia')).not.toBeInTheDocument();
  });

  it('los atajos salen de este fichero · y el número que llevan es verdad', () => {
    pintarPanel();

    const bizum = screen.getByRole('button', { name: /bizum · 3/i });
    fireEvent.click(bizum);

    expect(screen.queryByText('GAS Visalia-Domestica Energia')).not.toBeInTheDocument();
    expect(screen.getByText('Bizum A Favor De Aroa Gómez')).toBeInTheDocument();
  });

  it('cuando la búsqueda no encuentra nada lo dice, y ofrece la vuelta', () => {
    pintarPanel();
    fireEvent.change(buscador(), { target: { value: 'hipoteca' } });

    expect(screen.getByText(/ninguna de las 5 dice «hipoteca»/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /quitar el filtro/i }));
    expect(screen.getByText('GAS Visalia-Domestica Energia')).toBeInTheDocument();
  });
});

describe('actuar sobre varias a la vez', () => {
  it('marcar dos y darles a ignorar las manda las dos juntas', () => {
    const ignorarVarias = jest.fn();
    pintarPanel({ onIgnorarVarias: ignorarVarias });

    const casillas = screen.getAllByRole('checkbox', { name: /elegir/i });
    fireEvent.click(casillas[0]);
    fireEvent.click(casillas[1]);

    fireEvent.click(screen.getByRole('button', { name: /ignorar las 2/i }));

    expect(ignorarVarias).toHaveBeenCalledWith([101, 102]);
  });

  it('«elegir las 3 que se ven» coge lo filtrado · el flujo entero de un bizum', () => {
    // Buscar bizum → elegirlas todas → ignorarlas. Esto es literalmente lo que
    // pidió Jose, en tres gestos en vez de en noventa y cinco.
    const ignorarVarias = jest.fn();
    pintarPanel({ onIgnorarVarias: ignorarVarias });

    fireEvent.change(buscador(), { target: { value: 'bizum' } });
    fireEvent.click(screen.getByRole('button', { name: /elegir las 3/i }));
    fireEvent.click(screen.getByRole('button', { name: /ignorar las 3/i }));

    expect(ignorarVarias).toHaveBeenCalledWith([101, 102, 103]);
  });

  it('sin nada marcado no hay barra · no estorba mientras no hace falta', () => {
    pintarPanel();
    expect(screen.queryByRole('button', { name: /ignorar las/i })).not.toBeInTheDocument();
  });

  it('la selección se puede deshacer entera', () => {
    pintarPanel();
    fireEvent.click(screen.getAllByRole('checkbox', { name: /elegir/i })[0]);
    expect(screen.getByRole('button', { name: /ignorar la 1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quitar la selección/i }));
    expect(screen.queryByRole('button', { name: /ignorar la/i })).not.toBeInTheDocument();
  });

  it('filtrar no arrastra lo que ya estaba elegido fuera del filtro', () => {
    // Si eliges el gas, buscas «bizum» y le das a ignorar, no puede llevarse por
    // delante el gas que ya no ves. Lo que no se ve, no se toca.
    const ignorarVarias = jest.fn();
    pintarPanel({ onIgnorarVarias: ignorarVarias });

    fireEvent.click(screen.getAllByRole('checkbox', { name: /elegir/i })[3]); // el gas
    fireEvent.change(buscador(), { target: { value: 'bizum' } });
    fireEvent.click(screen.getAllByRole('checkbox', { name: /elegir/i })[0]); // un bizum

    fireEvent.click(screen.getByRole('button', { name: /ignorar la 1/i }));
    expect(ignorarVarias).toHaveBeenCalledWith([101]);
  });
});

describe('clasificar varias de una vez · no sólo ignorarlas', () => {
  it('cinco recibos del agua se clasifican de un gesto', () => {
    // «quiero clasificarlo como gasto personal agua y solo me deja ignorar».
    // Ignorar y traspasar es justo lo que NO se hace con cinco recibos del agua.
    const clasificarVarias = jest.fn();
    pintarPanel({ onClasificarVarias: clasificarVarias });

    fireEvent.change(buscador(), { target: { value: 'bizum' } });
    fireEvent.click(screen.getByRole('button', { name: /elegir las 3/i }));
    fireEvent.click(screen.getByRole('button', { name: /clasificar las 3 como/i }));

    expect(clasificarVarias).toHaveBeenCalledWith([101, 102, 103]);
  });

  it('con una sola elegida el botón habla en singular', () => {
    pintarPanel();
    fireEvent.click(screen.getAllByRole('checkbox', { name: /elegir/i })[0]);

    expect(screen.getByRole('button', { name: /clasificar la 1 como/i })).toBeInTheDocument();
  });

  it('elegir tres cargos y decir «son traspaso a Revolut» los manda juntos', () => {
    // La otra mitad de lo que pidió Jose: «marcarlos e ignorarlos O
    // CLASIFICARLOS todos a la vez». Con 28 cargos de Revolut, elegir la cuenta
    // 28 veces es el mismo trabajo que no tener la barra.
    const traspasarVarias = jest.fn();
    pintarPanel({ onTraspasarVarias: traspasarVarias });

    fireEvent.change(buscador(), { target: { value: 'bizum' } });
    fireEvent.click(screen.getByRole('button', { name: /elegir las 3/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /son traspaso a/i }), {
      target: { value: '7' },
    });

    expect(traspasarVarias).toHaveBeenCalledWith([101, 102, 103], 7);
  });

  it('no se ofrece sobre un ingreso · la salida de un traspaso es un cargo', () => {
    // Un abono no es la pata de salida de nada. Ofrecerlo sería invitar a crear
    // un traspaso al revés, que es dinero inventado.
    pintarPanel({
      necesitan: [linea(1, 'REMUN. MES CTA ONLINE SABADELL', 1.03)],
    });
    fireEvent.click(screen.getAllByRole('checkbox', { name: /elegir/i })[0]);

    expect(screen.queryByRole('combobox', { name: /son traspaso a/i })).not.toBeInTheDocument();
    // Pero ignorar sí se puede: eso vale para cualquier signo.
    expect(screen.getByRole('button', { name: /ignorar la 1/i })).toBeInTheDocument();
  });

  it('sin cuentas donde traspasar no se enseña el desplegable vacío', () => {
    pintarPanel({ cuentasTraspaso: [] });
    fireEvent.click(screen.getAllByRole('checkbox', { name: /elegir/i })[0]);

    expect(screen.queryByRole('combobox', { name: /son traspaso a/i })).not.toBeInTheDocument();
  });
});

describe('la cuenta de lo que se ve no miente', () => {
  it('con filtro puesto, la cabecera dice cuántas se están viendo de cuántas', () => {
    pintarPanel();
    fireEvent.change(buscador(), { target: { value: 'bizum' } });

    const cabecera = screen.getByText(/3 de 5/i);
    expect(cabecera).toBeInTheDocument();
    expect(within(cabecera).queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
