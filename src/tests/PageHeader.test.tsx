import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PageHeader from '../components/common/PageHeader';

describe('PageHeader', () => {
  test('renders title correctly', () => {
    render(<PageHeader title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  test('renders subtitle when provided', () => {
    render(<PageHeader title="Test Title" subtitle="Test subtitle" />);
    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
  });

  test('renders primary action button in top-right position', () => {
    const mockClick = jest.fn();
    render(
      <PageHeader 
        title="Test Title" 
        primaryAction={{
          label: "Nuevo test",
          onClick: mockClick
        }}
      />
    );
    
    const button = screen.getByText('Nuevo test');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('horizon-primary');
    
    fireEvent.click(button);
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  test('renders secondary actions when provided', () => {
    const mockSecondary = jest.fn();
    render(
      <PageHeader 
        title="Test Title"
        secondaryActions={[{
          label: "Secondary Action",
          onClick: mockSecondary
        }]}
      />
    );
    
    const button = screen.getByText('Secondary Action');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('horizon-secondary');
  });

  test('shows tooltip when info icon is enabled', () => {
    render(
      <PageHeader 
        title="Test Title" 
        subtitle="Tooltip text"
        showInfoIcon={true}
      />
    );
    
    const infoIcon = screen.getByRole('button', { name: /page-info-tooltip/i });
    expect(infoIcon).toBeInTheDocument();
  });
});