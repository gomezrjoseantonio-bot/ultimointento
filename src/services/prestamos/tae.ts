// ============================================================================
// La TAE · VOCABULARIO §6 bis · quinquies
// ============================================================================
//
// La TAE es, por definición, **el tipo que iguala a cero todos los flujos**
// descontados a la fecha en que ocurren (Directiva 2014/17/UE, Anexo I; es la
// cuenta que aplica la Circular 5/2012 del Banco de España). No es una suma de
// componentes.
//
// Lo que había era una suma: capitalización del TIN + apertura repartida por
// años + carencia técnica. Su propio comentario lo confesaba. Con eso, los 45
// días de la primera cuota del Santander no movían la cifra, y un préstamo con
// arranque largo salía igual que otro sin él.
//
// Aquí no hay que inventar los flujos: **los tiene el motor único**. El cuadro
// ya dice qué se paga y qué día, con el arranque irregular y los tramos
// dentro. Esto solo los descuenta.
//
// ── Qué entra y qué no ──────────────────────────────────────────────────────
//
// Entra lo que el cliente paga por tener el préstamo:
//
//   · la **comisión de apertura**,
//   · la **tasación** —la exige el banco para conceder, es del préstamo—,
//   · los **seguros** sin los cuales no tendrías el tipo que te ofrecieron,
//   · la **comisión de mantenimiento**, que se paga con cada recibo.
//
// NO entran notaría, registro, gestoría ni AJD: desde la Ley 5/2019 art. 14.1.e)
// y el RDL 17/2018 los paga el banco. No son coste del cliente, así que no
// pueden subir su TAE.
//
// > Ojo a una que parece contradictoria y no lo es: el seguro de vida vinculado
// > **entra aquí y no se deduce** *(decisión de Jose · 6 ago 2026)*. Son dos
// > preguntas distintas — «¿cuánto me cuesta este préstamo?» y «¿qué me deja
// > restar Hacienda?». Si sin el seguro no tienes el tipo, el seguro es precio
// > del préstamo aunque no sea gasto deducible.
//
// ── Lo que la cifra NO puede decir sola ─────────────────────────────────────
//
// En un variable o un mixto, la TAE se calcula **suponiendo que el índice de
// hoy no se mueve** el resto de la vida del préstamo. Es lo que hace la FEIN, y
// quien la pinte tiene que decirlo: no es una previsión, es un supuesto.
//
// Y la TAE es la **del cuadro que se le pase**. Con bonificaciones aplicadas
// sale la bonificada; sin ellas, la otra. Por eso no las decide aquí: son dos
// preguntas y un solo motor, no dos motores.
// ============================================================================

import type { Prestamo, PlanPagos } from '../../types/prestamos';
import { esISO, partes, sumarMeses } from './fechas';

/** Un movimiento de dinero del cliente, con su fecha. */
export interface Flujo {
  fecha: string;
  /** En euros · POSITIVO lo que le entra, NEGATIVO lo que le sale. */
  importe: number;
  concepto: string;
}

const DIA = 86400000;

/**
 * Días entre dos fechas · la resta pelada.
 *
 * NO se usa `fechas.diasEntre`: ese suma uno porque cuenta los dos extremos,
 * que es lo que hace falta para devengar intereses de un periodo. Para
 * descontar un flujo, el día de la firma está a distancia CERO de sí mismo.
 */
const diasHasta = (desde: string, hasta: string): number => {
  const [y1, m1, d1] = partes(desde);
  const [y2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA);
};

/** El año del descuento · 365 días, como el Anexo I de la Directiva. */
const DIAS_DEL_ANIO = 365;

/** Lo que valen los flujos descontados a ese tipo · cero es la TIR. */
function valorDescontado(flujos: Flujo[], tipo: number): number {
  const origen = flujos[0].fecha;
  return flujos.reduce((total, f) => {
    const anios = diasHasta(origen, f.fecha) / DIAS_DEL_ANIO;
    return total + f.importe / Math.pow(1 + tipo, anios);
  }, 0);
}

/**
 * El tipo anual que deja los flujos en cero · en tanto por uno.
 *
 * Por bisección y no por Newton: no necesita derivada, no se escapa y sobre un
 * préstamo normal converge siempre. `null` cuando no hay una respuesta —menos
 * de dos flujos, una fecha que no lo es, o flujos que nunca cruzan el cero—,
 * que es mejor que devolver un número inventado.
 */
export function tir(flujos: Flujo[]): number | null {
  if (flujos.length < 2) return null;
  if (flujos.some((f) => !esISO(f.fecha) || !Number.isFinite(f.importe))) return null;

  let bajo = -0.9999;
  let alto = 10; // 1.000 % · por encima de eso no hay préstamo que valga
  const enBajo = valorDescontado(flujos, bajo);
  if (enBajo === 0) return bajo;
  if (Math.sign(enBajo) === Math.sign(valorDescontado(flujos, alto))) return null;

  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2;
    if (Math.sign(valorDescontado(flujos, medio)) === Math.sign(enBajo)) bajo = medio;
    else alto = medio;
  }
  return (bajo + alto) / 2;
}

/**
 * Todo lo que el cliente cobra y paga por este préstamo, con su fecha.
 *
 * Aquí vive la doctrina de qué entra —la cabecera de arriba—, y por eso se
 * exporta: lo que la pantalla tiene que poder desglosar es esto, no un tipo
 * suelto del que nadie sabe de dónde sale.
 */
export function flujosDelPrestamo(prestamo: Prestamo, plan: PlanPagos | null): Flujo[] {
  const firma = prestamo.fechaFirma;
  const capital = Number(prestamo.principalInicial) || 0;
  if (!esISO(firma) || capital <= 0 || !plan?.periodos?.length) return [];

  const flujos: Flujo[] = [{ fecha: firma, importe: capital, concepto: 'Capital' }];

  // Se descuenta del capital el día de la firma · el cliente nunca llega a
  // tener ese dinero, y de ahí sale la diferencia entre TIN y TAE.
  const apertura = ((Number(prestamo.comisionApertura) || 0) / 100) * capital;
  if (apertura > 0) {
    flujos.push({ fecha: firma, importe: -apertura, concepto: 'Comisión de apertura' });
  }

  const tasacion = Number(prestamo.tasacion) || 0;
  if (tasacion > 0) flujos.push({ fecha: firma, importe: -tasacion, concepto: 'Tasación' });

  // La de mantenimiento va en EUROS AL MES, no en porcentaje · se paga con cada
  // recibo, así que viaja pegada a la cuota y no como un pago aparte.
  const mantenimiento = Number(prestamo.comisionMantenimiento) || 0;
  for (const p of plan.periodos) {
    if (!esISO(p.fechaCargo)) continue;
    const importe = (Number(p.cuota) || 0) + mantenimiento;
    if (importe > 0) {
      flujos.push({ fecha: p.fechaCargo, importe: -importe, concepto: 'Recibo' });
    }
  }

  // Solo los seguros SIN LOS CUALES no tendrías el tipo · uno contratado por tu
  // cuenta no es precio del préstamo, y meterlo inflaría la TAE con algo que no
  // te cobra el banco por prestarte.
  const prima = (prestamo.segurosVinculados ?? [])
    .filter((s) => s.exigidoParaElTipo)
    .reduce((total, s) => total + (Number(s.primaAnual) || 0), 0);
  if (prima > 0) {
    const ultima = plan.periodos[plan.periodos.length - 1]?.fechaCargo ?? firma;
    // Uno al año desde la firma, mientras el préstamo viva. Se paga por
    // adelantado: la prima del último año se paga aunque el préstamo termine
    // dentro de ese año.
    for (let fecha = firma; fecha <= ultima; fecha = sumarMeses(fecha, 12)) {
      flujos.push({ fecha, importe: -prima, concepto: 'Seguros vinculados' });
    }
  }

  return flujos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * La TAE del cuadro que se le pase · en PORCENTAJE.
 *
 * Cero cuando no se puede calcular. No es una TAE del 0 %: es que no hay
 * flujos con los que responder, y quien la pinte debe callarse antes que
 * enseñar un cero como si fuera un dato.
 */
export function tae(prestamo: Prestamo, plan: PlanPagos | null): number {
  const tipo = tir(flujosDelPrestamo(prestamo, plan));
  return tipo == null ? 0 : Math.round(tipo * 10000) / 100;
}
