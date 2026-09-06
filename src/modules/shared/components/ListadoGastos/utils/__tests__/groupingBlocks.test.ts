import { blockForInmueble, groupByBlocksInmueble } from '../groupingHelpers';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';

const c = (over: Partial<CompromisoRecurrente>): CompromisoRecurrente =>
  ({
    id: 1,
    ambito: 'inmueble',
    inmuebleId: 1,
    alias: 'g',
    proveedor: { nombre: 'P' },
    patron: { tipo: 'mensualDiaFijo', dia: 1 },
    importe: { modo: 'fijo', importe: 10 },
    cuentaCargo: 0,
    conceptoBancario: 'P',
    metodoPago: 'domiciliacion',
    familia: 'otros',
    responsable: 'titular',
    fechaInicio: '2020-01-01',
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as unknown as CompromisoRecurrente;

describe('blockForInmueble · §3.1', () => {
  it('comunidad y tributos fusionan en un bloque', () => {
    expect(blockForInmueble(c({ familia: 'comunidad' })).id).toBe('comunidad_tributos');
    expect(blockForInmueble(c({ familia: 'impuestos_tasas', subtipo: 'ibi' })).id).toBe('comunidad_tributos');
  });
  it('gestión → administración', () => {
    expect(blockForInmueble(c({ familia: 'gestion', subtipo: 'gestoria' })).label).toBe('Administración');
  });
  it('los subtipos turísticos van a "propias de la modalidad" sea cual sea su familia', () => {
    // comisión de plataformas es familia gestion, pero es propia de la modalidad.
    expect(blockForInmueble(c({ familia: 'gestion', subtipo: 'comision_plataformas' })).id).toBe('modalidad');
    expect(blockForInmueble(c({ familia: 'limpieza', subtipo: 'por_estancia' })).id).toBe('modalidad');
    expect(blockForInmueble(c({ familia: 'impuestos_tasas', subtipo: 'licencia_turistica' })).id).toBe('modalidad');
  });
  it('la lavandería es de modalidad · el mobiliario no', () => {
    expect(blockForInmueble(c({ familia: 'limpieza', subtipo: 'lavanderia' })).id).toBe('modalidad');
    expect(blockForInmueble(c({ familia: 'mobiliario_enseres', subtipo: 'ropa_cama_enseres' })).id).toBe('otros');
  });

  it('limpieza de zonas comunes NO es de modalidad (es de larga duración)', () => {
    expect(blockForInmueble(c({ familia: 'limpieza', subtipo: 'zonas_comunes' })).id).toBe('otros');
  });

  it('la alarma no es un seguro · va a otros, no al bloque de seguros', () => {
    expect(blockForInmueble(c({ familia: 'seguros_alarmas', subtipo: 'alarma' })).id).toBe('otros');
    expect(blockForInmueble(c({ familia: 'seguros_alarmas', subtipo: 'hogar' })).id).toBe('seguros');
  });
});

describe('groupByBlocksInmueble · orden y no-vacíos', () => {
  it('respeta el orden del mockup y omite bloques vacíos', () => {
    const groups = groupByBlocksInmueble([
      c({ id: 1, familia: 'seguros_alarmas', subtipo: 'hogar' }),
      c({ id: 2, familia: 'comunidad' }),
      c({ id: 3, familia: 'gestion', subtipo: 'comision_plataformas' }),
    ]);
    expect(groups.map((g) => g.familiaId)).toEqual(['comunidad_tributos', 'seguros', 'modalidad']);
  });
});
