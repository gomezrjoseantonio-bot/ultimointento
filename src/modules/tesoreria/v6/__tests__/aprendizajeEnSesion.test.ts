// ============================================================================
// El arrastre a las hermanas, con tope
// ============================================================================
//
// Clasificar UNA línea resuelve a sus hermanas del lote (misma clave, mismo
// signo, aún en «te necesitan»). Bien de una en una; pero 28 Bizum de golpe
// por haber clasificado uno es demasiado para hacerlo sin avisar. Jose (11 sep
// 2026): hasta unas pocas, solas; más, se pregunta.
// ============================================================================

import { act, renderHook } from '@testing-library/react';
import {
  TOPE_SIN_PREGUNTAR,
  aplicarAprendizajeALasHermanas,
  hayQuePreguntar,
  hermanasQueAprenderian,
  useArrastreConTope,
  type AprendizajeEnSesion,
} from '../aprendizajeEnSesion';
import type { LineaExtracto } from '../extractoSesion';
import type { GuardadoFicha } from '../FichaMovimiento';

// Funciones planas, no `jest.fn`: CRA arranca con `resetMocks: true` y borra
// las implementaciones antes de cada test.
const mockResueltas: number[] = [];
jest.mock('../../../../services/altaMovimientoService', () => ({
  origenIdRecurrenteDelGasto: async () => undefined,
  gastoDesdeMovimiento: async (p: { lineaId: number }) => {
    mockResueltas.push(p.lineaId);
    return { resultado: 'guardado' };
  },
}));
jest.mock('../../../../services/clasificacion/resueltaPorMotor', () => ({
  marcarResueltaPorElMotor: async () => undefined,
}));

const linea = (id: number, texto = 'Adeudo de canal isabel ii'): LineaExtracto => ({
  lineaId: 100 + id,
  hashLinea: `h${id}`,
  textoBanco: texto,
  fecha: '2026-06-25',
  importe: -30 - id,
  veredicto: 'resolver',
});

const AGUA = {
  tipo: 'gasto',
  concepto: 'Agua',
  importe: -31,
  fecha: '2026-06-25',
  cuentaId: 1,
  familiaPersistir: 'suministro',
  subtipoPersistir: 'agua',
  esMejora: false,
} as unknown as GuardadoFicha;

/** Un lote con la clasificada (id 1) y `n` hermanas iguales. */
const sesion = (n: number, over: Partial<AprendizajeEnSesion> = {}): AprendizajeEnSesion => {
  const lineas = [linea(1), ...Array.from({ length: n }, (_, i) => linea(i + 2))];
  return {
    linea: lineas[0],
    valores: AGUA,
    lineas,
    sinDecidir: () => true,
    onResuelta: (id) => marcadas.push(id),
    ...over,
  };
};

let marcadas: number[] = [];
beforeEach(() => {
  mockResueltas.length = 0;
  marcadas = [];
});

describe('el tope', () => {
  it('hasta el tope no se pregunta · por encima sí', () => {
    expect(hayQuePreguntar(0)).toBe(false);
    expect(hayQuePreguntar(TOPE_SIN_PREGUNTAR)).toBe(false);
    expect(hayQuePreguntar(TOPE_SIN_PREGUNTAR + 1)).toBe(true);
  });
});

describe('las hermanas que aprenderían', () => {
  it('son las iguales que siguen sin decidir · la propia línea no', () => {
    const a = sesion(4, { sinDecidir: (id) => id !== 103 });
    expect(hermanasQueAprenderian(a).map((l) => l.lineaId)).toEqual([102, 104, 105]);
  });

  it('una línea de otro concepto no es hermana', () => {
    const a = sesion(2);
    a.lineas = [...a.lineas, linea(9, 'Recibo Iberdrola Clientes')];
    expect(hermanasQueAprenderian(a).map((l) => l.lineaId)).toEqual([102, 103]);
  });
});

describe('aplicar a una lista dada', () => {
  it('toca solo esa lista, y avisa por cada una', async () => {
    const a = sesion(4);
    const n = await aplicarAprendizajeALasHermanas(a, [a.lineas[1], a.lineas[3]]);
    expect(n).toBe(2);
    expect(mockResueltas).toEqual([102, 104]);
    expect(marcadas).toEqual([102, 104]);
  });

  it('una mejora no arrastra a nadie', async () => {
    const a = sesion(2, { valores: { ...AGUA, esMejora: true } });
    expect(await aplicarAprendizajeALasHermanas(a)).toBe(0);
    expect(mockResueltas).toEqual([]);
  });
});

describe('el arrastre con tope, desde el drawer', () => {
  it('con pocas hermanas resuelve solo y no deja pregunta', async () => {
    const { result } = renderHook(() => useArrastreConTope());
    await act(() => result.current.proponer(sesion(TOPE_SIN_PREGUNTAR)));
    expect(mockResueltas).toHaveLength(TOPE_SIN_PREGUNTAR);
    expect(result.current.pendiente).toBeNull();
  });

  it('con más deja la pregunta y no toca nada', async () => {
    const { result } = renderHook(() => useArrastreConTope());
    await act(() => result.current.proponer(sesion(TOPE_SIN_PREGUNTAR + 4)));
    expect(mockResueltas).toEqual([]);
    expect(result.current.pendiente?.cuantas).toBe(TOPE_SIN_PREGUNTAR + 4);
  });

  it('al confirmar se recalcula con lo de AHORA · lo tocado entre medias no se pisa', async () => {
    const { result } = renderHook(() => useArrastreConTope());
    await act(() => result.current.proponer(sesion(5)));
    // Entre la pregunta y el sí, el usuario ignoró la 103.
    await act(() => result.current.confirmar({ sinDecidir: (id) => id !== 103, onResuelta: (id) => marcadas.push(id) }));
    expect(mockResueltas).toEqual([102, 104, 105, 106]);
    expect(marcadas).toEqual([102, 104, 105, 106]);
    expect(result.current.pendiente).toBeNull();
  });

  it('descartar quita la pregunta sin hacer nada', async () => {
    const { result } = renderHook(() => useArrastreConTope());
    await act(() => result.current.proponer(sesion(5)));
    act(() => result.current.descartar());
    expect(result.current.pendiente).toBeNull();
    expect(mockResueltas).toEqual([]);
  });

  it('otra línea clasificada después sustituye la pregunta anterior', async () => {
    const { result } = renderHook(() => useArrastreConTope());
    await act(() => result.current.proponer(sesion(5)));
    await act(() => result.current.proponer(sesion(0)));
    expect(result.current.pendiente).toBeNull();
  });
});
