// Los dos caminos del alta acaban en el mismo sitio.
//
// «Hay quien sube la FEIN, hay quien la mete a mano porque la lee del
// documento, y las dos cosas deben funcionar de la misma forma... no tiene
// sentido que no hagan lo mismo» *(Jose · 6 ago 2026)*.
//
// Había DOS hidratadores: el de edición llenaba treinta y tantos campos y el de
// la FEIN diez. El diferencial se leía del papel —`feinOcrService` lo extrae— y
// no llegaba al formulario, así que subías la FEIN de una variable, ATLAS leía
// el 1,750, y luego te pedía que escribieras 1,750.
//
// Ahora hay uno, y la FEIN pasa por él. Esto lo vigila.

import { __private__ } from '../PrestamoPageV2';
import { prestamoDesdeDraft } from '../../../../services/fein/prestamoDesdeDraft';
import type { Prestamo } from '../../../../types/prestamos';
import type { FeinLoanDraft } from '../../../../types/fein';

const { formDesdePrestamo, emptyFormState } = __private__;

/** La hipoteca de Unicaja de Jose, tal como la da su FEIN de 11/08/2023. */
const feinDeUnicaja = (): FeinLoanDraft => ({
  metadata: {
    sourceFileName: 'FEIN_2.pdf',
    pagesTotal: 0,
    pagesProcessed: 0,
    ocrProvider: 'claude',
    processedAt: '2026-08-06T00:00:00.000Z',
  },
  prestamo: {
    banco: 'Unicaja',
    capitalInicial: 85000,
    plazoMeses: 240,
    fechaFirmaPrevista: '2023-08-25',
    tipo: 'MIXTO',
    tinFijo: 2.6,
    tramoFijoMeses: 36,
    indiceReferencia: 'EURIBOR',
    // Los tres que el tipo viejo no sabía llevar y se perdían por el camino.
    valorIndiceActual: 4.149,
    baseCalculoIntereses: 'ACT/365',
    tasacion: 300,
    diferencial: 1.75,
    revisionMeses: 12,
  },
  bonificaciones: [
    { id: 'nomina', etiqueta: 'Bloque Haberes', descuentoPuntos: 0.5, criterio: 'Nómina ≥ 2.500 €' },
  ],
});

/** El mismo préstamo, tecleado a mano leyendo ese mismo papel. */
const aMano = (): Partial<Prestamo> =>
  ({
    nombre: 'Préstamo Unicaja',
    banco: 'Unicaja',
    valorIndiceActual: 4.149,
    baseCalculoIntereses: 'ACT/365',
    tasacion: 300,
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    diferencial: 1.75,
    periodoRevisionMeses: 12,
  }) as Partial<Prestamo>;

describe('subirla y teclearla dan lo mismo', () => {
  it('los campos del préstamo coinciden campo a campo', () => {
    const porFEIN = formDesdePrestamo(prestamoDesdeDraft(feinDeUnicaja()), emptyFormState());
    const porTeclado = formDesdePrestamo(aMano(), emptyFormState());

    for (const campo of [
      'alias',
      'banco',
      'euriborRaw',
      'baseCalculo',
      'capitalRaw',
      'plazoRaw',
      'fechaFirma',
      'tipoInteres',
      'tinTramoFijoRaw',
      'tramoFijoMesesRaw',
      'diferencialRaw',
      'revisionCadaMeses',
    ] as const) {
      expect([campo, porFEIN[campo]]).toEqual([campo, porTeclado[campo]]);
    }
  });
});

describe('lo que la FEIN trae, llega', () => {
  const form = () => formDesdePrestamo(prestamoDesdeDraft(feinDeUnicaja()), emptyFormState());

  // El caso que lo destapó: se leía y no aparecía.
  it('el diferencial', () => {
    expect(form().diferencialRaw).toBe('1,75');
  });

  it('el tramo fijo, en MESES · la FEIN los da en meses y el tipo viejo en años', () => {
    expect(form().tramoFijoMesesRaw).toBe('36');
  });

  it('y el TIN de un mixto va al campo del tramo fijo, no al del fijo', () => {
    expect(form().tinTramoFijoRaw).toBe('2,60');
    expect(form().tinFijoRaw).toBe('');
  });
});

describe('las bonificaciones de la FEIN', () => {
  const form = () => formDesdePrestamo(prestamoDesdeDraft(feinDeUnicaja()), emptyFormState());

  // La casilla guarda lo TECLEADO, no un número ya parseado: sin eso no se
  // puede escribir «0,25» —al teclear la coma el campo valdría cero y se
  // repintaría como «0,00»—, y ahora la rebaja se edita en pantalla.
  it('llegan con sus puntos, en PUNTOS', () => {
    expect(form().bonificaciones[0].ppRaw).toBe('0,50');
  });

  // La FEIN lista lo que el banco OFRECE · la de Unicaja tiene catorce bloques,
  // seguro agrario incluido. Cuáles contrataste es decisión tuya.
  it('entran sin marcar · marcarlas sería inventarse un contrato', () => {
    expect(form().bonificaciones.every((b) => !b.activa)).toBe(true);
  });

  // Pero el bloque se ABRE · con `some(activa)` el interruptor salía apagado y
  // las catorce quedaban escondidas detrás de un «0 activas».
  it('y aun así el bloque se ve', () => {
    expect(form().bonificacionesActivas).toBe(true);
  });

  it('y sustituyen al catálogo de ATLAS, no se mezclan con él', () => {
    expect(form().bonificaciones).toHaveLength(1);
    expect(form().bonificaciones[0].nombre).toBe('Bloque Haberes');
  });
});

// Una FEIN nunca viene entera: está normalizada en contenido, no en forma.
describe('lo que la FEIN no trae, no se pisa', () => {
  it('lo ya escrito a mano sobrevive a subir la FEIN', () => {
    const empezado = { ...emptyFormState(), diaCobroRaw: '25', numeroContrato: '0230066020' };

    const despues = formDesdePrestamo(prestamoDesdeDraft(feinDeUnicaja()), empezado);

    expect(despues.diaCobroRaw).toBe('25');
    expect(despues.numeroContrato).toBe('0230066020');
    // Y lo que sí trae, entra.
    expect(despues.capitalRaw).toBe('85.000,00');
  });

  // Una FEIN de la que no se saca nada existe · con mil maquetas distintas, es
  // el caso que hay que sobrevivir sin estropear el formulario.
  it('una FEIN de la que no se lee nada no toca nada', () => {
    const vacia: FeinLoanDraft = {
      metadata: feinDeUnicaja().metadata,
      prestamo: { tipo: null },
      bonificaciones: [],
    };
    const base = emptyFormState();

    expect(formDesdePrestamo(prestamoDesdeDraft(vacia), base)).toEqual(base);
  });
});

// Una hipoteca puede tener VARIOS inmuebles como garantía (caso Tenderina:
// un préstamo, dos pisos que responden). El formulario tiene que leer todos.
describe('garantía multi-inmueble', () => {
  it('recompone garantiaInmuebleIds de todas las garantías hipotecarias', () => {
    const prestamo = {
      garantias: [
        { tipo: 'HIPOTECARIA', inmuebleId: '2' },
        { tipo: 'HIPOTECARIA', inmuebleId: '3' },
      ],
    } as unknown as Prestamo;

    const form = formDesdePrestamo(prestamo, emptyFormState());
    expect(form.garantiaInmuebleIds).toEqual(['2', '3']);
    expect(form.garantiaTipo).toBe('hipotecaria');
  });

  it('un préstamo personal no deja inmuebles de garantía', () => {
    const prestamo = { garantias: [{ tipo: 'PERSONAL' }] } as unknown as Prestamo;
    const form = formDesdePrestamo(prestamo, emptyFormState());
    expect(form.garantiaInmuebleIds).toEqual([]);
  });
});
