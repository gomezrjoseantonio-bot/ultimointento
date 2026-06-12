/**
 * FIX onboarding · PUNTO 5 (P4) · el alta de préstamo lanzada desde el bloque
 * préstamos (`?from=empezar`) vuelve SOBRE el flujo (/empezar/prestamos) al
 * guardar o cancelar · sin `from` mantiene su destino de siempre (/financiacion).
 * El wizard (PrestamoPageV2) queda intacto · solo cambia la navegación del
 * wrapper.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import WizardCreatePage from '../WizardCreatePage';

// El wizard se stubea a dos botones que disparan onSuccess/onCancel (no se
// toca el componente real · solo se verifica el ruteo del wrapper).
jest.mock('../../wizards/PrestamoPageV2', () => ({
  __esModule: true,
  default: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div>
      <button type="button" onClick={onSuccess}>stub-guardar</button>
      <button type="button" onClick={onCancel}>stub-cancelar</button>
    </div>
  ),
}));

const Loc: React.FC = () => {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}</div>;
};

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/financiacion/nuevo" element={<WizardCreatePage />} />
        <Route path="*" element={<Loc />} />
      </Routes>
    </MemoryRouter>,
  );

it('?from=empezar · guardar vuelve a /empezar/prestamos', async () => {
  renderAt('/financiacion/nuevo?from=empezar');
  await userEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
  expect(screen.getByTestId('loc')).toHaveTextContent('/empezar/prestamos');
});

it('?from=empezar · cancelar vuelve a /empezar/prestamos', async () => {
  renderAt('/financiacion/nuevo?from=empezar');
  await userEvent.click(screen.getByRole('button', { name: 'stub-cancelar' }));
  expect(screen.getByTestId('loc')).toHaveTextContent('/empezar/prestamos');
});

it('sin from · guardar vuelve a /financiacion (comportamiento de siempre)', async () => {
  renderAt('/financiacion/nuevo');
  await userEvent.click(screen.getByRole('button', { name: 'stub-guardar' }));
  expect(screen.getByTestId('loc')).toHaveTextContent('/financiacion');
});
