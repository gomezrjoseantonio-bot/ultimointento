// Ningún gasto puede desaparecer de la lista · y la familia es la del catálogo
// único (E2.4.1c), guardada en el compromiso; no se infiere de nada.
//
// Lo que se conserva intacto es la garantía dura: agrupar reparte, nunca descarta.

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
    familia: 'seguros_alarmas',
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
    const grupos = groupByCatalog([gasto({ familia: 'seguros_alarmas' })], soloSuministros, 'personal');

    const todos = grupos.flatMap((g) => g.compromisos.map((c) => c.id));
    expect(todos).toEqual([1]);
    expect(grupos.find((g) => g.familiaId === '__sin_familia__')?.familiaLabel).toBe('Sin clasificar');
  });

  it('un seguro personal va a la familia «seguros_alarmas» del catálogo', () => {
    const grupos = groupByCatalog([gasto({ familia: 'seguros_alarmas', subtipo: 'vida' })], CATALOGO_PERSONAL, 'personal');

    expect(grupos).toHaveLength(1);
    expect(grupos[0].familiaId).toBe('seguros_alarmas');
  });

  it('sin familia cae en «Sin clasificar» · no se adivina', () => {
    const grupos = groupByCatalog([gasto({ familia: undefined })], CATALOGO_PERSONAL, 'personal');

    expect(grupos).toHaveLength(1);
    expect(grupos[0].familiaId).toBe('__sin_familia__');
  });

  it('el grupo de recogida NO aparece cuando todo encaja', () => {
    const grupos = groupByCatalog(
      [gasto({ id: 1, familia: 'seguros_alarmas' }), gasto({ id: 2, familia: 'suministro' })],
      CATALOGO_PERSONAL,
      'personal',
    );

    expect(grupos.some((g) => g.familiaId === '__sin_familia__')).toBe(false);
  });

  it('cuente lo que cuente el catálogo, entran tantas filas como salen', () => {
    const entrada = [
      gasto({ id: 1 }),
      gasto({ id: 2 }),
      gasto({ id: 3, familia: 'una_que_no_existe' as never }), // no existe en ningún catálogo
      gasto({ id: 4, familia: 'suministro' }),
    ];

    const grupos = groupByCatalog(entrada, CATALOGO_PERSONAL, 'personal');
    const salida = grupos.flatMap((g) => g.compromisos.map((c) => c.id)).sort();

    expect(salida).toEqual([1, 2, 3, 4]);
  });

  it('los gastos sin id se ignoran · no pueden pintarse ni editarse', () => {
    const grupos = groupByCatalog(
      [gasto({ id: undefined, familia: 'seguros_alarmas' })],
      CATALOGO_PERSONAL,
      'personal',
    );

    expect(grupos).toHaveLength(0);
  });
});

describe('una familia que el ámbito no sugiere sigue viva', () => {
  it('un gasto personal clasificado con una familia «de inmueble» no se pierde', () => {
    // El ámbito no agrupa las familias (DEFINITIVO · principio 5): la lista lo
    // enseña en «Sin clasificar» para que se vea, en vez de tragárselo.
    const grupos = groupByCatalog([gasto({ familia: 'alquiler_renting' as never })], CATALOGO_PERSONAL, 'personal');
    expect(grupos.flatMap((g) => g.compromisos.map((c) => c.id))).toEqual([1]);
  });
});
