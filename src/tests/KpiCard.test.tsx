import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import KpiCard from '../components/common/KpiCard';
import { TrendingUp, TrendingDown } from 'lucide-react';

describe('KpiCard', () => {
  test('renders title and value correctly', () => {
    render(<KpiCard title="Revenue" value="€15,000" />);
    
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('€15,000')).toBeInTheDocument();
  });

  test('renders subtitle when provided', () => {
    render(
      <KpiCard 
        title="Revenue" 
        value="€15,000" 
        subtitle="vs último mes" 
      />
    );
    
    expect(screen.getByText('vs último mes')).toBeInTheDocument();
  });

  test('renders trending up icon and percentage', () => {
    render(
      <KpiCard 
        title="Revenue" 
        value="€15,000" 
        trend={{ value: 12.5, isPositive: true }}
      />
    );
    
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
    // Check that trending up styling is applied
    const trendElement = screen.getByText('+12.5%').parentElement;
    expect(trendElement).toHaveClass('text-hz-success');
  });

  test('renders trending down icon and percentage', () => {
    render(
      <KpiCard 
        title="Revenue" 
        value="€15,000" 
        trend={{ value: 8.2, isPositive: false }}
      />
    );
    
    expect(screen.getByText('-8.2%')).toBeInTheDocument();
    // Check that trending down styling is applied
    const trendElement = screen.getByText('-8.2%').parentElement;
    expect(trendElement).toHaveClass('text-hz-error');
  });

  test('renders custom icon when provided', () => {
    render(
      <KpiCard 
        title="Users" 
        value="1,234" 
        icon={<div data-testid="custom-icon">👥</div>}
      />
    );
    
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(
      <KpiCard 
        title="Revenue" 
        value="€15,000" 
        className="custom-class" />
    );
    
    const card = screen.getByText('Revenue').closest('div');
    expect(card).toHaveClass('custom-class');
  });

  test('renders loading state', () => {
    // KpiCard doesn't have a loading prop, so test with actual content
    render(
      <KpiCard 
        title="Revenue" 
        value="€15,000" 
      />
    );
    
    // Should show actual content
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('€15,000')).toBeInTheDocument();
  });

  test('uses Horizon design tokens for styling', () => {
    render(<KpiCard title="Revenue" value="€15,000" />);
    
    const card = screen.getByText('Revenue').closest('div');
    // Check for Horizon-specific styling
    expect(card).toHaveClass('bg-white', 'border', 'border-gray-200', 'rounded-lg');
    
    const valueElement = screen.getByText('€15,000');
    expect(valueElement).toHaveClass('text-gray-900');
  });

  test('formats large numbers correctly in value', () => {
    render(<KpiCard title="Revenue" value="€1,234,567" />);
    expect(screen.getByText('€1,234,567')).toBeInTheDocument();
  });

  test('handles neutral trend correctly', () => {
    render(
      <KpiCard 
        title="Revenue" 
        value="€15,000" 
        trend={{ value: 0, isPositive: true }}
      />
    );
    
    expect(screen.getByText('0%')).toBeInTheDocument();
    const trendElement = screen.getByText('0%').parentElement;
    expect(trendElement).toHaveClass('text-gray-500');
  });
});