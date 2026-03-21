import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import SubTabs from './SubTabs';
import { ThemeProvider } from '../../contexts/ThemeContext';

describe('SubTabs', () => {
  test('muestra las tabs Histórico y Entidades dentro de Fiscalidad', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/fiscalidad/historico']}>
          <SubTabs />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Histórico' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entidades' })).toBeTruthy();
  });
});
