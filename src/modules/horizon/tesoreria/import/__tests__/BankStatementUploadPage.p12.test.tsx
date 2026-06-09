// FIX PUNTO 4 (P12) · el extracto IDENTIFICA su cuenta por el IBAN de la
// cabecera · "cuenta destino" deja de ser obligatoria:
//   · IBAN conocido → se casa con la cuenta sola (no pregunta destino);
//   · IBAN nuevo → ofrece crear la cuenta prerellenada (IBAN · banco · saldo · fecha);
//   · sin IBAN legible → cae al selector de respaldo.
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BankStatementUploadPage from '../BankStatementUploadPage';
import { processFile as orchestratorProcessFile } from '../../../../../services/bankStatementOrchestrator';
import { extractExtractoHeader } from '../../../../../services/extractoHeaderService';
import { cuentasService } from '../../../../../services/cuentasService';
import { initDB } from '../../../../../services/db';

const IBAN = 'ES3400491500050200051332';

jest.mock('../../../../../services/bankStatementOrchestrator', () => ({
  processFile: jest.fn(),
  confirmDecisions: jest.fn(),
  cancelImportBatch: jest.fn(),
  BankProfileNotDetectedError: class extends Error {},
}));
jest.mock('../../../../../services/extractoHeaderService', () => ({
  extractExtractoHeader: jest.fn(),
}));
jest.mock('../../../../../services/cuentasService', () => ({
  cuentasService: { create: jest.fn(), list: jest.fn() },
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}));

const mockProcess = orchestratorProcessFile as jest.Mock;
const mockHeader = extractExtractoHeader as jest.Mock;
const mockCreate = cuentasService.create as jest.Mock;

const fakeCsv = () => new File(['x'], 'extracto.csv', { type: 'text/csv' });

async function seedAccount(id: number, iban: string) {
  const db = await initDB();
  await db.put('accounts', { id, iban, alias: 'Santander', bank: 'Santander' } as never);
}

function renderPage() {
  const r = render(
    <MemoryRouter initialEntries={['/tesoreria/importar']}>
      <BankStatementUploadPage />
    </MemoryRouter>,
  );
  return r;
}

function uploadFile(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [fakeCsv()] } });
}

beforeEach(async () => {
  mockProcess.mockReset().mockRejectedValue(new Error('stop-after-account-resolved'));
  mockHeader.mockReset();
  mockCreate.mockReset();
  const db = await initDB();
  await db.clear('accounts');
});

describe('BankStatementUploadPage · el extracto identifica su cuenta (P12)', () => {
  it('IBAN conocido → casa con la cuenta sola · sin preguntar destino', async () => {
    await seedAccount(5, IBAN);
    mockHeader.mockResolvedValue({ iban: IBAN, banco: 'Banco Santander' });
    const { container } = renderPage();
    // Esperar a que terminen de cargar las cuentas (aparece la opción de
    // detección por extracto solo cuando accountsLoading=false).
    await screen.findByText(/Detectar por el extracto/);

    uploadFile(container);

    await waitFor(() => expect(mockProcess).toHaveBeenCalledTimes(1));
    expect(mockProcess.mock.calls[0][1]).toMatchObject({ accountId: 5 });
    // No se ofrece crear cuenta (ya existe).
    expect(screen.queryByText(/Crear cuenta con estos datos/)).not.toBeInTheDocument();
  });

  it('IBAN nuevo → ofrece crear la cuenta prerellenada con saldo y fecha', async () => {
    mockHeader.mockResolvedValue({
      iban: IBAN,
      banco: 'Banco Santander',
      saldo: 36550,
      fecha: '2026-06-09',
    });
    mockCreate.mockResolvedValue({ id: 99, iban: IBAN });
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText(/Cuenta destino/)).toBeInTheDocument());

    uploadFile(container);

    // Aún no procesa · primero ofrece crear la cuenta con los datos del extracto.
    await screen.findByText(/Crear cuenta con estos datos/);
    expect(mockProcess).not.toHaveBeenCalled();
    expect(screen.getByText(/36\.550,00 €/)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-09/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Crear cuenta con estos datos/ }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      iban: IBAN,
      openingBalance: 36550,
    });
    await waitFor(() => expect(mockProcess).toHaveBeenCalledTimes(1));
    expect(mockProcess.mock.calls[0][1]).toMatchObject({ accountId: 99 });
  });

  it('sin IBAN legible y sin cuenta elegida → cae al selector de respaldo (no procesa)', async () => {
    mockHeader.mockResolvedValue({});
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText(/Cuenta destino · respaldo/)).toBeInTheDocument());

    uploadFile(container);

    await screen.findByText(/selecciona la cuenta destino/i);
    expect(mockProcess).not.toHaveBeenCalled();
  });
});
