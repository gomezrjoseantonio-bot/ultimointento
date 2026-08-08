// Las lecturas por fecha · lo que la UI de Financiación pregunta al cuadro.
//
// Lo que vigilan estos casos es que la pantalla lea del motor y no rehaga
// cuentas: la cuota de una fecha es la que dice el cuadro, el capital vivo sale
// del propio periodo y el mixto de Unicaja tiene que ENSEÑAR su salto a
// Euríbor en agosto de 2026 en vez de quedarse congelado en el 2,600 %.

import { generarCuadro } from '../cuadro';
import {
  cuadroDe,
  cuotasDelAnio,
  escaleraDeLiberacion,
  getCapitalVivo,
  getCuota,
  getDesgloseCuota,
  getFechaVencimiento,
  getInteresDeducible,
  getInteresDelAnio,
  getPctAmortizado,
  getProximaRevision,
  getTinVigente,
  periodoEn,
} from '../lecturas';
import type { Prestamo } from '../../../types/prestamos';

/** La mixta de Unicaja · 36 meses al 2,600 % y después Euríbor + 1,750. */
const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'unicaja',
    nombre: 'Hipoteca Unicaja',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    valorIndiceActual: 2.1,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

/** Un personal a tipo fijo · cuota constante y sin revisiones. */
const personal = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'personal',
    nombre: 'Santander 17.675',
    principalInicial: 17675,
    plazoMesesTotal: 60,
    fechaFirma: '2025-01-15',
    fechaPrimerCargo: '2025-02-15',
    diaCargoMes: 15,
    tipo: 'FIJO',
    tipoNominalAnualFijo: 4,
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

describe('lecturas · la cuota sale del cuadro, no de una fórmula rehecha', () => {
  it('devuelve la cuota del periodo que contiene la fecha', () => {
    const cuadro = generarCuadro(personal());
    const periodo = periodoEn(cuadro, '2026-03-01');

    expect(periodo).not.toBeNull();
    expect(getCuota(cuadro, '2026-03-01')).toBe(periodo!.cuota);
  });

  it('la cuota NO cambia porque se marquen recibos como pagados', () => {
    // Este era el bug de `helpers.ts`: rehacía la francesa sobre `principalVivo`
    // y las cuotas bailaban en cada recarga.
    const p = personal();
    const antes = getCuota(generarCuadro(p), '2026-03-01');
    const conRecibosPagados = generarCuadro({
      ...p,
      cuotasPagadas: 14,
      principalVivo: 13500,
    } as Prestamo);

    expect(getCuota(conRecibosPagados, '2026-03-01')).toBe(antes);
  });

  it('el capital vivo es el saldo al INICIO del periodo', () => {
    const cuadro = generarCuadro(personal());
    const periodo = periodoEn(cuadro, '2026-03-01')!;

    expect(getCapitalVivo(cuadro, '2026-03-01')).toBeCloseTo(
      periodo.principalFinal + periodo.amortizacion,
      2,
    );
  });

  it('el desglose interés + capital suma la cuota', () => {
    const cuadro = generarCuadro(personal());
    const { interes, capital } = getDesgloseCuota(cuadro, '2026-03-01');

    expect(interes + capital).toBeCloseTo(getCuota(cuadro, '2026-03-01'), 2);
  });

  it('un préstamo ya vencido no suma ni cuota ni capital', () => {
    const cuadro = generarCuadro(personal());

    expect(getCuota(cuadro, '2099-01-01')).toBe(0);
    expect(getCapitalVivo(cuadro, '2099-01-01')).toBe(0);
  });

  it('el vencimiento es la fecha de la última cuota del cuadro', () => {
    const cuadro = generarCuadro(personal());
    const periodos = cuadro.plan.periodos;

    expect(getFechaVencimiento(cuadro)).toBe(periodos[periodos.length - 1].fechaCargo);
    expect(getFechaVencimiento(cuadro)!.slice(0, 4)).toBe('2030');
  });

  it('el amortizado va de 0 a 100 y crece con el tiempo', () => {
    const cuadro = generarCuadro(personal());

    expect(getPctAmortizado(cuadro, '2025-02-20')).toBeLessThan(5);
    expect(getPctAmortizado(cuadro, '2029-12-01')).toBeGreaterThan(90);
    expect(getPctAmortizado(cuadro, '2099-01-01')).toBe(100);
  });
});

describe('lecturas · el mixto no se queda congelado en su tramo fijo', () => {
  it('el TIN vigente pasa del fijo al índice + diferencial al acabar el tramo', () => {
    const p = unicaja();

    expect(getTinVigente(p, '2026-01-01')).toBeCloseTo(2.6, 3);
    // 36 meses desde 2023-08-25 · desde 2026-08-25 manda Euríbor + diferencial.
    expect(getTinVigente(p, '2026-09-01')).toBeCloseTo(2.1 + 1.75, 3);
  });

  it('avisa de la revisión que mueve la cuota dentro de la ventana', () => {
    const p = unicaja();
    const cuadro = generarCuadro(p);
    const revision = getProximaRevision(p, cuadro, '2026-07-01', 90);

    expect(revision).not.toBeNull();
    expect(revision!.fecha.slice(0, 7)).toBe('2026-09');
    expect(revision!.cuotaDespues).toBeGreaterThan(revision!.cuotaAntes);
    expect(revision!.tinDespues).toBeGreaterThan(revision!.tinAntes);
  });

  it('no avisa cuando la revisión queda fuera de la ventana', () => {
    const p = unicaja();

    expect(getProximaRevision(p, generarCuadro(p), '2025-01-01', 90)).toBeNull();
  });

  it('un fijo simple no tiene ninguna revisión que anunciar', () => {
    const p = personal();

    expect(getProximaRevision(p, generarCuadro(p), '2026-03-01', 90)).toBeNull();
  });

  it('la última cuota no se anuncia como revisión aunque sea distinta', () => {
    // La última se lleva el resto del capital, así que casi nunca coincide con
    // el resto. Anunciarla sería un aviso falso en todos los préstamos.
    const p = personal();

    expect(getProximaRevision(p, generarCuadro(p), '2029-12-01', 120)).toBeNull();
  });
});

describe('escaleraDeLiberacion · la cuota del hogar bajando hacia cero', () => {
  const cuadros = [{ cuadro: generarCuadro(unicaja()) }, { cuadro: generarCuadro(personal()) }];

  it('arranca en la suma de las cuotas vivas de este mes', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2026-03-10');
    const esperado =
      getCuota(cuadros[0].cuadro, '2026-03-10') + getCuota(cuadros[1].cuadro, '2026-03-10');

    expect(escalera.totalHoy).toBeCloseTo(esperado, 2);
  });

  it('pone un peldaño por cada vencimiento y acaba en el último', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2026-03-10');

    expect(escalera.peldanos.map((p) => p.anio)).toEqual([2030, 2043]);
    expect(escalera.mesLibre).toBe('2043-08');
  });

  it('cuando vence el personal, la cuota total baja lo que él pagaba', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2026-03-10');
    const peldano = escalera.peldanos.find((p) => p.anio === 2030)!;
    const soloHipoteca = getCuota(cuadros[0].cuadro, '2030-03-15');

    expect(peldano.nuevoTotal).toBeCloseTo(soloHipoteca, 2);
  });

  it('el último peldaño deja la cuota en cero · quedas libre', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2026-03-10');

    expect(escalera.peldanos[escalera.peldanos.length - 1].nuevoTotal).toBe(0);
  });

  it('sin préstamos vivos no hay escalera que dibujar', () => {
    const escalera = escaleraDeLiberacion(cuadros, '2099-01-01');

    expect(escalera.puntos).toHaveLength(0);
    expect(escalera.mesLibre).toBeNull();
  });
});

// ── Lo que venía de `consulta.ts` ───────────────────────────────────────────
//
// Ese fichero era ESTE mismo módulo, escrito en paralelo mientras se arreglaba
// el motor. Dos capas de lectura sobre el mismo cuadro son exactamente el
// defecto que las dos venían a quitar, así que se quedó una — y aquí están los
// candados que la otra traía y aquí faltaban.

describe('la bonificación llega hasta la cuota, no se queda en el tipo', () => {
  // «El variable ignora las bonificaciones» ya no era cierto: `tinDelTramo` las
  // aplica. Pero suponerlo no es comprobarlo, y lo que hay que poder decir es
  // cuánto vale cumplirle las condiciones al banco.
  const conBonificacion = () =>
    unicaja({
      valorIndiceActual: 4.149,
      bonificacionesDesde: 'TRAMO_VARIABLE',
      topeBonificacionesTotal: 1.0,
      bonificaciones: [
        {
          id: 'b1',
          tipo: 'NOMINA',
          nombre: 'Bloque haberes',
          reduccionPuntosPorcentuales: 1.0,
          impacto: { puntos: 1.0 },
          lookbackMeses: 6,
          regla: { tipo: 'NOMINA', minimoMensual: 2500 },
          estado: 'ACTIVO_POR_CUMPLIMIENTO',
        },
      ],
    } as Partial<Prestamo>);

  it('el tramo variable SÍ se bonifica · 5,899 − 1,00 = 4,899', () => {
    expect(getTinVigente(conBonificacion(), '2030-03-01')).toBeCloseTo(4.899, 3);
  });

  // Esta escritura dice que las bonificaciones empiezan con el tramo variable.
  it('y el fijo no, porque esta escritura dice que desde el variable', () => {
    expect(getTinVigente(conBonificacion(), '2024-03-01')).toBeCloseTo(2.6, 3);
  });

  it('un punto de rebaja son 40,65 € menos al mes', () => {
    const sinBonificar = unicaja({ valorIndiceActual: 4.149 });
    const teorica = getCuota(cuadroDe(sinBonificar), '2030-03-01');
    const bonificada = getCuota(cuadroDe(conBonificacion()), '2030-03-01');

    expect(teorica - bonificada).toBeCloseTo(40.65, 2);
  });
});

describe('los recibos de un año son los que hay, no doce', () => {
  it('el año de la firma tiene los meses que existieron', () => {
    // Firmada el 25 de agosto · de septiembre a diciembre son cuatro.
    expect(cuotasDelAnio(cuadroDe(unicaja()), 2023)).toHaveLength(4);
  });

  it('un año entero son doce', () => {
    expect(cuotasDelAnio(cuadroDe(unicaja()), 2024)).toHaveLength(12);
  });

  it('y un año fuera del préstamo, ninguno', () => {
    expect(cuotasDelAnio(cuadroDe(unicaja()), 2050)).toHaveLength(0);
    expect(getInteresDelAnio(cuadroDe(unicaja()), 2050)).toBe(0);
  });
});

describe('el año ya declarado manda sobre la proyección', () => {
  const conDestino = (over: Partial<Prestamo> = {}) =>
    unicaja({
      ambito: 'INMUEBLE',
      destinos: [{ tipo: 'ADQUISICION', inmuebleId: 'i1', importe: 85000, porcentaje: 100 }],
      ...over,
    } as Partial<Prestamo>);

  const alquilado: ReadonlySet<string> = new Set(['i1']);
  const vacio: ReadonlySet<string> = new Set<string>();

  it('sin nada declarado se suman los intereses del cuadro', () => {
    const p = conDestino();

    expect(getInteresDeducible(p, cuadroDe(p), 2024, alquilado)).toBeCloseTo(
      getInteresDelAnio(cuadroDe(p), 2024),
      2
    );
  });

  // Lo que dijo el certificado del banco es lo que fue a la renta · una
  // proyección no puede reescribir un año ya presentado.
  it('con el certificado apuntado, gana el certificado', () => {
    const p = conDestino({ interesesAnualesDeclarados: { 2024: 1234.56 } } as Partial<Prestamo>);

    expect(getInteresDeducible(p, cuadroDe(p), 2024, alquilado)).toBe(1234.56);
  });

  // El certificado dice cuánto INTERÉS hubo, no que sea deducible: si el piso
  // no está alquilado, ese interés no baja a la casilla 0105 por muy declarado
  // que esté el importe.
  it('pero ni el certificado deduce si el inmueble no está alquilado', () => {
    const p = conDestino({ interesesAnualesDeclarados: { 2024: 1234.56 } } as Partial<Prestamo>);

    expect(getInteresDeducible(p, cuadroDe(p), 2024, vacio)).toBe(0);
    expect(getInteresDeducible(conDestino(), cuadroDe(conDestino()), 2024, vacio)).toBe(0);
  });
});

describe('el cuadro memoizado no puede ser el de otro préstamo', () => {
  // La huella es el préstamo entero · una lista de campos se queda corta el día
  // que alguien añada uno al cálculo y no se acuerde de actualizarla.
  it('cambiar un dato del cálculo da un cuadro distinto', () => {
    const antes = cuadroDe(unicaja()).resumen.cuotaMensual;
    const despues = cuadroDe(unicaja({ principalInicial: 90000 })).resumen.cuotaMensual;

    expect(despues).toBeGreaterThan(antes);
  });

  it('y preguntar dos veces por el mismo da lo mismo', () => {
    expect(cuadroDe(unicaja()).resumen).toEqual(cuadroDe(unicaja()).resumen);
  });
});

// ── La revisión y su primer recibo son dos días ─────────────────────────────
//
// El banco revisa el 25 de agosto; el primer recibo al importe nuevo se carga
// el 25 de septiembre, porque el del 25 de agosto paga un devengo que ya había
// corrido al tipo viejo. La ficha decía «próxima revisión 25 sep 2026»: el
// recibo llamado por el nombre de la revisión, teniendo el día bueno al lado.
describe('la revisión y el recibo que la estrena', () => {
  // La mixta de Unicaja · 36 meses fijos desde el 25/08/2023, así que el tramo
  // variable arranca el 25/08/2026 y su primer recibo se cobra el 25/09/2026.
  const mixta = (): Prestamo =>
    unicaja({
      tipo: 'MIXTO',
      tipoNominalAnualMixtoFijo: 2.6,
      tramoFijoMeses: 36,
      valorIndiceActual: 4,
      diferencial: 1.75,
    } as Partial<Prestamo>);

  it('se llevan un mes, y cada uno dice lo suyo', () => {
    const p = mixta();
    const r = getProximaRevision(p, cuadroDe(p), '2026-08-08', 365)!;

    expect(r.aplicaDesde).toBe('2026-08-25');
    expect(r.fecha).toBe('2026-09-25');
  });

  // El candado: si `aplicaDesde` saliera de la fecha de cargo, este test no
  // distinguiría nada. Tienen que ser distintos.
  it('y no son el mismo día', () => {
    const p = mixta();
    const r = getProximaRevision(p, cuadroDe(p), '2026-08-08', 365)!;

    expect(r.aplicaDesde).not.toBe(r.fecha);
    expect(r.aplicaDesde < r.fecha).toBe(true);
  });

  // El TIN de después se lee en el día de la revisión · leerlo en el del recibo
  // acierta solo mientras los dos caigan en el mismo tramo.
  it('el TIN de después es el del tramo que estrena la revisión', () => {
    const p = mixta();
    const r = getProximaRevision(p, cuadroDe(p), '2026-08-08', 365)!;

    expect(r.tinDespues).toBeCloseTo(getTinVigente(p, r.aplicaDesde), 3);
    expect(r.tinDespues).toBeGreaterThan(r.tinAntes);
  });
});
