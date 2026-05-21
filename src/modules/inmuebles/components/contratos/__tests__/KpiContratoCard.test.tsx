import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import KpiContratoCard from '../KpiContratoCard';

describe('KpiContratoCard', () => {
  test('renderiza label · valor · hint', () => {
    render(
      <KpiContratoCard
        label="Libres ahora"
        value={2}
        hint="Casa A · Casa B"
        accent="neg"
      />,
    );
    expect(screen.getByText('Libres ahora')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Casa A · Casa B')).toBeInTheDocument();
  });

  test('value === null renderiza placeholder "—"', () => {
    render(
      <KpiContratoCard
        label="Días vacíos YTD"
        value={null}
        accent="muted"
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('con onClick · role button · invoca handler con click y Enter', () => {
    const onClick = jest.fn();
    render(
      <KpiContratoCard
        label="Vencen en 30 d"
        value={3}
        accent="warn"
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  test('sin onClick · NO tiene role button · no es clickable', () => {
    render(
      <KpiContratoCard
        label="Ingresos perdidos"
        value={null}
        accent="plain"
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('valueTone neg aplica clase de valor negativo', () => {
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const { container } = render(
      <KpiContratoCard
        label="Libres"
        value={3}
        accent="neg"
        valueTone="neg"
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const valueNode = container.querySelector('[class*="valueNeg"]');
    expect(valueNode).not.toBeNull();
  });

  test('CTA "Ver detalle →" solo cuando es clickable', () => {
    const { rerender } = render(
      <KpiContratoCard label="X" value={1} accent="neg" onClick={() => {}} />,
    );
    expect(screen.getByText(/Ver detalle/)).toBeInTheDocument();

    rerender(<KpiContratoCard label="X" value={1} accent="neg" />);
    expect(screen.queryByText(/Ver detalle/)).toBeNull();
  });
});
