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
import type { Property, EjercicioFiscalCoord, Document, VinculoAccesorio as VinculoAccesorioDB, GastoCategoria } from './db';
import { gastosInmuebleService } from './gastosInmuebleService';
import { invalidateCachedStores } from './indexedDbCacheService';
import type {
  InformeDistribucion,
  InmuebleDistribuido,
  ContratoDetectado,
  GastoRecurrentePropuesto,
  PrestamoDetectado,
  ProveedorDistribuido,
  InversionDetectada,
  VinculoAccesorio,
} from '../types/informeDistribucion';
import type {
  DeclaracionCompleta,
  InmuebleDeclarado,
} from '../types/declaracionCompleta';
import { crearOActualizarContrato, crearContratoPendienteIdentificar } from './declaracionOnboardingService';
import { ejecutarOnboardingPersonal } from './personalOnboardingService';
import type { SituacionLaboral } from '../types/personal';
import { cuentasService } from './cuentasService';
import { prestamosService } from './prestamosService';
import type { Prestamo } from '../types/prestamos';

interface ResultadoInmuebles {
  distribuidos: InmuebleDistribuido[];
  contratos: ContratoDetectado[];
  opexRecurrentes: GastoRecurrentePropuesto[];
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

/** Convert dd/mm/yyyy → YYYY-MM-DD for <input type="date"> */
function toISODate(dateStr: string): string {
  if (!dateStr) return '';
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Already ISO or unknown format — return as-is
  return dateStr;
}

function extraerUbicacion(direccion: string): { province: string; municipality: string; ccaa: string } {
  const dir = direccion.toUpperCase();
  if (dir.includes('OVIEDO')) return { province: 'Asturias', municipality: 'Oviedo', ccaa: 'Asturias' };
  if (dir.includes('GIJON') || dir.includes('GIJÓN')) return { province: 'Asturias', municipality: 'Gijón', ccaa: 'Asturias' };
  if (dir.includes('MANRESA')) return { province: 'Barcelona', municipality: 'Manresa', ccaa: 'Cataluña' };
  if (dir.includes('FRUITOS') || dir.includes('FRUITÓS') || dir.includes('FRUITÒS')) return { province: 'Barcelona', municipality: 'Sant Fruitós de Bages', ccaa: 'Cataluña' };
  if (dir.includes('BARCELONA')) return { province: 'Barcelona', municipality: 'Barcelona', ccaa: 'Cataluña' };
  if (dir.includes('MADRID')) return { province: 'Madrid', municipality: 'Madrid', ccaa: 'Madrid' };
  if (dir.includes('VALENCIA') || dir.includes('VALÈNCIA')) return { province: 'Valencia', municipality: 'Valencia', ccaa: 'Comunidad Valenciana' };
  if (dir.includes('SEVILLA')) return { province: 'Sevilla', municipality: 'Sevilla', ccaa: 'Andalucía' };
  if (dir.includes('MALAGA') || dir.includes('MÁLAGA')) return { province: 'Málaga', municipality: 'Málaga', ccaa: 'Andalucía' };
  if (dir.includes('ZARAGOZA')) return { province: 'Zaragoza', municipality: 'Zaragoza', ccaa: 'Aragón' };
  if (dir.includes('BILBAO')) return { province: 'Vizcaya', municipality: 'Bilbao', ccaa: 'País Vasco' };
  if (dir.includes('ALICANTE')) return { province: 'Alicante', municipality: 'Alicante', ccaa: 'Comunidad Valenciana' };
  // Fallback: último token de la dirección como municipio
  const tokens = direccion.trim().split(/\s+/);
  const lastToken = tokens[tokens.length - 1];
  return { province: '', municipality: lastToken || '', ccaa: '' };
}

export async function distribuirDeclaracion(decl: DeclaracionCompleta): Promise<InformeDistribucion> {
  const db = await initDB();

  await guardarEjercicioFiscal(db, decl);
  await archivarDocumentoImportado(db, decl);

  const resultadoInmuebles = await procesarInmuebles(db, decl);
  invalidateCachedStores(['properties']);

  // Crear/actualizar contratos automáticamente desde los arrendamientos
  const todasProperties = await db.getAll('properties');
  const porRefCatastral = new Map<string, Property>();
  for (const property of todasProperties) {
    const ref = normalizeRef(property.cadastralReference);
    if (ref) porRefCatastral.set(ref, property);
  }

  for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) continue;
    const rc = normalizeRef(inm.refCatastral);
    const property = porRefCatastral.get(rc);
    if (!property?.id) continue;

    for (const arr of inm.arrendamientos) {
      if (arr.nifArrendatarios.length > 0) {
        // CON NIF: comportamiento actual + registrar ejercicio fiscal
        await crearOActualizarContrato({
          propertyId: property.id,
          nifArrendatario: arr.nifArrendatarios[0],
          nifArrendatario2: arr.nifArrendatarios[1],
          fechaContrato: arr.fechaContrato,
          ingresosAnuales: arr.ingresos,
          tipoArrendamiento: arr.tipoArrendamiento,
          tieneReduccion: inm.reduccionVivienda > 0,
          ejercicio: decl.meta.ejercicio,
          // NUEVO: datos para el ejercicio fiscal
          importeDeclarado: arr.ingresos,
          diasDeclarados: arr.diasArrendado,
        });
      } else {
        // SIN NIF: crear contrato sin_identificar
        await crearContratoPendienteIdentificar({
          propertyId: property.id,
          ejercicio: decl.meta.ejercicio,
          importeDeclarado: arr.ingresos,
          dias: arr.diasArrendado ?? 0,
          tipoArrendamiento: arr.tipoArrendamiento === 'no_vivienda' ? 'no_vivienda' : 'vivienda',
          fechaContrato: arr.fechaContrato,
        });
      }
    }
  }
  invalidateCachedStores(['contracts']);

  // Crear/actualizar FiscalSummaries con ingresos y gastos desde la declaración
  await escribirFiscalSummaries(db, decl, porRefCatastral);

  // Escribir mejoras y reparaciones en mejorasActivo
  await escribirMejoras(db, decl, porRefCatastral);

  // Escribir proveedores y operaciones vinculadas
  await escribirProveedores(db, decl, porRefCatastral);

  // Escribir mobiliario activo desde V02MUEB
  await escribirMobiliario(db, decl, porRefCatastral);

  // Persistir el IBAN via cuentasService (localStorage + IndexedDB sync)
  const iban = decl.cuentaDevolucion?.iban || decl.cuentaIngreso?.iban;
  if (iban) {
    try {
      await cuentasService.create({ iban });
    } catch (error) {
      // Ignorar errores esperados de duplicado/validación, pero avisar ante otros
      if (
        error instanceof Error &&
        /already exists|duplicate|duplicado|validation|validación/i.test(error.message)
      ) {
        // Already exists or validation error — ignore
      } else {
        // Loguear errores inesperados para facilitar el diagnóstico
        console.warn('Error inesperado al crear cuenta con IBAN en cuentasService.create:', error);
      }
    }
  }

  // Persistir préstamos detectados al store de préstamos
  await persistirPrestamosDetectados(resultadoInmuebles.prestamos, porRefCatastral, decl.meta.ejercicio);

  // Persistir vínculos accesorio (parking/trastero) al store vinculosAccesorio
  await persistirVinculosAccesorio(db, decl, porRefCatastral);

  // Rellenar perfil personal desde los datos del declarante
  try {
    const d = decl.declarante;

    // Detectar situación laboral desde datos de la declaración
    const situacionLaboral: SituacionLaboral[] = [];
    if (decl.trabajo?.retribucionesDinerarias && decl.trabajo.retribucionesDinerarias > 0) {
      situacionLaboral.push('asalariado');
    }
    if (decl.actividadEconomica) {
      situacionLaboral.push('autonomo');
    }
    if (situacionLaboral.length === 0) situacionLaboral.push('asalariado');

    await ejecutarOnboardingPersonal({
      personal: {
        nif: d.nif,
        nombre: d.nombreCompleto,
        fechaNacimiento: d.fechaNacimiento,
        estadoCivil: d.estadoCivil,
        comunidadAutonoma: d.codigoCCAA || d.nombreCCAA,
        tributacion: d.tributacion,
        situacionLaboral,
      },
      trabajo: {} as any,
      inmuebles: [],
      actividades: [],
      capitalMobiliario: {} as any,
      gananciasPerdidas: {} as any,
      planPensiones: {} as any,
      basesYCuotas: {} as any,
    });
  } catch (err) {
    console.warn('Error al aplicar datos personales desde declaración:', err);
  }

  // GAP-3: Detectar si el año ya tiene cierre ATLAS para abrir ValidacionXMLDrawer en la UI
  const informe = construirInforme(decl, resultadoInmuebles);
  try {
    const ejercicioExistente = await db.get('ejerciciosFiscales', decl.meta.ejercicio);
    if (ejercicioExistente?.estado === 'cerrado' && ejercicioExistente?.cierreAtlasMetadata) {
      // El año ya tiene cierre ATLAS — la UI abrirá ValidacionXMLDrawer
      informe.requiereValidacionXML = true;
      informe.ejercicioConCierreAtlas = decl.meta.ejercicio;
    } else if (ejercicioExistente && ejercicioExistente.estado !== 'declarado') {
      // No tiene cierre ATLAS previo — marcar directamente como declarado
      await db.put('ejerciciosFiscales', {
        ...ejercicioExistente,
        estado: 'declarado' as const,
        declaradoAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('GAP-3: Error al verificar estado de ejercicio tras importar XML:', err);
  }

  return informe;
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
    fuenteImportacion: decl.meta.fuenteImportacion,
    declaracionCompleta: decl,
  };

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
  const opexRecurrentes: GastoRecurrentePropuesto[] = [];
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
        next.purchaseDate = toISODate(inm.fechaAdquisicion);
        camposNuevos.push('Fecha de compra');
        modificado = true;
      }
      if (!next.province && inm.direccion) {
        const ubicacion = extraerUbicacion(inm.direccion);
        if (ubicacion.province) {
          next.province = ubicacion.province;
          next.municipality = ubicacion.municipality;
          next.ccaa = ubicacion.ccaa;
          camposNuevos.push('Ubicación');
          modificado = true;
        }
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
        next.fiscalData.acquisitionDate = toISODate(inm.fechaAdquisicion);
        camposNuevos.push('Fecha adquisición');
        modificado = true;
      }
      if (!next.acquisitionCosts.price && inm.precioAdquisicion) {
        next.acquisitionCosts.price = inm.precioAdquisicion;
        camposNuevos.push('Precio adquisición');
        modificado = true;
      }
      // AEAT gastosAdquisicion already includes ITP+notaría+registro+gestoría as a single total.
      // Always clear any auto-calculated ITP to avoid double-counting, even on re-import.
      if (next.acquisitionCosts.itp) {
        delete next.acquisitionCosts.itp;
        delete next.acquisitionCosts.itpIsManual;
        modificado = true;
      }
      if (!sumGastosAdquisicion(next.acquisitionCosts) && inm.gastosAdquisicion) {
        delete next.acquisitionCosts.notary;
        delete next.acquisitionCosts.registry;
        delete next.acquisitionCosts.management;
        next.acquisitionCosts.other = [{ concept: 'Gastos adquisición AEAT', amount: inm.gastosAdquisicion }];
        camposNuevos.push('Gastos adquisición');
        modificado = true;
      }

      // Enriquecer campos de amortización AEAT solo si están vacíos
      if (next.aeatAmortization) {
        const amort = { ...next.aeatAmortization };
        let amortModificado = false;
        if (!amort.firstAcquisitionDate && inm.fechaAdquisicion) {
          amort.firstAcquisitionDate = toISODate(inm.fechaAdquisicion);
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

    pushGasto(opexRecurrentes, rc, dirCorta, 'Comunidad', inm.gastos.comunidad);
    pushGasto(opexRecurrentes, rc, dirCorta, 'Seguros', inm.gastos.seguros);
    pushGasto(opexRecurrentes, rc, dirCorta, 'IBI y tasas', inm.gastos.ibiTasas);
    pushGasto(opexRecurrentes, rc, dirCorta, 'Suministros', inm.gastos.suministros);
    pushGasto(opexRecurrentes, rc, dirCorta, 'Gestión delegada', inm.gastos.serviciosTerceros);

    if (inm.gastos.interesesFinanciacion > 0) {
      prestamos.push({ refCatastral: rc, direccionCorta: dirCorta, interesesAnuales: inm.gastos.interesesFinanciacion });
    }

    for (const prov of inm.proveedores) {
      proveedores.push({ nif: prov.nif, concepto: prov.concepto, importe: prov.importe, inmuebleRef: rc });
    }
  }

  // ── Segundo paso: enriquecer accesorios con datos del principal ──
  // Los datos de adquisición del accesorio están en inm.accesorio del principal,
  // no en el InmuebleDeclarado standalone del accesorio.
  for (const inm of decl.inmuebles) {
    if (!inm.accesorio) continue;

    const rcAccesorio = normalizeRef(inm.accesorio.refCatastral);
    if (!rcAccesorio) continue;

    const propAccesorio = porRefCatastral.get(rcAccesorio);
    if (!propAccesorio) continue;

    let modificado = false;
    const next = {
      ...propAccesorio,
      acquisitionCosts: { ...(propAccesorio.acquisitionCosts || { price: 0 }) },
      fiscalData: { ...(propAccesorio.fiscalData || {}) },
    };

    if (!next.purchaseDate && inm.accesorio.fechaAdquisicion) {
      next.purchaseDate = toISODate(inm.accesorio.fechaAdquisicion);
      modificado = true;
    }
    if (!next.acquisitionCosts.price && inm.accesorio.precioAdquisicion) {
      next.acquisitionCosts.price = inm.accesorio.precioAdquisicion;
      next.acquisitionCosts.other = inm.accesorio.gastosAdquisicion
        ? [{ concept: 'Gastos adquisición AEAT', amount: inm.accesorio.gastosAdquisicion }]
        : [];
      modificado = true;
    }
    if (!next.fiscalData.cadastralValue && inm.accesorio.valorCatastral) {
      next.fiscalData.cadastralValue = inm.accesorio.valorCatastral;
      next.fiscalData.constructionCadastralValue = inm.accesorio.valorCatastralConstruccion || 0;
      next.fiscalData.constructionPercentage = inm.accesorio.porcentajeConstruccion || 0;
      modificado = true;
    }

    if (modificado) {
      await db.put('properties', next);
      // Update the map so subsequent logic sees enriched data
      porRefCatastral.set(rcAccesorio, next);
    }
  }

  return { distribuidos, contratos, opexRecurrentes, prestamos, proveedores };
}

/**
 * Persiste préstamos detectados desde la declaración XML al store de préstamos.
 * Deduplicación estricta: un préstamo por inmueble (por refCatastral o alias/direccionCorta).
 */
async function persistirPrestamosDetectados(
  prestamosDetectados: PrestamoDetectado[],
  porRefCatastral: Map<string, Property>,
  ejercicio: number,
): Promise<void> {
  if (prestamosDetectados.length === 0) return;

  const todosLosPrestamos = await prestamosService.getAllPrestamos();

  for (const det of prestamosDetectados) {
    // Buscar el inmuebleId real desde properties por refCatastral
    const property = porRefCatastral.get(normalizeRef(det.refCatastral));
    const inmuebleId = property?.id?.toString() ?? det.refCatastral;
    const alias = det.direccionCorta || det.refCatastral;

    // Buscar préstamo existente para este inmueble (por inmuebleId o por nombre/alias)
    const existente = todosLosPrestamos.find(
      (p) =>
        p.inmuebleId === inmuebleId ||
        p.nombre === alias,
    );

    if (existente) {
      // Solo actualizar interesesAnualesDeclarados añadiendo el año correspondiente
      const interesesActualizados: Record<number, number> = {
        ...(existente.interesesAnualesDeclarados || {}),
        [ejercicio]: det.interesesAnuales,
      };
      await prestamosService.updatePrestamo(existente.id, {
        interesesAnualesDeclarados: interesesActualizados,
      });
      console.log(`[distribuidor] Préstamo existente actualizado para ${alias}: intereses ${ejercicio} = €${det.interesesAnuales}`);
    } else {
      // Crear préstamo pendiente de completar
      const nuevoPrestamo: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
        ambito: 'INMUEBLE',
        inmuebleId,
        nombre: alias,
        principalInicial: 0,
        principalVivo: 0,
        fechaFirma: '',
        fechaPrimerCargo: '',
        plazoMesesTotal: 0,
        diaCargoMes: 1,
        esquemaPrimerRecibo: 'NORMAL',
        tipo: 'FIJO',
        sistema: 'FRANCES',
        carencia: 'NINGUNA',
        cuentaCargoId: '',
        cuotasPagadas: 0,
        estado: 'pendiente_completar',
        origenCreacion: 'IMPORTACION',
        activo: true,
        interesesAnualesDeclarados: { [ejercicio]: det.interesesAnuales },
      };
      await prestamosService.createPrestamo(nuevoPrestamo);
      console.log(`[distribuidor] Préstamo creado (pendiente_completar) para ${alias}: intereses ${ejercicio} = €${det.interesesAnuales}`);
    }
  }
}

function construirPropertyDesdeDeclaracion(inm: InmuebleDeclarado): Omit<Property, 'id'> {
  const ubicacion = extraerUbicacion(inm.direccion || '');
  return {
    alias: acortarDireccion(inm.direccion) || inm.refCatastral,
    address: inm.direccion || inm.refCatastral,
    postalCode: '',
    province: ubicacion.province,
    municipality: ubicacion.municipality,
    ccaa: ubicacion.ccaa,
    purchaseDate: toISODate(inm.fechaAdquisicion || ''),
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
      acquisitionDate: toISODate(inm.fechaAdquisicion || ''),
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
      firstAcquisitionDate: toISODate(inm.fechaAdquisicion || ''),
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

async function persistirVinculosAccesorio(
  db: DB,
  decl: DeclaracionCompleta,
  porRefCatastral: Map<string, Property>,
): Promise<void> {
  const ejercicio = decl.meta.ejercicio;
  const ahora = new Date().toISOString();

  for (const inm of decl.inmuebles) {
    if (!inm.esAccesorioDe) continue;

    const refAcc = normalizeRef(inm.refCatastral);
    const refPrincipal = normalizeRef(inm.esAccesorioDe);
    if (!refAcc || !refPrincipal) continue;

    const propAccesorio = porRefCatastral.get(refAcc);
    const propPrincipal = porRefCatastral.get(refPrincipal);
    if (!propAccesorio?.id || !propPrincipal?.id) continue;

    // Deduplicación: buscar por índice compuesto [principal, accesorio, ejercicio]
    const existente = await db.getFromIndex(
      'vinculosAccesorio',
      'principal-accesorio-ejercicio',
      [propPrincipal.id, propAccesorio.id, ejercicio],
    );
    if (existente) continue;

    const origenCreacion =
      decl.meta.fuenteImportacion === 'xml' ? 'XML' : 'manual';

    const vinculo: VinculoAccesorioDB = {
      inmueblePrincipalId: propPrincipal.id,
      inmuebleAccesorioId: propAccesorio.id,
      ejercicio,
      fechaInicio: `${ejercicio}-01-01`,
      estado: 'activo',
      origenCreacion,
      createdAt: ahora,
      updatedAt: ahora,
    };
    try {
      await db.add('vinculosAccesorio', vinculo);
    } catch (error) {
      // Si otra ejecución concurrente ya insertó este vínculo y existe un índice único,
      // ignoramos el ConstraintError para que la importación no falle por un duplicado benigno.
      if (!(error && (error as any).name === 'ConstraintError')) {
        throw error;
      }
    }
  }
}

function construirInforme(decl: DeclaracionCompleta, ri: ResultadoInmuebles): InformeDistribucion {
  const inversiones: InversionDetectada[] = [];
  for (const f of decl.gananciasPerdidas?.fondos ?? []) {
    inversiones.push({ tipo: 'fondo', descripcion: `Fondo ${f.nifFondo}`, resultado: f.ganancia });
  }
  for (const c of decl.gananciasPerdidas?.criptomonedas ?? []) {
    inversiones.push({ tipo: 'crypto', descripcion: c.moneda, resultado: c.resultado });
  }

  const vinculosAccesorio: VinculoAccesorio[] = [];
  for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) {
      const principal = decl.inmuebles.find(
        (p) => normalizeRef(p.refCatastral) === normalizeRef(inm.esAccesorioDe),
      );
      vinculosAccesorio.push({
        refAccesorio: inm.refCatastral,
        direccionAccesorio: acortarDireccion(inm.direccion) || inm.refCatastral,
        refPrincipal: inm.esAccesorioDe,
        direccionPrincipal: principal ? (acortarDireccion(principal.direccion) || principal.refCatastral) : inm.esAccesorioDe,
      });
    }
  }

  const perdidasTotal = decl.arrastres.perdidasPatrimoniales.reduce((s, p) => s + p.importePendiente, 0);
  const gastosTotal = decl.arrastres.gastosPendientes.reduce((s, g) => s + g.importePendiente, 0);

  const iban = decl.cuentaDevolucion?.iban || decl.cuentaIngreso?.iban;

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
    opexRecurrentesPropuestos: ri.opexRecurrentes,
    prestamosDetectados: ri.prestamos,
    proveedores: ri.proveedores,
    inversiones,
    vinculosAccesorio,
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
    cuentaBancaria: iban,
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
  opexRecurrentes: GastoRecurrentePropuesto[],
  refCatastral: string,
  direccionCorta: string,
  concepto: string,
  importeAnual: number,
): void {
  if (!importeAnual || importeAnual <= 0) return;
  opexRecurrentes.push({
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

async function escribirFiscalSummaries(
  _db: DB,
  decl: DeclaracionCompleta,
  porRefCatastral: Map<string, Property>,
): Promise<void> {
  // Write only to gastosInmueble — fiscalSummaries store no longer used
  for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) continue;

    const rc = normalizeRef(inm.refCatastral);
    const property = porRefCatastral.get(rc);
    if (!property?.id) continue;

    // ── Write to gastosInmueble con origen xml_aeat ──
    const GASTOS_DECL: { campo: keyof typeof inm.gastos; casilla: string; categoria: GastoCategoria }[] = [
      { campo: 'interesesFinanciacion', casilla: '0105', categoria: 'intereses' },
      { campo: 'reparacionConservacion', casilla: '0106', categoria: 'reparacion' },
      { campo: 'comunidad', casilla: '0109', categoria: 'comunidad' },
      { campo: 'serviciosTerceros', casilla: '0112', categoria: 'gestion' },
      { campo: 'suministros', casilla: '0113', categoria: 'suministro' },
      { campo: 'seguros', casilla: '0114', categoria: 'seguro' },
      { campo: 'ibiTasas', casilla: '0115', categoria: 'ibi' },
      { campo: 'amortizacionMobiliario', casilla: '0117', categoria: 'otro' },
    ];
    for (const { campo, casilla, categoria } of GASTOS_DECL) {
      const importe = (inm.gastos as any)[campo] || 0;
      if (importe <= 0) continue;
      await gastosInmuebleService.add({
        inmuebleId: property.id,
        ejercicio: decl.meta.ejercicio,
        fecha: `${decl.meta.ejercicio}-12-31`,
        concepto: `Declaración AEAT ${decl.meta.ejercicio}`,
        categoria,
        casillaAEAT: casilla as any,
        importe,
        origen: 'xml_aeat',
        origenId: `${property.id}-${decl.meta.ejercicio}-${casilla}`,
        estado: 'declarado',
        proveedorNIF: 'AEAT',
        proveedorNombre: 'Declaración AEAT',
      });
    }
  }
}

async function escribirMejoras(
  db: DB,
  decl: DeclaracionCompleta,
  porRefCatastral: Map<string, Property>,
): Promise<void> {
  for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) continue;

    const rc = normalizeRef(inm.refCatastral);
    const property = porRefCatastral.get(rc);
    if (!property?.id) continue;

    const { mejorasInmuebleService } = await import('./mejorasInmuebleService');
    const existentes = await mejorasInmuebleService.getPorInmueble(property.id);

    // 1. Mejoras del ejercicio
    for (const mejora of inm.mejorasEjercicio) {
      if (mejora.importe <= 0) continue;
      const nifProv = mejora.nifProveedor || '';
      const duplicada = existentes.find(m =>
        m.ejercicio === decl.meta.ejercicio && m.tipo === 'mejora' &&
        Math.abs(m.importe - mejora.importe) < 1 && (m.proveedorNIF || '') === nifProv
      );
      if (duplicada) continue;
      await mejorasInmuebleService.crear({
        inmuebleId: property.id, ejercicio: decl.meta.ejercicio, tipo: 'mejora',
        importe: mejora.importe, descripcion: `Mejora declarada IRPF ${decl.meta.ejercicio}`,
        fecha: mejora.fecha ? toISODate(mejora.fecha) : `${decl.meta.ejercicio}-12-31`,
        proveedorNIF: nifProv,
      });
    }

    // 2. Mejoras anteriores acumuladas (reparaciones van a gastosInmueble via escribirFiscalSummaries)
    if (inm.mejorasAnteriores && inm.mejorasAnteriores > 0) {
      const tieneAnteriores = existentes.some(m => m.tipo !== 'reparacion' && m.ejercicio < decl.meta.ejercicio);
      if (!tieneAnteriores) {
        await mejorasInmuebleService.crear({
          inmuebleId: property.id, ejercicio: decl.meta.ejercicio - 1, tipo: 'mejora',
          importe: inm.mejorasAnteriores,
          descripcion: `Mejoras anteriores acumuladas declaradas en IRPF ${decl.meta.ejercicio}`,
          fecha: `${decl.meta.ejercicio - 1}-12-31`, proveedorNIF: '',
        });
      }
    }
  }
}

function normalizeNif(nif: string): string {
  return nif.trim().toUpperCase().replace(/\s+/g, '');
}

async function escribirProveedores(
  db: DB,
  decl: DeclaracionCompleta,
  porRefCatastral: Map<string, Property>,
): Promise<void> {
  const ahora = new Date().toISOString();
  const ejercicio = decl.meta.ejercicio;

  for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) continue;

    const rc = normalizeRef(inm.refCatastral);
    const property = porRefCatastral.get(rc);
    if (!property?.id) continue;

    // Collect all providers: from mejoras, proveedores array, and arrendamiento-level proveedores
    type ProvEntry = { nif: string; tipo: 'mejora' | 'reparacion' | 'gestion' | 'servicios'; importe: number };
    const rawProvs: ProvEntry[] = [];

    // Mejoras con NIF (NIFMJ1..5)
    for (const mejora of inm.mejorasEjercicio) {
      if (mejora.nifProveedor && mejora.importe > 0) {
        rawProvs.push({ nif: normalizeNif(mejora.nifProveedor), tipo: 'mejora', importe: mejora.importe });
      }
    }

    // Proveedores directos del inmueble (InfAnexoD: GRCNIF, MRINIF, CSPNIF)
    for (const prov of inm.proveedores) {
      if (!prov.nif || prov.importe <= 0) continue;
      const tipo = prov.concepto === 'otro' ? 'servicios' : prov.concepto;
      rawProvs.push({ nif: normalizeNif(prov.nif), tipo, importe: prov.importe });
    }

    // Proveedores dentro de arrendamientos (NIF1GCEM0, NIF1V02SERV)
    for (const arr of inm.arrendamientos) {
      if (!arr.proveedores) continue;
      for (const prov of arr.proveedores) {
        if (!prov.nif || prov.importe <= 0) continue;
        const tipo = prov.concepto === 'otro' ? 'servicios' : prov.concepto;
        rawProvs.push({ nif: normalizeNif(prov.nif), tipo, importe: prov.importe });
      }
    }

    // Aggregate by (nif, tipo) summing importes to avoid under-counting
    const grouped = new Map<string, ProvEntry>();
    for (const p of rawProvs) {
      const key = `${p.nif}|${p.tipo}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.importe += p.importe;
      } else {
        grouped.set(key, { ...p });
      }
    }

    for (const p of grouped.values()) {
      // 1. Upsert proveedor entity
      const existing = await db.get('proveedores', p.nif);
      if (existing) {
        if (!existing.tipos.includes(p.tipo)) {
          existing.tipos.push(p.tipo);
          existing.updatedAt = ahora;
          await db.put('proveedores', existing);
        }
      } else {
        await db.add('proveedores', {
          nif: p.nif,
          tipos: [p.tipo],
          createdAt: ahora,
          updatedAt: ahora,
        });
      }

      // 2. Create operation if not duplicate (unique index enforces this too)
      try {
        await db.add('operacionesProveedor', {
          proveedorNif: p.nif,
          inmuebleId: property.id!,
          ejercicio,
          tipo: p.tipo,
          importe: p.importe,
          createdAt: ahora,
        });
      } catch (_e) {
        // Unique index constraint — operation already exists, skip
      }
    }
  }
  invalidateCachedStores(['proveedores', 'operacionesProveedor']);
}

async function escribirMobiliario(
  _db: DB,
  decl: DeclaracionCompleta,
  porRefCatastral: Map<string, Property>,
): Promise<void> {
  const ejercicio = decl.meta.ejercicio;

  for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) continue;

    // V02MUEB is the annual amortization of furniture (10% of cost)
    const amortMob = inm.gastos.amortizacionMobiliario;
    if (!amortMob || amortMob <= 0) continue;

    const rc = normalizeRef(inm.refCatastral);
    const property = porRefCatastral.get(rc);
    if (!property?.id) continue;

    // Get existing mobiliario from unified store
    const { mueblesInmuebleService } = await import('./mueblesInmuebleService');
    const existentes = await mueblesInmuebleService.getPorInmueble(property.id);

    const amortExistente = existentes
      .filter(m => m.activo)
      .reduce((sum, m) => sum + (m.importe / (m.vidaUtil || 10)), 0);

    const delta = amortMob - amortExistente;

    if (delta > 0.5) {
      const duplicada = existentes.find(m =>
        m.ejercicio === ejercicio && Math.abs(m.importe - delta * 10) < 1
      );
      if (!duplicada) {
        await mueblesInmuebleService.crear({
          inmuebleId: property.id, ejercicio,
          descripcion: `Mobiliario detectado IRPF ${ejercicio}`,
          fechaAlta: `${ejercicio}-01-01`,
          importe: Math.round(delta * 10 * 100) / 100,
          vidaUtil: 10, activo: true,
        });
      }
    }
  }
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
