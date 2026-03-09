import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilterBar from '../components/common/FilterBar';

describe('FilterBar', () => {
  test('renders search input with placeholder', () => {
    const mockSearch = jest.fn();
    render(
      <FilterBar 
        searchValue=""
        onSearchChange={mockSearch}
        searchPlaceholder="Search placeholder"
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search placeholder');
    expect(searchInput).toBeInTheDocument();
    
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    expect(mockSearch).toHaveBeenCalledWith('test search');
  });

  test('renders filter dropdowns correctly', () => {
    const mockFilterChange = jest.fn();
    render(
      <FilterBar 
        filters={[
          {
            key: 'status',
            label: 'Estado',
            value: 'all',
            options: [
              { value: 'all', label: 'Todos' },
              { value: 'active', label: 'Activos' }
            ],
            onChange: mockFilterChange
          }
        ]}
      />
    );
    
    expect(screen.getByText('Estado:')).toBeInTheDocument();
    const select = screen.getByDisplayValue('Todos');
    expect(select).toBeInTheDocument();
    
    fireEvent.change(select, { target: { value: 'active' } });
    expect(mockFilterChange).toHaveBeenCalledWith('active');
  });

  test('renders date range inputs when provided', () => {
    const mockStartDate = jest.fn();
    const mockEndDate = jest.fn();
    
    render(
      <FilterBar 
        dateRange={{
          label: 'Período',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          onStartDateChange: mockStartDate,
          onEndDateChange: mockEndDate
        }}
      />
    );
    
    expect(screen.getByText('Período:')).toBeInTheDocument();
    
    const dateInputs = screen.getAllByDisplayValue(/2024-01/);
    expect(dateInputs).toHaveLength(2);
    
    fireEvent.change(dateInputs[0], { target: { value: '2024-02-01' } });
    expect(mockStartDate).toHaveBeenCalledWith('2024-02-01');
  });

  test('applies Horizon design tokens for focus states', () => {
    const mockSearch = jest.fn();
    render(
      <FilterBar 
        searchValue=""
        onSearchChange={mockSearch}
        searchPlaceholder="Test"
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Test');
    expect(searchInput).toHaveStyle({
      '--tw-ring-color': 'var(--hz-primary)',
      '--tw-ring-opacity': '0.3'
    });
  });
});