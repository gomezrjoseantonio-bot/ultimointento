// Cerrar el mes (§6 quater) · el botón que le faltaba al motor.
//
// Lo que fija:
//   · la LISTA DELANTE · pulsar "Cerrar julio" enseña qué se va a dar por no
//     ocurrido, con sus importes, y todavía no toca nada;
//   · confirmar sí lo hace, y el mes queda marcado como cerrado;
//   · y se puede reabrir, que es la condición con la que Jose lo pidió.
//
// Se prueba contra la base de datos de verdad y no contra un mock del servicio:
// lo que puede fallar aquí es justo que la pantalla y el motor discrepen.

import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CerrarElMes from '../CerrarElMes';
import { initDB, type TreasuryEvent } from '../../../../services/db';
import { estaCerrado } from '../../../../services/cierreDeMes';

const HOY = '2026-08-05';

const evento = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    type: 'income',
    amount: 1200,
    predictedDate: '2026-07-25',
    description: 'Nómina',
    sourceType: 'nomina',
    status: 'predicted',
    ...over,
  }) as TreasuryEvent;

const sembrar = async (eventos: TreasuryEvent[]): Promise<void> => {
  const db = await initDB();
  for (const e of eventos) await db.add('treasuryEvents', e);
};

const pintar = async (onCambio = jest.fn()) => {
  // La primera pasada lee la base de datos · sin esperarla no hay ni filas.
  await act(async () => {
    render(<CerrarElMes hoy={HOY} onCambio={onCambio} />);
  });
  expect(await screen.findByText('julio 2026')).toBeInTheDocument();
  return onCambio;
};

/** Un clic que escribe · cerrar y reabrir tocan la base de datos. */
const clic = async (boton: HTMLElement): Promise<void> => {
  await act(async () => {
    await userEvent.click(boton);
  });
};

beforeEach(async () => {
  const db = await initDB();
  await db.clear('treasuryEvents');
  await db.delete('keyval', 'cierresDeMes');
});

describe('la tira de meses', () => {
  it('ofrece los meses terminados y no el que está en curso', async () => {
    await pintar();

    expect(screen.queryByText('agosto 2026')).not.toBeInTheDocument();
    expect(screen.getByText('junio 2026')).toBeInTheDocument();
  });

  it('dice cuánto queda sin ocurrir en cada uno', async () => {
    await sembrar([evento(), evento({ type: 'expense', amount: 300, description: 'Luz' })]);
    await pintar();

    expect(await screen.findByText(/2 movimientos sin ocurrir/)).toBeInTheDocument();
  });
});

describe('la lista delante', () => {
  it('enseña qué se va a dar por no ocurrido antes de tocar nada', async () => {
    await sembrar([evento(), evento({ type: 'expense', amount: 300, description: 'Luz' })]);
    await pintar();

    await clic(screen.getByRole('button', { name: /Cerrar julio/ }));

    const panel = await screen.findByRole('dialog');
    expect(panel).toHaveTextContent('Nómina');
    expect(panel).toHaveTextContent('Luz');
    expect(panel).toHaveTextContent('No entraron');
    // Mirar no es cerrar.
    expect(await estaCerrado('2026-07')).toBe(false);
  });

  it('y cancelar deja el mes como estaba', async () => {
    await sembrar([evento()]);
    const onCambio = await pintar();

    await clic(screen.getByRole('button', { name: /Cerrar julio/ }));
    await clic(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await estaCerrado('2026-07')).toBe(false);
    expect(onCambio).not.toHaveBeenCalled();
  });

  // Cerrar un mes vacío no es un gesto vacío: es lo que convierte «todavía no
  // ha llegado» en «no llegó», y de ahí sale que una bonificación se pierda.
  it('un mes sin nada abierto se puede cerrar igual', async () => {
    await pintar();

    await clic(screen.getByRole('button', { name: /Cerrar junio/ }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('No queda nada abierto');
  });
});

describe('cerrar y reabrir', () => {
  it('cerrar marca el mes y avisa a la pantalla', async () => {
    await sembrar([evento()]);
    const onCambio = await pintar();

    await clic(screen.getByRole('button', { name: /Cerrar julio/ }));
    await clic(await screen.findByRole('button', { name: /Cerrar el mes/ }));

    // El día que se cerró es el de hoy de verdad · lo que se fija aquí es que
    // la fila pasa a decir que está cerrado, no qué fecha marca el reloj.
    expect(await screen.findByText(/cerrado el/)).toBeInTheDocument();
    expect(await estaCerrado('2026-07')).toBe(true);
    expect(onCambio).toHaveBeenCalled();
  });

  it('y reabrir lo deshace', async () => {
    await sembrar([evento()]);
    await pintar();

    await clic(screen.getByRole('button', { name: /Cerrar julio/ }));
    await clic(await screen.findByRole('button', { name: /Cerrar el mes/ }));
    await screen.findByRole('button', { name: /Reabrir/ });
    await clic(screen.getByRole('button', { name: /Reabrir/ }));

    expect(await screen.findByRole('button', { name: /Cerrar julio/ })).toBeInTheDocument();
    expect(await estaCerrado('2026-07')).toBe(false);
  });
});
