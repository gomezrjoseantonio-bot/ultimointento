// FIX PUNTO 4 · la pantalla doble vía `/empezar/finanzas` y la ruta huérfana
// `/empezar/sugerencias` se BORRAN: ambas redirigen al bloque cuentas y sus
// componentes ya no existen (fusión cuentas+extractos).
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EmpezarApp from '../EmpezarApp';

jest.mock('../OnboardingContext', () => ({
  OnboardingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useOnboarding: () => ({ state: { bloques: {} }, loading: false }),
}));

jest.mock('../WelcomeScreen', () => ({ __esModule: true, default: () => <div>welcome</div> }));
jest.mock('../HubScreen', () => ({ __esModule: true, default: () => <div>hub</div> }));
jest.mock('../RevealScreen', () => ({ __esModule: true, default: () => <div>reveal</div> }));
jest.mock('../bloques/BloqueScreen', () => ({
  __esModule: true,
  default: function BloqueScreenMock() {
    const { useParams } = require('react-router-dom');
    const { bloqueId } = useParams();
    return <div data-testid="bloque">bloque:{bloqueId}</div>;
  },
}));
jest.mock('../../../../design-system/v5', () => ({
  __esModule: true,
  ToastHost: () => null,
}));
jest.mock('../../../../services/onboardingProgressService', () => ({
  BLOQUES_ORDEN: ['persona', 'inmuebles', 'contratos', 'cuentas', 'prestamos', 'nomina', 'inversiones'],
}));

const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/empezar/*" element={<EmpezarApp />} />
      </Routes>
    </MemoryRouter>,
  );

describe('EmpezarApp · redirects de la fusión (P2/P6/P8/P9)', () => {
  it('/empezar/finanzas redirige al bloque cuentas', () => {
    renderApp('/empezar/finanzas');
    expect(screen.getByTestId('bloque')).toHaveTextContent('bloque:cuentas');
  });

  it('/empezar/sugerencias redirige al bloque cuentas', () => {
    renderApp('/empezar/sugerencias');
    expect(screen.getByTestId('bloque')).toHaveTextContent('bloque:cuentas');
  });
});

describe('componentes borrados ya no existen', () => {
  it('FinanzasBloque ya no existe', () => {
    expect(() => require('../bloques/FinanzasBloque')).toThrow();
  });

  it('SugerenciasScreen ya no existe', () => {
    expect(() => require('../SugerenciasScreen')).toThrow();
  });
});
