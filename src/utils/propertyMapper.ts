// Utility functions to map between Inmueble and Property interfaces
// This bridges the gap between the form data structure and IndexedDB storage

import { Property } from '../services/db';
import { Inmueble, RegimenCompra, EstadoInmueble } from '../types/inmueble';
import { generateInmuebleId } from './inmuebleUtils';

/**
 * Convert Inmueble form data to Property interface for IndexedDB storage
 */
export function mapInmuebleToProperty(inmueble: Partial<Inmueble>): Omit<Property, 'id'> {
  // Build full address string
  const addressParts = [
    inmueble.direccion?.calle,
    inmueble.direccion?.numero,
    inmueble.direccion?.piso,
    inmueble.direccion?.puerta
  ].filter(Boolean);
  const address = addressParts.join(' ');

  // Map transmission regime
  const transmissionRegime: 'usada' | 'obra-nueva' = 
    inmueble.compra?.regimen === 'USADA_ITP' ? 'usada' : 'obra-nueva';

  // Map state
  const state: 'activo' | 'vendido' | 'baja' = 
    inmueble.estado === 'ACTIVO' ? 'activo' : 
    inmueble.estado === 'VENDIDO' ? 'vendido' : 'activo';

  // Build acquisition costs
  const acquisitionCosts: Property['acquisitionCosts'] = {
    price: inmueble.compra?.precio_compra || 0,
    itp: inmueble.compra?.impuestos?.itp_importe,
    iva: inmueble.compra?.impuestos?.iva_importe,
    notary: inmueble.compra?.gastos?.notaria || 0,
    registry: inmueble.compra?.gastos?.registro || 0,
    management: inmueble.compra?.gastos?.gestoria || 0,
    psi: inmueble.compra?.gastos?.psi || 0,
    realEstate: inmueble.compra?.gastos?.inmobiliaria || 0,
    other: inmueble.compra?.gastos?.otros ? [
      { concept: 'Otros gastos', amount: inmueble.compra.gastos.otros }
    ] : []
  };

  // Build fiscal data
  const fiscalData: Property['fiscalData'] = inmueble.fiscalidad ? {
    cadastralValue: inmueble.fiscalidad.valor_catastral_total,
    constructionCadastralValue: inmueble.fiscalidad.valor_catastral_construccion,
    constructionPercentage: inmueble.fiscalidad.porcentaje_construccion,
    acquisitionDate: inmueble.compra?.fecha_compra
  } : undefined;

  return {
    alias: inmueble.alias || '',
    address,
    postalCode: inmueble.direccion?.cp || '',
    province: inmueble.direccion?.provincia || '',
    municipality: inmueble.direccion?.municipio || '',
    ccaa: inmueble.direccion?.ca || 'Madrid',
    purchaseDate: inmueble.compra?.fecha_compra || new Date().toISOString().split('T')[0],
    cadastralReference: inmueble.ref_catastral,
    squareMeters: inmueble.caracteristicas?.m2 || 0,
    bedrooms: inmueble.caracteristicas?.habitaciones || 0,
    bathrooms: inmueble.caracteristicas?.banos,
    transmissionRegime,
    state,
    acquisitionCosts,
    documents: [],
    fiscalData
  };
}

/**
 * Convert Property from IndexedDB to Inmueble interface for form display
 */
export function mapPropertyToInmueble(property: Property): Partial<Inmueble> {
  // Parse address back to components (best effort)
  const addressParts = property.address.split(' ');
  const calle = addressParts.slice(0, -3).join(' ') || '';
  const numero = addressParts[addressParts.length - 3] || '';
  const piso = addressParts[addressParts.length - 2] || '';
  const puerta = addressParts[addressParts.length - 1] || '';

  // Map transmission regime back
  const regimen: RegimenCompra = property.transmissionRegime === 'usada' ? 'USADA_ITP' : 'NUEVA_IVA_AJD';

  // Map state back
  const estado: EstadoInmueble = property.state === 'vendido' ? 'VENDIDO' : 'ACTIVO';

  return {
    id: property.id?.toString(),
    alias: property.alias,
    direccion: {
      calle,
      numero,
      piso: piso || undefined,
      puerta: puerta || undefined,
      cp: property.postalCode,
      municipio: property.municipality,
      provincia: property.province,
      ca: property.ccaa as any
    },
    ref_catastral: property.cadastralReference,
    estado,
    fecha_alta: property.purchaseDate,
    caracteristicas: {
      m2: property.squareMeters,
      habitaciones: property.bedrooms,
      banos: property.bathrooms || 0,
      anio_construccion: undefined
    },
    compra: {
      fecha_compra: property.purchaseDate,
      regimen,
      precio_compra: property.acquisitionCosts.price,
      gastos: {
        notaria: property.acquisitionCosts.notary || 0,
        registro: property.acquisitionCosts.registry || 0,
        gestoria: property.acquisitionCosts.management || 0,
        inmobiliaria: property.acquisitionCosts.realEstate || 0,
        psi: property.acquisitionCosts.psi || 0,
        otros: property.acquisitionCosts.other?.reduce((sum, item) => sum + item.amount, 0) || 0
      },
      impuestos: {
        itp_importe: property.acquisitionCosts.itp,
        iva_importe: property.acquisitionCosts.iva
      },
      total_gastos: 0, // Will be calculated
      total_impuestos: 0, // Will be calculated
      coste_total_compra: 0, // Will be calculated
      eur_por_m2: 0 // Will be calculated
    },
    fiscalidad: property.fiscalData ? {
      valor_catastral_total: property.fiscalData.cadastralValue || 0,
      valor_catastral_construccion: property.fiscalData.constructionCadastralValue || 0,
      porcentaje_construccion: property.fiscalData.constructionPercentage || 0,
      tipo_adquisicion: 'LUCRATIVA_ONEROSA',
      metodo_amortizacion: 'REGLA_GENERAL_3',
      amortizacion_anual_base: 0,
      porcentaje_amortizacion_info: 3.0000
    } : {
      valor_catastral_total: 0,
      valor_catastral_construccion: 0,
      porcentaje_construccion: 0,
      tipo_adquisicion: 'LUCRATIVA_ONEROSA',
      metodo_amortizacion: 'REGLA_GENERAL_3',
      amortizacion_anual_base: 0,
      porcentaje_amortizacion_info: 3.0000
    }
  };
}

/**
 * Generate a unique property ID
 */
export function generatePropertyId(): string {
  return generateInmuebleId();
}