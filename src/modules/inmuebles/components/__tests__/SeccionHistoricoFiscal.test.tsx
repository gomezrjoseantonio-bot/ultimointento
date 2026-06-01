// V78.1 (Commit 5) · tests de la sección "Histórico fiscal declarado".
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

const mockObtener = jest.fn();
jest.mock('../../../../services/historicoFiscalInmuebleService', () => ({
  obtenerHistoricoFiscalInmueble: (...a: any[]) => mockObtener(...a),
}));

const mockGetContractsMap = jest.fn();
jest.mock('../../../../utils/contractDisplay', () => {
  const actual = jest.requireActual('../../../../utils/contractDisplay');
  return { ...actual, getContractsMap: (...a: any[]) => mockGetContractsMap(...a) };
});

import SeccionHistoricoFiscal from '../SeccionHistoricoFiscal';

describe('SeccionHistoricoFiscal', () => {
  beforeEach(() => {
    mockObtener.mockReset();
    mockGetContractsMap.mockReset().mockResolvedValue(new Map());
  });

  it('pinta un año con bote conciliado y sus contratos vinculados por nombre', async () => {
    mockObtener.mockResolvedValue([
      {
        año: 2024,
        bote: {
          id: 1, inmuebleId: 4, año: 2024, importeDeclarado: 19675, estado: 'cerrado',
          contractsVinculados: [
            { contractId: 8, importeAsignado: 4200, fechaVinculación: '', origen: 'manual_usuario' },
          ],
        },
        contractsCamino1: [],
      },
    ]);
    mockGetContractsMap.mockResolvedValue(
      new Map([[8, { id: 8, inquilino: { nombre: 'JOSEPH', apellidos: 'PALMA GARCIA', dni: '', telefono: '', email: '' } }]]),
    );

    render(<SeccionHistoricoFiscal inmuebleId={4} />);
    await waitFor(() => expect(screen.getByText('Año 2024')).toBeInTheDocument());
    expect(screen.getByText('Conciliado')).toBeInTheDocument();
    expect(screen.getByText('JOSEPH PALMA GARCIA')).toBeInTheDocument();
    expect(screen.getByText('Total vinculado')).toBeInTheDocument();
  });

  it('pinta un año Camino 1 con NIF y "gestión normal", sin chip de estado', async () => {
    mockObtener.mockResolvedValue([
      {
        año: 2022,
        bote: undefined,
        contractsCamino1: [
          {
            contract: { id: 30, inquilino: { nombre: 'AROA', apellidos: '', dni: '11111111H', telefono: '', email: '' } },
            ejercicio: { estado: 'declarado', importeDeclarado: 5380, nifsDetectados: ['11111111H'] },
          },
        ],
      },
    ]);
    render(<SeccionHistoricoFiscal inmuebleId={7} />);
    await waitFor(() => expect(screen.getByText('Año 2022')).toBeInTheDocument());
    expect(screen.getByText('gestión normal')).toBeInTheDocument();
    expect(screen.getByText('AROA')).toBeInTheDocument();
    expect(screen.getByText('NIF 11111111H')).toBeInTheDocument();
    expect(screen.queryByText('Conciliado')).not.toBeInTheDocument();
  });

  it('muestra el hint cuando no hay datos', async () => {
    mockObtener.mockResolvedValue([]);
    render(<SeccionHistoricoFiscal inmuebleId={99} />);
    await waitFor(() =>
      expect(screen.getByText(/aún no tiene rentas declaradas/i)).toBeInTheDocument(),
    );
  });
});
