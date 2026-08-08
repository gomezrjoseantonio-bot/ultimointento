// ============================================================================
// Qué inmuebles estuvieron alquilados en un ejercicio
// ============================================================================
//
// La pregunta que decide si los intereses de un préstamo reducen el IRPF. La
// app venía contestando otra *(Jose · 8 ago 2026)*:
//
//   «la deducción fiscal de un préstamo la genera si el inmueble está
//    alquilado, no si el destino es adquisición»
//
// El destino del capital dice QUÉ inmueble financia el préstamo
// y CUÁNTA parte, pero lo que abre la casilla 0105 es que ese inmueble produzca
// rendimientos de alquiler. Una vivienda comprada con hipoteca y vacía no
// deduce un céntimo, y la ficha la marcaba «deducible 100%».
//
// Lo peor no era el número sino el motivo que lo acompañaba: decía «el capital
// no está trazado a un inmueble EN ALQUILER» cuando el alquiler no se miraba en
// ningún sitio. Un comentario falso que no protegía nada.
// ============================================================================

import { initDB } from '../db';

/**
 * Estados de contrato que describen un arrendamiento REAL.
 *
 * `finalizado` cuenta: un contrato que terminó en junio produjo renta hasta
 * junio, y el año se declara igual. Fuera quedan los que no describen un
 * alquiler que existió: `sin_identificar` y `sin_firmar` son marcadores del
 * importador, y `rescindido` terminó antes de su fecha de fin sin que se apunte
 * cuándo — contarlo hasta `fechaFin` alargaría el alquiler más de lo que duró.
 */
const ESTADOS_QUE_ALQUILAN = new Set(['activo', 'finalizado']);

/** Si el contrato solapa el año natural · basta un día. */
const solapaElAnio = (inicio: string, fin: string | undefined, anio: number): boolean => {
  if (!inicio) return false;
  if (inicio > `${anio}-12-31`) return false;
  // Sin fecha de fin apuntada el contrato sigue vivo · no se inventa un final.
  return !fin || fin >= `${anio}-01-01`;
};

/**
 * Los inmuebles con algún arrendamiento en el año · por `id` en texto.
 *
 * En texto porque los contratos guardan `inmuebleId` numérico y los destinos de
 * un préstamo lo guardan como cadena. Comparar los dos sin normalizar es la
 * clase de frontera donde el dato existe y se tira.
 *
 * Un fallo de lectura devuelve el conjunto VACÍO, y eso hace que nada se declare
 * deducible: es el lado por el que hay que equivocarse. Afirmar una deducción
 * porque no se pudo comprobar sería poner un número en la renta de alguien.
 */
export async function inmueblesAlquiladosEn(anio: number): Promise<ReadonlySet<string>> {
  try {
    const db = await initDB();
    const contratos = await db.getAll('contracts');
    const alquilados = new Set<string>();
    for (const c of contratos) {
      if (!ESTADOS_QUE_ALQUILAN.has(c.estadoContrato)) continue;
      if (!solapaElAnio(c.fechaInicio, c.fechaFin, anio)) continue;
      if (c.inmuebleId != null) alquilados.add(String(c.inmuebleId));
    }
    return alquilados;
  } catch {
    return new Set<string>();
  }
}
