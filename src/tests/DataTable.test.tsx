import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataTable from '../components/common/DataTable';

const mockData = [
  { id: 1, name: 'Test Item 1', amount: 100 },
  { id: 2, name: 'Test Item 2', amount: 200 }
];

const mockColumns = [
  { key: 'name', label: 'Name' },
  { key: 'amount', label: 'Amount', render: (value: number) => `€${value}` }
];

describe('DataTable', () => {
  test('renders table headers correctly', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);
    
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  test('renders table data correctly', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);
    
    expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    expect(screen.getByText('€100')).toBeInTheDocument();
    expect(screen.getByText('Test Item 2')).toBeInTheDocument();
    expect(screen.getByText('€200')).toBeInTheDocument();
  });

  test('renders default actions (Ver, Editar, Eliminar) in correct order', () => {
    const mockActions = [
      { type: 'view' as const, label: 'Ver', onClick: jest.fn() },
      { type: 'edit' as const, label: 'Editar', onClick: jest.fn() },
      { type: 'delete' as const, label: 'Eliminar', onClick: jest.fn() }
    ];

    render(<DataTable data={mockData} columns={mockColumns} actions={mockActions} />);
    
    const actionButtons = screen.getAllByRole('button');
    expect(actionButtons).toHaveLength(6); // 2 rows × 3 actions
    
    // Check first row actions
    expect(actionButtons[0]).toHaveAttribute('title', 'Ver');
    expect(actionButtons[1]).toHaveAttribute('title', 'Editar');
    expect(actionButtons[2]).toHaveAttribute('title', 'Eliminar');
  });

  test('shows empty state when no data', () => {
    render(<DataTable data={[]} columns={mockColumns} emptyMessage="No hay datos" />);
    expect(screen.getByText('No hay datos')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    render(<DataTable data={[]} columns={mockColumns} loading={true} />);
    expect(screen.getByRole('table')).toHaveClass('animate-pulse');
  });

  test('action buttons trigger correct callbacks', () => {
    const mockView = jest.fn();
    const mockActions = [
      { type: 'view' as const, label: 'Ver', onClick: mockView }
    ];

    render(<DataTable data={mockData} columns={mockColumns} actions={mockActions} />);
    
    const viewButtons = screen.getAllByTitle('Ver');
    fireEvent.click(viewButtons[0]);
    
    expect(mockView).toHaveBeenCalledWith(mockData[0]);
  });
});