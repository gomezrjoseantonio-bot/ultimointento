// FIX § 1.4 · useContratosByTab excluye los contratos sin inquilino real
// (placeholders AEAT "sin_identificar") de Vigentes · Próximos · Histórico.
import { renderHook } from '@testing-library/react';
import { useContratosByTab } from '../useContratosByTab';
import type { Contract } from '../../../../services/db';

const HOY = new Date();
const iso = (offsetDias: number): string => {
  const d = new Date(HOY.getTime() + offsetDias * 86400000);
  return d.toISOString().slice(0, 10);
};

const c = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Real', apellidos: 'Inquilino', dni: '1', telefono: '', email: '' },
    fechaInicio: iso(-400),
    fechaFin: iso(400),
    rentaMensual: 500,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 500,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    ...over,
  }) as Contract;

describe('useContratosByTab · exclusión sin identificar (§ 1.4)', () => {
  const vigenteReal = c({ id: 1 });
  const vigenteSinId = c({ id: 2, estadoContrato: 'sin_identificar', inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' } });
  const finalizadoReal = c({ id: 3, fechaInicio: iso(-800), fechaFin: iso(-400) });
  const finalizadoSinId = c({ id: 4, estadoContrato: 'sin_identificar', fechaInicio: iso(-800), fechaFin: iso(-400), inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' } });
  const todos = [vigenteReal, vigenteSinId, finalizadoReal, finalizadoSinId];

  test('Vigentes · excluye el sin identificar', () => {
    const { result } = renderHook(() => useContratosByTab('vigentes', todos));
    expect(result.current.map((x) => x.id)).toEqual([1]);
  });

  test('Histórico · excluye el sin identificar', () => {
    const { result } = renderHook(() => useContratosByTab('historico', todos));
    expect(result.current.map((x) => x.id)).toEqual([3]);
  });

  test('Por conciliar · devuelve todos (incluye los sin identificar)', () => {
    const { result } = renderHook(() => useContratosByTab('conciliar', todos));
    expect(result.current).toHaveLength(4);
  });
});
