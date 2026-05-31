// V78.1 (Commit 5 · UI "Por conciliar") · smoke test del tab de conciliación de botes.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

const mockListarBotes = jest.fn();
jest.mock('../../../../../services/boteAnualService', () => ({
  boteAnualService: {
    listarBotes: (...a: any[]) => mockListarBotes(...a),
    sugerirContracts: jest.fn().mockResolvedValue([]),
  },
}));

import TabPorConciliar from '../TabPorConciliar';

const alias = new Map<number, string>([[4, 'FA32']]);

describe('TabPorConciliar', () => {
  beforeEach(() => mockListarBotes.mockReset());

  it('muestra empty state cuando no hay botes', async () => {
    mockListarBotes.mockResolvedValue([]);
    render(<TabPorConciliar inmuebleAliasById={alias} />);
    await waitFor(() => expect(screen.getByText('Nada por conciliar')).toBeInTheDocument());
  });

  it('lista los botes con alias, importe y estado', async () => {
    mockListarBotes.mockResolvedValue([
      {
        id: 1, inmuebleId: 4, año: 2024, importeDeclarado: 19675, díasDeclarados: 366,
        nifsDetectados: ['Y5617860D', '71682787K'], tiposArrendamientoOriginales: [],
        importeAsignado: 0, saldoPendiente: 19675, estado: 'pendiente_total',
        contractsVinculados: [], fuente: 'xml_aeat',
        fechaImportación: '', fechaUltimaModificación: '',
      },
    ]);
    render(<TabPorConciliar inmuebleAliasById={alias} />);
    await waitFor(() => expect(screen.getByText('FA32')).toBeInTheDocument());
    expect(screen.getByText('2024')).toBeInTheDocument();
    // "Pendiente" aparece en la cabecera de columna y en el Pill de estado
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText((_t, el) => el?.textContent === '2 NIF declarados'),
    ).toBeInTheDocument();
  });
});
