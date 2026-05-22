import { mapearTipoContrato } from '../mapearTipoContrato';
import type { Contract } from '../../../../services/db';

const make = (modalidad: Contract['modalidad']): Contract =>
  ({ modalidad } as Contract);

describe('mapearTipoContrato', () => {
  test('habitual → larga', () => {
    expect(mapearTipoContrato(make('habitual'))).toBe('larga');
  });

  test('temporada → corta', () => {
    expect(mapearTipoContrato(make('temporada'))).toBe('corta');
  });

  test('vacacional → corta', () => {
    expect(mapearTipoContrato(make('vacacional'))).toBe('corta');
  });

  test('modalidad desconocida fallback a larga', () => {
    expect(mapearTipoContrato({ modalidad: 'otro' as Contract['modalidad'] } as Contract)).toBe('larga');
  });
});
