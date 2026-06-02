// Commit 2 · regresión del bug IBAN: la pantalla /inmuebles/importar-contratos
// renderizaba un <select> de cuenta de cobro cuyo label caía al IBAN crudo
// (account.iban) junto al título. Era código residual de otro flujo. Tras la
// limpieza, la pantalla NO debe mostrar ningún IBAN ni selector de cuenta.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

const IBAN_RESIDUAL = 'ES6100490052632210412715';

const mockGetAvailableAccounts = jest.fn();
const mockImportContracts = jest.fn();
jest.mock('../../../../services/contractsImportService', () => ({
  getAvailableAccounts: (...a: any[]) => mockGetAvailableAccounts(...a),
  importContractsFromRentilaRows: (...a: any[]) => mockImportContracts(...a),
}));

const mockGetAll = jest.fn();
jest.mock('../../../../services/db', () => ({
  initDB: async () => ({ getAll: (...a: any[]) => mockGetAll(...a) }),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import ImportarContratos from '../ImportarContratos';

describe('ImportarContratos · bug IBAN eliminado', () => {
  beforeEach(() => {
    mockGetAvailableAccounts.mockReset();
    mockImportContracts.mockReset();
    mockGetAll.mockReset();
    // Cuenta que SOLO tiene IBAN (sin alias ni name): es el caso que antes
    // pintaba el IBAN crudo en el <select>.
    mockGetAvailableAccounts.mockResolvedValue([{ id: 1, iban: IBAN_RESIDUAL, status: 'ACTIVE' }]);
    mockGetAll.mockResolvedValue([]);
  });

  it('renderiza el título del importador', async () => {
    render(<ImportarContratos onBack={() => {}} onComplete={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('Importar contratos de alquiler')).toBeInTheDocument(),
    );
  });

  it('no muestra el IBAN residual en ningún lugar de la pantalla', async () => {
    render(<ImportarContratos onBack={() => {}} onComplete={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('Importar contratos de alquiler')).toBeInTheDocument(),
    );
    expect(screen.queryByText((_t, el) => Boolean(el?.textContent?.includes(IBAN_RESIDUAL)))).toBeNull();
  });

  it('no renderiza ningún selector de cuenta de cobro (combobox)', async () => {
    render(<ImportarContratos onBack={() => {}} onComplete={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('Importar contratos de alquiler')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
