// Service for managing Inmueble data according to v1.0 specifications
// Handles CRUD operations, validation, and business logic

import { 
  Inmueble, 
  NuevoInmueble, 
  EstadoInmueble,
  INMUEBLE_ERRORS
} from '../types/inmueble';
import { 
  calculateTotalTaxes,
  calculateTotalTaxAmount,
  calculateConstructionPercentage
} from '../utils/inmuebleUtils';
import { getLocationFromPostalCode } from '../utils/locationUtils';
import { initDB, Property } from './db';

class InmuebleService {

  /**
   * Map a Property from IndexedDB to the Inmueble format
   */
  private mapPropertyToInmueble(property: Property): Inmueble {
    return {
      id: property.id?.toString() || '',
      alias: property.alias,
      direccion: {
        calle: property.address,
        numero: '',
        piso: '',
        puerta: '',
        cp: property.postalCode,
        municipio: property.municipality,
        provincia: property.province,
        ca: property.ccaa as any
      },
      estado: property.state === 'activo' ? 'ACTIVO' : 'VENDIDO',
      fecha_alta: property.purchaseDate || new Date().toISOString().split('T')[0],
      caracteristicas: {
        m2: property.squareMeters || 0,
        habitaciones: property.bedrooms || 0,
        banos: property.bathrooms || 0
      },
      compra: {
        fecha_compra: property.purchaseDate || '',
        precio_compra: property.acquisitionCosts?.price || 0,
        regimen: property.transmissionRegime === 'obra-nueva' ? 'NUEVA_IVA' : 'USADA_ITP',
        coste_total_compra: property.acquisitionCosts?.price || 0,
        total_gastos: 0,
        total_impuestos: 0,
        eur_por_m2: 0,
        gastos: {},
        impuestos: null
      },
      fiscalidad: {
        ref_catastral: property.cadastralReference || '',
        tipo_adquisicion: 'LUCRATIVA_ONEROSA',
        metodo_amortizacion: 'REGLA_GENERAL_3',
        porcentaje_amortizacion_info: 3.0000
      },
      completitud: {
        identificacion: 'COMPLETO',
        compra: 'COMPLETO',
        fiscalidad: 'COMPLETO'
      }
    };
  }

  /**
   * Get all inmuebles from IndexedDB
   */
  async getAll(): Promise<Inmueble[]> {
    try {
      const db = await initDB();
      const properties = await db.getAll('properties');
      console.log('[INMUEBLE_SERVICE] Loaded from IndexedDB:', properties.length);
      return properties.map(p => this.mapPropertyToInmueble(p));
    } catch (error) {
      console.error('[INMUEBLE_SERVICE] Error loading from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Get inmueble by ID from IndexedDB
   */
  async getById(id: string): Promise<Inmueble | null> {
    try {
      const db = await initDB();
      const propertyId = parseInt(id, 10);

      if (isNaN(propertyId)) {
        return null;
      }

      const property = await db.get('properties', propertyId);

      if (!property) {
        return null;
      }

      return this.mapPropertyToInmueble(property);
    } catch (error) {
      console.error('[INMUEBLE_SERVICE] Error loading inmueble by ID:', error);
      return null;
    }
  }

  /**
   * Create new inmueble
   */
  async create(data: NuevoInmueble, userId: string = 'system'): Promise<Inmueble> {
    // Auto-complete location data if postal code is provided
    if (data.direccion.cp) {
      const locationData = getLocationFromPostalCode(data.direccion.cp);
      if (locationData) {
        data.direccion.municipio = data.direccion.municipio || locationData.municipalities[0] || '';
        data.direccion.provincia = data.direccion.provincia || locationData.province;
        data.direccion.ca = data.direccion.ca || locationData.ccaa as any;
      }
    }

    // Calculate derived values
    const derivedData = this.calculateDerivedValues(data);

    // Prepare the inmueble data for creation
    const inmuebleData = {
      ...derivedData,
      estado: data.estado || 'ACTIVO',
      fecha_alta: new Date().toISOString(),
      fecha_venta: data.estado === 'VENDIDO' ? data.fecha_venta : undefined
    };

    try {
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inmuebleData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create inmueble: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating inmueble:', error);
      throw error;
    }
  }

  /**
   * Update existing inmueble
   */
  async update(id: string, data: Partial<NuevoInmueble>, userId: string = 'system'): Promise<Inmueble> {
    // Auto-complete location data if postal code is provided
    if (data.direccion?.cp) {
      const locationData = getLocationFromPostalCode(data.direccion.cp);
      if (locationData) {
        data.direccion.municipio = data.direccion.municipio || locationData.municipalities[0] || '';
        data.direccion.provincia = data.direccion.provincia || locationData.province;
        data.direccion.ca = data.direccion.ca || locationData.ccaa as any;
      }
    }

    // Calculate derived values
    const derivedData = this.calculateDerivedValues(data);

    try {
      const response = await fetch(`${this.BASE_URL}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(derivedData)
      });

      if (!response.ok) {
        throw new Error(`Failed to update inmueble: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating inmueble:', error);
      throw error;
    }
  }

  /**
   * Duplicate inmueble (clone all fields except id, alias, direccion)
   */
  async duplicate(id: string, newAlias: string, newDireccion: any, userId: string = 'system'): Promise<Inmueble> {
    const original = await this.getById(id);
    if (!original) {
      throw new Error('Inmueble not found');
    }

    const duplicateData: NuevoInmueble = {
      alias: newAlias,
      direccion: newDireccion,
      ref_catastral: original.ref_catastral,
      estado: 'ACTIVO', // Always start as active
      fecha_alta: new Date().toISOString().split('T')[0],
      fecha_venta: undefined,
      caracteristicas: { ...original.caracteristicas },
      compra: { ...original.compra },
      fiscalidad: { ...original.fiscalidad }
    };

    return this.create(duplicateData, userId);
  }

  /**
   * Delete inmueble
   */
  async delete(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.BASE_URL}/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete inmueble: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting inmueble:', error);
      throw error;
    }
  }

  /**
   * Update inmueble state (ACTIVO -> VENDIDO)
   */
  async updateState(id: string, estado: EstadoInmueble, fechaVenta?: string): Promise<Inmueble> {
    if (estado === 'VENDIDO' && !fechaVenta) {
      throw new Error(INMUEBLE_ERRORS.ERR_ESTADO_VENDIDO_SIN_FECHA);
    }

    return this.update(id, {
      estado,
      fecha_venta: fechaVenta
    });
  }

  /**
   * Calculate derived values (totals, rates, etc.)
   */
  private calculateDerivedValues(data: any): any {
    const result = { ...data };

    // Calculate taxes if regime and price are available
    if (result.compra?.regimen && result.compra?.precio_compra && result.direccion?.ca) {
      const taxes = calculateTotalTaxes(
        result.compra.precio_compra,
        result.compra.regimen,
        result.direccion.ca
      );
      result.compra.impuestos = taxes;
    }

    // Calculate totals
    if (result.compra) {
      const gastos = result.compra.gastos || {};
      result.compra.total_gastos = 
        (gastos.notaria || 0) + 
        (gastos.registro || 0) + 
        (gastos.gestoria || 0) + 
        (gastos.inmobiliaria || 0) + 
        (gastos.psi || 0) + 
        (gastos.otros || 0);

      result.compra.total_impuestos = result.compra.impuestos ? 
        calculateTotalTaxAmount(result.compra.impuestos) : 0;

      result.compra.coste_total_compra = 
        (result.compra.precio_compra || 0) + 
        result.compra.total_gastos + 
        result.compra.total_impuestos;

      // Calculate €/m²
      if (result.caracteristicas?.m2 > 0) {
        result.compra.eur_por_m2 = 
          Math.round((result.compra.coste_total_compra / result.caracteristicas.m2) * 100) / 100;
      }
    }

    // Calculate construction percentage
    if (result.fiscalidad?.valor_catastral_total && result.fiscalidad?.valor_catastral_construccion) {
      result.fiscalidad.porcentaje_construccion = calculateConstructionPercentage(
        result.fiscalidad.valor_catastral_construccion,
        result.fiscalidad.valor_catastral_total
      );
    }

    // Set defaults for fiscalidad
    if (result.fiscalidad) {
      result.fiscalidad.tipo_adquisicion = result.fiscalidad.tipo_adquisicion || 'LUCRATIVA_ONEROSA';
      result.fiscalidad.metodo_amortizacion = result.fiscalidad.metodo_amortizacion || 'REGLA_GENERAL_3';
      result.fiscalidad.porcentaje_amortizacion_info = result.fiscalidad.porcentaje_amortizacion_info || 3.0000;
    }

    // Set defaults for gastos
    if (result.compra?.gastos) {
      const gastos = result.compra.gastos;
      gastos.notaria = gastos.notaria || 0;
      gastos.registro = gastos.registro || 0;
      gastos.gestoria = gastos.gestoria || 0;
      gastos.inmobiliaria = gastos.inmobiliaria || 0;
      gastos.psi = gastos.psi || 0;
      gastos.otros = gastos.otros || 0;
    }

    return result;
  }

  /**
   * Search inmuebles by criteria
   */
  async search(criteria: {
    alias?: string;
    estado?: EstadoInmueble;
    provincia?: string;
    ccaa?: string;
  }): Promise<Inmueble[]> {
    const inmuebles = await this.getAll();
    
    return inmuebles.filter(inmueble => {
      if (criteria.alias && !inmueble.alias.toLowerCase().includes(criteria.alias.toLowerCase())) {
        return false;
      }
      if (criteria.estado && inmueble.estado !== criteria.estado) {
        return false;
      }
      if (criteria.provincia && inmueble.direccion.provincia !== criteria.provincia) {
        return false;
      }
      if (criteria.ccaa && inmueble.direccion.ca !== criteria.ccaa) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get completion statistics
   */
  async getCompletionStats(): Promise<{
    total: number;
    completos: number;
    parciales: number;
    pendientes: number;
  }> {
    const inmuebles = await this.getAll();
    
    let completos = 0;
    let parciales = 0;
    let pendientes = 0;

    inmuebles.forEach(inmueble => {
      const statuses = Object.values(inmueble.completitud);
      if (statuses.every(status => status === 'COMPLETO')) {
        completos++;
      } else if (statuses.some(status => status === 'COMPLETO' || status === 'PARCIAL')) {
        parciales++;
      } else {
        pendientes++;
      }
    });

    return {
      total: inmuebles.length,
      completos,
      parciales,
      pendientes
    };
  }
}

export const inmuebleService = new InmuebleService();