// El motor ÚNICO del cuadro de amortización.
//
// Lo que vigila esto es que solo haya un cuadro. Había dos motores y el que
// acababas teniendo dependía de por qué puerta entrabas: el wizard calculaba el
// suyo y pisaba el que el servicio acababa de guardar, salvo si el préstamo era
// «pre-v2», o venía de una importación, o de la venta de un inmueble. Dos
// préstamos idénticos podían quedarse con cuadros distintos.
//
// El caso del Santander está calibrado contra la carta de verdad: capital
// 78.500 €, TIN 4,99 %, 96 cuotas, firma el 12/05/2026, primer cargo el
// 01/07/2026, cuota 993,43 €, carencia técnica de 20 días por 214,64 € y
// 17.083,96 € de intereses totales. Es lo que cuadra con el banco, así que es
// lo que no se puede mover.

import { generarCuadro, conservarPunteo, cuotaFrancesa } from '../cuadro';
import { prestamosCalculationService } from '../../prestamosCalculationService';
import type { Bonificacion, PlanPagos, Prestamo } from '../../../types/prestamos';

const prestamo = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'p1',
    nombre: 'Santander preconcedido',
    principalInicial: 78500,
    plazoMesesTotal: 96,
    fechaFirma: '2026-05-12',
    fechaPrimerCargo: '2026-07-01',
    diaCargoMes: 1,
    tipo: 'FIJO',
    tipoNominalAnualFijo: 4.99,
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

/** La carencia técnica tal como la guarda el alta · 20 días desde la firma. */
const CARENCIA_TECNICA = { dias: 20, fechaLiquidacion: '2026-06-01', intereses: 214.64 };

const bonif = (id: string, puntos: number, estado: Bonificacion['estado']): Bonificacion =>
  ({
    id,
    tipo: 'NOMINA',
    nombre: id,
    reduccionPuntosPorcentuales: puntos,
    impacto: { puntos: -puntos },
    aplicaEn: 'FIJO',
    lookbackMeses: 6,
    regla: { tipo: 'NOMINA', minimoMensual: 1200 },
    estado,
  }) as Bonificacion;

describe('el caso del Santander, al céntimo', () => {
  const cuadro = () => generarCuadro(prestamo({ carenciaTecnica: CARENCIA_TECNICA }));

  it('la cuota es 993,43 €', () => {
    expect(cuadro().resumen.cuotaMensual).toBeCloseTo(993.43, 2);
  });

  it('son 97 líneas · una de carencia y 96 cuotas', () => {
    expect(cuadro().resumen.numLineas).toBe(97);
    expect(cuadro().plan.periodos).toHaveLength(97);
  });

  // La carencia técnica es un cargo SEPARADO, no un suplemento de la primera
  // cuota. Es lo que hace el banco, y meterlo dentro subía una cuota que no
  // sube.
  it('la carencia técnica es su propia línea, sin capital', () => {
    const [linea0] = cuadro().plan.periodos;

    expect(linea0.periodo).toBe(0);
    expect(linea0.fechaCargo).toBe('2026-06-01');
    expect(linea0.cuota).toBeCloseTo(214.64, 2);
    expect(linea0.amortizacion).toBe(0);
  });

  it('la primera cuota es entera y llega el 1 de julio', () => {
    const cuota1 = cuadro().plan.periodos[1];

    expect(cuota1.periodo).toBe(1);
    expect(cuota1.fechaCargo).toBe('2026-07-01');
    expect(cuota1.cuota).toBeCloseTo(993.43, 2);
  });

  it('los intereses suman 17.083,96 €', () => {
    const { resumen } = cuadro();

    expect(resumen.totalIntereses).toBeCloseTo(17083.96, 1);
    expect(resumen.interesesCuadro).toBeCloseTo(16869.32, 1);
    expect(resumen.interesesCarenciaTecnica).toBeCloseTo(214.64, 2);
  });

  // Un cuadro que termina debiendo cuatro céntimos no es un cuadro.
  it('la última cuota deja el capital en cero', () => {
    const ultima = cuadro().plan.periodos[96];

    expect(ultima.fechaCargo).toBe('2034-06-01');
    expect(ultima.principalFinal).toBe(0);
  });
});

// El motor es UNO. Si el servicio de cálculo devolviera otra cosa, volveríamos
// a tener dos cuadros para el mismo préstamo.
describe('una sola puerta', () => {
  it('el servicio de cálculo devuelve exactamente este cuadro', () => {
    const p = prestamo({ carenciaTecnica: CARENCIA_TECNICA });
    const delServicio = prestamosCalculationService.generatePaymentSchedule(p);

    expect(delServicio.periodos).toEqual(generarCuadro(p).plan.periodos);
  });

  it('la cuota francesa también sale del mismo sitio', () => {
    expect(prestamosCalculationService.calculateFrenchPayment(78500, 4.99, 96))
      .toBe(cuotaFrancesa(78500, 4.99, 96));
  });
});

// El motor legacy resolvía el tipo con `new Date()`, así que el mismo préstamo
// daba un cuadro distinto según el día en que lo generaras — y un mixto pasaba
// del tipo fijo al variable a mitad de vida sin que nadie tocara nada.
describe('no mira el reloj', () => {
  it('el mismo préstamo da el mismo cuadro', () => {
    const p = prestamo({ carenciaTecnica: CARENCIA_TECNICA });

    expect(generarCuadro(p).plan.periodos).toEqual(generarCuadro(p).plan.periodos);
  });

  it('un mixto con el tramo fijo ya vencido sigue al tipo de su tramo fijo', () => {
    const p = prestamo({
      tipo: 'MIXTO',
      tipoNominalAnualFijo: undefined,
      tipoNominalAnualMixtoFijo: 2.5,
      tramoFijoMeses: 36,
      valorIndiceActual: 3,
      diferencial: 1,
      fechaFirma: '2010-05-12',
      fechaPrimerCargo: '2010-07-01',
    });

    expect(generarCuadro(p).resumen.tinEfectivo).toBe(2.5);
  });
});

describe('el tipo que se paga', () => {
  it('las bonificaciones aplicadas rebajan el tipo', () => {
    const p = prestamo({ bonificaciones: [bonif('nomina', 0.5, 'SELECCIONADO')] });

    expect(generarCuadro(p).resumen.tinEfectivo).toBeCloseTo(4.49, 4);
  });

  // La vista previa del wizard sumaba los puntos por su cuenta y SIN tope, así
  // que podía enseñar una cuota más baja de la que después se guardaba.
  it('el tope del préstamo acota la rebaja', () => {
    const p = prestamo({
      bonificaciones: [
        bonif('nomina', 0.5, 'SELECCIONADO'),
        bonif('seguro', 0.5, 'SELECCIONADO'),
      ],
      topeBonificacionesTotal: -0.6,
    });

    expect(generarCuadro(p).resumen.tinEfectivo).toBeCloseTo(4.39, 4);
  });

  it('una que el banco ya retiró no rebaja nada', () => {
    const p = prestamo({ bonificaciones: [bonif('nomina', 0.5, 'PERDIDA')] });

    expect(generarCuadro(p).resumen.tinEfectivo).toBe(4.99);
  });
});

describe('la carencia técnica', () => {
  // Deducirla al vuelo se la inventaría en los préstamos antiguos, que se
  // dieron de alta sin ella y llevan años con su cuadro cuadrado.
  it('sin ella guardada, no hay línea 0', () => {
    const { plan, resumen } = generarCuadro(prestamo());

    expect(plan.periodos).toHaveLength(96);
    expect(plan.periodos[0].periodo).toBe(1);
    expect(resumen.interesesCarenciaTecnica).toBe(0);
  });

  // El wizard guardaba `esquemaPrimerRecibo: 'PRORRATA'` justamente cuando
  // había carencia técnica, porque su cuadro pisaba después al del otro motor y
  // ese campo daba igual. Con un solo motor ya no da igual, y esos préstamos
  // están guardados así: prorratear además cobraría los mismos días dos veces.
  it('con ella, la primera cuota es entera aunque el préstamo diga PRORRATA', () => {
    const p = prestamo({
      carenciaTecnica: CARENCIA_TECNICA,
      esquemaPrimerRecibo: 'PRORRATA',
    });
    const cuota1 = generarCuadro(p).plan.periodos[1];

    expect(cuota1.cuota).toBeCloseTo(993.43, 2);
    expect(cuota1.esProrrateado).toBe(false);
  });
});

// Una firma el 31 no puede correr los cargos siguientes: si «+1 mes» se
// desborda al 3 de marzo, todos los cargos posteriores llegan tarde.
describe('el día de cargo en los meses cortos', () => {
  const p = prestamo({
    fechaFirma: '2026-01-31',
    fechaPrimerCargo: '2026-01-31',
    diaCargoMes: 31,
    plazoMesesTotal: 4,
  });

  it('febrero se recorta al último día', () => {
    expect(generarCuadro(p).plan.periodos[1].fechaCargo).toBe('2026-02-28');
  });

  it('y marzo vuelve al 31 · la serie no se queda recortada', () => {
    expect(generarCuadro(p).plan.periodos[2].fechaCargo).toBe('2026-03-31');
  });

  // El día objetivo es el PACTADO, no el del primer cargo. Firmando el 15 sin
  // fecha de primer cargo dicha, la primera cita se deduce y ya nace recortada
  // al 28 de febrero: leer de ahí el día clavaba la serie entera en el 28.
  it('la primera cita recortada no arrastra a las siguientes', () => {
    const q = prestamo({
      fechaFirma: '2026-01-15',
      fechaPrimerCargo: undefined,
      diaCargoMes: 31,
      plazoMesesTotal: 3,
    });

    expect(generarCuadro(q).plan.periodos.map((x) => x.fechaCargo))
      .toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });
});

describe('lo que no se puede calcular', () => {
  it('un plazo de cero no revienta', () => {
    expect(generarCuadro(prestamo({ plazoMesesTotal: 0 })).plan.periodos).toEqual([]);
  });

  it('sin capital, la cuota es cero', () => {
    expect(generarCuadro(prestamo({ principalInicial: 0 })).resumen.cuotaMensual).toBe(0);
  });

  // Un dato mal tecleado o una importación torcida podían pedir tantos meses de
  // solo intereses como plazo. Ese cuadro no devuelve el capital NUNCA: termina
  // debiendo lo mismo que el primer día, y de él salen las previsiones de
  // tesorería y los intereses del ejercicio.
  it('una carencia tan larga como el plazo deja igualmente una cuota que amortiza', () => {
    const p = prestamo({ plazoMesesTotal: 12, mesesSoloIntereses: 12 });
    const { periodos } = generarCuadro(p).plan;

    expect(periodos[periodos.length - 1].principalFinal).toBe(0);
    expect(periodos.filter((x) => x.esSoloIntereses)).toHaveLength(11);
  });

  it('y una más larga todavía, tampoco', () => {
    const p = prestamo({ plazoMesesTotal: 12, mesesSoloIntereses: 99 });
    const { periodos } = generarCuadro(p).plan;

    expect(periodos[periodos.length - 1].principalFinal).toBe(0);
  });
});

// Regenerar un cuadro no puede borrar lo que ya se cuadró contra el banco: el
// enlace al movimiento es trabajo del usuario, no un dato calculado. Esto vivía
// dentro del wizard, así que cualquier otra puerta lo perdía entero.
describe('el punteo sobrevive a regenerar', () => {
  const nuevo = (): PlanPagos => generarCuadro(prestamo()).plan;

  const anterior = (over: Partial<PlanPagos['periodos'][number]> = {}): PlanPagos => ({
    ...nuevo(),
    periodos: [
      {
        ...nuevo().periodos[0],
        pagado: true,
        fechaPagoReal: '2026-07-03',
        movimientoTesoreriaId: 'mov-1',
        ...over,
      },
    ],
  });

  it('el enlace al movimiento se conserva por fecha de cargo', () => {
    const r = conservarPunteo(nuevo(), anterior());

    expect(r.periodos[0].movimientoTesoreriaId).toBe('mov-1');
    expect(r.periodos[0].fechaPagoReal).toBe('2026-07-03');
  });

  // Si el calendario se mueve, la cuota sigue siendo la misma cuota.
  it('y por número de periodo si la fecha se ha movido', () => {
    const r = conservarPunteo(nuevo(), anterior({ fechaCargo: '2026-07-15' }));

    expect(r.periodos[0].movimientoTesoreriaId).toBe('mov-1');
  });

  it('lo que no tenía pareja nace sin puntear', () => {
    const r = conservarPunteo(nuevo(), anterior());

    expect(r.periodos[50].movimientoTesoreriaId).toBeUndefined();
  });

  it('sin cuadro anterior no se inventa ninguno', () => {
    const r = conservarPunteo(nuevo(), null);

    expect(r.periodos.every((p) => p.movimientoTesoreriaId === undefined)).toBe(true);
  });

  // Una cuota cuya fecha ya pasó se da por pagada · es lo que hacían el alta y
  // la edición antes de que esto existiera.
  it('una cuota vencida se da por pagada', () => {
    const viejo = generarCuadro(
      prestamo({ fechaFirma: '2010-05-12', fechaPrimerCargo: '2010-07-01' })
    ).plan;

    expect(conservarPunteo(viejo, null).periodos[0].pagado).toBe(true);
  });
});
