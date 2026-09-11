// La pregunta del arrastre con tope: cuántas, como qué, y los dos botones.

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AvisoArrastre from '../conciliar/AvisoArrastre';
import type { ArrastrePendiente } from '../aprendizajeEnSesion';

const pendiente = (cuantas: number): ArrastrePendiente =>
  ({
    cuantas,
    a: {
      linea: { lineaId: 1, hashLinea: 'h1', textoBanco: 'RECIBO GAS NATURAL', fecha: '2026-09-01', importe: -40, veredicto: 'resolver' },
      valores: { familiaPersistir: 'suministro', subtipoPersistir: 'gas', concepto: 'Gas', esMejora: false },
      lineas: [],
      sinDecidir: () => true,
      onResuelta: () => undefined,
    },
  }) as unknown as ArrastrePendiente;

describe('la pregunta del arrastre', () => {
  it('sin pregunta pendiente no pinta nada', () => {
    render(<AvisoArrastre pendiente={null} onSi={() => undefined} onNo={() => undefined} />);
    expect(screen.queryByTestId('aviso-arrastre')).toBeNull();
  });

  it('dice cuántas y como qué, y cada botón hace lo suyo', () => {
    const hechos: string[] = [];
    render(<AvisoArrastre pendiente={pendiente(7)} onSi={() => hechos.push('si')} onNo={() => hechos.push('no')} />);
    const texto = screen.getByTestId('aviso-arrastre').textContent ?? '';
    expect(texto).toContain('7 líneas más');
    expect(texto).toContain('RECIBO GAS NATURAL');
    fireEvent.click(screen.getByRole('button', { name: 'Sí, las 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'No, solo esta' }));
    expect(hechos).toEqual(['si', 'no']);
  });
});
