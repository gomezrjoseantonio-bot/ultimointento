// ═══════════════════════════════════════════════════════════════
// Datos Fiscales Comparison Service — T22
// Detects changes between AEAT Datos Fiscales and existing ATLAS data
// ═══════════════════════════════════════════════════════════════

import type { Property } from './db';
import { initDB } from './db';
import { prestamosService } from './prestamosService';
import { getEntidades } from './entidadAtribucionService';
import { ejercicioFiscalService } from './ejercicioFiscalService';
import type { DatosFiscalesExtraidos } from './datosFiscalesService';
import type { Prestamo } from '../types/prestamos';

// ── Types ────────────────────────────────────────────────────

export interface CambioDetectado {
  tipo: 'nuevo' | 'actualizado' | 'diferencia' | 'solo_atlas';
  categoria: 'inmueble' | 'prestamo' | 'entidad' | 'arrastre' | 'general';
  descripcion: string;
  valorAnterior?: string;
  valorNuevo?: string;
}

export interface InmuebleComparacion {
  refCatastral: string;
  direccion: string;
  esNuevo: boolean;
  valorCatastralAnterior?: number;
  valorCatastralNuevo?: number;
  valorConstruccionAnterior?: number;
  valorConstruccionNuevo?: number;
  porcentaje?: number;
  dias?: number;
  uso?: string;
  propertyIdExistente?: number;
}

// ── Helpers ──────────────────────────────────────────────────

function normalizeRef(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, '').trim().toUpperCase();
}

function fmtEur(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// ── Main comparison function ─────────────────────────────────

export async function detectarCambios(
  datosFiscales: DatosFiscalesExtraidos,
): Promise<CambioDetectado[]> {
  const cambios: CambioDetectado[] = [];

  const [propiedades, prestamos, entidades] = await Promise.all([
    cargarPropiedades(),
    cargarPrestamos(),
    getEntidades(),
  ]);

  // ── 1. Inmuebles ──────────────────────────────────────────
  if (datosFiscales.inmuebles?.length) {
    for (const inmDF of datosFiscales.inmuebles) {
      if (!inmDF.refCatastral) continue;
      const ref = normalizeRef(inmDF.refCatastral);
      const existente = propiedades.find(
        (p) => normalizeRef(p.cadastralReference) === ref,
      );

      if (!existente) {
        cambios.push({
          tipo: 'nuevo',
          categoria: 'inmueble',
          descripcion: `Inmueble: ${inmDF.direccion || inmDF.refCatastral}`,
        });
        continue;
      }

      const vcExistente = existente.fiscalData?.cadastralValue || existente.aeatAmortization?.cadastralValue || 0;
      const vccExistente = existente.fiscalData?.constructionCadastralValue || existente.aeatAmortization?.constructionCadastralValue || 0;

      if (inmDF.valorCatastral && inmDF.valorCatastral > 0 && vcExistente > 0 && Math.abs(inmDF.valorCatastral - vcExistente) > 1) {
        cambios.push({
          tipo: 'actualizado',
          categoria: 'inmueble',
          descripcion: `${existente.alias || existente.address}: VC ${fmtEur(vcExistente)} → ${fmtEur(inmDF.valorCatastral)}`,
          valorAnterior: String(vcExistente),
          valorNuevo: String(inmDF.valorCatastral),
        });
      } else if (inmDF.valorCatastral && inmDF.valorCatastral > 0 && (!vcExistente || vcExistente === 0)) {
        cambios.push({
          tipo: 'actualizado',
          categoria: 'inmueble',
          descripcion: `${existente.alias || existente.address}: VC — → ${fmtEur(inmDF.valorCatastral)}`,
          valorAnterior: '—',
          valorNuevo: String(inmDF.valorCatastral),
        });
      }

      if (inmDF.valorConstruccion && inmDF.valorConstruccion > 0 && vccExistente > 0 && Math.abs(inmDF.valorConstruccion - vccExistente) > 1) {
        cambios.push({
          tipo: 'actualizado',
          categoria: 'inmueble',
          descripcion: `${existente.alias || existente.address}: VC construcción ${fmtEur(vccExistente)} → ${fmtEur(inmDF.valorConstruccion)}`,
          valorAnterior: String(vccExistente),
          valorNuevo: String(inmDF.valorConstruccion),
        });
      }
    }

    // Properties in ATLAS but not in Datos Fiscales → "Solo ATLAS"
    const refsDF = new Set(
      datosFiscales.inmuebles
        .map((i) => normalizeRef(i.refCatastral))
        .filter(Boolean),
    );
    const soloAtlas = propiedades.filter(
      (p) => p.cadastralReference && normalizeRef(p.cadastralReference) && !refsDF.has(normalizeRef(p.cadastralReference)) && p.state === 'activo',
    );
    if (soloAtlas.length > 0) {
      cambios.push({
        tipo: 'solo_atlas',
        categoria: 'inmueble',
        descripcion: `${soloAtlas.length} inmueble${soloAtlas.length > 1 ? 's' : ''} con gastos operativos no reportados por Hacienda`,
      });
    }
  }

  // ── 2. Préstamos ──────────────────────────────────────────
  if (datosFiscales.prestamos?.length) {
    for (const presDF of datosFiscales.prestamos) {
      const yaExiste = prestamos.some(
        (p) => p.nombre?.includes(presDF.entidad || '___NOMATCH___'),
      );
      if (!yaExiste) {
        cambios.push({
          tipo: 'nuevo',
          categoria: 'prestamo',
          descripcion: `Préstamo: ${presDF.entidad}, saldo ${fmtEur(presDF.saldoPendiente || 0)}`,
        });
      }
    }
  }

  // ── 3. Entidades ──────────────────────────────────────────
  if (datosFiscales.entidades?.length) {
    for (const entDF of datosFiscales.entidades) {
      if (!entDF.nif) continue;
      const existente = entidades.find((e) => e.nif === entDF.nif);
      if (!existente) {
        cambios.push({
          tipo: 'nuevo',
          categoria: 'entidad',
          descripcion: `${entDF.nombre || entDF.nif} aparece por primera vez en los datos fiscales`,
        });
      }
    }
  }

  // ── 4. Arrastres ──────────────────────────────────────────
  if (datosFiscales.arrastres?.gastosPendientes?.length) {
    try {
      const ejercicio = datosFiscales.ejercicio || new Date().getFullYear();
      const ej = await ejercicioFiscalService.getOrCreateEjercicio(ejercicio, 'en_curso');
      const gastosAtlas = ej.arrastresGenerados?.gastos0105_0106 || [];

      for (const gasto of datosFiscales.arrastres.gastosPendientes) {
        if (!gasto.importe || gasto.importe <= 0) continue;
        const ref = normalizeRef(gasto.inmueble);
        const matchAtlas = gastosAtlas.find(
          (a) => normalizeRef(a.referenciaCatastral) === ref
            && a.ejercicioOrigen === (gasto.origenEjercicio || ejercicio),
        );

        if (!matchAtlas) {
          cambios.push({
            tipo: 'nuevo',
            categoria: 'arrastre',
            descripcion: `Arrastre ${gasto.inmueble}: ${fmtEur(gasto.importe)} pendientes`,
          });
        } else if (Math.abs(matchAtlas.importePendiente - gasto.importe) > 1) {
          cambios.push({
            tipo: 'diferencia',
            categoria: 'arrastre',
            descripcion: `Arrastre ${gasto.inmueble}: Hacienda ${fmtEur(gasto.importe)} vs ATLAS ${fmtEur(matchAtlas.importePendiente)}`,
            valorAnterior: String(matchAtlas.importePendiente),
            valorNuevo: String(gasto.importe),
          });
        }
      }
    } catch {
      // No exercise data yet — all carryovers will be new
    }
  }

  return cambios;
}

// ── Inmueble comparison data for verification UI ─────────────

export async function compararInmuebles(
  datosFiscales: DatosFiscalesExtraidos,
): Promise<InmuebleComparacion[]> {
  const propiedades = await cargarPropiedades();
  const comparaciones: InmuebleComparacion[] = [];

  for (const inmDF of datosFiscales.inmuebles || []) {
    if (!inmDF.refCatastral) continue;
    const ref = normalizeRef(inmDF.refCatastral);
    const existente = propiedades.find(
      (p) => normalizeRef(p.cadastralReference) === ref,
    );

    comparaciones.push({
      refCatastral: inmDF.refCatastral,
      direccion: inmDF.direccion || '',
      esNuevo: !existente,
      valorCatastralAnterior: existente?.fiscalData?.cadastralValue || existente?.aeatAmortization?.cadastralValue,
      valorCatastralNuevo: inmDF.valorCatastral,
      valorConstruccionAnterior: existente?.fiscalData?.constructionCadastralValue || existente?.aeatAmortization?.constructionCadastralValue,
      valorConstruccionNuevo: inmDF.valorConstruccion,
      porcentaje: inmDF.porcentajeParticipacion,
      dias: inmDF.diasEnEjercicio,
      uso: inmDF.uso,
      propertyIdExistente: existente?.id,
    });
  }

  return comparaciones;
}

// ── Loaders ──────────────────────────────────────────────────

async function cargarPropiedades(): Promise<Property[]> {
  try {
    const db = await initDB();
    return await db.getAll('properties') as Property[];
  } catch {
    return [];
  }
}

async function cargarPrestamos(): Promise<Prestamo[]> {
  try {
    return await prestamosService.getAllPrestamos();
  } catch {
    return [];
  }
}
