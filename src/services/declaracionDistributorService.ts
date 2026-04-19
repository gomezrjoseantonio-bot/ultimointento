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
import { CCAA_LIST } from '../utils/locationUtils';
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
import { crearContratoPendienteIdentificar } from './declaracionOnboardingService';
import { ejecutarOnboardingPersonal } from './personalOnboardingService';
import type { SituacionLaboral } from '../types/personal';
import { cuentasService } from './cuentasService';

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

/**
 * Tipos de ITP por CCAA para transmisión onerosa de vivienda usada.
 *
 * Fuente única de verdad: `CCAA_LIST` en `src/utils/locationUtils.ts`
 * (también consumido por el formulario de inmueble). Aquí solo añadimos
 * un alias para mapear el nombre que devuelve `extraerUbicacion`
 * ('Comunidad Valenciana') al canónico de CCAA_LIST ('Valencia').
 *
 * IMPORTANTE: el ITP inferido se DESCUENTA del total AEAT (C_TRIBUAD),
 * nunca se suma. El total de coste de adquisición es invariante.
 */
const CCAA_ALIAS_PARA_ITP: Record<string, string> = {
  'Comunidad Valenciana': 'Valencia',
};

export function inferirITP(precio: number, ccaa: string | undefined): number {
  if (!ccaa || precio <= 0) return 0;
  const canonical = CCAA_ALIAS_PARA_ITP[ccaa] ?? ccaa;
  const ccaaData = CCAA_LIST.find(
    c => c.name.toLowerCase() === canonical.toLowerCase(),
  );
  // CCAA desconocida → no inferir (no caer al default del 8% del helper).
  if (!ccaaData) return 0;
  return Math.round(precio * (ccaaData.itpRate / 100) * 100) / 100;
}

/**
 * F5: Extrae el código postal de 5 dígitos de una dirección AEAT.
 * Formato típico: "CL FUERTES ACEVEDO 32 1 2 DR 33006 OVIEDO (ASTURIAS)"
 *
 * En las direcciones AEAT el CP aparece justo antes del municipio (al final),
 * pero a veces hay otros números de 5 dígitos antes (bloque, ref. interna).
 * Estrategia: recoger TODOS los grupos de 5 dígitos y quedarse con el último
 * que caiga en el rango de CP español (01000–52999).
 */
function extraerCodigoPostal(direccion: string): string {
  if (!direccion) return '';
  const matches = direccion.match(/\b\d{5}\b/g);
  if (!matches || matches.length === 0) return '';

  const esCpEspañol = (cp: string) => {
    const n = parseInt(cp, 10);
    return n >= 1000 && n <= 52999;
  };

  for (let i = matches.length - 1; i >= 0; i--) {
    if (esCpEspañol(matches[i])) return matches[i];
  }
  return '';
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

  reportarArrastresRecibidos(decl);

  await guardarEjercicioFiscal(db, decl);
  await archivarDocumentoImportado(db, decl);

  const resultadoInmuebles = await procesarInmuebles(db, decl);
  invalidateCachedStores(['properties']);

  // Crear/actualizar contratos automáticamente desde los arrendamientos
  const todasProperties = await db.getAll('properties');
  const porRefCatastral = new Map<string, Property>();
  const porDireccionNorm = new Map<string, Property>();
  const direccionesConflictivas = new Set<string>();
  const registrarDireccionNormalizada = (clave: string | undefined, property: Property) => {
    if (!clave || direccionesConflictivas.has(clave)) return;
    const existente = porDireccionNorm.get(clave);
    if (!existente) {
      porDireccionNorm.set(clave, property);
      return;
    }
    if (existente.id !== property.id) {
      porDireccionNorm.delete(clave);
      direccionesConflictivas.add(clave);
    }
  };
  for (const property of todasProperties) {
    const ref = normalizeRef(property.cadastralReference);
    if (ref) {
      porRefCatastral.set(ref, property);
      continue;
    }
    // Solo properties sin RC se indexan por dirección: evita que un RC del XML
    // se empareje con una property ya vinculada a otro RC distinto.
    const dirN = normalizeDireccion(property.address);
    registrarDireccionNormalizada(dirN, property);
    const aliasN = normalizeDireccion(property.alias);
    if (aliasN && aliasN !== dirN) registrarDireccionNormalizada(aliasN, property);
  }
  // Fallback por dirección: para cada inmueble del XML cuya refCatastral no
  // esté ya resuelta, buscar la property por dirección normalizada y registrarla
  // bajo su refCatastral. Evita que escribirMejoras/Proveedores/FiscalSummaries
  // pierdan datos cuando la property no tiene cadastralReference poblada.
  // Persiste la vinculación (db.put) para que futuras importaciones resuelvan
  // directamente por RC.
  for (const inm of decl.inmuebles) {
    const rc = normalizeRef(inm.refCatastral);
    if (!rc || porRefCatastral.has(rc) || !inm.direccion) continue;
    const dirXml = normalizeDireccion(inm.direccion);
    const aliasXml = normalizeDireccion(acortarDireccion(inm.direccion));
    const match = porDireccionNorm.get(dirXml) || porDireccionNorm.get(aliasXml);
    if (!match) continue;

    const matchRc = normalizeRef(match.cadastralReference);
    if (matchRc && matchRc !== rc) {
      // Defensa en profundidad: aunque el indexado arriba ya excluye properties
      // con RC, evita vincular si la property estuviera marcada con otro RC.
      console.warn(
        `[distribuidor] Fallback dirección ignorado: XML rc=${rc} pero property id=${match.id} ya está vinculada a rc=${matchRc} (${match.alias})`
      );
      continue;
    }

    let propertyForRc = match;
    if (!matchRc) {
      propertyForRc = { ...match, cadastralReference: rc };
      await db.put('properties', propertyForRc);
      const dirN = normalizeDireccion(propertyForRc.address);
      if (dirN) porDireccionNorm.set(dirN, propertyForRc);
      const aliasN = normalizeDireccion(propertyForRc.alias);
      if (aliasN && aliasN !== dirN) porDireccionNorm.set(aliasN, propertyForRc);
    }

    porRefCatastral.set(rc, propertyForRc);
    console.log(`[distribuidor] Fallback dirección: ${rc} → property id=${propertyForRc.id} (${propertyForRc.alias})`);
  }

  for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) continue;
    const rc = normalizeRef(inm.refCatastral);
    const property = porRefCatastral.get(rc);
    if (!property?.id) continue;

    for (const arr of inm.arrendamientos) {
      // F1: Todos los arrendamientos van a sin_identificar.
      // Los NIFs del XML se guardan como metadato para sugerir al vincular.
      await crearContratoPendienteIdentificar({
        propertyId: property.id,
        ejercicio: decl.meta.ejercicio,
        importeDeclarado: arr.ingresos,
        dias: arr.diasArrendado ?? 0,
        tipoArrendamiento: arr.tipoArrendamiento === 'no_vivienda' ? 'no_vivienda' : 'vivienda',
        fechaContrato: arr.fechaContrato,
        nifsDetectados: (arr.nifArrendatarios ?? []).filter(n => n && n.trim().length > 0),
      });
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

  // Persistir plan de pensiones en planesPensionInversion
  try {
    await persistirPlanPensiones(db, decl, decl.meta.ejercicio);
  } catch (err) {
    console.warn('Error al persistir plan de pensiones:', err);
  }

  // Persistir fondos y criptomonedas en inversiones
  try {
    await persistirInversionesDeclaradas(db, decl, decl.meta.ejercicio);
  } catch (err) {
    console.warn('Error al persistir inversiones declaradas:', err);
  }

  // GAP-3: Detectar si el año ya tiene cierre ATLAS para abrir ValidacionXMLDrawer en la UI
  const informe = construirInforme(decl, resultadoInmuebles);
  try {
    const ejercicioExistente = await db.get('ejerciciosFiscalesCoord', decl.meta.ejercicio);
    if (ejercicioExistente?.estado === 'cerrado' && ejercicioExistente?.cierreAtlasMetadata) {
      // El año ya tiene cierre ATLAS — la UI abrirá ValidacionXMLDrawer
      informe.requiereValidacionXML = true;
      informe.ejercicioConCierreAtlas = decl.meta.ejercicio;
    } else if (ejercicioExistente && ejercicioExistente.estado !== 'declarado') {
      // No tiene cierre ATLAS previo — marcar directamente como declarado
      await db.put('ejerciciosFiscalesCoord', {
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
      cuotaLiquidaEstatal: decl.resultado.cuotaLiquidaEstatal,
      cuotaLiquidaAutonomica: decl.resultado.cuotaLiquidaAutonomica,
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
      // BUG-2: el arrastre generado (C_INTGRCEF) es el exceso no aplicado,
      // que en el Modelo 100 vive en la casilla 0108, no en la 0106.
      casilla: '0108',
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
  const porDireccionNorm = new Map<string, Property>();
  for (const property of todasProperties) {
    const ref = normalizeRef(property.cadastralReference);
    if (ref) {
      porRefCatastral.set(ref, property);
    } else {
      // Properties without cadastral ref: index by normalized address and alias
      const dirN = normalizeDireccion(property.address);
      if (dirN) porDireccionNorm.set(dirN, property);
      const aliasN = normalizeDireccion(property.alias);
      if (aliasN && aliasN !== dirN) porDireccionNorm.set(aliasN, property);
    }
  }

  for (const inm of decl.inmuebles) {
    const rc = normalizeRef(inm.refCatastral);
    if (!rc) continue;

    const dirCorta = acortarDireccion(inm.direccion);
    let existente = porRefCatastral.get(rc);

    // Fallback: match by normalized address/alias when cadastral ref not found
    if (!existente && inm.direccion) {
      const dirXml = normalizeDireccion(inm.direccion);
      const aliasXml = normalizeDireccion(acortarDireccion(inm.direccion));
      existente = porDireccionNorm.get(dirXml)
        || porDireccionNorm.get(aliasXml)
        || undefined;
      if (existente) {
        // Register in cadastral map so subsequent lookups and downstream
        // functions (escribirFiscalSummaries, etc.) find the right property
        porRefCatastral.set(rc, existente);
        // Remove from address map to prevent double-matching
        porDireccionNorm.delete(normalizeDireccion(existente.address));
        porDireccionNorm.delete(normalizeDireccion(existente.alias));
        console.log(`[distribuidor] Inmueble ${rc} vinculado por dirección a property id=${existente.id} (${existente.alias})`);
      }
    }

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

      // Enrich cadastral reference if missing (e.g., manually-created property matched by address)
      if (!next.cadastralReference && rc) {
        next.cadastralReference = rc;
        camposNuevos.push('Ref. catastral');
        modificado = true;
      }

      if (!next.purchaseDate && inm.fechaAdquisicion) {
        next.purchaseDate = toISODate(inm.fechaAdquisicion);
        camposNuevos.push('Fecha de compra');
        modificado = true;
      }
      // F5: Ubicación SIEMPRE se re-extrae del XML (sobreescribe con el más reciente)
      if (inm.direccion) {
        const ubicacion = extraerUbicacion(inm.direccion);
        const cp = extraerCodigoPostal(inm.direccion);
        if (ubicacion.province && next.province !== ubicacion.province) {
          next.province = ubicacion.province;
          camposNuevos.push('Provincia');
          modificado = true;
        }
        if (ubicacion.municipality && next.municipality !== ubicacion.municipality) {
          next.municipality = ubicacion.municipality;
          camposNuevos.push('Municipio');
          modificado = true;
        }
        if (ubicacion.ccaa && next.ccaa !== ubicacion.ccaa) {
          next.ccaa = ubicacion.ccaa;
          modificado = true;
        }
        if (cp && next.postalCode !== cp) {
          next.postalCode = cp;
          camposNuevos.push('Código postal');
          modificado = true;
        }
      }
      // F5: Datos catastrales SIEMPRE se actualizan si el XML trae datos
      if (inm.valorCatastral && inm.valorCatastral > 0 && next.fiscalData.cadastralValue !== inm.valorCatastral) {
        next.fiscalData.cadastralValue = inm.valorCatastral;
        if (next.aeatAmortization) next.aeatAmortization.cadastralValue = inm.valorCatastral;
        camposNuevos.push('Valor catastral');
        modificado = true;
      }
      if (inm.valorCatastralConstruccion && inm.valorCatastralConstruccion > 0 && next.fiscalData.constructionCadastralValue !== inm.valorCatastralConstruccion) {
        next.fiscalData.constructionCadastralValue = inm.valorCatastralConstruccion;
        if (next.aeatAmortization) next.aeatAmortization.constructionCadastralValue = inm.valorCatastralConstruccion;
        camposNuevos.push('VC construcción');
        modificado = true;
      }
      if (inm.porcentajeConstruccion && inm.porcentajeConstruccion > 0 && next.fiscalData.constructionPercentage !== inm.porcentajeConstruccion) {
        next.fiscalData.constructionPercentage = inm.porcentajeConstruccion;
        if (next.aeatAmortization) next.aeatAmortization.constructionPercentage = inm.porcentajeConstruccion;
        camposNuevos.push('% construcción');
        modificado = true;
      }
      if (inm.catastralRevisado !== undefined && next.fiscalData.cadastralRevised !== inm.catastralRevisado) {
        next.fiscalData.cadastralRevised = inm.catastralRevisado;
        modificado = true;
      }
      // F5: Campos nuevos: % propiedad y urbana
      if (inm.porcentajePropiedad > 0 && next.porcentajePropiedad !== inm.porcentajePropiedad) {
        next.porcentajePropiedad = inm.porcentajePropiedad;
        camposNuevos.push('% propiedad');
        modificado = true;
      }
      if (inm.esUrbana !== undefined && next.esUrbana !== inm.esUrbana) {
        next.esUrbana = inm.esUrbana;
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
      // --- ITP y gastos de adquisición ---
      // Reglas de decisión al re-importar:
      //  1. Edición manual del usuario (itpIsManual === true) → no tocar.
      //  2. Si el desglose actual cuadra con el total AEAT (±1€) → no tocar.
      //  3. Si no cuadra → re-inferir ITP (si usada + CCAA) o meter todo en Otros.
      if (next.acquisitionCosts.itpIsManual) {
        // El usuario decidió el desglose. Sagrado.
      } else {
        // sumGastosAdquisicion ya excluye `price`: suma itp + iva + notary +
        // registry + management + psi + realEstate + other. Ese es el total
        // de gastos a comparar contra C_TRIBUAD (inm.gastosAdquisicion).
        const sumaActual = sumGastosAdquisicion(next.acquisitionCosts);
        const totalAEAT = inm.gastosAdquisicion || 0;

        // Detectar cubo legacy: TODO agregado en `other` con el concept marker
        // 'Gastos adquisición AEAT', sin importes concretos en el resto de
        // campos. Este patrón viene de imports antes del fix de inferencia y
        // se debe re-procesar aunque la suma cuadre con AEAT.
        const ac = next.acquisitionCosts;
        const otherEntries = ac.other ?? [];
        const tieneOtrosCampos =
          (ac.itp ?? 0) > 0 ||
          (ac.iva ?? 0) > 0 ||
          (ac.notary ?? 0) > 0 ||
          (ac.registry ?? 0) > 0 ||
          (ac.management ?? 0) > 0 ||
          (ac.psi ?? 0) > 0 ||
          (ac.realEstate ?? 0) > 0;
        const esCuboLegacy =
          !tieneOtrosCampos &&
          otherEntries.length === 1 &&
          otherEntries[0].concept === 'Gastos adquisición AEAT';

        // "Ya desglosado" si la suma cuadra con AEAT (±1€) y no es el cubo
        // legacy. Desgloses válidos que vivan solo en `other` (múltiples
        // entradas o concept distinto) se preservan.
        const yaEstaDesglosado =
          totalAEAT > 0 &&
          Math.abs(sumaActual - totalAEAT) <= 1 &&
          !esCuboLegacy;

        if (!yaEstaDesglosado && totalAEAT > 0) {
          const precio = next.acquisitionCosts.price || inm.precioAdquisicion || 0;
          // Prioridad: transmissionRegime guardado > tipoAdquisicion del XML.
          // No asumir 'onerosa' por defecto si tipoAdquisicion es undefined.
          const esUsada = next.transmissionRegime != null
            ? next.transmissionRegime === 'usada'
            : inm.tipoAdquisicion === 'onerosa';

          if (esUsada && precio > 0 && next.ccaa) {
            const itpInferido = inferirITP(precio, next.ccaa);
            const restoOtros = Math.round((totalAEAT - itpInferido) * 100) / 100;

            if (itpInferido > 0 && restoOtros >= 0) {
              // Limpiar IVA y desglose previo para evitar doble conteo.
              delete next.acquisitionCosts.iva;
              delete next.acquisitionCosts.ivaIsManual;
              delete next.acquisitionCosts.notary;
              delete next.acquisitionCosts.registry;
              delete next.acquisitionCosts.management;

              next.acquisitionCosts.itp = itpInferido;
              next.acquisitionCosts.itpIsManual = false;
              next.acquisitionCosts.other = restoOtros > 0
                ? [{ concept: 'Notaría + registro + gestoría (inferido)', amount: restoOtros }]
                : [];
              camposNuevos.push('ITP inferido');
              modificado = true;
            } else {
              delete next.acquisitionCosts.itp;
              delete next.acquisitionCosts.itpIsManual;
              delete next.acquisitionCosts.iva;
              delete next.acquisitionCosts.ivaIsManual;
              delete next.acquisitionCosts.notary;
              delete next.acquisitionCosts.registry;
              delete next.acquisitionCosts.management;
              next.acquisitionCosts.other = [{ concept: 'Gastos adquisición AEAT', amount: totalAEAT }];
              camposNuevos.push('Gastos adquisición');
              modificado = true;
            }
          } else {
            delete next.acquisitionCosts.itp;
            delete next.acquisitionCosts.itpIsManual;
            delete next.acquisitionCosts.iva;
            delete next.acquisitionCosts.ivaIsManual;
            delete next.acquisitionCosts.notary;
            delete next.acquisitionCosts.registry;
            delete next.acquisitionCosts.management;
            next.acquisitionCosts.other = [{ concept: 'Gastos adquisición AEAT', amount: totalAEAT }];
            camposNuevos.push('Gastos adquisición');
            modificado = true;
          }
        }
        // yaEstaDesglosado === true → no tocar, el desglose cuadra con AEAT.
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

    // BUG-4: C_BASEAMORACC y C_AMORTACC se leían en el parser pero no se
    // escribían en properties.aeatAmortization del accesorio. Sin esto el
    // parking/trastero aparece sin amortización calculada por AEAT.
    const baseAmortAcc = inm.accesorio.baseAmortizacion || 0;
    const amortAnualAcc = inm.accesorio.amortizacionAnual || 0;
    if (baseAmortAcc > 0 || amortAnualAcc > 0) {
      const amortActual = next.aeatAmortization;
      const nuevaAmort = {
        acquisitionType: (amortActual?.acquisitionType ?? 'onerosa') as 'onerosa' | 'lucrativa' | 'mixta',
        firstAcquisitionDate:
          amortActual?.firstAcquisitionDate || toISODate(inm.accesorio.fechaAdquisicion || ''),
        cadastralValue: amortActual?.cadastralValue || inm.accesorio.valorCatastral || 0,
        constructionCadastralValue:
          amortActual?.constructionCadastralValue || inm.accesorio.valorCatastralConstruccion || 0,
        constructionPercentage:
          amortActual?.constructionPercentage || inm.accesorio.porcentajeConstruccion || 0,
        onerosoAcquisition: amortActual?.onerosoAcquisition ?? {
          acquisitionAmount: inm.accesorio.precioAdquisicion || 0,
          acquisitionExpenses: inm.accesorio.gastosAdquisicion || 0,
        },
        baseAmortizacion: amortActual?.baseAmortizacion || baseAmortAcc || undefined,
        amortizacionAnualInmueble:
          amortActual?.amortizacionAnualInmueble || amortAnualAcc || undefined,
      };
      const cambio =
        !amortActual ||
        !amortActual.baseAmortizacion ||
        !amortActual.amortizacionAnualInmueble;
      if (cambio) {
        next.aeatAmortization = nuevaAmort;
        modificado = true;
      }
    }

    if (modificado) {
      await db.put('properties', next);
      // Update the map so subsequent logic sees enriched data
      porRefCatastral.set(rcAccesorio, next);
    }
  }

  return { distribuidos, contratos, opexRecurrentes, prestamos, proveedores };
}

function construirPropertyDesdeDeclaracion(inm: InmuebleDeclarado): Omit<Property, 'id'> {
  const ubicacion = extraerUbicacion(inm.direccion || '');
  const precio = inm.precioAdquisicion || 0;
  const totalGastosAEAT = inm.gastosAdquisicion || 0;
  const esUsada = (inm.tipoAdquisicion ?? 'onerosa') === 'onerosa';

  // El ITP inferido se DESCUENTA del total AEAT, nunca se suma.
  // Total invariante: precio + itp + resto === precio + totalGastosAEAT.
  const acquisitionCosts: Property['acquisitionCosts'] = (() => {
    if (!esUsada) {
      return {
        price: precio,
        other: totalGastosAEAT > 0
          ? [{ concept: 'Gastos adquisición AEAT', amount: totalGastosAEAT }]
          : [],
      };
    }

    const itpInferido = inferirITP(precio, ubicacion.ccaa);
    const restoOtros = Math.round((totalGastosAEAT - itpInferido) * 100) / 100;

    if (itpInferido <= 0 || restoOtros < 0) {
      return {
        price: precio,
        other: totalGastosAEAT > 0
          ? [{ concept: 'Gastos adquisición AEAT', amount: totalGastosAEAT }]
          : [],
      };
    }

    return {
      price: precio,
      itp: itpInferido,
      itpIsManual: false,
      other: restoOtros > 0
        ? [{ concept: 'Notaría + registro + gestoría (inferido)', amount: restoOtros }]
        : [],
    };
  })();

  return {
    alias: acortarDireccion(inm.direccion) || inm.refCatastral,
    address: inm.direccion || inm.refCatastral,
    postalCode: extraerCodigoPostal(inm.direccion || ''),
    province: ubicacion.province,
    municipality: ubicacion.municipality,
    ccaa: ubicacion.ccaa,
    purchaseDate: toISODate(inm.fechaAdquisicion || ''),
    cadastralReference: normalizeRef(inm.refCatastral) || undefined,
    squareMeters: 0,
    bedrooms: 0,
    transmissionRegime: esUsada ? 'usada' : 'obra-nueva',
    state: 'activo',
    porcentajePropiedad: inm.porcentajePropiedad > 0 ? inm.porcentajePropiedad : undefined,
    esUrbana: inm.esUrbana,
    acquisitionCosts,
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

/**
 * Persiste el plan de pensiones de empleo declarado en el store planesPensionInversion.
 * Lógica upsert: UN solo registro por plan (deduplicado por NIF empresa o nombre base).
 * Añade el año al historialAportaciones en lugar de crear un registro nuevo por ejercicio.
 */
async function persistirPlanPensiones(db: DB, decl: DeclaracionCompleta, año: number): Promise<void> {
  const pp = decl.planPensiones;
  // Usar totalConDerechoReduccion como criterio principal — es RSUMAD, fiable en todos los años.
  if (!pp || pp.totalConDerechoReduccion === 0) return;

  const perfiles = await db.getAll('personalData');
  const perfil = perfiles[0];
  if (!perfil?.id) return;

  const ahora = new Date().toISOString();
  // Usar el total directo del XML (RSUMAD) en vez de sumar las partes, para evitar errores de redondeo.
  const totalAño = pp.totalConDerechoReduccion;

  // Buscar plan existente: primero por NIF, luego por nombre empresa, luego por nombre base normalizado
  const nombreBaseNuevo = (pp.nombreEmpleador ?? '').replace(/\s*\(\d{4}\)\s*/, '').trim();
  const planes = await db.getAll('planesPensionInversion');
  const planExistente = planes.find((p) => {
    if (p.tipo !== 'plan-pensiones') return false;
    if (pp.nifEmpleador && p.empresaNif === pp.nifEmpleador) return true;
    if (pp.nombreEmpleador && p.empresaNombre === pp.nombreEmpleador) return true;
    // Fallback: comparar nombre normalizado para capturar registros legacy sin empresaNif/empresaNombre
    if (nombreBaseNuevo) {
      const nombrePNorm = typeof p.nombre === 'string' ? p.nombre.replace(/\s*\(\d{4}\)\s*/, '').trim() : '';
      if (nombrePNorm === nombreBaseNuevo) return true;
    }
    return false;
  });

  if (planExistente) {
    // Backfill de campos empresa si el registro legacy no los tenía
    if (!planExistente.empresaNif && pp.nifEmpleador) planExistente.empresaNif = pp.nifEmpleador;
    if (!planExistente.empresaNombre && pp.nombreEmpleador) planExistente.empresaNombre = pp.nombreEmpleador;

    // Backfill esHistorico: versiones antiguas marcaban los planes XML como históricos ("solo seguimiento"),
    // lo que los excluía del drawer de actualización de valores y de la pestaña "Con aportaciones".
    // Sólo retiramos la marca si todo el historial procede de XML; si el usuario añadió entradas manuales
    // y decidió marcarlo como histórico, respetamos su elección.
    const entradasPrev = Object.values(planExistente.historialAportaciones ?? {}) as Array<{ fuente?: string }>;
    const soloXml = entradasPrev.length > 0 && entradasPrev.every((e) => e.fuente === 'xml_aeat' || !e.fuente);
    if (planExistente.esHistorico && soloXml) {
      planExistente.esHistorico = false;
    }

    // ACTUALIZAR: añadir/sobrescribir año en el historial
    if (!planExistente.historialAportaciones) {
      planExistente.historialAportaciones = {};
    }
    const entradaExistente = planExistente.historialAportaciones[año];
    // El XML solo sobreescribe si no había entrada o si la entrada existente también era de XML (no manual).
    if (!entradaExistente || entradaExistente.fuente !== 'manual') {
      planExistente.historialAportaciones[año] = {
        titular: pp.aportacionesTrabajador ?? 0,
        empresa: pp.contribucionesEmpresa ?? 0,
        total: totalAño,
        fuente: 'xml_aeat',
      };
    }
    // Recalcular acumulado desde el historial completo
    const entradas = Object.values(planExistente.historialAportaciones) as Array<{ total: number }>;
    planExistente.aportacionesRealizadas = entradas.reduce((sum, a) => sum + a.total, 0);
    planExistente.fechaActualizacion = ahora;
    await db.put('planesPensionInversion', planExistente);
  } else {
    // CREAR: nuevo plan con primer año de historial
    const nombreBase = pp.nombreEmpleador ?? 'Plan de pensiones empleo';
    await db.add('planesPensionInversion', {
      personalDataId: perfil.id,
      nombre: nombreBase,
      tipo: 'plan-pensiones',
      empresaNif: pp.nifEmpleador,
      empresaNombre: pp.nombreEmpleador,
      aportacionesRealizadas: totalAño,
      valorCompra: 0,
      valorActual: 0,
      titularidad: 'yo',
      // Un plan con aportaciones declaradas en la AEAT es un plan vivo; se trata igual que uno creado manualmente.
      // El usuario puede marcarlo como "solo seguimiento" después desde el formulario de edición.
      esHistorico: false,
      historialAportaciones: {
        [año]: {
          titular: pp.aportacionesTrabajador ?? 0,
          empresa: pp.contribucionesEmpresa ?? 0,
          total: totalAño,
          fuente: 'xml_aeat',
        },
      },
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });
  }
}

/**
 * Persiste fondos de inversión y criptomonedas declarados en el store inversiones.
 * Cada transmisión genera una PosicionInversion cerrada (activo=false).
 * Deduplicación por nombre (nombre incluye el año).
 */
async function persistirInversionesDeclaradas(db: DB, decl: DeclaracionCompleta, año: number): Promise<void> {
  const gp = decl.gananciasPerdidas;
  if (!gp) return;

  const ahora = new Date().toISOString();
  const hoy = ahora.slice(0, 10);

  const existentes = await db.getAll('inversiones');
  const nombresExistentes = new Set(existentes.map((i: any) => i.nombre));

  // Fondos de inversión
  for (const fondo of gp.fondos ?? []) {
    const nombre = `Fondo ${fondo.nifFondo || 'desconocido'} (${año})`;
    if (nombresExistentes.has(nombre)) continue;

    const totalAportado = fondo.valorAdquisicion ?? 0;
    const valorActual = fondo.valorTransmision ?? 0;
    const ganancia = fondo.ganancia ?? 0;

    await db.add('inversiones', {
      nombre,
      tipo: 'fondo_inversion',
      entidad: fondo.nifFondo || 'AEAT',
      isin: fondo.nifFondo || undefined,
      valor_actual: valorActual,
      fecha_valoracion: hoy,
      aportaciones: [],
      total_aportado: totalAportado,
      rentabilidad_euros: ganancia,
      rentabilidad_porcentaje: totalAportado > 0 ? Math.round((ganancia / totalAportado) * 10000) / 100 : 0,
      notas: `Transmisión declarada IRPF ${año}. Retención: ${fondo.retencion ?? 0} €`,
      activo: false,
      created_at: ahora,
      updated_at: ahora,
    } as any);
  }

  // Criptomonedas
  for (const cripto of gp.criptomonedas ?? []) {
    const nombre = `${cripto.moneda || 'Crypto'} (${año})`;
    if (nombresExistentes.has(nombre)) continue;

    const totalAportado = cripto.valorAdquisicion ?? 0;
    const valorActual = cripto.valorTransmision ?? 0;
    const ganancia = cripto.resultado ?? 0;

    await db.add('inversiones', {
      nombre,
      tipo: 'crypto',
      entidad: 'AEAT XML',
      valor_actual: valorActual,
      fecha_valoracion: hoy,
      aportaciones: [],
      total_aportado: totalAportado,
      rentabilidad_euros: ganancia,
      rentabilidad_porcentaje: totalAportado > 0 ? Math.round((ganancia / totalAportado) * 10000) / 100 : 0,
      notas: `Transmisión declarada IRPF ${año}. Clave: ${cripto.claveContraprestacion || ''}`,
      activo: false,
      created_at: ahora,
      updated_at: ahora,
    } as any);
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

/**
 * BUG-5: IMP4GCPEA (casilla 0103) — arrastre recibido de años anteriores.
 *
 * El parser ya lo extrae como `inm.arrastresRecibidos`. La propagación formal
 * contra `ejerciciosFiscalesCoord.arrastresIn.gastosPendientes` (marcándolos
 * como aplicados por AEAT) requiere un servicio `confirmarArrastreAplicado`
 * que HOY NO EXISTE. Es un gap de arquitectura — la reconciliación
 * importePendiente ↔ importeAplicado necesita decisión de producto sobre si
 * el XML AEAT debe pisar manualmente los arrastres ATLAS, o solo validarlos.
 *
 * De momento, registramos el valor leído para que quede en los logs de la
 * importación. El dato está disponible en `decl.inmuebles[i].arrastresRecibidos`
 * para futuras integraciones.
 */
function reportarArrastresRecibidos(decl: DeclaracionCompleta): void {
  for (const inm of decl.inmuebles) {
    const recibido = inm.arrastresRecibidos;
    if (typeof recibido === 'number' && recibido > 0) {
      console.log(
        `[distribuidor] IMP4GCPEA ${decl.meta.ejercicio} — ${inm.refCatastral}: ` +
          `arrastre recibido AEAT = €${recibido}. Pendiente reconciliar con arrastresIn ATLAS.`,
      );
    }
  }
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

/**
 * Normaliza una dirección para matching flexible: quita prefijos de vía,
 * ceros a la izquierda, puntuación y pasa a mayúsculas.
 */
export function normalizeDireccion(dir?: string | null): string {
  if (!dir) return '';
  return dir
    .toUpperCase()
    .replace(/^(CL|CR|AV|PZ|PS|CM|C\/|CALLE|CARRER|AVDA|AVENIDA|PLAZA|PASEO|CAMINO)\s+/i, '')
    .replace(/[.,\-/]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b0+(\d+)/g, '$1')
    .trim();
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

    // F2: Borrar filas xml_aeat previas para este {inmueble, ejercicio}
    // antes de re-escribir. Re-import idempotente.
    const existentes = await gastosInmuebleService.getByInmuebleYEjercicio(
      property.id,
      decl.meta.ejercicio,
    );
    for (const g of existentes) {
      if (g.origen === 'xml_aeat' && g.id != null) {
        await gastosInmuebleService.delete(g.id);
      }
    }

    // ── Write to gastosInmueble con origen xml_aeat ──
    const GASTOS_DECL: { campo: keyof typeof inm.gastos; casilla: string; categoria: GastoCategoria }[] = [
      { campo: 'interesesFinanciacion', casilla: '0105', categoria: 'intereses' },
      // BUG-1: casilla 0106 es el importe APLICADO en el ejercicio tras el tope
      // (C_INTGRCEA), no el bruto antes del tope (C_GRCEA). Usar gastosAplicados.
      { campo: 'gastosAplicados', casilla: '0106', categoria: 'reparacion' },
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
      // Para casilla 0106 guardamos explícitamente importeBruto (C_GRCEA) — el coste
      // real antes del tope. Cuando reparacionConservacion = 0 y gastosAplicados > 0,
      // la fila es pura aplicación de arrastre de un año previo, no un gasto nuevo;
      // conservamos la fila (fiscal correctness) con importeBruto = 0 como marcador.
      const importeBruto: number | undefined =
        casilla === '0106' ? (inm.gastos.reparacionConservacion || 0) : undefined;
      await gastosInmuebleService.add({
        inmuebleId: property.id,
        ejercicio: decl.meta.ejercicio,
        fecha: `${decl.meta.ejercicio}-12-31`,
        concepto: `Declaración AEAT ${decl.meta.ejercicio}`,
        categoria,
        casillaAEAT: casilla as any,
        importe,
        ...(typeof importeBruto === 'number' ? { importeBruto } : {}),
        origen: 'xml_aeat',
        origenId: `${property.id}-${decl.meta.ejercicio}-${casilla}`,
        estado: 'declarado',
        proveedorNIF: 'AEAT',
        proveedorNombre: 'Declaración AEAT',
      });
    }

    // ── Mejoras del ejercicio (casilla 0129), base y amortización del inmueble (0130/0131) ──
    const EXTRAS: { casilla: '0129' | '0130' | '0131'; importe: number; concepto: string }[] = [
      {
        casilla: '0129',
        importe: (inm.mejorasEjercicio || []).reduce((sum, m) => sum + (m.importe || 0), 0),
        concepto: `Declaración AEAT ${decl.meta.ejercicio} — Mejoras ejercicio`,
      },
      {
        casilla: '0130',
        importe: inm.baseAmortizacion || 0,
        concepto: `Declaración AEAT ${decl.meta.ejercicio} — Base amortización`,
      },
      {
        casilla: '0131',
        importe: inm.amortizacionAnualInmueble || 0,
        concepto: `Declaración AEAT ${decl.meta.ejercicio} — Amortización inmueble`,
      },
    ];
    for (const { casilla, importe, concepto } of EXTRAS) {
      if (importe <= 0) continue;
      await gastosInmuebleService.add({
        inmuebleId: property.id,
        ejercicio: decl.meta.ejercicio,
        fecha: `${decl.meta.ejercicio}-12-31`,
        concepto,
        categoria: 'otro',
        casillaAEAT: casilla,
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
    if (!property?.id) {
      console.warn(`[escribirMejoras] property no resuelta para RC=${rc} dirección="${inm.direccion ?? ''}" — mejora(s) del ejercicio ${decl.meta.ejercicio} no escritas`);
      continue;
    }

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
