// Leer la FEIN con Claude · VOCABULARIO §6 bis · quinquies.
//
// Lo que se prueba aquí es la TRADUCCIÓN, no la lectura: qué hace ATLAS con lo
// que el modelo devuelve. La lectura solo se puede medir contra documentos
// reales y con la clave puesta.
//
// Los dos casos de abajo son las respuestas que deben salir de las dos FEIN de
// Jose, con las cifras tal como están impresas en cada papel. Son de bancos
// distintos a propósito: es justo lo que el camino anterior no soportaba.

import { draftDesdeLeida, idDeBonificacion } from '../leerFeinConClaude';
import { FeinToPrestamoMapper } from '../feinToPrestamoMapper';
import type { FeinLeida } from '../leerFeinConClaude';

/** Unicaja · FEIN de 11/08/2023, mixta a 240 meses. */
const unicaja: FeinLeida = {
  banco: 'Unicaja',
  capitalInicial: 85000,
  plazoMeses: 240,
  tipo: 'MIXTO',
  tinFijo: 2.6,
  tramoFijoMeses: 36,
  indiceReferencia: 'EURIBOR',
  valorIndiceActual: 4.149,
  diferencial: 1.75,
  revisionMeses: 12,
  baseCalculoIntereses: 'ACT/365',
  comisionAperturaPct: 0,
  taeSinBonificaciones: 5.079,
  taeConBonificaciones: 5.593,
  topeBonificacionPuntos: 1,
  bonificaciones: [
    { etiqueta: 'Bloque Haberes', puntos: 0.5, criterio: 'Nómina ≥ 2.500 € netos' },
    { etiqueta: 'Bloque Seguro Vida Riesgo Prima Anual', puntos: 0.4 },
    { etiqueta: 'Bloque Seguro Hogar', puntos: 0.2 },
    { etiqueta: 'Bloque Seguro Agrario', puntos: 0.1 },
  ],
  notas: 'No aparece el día de cargo; lo dice la escritura, no la FEIN.',
};

/** Santander · FEIN de 27/07/2021, fija a 360 meses. */
const santander: FeinLeida = {
  banco: 'Banco Santander',
  capitalInicial: 73800,
  plazoMeses: 360,
  tipo: 'FIJO',
  tinFijo: 1.85,
  baseCalculoIntereses: 'ACT/365',
  comisionAperturaPct: 0,
  tasacion: 278.3,
  taeSinBonificaciones: 1.99,
  cuotaEstimada: 232.32,
  importeTotalAReembolsar: 97905.83,
  bonificaciones: [],
};

describe('lo leído llega al borrador', () => {
  const draft = () => draftDesdeLeida(unicaja, 'FEIN_2.pdf');

  it('con lo que el camino anterior no sacaba de ninguna manera', () => {
    const p = draft().prestamo;

    expect(p.tipo).toBe('MIXTO');
    expect(p.tramoFijoMeses).toBe(36);
    expect(p.baseCalculoIntereses).toBe('ACT/365');
    expect(p.valorIndiceActual).toBe(4.149);
    expect(p.diferencial).toBe(1.75);
  });

  // Lo medido sobre el papel de verdad: la vía anterior daba dos «nómina» de
  // 0,1 puntos donde hay catorce bloques y el de haberes vale 0,5.
  it('las bonificaciones, todas y con sus puntos', () => {
    const b = draft().bonificaciones!;

    expect(b).toHaveLength(4);
    expect(b[0]).toMatchObject({ id: 'nomina', descuentoPuntos: 0.5 });
    expect(b[1].id).toBe('vida');
    expect(b[2].id).toBe('hogar');
    // Un bloque que ATLAS no sabe clasificar se queda en «otros» con su nombre
    // — es más honesto que meterlo a la fuerza en una categoría que no es.
    expect(b[3]).toMatchObject({ id: 'otros', etiqueta: 'Bloque Seguro Agrario' });
  });

  it('y la tasación, que es la que entra en la TAE', () => {
    expect(draftDesdeLeida(santander, 'FEIN.pdf').prestamo.tasacion).toBe(278.3);
  });
});

// Un cero en una FEIN es una afirmación: «exenta de comisión de apertura».
describe('un cero se lee, un hueco no', () => {
  it('la apertura a 0 llega como 0', () => {
    expect(draftDesdeLeida(unicaja, 'f.pdf').prestamo.comisionAperturaPct).toBe(0);
  });

  it('y lo que el modelo no encontró llega como ausente, no como cero', () => {
    const p = draftDesdeLeida(santander, 'f.pdf').prestamo;

    expect(p.diferencial).toBeNull();
    expect(p.tramoFijoMeses).toBeNull();
  });
});

// El banco imprime su TAE y su total para que puedas cuadrarlos. Un cuadro que
// no reproduce la TAE de la propia FEIN es un cuadro que está mal.
describe('los números con los que el banco se deja comprobar', () => {
  it('se guardan como aviso en vez de tirarse', () => {
    const avisos = draftDesdeLeida(santander, 'f.pdf').metadata.warnings!.join(' ');

    expect(avisos).toContain('1.99');
    expect(avisos).toContain('97905.83');
  });

  it('y lo que el modelo diga que no encontró viaja con ellos', () => {
    expect(draftDesdeLeida(unicaja, 'f.pdf').metadata.warnings![0]).toContain('día de cargo');
  });
});

describe('de dónde sale el nombre de cada bonificación', () => {
  it.each([
    ['Bloque Haberes', 'nomina'],
    ['Domiciliación de nómina', 'nomina'],
    ['Seguro multirriesgo hogar', 'hogar'],
    ['Bloque Seguro Vida Riesgo Prima Única 8 años', 'vida'],
    ['Aportación a Planes de Pensiones', 'pensiones'],
    ['Uso de tarjeta de crédito', 'tarjeta'],
    ['Tres recibos domiciliados', 'recibos'],
    ['Seguro de comercio', 'otros'],
  ])('«%s» → %s', (etiqueta, esperado) => {
    expect(idDeBonificacion(etiqueta)).toBe(esperado);
  });
});

// El borrador solo vale si llega entero al formulario · el camino de abajo ya
// lo montamos, esto vigila que la pieza nueva encaje con él.
describe('y de ahí al formulario, sin perder nada', () => {
  it('el tramo fijo sobrevive al tipo viejo, que lo guarda en años', () => {
    const m = FeinToPrestamoMapper.mapToPrestamoFinanciacion(draftDesdeLeida(unicaja, 'f.pdf'));

    expect(m.tramoFijoAnos).toBe(3);
    expect(m.tinTramoFijo).toBe(2.6);
    expect(m.diferencial).toBe(1.75);
    expect(m.bonificaciones![0].impacto.puntos).toBe(0.5);
  });
});
