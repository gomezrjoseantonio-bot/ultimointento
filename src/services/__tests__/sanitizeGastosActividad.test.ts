import { sanitizeGastosActividad } from '../autonomoService';
import type { GastoRecurrenteActividad } from '../../types/personal';

// El wizard de autónomo colaba la cuota de SS (categoria/id 'ss') en el array de
// gastos de actividad y la re-guardaba en cada edición → duplicados sin fin con
// fecha día 5 que el usuario nunca puso. El saneado en lectura los descarta y
// deduplica por id para curar los datos ya existentes.
describe('sanitizeGastosActividad · cura la duplicación de la cuota de SS', () => {
  it('descarta entradas de cuota SS (categoria ss)', () => {
    const gastos = [
      { id: 'ss', descripcion: 'Cuota SS autónomo', importe: 300, categoria: 'ss' },
      { id: 'a', descripcion: 'Asesoría', importe: 60, categoria: 'asesoria' },
    ] as GastoRecurrenteActividad[];
    const out = sanitizeGastosActividad(gastos);
    expect(out).toHaveLength(1);
    expect(out[0].categoria).toBe('asesoria');
  });

  it('descarta muchas SS acumuladas (el caso real del usuario)', () => {
    const gastos: GastoRecurrenteActividad[] = [
      ...Array.from({ length: 40 }, () => ({
        id: 'ss', descripcion: 'Cuota SS autónomo', importe: 300, categoria: 'ss',
      })),
      { id: 'mat', descripcion: 'Material', importe: 50, categoria: 'material' },
    ] as GastoRecurrenteActividad[];
    const out = sanitizeGastosActividad(gastos);
    expect(out).toHaveLength(1);
    expect(out[0].descripcion).toBe('Material');
  });

  it('deduplica gastos reales repetidos por id', () => {
    const gastos = [
      { id: 'a', descripcion: 'Asesoría', importe: 60, categoria: 'asesoria' },
      { id: 'a', descripcion: 'Asesoría', importe: 60, categoria: 'asesoria' },
      { id: 'b', descripcion: 'Material', importe: 50, categoria: 'material' },
    ] as GastoRecurrenteActividad[];
    const out = sanitizeGastosActividad(gastos);
    expect(out.map(g => g.id)).toEqual(['a', 'b']);
  });

  it('conserva gastos legítimos sin tocarlos', () => {
    const gastos = [
      { id: 'x', descripcion: 'Software', importe: 20, categoria: 'otro' },
    ] as GastoRecurrenteActividad[];
    expect(sanitizeGastosActividad(gastos)).toEqual(gastos);
  });

  it('undefined / no-array → []', () => {
    expect(sanitizeGastosActividad(undefined)).toEqual([]);
  });
});
