import type { Contract } from '../../../../services/db';
import { isContratoActivo, isContratoFinalizado } from '../ContratosListPage';

const baseContract = (
  estado: Contract['estadoContrato'],
  id: number,
): Contract => ({
  id,
  inmuebleId: 1,
  unidadTipo: 'vivienda',
  modalidad: 'habitual',
  inquilino: { nombre: 'Test', apellidos: 'User', dni: '', telefono: '', email: '' },
  fechaInicio: '2024-01-01',
  fechaFin: '2099-12-31',
  rentaMensual: 800,
  diaPago: 1,
  margenGraciaDias: 5,
  indexacion: 'none',
  historicoIndexaciones: [],
  fianzaMeses: 1,
  fianzaImporte: 800,
  fianzaEstado: 'retenida',
  cuentaCobroId: 1,
  estadoContrato: estado,
});

describe('Filtros tabs Contratos · §1 fix bug Histórico = Activos', () => {
  test('6 activos + 0 finalizados · activos cuenta 6 · histórico cuenta 0', () => {
    const contracts: Contract[] = Array.from({ length: 6 }, (_, i) =>
      baseContract('activo', i + 1),
    );
    const activos = contracts.filter(isContratoActivo);
    const historico = contracts.filter(isContratoFinalizado);
    expect(activos.length).toBe(6);
    expect(historico.length).toBe(0);
  });

  test('6 activos + 3 finalizados · ningún contrato aparece en ambos', () => {
    const contracts: Contract[] = [
      ...Array.from({ length: 6 }, (_, i) => baseContract('activo', i + 1)),
      ...Array.from({ length: 3 }, (_, i) => baseContract('finalizado', i + 100)),
    ];
    const activos = contracts.filter(isContratoActivo);
    const historico = contracts.filter(isContratoFinalizado);
    expect(activos.length).toBe(6);
    expect(historico.length).toBe(3);
    const overlap = activos.filter((c) => historico.some((h) => h.id === c.id));
    expect(overlap).toEqual([]);
  });

  test('contrato rescindido cuenta como histórico', () => {
    const contracts: Contract[] = [
      baseContract('rescindido', 1),
      baseContract('finalizado', 2),
      baseContract('activo', 3),
    ];
    expect(contracts.filter(isContratoFinalizado).length).toBe(2);
    expect(contracts.filter(isContratoActivo).length).toBe(1);
  });

  test('contrato sin_identificar no aparece ni en activos ni en histórico', () => {
    const contracts: Contract[] = [baseContract('sin_identificar', 1)];
    expect(contracts.filter(isContratoActivo).length).toBe(0);
    expect(contracts.filter(isContratoFinalizado).length).toBe(0);
  });
});
