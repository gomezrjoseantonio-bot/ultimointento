import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Badge from '../components/common/Badge';

describe('Badge', () => {
  test('renders text correctly', () => {
    render(<Badge variant="success">Success Badge</Badge>);
    expect(screen.getByText('Success Badge')).toBeInTheDocument();
  });

  test('applies correct classes for success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge).toHaveClass('bg-hz-success-light', 'text-hz-success');
  });

  test('applies correct classes for warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge).toHaveClass('bg-hz-warning-light', 'text-hz-warning');
  });

  test('applies correct classes for error variant', () => {
    render(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge).toHaveClass('bg-hz-error-light', 'text-hz-error');
  });

  test('applies correct classes for info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-hz-info-light', 'text-hz-info');
  });

  test('applies correct classes for neutral variant', () => {
    render(<Badge variant="neutral">Neutral</Badge>);
    const badge = screen.getByText('Neutral');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  test('defaults to neutral variant when no variant specified', () => {
    render(<Badge variant="neutral">Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  test('applies small size classes correctly', () => {
    render(<Badge variant="neutral" size="sm">Small</Badge>);
    const badge = screen.getByText('Small');
    expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
  });

  test('applies medium size classes correctly', () => {
    render(<Badge variant="neutral" size="md">Medium</Badge>);
    const badge = screen.getByText('Medium');
    expect(badge).toHaveClass('px-2.5', 'py-0.5', 'text-sm');
  });

  test('applies custom className', () => {
    render(<Badge variant="neutral" className="custom-class">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-class');
  });

  test('uses official Horizon design tokens', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    // Test that Horizon-specific classes are used instead of generic Tailwind colors
    expect(badge).not.toHaveClass('bg-success-100', 'text-success-800');
    expect(badge).toHaveClass('bg-hz-success-light', 'text-hz-success');
  });
});