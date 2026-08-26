// Contexto 2 del mockup · la línea de la casilla 0150.
//
// Decía «Reducción Ley Vivienda · 60%» con un 60 que salía del modo de
// declaración, no de ningún contrato, y con un subtítulo que explicaba a mano lo
// que ahora dicen los chips. Pasa a decir el importe y los tramos.

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { buildInmuebleSecciones, getModoLabel } from '../helpers/inmuebleCasillasService';
import BoxRowCasilla from '../BoxRowCasilla';
import { desgloseDeclarado, desgloseEnCurso, desgloseAusente } from '../../../../services/desgloseReduccion';
import type { FiscalSummaryExtended } from '../../../../services/fiscalSummaryService';

const resumen = (reduccion: FiscalSummaryExtended['reduccion'], box0150: number): FiscalSummaryExtended =>
  ({
    box0101: 366, box0102: 19675, box0103: 0, box0104: 0, box0107: 0, box0108: 0,
    box0149: 5334.69, box0150, box0154: 5334.69 - box0150,
    modoDeclaracion: 'III', diasArrendado: 366, diasDisposicion: 0,
    reduccion, metodoProrrateo: 'dias_habitacion',
  }) as unknown as FiscalSummaryExtended;

const filaReduccion = (ext: FiscalSummaryExtended) => {
  const { secciones } = buildInmuebleSecciones(ext, null);
  const rendimiento = secciones[secciones.length - 1];
  const fila = rendimiento.rows.find((r) => r.num === '0150');
  if (!fila) throw new Error('no hay fila 0150');
  return fila;
};

const mixto = () =>
  desgloseDeclarado({
    arrendamientos: [
      { conReduccion: true },
      { conReduccion: false },
    ],
    reduccion: 1390.94,
    rendimientoAntes: 5334.69,
  });

describe('la casilla 0150 rotula por tramo', () => {
  it('el concepto ya no lleva el porcentaje pegado', () => {
    const fila = filaReduccion(resumen(mixto(), 1390.94));
    expect(fila.concepto).toBe('Reducción Ley Vivienda');
    expect(fila.concepto).not.toContain('%');
  });

  it('la fila lleva el desglose para que lo pinte el rótulo', () => {
    const fila = filaReduccion(resumen(mixto(), 1390.94));
    expect(fila.reduccion?.importe).toBe(1390.94);
    expect(fila.reduccion?.tramos).toHaveLength(2);
  });

  it('pintada, enseña los chips del mockup y no el subtítulo escrito a mano', () => {
    render(<BoxRowCasilla row={filaReduccion(resumen(mixto(), 1390.94))} />);
    expect(screen.getByText('vivienda habitual')).toBeInTheDocument();
    expect(screen.getByText('0% temporada/turístico')).toBeInTheDocument();
    expect(screen.queryByText(/aplicada sólo a la parte de larga estancia/)).toBeNull();
  });

  it('el año en curso dice el nominal exacto', () => {
    const enCurso = desgloseEnCurso(
      [
        { tipo: 'vivienda_habitual', pct: 60, ingresos: 6000 },
        { tipo: 'temporada', pct: 0, ingresos: 4000 },
      ],
      5334.69,
    );
    render(<BoxRowCasilla row={filaReduccion(resumen(enCurso, enCurso.importe ?? 0))} />);
    expect(screen.getByText('60% vivienda habitual')).toBeInTheDocument();
    expect(screen.getByText('0% temporada')).toBeInTheDocument();
  });

  it('sin dato · lo dice, y el importe queda vacío en vez de 0,00 €', () => {
    const fila = filaReduccion(resumen(desgloseAusente(), 0));
    expect(fila.importe).toBeNull();
    render(<BoxRowCasilla row={fila} />);
    expect(screen.getByText('Sin datos de reducción')).toBeInTheDocument();
  });
});

describe('el texto del modo ya no inventa un porcentaje', () => {
  it('modo I · describe el régimen, sin cifra', () => {
    const label = getModoLabel('I', desgloseEnCurso([{ tipo: 'vivienda_habitual', pct: 60, ingresos: 6000 }], 5000));
    expect(label.body).not.toMatch(/\d+%/);
    expect(label.tag).toBe('Larga estancia');
  });

  it('sin reducción · lo dice sin porcentaje', () => {
    const label = getModoLabel('I', desgloseAusente());
    expect(label.body).not.toMatch(/\d+%/);
  });
});
