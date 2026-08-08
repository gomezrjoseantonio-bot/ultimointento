// Las filas de la cartera y los totales del hero · cada cifra sale del motor.
//
// Cada número de esta pantalla se lee del `Cuadro` de `generarCuadro` con las
// lecturas por fecha de `services/prestamos/lecturas`. Nada viene de
// `modules/financiacion/helpers.ts` ni de `prestamo.cuotaMensual`: ese era el
// origen de las cuotas que bailaban al marcar un recibo como pagado.

import type { Prestamo } from '../../../types/prestamos';
import type { Cuadro } from '../../../services/prestamos/cuadro';
import {
  cuadroDe as cuadroDelMotor,
  getCapitalVivo,
  getCuota,
  getDesgloseCuota,
  getFechaVencimiento,
  getInteresDeducible,
  getPctAmortizado,
  getProximaRevision,
  getTinVigente,
  type RevisionQueViene,
} from '../../../services/prestamos/lecturas';
import { identidadBanco, type IdentidadBanco } from './bancoIdentidad';

/** Hipoteca o personal · las dos familias que filtra la cartera (§5.4). */
export type FamiliaPrestamo = 'hipoteca' | 'personal';

export interface FilaCartera {
  id: string;
  nombre: string;
  /** El destino en una línea · «Tenderina 64» · «compra vehículo». */
  meta: string;
  familia: FamiliaPrestamo;
  banco: IdentidadBanco;
  capitalVivo: number;
  cuota: number;
  tin: number;
  pctAmortizado: number;
  /** ISO de la última cuota del cuadro. */
  vencimiento: string | null;
  /** La revisión que viene, si mueve la cuota dentro de la ventana. */
  revision: RevisionQueViene | null;
  prestamo: Prestamo;
  cuadro: Cuadro;
}

/**
 * A qué familia pertenece un préstamo.
 *
 * Manda la garantía —un inmueble responde o no responde—, y después lo que el
 * préstamo dice de sí mismo. Las pignoraticias cuentan como personales: la
 * cartera solo tiene dos filtros y una prenda no es una hipoteca.
 *
 * `tipoPrestamoV2` lo escriben el asistente, la importación y la FEIN, y **no lo
 * leía nadie**. Una hipoteca dada de alta desde su FEIN llega con
 * `'hipotecario'` y sin garantía apuntada —la escritura la firma después—, así
 * que la cartera la llamaba «personal» teniendo el dato delante. Es el mismo
 * patrón de siempre: el dato existe y se tira en la frontera.
 */
export function familiaDe(p: Prestamo): FamiliaPrestamo {
  const garantias = p.garantias ?? [];
  if (garantias.some((g) => g.tipo === 'HIPOTECARIA')) return 'hipoteca';
  if (garantias.length > 0) return 'personal';
  if (p.tipoPrestamoV2 === 'hipotecario') return 'hipoteca';
  if (p.tipoPrestamoV2 === 'personal') return 'personal';
  return p.ambito === 'INMUEBLE' ? 'hipoteca' : 'personal';
}

const ETIQUETA_DESTINO: Record<string, string> = {
  ADQUISICION: 'adquisición',
  REFORMA: 'reforma',
  CANCELACION_DEUDA: 'cancelación de deuda',
  INVERSION: 'inversión',
  PERSONAL: 'personal',
  OTRA: 'otro destino',
};

/**
 * El destino en una línea · el texto que escribió el usuario si lo hay.
 *
 * Deliberadamente NO dice «fijo» ni «mixto»: el tipo ya se ve en la columna del
 * TIN y en v10 se quitó de aquí para que la línea hable del para qué.
 */
export function metaDestino(p: Prestamo): string {
  const destinos = p.destinos ?? [];
  if (destinos.length === 0) return 'sin destino apuntado';
  const conTexto = destinos.find((d) => d.descripcion?.trim());
  if (conTexto) return conTexto.descripcion!.trim();
  const tipos = [...new Set(destinos.map((d) => ETIQUETA_DESTINO[d.tipo] ?? d.tipo))];
  return tipos.join(' · ');
}

/**
 * El cuadro de un préstamo · `null` si sus datos no dan para uno.
 *
 * Delega en el `cuadroDe` del motor, que memoiza: una cartera de nueve
 * préstamos pregunta lo mismo muchas veces y regenerar 240 periodos por
 * pregunta se nota. Lo que añade este envoltorio es la red: un préstamo con
 * datos incompletos no puede tumbar la lista entera, se cae solo su fila.
 */
export function cuadroSeguroDe(p: Prestamo): Cuadro | null {
  try {
    const c = cuadroDelMotor(p);
    return c.plan.periodos.length > 0 ? c : null;
  } catch {
    return null;
  }
}

export function filaDe(p: Prestamo, cuadro: Cuadro, hoy: string): FilaCartera {
  return {
    id: p.id,
    nombre: p.nombre || 'Préstamo sin nombre',
    meta: metaDestino(p),
    familia: familiaDe(p),
    banco: identidadBanco(p.banco),
    capitalVivo: getCapitalVivo(cuadro, hoy),
    cuota: getCuota(cuadro, hoy),
    tin: getTinVigente(p, hoy),
    pctAmortizado: getPctAmortizado(cuadro, hoy),
    vencimiento: getFechaVencimiento(cuadro),
    revision: getProximaRevision(p, cuadro, hoy),
    prestamo: p,
    cuadro,
  };
}

export interface TotalesHero {
  capitalVivo: number;
  cuotaMes: number;
  interesMes: number;
  capitalMes: number;
  numPrestamos: number;
  numBancos: number;
  numHipotecas: number;
  numPersonales: number;
  /** Vencimiento más tardío · cuándo quedas libre de deuda. */
  ultimoVencimiento: string | null;
  /** El segundo más tardío · «sin la hipoteca X». */
  penultimoVencimiento: string | null;
  /** El préstamo que marca el último vencimiento. */
  nombreUltimo: string | null;
  deducible: number;
  numDeducibles: number;
}

/**
 * Los totales del hero.
 *
 * `inmueblesAlquilados` decide qué intereses deducen: no lo hace el destino del
 * capital por sí solo, sino que el inmueble que financia esté alquilado. Sin la
 * lectura de contratos todavía hecha se pasa el conjunto vacío y el total sale
 * a cero, que es la respuesta prudente mientras no se sabe.
 */
export function totalesDe(
  filas: FilaCartera[],
  hoy: string,
  inmueblesAlquilados: ReadonlySet<string>,
): TotalesHero {
  const anio = Number(hoy.slice(0, 4));
  const bancos = new Set(filas.map((f) => f.banco.nombre).filter(Boolean));

  const porVencimiento = filas
    .filter((f) => f.vencimiento)
    .sort((a, b) => b.vencimiento!.localeCompare(a.vencimiento!));

  const deducibles = filas
    .map((f) => getInteresDeducible(f.prestamo, f.cuadro, anio, inmueblesAlquilados))
    .filter((v) => v > 0);

  return {
    capitalVivo: filas.reduce((s, f) => s + f.capitalVivo, 0),
    cuotaMes: filas.reduce((s, f) => s + f.cuota, 0),
    interesMes: filas.reduce((s, f) => s + getDesgloseCuota(f.cuadro, hoy).interes, 0),
    capitalMes: filas.reduce((s, f) => s + getDesgloseCuota(f.cuadro, hoy).capital, 0),
    numPrestamos: filas.length,
    numBancos: bancos.size,
    numHipotecas: filas.filter((f) => f.familia === 'hipoteca').length,
    numPersonales: filas.filter((f) => f.familia === 'personal').length,
    ultimoVencimiento: porVencimiento[0]?.vencimiento ?? null,
    penultimoVencimiento: porVencimiento[1]?.vencimiento ?? null,
    nombreUltimo: porVencimiento[0]?.nombre ?? null,
    deducible: deducibles.reduce((s, v) => s + v, 0),
    numDeducibles: deducibles.length,
  };
}

// ─── Orden de la cartera ────────────────────────────────────────────────────

/** Por qué columna se ordena · una por cada cabecera que se puede pulsar. */
export type CampoOrden = 'nombre' | 'capital' | 'cuota' | 'tin' | 'amortizado' | 'vencimiento';

export interface OrdenCartera {
  campo: CampoOrden;
  /** Ascendente · lo pequeño primero. Cada columna tiene su sentido natural. */
  asc: boolean;
}

/**
 * Hacia dónde ordena una columna la primera vez que la pulsas.
 *
 * No es lo mismo para todas: de la deuda y la cuota interesa lo GRANDE, del
 * vencimiento lo PRÓXIMO y del nombre la A. Arrancar todas ascendentes obliga a
 * pulsar dos veces en las que más se miran.
 */
const SENTIDO_NATURAL: Record<CampoOrden, boolean> = {
  nombre: true,
  capital: false,
  cuota: false,
  tin: false,
  amortizado: false,
  vencimiento: true,
};

export const ORDEN_POR_DEFECTO: OrdenCartera = { campo: 'vencimiento', asc: true };

/**
 * El orden que toca al pulsar una cabecera.
 *
 * La misma columna otra vez le da la vuelta; una columna distinta arranca en su
 * sentido natural.
 */
export function alPulsarCabecera(actual: OrdenCartera, campo: CampoOrden): OrdenCartera {
  return actual.campo === campo
    ? { campo, asc: !actual.asc }
    : { campo, asc: SENTIDO_NATURAL[campo] };
}

const valorDe = (f: FilaCartera, campo: CampoOrden): number | string | null => {
  switch (campo) {
    case 'nombre':
      return f.nombre.toLowerCase();
    case 'capital':
      return f.capitalVivo;
    case 'cuota':
      return f.cuota;
    case 'tin':
      return f.tin;
    case 'amortizado':
      return f.pctAmortizado;
    case 'vencimiento':
    default:
      return f.vencimiento;
  }
};

export function ordenar(filas: FilaCartera[], orden: OrdenCartera): FilaCartera[] {
  const signo = orden.asc ? 1 : -1;
  return [...filas].sort((a, b) => {
    const va = valorDe(a, orden.campo);
    const vb = valorDe(b, orden.campo);

    // Lo que no se sabe va al final EN LAS DOS DIRECCIONES, y por eso se decide
    // antes del signo. Con un `'9999-99-99'` de relleno quedaba al final
    // ascendiendo y el PRIMERO descendiendo: un préstamo cuya fecha no se sabe
    // no es «el que antes acaba» ni «el que más tarda», y encabezar la lista
    // con él es justo lo contrario de lo que se pidió.
    if (va == null || vb == null) {
      if (va == null && vb == null) return 0;
      return va == null ? 1 : -1;
    }

    if (typeof va === 'string' || typeof vb === 'string') {
      return signo * String(va).localeCompare(String(vb), 'es');
    }
    return signo * (va - vb);
  });
}
