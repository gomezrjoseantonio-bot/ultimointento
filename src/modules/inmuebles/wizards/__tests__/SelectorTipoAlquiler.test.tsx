// El selector de tipo de alquiler · el único sitio donde se elige.
//
// Antes el mismo campo se editaba en dos pasos distintos del wizard: un
// `<select>` «Modalidad» en el paso 1 y tres botones de régimen en el bloque
// fiscal del paso 3. Dos controles, un campo: el usuario podía dejar «Turístico»
// arriba y «Vivienda habitual» abajo, y ganaba el último que tocara.
//
// Lo que se vigila aquí: que la propuesta salga de las fechas, que se pueda
// sobrescribir, y que lo fiscal que enseña cada opción sea lo que de verdad
// aplica — «Reduce IRPF» solo donde el art. 23.2 reduce.

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectorTipoAlquiler from '../SelectorTipoAlquiler';

const pintar = (props?: Partial<React.ComponentProps<typeof SelectorTipoAlquiler>>) => {
  const onChange = jest.fn();
  const utils = render(
    <SelectorTipoAlquiler
      value="larga_estancia"
      onChange={onChange}
      fechaInicio="2026-01-01"
      fechaFin="2030-12-31"
      {...props}
    />,
  );
  return { ...utils, onChange };
};

const opcion = (nombre: RegExp): HTMLElement =>
  screen.getByRole('radio', { name: nombre });

describe('las tres opciones y su etiqueta doble', () => {
  it('cada una dice su nombre de gestión y su nombre fiscal', () => {
    // El arrendador piensa en duraciones; Hacienda, en regímenes. La etiqueta
    // doble evita tener que traducir de cabeza.
    pintar();
    expect(screen.getByText('Larga duración')).toBeInTheDocument();
    expect(screen.getByText('vivienda habitual')).toBeInTheDocument();
    expect(screen.getByText('Media estancia')).toBeInTheDocument();
    expect(screen.getByText('temporada')).toBeInTheDocument();
    expect(screen.getByText('Corta estancia')).toBeInTheDocument();
    expect(screen.getByText('turístico')).toBeInTheDocument();
  });

  it('en orden de mayor a menor duración', () => {
    pintar();
    const nombres = screen.getAllByRole('radio').map((r) => r.textContent ?? '');
    expect(nombres[0]).toContain('Larga duración');
    expect(nombres[1]).toContain('Media estancia');
    expect(nombres[2]).toContain('Corta estancia');
  });

  it('solo la larga reduce · las otras dos lo dicen con un 0 %', () => {
    pintar();
    expect(screen.getByText('Reduce IRPF')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(2);
  });

  it('la elegida se marca como tal', () => {
    pintar({ value: 'media_estancia' });
    expect(opcion(/Media estancia/)).toHaveAttribute('aria-checked', 'true');
    expect(opcion(/Larga duración/)).toHaveAttribute('aria-checked', 'false');
  });
});

describe('la propuesta sale de las fechas', () => {
  it('un contrato de cinco años propone larga duración', () => {
    pintar({ fechaInicio: '2026-01-01', fechaFin: '2030-12-31' });
    expect(opcion(/Larga duración/)).toHaveTextContent('Detectado');
  });

  it('el curso de un estudiante propone media estancia', () => {
    pintar({ fechaInicio: '2026-09-01', fechaFin: '2027-06-30' });
    expect(opcion(/Media estancia/)).toHaveTextContent('Detectado');
  });

  it('un fin de semana propone corta estancia', () => {
    pintar({ fechaInicio: '2026-03-06', fechaFin: '2026-03-08' });
    expect(opcion(/Corta estancia/)).toHaveTextContent('Detectado');
  });

  it('el badge solo va en una · es una propuesta, no tres', () => {
    pintar({ fechaInicio: '2026-03-06', fechaFin: '2026-03-08' });
    expect(screen.getAllByText('Detectado')).toHaveLength(1);
  });

  it('sin fechas no hay badge · nada que detectar', () => {
    pintar({ fechaInicio: '2026-01-01', fechaFin: '' });
    expect(screen.queryByText('Detectado')).toBeNull();
  });
});

describe('la propuesta se puede sobrescribir', () => {
  it('elegir otra opción manda · la ley mira el uso, no solo los días', () => {
    const { onChange } = pintar({ fechaInicio: '2026-09-01', fechaFin: '2027-06-30' });

    fireEvent.click(opcion(/Larga duración/));

    expect(onChange).toHaveBeenCalledWith('larga_estancia');
  });

  it('el badge se queda donde las fechas dicen, aunque se elija otra', () => {
    // Sigue informando de qué dicen las fechas: es la diferencia entre «ATLAS
    // se ha equivocado» y «he decidido otra cosa a sabiendas».
    pintar({ value: 'larga_estancia', fechaInicio: '2026-03-06', fechaFin: '2026-03-08' });
    expect(opcion(/Corta estancia/)).toHaveTextContent('Detectado');
    expect(opcion(/Larga duración/)).toHaveAttribute('aria-checked', 'true');
  });

  it('avisa cuando lo elegido no es lo que dicen las fechas', () => {
    pintar({ value: 'larga_estancia', fechaInicio: '2026-03-06', fechaFin: '2026-03-08' });
    expect(document.body.textContent).toContain('Las fechas dicen');
  });

  it('sin discrepancia no avisa de nada', () => {
    pintar({ value: 'larga_estancia', fechaInicio: '2026-01-01', fechaFin: '2030-12-31' });
    expect(document.body.textContent).not.toContain('Las fechas dicen');
  });
});
