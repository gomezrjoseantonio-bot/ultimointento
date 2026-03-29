import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import SubTabs from './SubTabs';
import { ThemeProvider } from '../../contexts/ThemeContext';

describe('SubTabs', () => {
  test('muestra Mi IRPF e Historial dentro de Fiscalidad', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/fiscalidad/historial']}>
          <SubTabs />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Mi IRPF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Historial' })).toBeTruthy();
  });
});
