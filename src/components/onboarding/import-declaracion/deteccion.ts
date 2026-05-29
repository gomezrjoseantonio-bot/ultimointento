/**
 * deteccion.ts · Wizard import XML V2 · helpers puros de detección desde las
 * declaraciones parseadas · usados por los pasos 4·5 y el aside.
 */

import type { DeclaracionCompleta } from '../../../types/declaracionCompleta';

function alias(direccion: string): string {
  if (!direccion) return 'Inmueble';
  return direccion
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function etiquetaConcepto(c: string): string {
  switch (c) {
    case 'mejora':
      return 'Mejora';
    case 'reparacion':
      return 'Reparación';
    case 'gestion':
      return 'Gestión';
    case 'servicios':
      return 'Servicios';
    default:
      return 'Servicios';
  }
}

export interface ProveedorDetectado {
  nif: string;
  descripcion: string;
  total: number;
  inmuebles: string[];
}

/** Agrega los NIFs de proveedor detectados en gastos por inmueble (igual criterio que el distribuidor). */
export function detectarProveedores(decls: DeclaracionCompleta[]): ProveedorDetectado[] {
  interface Acum {
    total: number;
    conceptos: Set<string>;
    inmuebles: Set<string>;
    anios: Set<number>;
  }
  const map = new Map<string, Acum>();
  const add = (nif: string | undefined, concepto: string, importe: number, inm: string, anio: number) => {
    if (!nif || !nif.trim() || importe <= 0) return;
    const key = nif.trim().toUpperCase();
    const a = map.get(key) ?? { total: 0, conceptos: new Set(), inmuebles: new Set(), anios: new Set() };
    a.total += importe;
    a.conceptos.add(concepto);
    a.inmuebles.add(inm);
    a.anios.add(anio);
    map.set(key, a);
  };

  for (const d of decls) {
    for (const inm of d.inmuebles) {
      if (inm.esAccesorioDe) continue;
      const inmAlias = alias(inm.direccion);
      for (const m of inm.mejorasEjercicio) add(m.nifProveedor, 'mejora', m.importe, inmAlias, d.meta.ejercicio);
      for (const p of inm.proveedores ?? []) add(p.nif, p.concepto, p.importe, inmAlias, d.meta.ejercicio);
      for (const arr of inm.arrendamientos)
        for (const p of arr.proveedores ?? []) add(p.nif, p.concepto, p.importe, inmAlias, d.meta.ejercicio);
    }
  }

  return Array.from(map.entries())
    .map(([nif, a]) => {
      const conceptos = Array.from(a.conceptos).map(etiquetaConcepto);
      const anios = Array.from(a.anios).sort();
      const inmuebles = Array.from(a.inmuebles);
      const aniosTxt = anios.length === 1 ? `${anios[0]}` : `${anios[0]}–${anios[anios.length - 1]}`;
      return {
        nif,
        total: Math.round(a.total * 100) / 100,
        inmuebles,
        descripcion: `${conceptos.join(' · ')} · ${inmuebles.join(' + ')} · ${aniosTxt}`,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface PlanXmlAnio {
  ejercicio: number;
  trabajador: number;
  empresa: number;
}

export interface PlanXmlDetectado {
  nifEmpleador?: string;
  nombreEmpleador?: string;
  porAnio: PlanXmlAnio[];
  totalTrabajador: number;
  totalEmpresa: number;
}

/**
 * Agrupa las aportaciones a plan de pensiones del XML.
 *
 * H1 · el NIF de empleador (VNIFEMAPCOPPE/NIFEMPSPS) solo aparece en algunos
 * años, pero el PPE es el mismo. Si en todo el conjunto hay como mucho UN NIF de
 * empleador distinto, se unifica todo en un único plan, rellenando (backfill) la
 * identidad del empleador desde el año que sí la trae. Solo se separan en varias
 * cards si aparecen NIF de empleador DISTINTOS (varios PPE reales).
 *
 * (NIF_EEDD del XML NO se usa: es la entidad que presenta la declaración, no la
 * gestora del plan.)
 */
export function detectarPlanesXml(decls: DeclaracionCompleta[]): PlanXmlDetectado[] {
  interface Entrada extends PlanXmlAnio {
    nifEmpleador?: string;
    nombreEmpleador?: string;
  }
  const entradas: Entrada[] = [];
  for (const d of decls) {
    const pp = d.planPensiones;
    if (!pp) continue;
    const trabajador = pp.aportacionesTrabajador ?? 0;
    const empresa = pp.contribucionesEmpresa ?? 0;
    if (trabajador <= 0 && empresa <= 0) continue;
    entradas.push({
      ejercicio: d.meta.ejercicio,
      trabajador,
      empresa,
      nifEmpleador: pp.nifEmpleador?.trim().toUpperCase() || undefined,
      nombreEmpleador: pp.nombreEmpleador || undefined,
    });
  }
  if (entradas.length === 0) return [];

  const nifsDistintos = Array.from(new Set(entradas.map((e) => e.nifEmpleador).filter(Boolean))) as string[];

  // Clave de agrupación: con ≤1 NIF distinto, todo es el mismo plan (backfill).
  const claveDe = (e: Entrada): string =>
    nifsDistintos.length <= 1 ? '__unico__' : (e.nifEmpleador ?? '__sin_cif__');

  const map = new Map<string, PlanXmlDetectado>();
  for (const e of entradas) {
    const key = claveDe(e);
    const grupo =
      map.get(key) ??
      ({ nifEmpleador: undefined, nombreEmpleador: undefined, porAnio: [], totalTrabajador: 0, totalEmpresa: 0 } as PlanXmlDetectado);
    grupo.porAnio.push({ ejercicio: e.ejercicio, trabajador: e.trabajador, empresa: e.empresa });
    grupo.totalTrabajador += e.trabajador;
    grupo.totalEmpresa += e.empresa;
    // Backfill de identidad desde el año que la trae.
    if (!grupo.nifEmpleador && e.nifEmpleador) grupo.nifEmpleador = e.nifEmpleador;
    if (!grupo.nombreEmpleador && e.nombreEmpleador) grupo.nombreEmpleador = e.nombreEmpleador;
    map.set(key, grupo);
  }
  for (const g of map.values()) g.porAnio.sort((a, b) => a.ejercicio - b.ejercicio);
  return Array.from(map.values());
}
