// Ningún gasto puede desaparecer de la lista · y la familia sale del CONCEPTO
// unificado (una sola fuente), no de la copia legacy `tipoFamilia`.
//
// Tras la unificación del catálogo, personal agrupa por las MISMAS familias que
// el resto de la app (`seguros`, `cuotas`… separadas), no por las viejas macro
// (`seguros_cuotas`). Lo que se conserva intacto es la garantía dura: agrupar
// reparte, nunca descarta.

import { groupByCatalog } from '../groupingHelpers';
import { catalogoTipoGasto } from '../catalogoTipoGasto';
import type { CompromisoRecurrente } from '../../../../../../types/compromisosRecurrentes';
import type { TipoGasto } from '../../../TipoGastoSelector/TipoGastoSelector.types';

// El catálogo real que recibe la lista: el unificado del ámbito personal.
const CATALOGO_PERSONAL = catalogoTipoGasto('personal');

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
  it('una familia que no está en el catálogo cae en «Sin clasificar», no al vacío', () => {
    // Catálogo recortado a una sola familia: un seguro no encaja en él.
    const soloSuministros = [{ id: 'suministros', label: 'Suministros' }] as unknown as TipoGasto[];
    const grupos = groupByCatalog([gasto({ tipo: 'seguro' })], soloSuministros, 'personal');

    const todos = grupos.flatMap((g) => g.compromisos.map((c) => c.id));
    expect(todos).toEqual([1]);
    expect(grupos.find((g) => g.familiaId === '__sin_familia__')?.familiaLabel).toBe('Sin clasificar');
  });

  it('un seguro personal va a la familia unificada «seguros»', () => {
    const grupos = groupByCatalog([gasto({ concepto: 'seguro_vida' })], CATALOGO_PERSONAL, 'personal');

    expect(grupos).toHaveLength(1);
    expect(grupos[0].familiaId).toBe('seguros');
  });

  it('sin `concepto` se infiere por tipo · un seguro va a «seguros»', () => {
    const grupos = groupByCatalog([gasto({ tipo: 'seguro' })], CATALOGO_PERSONAL, 'personal');

    expect(grupos[0].familiaId).toBe('seguros');
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
    const entrada = [
      gasto({ id: 1, concepto: 'seguro_vida' }),
      gasto({ id: 2, concepto: 'streaming' }),
      gasto({ id: 3, tipoFamilia: 'inventada' }), // no existe en ningún catálogo
      gasto({ id: 4, tipo: 'suministro' }),        // inferida
    ];

    const grupos = groupByCatalog(entrada, CATALOGO_PERSONAL, 'personal');
    const salida = grupos.flatMap((g) => g.compromisos.map((c) => c.id)).sort();

    expect(salida).toEqual([1, 2, 3, 4]);
  });

  it('los gastos sin id se ignoran · no pueden pintarse ni editarse', () => {
    const grupos = groupByCatalog(
      [gasto({ id: undefined, tipo: 'seguro' })],
      CATALOGO_PERSONAL,
      'personal',
    );

    expect(grupos).toHaveLength(0);
  });
});

describe('el concepto manda sobre tipoFamilia', () => {
  const base = (over: Record<string, unknown> = {}) =>
    ({
      id: 1,
      alias: 'Un gasto',
      tipo: 'otros',
      ambito: 'personal',
      categoria: 'personal',
      bolsaPresupuesto: 'deseos',
      responsable: 'titular',
      ...over,
    }) as never;

  it('agrupa por el concepto aunque tipoFamilia diga otra cosa', () => {
    const grupos = groupByCatalog(
      [base({ concepto: 'musica', tipoFamilia: 'seguros' })],
      CATALOGO_PERSONAL,
      'personal',
    );
    expect(grupos.map((g) => g.familiaId)).toEqual(['suscripciones']);
  });

  it('sin concepto reconocible, un `tipoFamilia` unificado válido se respeta', () => {
    const grupos = groupByCatalog([base({ tipoFamilia: 'suscripciones' })], CATALOGO_PERSONAL, 'personal');
    expect(grupos.map((g) => g.familiaId)).toEqual(['suscripciones']);
  });
});
