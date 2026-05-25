/**
 * Tests unitarios del componente canónico `<EmptyState />`.
 *
 * Cobertura ·
 *   1. Render icono · título · subtítulo sin CTA (no se renderiza el botón).
 *   2. Render con CTA y que el onClick se invoca.
 *   3. Icono custom en el CTA distinto de Plus.
 *   4. Variantes de tamaño (small · normal · large) aplican la clase correcta.
 *   5. Atributos de accesibilidad (role="status").
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Building2, Upload } from 'lucide-react';
import { EmptyState } from '../EmptyState';

describe('EmptyState (canónico · §1.1)', () => {
  it('renderiza icono · título · subtítulo sin CTA', () => {
    const { container } = render(
      <EmptyState
        icon={Building2}
        title="Sin inmuebles aún"
        subtitle="Añade tu primer inmueble."
      />,
    );
    expect(screen.getByText('Sin inmuebles aún')).toBeInTheDocument();
    expect(screen.getByText('Añade tu primer inmueble.')).toBeInTheDocument();
    expect(container.querySelector('button')).not.toBeInTheDocument();
    expect(container.querySelector('.atlas-empty')).toBeInTheDocument();
    expect(container.querySelector('.atlas-empty__icon-wrap')).toBeInTheDocument();
  });

  it('renderiza CTA cuando se pasa y dispara onClick', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        icon={Building2}
        title="Sin inmuebles aún"
        subtitle="Añade tu primer inmueble."
        cta={{ label: 'Añadir inmueble', onClick }}
      />,
    );
    const btn = screen.getByRole('button', { name: /Añadir inmueble/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('acepta icono custom en el CTA distinto de Plus', () => {
    const { container } = render(
      <EmptyState
        icon={Building2}
        title="Sin posiciones aún"
        subtitle="Importa tu cartera."
        cta={{ label: 'Importar', onClick: jest.fn(), icon: Upload }}
      />,
    );
    const btn = screen.getByRole('button', { name: /Importar/i });
    // El icono dentro del botón debe ser un SVG (Upload renderiza svg).
    expect(btn.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('.atlas-empty__cta-icon')).toBeInTheDocument();
  });

  it('renderiza variantes de size correctamente', () => {
    const { container, rerender } = render(
      <EmptyState
        icon={Building2}
        title="t"
        subtitle="s"
        size="small"
      />,
    );
    expect(container.querySelector('.atlas-empty--small')).toBeInTheDocument();

    rerender(
      <EmptyState
        icon={Building2}
        title="t"
        subtitle="s"
        size="large"
      />,
    );
    expect(container.querySelector('.atlas-empty--large')).toBeInTheDocument();

    rerender(
      <EmptyState icon={Building2} title="t" subtitle="s" />,
    );
    expect(container.querySelector('.atlas-empty--normal')).toBeInTheDocument();
  });

  it('tiene role status y aria-live polite para accesibilidad', () => {
    render(
      <EmptyState icon={Building2} title="t" subtitle="s" />,
    );
    const root = screen.getByRole('status');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('aria-live', 'polite');
  });

  it('acepta className override para encajar en layouts particulares', () => {
    const { container } = render(
      <EmptyState
        icon={Building2}
        title="t"
        subtitle="s"
        className="custom-wrap"
      />,
    );
    expect(container.querySelector('.atlas-empty.custom-wrap')).toBeInTheDocument();
  });
});
