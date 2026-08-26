import { mapearTipoContrato } from '../mapearTipoContrato';
import type { Contract } from '../../../../services/db';

const make = (modalidad: Contract['modalidad']): Contract =>
  ({ modalidad } as Contract);

describe('mapearTipoContrato', () => {
  test('habitual → larga', () => {
    expect(mapearTipoContrato(make('larga_estancia'))).toBe('larga');
  });

  test('temporada → corta', () => {
    expect(mapearTipoContrato(make('temporada'))).toBe('corta');
  });

  test('turístico → corta', () => {
    expect(mapearTipoContrato(make('corta_estancia'))).toBe('corta');
  });

  test('modalidad desconocida fallback a larga', () => {
    expect(mapearTipoContrato({ modalidad: 'otro' as Contract['modalidad'] } as Contract)).toBe('larga');
  });
});
