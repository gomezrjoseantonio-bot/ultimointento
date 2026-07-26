import { blockForInmueble, groupByBlocksInmueble } from '../groupingHelpers';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';

const c = (over: Partial<CompromisoRecurrente>): CompromisoRecurrente =>
  ({
    id: 1,
    ambito: 'inmueble',
    inmuebleId: 1,
    alias: 'g',
    tipo: 'otros',
    proveedor: { nombre: 'P' },
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 10 },
    cuentaCargo: 0,
    conceptoBancario: 'P',
    metodoPago: 'domiciliacion',
    categoria: 'inmueble.otros',
    bolsaPresupuesto: 'inmueble',
    responsable: 'titular',
    fechaInicio: '2020-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as unknown as CompromisoRecurrente;

describe('blockForInmueble · §3.1', () => {
  it('comunidad y tributos fusionan en un bloque', () => {
    expect(blockForInmueble(c({ tipo: 'comunidad', tipoFamilia: 'comunidad' })).id).toBe('comunidad_tributos');
    expect(blockForInmueble(c({ tipo: 'impuesto', tipoFamilia: 'tributos' })).id).toBe('comunidad_tributos');
  });
  it('gestión → administración', () => {
    expect(blockForInmueble(c({ tipoFamilia: 'gestion' })).label).toBe('Administración');
  });
  it('los subtipos turísticos van a "propias de la modalidad" sea cual sea su familia', () => {
    // comisión de plataformas es familia gestion, pero es propia de la modalidad.
    expect(blockForInmueble(c({ tipoFamilia: 'gestion', subtipo: 'comision_plataformas' })).id).toBe('modalidad');
    expect(blockForInmueble(c({ tipoFamilia: 'reparacion', subtipo: 'limpieza_por_estancia' })).id).toBe('modalidad');
    expect(blockForInmueble(c({ tipoFamilia: 'tributos', subtipo: 'licencia_turistica' })).id).toBe('modalidad');
  });
  it('limpieza de zonas comunes NO es de modalidad (es de larga duración)', () => {
    expect(blockForInmueble(c({ tipoFamilia: 'reparacion', subtipo: 'limpieza_zonas_comunes' })).id).toBe('otros');
  });
});

describe('groupByBlocksInmueble · orden y no-vacíos', () => {
  it('respeta el orden del mockup y omite bloques vacíos', () => {
    const groups = groupByBlocksInmueble([
      c({ id: 1, tipoFamilia: 'seguros' }),
      c({ id: 2, tipoFamilia: 'comunidad', tipo: 'comunidad' }),
      c({ id: 3, tipoFamilia: 'gestion', subtipo: 'comision_plataformas' }),
    ]);
    expect(groups.map((g) => g.familiaId)).toEqual(['comunidad_tributos', 'seguros', 'modalidad']);
  });
});
