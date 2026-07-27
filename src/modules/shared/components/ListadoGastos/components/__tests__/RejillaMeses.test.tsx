import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RejillaMeses from '../RejillaMeses';

describe('RejillaMeses · componente', () => {
  it('pinta los 12 meses y marca los recibidos en `meses`', () => {
    render(
      <RejillaMeses meses={[6]} dia={5} onMesesChange={() => {}} onDiaChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Ene' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Jun' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('al pulsar un mes lo alterna (añade el que faltaba)', () => {
    const onMesesChange = jest.fn();
    render(
      <RejillaMeses meses={[6]} dia={5} onMesesChange={onMesesChange} onDiaChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ene' }));
    expect(onMesesChange).toHaveBeenCalledWith([1, 6]);
  });

  it('el atajo "Todos los meses" marca los 12', () => {
    const onMesesChange = jest.fn();
    render(
      <RejillaMeses meses={[]} dia={5} onMesesChange={onMesesChange} onDiaChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Todos los meses' }));
    expect(onMesesChange).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('acepta el día 31 (los cargos en España van del 1 al 31)', () => {
    const onDiaChange = jest.fn();
    render(
      <RejillaMeses meses={[1]} dia={5} onMesesChange={() => {}} onDiaChange={onDiaChange} />,
    );
    fireEvent.change(screen.getByLabelText('Día del cargo'), { target: { value: '31' } });
    expect(onDiaChange).toHaveBeenCalledWith(31);
  });

  it('clampa por encima de 31 al máximo', () => {
    const onDiaChange = jest.fn();
    render(
      <RejillaMeses meses={[1]} dia={5} onMesesChange={() => {}} onDiaChange={onDiaChange} />,
    );
    fireEvent.change(screen.getByLabelText('Día del cargo'), { target: { value: '45' } });
    expect(onDiaChange).toHaveBeenCalledWith(31);
  });
});
