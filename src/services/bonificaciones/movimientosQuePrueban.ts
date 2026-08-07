// ============================================================================
// De dónde salen las pruebas · §6 ter
// ============================================================================
//
// Reunir lo que demuestra una bonificación —los cobros de nómina, los ingresos
// recurrentes, los recibos domiciliados, el gasto por tarjeta, las pólizas y los
// meses cerrados— vivía dentro de un componente de pantalla. Cuando esa pantalla
// se sustituyó por otra, la comprobación entera se fue con ella: el motor seguía
// ahí, con sus pruebas verdes, y ya no lo llamaba nadie.
//
// Por eso vive aquí. Una pantalla puede cambiar de sitio o de forma; de dónde
// sale la prueba de una bonificación no debería mudarse con ella.
// ============================================================================

import { initDB, type TreasuryEvent } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import { gastoPorTarjeta } from '../gastoPorTarjeta';
import { listarTarjetas } from '../tarjetasService';
import { cierres } from '../cierreDeMes';
import { cobrosDeNomina, ingresosDeLaCuenta } from './cobrosDeNomina';
import { recibosDomiciliados } from './recibosDomiciliados';
import { segurosDomiciliados } from './segurosDomiciliados';
import type { MovimientosQuePrueban } from './verificarBonificaciones';

/**
 * Todo lo que ATLAS puede enseñar como prueba, a día de hoy.
 *
 * `anio` es el año contra el que se proyectan las primas de los seguros: un
 * compromiso activo tiene su coste anual desde el primer día, y esperar a
 * diciembre para decir que se cumple sería desconfiar del propio dato.
 */
export async function movimientosQuePrueban(anio: number): Promise<MovimientosQuePrueban> {
  const db = await initDB();

  // Los cuatro a la vez · son lecturas independientes y la pantalla espera.
  const [eventos, tarjetas, cerrados, compromisos] = await Promise.all([
    db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
    listarTarjetas(),
    cierres(),
    db.getAll('compromisosRecurrentes') as Promise<CompromisoRecurrente[]>,
  ]);

  return {
    tarjetas,
    periodosDeTarjeta: gastoPorTarjeta(eventos),
    cobrosDeNomina: cobrosDeNomina(eventos),
    // La otra rama de la condición de ingresos · «o ingresos recurrentes de X
    // al año», que no exige nómina y la cumple quien cobra alquileres.
    ingresosRecurrentes: ingresosDeLaCuenta(eventos),
    recibosDomiciliados: recibosDomiciliados(eventos),
    // Un seguro se domicilia · la prueba está en los gastos recurrentes, no en
    // un módulo de pólizas que no existe.
    segurosDomiciliados: segurosDomiciliados(compromisos, anio),
    // Los meses cerrados · es lo que convierte «todavía no consta» en un NO.
    // Sin esto una bonificación no se pierde nunca (§6 quater).
    mesesCerrados: cerrados.map((c) => c.mes),
  };
}
