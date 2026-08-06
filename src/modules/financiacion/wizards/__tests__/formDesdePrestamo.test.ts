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
import type { Prestamo } from '../../../../types/prestamos';
import type { PrestamoFinanciacion } from '../../../../types/financiacion';

const { formDesdePrestamo, prestamoDesdeFEIN, emptyFormState } = __private__;

/** La hipoteca de Unicaja de Jose, tal como la da su FEIN de 11/08/2023. */
const feinDeUnicaja = (): Partial<PrestamoFinanciacion> => ({
  alias: 'Hipoteca Unicaja',
  capitalInicial: 85000,
  plazoTotal: 240,
  plazoPeriodo: 'MESES',
  fechaFirma: '2023-08-25',
  tipo: 'MIXTO',
  tinTramoFijo: 2.6,
  tramoFijoAnos: 3,
  indice: 'EURIBOR',
  diferencial: 1.75,
  revision: 12,
  bonificaciones: [
    {
      id: 'nomina',
      tipo: 'NOMINA',
      nombre: 'Bloque Haberes',
      condicionParametrizable: 'Nómina ≥ 2.500 €',
      descuentoTIN: 0.5,
      impacto: { puntos: 0.5 },
      ventanaEvaluacion: 12,
      fuenteVerificacion: 'TESORERIA',
      estadoInicial: 'NO_CUMPLE',
      seleccionado: false,
      graciaMeses: 0,
      activa: true,
    },
  ],
});

/** El mismo préstamo, tecleado a mano leyendo ese mismo papel. */
const aMano = (): Partial<Prestamo> =>
  ({
    nombre: 'Hipoteca Unicaja',
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
    const porFEIN = formDesdePrestamo(prestamoDesdeFEIN(feinDeUnicaja()), emptyFormState());
    const porTeclado = formDesdePrestamo(aMano(), emptyFormState());

    for (const campo of [
      'alias',
      'capitalRaw',
      'plazoRaw',
      'fechaFirma',
      'tipoInteres',
      'tinTramoFijoRaw',
      'tramoFijoMesesRaw',
      'diferencialRaw',
      'revisionPeriodo',
    ] as const) {
      expect([campo, porFEIN[campo]]).toEqual([campo, porTeclado[campo]]);
    }
  });
});

describe('lo que la FEIN trae, llega', () => {
  const form = () => formDesdePrestamo(prestamoDesdeFEIN(feinDeUnicaja()), emptyFormState());

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
  const form = () => formDesdePrestamo(prestamoDesdeFEIN(feinDeUnicaja()), emptyFormState());

  it('llegan con sus puntos, en PUNTOS', () => {
    expect(form().bonificaciones[0].ppDescuento).toBe(0.5);
  });

  // La FEIN lista lo que el banco OFRECE · la de Unicaja tiene catorce bloques,
  // seguro agrario incluido. Cuáles contrataste es decisión tuya.
  it('entran sin marcar · marcarlas sería inventarse un contrato', () => {
    expect(form().bonificaciones.every((b) => !b.activa)).toBe(true);
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

    const despues = formDesdePrestamo(prestamoDesdeFEIN(feinDeUnicaja()), empezado);

    expect(despues.diaCobroRaw).toBe('25');
    expect(despues.numeroContrato).toBe('0230066020');
    // Y lo que sí trae, entra.
    expect(despues.capitalRaw).toBe('85.000,00');
  });

  it('una FEIN vacía no toca nada', () => {
    const base = emptyFormState();
    expect(formDesdePrestamo(prestamoDesdeFEIN({}), base)).toEqual(base);
  });
});
