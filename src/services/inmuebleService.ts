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
  calculateConstructionPercentage,
  calculateCompletionStatus,
  generateInmuebleId
} from '../utils/inmuebleUtils';
import { getLocationFromPostalCode } from '../utils/locationUtils';

class InmuebleService {
  private readonly STORAGE_KEY = 'horizon_inmuebles';

  /**
   * Get all inmuebles
   */
  async getAll(): Promise<Inmueble[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading inmuebles:', error);
      return [];
    }
  }

  /**
   * Get inmueble by ID
   */
  async getById(id: string): Promise<Inmueble | null> {
    const inmuebles = await this.getAll();
    return inmuebles.find(inmueble => inmueble.id === id) || null;
  }

  /**
   * Create new inmueble
   */
  async create(data: NuevoInmueble, userId: string = 'system'): Promise<Inmueble> {
    const now = new Date().toISOString();
    
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

    const inmueble: Inmueble = {
      id: generateInmuebleId(),
      ...derivedData,
      relaciones: {
        contratos_ids: [],
        prestamos_ids: [],
        cuentas_bancarias_ids: [],
        documentos_ids: []
      },
      auditoria: {
        created_at: now,
        created_by: userId,
        updated_at: now,
        updated_by: userId,
        version: 1
      },
      completitud: calculateCompletionStatus(derivedData)
    };

    // Save to storage
    const inmuebles = await this.getAll();
    inmuebles.push(inmueble);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(inmuebles));

    return inmueble;
  }

  /**
   * Update existing inmueble
   */
  async update(id: string, data: Partial<NuevoInmueble>, userId: string = 'system'): Promise<Inmueble> {
    const inmuebles = await this.getAll();
    const index = inmuebles.findIndex(inmueble => inmueble.id === id);
    
    if (index === -1) {
      throw new Error('Inmueble not found');
    }

    const existing = inmuebles[index];
    const now = new Date().toISOString();

    // Merge data
    const mergedData = {
      ...existing,
      ...data,
      id: existing.id, // Preserve ID
      relaciones: existing.relaciones, // Preserve relations
      auditoria: {
        ...existing.auditoria,
        updated_at: now,
        updated_by: userId,
        version: existing.auditoria.version + 1
      }
    };

    // Auto-complete location data if postal code changed
    if (data.direccion?.cp && data.direccion.cp !== existing.direccion.cp) {
      const locationData = getLocationFromPostalCode(data.direccion.cp);
      if (locationData) {
        mergedData.direccion = {
          ...mergedData.direccion,
          municipio: data.direccion.municipio || locationData.municipalities[0] || '',
          provincia: data.direccion.provincia || locationData.province,
          ca: data.direccion.ca || locationData.ccaa as any
        };
      }
    }

    // Calculate derived values
    const derivedData = this.calculateDerivedValues(mergedData);
    const updatedInmueble = {
      ...derivedData,
      relaciones: existing.relaciones,
      auditoria: mergedData.auditoria,
      completitud: calculateCompletionStatus(derivedData)
    };

    inmuebles[index] = updatedInmueble;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(inmuebles));

    return updatedInmueble;
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
    const inmuebles = await this.getAll();
    const index = inmuebles.findIndex(inmueble => inmueble.id === id);
    
    if (index === -1) {
      throw new Error('Inmueble not found');
    }

    // Check for relations
    const inmueble = inmuebles[index];
    const hasRelations = 
      inmueble.relaciones.contratos_ids.length > 0 ||
      inmueble.relaciones.prestamos_ids.length > 0 ||
      inmueble.relaciones.cuentas_bancarias_ids.length > 0 ||
      inmueble.relaciones.documentos_ids.length > 0;

    if (hasRelations) {
      throw new Error(INMUEBLE_ERRORS.ERR_RELACIONES_PENDIENTES);
    }

    inmuebles.splice(index, 1);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(inmuebles));
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