// Rentas netas declaradas acumuladas de un inmueble · SOLO LECTURA.
//
// La ganancia acumulada de un activo tiene dos patas: la revalorización
// (latente, del patrimonio) y las rentas netas ya realizadas. Estas últimas
// son las que se han declarado a Hacienda: el `rendimientoNetoAlquiler` por
// inmueble en la declaración de IRPF de cada ejercicio. Aquí las sumamos a lo
// largo de todos los ejercicios con declaración importada.
//
// No modifica ningún store: lee `ejerciciosFiscalesCoord` y `properties` y
// reutiliza el adaptador oficial `declaracionCompletaToIRPF`.

import { initDB } from '../../../services/db';
import {
  buildPropertyMap,
  declaracionCompletaToIRPF,
} from '../../../services/declaracionCompletaToIRPFAdapter';

export interface RentasDeclaradasAcumuladas {
  /** Suma del rendimiento neto del alquiler declarado (IRPF) en todos los ejercicios. */
  rentasNetasAcumuladas: number;
  /** Año del ejercicio declarado más antiguo con renta de este inmueble · `null` si ninguno. */
  desdeAnio: number | null;
}

const num = (valor: unknown): number => {
  const parsed = Number(valor);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Acumula la renta neta del alquiler declarada del inmueble a lo largo de los
 * ejercicios fiscales con declaración importada. Degrada a `0` (y `desdeAnio`
 * `null`) cuando aún no hay ningún ejercicio declarado — así el dato «aparece»
 * solo cuando existe, sin romper la ficha.
 */
export async function calcularRentasNetasDeclaradasAcumuladas(
  inmuebleId: number,
): Promise<RentasDeclaradasAcumuladas> {
  try {
    const db = await initDB();
    const [ejercicios, properties] = await Promise.all([
      db.getAll('ejerciciosFiscalesCoord'),
      db.getAll('properties'),
    ]);
    const propMap = buildPropertyMap(properties);

    let rentasNetasAcumuladas = 0;
    let desdeAnio: number | null = null;

    for (const ejercicio of ejercicios) {
      const declaracion = ejercicio.aeat?.declaracionCompleta;
      if (!declaracion) continue;

      const irpf = declaracionCompletaToIRPF(declaracion, propMap);
      const inmuebles = irpf.baseGeneral?.rendimientosInmuebles ?? [];

      let rentaEjercicio = 0;
      for (const item of inmuebles) {
        if (String(item.inmuebleId) === String(inmuebleId)) {
          rentaEjercicio += num(item.rendimientoNetoAlquiler);
        }
      }

      if (rentaEjercicio !== 0) {
        rentasNetasAcumuladas += rentaEjercicio;
        const anio = num(ejercicio.año);
        if (desdeAnio === null || (anio > 0 && anio < desdeAnio)) desdeAnio = anio;
      }
    }

    return {
      rentasNetasAcumuladas: Math.round(rentasNetasAcumuladas * 100) / 100,
      desdeAnio,
    };
  } catch {
    return { rentasNetasAcumuladas: 0, desdeAnio: null };
  }
}
