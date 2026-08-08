// Panel · useAutoFitHeight · el par outer/inner que garantiza el Panel sin
// scroll. jsdom no implementa layout: las alturas se simulan sobreescribiendo
// los getters de clientHeight/offsetHeight con valores declarados por atributo.

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useAutoFitHeight, MIN_SCALE } from '../useAutoFitHeight';

const Harness: React.FC<{ disponible: number; natural: number }> = ({
  disponible,
  natural,
}) => {
  const fit = useAutoFitHeight();
  return (
    <div
      data-testid="outer"
      data-client-h={disponible}
      ref={fit.outerRef}
      style={fit.outerStyle}
    >
      <div data-testid="inner" data-offset-h={natural} ref={fit.innerRef} style={fit.innerStyle}>
        contenido
      </div>
    </div>
  );
};

const originalClientHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientHeight'
);
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight'
);

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.getAttribute('data-client-h') ?? 0);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.getAttribute('data-offset-h') ?? 0);
    },
  });
});

afterAll(() => {
  if (originalClientHeight)
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
  if (originalOffsetHeight)
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
});

describe('useAutoFitHeight', () => {
  it('con el contenido cabiendo (natural ≤ disponible) no escala ni permite scroll', () => {
    render(<Harness disponible={1000} natural={800} />);
    expect(screen.getByTestId('outer').style.overflow).toBe('hidden');
    expect(screen.getByTestId('inner').style.transform).toBe('');
  });

  it('con contenido más alto que el hueco aplica scale UNIFORME (sin compensar ancho)', () => {
    render(<Harness disponible={800} natural={1000} />);
    const inner = screen.getByTestId('inner');
    expect(inner.style.transform).toBe('scale(0.8)');
    expect(inner.style.transformOrigin).toBe('top left');
    // REGRESIÓN · NO debe compensar el ancho (`width: 100/scale%`): eso acopla
    // ancho↔altura y provoca el bucle de re-medición infinito (parpadeo del
    // Panel). El escalado es uniforme · sin width.
    expect(inner.style.width).toBe('');
    // Sigue sin scroll · el contenido escalado cabe entero.
    expect(screen.getByTestId('outer').style.overflow).toBe('hidden');
  });

  it('por debajo de MIN_SCALE fija la escala mínima y degrada a scroll vertical', () => {
    render(<Harness disponible={200} natural={1000} />); // ratio 0.2 < MIN_SCALE
    const inner = screen.getByTestId('inner');
    expect(inner.style.transform).toBe(`scale(${MIN_SCALE})`);
    expect(inner.style.width).toBe('');
    expect(screen.getByTestId('outer').style.overflow).toBe('hidden auto');
  });
});
