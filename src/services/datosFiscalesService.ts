// ═══════════════════════════════════════════════════════════════
// Datos Fiscales Service — T19/T20/T21
// Imports structured data from AEAT Datos Fiscales screenshots
// into ATLAS stores (properties, loans, entities, carryovers)
// ═══════════════════════════════════════════════════════════════

import type { Property } from './db';
import { initDB } from './db';
import { prestamosService } from './prestamosService';
import {
  crearEntidad,
  getEntidadByNIF,
  actualizarEjercicio,
} from './entidadAtribucionService';
import { ejercicioFiscalService } from './ejercicioFiscalService';
import {
  setInmueblesDelEjercicio,
  setArrastresManuales,
} from './ejercicioResolverService';
import { createEmptyArrastresEjercicio } from '../types/fiscal';
import type { Prestamo } from '../types/prestamos';

// ── Types ────────────────────────────────────────────────────

export interface DatosFiscalesExtraidos {
  ejercicio: number;
  trabajo?: TrabajoDF[];
  actividades?: ActividadDF[];
  cuentasBancarias?: CuentaBancariaDF[];
  planesPensiones?: PlanPensionDF[];
  inmuebles?: InmuebleDF[];
  prestamos?: PrestamoDF[];
  entidades?: EntidadDF[];
  arrastres?: ArrastresDF;
  pagosFraccionados?: PagoFraccionadoDF[];
  ventasInmuebles?: VentaInmuebleDF[];
}

export interface TrabajoDF {
  pagador: string;
  nif?: string;
  retribucionDineraria?: number;
  retribucionEspecie?: number;
  retencionIRPF?: number;
  ingresosACuenta?: number;
}

export interface ActividadDF {
  tipo?: string;
  epigrafe?: string;
  pagador?: string;
  nif?: string;
  ingresos?: number;
  retencion?: number;
}

export interface CuentaBancariaDF {
  entidad?: string;
  cuenta?: string;
  intereses?: number;
  retencion?: number;
}

export interface PlanPensionDF {
  entidad?: string;
  aportacion?: number;
}

export interface InmuebleDF {
  refCatastral: string;
  direccion?: string;
  valorCatastral?: number;
  valorConstruccion?: number;
  porcentajeParticipacion?: number;
  diasEnEjercicio?: number;
  uso?: string;
  revisado?: boolean;
  situacion?: string;
}

export interface PrestamoDF {
  entidad?: string;
  nifEntidad?: string;
  saldoPendiente?: number;
  interesesPagados?: number;
  tipo?: string; // "hipoteca_vivienda" | "otro"
}

export interface EntidadDF {
  nombre?: string;
  nif?: string;
  tipoEntidad?: string;
  participacion?: number;
  rendimientos?: number;
  retenciones?: number;
}

export interface ArrastresDF {
  gastosPendientes?: {
    inmueble?: string;
    importe?: number;
    origenEjercicio?: number;
  }[];
  perdidasPatrimoniales?: {
    importe?: number;
    origenEjercicio?: number;
    tipo?: string;
  }[];
}

export interface PagoFraccionadoDF {
  modelo?: string;
  trimestre?: string;
  importe?: number;
}

export interface VentaInmuebleDF {
  refCatastral?: string;
  fechaVenta?: string;
  valorTransmision?: number;
}

// ── Execution result ─────────────────────────────────────────

export interface ResumenImportacionDF {
  exito: boolean;
  inmueblesCreados: number;
  inmueblesActualizados: number;
  prestamosCreados: number;
  entidadesCreadas: number;
  arrastresImportados: number;
  errores: string[];
}

// ── Merge partial results ────────────────────────────────────
// When images are sent one by one, each response contains a subset
// of the datos fiscales. This function merges them without duplicating
// entries (inmuebles are deduped by ref. catastral, etc.).

export function mergearResultadosDatosFiscales(
  resultados: DatosFiscalesExtraidos[],
): DatosFiscalesExtraidos {
  if (resultados.length === 0) {
    return { ejercicio: new Date().getFullYear() };
  }
  if (resultados.length === 1) {
    return resultados[0];
  }

  const merged: DatosFiscalesExtraidos = {
    ejercicio: resultados.find((r) => r.ejercicio)?.ejercicio || new Date().getFullYear(),
  };

  // Simple array concatenation for items without natural keys
  const concatSimple = <T>(key: keyof DatosFiscalesExtraidos) => {
    const all: T[] = [];
    for (const r of resultados) {
      const arr = r[key] as T[] | undefined;
      if (arr?.length) all.push(...arr);
    }
    return all.length > 0 ? all : undefined;
  };

  // Concat + dedup by a key extractor
  const concatDedup = <T>(
    key: keyof DatosFiscalesExtraidos,
    getKey: (item: T) => string,
  ) => {
    const all: T[] = [];
    const seen = new Set<string>();
    for (const r of resultados) {
      const arr = r[key] as T[] | undefined;
      if (!arr?.length) continue;
      for (const item of arr) {
        const k = getKey(item);
        if (k && seen.has(k)) continue;
        if (k) seen.add(k);
        all.push(item);
      }
    }
    return all.length > 0 ? all : undefined;
  };

  // Inmuebles: dedup by refCatastral
  merged.inmuebles = concatDedup<InmuebleDF>(
    'inmuebles',
    (i) => (i.refCatastral || '').replace(/\s+/g, '').toUpperCase(),
  );

  // Trabajo: dedup by NIF+pagador
  merged.trabajo = concatDedup<TrabajoDF>(
    'trabajo',
    (t) => `${(t.nif || '').toUpperCase()}|${(t.pagador || '').toUpperCase()}`,
  );

  // Actividades: dedup by NIF+epigrafe
  merged.actividades = concatDedup<ActividadDF>(
    'actividades',
    (a) => `${(a.nif || '').toUpperCase()}|${a.epigrafe || ''}`,
  );

  // Cuentas bancarias: dedup by cuenta
  merged.cuentasBancarias = concatDedup<CuentaBancariaDF>(
    'cuentasBancarias',
    (c) => (c.cuenta || '').replace(/\s+/g, '').toUpperCase(),
  );

  // Planes de pensiones: simple concat (no natural key)
  merged.planesPensiones = concatSimple<PlanPensionDF>('planesPensiones');

  // Préstamos: dedup by nifEntidad+tipo
  merged.prestamos = concatDedup<PrestamoDF>(
    'prestamos',
    (p) => `${(p.nifEntidad || '').toUpperCase()}|${p.tipo || ''}`,
  );

  // Entidades: dedup by NIF
  merged.entidades = concatDedup<EntidadDF>(
    'entidades',
    (e) => (e.nif || '').toUpperCase(),
  );

  // Pagos fraccionados: dedup by modelo+trimestre
  merged.pagosFraccionados = concatDedup<PagoFraccionadoDF>(
    'pagosFraccionados',
    (p) => `${p.modelo || ''}|${p.trimestre || ''}`,
  );

  // Ventas inmuebles: dedup by refCatastral
  merged.ventasInmuebles = concatDedup<VentaInmuebleDF>(
    'ventasInmuebles',
    (v) => (v.refCatastral || '').replace(/\s+/g, '').toUpperCase(),
  );

  // Arrastres: merge both sub-arrays
  const allGastos: NonNullable<ArrastresDF['gastosPendientes']> = [];
  const allPerdidas: NonNullable<ArrastresDF['perdidasPatrimoniales']> = [];
  const seenGastos = new Set<string>();
  const seenPerdidas = new Set<string>();

  for (const r of resultados) {
    if (!r.arrastres) continue;
    for (const g of r.arrastres.gastosPendientes || []) {
      const k = `${(g.inmueble || '').replace(/\s+/g, '').toUpperCase()}|${g.origenEjercicio || 0}`;
      if (seenGastos.has(k)) continue;
      seenGastos.add(k);
      allGastos.push(g);
    }
    for (const p of r.arrastres.perdidasPatrimoniales || []) {
      const k = `${p.origenEjercicio || 0}|${p.importe || 0}|${p.tipo || ''}`;
      if (seenPerdidas.has(k)) continue;
      seenPerdidas.add(k);
      allPerdidas.push(p);
    }
  }

  if (allGastos.length > 0 || allPerdidas.length > 0) {
    merged.arrastres = {};
    if (allGastos.length > 0) merged.arrastres.gastosPendientes = allGastos;
    if (allPerdidas.length > 0) merged.arrastres.perdidasPatrimoniales = allPerdidas;
  }

  return merged;
}

// ── Helpers ──────────────────────────────────────────────────

function normalizeRef(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, '').trim().toUpperCase();
}

function splitAddress(address: string): { postalCode: string; province: string; municipality: string; ccaa: string } {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const cityPart = parts[parts.length - 1] ?? '';
  const postalMatch = cityPart.match(/(\d{5})/);
  const postalCode = postalMatch?.[1] ?? '';
  const municipality = cityPart.replace(postalCode, '').trim() || '';
  return { postalCode, province: municipality, municipality, ccaa: '' };
}

function mapUsoToContractUse(uso?: string): 'vivienda-habitual' | 'turistico' | 'otros' {
  if (!uso) return 'otros';
  const lower = uso.toLowerCase();
  if (lower.includes('arrend') || lower.includes('alquil')) return 'vivienda-habitual';
  if (lower.includes('habitual') || lower.includes('vivienda')) return 'vivienda-habitual';
  return 'otros';
}

// ── Load existing data ───────────────────────────────────────

async function cargarPropiedadesExistentes(): Promise<Property[]> {
  try {
    const db = await initDB();
    return await db.getAll('properties') as Property[];
  } catch {
    return [];
  }
}

async function cargarPrestamosExistentes(): Promise<Prestamo[]> {
  try {
    return await prestamosService.getAllPrestamos();
  } catch {
    return [];
  }
}

// ── T20: Create/Update properties from Datos Fiscales ────────

async function crearInmuebleDesdeDatosFiscales(inmDF: InmuebleDF): Promise<number> {
  const db = await initDB();
  const addressMeta = splitAddress(inmDF.direccion || '');

  const property: Omit<Property, 'id'> = {
    alias: inmDF.direccion || `Inmueble ${inmDF.refCatastral}`,
    address: inmDF.direccion || '',
    postalCode: addressMeta.postalCode,
    province: addressMeta.province,
    municipality: addressMeta.municipality,
    ccaa: addressMeta.ccaa,
    purchaseDate: '',
    cadastralReference: inmDF.refCatastral,
    squareMeters: 0,
    bedrooms: 0,
    bathrooms: 0,
    transmissionRegime: 'usada',
    state: 'activo',
    notes: 'Creado desde Datos Fiscales AEAT.',
    documents: [],
    acquisitionCosts: { price: 0 },
    fiscalData: {
      cadastralValue: inmDF.valorCatastral || undefined,
      constructionCadastralValue: inmDF.valorConstruccion || undefined,
      constructionPercentage:
        inmDF.valorCatastral && inmDF.valorConstruccion
          ? Math.round((inmDF.valorConstruccion / inmDF.valorCatastral) * 10000) / 100
          : undefined,
      contractUse: mapUsoToContractUse(inmDF.uso),
    },
    aeatAmortization: {
      acquisitionType: 'onerosa',
      firstAcquisitionDate: '',
      cadastralValue: inmDF.valorCatastral || 0,
      constructionCadastralValue: inmDF.valorConstruccion || 0,
      constructionPercentage:
        inmDF.valorCatastral && inmDF.valorConstruccion
          ? Math.round((inmDF.valorConstruccion / inmDF.valorCatastral) * 10000) / 100
          : 0,
    },
  };

  const id = await db.add('properties', property);
  return Number(id);
}

async function actualizarInmuebleDesdeDatosFiscales(
  existente: Property,
  inmDF: InmuebleDF,
): Promise<boolean> {
  const db = await initDB();
  let changed = false;
  const next: Property = {
    ...existente,
    fiscalData: { ...(existente.fiscalData || {}) },
    aeatAmortization: existente.aeatAmortization
      ? { ...existente.aeatAmortization }
      : undefined,
  };

  // T20: Only update if new value is more informative
  if (inmDF.valorCatastral && inmDF.valorCatastral > 0) {
    if (!next.fiscalData!.cadastralValue || next.fiscalData!.cadastralValue === 0 || inmDF.valorCatastral !== next.fiscalData!.cadastralValue) {
      next.fiscalData!.cadastralValue = inmDF.valorCatastral;
      if (next.aeatAmortization) next.aeatAmortization.cadastralValue = inmDF.valorCatastral;
      changed = true;
    }
  }

  if (inmDF.valorConstruccion && inmDF.valorConstruccion > 0) {
    if (!next.fiscalData!.constructionCadastralValue || next.fiscalData!.constructionCadastralValue === 0 || inmDF.valorConstruccion !== next.fiscalData!.constructionCadastralValue) {
      next.fiscalData!.constructionCadastralValue = inmDF.valorConstruccion;
      if (next.aeatAmortization) next.aeatAmortization.constructionCadastralValue = inmDF.valorConstruccion;
      changed = true;
    }
  }

  // Recalculate construction percentage
  if (changed && next.fiscalData!.cadastralValue && next.fiscalData!.constructionCadastralValue) {
    const pct = Math.round((next.fiscalData!.constructionCadastralValue / next.fiscalData!.cadastralValue) * 10000) / 100;
    next.fiscalData!.constructionPercentage = pct;
    if (next.aeatAmortization) next.aeatAmortization.constructionPercentage = pct;
  }

  if (changed) {
    await db.put('properties', next);
  }

  return changed;
}

// ── T21: Create loans from Datos Fiscales ────────────────────

async function crearPrestamoDesdeDatosFiscales(
  presDF: PrestamoDF,
  ejercicio: number,
): Promise<void> {
  const prestamo: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
    ambito: 'INMUEBLE',
    nombre: `Préstamo ${presDF.entidad || 'Desconocido'}`,
    principalInicial: presDF.saldoPendiente || 0,
    principalVivo: presDF.saldoPendiente || 0,
    fechaFirma: `${ejercicio}-01-01`,
    fechaPrimerCargo: `${ejercicio}-01-01`,
    plazoMesesTotal: 1,
    diaCargoMes: 1,
    esquemaPrimerRecibo: 'NORMAL',
    tipo: 'FIJO',
    sistema: 'FRANCES',
    tipoNominalAnualFijo: 0,
    carencia: 'NINGUNA',
    cuentaCargoId: '',
    cuotasPagadas: 0,
    estado: 'vivo',
    origenCreacion: 'IMPORTACION',
    activo: true,
    finalidad: 'ADQUISICION',
    cobroMesVencido: false,
  } as Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'>;

  await prestamosService.createPrestamo(prestamo);
}

// ── Main execution function ──────────────────────────────────

export async function ejecutarImportacionDatosFiscales(
  datos: DatosFiscalesExtraidos,
): Promise<ResumenImportacionDF> {
  const resumen: ResumenImportacionDF = {
    exito: true,
    inmueblesCreados: 0,
    inmueblesActualizados: 0,
    prestamosCreados: 0,
    entidadesCreadas: 0,
    arrastresImportados: 0,
    errores: [],
  };

  const ejercicio = datos.ejercicio || new Date().getFullYear();

  try {
    // ── T20: Inmuebles ──────────────────────────────────────
    if (datos.inmuebles?.length) {
      const propiedades = await cargarPropiedadesExistentes();

      for (const inmDF of datos.inmuebles) {
        if (!inmDF.refCatastral) continue;
        const ref = normalizeRef(inmDF.refCatastral);

        try {
          const existente = propiedades.find(
            (p) => normalizeRef(p.cadastralReference) === ref,
          );

          if (existente) {
            const updated = await actualizarInmuebleDesdeDatosFiscales(existente, inmDF);
            if (updated) resumen.inmueblesActualizados += 1;
          } else {
            await crearInmuebleDesdeDatosFiscales(inmDF);
            resumen.inmueblesCreados += 1;
          }
        } catch (error) {
          resumen.errores.push(`Error inmueble ${inmDF.refCatastral}: ${String(error)}`);
        }
      }
    }

    // ── T21: Préstamos (solo hipoteca_vivienda) ──────────────
    if (datos.prestamos?.length) {
      const prestamosExistentes = await cargarPrestamosExistentes();

      for (const presDF of datos.prestamos) {
        if (presDF.tipo !== 'hipoteca_vivienda') continue;

        try {
          // Match by NIF entidad + tipo to avoid duplicates
          const yaExiste = prestamosExistentes.some(
            (p) => p.nombre?.includes(presDF.entidad || '___NOMATCH___'),
          );
          if (yaExiste) continue;

          await crearPrestamoDesdeDatosFiscales(presDF, ejercicio);
          resumen.prestamosCreados += 1;
        } catch (error) {
          resumen.errores.push(`Error préstamo ${presDF.entidad}: ${String(error)}`);
        }
      }
    }

    // ── Entidades en atribución ──────────────────────────────
    if (datos.entidades?.length) {
      for (const entDF of datos.entidades) {
        if (!entDF.nif) continue;

        try {
          const existente = await getEntidadByNIF(entDF.nif);

          if (existente) {
            // Update exercise data
            await actualizarEjercicio(existente.id!, {
              ejercicio,
              rendimientosAtribuidos: entDF.rendimientos || 0,
              retencionesAtribuidas: entDF.retenciones || 0,
            });
          } else {
            await crearEntidad({
              nif: entDF.nif,
              nombre: entDF.nombre || entDF.nif,
              tipoEntidad: (entDF.tipoEntidad as 'CB' | 'SC' | 'HY' | 'otra') || 'otra',
              porcentajeParticipacion: entDF.participacion || 0,
              tipoRenta: 'capital_inmobiliario',
              ejercicios: [{
                ejercicio,
                rendimientosAtribuidos: entDF.rendimientos || 0,
                retencionesAtribuidas: entDF.retenciones || 0,
              }],
            });
            resumen.entidadesCreadas += 1;
          }
        } catch (error) {
          resumen.errores.push(`Error entidad ${entDF.nombre}: ${String(error)}`);
        }
      }
    }

    // ── Arrastres ────────────────────────────────────────────
    if (datos.arrastres) {
      try {
        const ej = await ejercicioFiscalService.getOrCreateEjercicio(ejercicio, 'en_curso');
        const arrastresActuales = ej.arrastresGenerados ?? createEmptyArrastresEjercicio();
        const next = {
          ...ej,
          arrastresGenerados: {
            ...arrastresActuales,
            gastos0105_0106: [...arrastresActuales.gastos0105_0106],
            perdidasPatrimonialesAhorro: [...arrastresActuales.perdidasPatrimonialesAhorro],
            amortizacionesAcumuladas: [...arrastresActuales.amortizacionesAcumuladas],
            porInmueble: [...(arrastresActuales.porInmueble ?? arrastresActuales.gastos0105_0106)],
            porAnio: [...(arrastresActuales.porAnio ?? arrastresActuales.perdidasPatrimonialesAhorro)],
          },
          updatedAt: new Date().toISOString(),
        };

        for (const gasto of datos.arrastres.gastosPendientes || []) {
          if (!gasto.importe || gasto.importe <= 0) continue;
          const ref = normalizeRef(gasto.inmueble);
          const existe = next.arrastresGenerados.gastos0105_0106.some(
            (item) => normalizeRef(item.referenciaCatastral) === ref
              && item.ejercicioOrigen === (gasto.origenEjercicio || ejercicio),
          );
          if (existe) continue;

          const record = {
            referenciaCatastral: gasto.inmueble || '',
            ejercicioOrigen: gasto.origenEjercicio || ejercicio,
            importeOriginal: gasto.importe,
            importeAplicado: 0,
            importePendiente: gasto.importe,
            caducaEjercicio: (gasto.origenEjercicio || ejercicio) + 4,
          };
          next.arrastresGenerados.gastos0105_0106.push(record);
          next.arrastresGenerados.porInmueble?.push(record);
          resumen.arrastresImportados += 1;
        }

        for (const perdida of datos.arrastres.perdidasPatrimoniales || []) {
          if (!perdida.importe || perdida.importe <= 0) continue;
          const existe = next.arrastresGenerados.perdidasPatrimonialesAhorro.some(
            (item) => item.ejercicioOrigen === (perdida.origenEjercicio || ejercicio)
              && Math.abs(item.importePendiente - perdida.importe!) < 0.01,
          );
          if (existe) continue;

          const record = {
            ejercicioOrigen: perdida.origenEjercicio || ejercicio,
            importeOriginal: perdida.importe,
            importeAplicado: 0,
            importePendiente: perdida.importe,
            caducaEjercicio: (perdida.origenEjercicio || ejercicio) + 4,
            origen: `datos_fiscales_${perdida.tipo || 'ahorro'}_${perdida.origenEjercicio || ejercicio}`,
          };
          next.arrastresGenerados.perdidasPatrimonialesAhorro.push(record);
          next.arrastresGenerados.porAnio?.push(record);
          resumen.arrastresImportados += 1;
        }

        await ejercicioFiscalService.saveEjercicio(next);
      } catch (error) {
        resumen.errores.push(`Error arrastres: ${String(error)}`);
      }
    }
    // ── Sync con ejercicioResolverService (store coordinador) ──
    try {
      // Registrar inmuebles del ejercicio en el resolver
      const allProps = await cargarPropiedadesExistentes();
      const inmuebleIds = allProps
        .filter((p) => p.state === 'activo' && p.id != null)
        .map((p) => Number(p.id));
      if (inmuebleIds.length > 0) {
        await setInmueblesDelEjercicio(ejercicio, inmuebleIds);
      }

      // Sincronizar arrastres con el resolver (fuente 'aeat' porque Hacienda los calculó)
      if (resumen.arrastresImportados > 0 && datos.arrastres) {
        const arrastresGastos = (datos.arrastres.gastosPendientes || [])
          .filter((g) => g.importe && g.importe > 0)
          .map((g) => ({
            inmuebleId: 0,
            importePendiente: g.importe!,
            añoOrigen: g.origenEjercicio || ejercicio,
            casilla: '0105' as const,
          }));
        const arrastresPerdidas = (datos.arrastres.perdidasPatrimoniales || [])
          .filter((p) => p.importe && p.importe > 0)
          .map((p) => ({
            tipo: 'patrimonial' as const,
            importePendiente: p.importe!,
            añoOrigen: p.origenEjercicio || ejercicio,
          }));

        if (arrastresGastos.length > 0 || arrastresPerdidas.length > 0) {
          await setArrastresManuales(ejercicio, {
            gastosPendientes: arrastresGastos,
            perdidasPatrimoniales: arrastresPerdidas,
            amortizacionesAcumuladas: [],
            deduccionesPendientes: [],
          });
        }
      }
    } catch (syncError) {
      console.warn('Error sincronizando Datos Fiscales con resolver coordinador:', syncError);
    }
  } catch (error) {
    resumen.exito = false;
    resumen.errores.push(`Error general: ${String(error)}`);
  }

  resumen.exito = resumen.errores.length === 0;
  return resumen;
}
