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
  it('el desdoble de ropa/lavandería sigue cayendo en modalidad · V6 · D3', () => {
    // `ropa_cama_lavanderia` se partió en `lavanderia` (servicio) y
    // `ropa_enseres` (bien duradero). El subtipo SÍ se persiste, así que sin
    // añadir los dos nuevos aquí los gastos nuevos se habrían agrupado en el
    // bloque equivocado, en silencio.
    expect(blockForInmueble(c({ tipoFamilia: 'servicios', subtipo: 'lavanderia' })).id).toBe('modalidad');
    expect(blockForInmueble(c({ tipoFamilia: 'mobiliario', subtipo: 'ropa_enseres' })).id).toBe('modalidad');
    // Y el id antiguo se conserva: los compromisos ya guardados lo usan.
    expect(blockForInmueble(c({ tipoFamilia: 'reparacion', subtipo: 'ropa_cama_lavanderia' })).id).toBe('modalidad');
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
