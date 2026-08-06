// Ningún gasto puede desaparecer de la lista.
//
// El caso real que destapó esto: un seguro de vida dado de alta desde la
// pestaña de un inmueble nace con la familia del catálogo de INMUEBLES
// (`seguros`) y, si el usuario dice que no va con la hipoteca, se guarda en
// PERSONAL. El catálogo personal no tiene `seguros` —tiene `seguros_cuotas`—,
// así que la fila no encajaba en ningún grupo y `groupByCatalog` la tiraba.
//
// El gasto seguía vivo y emitiendo previsiones en Tesorería, pero no había
// ninguna pantalla donde verlo, editarlo ni borrarlo.

import { groupByCatalog } from '../groupingHelpers';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';
import type { TipoGasto } from '../../../TipoGastoSelector/TipoGastoSelector.types';

const CATALOGO_PERSONAL = [
  { id: 'vivienda', label: 'Vivienda' },
  { id: 'suministros', label: 'Suministros' },
  { id: 'seguros_cuotas', label: 'Seguros y cuotas' },
  { id: 'otros', label: 'Otros' },
] as unknown as TipoGasto[];

const gasto = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    id: 1,
    ambito: 'personal',
    personalDataId: 1,
    alias: 'Vida',
    tipo: 'seguro',
    proveedor: { nombre: 'ING' },
    patron: { tipo: 'mensualDiaFijo', dia: 15 },
    importe: { modo: 'fijo', importe: 39.86 },
    cuentaCargo: 6,
    estado: 'activo',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as CompromisoRecurrente;

describe('groupByCatalog · no se pierde ninguna fila', () => {
  it('la familia de OTRO catálogo cae en «Sin clasificar», no al vacío', () => {
    // `tipoFamilia:'seguros'` es del catálogo de inmuebles · en personal no existe.
    const grupos = groupByCatalog([gasto({ tipoFamilia: 'seguros' })], CATALOGO_PERSONAL, 'personal');

    const todos = grupos.flatMap((g) => g.compromisos.map((c) => c.id));
    expect(todos).toEqual([1]);
    expect(grupos.find((g) => g.familiaId === '__sin_familia__')?.familiaLabel).toBe('Sin clasificar');
  });

  it('una familia que SÍ existe sigue yendo a su grupo de siempre', () => {
    const grupos = groupByCatalog(
      [gasto({ tipoFamilia: 'seguros_cuotas' })],
      CATALOGO_PERSONAL,
      'personal',
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0].familiaId).toBe('seguros_cuotas');
  });

  it('sin `tipoFamilia` se infiere por tipo · un seguro va a seguros_cuotas', () => {
    const grupos = groupByCatalog([gasto({ tipo: 'seguro' })], CATALOGO_PERSONAL, 'personal');

    expect(grupos[0].familiaId).toBe('seguros_cuotas');
    expect(grupos.some((g) => g.familiaId === '__sin_familia__')).toBe(false);
  });

  it('el grupo de recogida NO aparece cuando todo encaja', () => {
    const grupos = groupByCatalog(
      [gasto({ id: 1, tipo: 'seguro' }), gasto({ id: 2, tipo: 'suministro' })],
      CATALOGO_PERSONAL,
      'personal',
    );

    expect(grupos.some((g) => g.familiaId === '__sin_familia__')).toBe(false);
  });

  it('cuente lo que cuente el catálogo, entran tantas filas como salen', () => {
    // La garantía dura: agrupar reparte, nunca descarta.
    const entrada = [
      gasto({ id: 1, tipoFamilia: 'seguros' }),        // de otro catálogo
      gasto({ id: 2, tipoFamilia: 'seguros_cuotas' }), // del suyo
      gasto({ id: 3, tipoFamilia: 'inventada' }),      // no existe en ninguno
      gasto({ id: 4, tipo: 'suministro' }),            // inferida
    ];

    const grupos = groupByCatalog(entrada, CATALOGO_PERSONAL, 'personal');
    const salida = grupos.flatMap((g) => g.compromisos.map((c) => c.id)).sort();

    expect(salida).toEqual([1, 2, 3, 4]);
  });

  it('los gastos sin id se ignoran · no pueden pintarse ni editarse', () => {
    const grupos = groupByCatalog(
      [gasto({ id: undefined, tipoFamilia: 'seguros' })],
      CATALOGO_PERSONAL,
      'personal',
    );

    expect(grupos).toHaveLength(0);
  });
});
