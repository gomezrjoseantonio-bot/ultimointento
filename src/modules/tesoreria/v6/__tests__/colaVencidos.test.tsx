// La casilla de lo que venció y sigue esperando (#1813 · T2).
//
// #1813 hizo que un previsto que no llegó a tiempo sobreviva al cambio de mes.
// Faltaba lo demás: el calendario enseña UN mes, así que ese recibo de julio
// sobrevivía sin que nadie lo viera. Ahora sube arriba, en una casilla POR MES
// —para saber de cuándo viene cada cosa— y con las mismas acciones que
// cualquier otra fila: confirmarlo cuando el cargo cae, editarlo, o decir que
// no va a ocurrir.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DrawerCalendario from '../DrawerCalendario';
import type { Account, Movement, TreasuryEvent } from '../../../../services/db';

const cuenta = (id: number, alias: string): Account => ({
  id, iban: `ES910049150005123456789${id}`, alias, status: 'ACTIVE', activa: true,
  createdAt: '', updatedAt: '',
});

const ev = (over: Partial<TreasuryEvent> & { id: number }): TreasuryEvent => ({
  type: 'expense', amount: 50.73, predictedDate: '2026-07-01', description: 'Aqualia',
  sourceType: 'gasto_recurrente', status: 'predicted', accountId: 1,
  createdAt: '', updatedAt: '', ...over,
});

// Estamos en AGOSTO · julio dejó cola.
const base = {
  abierto: true,
  year: 2026,
  month0: 7,
  hoy: '2026-08-11',
  onMes: jest.fn(),
  cuentas: [cuenta(1, 'Unicaja'), cuenta(2, 'Santander')],
  saldoPorCuenta: new Map([[1, 5000], [2, 5000]]),
  saldoTotalHoy: 10000,
  onCerrar: jest.fn(),
  onConfirmar: jest.fn(),
  onDescartar: jest.fn(),
  onConfirmarDia: jest.fn(),
  movimientos: [] as Movement[],
  eventos: [] as TreasuryEvent[],
};

const DE_JULIO = [
  ev({ id: 1, predictedDate: '2026-07-01', description: 'Aqualia', accountId: 1 }),
  ev({ id: 2, predictedDate: '2026-07-01', description: 'Aqualia 4IZ', accountId: 1 }),
  ev({ id: 3, predictedDate: '2026-07-08', description: 'Planeta Seguros', accountId: 2 }),
];

const casilla = () => screen.getByRole('button', { name: /Pendiente de julio/ });

describe('la casilla del mes vencido', () => {
  it('sale arriba, con su mes, su recuento y su total', () => {
    render(<DrawerCalendario {...base} eventos={DE_JULIO} />);

    const hd = casilla();
    expect(within(hd).getByText('Julio')).toBeInTheDocument();
    expect(within(hd).getByText(/3 sin confirmar/)).toBeInTheDocument();
    // 3 × 50,73 · en tinta, no en rojo (§5 · el color marca acción, no cifra).
    expect(within(hd).getByText(/152,19/)).toBeInTheDocument();
  });

  it('sin nada vencido no hay casilla · no se anuncia lo que no existe', () => {
    render(<DrawerCalendario {...base} eventos={[ev({ id: 9, predictedDate: '2026-08-20' })]} />);
    expect(screen.queryByRole('button', { name: /Pendiente de/ })).not.toBeInTheDocument();
  });

  // Una POR MES · un cajón de sastre no dice si algo lleva un mes o cuatro.
  it('julio y junio son dos casillas', () => {
    render(
      <DrawerCalendario
        {...base}
        eventos={[ev({ id: 1, predictedDate: '2026-07-01' }), ev({ id: 2, predictedDate: '2026-06-01' })]}
      />
    );
    expect(screen.getByRole('button', { name: /Pendiente de julio/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pendiente de junio/ })).toBeInTheDocument();
  });

  it('nace cerrada y se abre al pulsarla · un viewport, sin scroll de más', () => {
    render(<DrawerCalendario {...base} eventos={DE_JULIO} />);

    expect(casilla()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Planeta Seguros')).not.toBeInTheDocument();

    fireEvent.click(casilla());
    expect(casilla()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Planeta Seguros')).toBeInTheDocument();
  });

  it('abierta, va subagrupada por cuenta', () => {
    render(<DrawerCalendario {...base} eventos={DE_JULIO} />);
    fireEvent.click(casilla());

    expect(screen.getByText(/Unicaja/)).toBeInTheDocument();
    expect(screen.getByText(/Santander/)).toBeInTheDocument();
  });
});

// Es confirmación, no solo vista: la casilla es donde se trabaja esa cola.
describe('las acciones de cada fila vencida', () => {
  it('confirmar · cuando el cargo ya cayó', () => {
    const onConfirmar = jest.fn();
    render(<DrawerCalendario {...base} eventos={DE_JULIO} onConfirmar={onConfirmar} />);
    fireEvent.click(casilla());

    fireEvent.click(screen.getAllByRole('button', { name: /^Puntear/ })[0]);
    expect(onConfirmar).toHaveBeenCalled();
  });

  it('descartar · cuando ya se sabe que no va a ocurrir', () => {
    const onDescartar = jest.fn();
    render(<DrawerCalendario {...base} eventos={DE_JULIO} onDescartar={onDescartar} />);
    fireEvent.click(casilla());

    fireEvent.click(screen.getAllByRole('button', { name: /^Descartar/ })[0]);
    expect(onDescartar).toHaveBeenCalled();
  });

  it('editar · abre la ficha de esa fila', () => {
    render(<DrawerCalendario {...base} eventos={DE_JULIO} />);
    fireEvent.click(casilla());

    fireEvent.click(screen.getAllByRole('button', { name: /^Editar/ })[0]);
    expect(screen.getByRole('dialog', { name: /movimiento/i })).toBeInTheDocument();
  });
});

// El hueco anterior al día 1 estaba vacío · ahí cabe el aviso sin ensuciar el
// mes que se está mirando. Agosto de 2026 empieza en sábado: cinco huecos.
describe('la casilla dentro de la rejilla', () => {
  it('ocupa el hueco previo al día 1 y abre su cola', () => {
    render(<DrawerCalendario {...base} eventos={DE_JULIO} />);

    const celda = screen.getByRole('button', { name: /Ver lo pendiente de julio/ });
    expect(within(celda).getByText('◀ Julio')).toBeInTheDocument();
    expect(within(celda).getByText('3 pdtes')).toBeInTheDocument();

    fireEvent.click(celda);
    expect(casilla()).toHaveAttribute('aria-expanded', 'true');
  });
});
