import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropiedadFotoCard, PropiedadIconoRow, PropiedadVM } from '../PropiedadCards';

const vm = (over: Partial<PropiedadVM> = {}): PropiedadVM => ({
  id: 1,
  astId: 'AST-01',
  alias: 'Fuertes Acevedo 32',
  location: 'Oviedo · Asturias',
  municipio: 'Oviedo',
  tipoActivo: 'piso',
  tipoLabel: 'Piso',
  squareMeters: 100,
  bedrooms: 5,
  bathrooms: 2,
  foto: undefined,
  tieneParking: true,
  tieneTrastero: false,
  certificado: 'B',
  valorHoy: 250000,
  costeTotal: 75000,
  adquisicion: 62000,
  mejoras: 12000,
  revalPct: 233,
  rentaMensual: 1350,
  enAlquiler: true,
  rentabNetaPct: 7.8,
  ...over,
});

describe('PropiedadFotoCard', () => {
  it('muestra nombre, valor hoy, revalorización y explotación', () => {
    const onOpen = jest.fn();
    render(<PropiedadFotoCard p={vm()} onOpen={onOpen} />);
    expect(screen.getByText('Fuertes Acevedo 32')).toBeInTheDocument();
    expect(screen.getByText('AST-01')).toBeInTheDocument();
    expect(screen.getAllByText(/250\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\+233\s?%/)).toBeInTheDocument();
    expect(screen.getByText(/rentab\. neta 7,8\s?%/)).toBeInTheDocument();
  });

  it('degrada revalorización a — y marca uso propio sin explotación', () => {
    render(
      <PropiedadFotoCard
        p={vm({ valorHoy: null, revalPct: null, enAlquiler: false, rentaMensual: 0 })}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/uso propio/i).length).toBeGreaterThan(0);
  });

  it('invoca onOpen al hacer click', () => {
    const onOpen = jest.fn();
    render(<PropiedadFotoCard p={vm()} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Fuertes Acevedo 32'));
    expect(onOpen).toHaveBeenCalledWith(1);
  });
});

describe('PropiedadIconoRow', () => {
  it('muestra coste, valor y revalorización en la fila', () => {
    render(<PropiedadIconoRow p={vm()} onOpen={jest.fn()} />);
    expect(screen.getByText('Fuertes Acevedo 32')).toBeInTheDocument();
    expect(screen.getByText(/75\.000/)).toBeInTheDocument();
    expect(screen.getByText(/250\.000/)).toBeInTheDocument();
    expect(screen.getByText(/\+233\s?%/)).toBeInTheDocument();
  });
});
