// E1.3 · el hook avisa de lo que cambia tras cada gesto · y calla cuando no es
// un gesto (cargar un lote retomado, reiniciar).

import { act, renderHook } from '@testing-library/react';
import { useDecisionesDeSesion } from '../decisionesDeSesion';
import { decisionesVacias, type LineaExtracto } from '../extractoSesion';
import type { CambioDeDecision } from '../decisionesPersistidas';

const linea = (id: number, importe = -30): LineaExtracto => ({
  lineaId: 100 + id,
  movementId: id,
  hashLinea: `h${id}`,
  textoBanco: 'PAGO EN REVOLUT',
  fecha: '2026-08-02',
  importe,
  veredicto: 'resolver',
});

describe('E1.3 · useDecisionesDeSesion · onCambio', () => {
  it('cada gesto avisa con las líneas tocadas y su decisión nueva', () => {
    const onCambio = jest.fn<void, [CambioDeDecision[]]>();
    const { result } = renderHook(() => useDecisionesDeSesion([linea(1), linea(2)], { onCambio }));

    act(() => result.current.ignorar(101));
    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(onCambio.mock.calls[0][0]).toEqual([
      { lineaId: 101, decision: expect.objectContaining({ ignorada: true }) },
    ]);

    act(() => result.current.asignar(101, 5));
    // Asignar quita el ignorado y pone el evento · una línea, una decisión nueva.
    expect(onCambio.mock.calls[1][0]).toEqual([
      { lineaId: 101, decision: expect.objectContaining({ asignadoA: 5 }) },
    ]);
    expect(onCambio.mock.calls[1][0][0].decision).not.toHaveProperty('ignorada');

    act(() => result.current.desmarcarTraspaso(101)); // no cambia nada
    expect(onCambio).toHaveBeenCalledTimes(2);
  });

  it('un gesto en bloque avisa de todas las líneas del gesto', () => {
    const onCambio = jest.fn<void, [CambioDeDecision[]]>();
    const { result } = renderHook(() =>
      useDecisionesDeSesion([linea(1), linea(2), linea(3)], { onCambio })
    );
    act(() => result.current.traspasarVarias([101, 102, 103], 9));
    expect(onCambio.mock.calls[0][0].map((c) => c.lineaId).sort()).toEqual([101, 102, 103]);
    expect(onCambio.mock.calls[0][0][0].decision).toEqual(expect.objectContaining({ traspasoA: 9 }));
  });

  it('deshacer avisa con decision undefined', () => {
    const onCambio = jest.fn<void, [CambioDeDecision[]]>();
    const { result } = renderHook(() => useDecisionesDeSesion([linea(1)], { onCambio }));
    act(() => result.current.marcarEfectivo(101));
    act(() => result.current.desmarcarEfectivo(101));
    expect(onCambio.mock.calls[1][0]).toEqual([{ lineaId: 101, decision: undefined }]);
  });

  it('cargar un lote retomado NO avisa · y el gesto siguiente avisa solo de lo suyo', () => {
    const onCambio = jest.fn<void, [CambioDeDecision[]]>();
    const { result } = renderHook(() => useDecisionesDeSesion([linea(1), linea(2)], { onCambio }));

    const cargadas = decisionesVacias();
    cargadas.ignorados.add(101);
    cargadas.aTraspaso.set(102, 9);
    act(() => result.current.cargarDecisiones(cargadas));
    expect(onCambio).not.toHaveBeenCalled();
    expect(result.current.decisiones).toEqual(cargadas);

    act(() => result.current.recuperar(101));
    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(onCambio.mock.calls[0][0].map((c) => c.lineaId)).toEqual([101]);
  });

  it('reiniciar NO avisa · las líneas del lote anterior no se «des-deciden» en la base', () => {
    const onCambio = jest.fn<void, [CambioDeDecision[]]>();
    const { result } = renderHook(() => useDecisionesDeSesion([linea(1)], { onCambio }));
    act(() => result.current.ignorar(101));
    expect(onCambio).toHaveBeenCalledTimes(1);
    act(() => result.current.reiniciarDecisiones());
    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(result.current.decisiones).toEqual(decisionesVacias());
  });

  it('sin onCambio el hook funciona como siempre', () => {
    const { result } = renderHook(() => useDecisionesDeSesion([linea(1)]));
    act(() => result.current.ignorar(101));
    expect(result.current.decisiones.ignorados.has(101)).toBe(true);
  });
});
