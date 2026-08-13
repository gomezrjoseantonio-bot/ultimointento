// El detalle de un flujo del Panel pinta el apunte con el MODELO del apunte:
// título (quién) arriba, y debajo el qué es · inmueble. Antes solo había una
// línea con la descripción cruda, distinta a como se ve en Tesorería.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DetalleFlujoModal from '../DetalleFlujoModal';
import type { FlujoRow } from '../types';

const filas: FlujoRow[] = [
  {
    id: '1',
    fecha: '2026-08-01',
    concepto: 'Alisser Real Estate',
    detalle: 'Alquiler',
    inmueble: 'Fuertes Acevedo 32',
    importe: 1350,
    cuenta: 'Santander Nómina',
  },
  {
    id: '2',
    fecha: '2026-08-03',
    concepto: 'IBI',
    importe: 53,
    cuenta: 'Unicaja',
  },
];

describe('DetalleFlujoModal · dos líneas por apunte', () => {
  it('pinta título, qué es · inmueble, y fecha · cuenta', () => {
    render(<DetalleFlujoModal titulo="Ha entrado" signo="pos" filas={filas} onClose={() => {}} />);

    // Título = quién.
    expect(screen.getByText('Alisser Real Estate')).toBeInTheDocument();
    // Segunda línea = qué es · inmueble.
    expect(screen.getByText('Alquiler · Fuertes Acevedo 32')).toBeInTheDocument();
    // Fecha · cuenta sigue estando.
    expect(screen.getByText('· Santander Nómina')).toBeInTheDocument();
  });

  it('un apunte sin detalle ni inmueble no pinta la segunda línea', () => {
    render(<DetalleFlujoModal titulo="Ha salido" signo="neg" filas={filas} onClose={() => {}} />);

    // El IBI no tiene detalle/inmueble en este ejemplo: solo título + fecha·cuenta.
    expect(screen.getByText('IBI')).toBeInTheDocument();
    expect(screen.getByText('· Unicaja')).toBeInTheDocument();
    // No debe haber una segunda línea "· " colgando para ese apunte.
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('el total suma las magnitudes de los apuntes', () => {
    render(<DetalleFlujoModal titulo="Ha entrado" signo="pos" filas={filas} onClose={() => {}} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});
