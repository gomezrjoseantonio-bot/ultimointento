// Las líneas del fichero que ya estaban en ATLAS se enseñan, plegadas, con
// fecha, importe y concepto: el usuario puede saber cuáles son sin DevTools.

import React from 'react';
import { render, screen } from '@testing-library/react';
import YaEstaban from '../conciliar/YaEstaban';
import type { LineaExtractoPersistida } from '../../../../services/db/types-lineasExtracto';

const dup = (id: number, fecha: string, importe: number, texto: string): LineaExtractoPersistida =>
  ({
    id, accountId: 42, importBatchId: 'lote', fechaOperacion: fecha, fechaValor: fecha, importe,
    conceptoLiteral: texto, hashLinea: `v1:${id}`, hashMovement: `h${id}`, estado: 'sin_procesar',
    descarte: 'duplicada', movementIds: [], createdAt: '', updatedAt: '',
  }) as LineaExtractoPersistida;

describe('las que ya estaban', () => {
  it('sin duplicadas no pinta nada', () => {
    render(<YaEstaban lineas={[]} />);
    expect(screen.queryByTestId('ya-estaban')).toBeNull();
  });

  it('cuenta y lista cada una con fecha, importe y concepto', () => {
    render(
      <YaEstaban
        lineas={[
          dup(1, '2026-09-02', -10.2, 'Bizum A Favor De Victor Lada Horrillo'),
          dup(2, '2026-09-01', 395, 'Transferencia Inmediata De Miguel Lorenzo'),
        ]}
      />
    );
    const bloque = screen.getByTestId('ya-estaban');
    expect(bloque.textContent).toMatch(/2 líneas del fichero ya estaban en ATLAS/);
    expect(bloque.textContent).toMatch(/02\/09\/2026/);
    expect(bloque.textContent).toMatch(/−10,20 €/);
    expect(bloque.textContent).toMatch(/Bizum A Favor De Victor Lada Horrillo/);
    expect(bloque.textContent).toMatch(/\+395 €/);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('en singular cuando es una', () => {
    render(<YaEstaban lineas={[dup(1, '2026-09-02', -10.2, 'Bizum')]} />);
    expect(screen.getByTestId('ya-estaban').textContent).toMatch(/1 línea del fichero ya estaba en ATLAS/);
  });
});
