import { nominaService } from './nominaService';
import { autonomoService } from './autonomoService';
import { gastosPersonalesService } from './gastosPersonalesService';
import { ResumenPersonalMensual, OtrosIngresos } from '../types/personal';
import { initDB } from './db';

class PersonalResumenService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Get otros ingresos for a personal data ID
   */
  private async getOtrosIngresos(personalDataId: number): Promise<OtrosIngresos[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['otrosIngresos'], 'readonly');
      const store = transaction.objectStore('otrosIngresos');
      const index = store.index('personalDataId');
      const ingresos = await index.getAll(personalDataId);
      return ingresos || [];
    } catch (error) {
      console.error('Error getting otros ingresos:', error);
      return [];
    }
  }

  /**
   * Calculate monthly income from OtrosIngresos based on frequency
   */
  private calcularIngresoMensual(ingreso: OtrosIngresos): number {
    if (!ingreso.activo) return 0;

    switch (ingreso.frecuencia) {
      case 'mensual':
        return ingreso.importe;
      case 'trimestral':
        return ingreso.importe / 3;
      case 'semestral':
        return ingreso.importe / 6;
      case 'anual':
        return ingreso.importe / 12;
      case 'unico':
        return 0; // One-time income not included in monthly calculation
      default:
        return 0;
    }
  }

  /**
   * Get monthly summary for a specific month and year
   */
  async getResumenMensual(personalDataId: number, mes: number, anio: number): Promise<ResumenPersonalMensual> {
    try {
      // Calculate income from nómina
      const nominas = await nominaService.getNominas(personalDataId);
      const nominaActiva = nominas.find(n => n.activa);
      let ingresoNomina = 0;
      
      if (nominaActiva) {
        const calculo = nominaService.calculateSalary(nominaActiva);
        const mesData = calculo.distribuccionMensual.find(d => d.mes === mes);
        ingresoNomina = mesData?.netoTotal || 0;
      }

      // Calculate income from autónomo
      const autonomos = await autonomoService.getAutonomos(personalDataId);
      const autonomoActivo = autonomos.find(a => a.activo);
      let ingresoAutonomo = 0;
      
      if (autonomoActivo) {
        const resultado = autonomoService.calculateAutonomoResults(autonomoActivo, anio, mes);
        ingresoAutonomo = resultado.resultadoNetoMensual;
      }

      // Calculate other income
      const otrosIngresos = await this.getOtrosIngresos(personalDataId);
      const ingresoOtros = otrosIngresos
        .filter(o => o.activo)
        .reduce((sum, o) => sum + this.calcularIngresoMensual(o), 0);

      // Calculate expenses
      const gastos = await gastosPersonalesService.calcularTotalGastosMes(personalDataId, mes, anio);

      // Calculate totals
      const totalIngresos = ingresoNomina + ingresoAutonomo + ingresoOtros;
      const totalGastos = gastos.total;
      const ahorro = totalIngresos - totalGastos;

      // Calculate variation from previous month
      // TODO: Implement proper calculation comparing with previous month's data
      // For now, returning 0 as this requires historical data comparison
      const variacionMesAnterior = 0;

      return {
        mes,
        anio,
        ingresos: {
          nomina: ingresoNomina,
          autonomo: ingresoAutonomo,
          otros: ingresoOtros,
          total: totalIngresos
        },
        gastos: {
          recurrentes: gastos.recurrentes,
          puntuales: gastos.puntuales,
          total: totalGastos
        },
        ahorro,
        variacionMesAnterior
      };
    } catch (error) {
      console.error('Error getting resumen mensual:', error);
      // Return empty summary on error
      return {
        mes,
        anio,
        ingresos: {
          nomina: 0,
          autonomo: 0,
          otros: 0,
          total: 0
        },
        gastos: {
          recurrentes: 0,
          puntuales: 0,
          total: 0
        },
        ahorro: 0,
        variacionMesAnterior: 0
      };
    }
  }

  /**
   * Get annual summary
   */
  async getResumenAnual(personalDataId: number, anio: number): Promise<ResumenPersonalMensual[]> {
    const resumenes: ResumenPersonalMensual[] = [];
    
    for (let mes = 1; mes <= 12; mes++) {
      const resumen = await this.getResumenMensual(personalDataId, mes, anio);
      resumenes.push(resumen);
    }
    
    return resumenes;
  }
}

export const personalResumenService = new PersonalResumenService();
