// ============================================================================
// Qué queda de un plan a partir de un día · UNA pregunta, un criterio
// ============================================================================
//
// Vivía dentro de `loanSettlementService`, que además de esto abre la base de
// datos y escribe movimientos. La simulación de un PLAN de amortizaciones
// necesita exactamente esta misma cuenta y no puede arrastrar la tesorería
// detrás, así que la pregunta se muda a un módulo puro en vez de responderse
// otra vez unas líneas más abajo — que es como nacieron las cuatro cuentas de
// intereses que esta carpeta lleva un año recogiendo.
//
// El aviso original, que sigue valiendo entero:
//
//   El modal enseñaba «plazo antes / después» y «cuota antes / después»
//   sacando cada mitad de un sitio distinto: el «antes» contaba los recibos por
//   FECHA (`fechaCargo >= la operación`) y el «después» los contaba por PUNTEO
//   (`!pagado`). Dos preguntas distintas puestas una al lado de la otra con una
//   flecha en medio.
//
//   De ahí salían los dos números que no se sostienen *(Jose · 8 ago 2026)*:
//
//     · **«205 → 206 meses» después de amortizar.** Un recibo pasado que nadie
//       había punteado no es futuro, pero `!pagado` lo contaba como tal, y
//       además la línea del adelanto —que sí va marcada pagada— no lo era. El
//       plazo subía tras meter dinero.
//     · **«454,57 € → 454,57 €» eligiendo REDUCIR CUOTA.** La cuota «después»
//       era la del primer recibo sin puntear, o sea uno viejo con la cuota
//       vieja. La rebaja estaba calculada en el cuadro y no se enseñaba.
//
//   Aquí se contesta una sola vez, y los dos cuadros —el de antes y el de
//   después— pasan por la misma función. Si el criterio es discutible que lo
//   sea para los dos a la vez; lo que no puede es cambiar entre una columna y
//   otra.
// ============================================================================

import type { PeriodoPago, PlanPagos } from '../../types/prestamos';
import { inicioDelDevengo } from './amortizarAnticipado';

export interface LoQueQueda {
  /** Recibos que aún se van a cobrar. */
  recibos: number;
  /** Lo que se paga en el próximo recibo · lo que se está pagando AHORA. */
  proximaCuota: number;
  /** La cuota del primer recibo que la operación puede cambiar. */
  cuota: number;
  /** Cuándo se cobra ese recibo · `null` si no hay ninguno. */
  cuotaDesde: string | null;
  /** Los intereses que quedan por pagar en esos recibos. */
  intereses: number;
  /** El día del último recibo que queda · `null` si no queda ninguno. */
  fechaFin: string | null;
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const ordenarPeriodos = (periodos: PeriodoPago[]): PeriodoPago[] =>
  [...periodos].sort((a, b) => new Date(a.fechaCargo).getTime() - new Date(b.fechaCargo).getTime());

/**
 * Qué queda de un plan a partir de un día.
 *
 * `fechaCargo > desde` y no `>=`: el recibo del día de la operación se está
 * pagando hoy, no es lo que queda. Y de propina eso deja fuera la línea del
 * propio adelanto, que el motor apunta con esa misma fecha — sin necesidad de
 * reconocerla por un campo, que es como se rompen estas cosas.
 *
 * **Son dos cuotas distintas y hay que devolver las dos.** Lo que pagas ahora
 * es el próximo recibo. Lo que la operación mueve es el primero que DEVENGA ya
 * del lado nuevo, que puede ser otro: el recibo a caballo paga el mes que ya
 * había corrido y no lo toca ningún adelanto.
 *
 * Confundirlas se vio en pantalla *(Jose · 8 ago 2026)*: la tarjeta decía
 * «CUOTA ACTUAL 518,10 €» un 8 de agosto en una mixta cuyo tramo fijo aguanta
 * hasta el 25 · lo que se paga ese mes son 455 €, y el 518 era ya del tramo
 * variable.
 *
 * **Las entregas de capital no son recibos.** El cuadro apunta una línea por
 * cada adelanto, y esa línea ni se gira ni tiene cuota. Con una operación
 * suelta se caía sola del filtro —cae justo el día del corte, y aquí se pide
 * `> desde`—, pero un plan de amortizaciones mete doce al año DENTRO del tramo
 * que se cuenta: sin distinguirlas, meter 2.400 € alargaba el préstamo de 209 a
 * 214 meses. Es el mismo error que dio en su día el `!pagado`, y por eso la
 * línea lo dice ahora de sí misma en vez de deducirse de la fecha.
 */
export const loQueQueda = (plan: PlanPagos | null, desde: string): LoQueQueda => {
  const pendientes = ordenarPeriodos(plan?.periodos ?? []).filter((p) => p.fechaCargo > desde);
  const recibos = pendientes.filter((p) => !p.esAdelantoDeCapital);
  const laQueMueve = recibos.find(
    (p) => inicioDelDevengo(p) >= desde && !p.esProrrateado && !p.esSoloIntereses,
  );

  return {
    recibos: recibos.length,
    proximaCuota: round2(recibos[0]?.cuota ?? 0),
    cuota: round2(laQueMueve?.cuota ?? recibos[0]?.cuota ?? 0),
    cuotaDesde: laQueMueve?.fechaCargo ?? recibos[0]?.fechaCargo ?? null,
    // Los intereses sí los suman todas: la línea de un adelanto lleva los
    // corridos que el banco cobra ese día, y dejarlos fuera haría que el
    // préstamo pareciera más barato de lo que es.
    intereses: round2(pendientes.reduce((s, p) => s + (p.interes || 0), 0)),
    fechaFin: recibos.at(-1)?.fechaCargo ?? null,
  };
};
