// Smoke test · DatosPage (migración de preferencias-datos a Ajustes v5).
// Cubre los flujos críticos señalados en review: deep-link por hash → pestaña
// activa, y que el modo de importación 'replace' use confirmación con tono danger.

import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DatosPage from '../DatosPage';

const mockShowConfirmation = jest.fn();

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../../services/db', () => ({
  exportSnapshot: jest.fn(),
  importSnapshot: jest.fn(),
  resetAllData: jest.fn(),
}));

jest.mock('../../../../services/confirmationService', () => ({
  showConfirmation: (...args: any[]) => mockShowConfirmation(...args),
}));

// Embeds pesados (@dnd-kit + IndexedDB) · se simulan con marcadores.
jest.mock('../../../../components/kpi/KpiBuilder', () => ({
  __esModule: true,
  default: () => <div data-testid="kpi-builder" />,
}));
jest.mock('../../../../components/dashboard/DashboardConfig', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-config" />,
}));

jest.mock('../../../../design-system/v5', () => ({
  Icons: new Proxy(
    {},
    {
      get: () => () => null,
    },
  ),
}));

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <DatosPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DatosPage · smoke', () => {
  test('sin hash · pestaña Datos activa · muestra gestión de snapshots', () => {
    renderAt('/ajustes/datos');
    expect(screen.getByText('Datos y preferencias')).toBeInTheDocument();
    expect(screen.getByText('Gestión de snapshots')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-builder')).not.toBeInTheDocument();
  });

  test('deep-link #kpis · activa la pestaña KPIs (embed KpiBuilder)', async () => {
    renderAt('/ajustes/datos#kpis');
    expect(await screen.findByTestId('kpi-builder')).toBeInTheDocument();
    expect(screen.queryByText('Gestión de snapshots')).not.toBeInTheDocument();
  });

  test('deep-link #panel · activa la pestaña Panel (embed DashboardConfig)', async () => {
    renderAt('/ajustes/datos#panel');
    expect(await screen.findByTestId('dashboard-config')).toBeInTheDocument();
  });

  test('importar en modo replace (por defecto) usa confirmación danger', async () => {
    mockShowConfirmation.mockResolvedValueOnce(false); // cancela → no recarga
    renderAt('/ajustes/datos');
    const fileInput = screen.getByLabelText(
      'Importar snapshot (.zip)',
    ) as HTMLInputElement;
    const file = new File(['zip-bytes'], 'backup.zip', { type: 'application/zip' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockShowConfirmation).toHaveBeenCalledTimes(1));
    expect(mockShowConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'danger', confirmText: 'Reemplazar datos' }),
    );
  });

  test('archivo no-.zip · no confirma y limpia el input para re-seleccionar', async () => {
    renderAt('/ajustes/datos');
    const fileInput = screen.getByLabelText(
      'Importar snapshot (.zip)',
    ) as HTMLInputElement;
    const file = new File(['x'], 'notas.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockShowConfirmation).not.toHaveBeenCalled();
    expect(fileInput.value).toBe('');
  });
});
