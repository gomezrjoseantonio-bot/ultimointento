/**
 * Test for ContractsListaEnhanced undefined contract handling
 * 
 * Verifies that the component properly handles undefined contracts and missing inquilino data
 * to prevent "Cannot read properties of undefined (reading 'nombre')" errors
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContractsListaEnhanced from '../modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced';
import { Contract } from '../services/db';

// Mock the dependencies
jest.mock('../services/contractService', () => ({
  getAllContracts: jest.fn().mockResolvedValue([]),
  deleteContract: jest.fn(),
  rescindContract: jest.fn(),
  getContractStatus: jest.fn().mockReturnValue('active')
}));

jest.mock('../services/db', () => ({
  initDB: jest.fn().mockResolvedValue({
    getAll: jest.fn().mockResolvedValue([
      { id: 1, alias: 'Property 1' },
      { id: 2, alias: 'Property 2' }
    ])
  })
}));

jest.mock('../utils/formatUtils', () => ({
  formatEuro: jest.fn((value) => `€${value}`),
  formatDate: jest.fn((date) => date)
}));

jest.mock('react-hot-toast', () => ({
  default: {
    error: jest.fn(),
    success: jest.fn()
  }
}));

describe('ContractsListaEnhanced undefined contract handling', () => {
  const mockOnEditContract = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle contracts array with undefined elements', async () => {
    // Mock getAllContracts to return an array with undefined values
    const { getAllContracts } = require('../services/contractService');
    const contractsWithUndefined = [
      undefined,
      {
        id: 1,
        inmuebleId: 1,
        unidadTipo: 'vivienda',
        modalidad: 'habitual',
        inquilino: {
          nombre: 'John',
          apellidos: 'Doe',
          dni: '12345678A',
          telefono: '123456789',
          email: 'john@example.com'
        },
        fechaInicio: '2023-01-01',
        fechaFin: '2028-01-01',
        rentaMensual: 1000,
        diaPago: 1,
        margenGraciaDias: 5,
        indexacion: 'none',
        historicoIndexaciones: [],
        fianzaMeses: 1,
        fianzaImporte: 1000,
        fianzaEstado: 'retenida',
        cuentaCobroId: 1,
        estadoContrato: 'activo',
        status: 'active',
        documents: [],
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      } as Contract,
      null
    ];
    
    getAllContracts.mockResolvedValue(contractsWithUndefined);

    // Render component
    render(<ContractsListaEnhanced onEditContract={mockOnEditContract} />);

    // Wait for loading to complete and check contract count
    await waitFor(() => {
      expect(screen.getByText('Contratos (1)')).toBeInTheDocument();
    });

    // Should not crash and should display the valid contract
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('12345678A')).toBeInTheDocument();
  });

  it('should handle contracts with missing inquilino property', async () => {
    const { getAllContracts } = require('../services/contractService');
    const contractsWithMissingInquilino = [
      {
        id: 1,
        inmuebleId: 1,
        unidadTipo: 'vivienda',
        modalidad: 'habitual',
        // inquilino property is missing
        fechaInicio: '2023-01-01',
        fechaFin: '2028-01-01',
        rentaMensual: 1000,
        diaPago: 1,
        margenGraciaDias: 5,
        indexacion: 'none',
        historicoIndexaciones: [],
        fianzaMeses: 1,
        fianzaImporte: 1000,
        fianzaEstado: 'retenida',
        cuentaCobroId: 1,
        estadoContrato: 'activo',
        status: 'active',
        documents: [],
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      } as any, // Using any to simulate missing inquilino
      {
        id: 2,
        inmuebleId: 2,
        unidadTipo: 'vivienda',
        modalidad: 'habitual',
        inquilino: {
          nombre: 'Jane',
          apellidos: 'Smith',
          dni: '87654321B',
          telefono: '987654321',
          email: 'jane@example.com'
        },
        fechaInicio: '2023-01-01',
        fechaFin: '2028-01-01',
        rentaMensual: 1200,
        diaPago: 1,
        margenGraciaDias: 5,
        indexacion: 'none',
        historicoIndexaciones: [],
        fianzaMeses: 1,
        fianzaImporte: 1200,
        fianzaEstado: 'retenida',
        cuentaCobroId: 1,
        estadoContrato: 'activo',
        status: 'active',
        documents: [],
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      } as Contract
    ];

    getAllContracts.mockResolvedValue(contractsWithMissingInquilino);

    render(<ContractsListaEnhanced onEditContract={mockOnEditContract} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Contratos (1)')).toBeInTheDocument();
    });

    // Should only display the valid contract
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('87654321B')).toBeInTheDocument();
  });

  it('should handle empty contracts array gracefully', async () => {
    const { getAllContracts } = require('../services/contractService');
    getAllContracts.mockResolvedValue([]);

    render(<ContractsListaEnhanced onEditContract={mockOnEditContract} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Contratos (0)')).toBeInTheDocument();
    });
    
    // Should show empty state message
    expect(screen.getByText('No hay contratos')).toBeInTheDocument();
    expect(screen.getByText('Comience creando su primer contrato.')).toBeInTheDocument();
  });
});

export {};