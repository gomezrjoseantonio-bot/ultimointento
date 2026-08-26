// El lector fiscal y el motor tienen que decir lo mismo.
//
// `calcularPorcentajeReduccionContrato` tenía su propia copia de las reglas del
// art. 23.2, y no era la misma: no conocía «primera vez», así que daba el 90 %
// a un contrato en zona tensionada con rebaja aunque fuera el primer alquiler de
// la vivienda — cuando sin contrato anterior no hay renta que rebajar. El mismo
// contrato daba un número distinto según por dónde se preguntara.
//
// Aquí se comprueba que ya no: el lector delega en el motor y las dos respuestas
// coinciden en todas las ramas.

import { calcularPorcentajeReduccionContrato } from '../irpfCalculationService';
import { proponerReduccion, type CondicionesReduccion } from '../reduccionAlquiler';

/** Un contrato como el que llega del store, con sus condiciones fiscales. */
const contrato = (c: CondicionesReduccion & { reduccion?: unknown }): Record<string, unknown> => ({
  modalidad: c.regimen === 'turistico' ? 'turistico' : c.regimen,
  fechaFirmaContrato: c.fechaFirma,
  primeraVez: c.primeraVez,
  zonaTensionada: c.zonaTensionada,
  inquilinoJoven: c.joven18a35,
  rebajaRenta5pct: c.rebajaMas5,
  rehabilitacion: c.rehabilitada2a,
  reduccion: c.reduccion,
});

const RAMAS: Array<[string, CondicionesReduccion]> = [
  ['temporada', { regimen: 'temporada', fechaFirma: '2026-01-01' }],
  ['turístico', { regimen: 'turistico', fechaFirma: '2026-01-01' }],
  ['pre-ley', { regimen: 'habitual', fechaFirma: '2022-06-01' }],
  ['frontera · 25 may 2023', { regimen: 'habitual', fechaFirma: '2023-05-25' }],
  ['frontera · 26 may 2023', { regimen: 'habitual', fechaFirma: '2023-05-26' }],
  ['general', { regimen: 'habitual', fechaFirma: '2026-01-01' }],
  [
    'tensionada + rebaja + había anterior',
    { regimen: 'habitual', fechaFirma: '2026-01-01', zonaTensionada: true, primeraVez: false, rebajaMas5: true },
  ],
  [
    'tensionada + primera vez + joven',
    { regimen: 'habitual', fechaFirma: '2026-01-01', zonaTensionada: true, primeraVez: true, joven18a35: true },
  ],
  ['rehabilitación', { regimen: 'habitual', fechaFirma: '2026-01-01', rehabilitada2a: true }],
  [
    'tensionada + rebaja PERO primera vez',
    { regimen: 'habitual', fechaFirma: '2026-01-01', zonaTensionada: true, primeraVez: true, rebajaMas5: true },
  ],
];

describe('una sola verdad · el lector fiscal delega en el motor', () => {
  it.each(RAMAS)('%s', (_nombre, cond) => {
    expect(calcularPorcentajeReduccionContrato(contrato(cond))).toBe(
      proponerReduccion(cond).porcentaje,
    );
  });

  it('lo que el arrendador confirmó manda · no se recalcula por detrás', () => {
    // El % guardado con el contrato es el que se firmó y revisó. Recalcularlo al
    // leerlo convertiría un cambio de reglas en una declaración distinta a la
    // que el usuario aprobó.
    const conManual = contrato({
      regimen: 'habitual',
      fechaFirma: '2026-01-01',
      reduccion: { activa: true, porcentaje: 90, motivo: 'zona_tensionada_rebaja' },
    });
    expect(calcularPorcentajeReduccionContrato(conManual)).toBe(90);
  });

  it('una reducción guardada como inactiva no pisa el cálculo', () => {
    const inactiva = contrato({
      regimen: 'habitual',
      fechaFirma: '2026-01-01',
      reduccion: { activa: false, porcentaje: 90 },
    });
    expect(calcularPorcentajeReduccionContrato(inactiva)).toBe(50);
  });
});

describe('lo que el lector conserva de su forma vieja', () => {
  it('la fecha se busca en cascada · firma del contrato, firma digital, inicio', () => {
    const soloInicio = { modalidad: 'habitual', fechaInicio: '2022-03-01' };
    expect(calcularPorcentajeReduccionContrato(soloInicio)).toBe(60);

    const firmaDigital = { modalidad: 'habitual', firma: { fechaFirma: '2022-03-01' } };
    expect(calcularPorcentajeReduccionContrato(firmaDigital)).toBe(60);

    // La del contrato manda sobre las demás.
    const ambas = {
      modalidad: 'habitual',
      fechaFirmaContrato: '2026-01-01',
      fechaInicio: '2022-03-01',
    };
    expect(calcularPorcentajeReduccionContrato(ambas)).toBe(50);
  });

  it('`type` sirve de respaldo cuando no hay `modalidad`', () => {
    expect(calcularPorcentajeReduccionContrato({ type: 'habitual', fechaInicio: '2026-01-01' })).toBe(50);
  });

  it('`vacacional` se trata como turístico', () => {
    expect(calcularPorcentajeReduccionContrato({ modalidad: 'vacacional' })).toBe(0);
  });

  it('sin régimen reconocible no se presume reducción', () => {
    // Un contrato del que no sabemos si es de vivienda habitual no puede
    // reclamar la reducción de la vivienda habitual.
    expect(calcularPorcentajeReduccionContrato({ fechaInicio: '2026-01-01' })).toBe(0);
    expect(calcularPorcentajeReduccionContrato({ modalidad: 'lo_que_sea' })).toBe(0);
  });

  it('sin ninguna fecha se aplica el régimen VIGENTE, no el transitorio', () => {
    // Antes se asumía «pre-ley por seguridad» y salía un 60 %. Presumir que un
    // contrato del que no sabemos la fecha es anterior a 2023 es reclamar más
    // reducción de la que consta: lo prudente frente a Hacienda es lo vigente.
    expect(calcularPorcentajeReduccionContrato({ modalidad: 'habitual' })).toBe(50);
  });
});
