// V78.1 (Commit 3 · pulido drawer matching) · tests del drawer de conciliación de botes.
//
// Cubre B1 (totales reactivos), B2 (nombre del inquilino en vinculados), B3/M1 (vincular
// todas) y M2 (auto-cierre en `cerrado`, banner + bloqueo en `sobre_asignado`).
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const mockSugerirContracts = jest.fn();
const mockVincularContract = jest.fn();
const mockDesvincularContract = jest.fn();

jest.mock('../../../../../services/boteAnualService', () => ({
  boteAnualService: {
    sugerirContracts: (...a: any[]) => mockSugerirContracts(...a),
    vincularContract: (...a: any[]) => mockVincularContract(...a),
    desvincularContract: (...a: any[]) => mockDesvincularContract(...a),
  },
}));

const mockGetContractsMap = jest.fn();
jest.mock('../../../../../utils/contractDisplay', () => {
  const actual = jest.requireActual('../../../../../utils/contractDisplay');
  return { ...actual, getContractsMap: (...a: any[]) => mockGetContractsMap(...a) };
});

import DrawerConciliarBote from '../DrawerConciliarBote';

function baseBote(overrides: any = {}) {
  return {
    id: 1, inmuebleId: 4, año: 2024, importeDeclarado: 10000, díasDeclarados: 365,
    nifsDetectados: ['12345678Z'], tiposArrendamientoOriginales: [],
    importeAsignado: 0, saldoPendiente: 10000, estado: 'pendiente_total',
    contractsVinculados: [], fuente: 'xml_aeat',
    fechaImportación: '', fechaUltimaModificación: '',
    ...overrides,
  };
}

function sug(contractId: number, importe: number, nombre: string) {
  return {
    contract: { id: contractId, inquilino: { nombre, apellidos: '', dni: '', telefono: '', email: '' } },
    contractId,
    score: 10,
    importeSugerido: importe,
    nifCoincide: false,
    mesesSolapados: 6,
    motivos: ['solapa 6 meses en 2024'],
  };
}

describe('DrawerConciliarBote', () => {
  beforeEach(() => {
    mockSugerirContracts.mockReset();
    mockVincularContract.mockReset();
    mockDesvincularContract.mockReset();
    mockGetContractsMap.mockReset().mockResolvedValue(new Map());
  });

  it('B1 · muestra total sugerido y diferencia con pendiente, reactivos al editar', async () => {
    mockSugerirContracts.mockResolvedValue([sug(8, 4200, 'JOSEPH'), sug(25, 2800, 'ANDRES')]);
    render(<DrawerConciliarBote bote={baseBote() as any} open onClose={jest.fn()} onChange={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Total sugerido')).toBeInTheDocument());
    // 4200 + 2800 = 7000
    expect(screen.getByText('7.000 €')).toBeInTheDocument();

    // Editar la primera sugerencia a 6000 → total 8800
    const inputs = screen.getAllByLabelText(/Importe a vincular/);
    fireEvent.change(inputs[0], { target: { value: '6000' } });
    await waitFor(() => expect(screen.getByText('8.800 €')).toBeInTheDocument());
  });

  it('B2 · "Contratos vinculados" pinta el nombre del inquilino, no el id', async () => {
    mockSugerirContracts.mockResolvedValue([]);
    mockGetContractsMap.mockResolvedValue(
      new Map([[8, { id: 8, unidadTipo: 'vivienda', inquilino: { nombre: 'JOSEPH', apellidos: 'PALMA GARCIA', dni: '', telefono: '', email: '' } }]]),
    );
    const bote = baseBote({
      importeAsignado: 4200, saldoPendiente: 5800, estado: 'parcial',
      contractsVinculados: [{ contractId: 8, importeAsignado: 4200, fechaVinculación: '', origen: 'manual_usuario' }],
    });
    render(<DrawerConciliarBote bote={bote as any} open onClose={jest.fn()} onChange={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('JOSEPH PALMA GARCIA')).toBeInTheDocument());
    expect(screen.queryByText('Contrato #8')).not.toBeInTheDocument();
  });

  it('B3/M2 · vincular todas que cuadran exacto → estado cerrado · auto-cierra', async () => {
    jest.useFakeTimers();
    mockSugerirContracts.mockResolvedValue([sug(8, 6000, 'JOSEPH'), sug(25, 4000, 'ANDRES')]);
    mockVincularContract
      .mockResolvedValueOnce(baseBote({ importeAsignado: 6000, saldoPendiente: 4000, estado: 'parcial' }))
      .mockResolvedValueOnce(baseBote({ importeAsignado: 10000, saldoPendiente: 0, estado: 'cerrado' }));
    const onClose = jest.fn();
    const onChange = jest.fn();
    render(<DrawerConciliarBote bote={baseBote() as any} open onClose={onClose} onChange={onChange} />);

    await waitFor(() => expect(screen.getByText('Vincular todas las sugerencias')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Vincular todas las sugerencias'));
    });

    await waitFor(() => expect(mockVincularContract).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Ingresos conciliados')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalled();

    // Auto-cierre tras el delay del banner.
    act(() => { jest.advanceTimersByTime(2000); });
    expect(onClose).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('M2 · vincular todas que exceden → estado sobre_asignado · banner rojo · no cierra', async () => {
    jest.useFakeTimers();
    mockSugerirContracts.mockResolvedValue([sug(8, 12000, 'JOSEPH')]);
    mockVincularContract.mockResolvedValue(baseBote({ importeAsignado: 12000, saldoPendiente: -2000, estado: 'sobre_asignado' }));
    const onClose = jest.fn();
    render(<DrawerConciliarBote bote={baseBote() as any} open onClose={onClose} onChange={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Vincular todas las sugerencias')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Vincular todas las sugerencias'));
    });

    await waitFor(() => expect(screen.getByText('Has asignado más que lo declarado')).toBeInTheDocument());
    act(() => { jest.advanceTimersByTime(3000); });
    expect(onClose).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
