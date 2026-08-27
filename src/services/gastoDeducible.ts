// ============================================================================
// Qué deduce de verdad un inmueble · las cuentas puras
// ============================================================================
//
// Vive fuera de `gastosInmuebleService` porque aquí no hay base de datos: son
// tres reglas sobre una lista de gastos que ya está en memoria, y las necesitan
// dos servicios —el que las suma para la declaración y el que decide qué
// previsión puede reescribir—. Tenerlas en el servicio obligaba a cada test que
// lo mockea a reimplementarlas, que es la forma de acabar con dos respuestas
// distintas a la misma pregunta.
// ============================================================================

import type { GastoInmueble, AEATBox } from './db';

/**
 * Las casillas que llevan GASTO del arrendamiento.
 *
 * Son las siete que la AEAT enumera juntas al recordar que se prorratean por
 * días. El resto de casillas que pueden aparecer en una fila —la amortización
 * (0117), la base (0130)— no son gasto y se calculan por su cuenta: si se
 * sumaran aquí se contarían dos veces.
 */
export const CASILLAS_DE_GASTO: readonly AEATBox[] = [
  '0105', '0106', '0109', '0112', '0113', '0114', '0115',
] as const;

const ES_DE_GASTO = new Set<string>(CASILLAS_DE_GASTO);

/**
 * ¿Este gasto ya ocurrió?
 *
 * Lo contrario de `esLineaFiscalViva` (`operacionFiscalService`), y por eso mira
 * los mismos tres campos: «ocurrió» no es un valor de `estado`. Una línea
 * casada con un apunte del banco ha ocurrido aunque su `estado` siga en
 * `previsto`, así que filtrar solo por `estado === 'confirmado'` se comería
 * gastos reales. Al desconciliar se revierten los tres a la vez
 * (`treasuryConfirmationService:670-681`), y con ellos vuelve a ser previsión.
 *
 * Importa porque los intereses nacen `previsto` para los doce meses del año
 * (`operacionFiscalService:396`): sin este filtro, en marzo la declaración ya
 * deducía los intereses de diciembre.
 */
export function yaOcurrio(g: GastoInmueble): boolean {
  return !(g.estado === 'previsto' && g.movimientoId == null && g.estadoTesoreria !== 'confirmed');
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Años de 366 días · la base del prorrateo, la misma que usa la amortización. */
export const esBisiesto = (a: number): boolean => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

/**
 * Lo que de verdad deduce cada casilla · **función pura, con tests**.
 *
 * Las SIETE casillas de gasto llevan dos filtros y un prorrateo:
 *   · solo los gastos que YA OCURRIERON,
 *   · y de cada casilla, la parte que corresponde a los días arrendados.
 *
 * El resto de casillas pasa TAL CUAL. No son gasto: son lo que se declaró
 * —mejoras del ejercicio (0129), base de amortización (0130) y amortización
 * del inmueble (0131), que el import del XML guarda como filas
 * (`declaracionDistributorService:1852`)—. Prorratearlas sería falsear un dato
 * declarado, y filtrarlas dejaría el resumen fiscal sin base amortizable.
 *
 * El prorrateo es la ley, no un criterio (art. 23.1 LIRPF · STS 270/2021 · el
 * «Recuerde» del manual de Renta, que enumera intereses, seguros, comunidad,
 * IBI y suministros juntos). Los intereses entran igual que el resto: su factor
 * de afectación por titularidad ya se aplicó al crear la fila y es otro eje.
 *
 * Se reparte sobre la SUMA de la casilla, no gasto a gasto, para no arrastrar
 * el error de redondeo de cada línea.
 */
export function sumaDeducidaPorCasilla(
  gastos: readonly GastoInmueble[],
  diasArrendados: number,
  diasDelAnio: number,
): Record<string, number> {
  const deGasto: Record<string, number> = {};
  const declarado: Record<string, number> = {};
  for (const g of gastos) {
    const importe = Number(g.importe);
    if (!Number.isFinite(importe)) continue;
    if (!ES_DE_GASTO.has(g.casillaAEAT)) {
      declarado[g.casillaAEAT] = (declarado[g.casillaAEAT] ?? 0) + importe;
      continue;
    }
    if (!yaOcurrio(g)) continue;
    deGasto[g.casillaAEAT] = (deGasto[g.casillaAEAT] ?? 0) + importe;
  }

  const proporcion = diasDelAnio > 0 ? Math.min(1, Math.max(0, diasArrendados / diasDelAnio)) : 0;
  const salida: Record<string, number> = { ...declarado };
  if (proporcion === 0) return salida;

  for (const [casilla, importe] of Object.entries(deGasto)) {
    salida[casilla] = round2(importe * proporcion);
  }
  return salida;
}
