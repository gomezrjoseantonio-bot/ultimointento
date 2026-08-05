// ============================================================================
// El cuadro de amortización · UN SOLO MOTOR
// ============================================================================
//
// Hasta aquí había DOS, y el cuadro que acababas teniendo dependía de por qué
// puerta entrabas:
//
//   · `prestamosCalculationService` (el legacy) lo generaba `prestamosService`
//     en cada alta y en cada edición, y de él salían tesorería, la fiscalidad y
//     los informes.
//   · `prestamoCalculatorService` (el v2) lo calculaba el wizard para la vista
//     previa, y después PISABA el guardado… salvo si el préstamo era «pre-v2»,
//     o venía de una importación, o de la venta de un inmueble, o de una
//     edición hecha desde cualquier otro sitio.
//
// Los dos escribían en el mismo `planPagos`. Y no decían lo mismo: el v2 saca
// la carencia técnica como un cargo aparte —la línea 0— y el legacy la metía
// dentro de la primera cuota. Así que dos préstamos idénticos podían tener
// cuadros distintos según cómo se hubieran dado de alta.
//
// Esto es el único sitio donde se genera un cuadro. Lo que decide:
//
//   - **El tipo sale de `tinConBonificaciones`**, que es la regla de §6 ter y
//     ya aplica el tope. El wizard sumaba los puntos por su cuenta y sin tope,
//     así que la vista previa podía enseñar un tipo más bajo que el que después
//     se guardaba: la tercera versión de la misma regla.
//   - **No mira el reloj.** El legacy resolvía el tipo con `new Date()`, de
//     modo que el mismo préstamo daba un cuadro distinto según el día en que lo
//     generaras. Aquí el cuadro es función del préstamo y de nada más.
//   - **La carencia técnica se lee, no se deduce.** Sale línea 0 solo si el
//     préstamo trae `carenciaTecnica` guardada. Deducirla al vuelo se la
//     inventaría en los préstamos antiguos, que se dieron de alta sin ella.
//   - **Céntimos de banco**: la cuota se redondea a céntimos —es lo que el
//     banco carga—, el interés se calcula sobre el capital vivo y la última
//     cuota se lleva lo que quede, para que el cuadro no acabe debiendo cuatro
//     céntimos.
//
// Lo que este motor todavía NO hace, y hay que saberlo:
//
//   - **El tipo es uno para toda la vida del préstamo.** Un variable se genera
//     entero al índice de hoy y un mixto al tipo de su tramo fijo. Partir el
//     cuadro en tramos es harina de otro costal —`cuadroPorTramos` ya sabe
//     rehacer desde una fecha—, pero enchufarlo a las revisiones del índice es
//     otro trabajo.
//   - **La carencia inicial (`carencia` / `carenciaMeses`) sigue sin aplicarse.**
//     Ninguno de los dos motores la aplicaba; unificarlos no la arregla.
//   - **La TAE es la aproximación que traía el v2**, no la TIR de los flujos.
// ============================================================================

import type { Prestamo, PeriodoPago, PlanPagos } from '../../types/prestamos';
import { tinConBonificaciones } from '../bonificaciones/tinEfectivo';
import { tinBase } from '../../modules/financiacion/helpers';

export interface ResumenCuadro {
  /** La cuota constante del tramo francés · lo que se ve en pantalla. */
  cuotaMensual: number;
  /** Todo lo que se pagará de intereses, carencia técnica incluida. */
  totalIntereses: number;
  /** Solo los de las cuotas · sin la carencia técnica. */
  interesesCuadro: number;
  /** Los del cargo separado de la línea 0 · 0 si no hay. */
  interesesCarenciaTecnica: number;
  /**
   * TAE aproximada, en porcentaje.
   *
   * Es una APROXIMACIÓN heredada del motor v2, no la TIR de los flujos: suma
   * la capitalización del TIN, la comisión de apertura prorrateada y la
   * carencia técnica. Queda pendiente hacerla de verdad.
   */
  tae: number;
  /** El TIN que se paga, bonificaciones y tope incluidos · en porcentaje. */
  tinEfectivo: number;
  fechaUltimaCuota: string;
  /** Cuántas líneas tiene el cuadro · la carencia técnica cuenta como una. */
  numLineas: number;
}

export interface Cuadro {
  plan: PlanPagos;
  resumen: ResumenCuadro;
}

// ─── Fechas ─────────────────────────────────────────────────────────────────
// Aritmética sobre la cadena ISO y en UTC. El motor legacy usaba campos
// locales de `Date`, que en un navegador al este de Greenwich mueve el día.

const DIA = 86_400_000;

const partes = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m, d];
};

const aISO = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const esISO = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

/** Cuántos días tiene ese mes · `mes` va de 1 a 12. */
const diasDelMes = (anio: number, mes: number): number =>
  new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/**
 * Suma meses conservando el día de cargo, recortando al último del mes.
 *
 * Sin el recorte, un cargo el 31 se desborda al 3 de marzo y todas las citas
 * siguientes llegan tarde. Y la serie sale de la fecha base con el día
 * OBJETIVO, no de la anterior ya recortada: recortada una vez a 28, un cargo
 * del 31 debe volver al 31 en los meses que sí lo tienen.
 */
const sumarMeses = (iso: string, meses: number, diaObjetivo?: number): string => {
  const [y, m, d] = partes(iso);
  const total = (y * 12 + (m - 1)) + meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const dia = Math.min(diaObjetivo ?? d, diasDelMes(anio, mes));
  return aISO(anio, mes, dia);
};

const restarUnDia = (iso: string): string => {
  const [y, m, d] = partes(iso);
  const t = new Date(Date.UTC(y, m - 1, d) - DIA);
  return aISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};

/** Días entre dos fechas ISO, ambas incluidas. */
const diasEntre = (desde: string, hasta: string): number => {
  const [y1, m1, d1] = partes(desde);
  const [y2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA) + 1;
};

// ─── Dinero ─────────────────────────────────────────────────────────────────

const aCentimos = (euros: number): number => Math.round(euros * 100);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * La cuota del sistema francés · LA fórmula, la única.
 *
 * `tinAnual` en porcentaje (4,99 = 4,99 %). Vive aquí y no en el servicio de
 * cálculo para que quien la necesite —el generador, `cuadroPorTramos`— la
 * importe en vez de copiarla: dos fórmulas para lo mismo acaban dando dos
 * cuotas distintas.
 */
export function cuotaFrancesa(principal: number, tinAnual: number, meses: number): number {
  if (principal <= 0 || meses <= 0) return 0;
  if (tinAnual === 0) return principal / meses;

  const i = tinAnual / 100 / 12;
  const pot = Math.pow(1 + i, meses);
  return round2((principal * i * pot) / (pot - 1));
}

// ─── El generador ───────────────────────────────────────────────────────────

/** El día en que se cobra la primera cuota. */
function primerCargo(prestamo: Prestamo): string {
  if (esISO(prestamo.fechaPrimerCargo)) return prestamo.fechaPrimerCargo.slice(0, 10);

  // Sin fecha dicha se deduce de la firma: el mes siguiente, o los que diga el
  // diferimiento, en el día de cargo pactado.
  const meses = prestamo.diferirPrimeraCuotaMeses && prestamo.diferirPrimeraCuotaMeses > 0
    ? prestamo.diferirPrimeraCuotaMeses
    : 1;
  const [, , diaFirma] = partes(prestamo.fechaFirma);
  return sumarMeses(prestamo.fechaFirma, meses, prestamo.diaCargoMes || diaFirma);
}

/**
 * El cuadro de un préstamo.
 *
 * Función pura de sus datos: mismo préstamo, mismo cuadro, se genere hoy o
 * dentro de un año.
 */
export function generarCuadro(prestamo: Prestamo): Cuadro {
  const tinEfectivo = tinConBonificaciones(tinBase(prestamo), prestamo.bonificaciones, prestamo);
  const fechaFirma = esISO(prestamo.fechaFirma) ? prestamo.fechaFirma.slice(0, 10) : '';
  const cargoInicial = primerCargo(prestamo);

  // El día objetivo de la serie es el PACTADO, no el del primer cargo: si la
  // primera cita ya viene recortada —un cargo el 31 que cae en febrero— leerlo
  // de ahí dejaría todos los cargos siguientes clavados en el 28.
  const diaCargo = prestamo.diaCargoMes || partes(cargoInicial)[2];

  const periodos: PeriodoPago[] = [];
  let vivoCentimos = aCentimos(prestamo.principalInicial);

  // ── Línea 0 · la carencia técnica ─────────────────────────────────────────
  //
  // Los días sueltos entre la firma y el primer mes de cobro. El banco los
  // liquida en un cargo SEPARADO —no como suplemento de la primera cuota—, y
  // por eso es una línea propia con capital amortizado cero.
  //
  // Solo si el préstamo la trae guardada. Deducirla aquí se la inventaría en
  // los préstamos antiguos, que nunca la tuvieron.
  const ct = prestamo.carenciaTecnica;
  let interesesCarenciaTecnica = 0;
  if (ct && ct.intereses > 0 && esISO(ct.fechaLiquidacion)) {
    interesesCarenciaTecnica = round2(ct.intereses);
    periodos.push({
      periodo: 0,
      devengoDesde: fechaFirma,
      devengoHasta: ct.fechaLiquidacion.slice(0, 10),
      fechaCargo: ct.fechaLiquidacion.slice(0, 10),
      cuota: interesesCarenciaTecnica,
      interes: interesesCarenciaTecnica,
      amortizacion: 0,
      principalFinal: vivoCentimos / 100,
      esSoloIntereses: true,
      diasDevengo: ct.dias > 0 ? ct.dias : undefined,
      pagado: false,
    });
  }

  // ── Irregularidades del arranque ──────────────────────────────────────────
  // Los campos explícitos mandan; si no están, se deducen de `esquemaPrimerRecibo`.
  const mesesSoloIntereses = prestamo.mesesSoloIntereses
    ?? (prestamo.esquemaPrimerRecibo === 'SOLO_INTERESES' ? 1 : 0);

  // Con carencia técnica la primera cuota es una cuota ENTERA · los días
  // sueltos ya se han cobrado en la línea 0, y prorratearla además los cobraría
  // dos veces. No es hipotético: el wizard guardaba `esquemaPrimerRecibo:
  // 'PRORRATA'` justamente cuando había carencia técnica, porque su cuadro
  // pisaba después al del motor legacy y ese campo daba igual. Ahora no da
  // igual, y esos préstamos ya están guardados así.
  const hayCarenciaTecnica = periodos.length > 0;
  const prorratearPrimero = hayCarenciaTecnica
    ? false
    : (prestamo.prorratearPrimerPeriodo ?? (prestamo.esquemaPrimerRecibo === 'PRORRATA'));

  const plazo = prestamo.plazoMesesTotal;
  const cuotaCentimos = aCentimos(
    cuotaFrancesa(prestamo.principalInicial, tinEfectivo, plazo - mesesSoloIntereses)
  );

  let interesesCuadroCentimos = 0;
  let cargo = cargoInicial;
  // De dónde arranca el devengo de la primera cuota · si hubo carencia técnica,
  // desde su liquidación: esos días ya se han cobrado aparte.
  let devengoPrevio = periodos.length > 0 ? periodos[0].fechaCargo : fechaFirma;

  for (let periodo = 1; periodo <= plazo; periodo++) {
    const esSoloIntereses = periodo <= mesesSoloIntereses;
    const esProrrateado = periodo === 1 && prorratearPrimero;
    const esUltimo = periodo === plazo;

    const devengoHasta = restarUnDia(cargo);
    const dias = diasEntre(devengoPrevio, devengoHasta);

    // El interés del periodo. Por días solo en el arranque irregular —la
    // prorrata y el primer mes de solo intereses—; el resto, mes comercial.
    const porDias = esProrrateado || (periodo === 1 && esSoloIntereses);
    const interesCentimos = porDias
      ? Math.round((vivoCentimos / 100) * (tinEfectivo / 100) / 365 * dias * 100)
      : Math.round((vivoCentimos / 100) * (tinEfectivo / 100) / 12 * 100);

    let amortizacionCentimos: number;
    let cuotaDelPeriodo: number;

    if (esSoloIntereses) {
      amortizacionCentimos = 0;
      cuotaDelPeriodo = interesCentimos;
    } else if (esUltimo) {
      // La última cierra el préstamo · se lleva lo que quede vivo.
      amortizacionCentimos = vivoCentimos;
      cuotaDelPeriodo = amortizacionCentimos + interesCentimos;
    } else {
      cuotaDelPeriodo = esProrrateado
        ? Math.round(cuotaCentimos * (dias / 30))
        : cuotaCentimos;
      amortizacionCentimos = cuotaDelPeriodo - interesCentimos;

      // Con un tipo alto y un plazo corto el interés puede comerse la cuota. No
      // se amortiza en negativo: se paga interés y el capital se queda quieto.
      if (amortizacionCentimos < 0) {
        amortizacionCentimos = 0;
        cuotaDelPeriodo = interesCentimos;
      }
    }

    vivoCentimos = Math.max(0, vivoCentimos - amortizacionCentimos);
    interesesCuadroCentimos += interesCentimos;

    periodos.push({
      periodo,
      devengoDesde: devengoPrevio,
      devengoHasta,
      fechaCargo: cargo,
      cuota: cuotaDelPeriodo / 100,
      interes: interesCentimos / 100,
      amortizacion: amortizacionCentimos / 100,
      principalFinal: vivoCentimos / 100,
      esProrrateado,
      esSoloIntereses,
      diasDevengo: porDias && dias > 0 ? dias : undefined,
      pagado: false,
    });

    devengoPrevio = cargo;
    cargo = sumarMeses(cargo, 1, diaCargo);
  }

  const interesesCuadro = round2(interesesCuadroCentimos / 100);
  const ultima = periodos[periodos.length - 1];

  return {
    plan: {
      prestamoId: prestamo.id,
      fechaGeneracion: new Date().toISOString(),
      periodos,
      resumen: {
        totalIntereses: round2(interesesCuadro + interesesCarenciaTecnica),
        totalCuotas: periodos.length,
        fechaFinalizacion: ultima?.fechaCargo ?? '',
      },
    },
    resumen: {
      cuotaMensual: cuotaCentimos / 100,
      totalIntereses: round2(interesesCuadro + interesesCarenciaTecnica),
      interesesCuadro,
      interesesCarenciaTecnica,
      tae: taeAproximada(prestamo, tinEfectivo, interesesCarenciaTecnica),
      tinEfectivo: round2(tinEfectivo),
      fechaUltimaCuota: ultima?.fechaCargo ?? '',
      numLineas: periodos.length,
    },
  };
}

/**
 * El cuadro nuevo, con el punteo del viejo.
 *
 * Regenerar un cuadro no puede borrar lo que ya se cuadró contra el banco: el
 * enlace al movimiento (`movimientoTesoreriaId`) es trabajo del usuario, no un
 * dato calculado. Se busca la cuota equivalente por FECHA DE CARGO y, si el
 * calendario se ha movido, por número de periodo.
 *
 * Lo que no encuentre pareja nace sin puntear, y una cuota vencida se da por
 * pagada — que es lo que ya hacían el alta y la edición.
 *
 * Vivía dentro del wizard, así que solo se aplicaba si el préstamo se editaba
 * desde allí; cualquier otra puerta perdía el punteo entero.
 */
export function conservarPunteo(plan: PlanPagos, anterior: PlanPagos | null): PlanPagos {
  const porFecha = new Map<string, PeriodoPago>();
  const porPeriodo = new Map<number, PeriodoPago>();
  for (const p of anterior?.periodos ?? []) {
    if (p.fechaCargo) porFecha.set(p.fechaCargo.slice(0, 10), p);
    porPeriodo.set(p.periodo, p);
  }

  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);

  return {
    ...plan,
    periodos: plan.periodos.map((p) => {
      const previo = porFecha.get(p.fechaCargo.slice(0, 10)) ?? porPeriodo.get(p.periodo);
      const vencida = new Date(p.fechaCargo) <= hoy;
      const pagado = previo?.pagado ?? vencida;

      return {
        ...p,
        pagado,
        fechaPagoReal: previo?.fechaPagoReal ?? (pagado ? p.fechaCargo : undefined),
        movimientoTesoreriaId: previo?.movimientoTesoreriaId,
      };
    }),
  };
}

/**
 * La TAE, aproximada · heredada tal cual del motor v2.
 *
 * NO es la TIR de los flujos, que es lo que la TAE es por definición: suma la
 * capitalización del TIN, la comisión de apertura repartida por años y la
 * carencia técnica. Se conserva como estaba para que unificar los motores no
 * mueva además esta cifra; hacerla de verdad es trabajo aparte.
 */
function taeAproximada(prestamo: Prestamo, tinEfectivo: number, interesesCT: number): number {
  const capital = prestamo.principalInicial;
  const anios = prestamo.plazoMesesTotal / 12;
  if (capital <= 0 || anios <= 0) return 0;

  const i = tinEfectivo / 100 / 12;
  const comisionApertura = ((prestamo.comisionApertura || 0) * capital) / 100;

  const base = Math.pow(1 + i, 12) - 1;
  const porComision = comisionApertura / (capital * anios);
  const porCarencia = interesesCT / (capital * anios);

  return round2((base + porComision + porCarencia) * 100);
}
