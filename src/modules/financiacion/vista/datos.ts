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
 * Manda la garantía —un inmueble responde o no responde—, y el ámbito solo
 * decide cuando no hay ninguna apuntada. Las pignoraticias cuentan como
 * personales: la cartera solo tiene dos filtros y una prenda no es una hipoteca.
 */
export function familiaDe(p: Prestamo): FamiliaPrestamo {
  const garantias = p.garantias ?? [];
  if (garantias.some((g) => g.tipo === 'HIPOTECARIA')) return 'hipoteca';
  if (garantias.length > 0) return 'personal';
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

export function totalesDe(filas: FilaCartera[], hoy: string): TotalesHero {
  const anio = Number(hoy.slice(0, 4));
  const bancos = new Set(filas.map((f) => f.banco.nombre).filter(Boolean));

  const porVencimiento = filas
    .filter((f) => f.vencimiento)
    .sort((a, b) => b.vencimiento!.localeCompare(a.vencimiento!));

  const deducibles = filas
    .map((f) => getInteresDeducible(f.prestamo, f.cuadro, anio))
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

export type OrdenCartera = 'vencimiento' | 'tin' | 'capital' | 'cuota';

export const ETIQUETA_ORDEN: Record<OrdenCartera, string> = {
  vencimiento: 'Ordenar · vencimiento',
  tin: 'Ordenar · TIN más alto',
  capital: 'Ordenar · capital vivo',
  cuota: 'Ordenar · cuota',
};

export function ordenar(filas: FilaCartera[], orden: OrdenCartera): FilaCartera[] {
  const copia = [...filas];
  switch (orden) {
    case 'tin':
      return copia.sort((a, b) => b.tin - a.tin);
    case 'capital':
      return copia.sort((a, b) => b.capitalVivo - a.capitalVivo);
    case 'cuota':
      return copia.sort((a, b) => b.cuota - a.cuota);
    case 'vencimiento':
    default:
      return copia.sort((a, b) => (a.vencimiento ?? '9999').localeCompare(b.vencimiento ?? '9999'));
  }
}
