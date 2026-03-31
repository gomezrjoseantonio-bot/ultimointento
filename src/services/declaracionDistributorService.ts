/**
 * declaracionDistributorService.ts
 *
 * Punto único de distribución. Recibe una DeclaracionCompleta
 * (de cualquier fuente: XML, PDF, manual) y:
 *
 * 1. SIEMPRE: Guarda en ejerciciosFiscales (snapshot, estado, arrastres)
 * 2. SIEMPRE: Crea/enriquece inmuebles en properties
 * 3. PROPONE: Contratos, préstamos, gastos recurrentes, cuenta bancaria
 * 4. INFORMA: Devuelve InformeDistribucion para el wizard
 */

import { initDB } from './db';
import type { Property, EjercicioFiscalCoord, Document } from './db';
import { invalidateCachedStores } from './indexedDbCacheService';
import type {
  InformeDistribucion,
  InmuebleDistribuido,
  ContratoDetectado,
  GastoRecurrentePropuesto,
  PrestamoDetectado,
  ProveedorDistribuido,
  InversionDetectada,
} from '../types/informeDistribucion';
import type {
  DeclaracionCompleta,
  InmuebleDeclarado,
} from '../types/declaracionCompleta';

interface ResultadoInmuebles {
  distribuidos: InmuebleDistribuido[];
  contratos: ContratoDetectado[];
  gastosRecurrentes: GastoRecurrentePropuesto[];
  prestamos: PrestamoDetectado[];
  proveedores: ProveedorDistribuido[];
}

const PRIORIDAD_ARRASTRES: Record<string, number> = {
  aeat: 3,
  atlas: 2,
  manual: 1,
  ninguno: 0,
};

type DB = Awaited<ReturnType<typeof initDB>>;

export async function distribuirDeclaracion(decl: DeclaracionCompleta): Promise<InformeDistribucion> {
  const db = await initDB();

  await guardarEjercicioFiscal(db, decl);
  await archivarDocumentoImportado(db, decl);

  const resultadoInmuebles = await procesarInmuebles(db, decl);
  invalidateCachedStores(['properties']);
  return construirInforme(decl, resultadoInmuebles);
}

async function guardarEjercicioFiscal(db: DB, decl: DeclaracionCompleta): Promise<void> {
  const año = decl.meta.ejercicio;
  const ahora = new Date().toISOString();

  let ej = await db.get('ejerciciosFiscalesCoord', año);
  if (!ej) {
    ej = {
      año,
      estado: 'pendiente',
      fechaPrescripcion: new Date(Date.UTC(año + 5, 5, 30)).toISOString(),
      arrastresIn: { fuente: 'ninguno', gastosPendientes: [], perdidasPatrimoniales: [], amortizacionesAcumuladas: [], deduccionesPendientes: [] },
      inmuebleIds: [],
      createdAt: ahora,
      updatedAt: ahora,
    } as EjercicioFiscalCoord;
  }

  ej.aeat = {
    snapshot: decl.casillas,
    resumen: {
      baseImponibleGeneral: decl.integracion.baseImponibleGeneral,
      baseImponibleAhorro: decl.integracion.baseImponibleAhorro,
      baseLiquidableGeneral: decl.integracion.baseLiquidableGeneral,
      baseLiquidableAhorro: decl.integracion.baseLiquidableAhorro,
      cuotaIntegra: decl.resultado.cuotaIntegraEstatal + decl.resultado.cuotaIntegraAutonomica,
      cuotaIntegraEstatal: decl.resultado.cuotaIntegraEstatal,
      cuotaIntegraAutonomica: decl.resultado.cuotaIntegraAutonomica,
      cuotaLiquidaEstatal: 0,
      cuotaLiquidaAutonomica: 0,
      resultado: decl.resultado.resultadoDeclaracion,
    },
    fechaImportacion: ahora,
  };

  (ej.aeat as EjercicioFiscalCoord['aeat'] & { declaracionCompleta?: DeclaracionCompleta }).declaracionCompleta = decl;

  const fechaPrescripcion = new Date(año + 5, 5, 30);
  ej.estado = new Date() > fechaPrescripcion ? 'prescrito' : 'declarado';

  ej.arrastresOut = {
    fuente: 'aeat',
    gastosPendientes: decl.arrastres.gastosPendientes.map((g) => ({
      inmuebleId: 0,
      inmuebleAlias: g.refCatastral,
      importePendiente: g.importePendiente,
      añoOrigen: g.añoOrigen === 0 ? año : año - g.añoOrigen,
      casilla: '0106',
    })),
    perdidasPatrimoniales: decl.arrastres.perdidasPatrimoniales.map((p) => ({
      tipo: p.tipo === 'ahorro' ? 'ahorro_general' : 'patrimonial',
      importePendiente: p.importePendiente,
      añoOrigen: p.añoOrigen === 0 ? año : año - p.añoOrigen,
    })),
    amortizacionesAcumuladas: [],
    deduccionesPendientes: [],
  };

  const ejSiguiente = await db.get('ejerciciosFiscalesCoord', año + 1);
  if (ejSiguiente) {
    const fuente = ejSiguiente.arrastresIn?.fuente ?? 'ninguno';
    if ((PRIORIDAD_ARRASTRES[fuente] ?? 0) <= PRIORIDAD_ARRASTRES.aeat) {
      ejSiguiente.arrastresIn = {
        fuente: 'aeat',
        gastosPendientes: ej.arrastresOut.gastosPendientes,
        perdidasPatrimoniales: ej.arrastresOut.perdidasPatrimoniales,
        amortizacionesAcumuladas: [],
        deduccionesPendientes: [],
      };
      ejSiguiente.updatedAt = ahora;
      await db.put('ejerciciosFiscalesCoord', ejSiguiente);
    }
  }

  ej.updatedAt = ahora;
  await db.put('ejerciciosFiscalesCoord', ej);
}

async function archivarDocumentoImportado(db: DB, decl: DeclaracionCompleta): Promise<void> {
  const docId = decl.camposExtra.documentoImportadoId as number | undefined;
  if (typeof docId !== 'number') {
    return;
  }

  const doc = await db.get('documents', docId);
  if (!doc) {
    return;
  }

  const nextDoc: Document = {
    ...doc,
    metadata: {
      ...doc.metadata,
      status: 'Archivado',
      origen: `declaracion_${decl.meta.fuenteImportacion}`,
      ejercicio: decl.meta.ejercicio,
      fechaImportacion: new Date().toISOString(),
    },
  };

  await db.put('documents', nextDoc);
}

async function procesarInmuebles(db: DB, decl: DeclaracionCompleta): Promise<ResultadoInmuebles> {
  const distribuidos: InmuebleDistribuido[] = [];
  const contratos: ContratoDetectado[] = [];
  const gastosRecurrentes: GastoRecurrentePropuesto[] = [];
  const prestamos: PrestamoDetectado[] = [];
  const proveedores: ProveedorDistribuido[] = [];

  const todasProperties = await db.getAll('properties');
  const porRefCatastral = new Map<string, Property>();
  for (const property of todasProperties) {
    const ref = normalizeRef(property.cadastralReference);
    if (ref) {
      porRefCatastral.set(ref, property);
    }
  }

  for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) continue;

    const rc = normalizeRef(inm.refCatastral);
    if (!rc) continue;

    const dirCorta = acortarDireccion(inm.direccion);
    const existente = porRefCatastral.get(rc);

    let accion: InmuebleDistribuido['accion'];
    const camposNuevos: string[] = [];

    if (!existente) {
      const nuevoProperty = construirPropertyDesdeDeclaracion(inm);
      console.log('[distribuidor] db.add properties — inicio', rc, nuevoProperty);
      try {
        const id = await db.add('properties', nuevoProperty as Property);
        console.log('[distribuidor] db.add properties — OK, id:', id);
        porRefCatastral.set(rc, { ...nuevoProperty, id: Number(id) } as Property);
        accion = 'creado';
      } catch (addError) {
        console.error('[distribuidor] db.add properties — ERROR', rc, addError);
        throw addError;
      }
    } else {
      let modificado = false;
      const next: Property = { ...existente, acquisitionCosts: { ...(existente.acquisitionCosts || { price: 0 }) } };

      next.fiscalData = { ...(existente.fiscalData || {}) };

      if (!next.purchaseDate && inm.fechaAdquisicion) {
        next.purchaseDate = inm.fechaAdquisicion;
        camposNuevos.push('Fecha de compra');
        modificado = true;
      }
      if (!next.fiscalData.cadastralValue && inm.valorCatastral) {
        next.fiscalData.cadastralValue = inm.valorCatastral;
        camposNuevos.push('Valor catastral');
        modificado = true;
      }
      if (!next.fiscalData.constructionCadastralValue && inm.valorCatastralConstruccion) {
        next.fiscalData.constructionCadastralValue = inm.valorCatastralConstruccion;
        camposNuevos.push('VC construcción');
        modificado = true;
      }
      if (!next.fiscalData.constructionPercentage && inm.porcentajeConstruccion) {
        next.fiscalData.constructionPercentage = inm.porcentajeConstruccion;
        camposNuevos.push('% construcción');
        modificado = true;
      }
      if (next.fiscalData.cadastralRevised === undefined && inm.catastralRevisado !== undefined) {
        next.fiscalData.cadastralRevised = inm.catastralRevisado;
        modificado = true;
      }
      if (!next.fiscalData.acquisitionDate && inm.fechaAdquisicion) {
        next.fiscalData.acquisitionDate = inm.fechaAdquisicion;
        camposNuevos.push('Fecha adquisición');
        modificado = true;
      }
      if (!next.acquisitionCosts.price && inm.precioAdquisicion) {
        next.acquisitionCosts.price = inm.precioAdquisicion;
        camposNuevos.push('Precio adquisición');
        modificado = true;
      }
      if (!sumGastosAdquisicion(next.acquisitionCosts) && inm.gastosAdquisicion) {
        next.acquisitionCosts.other = [...(next.acquisitionCosts.other || []), { concept: 'Gastos adquisición AEAT', amount: inm.gastosAdquisicion }];
        camposNuevos.push('Gastos adquisición');
        modificado = true;
      }

      // Enriquecer campos de amortización AEAT solo si están vacíos
      if (next.aeatAmortization) {
        const amort = { ...next.aeatAmortization };
        let amortModificado = false;
        if (!amort.firstAcquisitionDate && inm.fechaAdquisicion) {
          amort.firstAcquisitionDate = inm.fechaAdquisicion;
          amortModificado = true;
        }
        if (!amort.baseAmortizacion && inm.baseAmortizacion) {
          amort.baseAmortizacion = inm.baseAmortizacion;
          camposNuevos.push('Base amortización');
          amortModificado = true;
        }
        if (!amort.mejorasAnteriores && inm.mejorasAnteriores) {
          amort.mejorasAnteriores = inm.mejorasAnteriores;
          amortModificado = true;
        }
        if (!amort.amortizacionAnualInmueble && inm.amortizacionAnualInmueble) {
          amort.amortizacionAnualInmueble = inm.amortizacionAnualInmueble;
          amortModificado = true;
        }
        if (amortModificado) {
          next.aeatAmortization = amort;
          modificado = true;
        }
      }

      if (modificado) {
        await db.put('properties', next);
        accion = 'actualizado';
      } else {
        accion = 'sin_cambios';
      }
    }

    const tieneDisposicion = inm.usos.some((u) => u.tipo === 'disposicion');
    const tieneArrendado = inm.usos.some((u) => u.tipo === 'arrendado');
    const tipoUso = tieneArrendado && tieneDisposicion ? 'mixto' : (tieneArrendado ? 'arrendado' : (tieneDisposicion ? 'vacío' : 'desconocido'));
    const ingresosBrutos = inm.arrendamientos.reduce((s, a) => s + (a.ingresos || 0), 0);

    distribuidos.push({
      refCatastral: rc,
      direccionCorta: dirCorta,
      accion,
      camposNuevos: camposNuevos.length > 0 ? camposNuevos : undefined,
      rendimientoNeto: inm.rendimientoNetoReducido,
      ingresosBrutos,
      tipoUso,
      diasArrendado: inm.usos.find((u) => u.tipo === 'arrendado')?.dias,
      diasVacio: inm.usos.find((u) => u.tipo === 'disposicion')?.dias,
      tieneReduccion: inm.reduccionVivienda > 0,
    });

    for (const arr of inm.arrendamientos) {
      if (arr.nifArrendatarios.length > 0) {
        contratos.push({
          refCatastral: rc,
          direccionCorta: dirCorta,
          nifInquilinos: arr.nifArrendatarios,
          fechaContrato: arr.fechaContrato,
          tipoArrendamiento: arr.tipoArrendamiento,
          ingresosAnuales: arr.ingresos,
        });
      }
    }

    pushGasto(gastosRecurrentes, rc, dirCorta, 'Comunidad', inm.gastos.comunidad);
    pushGasto(gastosRecurrentes, rc, dirCorta, 'Seguros', inm.gastos.seguros);
    pushGasto(gastosRecurrentes, rc, dirCorta, 'IBI y tasas', inm.gastos.ibiTasas);
    pushGasto(gastosRecurrentes, rc, dirCorta, 'Suministros', inm.gastos.suministros);
    pushGasto(gastosRecurrentes, rc, dirCorta, 'Gestión delegada', inm.gastos.serviciosTerceros);

    if (inm.gastos.interesesFinanciacion > 0) {
      prestamos.push({ refCatastral: rc, direccionCorta: dirCorta, interesesAnuales: inm.gastos.interesesFinanciacion });
    }

    for (const prov of inm.proveedores) {
      proveedores.push({ nif: prov.nif, concepto: prov.concepto, importe: prov.importe, inmuebleRef: rc });
    }
  }

  return { distribuidos, contratos, gastosRecurrentes, prestamos, proveedores };
}

function construirPropertyDesdeDeclaracion(inm: InmuebleDeclarado): Omit<Property, 'id'> {
  return {
    alias: acortarDireccion(inm.direccion) || inm.refCatastral,
    address: inm.direccion || inm.refCatastral,
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: inm.fechaAdquisicion || '',
    cadastralReference: normalizeRef(inm.refCatastral) || undefined,
    squareMeters: 0,
    bedrooms: 0,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: {
      price: inm.precioAdquisicion || 0,
      other: inm.gastosAdquisicion ? [{ concept: 'Gastos adquisición AEAT', amount: inm.gastosAdquisicion }] : [],
    },
    documents: [],
    fiscalData: {
      cadastralValue: inm.valorCatastral || 0,
      constructionCadastralValue: inm.valorCatastralConstruccion || 0,
      constructionPercentage: inm.porcentajeConstruccion || 0,
      cadastralRevised: inm.catastralRevisado,
      acquisitionDate: inm.fechaAdquisicion || '',
    },
    aeatAmortization: {
      acquisitionType: (
        {
          onerosa: 'onerosa',
          lucrativa: 'lucrativa',
          herencia: 'lucrativa',
          donacion: 'lucrativa',
        } as const
      )[inm.tipoAdquisicion ?? 'onerosa'] ?? 'onerosa',
      firstAcquisitionDate: inm.fechaAdquisicion || '',
      cadastralValue: inm.valorCatastral || 0,
      constructionCadastralValue: inm.valorCatastralConstruccion || 0,
      constructionPercentage: inm.porcentajeConstruccion || 0,
      baseAmortizacion: inm.baseAmortizacion,
      mejorasAnteriores: inm.mejorasAnteriores,
      amortizacionAnualInmueble: inm.amortizacionAnualInmueble,
      onerosoAcquisition: {
        acquisitionAmount: inm.precioAdquisicion || 0,
        acquisitionExpenses: inm.gastosAdquisicion || 0,
      },
    },
    notes: 'Creado desde importación de declaración fiscal',
  };
}

function construirInforme(decl: DeclaracionCompleta, ri: ResultadoInmuebles): InformeDistribucion {
  const inversiones: InversionDetectada[] = [];
  for (const f of decl.gananciasPerdidas?.fondos ?? []) {
    inversiones.push({ tipo: 'fondo', descripcion: `Fondo ${f.nifFondo}`, resultado: f.ganancia });
  }
  for (const c of decl.gananciasPerdidas?.criptomonedas ?? []) {
    inversiones.push({ tipo: 'crypto', descripcion: c.moneda, resultado: c.resultado });
  }

  const perdidasTotal = decl.arrastres.perdidasPatrimoniales.reduce((s, p) => s + p.importePendiente, 0);
  const gastosTotal = decl.arrastres.gastosPendientes.reduce((s, g) => s + g.importePendiente, 0);

  return {
    ejercicio: decl.meta.ejercicio,
    fuente: decl.meta.fuenteImportacion,
    confianza: decl.meta.confianza,
    perfil: {
      nif: decl.declarante.nif,
      nombre: decl.declarante.nombreCompleto,
      ccaa: decl.declarante.nombreCCAA || decl.declarante.codigoCCAA,
      empleador: decl.trabajo?.empleador?.nombre || decl.trabajo?.empleador?.nif,
      actualizado: true,
    },
    resumenFiscal: {
      resultado: decl.resultado.resultadoDeclaracion,
      cuotaIntegra: decl.resultado.cuotaIntegraEstatal + decl.resultado.cuotaIntegraAutonomica,
      retenciones: decl.resultado.totalRetencionesPagos,
      baseLiquidableGeneral: decl.integracion.baseLiquidableGeneral,
      baseLiquidableAhorro: decl.integracion.baseLiquidableAhorro,
      tipoDeclaracion: decl.meta.tipoDeclaracion,
    },
    inmuebles: ri.distribuidos,
    contratosDetectados: ri.contratos,
    gastosRecurrentesPropuestos: ri.gastosRecurrentes,
    prestamosDetectados: ri.prestamos,
    proveedores: ri.proveedores,
    inversiones,
    arrastres: {
      perdidasPendientesTotal: perdidasTotal,
      gastosPendientesTotal: gastosTotal,
      detallePerdidasPorAno: decl.arrastres.perdidasPatrimoniales.map((p) => ({ ano: p.añoOrigen, importe: p.importePendiente })),
      detalleGastosPorInmueble: decl.arrastres.gastosPendientes.map((g) => ({
        ref: g.refCatastral,
        direccionCorta: acortarDireccion(g.refCatastral),
        importe: g.importePendiente,
      })),
    },
    cuentaBancaria: decl.cuentaDevolucion?.iban || decl.cuentaIngreso?.iban,
    trabajo: decl.trabajo ? {
      ingresoBruto: decl.trabajo.totalIngresosIntegros,
      retenciones: decl.trabajo.retenciones,
      tipoRetencion: decl.trabajo.totalIngresosIntegros > 0
        ? Math.round((decl.trabajo.retenciones / decl.trabajo.totalIngresosIntegros) * 10000) / 100
        : 0,
      empleador: decl.trabajo.empleador?.nombre,
    } : undefined,
    actividad: decl.actividadEconomica ? {
      iae: decl.actividadEconomica.iae,
      modalidad: decl.actividadEconomica.modalidad,
      rendimientoNeto: decl.actividadEconomica.rendimientoNeto,
    } : undefined,
    stats: {
      inmueblesCreados: ri.distribuidos.filter((i) => i.accion === 'creado').length,
      inmueblesActualizados: ri.distribuidos.filter((i) => i.accion === 'actualizado').length,
      inmueblesSinCambios: ri.distribuidos.filter((i) => i.accion === 'sin_cambios').length,
      arrastresGuardados: decl.arrastres.gastosPendientes.length + decl.arrastres.perdidasPatrimoniales.length,
      contratosDetectados: ri.contratos.length,
      proveedoresNuevos: ri.proveedores.length,
    },
  };
}

function pushGasto(
  gastosRecurrentes: GastoRecurrentePropuesto[],
  refCatastral: string,
  direccionCorta: string,
  concepto: string,
  importeAnual: number,
): void {
  if (!importeAnual || importeAnual <= 0) return;
  gastosRecurrentes.push({
    refCatastral,
    direccionCorta,
    concepto,
    importeAnual,
    importeMensualEstimado: Math.round((importeAnual / 12) * 100) / 100,
  });
}

function normalizeRef(value?: string | null): string {
  return (value ?? '')
    .replace(/[\s.-]/g, '')
    .trim()
    .toUpperCase();
}

function sumGastosAdquisicion(acquisitionCosts: Property['acquisitionCosts']): number {
  return Number(acquisitionCosts.itp || 0)
    + Number(acquisitionCosts.iva || 0)
    + Number(acquisitionCosts.notary || 0)
    + Number(acquisitionCosts.registry || 0)
    + Number(acquisitionCosts.management || 0)
    + Number(acquisitionCosts.psi || 0)
    + Number(acquisitionCosts.realEstate || 0)
    + Number((acquisitionCosts.other || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
}

export function acortarDireccion(dir: string): string {
  if (!dir) return '';
  return dir
    .replace(/^(CL|CR|AV|PZ|PS|CM)\s+/i, '')
    .replace(/\b0+(\d+)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
