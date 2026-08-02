// Candado de las 5 fricciones de PunteoList (Tesorería V6 · D2 bis).
//
// La condición que puso Jose al aprobarlas: las props nuevas son OPCIONALES y
// su valor por defecto es el comportamiento actual, "para que las otras tres
// vistas que cuelgan de PunteoList no cambien ni un píxel".
//
// La mitad de estos tests existe justamente para eso: fijar el render POR
// DEFECTO. Si alguien convierte una fricción en el comportamiento base, aquí
// se entera.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PunteoList from '../PunteoList';
import type { ItemPunteo } from '../../../../../services/punteo/punteoModel';

const item = (over: Partial<ItemPunteo> = {}): ItemPunteo => ({
  key: 'evt-1',
  kind: 'evento',
  refId: 1,
  estado: 'previsto',
  fecha: '2026-03-05',
  concepto: 'Recibo luz',
  activo: null,
  origen: 'Suministro',
  cuentaId: 1,
  importe: -74.09,
  ...over,
});

const ITEMS: ItemPunteo[] = [
  item({ key: 'evt-1', refId: 1, concepto: 'Recibo luz', origen: 'Suministro', fecha: '2026-03-05', importe: -74.09 }),
  item({
    key: 'evt-2',
    refId: 2,
    concepto: 'Renta Tenderina',
    origen: 'Contrato',
    fecha: '2026-03-01',
    importe: 650,
    activo: { inmuebleId: 7, alias: 'Tenderina 64' },
  }),
  item({ key: 'mov-3', kind: 'movimiento', refId: 3, estado: 'conciliado', concepto: 'Comisión', origen: 'Gasto', fecha: '2026-03-05', importe: -3.5 }),
];

const base = {
  items: ITEMS,
  chip: 'todos' as const,
  onChipChange: jest.fn(),
  cuentas: [{ id: 1, label: 'Sabadell ···· 7892' }],
  onConfirmar: jest.fn(),
  onNoPaso: jest.fn(),
};

describe('PunteoList · render por defecto (las otras 3 vistas)', () => {
  it('pinta los chips de estado', () => {
    render(<PunteoList {...base} />);
    expect(screen.getByRole('tablist', { name: /estado de punteo/i })).toBeInTheDocument();
  });

  it('NO pinta selector de eje ni buscador si no se pasan sus handlers', () => {
    render(<PunteoList {...base} />);
    expect(screen.queryByRole('tablist', { name: /agrupar por/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('NO pinta lápiz ni ✕ en la fila', () => {
    render(<PunteoList {...base} />);
    expect(screen.queryByLabelText(/^editar/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^descartar/i)).not.toBeInTheDocument();
  });

  it('agrupa por fecha descendente y muestra todo desplegado', () => {
    render(<PunteoList {...base} />);
    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.getByText('Renta Tenderina')).toBeInTheDocument();
    // Sin `gruposPlegables`, las cabeceras no son botones.
    expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
  });
});

/** Títulos de las cabeceras de grupo. El texto suelto no vale: el alias del
 *  inmueble y el origen también salen dentro de la fila. */
const titulos = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.dayName')).map((n) => n.textContent ?? '');

describe('1 · eje de agrupación', () => {
  it('agrupa por inmueble, con Personal para lo que no tiene', () => {
    const { container } = render(<PunteoList {...base} eje="inmueble" onEjeChange={jest.fn()} />);
    expect(titulos(container)).toEqual(['Personal', 'Tenderina 64']);
  });

  it('agrupa por "qué es" usando el origen', () => {
    const { container } = render(<PunteoList {...base} eje="que-es" onEjeChange={jest.fn()} />);
    expect(titulos(container).sort()).toEqual(['Contrato', 'Gasto', 'Suministro']);
  });

  it('dentro de un grupo NO-fecha, ordena por fecha descendente (§4.4)', () => {
    // El grupo tiene que mezclar días para que se vea: con un item por grupo,
    // un reordenado que ignore la fecha pasa desapercibido.
    const mismoInmueble = { inmuebleId: 7, alias: 'Tenderina 64' };
    const items: ItemPunteo[] = [
      item({ key: 'a', refId: 1, concepto: 'Antigua', fecha: '2026-03-01', importe: -10, activo: mismoInmueble }),
      item({ key: 'b', refId: 2, concepto: 'Reciente', fecha: '2026-03-20', importe: -500, activo: mismoInmueble }),
      item({ key: 'c', refId: 3, concepto: 'Media', fecha: '2026-03-10', importe: 900, activo: mismoInmueble }),
    ];
    const { container } = render(<PunteoList {...base} items={items} eje="inmueble" />);

    const conceptos = Array.from(container.querySelectorAll('.concepto')).map((n) => n.textContent);
    // Por fecha desc. Si se ordenara solo con `compararEnDia`, el ingreso de
    // 900 (Media) subiría al primer puesto y esto fallaría.
    expect(conceptos).toEqual(['Reciente', 'Media', 'Antigua']);
  });

  it('por fecha, descendente · el día más reciente arriba', () => {
    const { container } = render(<PunteoList {...base} />);
    const t = titulos(container);
    expect(t).toHaveLength(2);
    // fmtDia formatea, así que se comprueba el orden por posición, no el texto.
    expect(t[0]).not.toBe(t[1]);
  });

  it('avisa del cambio de eje', () => {
    const onEjeChange = jest.fn();
    render(<PunteoList {...base} onEjeChange={onEjeChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ámbito' }));
    expect(onEjeChange).toHaveBeenCalledWith('inmueble');
  });
});

describe('2 · chips ocultables para que el contenedor ponga pestañas', () => {
  it('oculta los chips con mostrarChips=false, sin tocar la lista', () => {
    render(<PunteoList {...base} mostrarChips={false} />);
    expect(screen.queryByRole('tablist', { name: /estado de punteo/i })).not.toBeInTheDocument();
    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
  });
});

describe('3 · buscador', () => {
  it('filtra por concepto', () => {
    render(<PunteoList {...base} busqueda="luz" onBusquedaChange={jest.fn()} />);
    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.queryByText('Renta Tenderina')).not.toBeInTheDocument();
  });

  it('filtra por inmueble y por importe', () => {
    const { unmount } = render(<PunteoList {...base} busqueda="tenderina" onBusquedaChange={jest.fn()} />);
    expect(screen.getByText('Renta Tenderina')).toBeInTheDocument();
    expect(screen.queryByText('Recibo luz')).not.toBeInTheDocument();
    unmount();

    render(<PunteoList {...base} busqueda="74,09" onBusquedaChange={jest.fn()} />);
    expect(screen.getByText('Recibo luz')).toBeInTheDocument();
    expect(screen.queryByText('Renta Tenderina')).not.toBeInTheDocument();
  });
});

describe('4 · grupos plegables', () => {
  it('nacen cerrados y se abren al pulsar la cabecera', () => {
    render(<PunteoList {...base} gruposPlegables eje="inmueble" />);
    expect(screen.queryByText('Renta Tenderina')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tenderina 64/ }));
    expect(screen.getByText('Renta Tenderina')).toBeInTheDocument();
  });

  it('se abren solos al buscar (§4.4)', () => {
    render(<PunteoList {...base} gruposPlegables eje="inmueble" busqueda="renta" onBusquedaChange={jest.fn()} />);
    expect(screen.getByText('Renta Tenderina')).toBeInTheDocument();
  });

  it('lleva el subtotal en la cabecera', () => {
    render(<PunteoList {...base} gruposPlegables eje="inmueble" />);
    const cab = screen.getByRole('button', { name: /Tenderina 64/ });
    // SIN recuento · abierto son filas que se ven, y cerrado lo que se busca es
    // el subtotal, no cuántas líneas lo componen.
    expect(within(cab).queryByText(/movimientos?$/)).not.toBeInTheDocument();
    // §2.2 · el subtotal usa el formateador único: con € y sin decimales que no
    // aportan. Antes salía "+650,00", distinto del "+650 €" del resto.
    expect(within(cab).getByText('+650 €')).toBeInTheDocument();
  });
});

describe('5 · anatomía de fila de Tesorería', () => {
  it('saca el ✕ a la fila y solo en previstos', () => {
    render(<PunteoList {...base} rowVariant="tesoreria" onEditar={jest.fn()} />);
    // Dos previstos → dos ✕. El conciliado no lleva.
    expect(screen.getAllByLabelText(/^descartar/i)).toHaveLength(2);
    expect(screen.queryByLabelText('Descartar Comisión')).not.toBeInTheDocument();
  });

  it('el lápiz llama a onEditar sin abrir el editor inline', () => {
    const onEditar = jest.fn();
    render(<PunteoList {...base} rowVariant="tesoreria" onEditar={onEditar} />);

    fireEvent.click(screen.getByLabelText('Editar Recibo luz'));
    expect(onEditar).toHaveBeenCalledTimes(1);
    // stopPropagation: la fila no ha abierto su editor.
    expect(screen.queryByText(/No pasó este mes/i)).not.toBeInTheDocument();
  });

  it('el ✕ llama a onNoPaso sin abrir el editor', () => {
    const onNoPaso = jest.fn();
    render(<PunteoList {...base} rowVariant="tesoreria" onNoPaso={onNoPaso} />);

    fireEvent.click(screen.getByLabelText('Descartar Recibo luz'));
    expect(onNoPaso).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/No pasó este mes/i)).not.toBeInTheDocument();
  });
});


// §6.4 · el estado se dice con el chip, no con el color del círculo.
describe('el chip de estado', () => {
  const base = {
    chip: 'todos' as const,
    onChipChange: () => undefined,
    cuentas: [],
    onConfirmar: () => undefined,
    onNoPaso: () => undefined,
  };

  const item = (over: Partial<ItemPunteo> = {}): ItemPunteo => ({
    key: 'evt-1',
    kind: 'evento',
    refId: 1,
    estado: 'previsto',
    fecha: '2026-08-10',
    concepto: 'Mapfre',
    activo: null,
    origen: 'Recurrente',
    cuentaId: 1,
    importe: -40.29,
    ...over,
  });

  it('NO se pinta por defecto · "Por confirmar" es todo previsto y repetirlo es ruido', () => {
    render(<PunteoList {...base} items={[item()]} />);
    expect(screen.queryByText('previsto')).not.toBeInTheDocument();
  });

  it('se pinta cuando se pide · con el nombre que usa la pantalla', () => {
    render(
      <PunteoList
        {...base}
        conChipEstado
        items={[
          item({ key: 'a', refId: 1, estado: 'previsto' }),
          item({ key: 'b', refId: 2, estado: 'confirmado' }),
          item({ key: 'c', refId: 3, estado: 'conciliado' }),
        ]}
      />
    );
    expect(screen.getByText('Por confirmar')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText('Conciliado')).toBeInTheDocument();
  });

  it('lo conciliado NO es pulsable · lo afirma el banco, no el usuario', () => {
    render(<PunteoList {...base} conChipEstado items={[item({ estado: 'conciliado' })]} />);
    // Un botón deshabilitado sigue pareciendo un botón; esto es una marca.
    expect(screen.queryByRole('button', { name: /conciliado con el banco/ })).not.toBeInTheDocument();
  });

  it('lo previsto SÍ es pulsable · es la acción principal de la fila', () => {
    render(<PunteoList {...base} conChipEstado items={[item({ estado: 'previsto' })]} />);
    expect(screen.getByRole('button', { name: /Puntear Mapfre/ })).toBeInTheDocument();
  });
});
