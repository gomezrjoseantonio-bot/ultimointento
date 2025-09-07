// Standard Bonifications Service
// Pre-configured bonifications that are common in Spanish mortgages

import { Bonificacion } from '../types/prestamos';

export interface StandardBonification {
  id: string;
  nombre: string;
  descripcion: string;
  reduccionPuntosPorcentuales: number;
  lookbackMeses: number;
  regla: Bonificacion['regla'];
  costeAnualEstimado?: number;
  categoria: 'productos' | 'servicios' | 'ingresos';
  esHabitual: boolean; // If this is a common bonification
}

export const STANDARD_BONIFICATIONS: StandardBonification[] = [
  {
    id: 'nomina',
    nombre: 'Nómina',
    descripcion: 'Domiciliar nómina por importe mínimo mensual',
    reduccionPuntosPorcentuales: 0.003, // 0.30 pp
    lookbackMeses: 4,
    regla: { tipo: 'NOMINA', minimoMensual: 1200 },
    costeAnualEstimado: 0,
    categoria: 'ingresos',
    esHabitual: true
  },
  {
    id: 'plan_pensiones',
    nombre: 'Plan de pensiones',
    descripcion: 'Tener contratado un plan de pensiones',
    reduccionPuntosPorcentuales: 0.002, // 0.20 pp
    lookbackMeses: 12,
    regla: { tipo: 'PLAN_PENSIONES', activo: true },
    costeAnualEstimado: 600, // Estimated minimum contribution
    categoria: 'productos',
    esHabitual: true
  },
  {
    id: 'seguro_hogar',
    nombre: 'Seguro de hogar',
    descripcion: 'Contratar seguro de hogar con la entidad',
    reduccionPuntosPorcentuales: 0.002, // 0.20 pp
    lookbackMeses: 12,
    regla: { tipo: 'SEGURO_HOGAR', activo: true },
    costeAnualEstimado: 240,
    categoria: 'productos',
    esHabitual: true
  },
  {
    id: 'seguro_vida',
    nombre: 'Seguro de vida',
    descripcion: 'Contratar seguro de vida con la entidad',
    reduccionPuntosPorcentuales: 0.002, // 0.20 pp
    lookbackMeses: 12,
    regla: { tipo: 'SEGURO_VIDA', activo: true },
    costeAnualEstimado: 180,
    categoria: 'productos',
    esHabitual: true
  },
  {
    id: 'tarjeta_uso',
    nombre: 'Uso de tarjeta',
    descripcion: 'Realizar un número mínimo de operaciones con tarjeta',
    reduccionPuntosPorcentuales: 0.001, // 0.10 pp
    lookbackMeses: 3,
    regla: { tipo: 'TARJETA', movimientosMesMin: 6 },
    costeAnualEstimado: 0,
    categoria: 'servicios',
    esHabitual: true
  },
  {
    id: 'tarjeta_importe',
    nombre: 'Facturación tarjeta',
    descripcion: 'Facturar un importe mínimo anual con tarjeta',
    reduccionPuntosPorcentuales: 0.0015, // 0.15 pp
    lookbackMeses: 12,
    regla: { tipo: 'TARJETA', importeMinimo: 3000 },
    costeAnualEstimado: 0,
    categoria: 'servicios',
    esHabitual: true
  },
  {
    id: 'alarma',
    nombre: 'Alarma',
    descripcion: 'Contratar servicio de alarma para la vivienda',
    reduccionPuntosPorcentuales: 0.001, // 0.10 pp
    lookbackMeses: 12,
    regla: { tipo: 'ALARMA', activo: true },
    costeAnualEstimado: 300,
    categoria: 'servicios',
    esHabitual: true
  }
];

export class StandardBonificationsService {
  
  /**
   * Get all standard bonifications
   */
  getAllStandard(): StandardBonification[] {
    return STANDARD_BONIFICATIONS;
  }
  
  /**
   * Get only common/habitual bonifications
   */
  getHabitual(): StandardBonification[] {
    return STANDARD_BONIFICATIONS.filter(b => b.esHabitual);
  }
  
  /**
   * Get bonifications by category
   */
  getByCategory(categoria: StandardBonification['categoria']): StandardBonification[] {
    return STANDARD_BONIFICATIONS.filter(b => b.categoria === categoria);
  }
  
  /**
   * Convert a standard bonification to a loan bonification
   */
  createBonificationFromStandard(standard: StandardBonification): Bonificacion {
    return {
      id: `bonif_${standard.id}_${Date.now()}`,
      nombre: standard.nombre,
      reduccionPuntosPorcentuales: standard.reduccionPuntosPorcentuales,
      lookbackMeses: standard.lookbackMeses,
      regla: standard.regla,
      costeAnualEstimado: standard.costeAnualEstimado,
      estado: 'PENDIENTE'
    };
  }
  
  /**
   * Get maximum realistic bonification percentage
   * Based on applying all habitual bonifications
   */
  getMaximumRealisticBonification(): number {
    return this.getHabitual()
      .reduce((sum, b) => sum + b.reduccionPuntosPorcentuales, 0);
  }
  
  /**
   * Calculate estimated annual cost of all bonifications
   */
  getTotalEstimatedCost(bonificationIds: string[]): number {
    return STANDARD_BONIFICATIONS
      .filter(b => bonificationIds.includes(b.id))
      .reduce((sum, b) => sum + (b.costeAnualEstimado || 0), 0);
  }
}

export const standardBonificationsService = new StandardBonificationsService();