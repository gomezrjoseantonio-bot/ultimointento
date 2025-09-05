import { initDB, Property } from '../../../../../services/db';
import { getLatestBudgetByYear } from '../../presupuesto/services/budgetService';

export interface MonthlyData {
  budget: number;
  forecast: number;
  actual: number;
  deviation: number; // (actual - budget) / budget * 100
  deviationStatus: 'green' | 'amber' | 'red'; // Based on deviation thresholds
}

export interface CategoryBreakdown {
  category: string;
  budget: number;
  forecast: number;
  actual: number;
  deviation: number;
  deviationStatus: 'green' | 'amber' | 'red';
}

export interface MonthlyDetail {
  month: number;
  ingresos: CategoryBreakdown[];
  gastos: CategoryBreakdown[];
}

export interface ComparativaKPIs {
  ingresosYTD: {
    budget: number;
    forecast: number;
    actual: number;
  };
  gastosYTD: {
    budget: number;
    forecast: number;
    actual: number;
  };
  resultadoNetoYTD: number; // actual ingresos - gastos
  dscrYTD: number | null; // debt service coverage ratio if applicable
}

export interface ComparativaData {
  monthlyData: MonthlyData[]; // 12 months
  ytdTotals: MonthlyData;
  kpis: ComparativaKPIs;
  availableProperties: Property[];
  monthlyDetails: MonthlyDetail[];
}

export interface ComparativaParams {
  year: number;
  scope: 'consolidado' | 'inmueble';
  propertyId?: number | null;
}

class ComparativaService {
  
  async getComparativaData(params: ComparativaParams): Promise<ComparativaData> {
    // Get all properties or filter by selected property
    const properties = await this.getFilteredProperties(params);
    
    // Get budget data (frozen amounts from confirmed budgets)
    const budgetData = await this.getBudgetData(params);
    
    // Get forecast data (dynamic calculation)
    const forecastData = await this.getForecastData(params);
    
    // Get actual data (from treasury movements)
    const actualData = await this.getActualData(params);
    
    // Calculate monthly comparisons
    const monthlyData = this.calculateMonthlyComparisons(budgetData, forecastData, actualData);
    
    // Calculate YTD totals
    const ytdTotals = this.calculateYTDTotals(monthlyData);
    
    // Calculate KPIs
    const kpis = this.calculateKPIs(budgetData, forecastData, actualData);
    
    // Get monthly category details
    const monthlyDetails = await this.getMonthlyDetails(params);
    
    return {
      monthlyData,
      ytdTotals,
      kpis,
      availableProperties: properties,
      monthlyDetails
    };
  }

  private async getFilteredProperties(params: ComparativaParams): Promise<Property[]> {
    const db = await initDB();
    const allProperties = await db.getAll('properties');
    
    if (params.scope === 'inmueble' && params.propertyId) {
      return allProperties.filter(p => p.id === params.propertyId);
    }
    
    // Return active properties for consolidado view
    return allProperties.filter(p => p.state === 'activo');
  }

  private async getBudgetData(params: ComparativaParams): Promise<number[]> {
    // Get confirmed budget for the year
    const latestBudget = await getLatestBudgetByYear(params.year);
    
    if (!latestBudget || latestBudget.status !== 'confirmed') {
      // Return zeros if no confirmed budget
      return new Array(12).fill(0);
    }

    // Filter budget lines by property if needed
    let relevantLines = latestBudget.lines;
    if (params.scope === 'inmueble' && params.propertyId) {
      relevantLines = latestBudget.lines.filter(line => 
        line.propertyId === params.propertyId
      );
    }

    // Calculate monthly net income (ingresos - gastos) from budget lines
    const monthlyBudget = new Array(12).fill(0);
    
    relevantLines.forEach(line => {
      line.monthlyAmounts.forEach((amount, monthIndex) => {
        if (line.category.startsWith('ingresos')) {
          monthlyBudget[monthIndex] += amount;
        } else {
          monthlyBudget[monthIndex] -= amount; // Subtract expenses
        }
      });
    });

    return monthlyBudget;
  }

  private async getForecastData(params: ComparativaParams): Promise<number[]> {
    // TODO: Implement dynamic forecast calculation from:
    // - Contract changes (rents, vacancies, IPC updates)
    // - Property sales/purchases and amortizations  
    // - OCR classified invoices with predicted dates
    // - Treasury automation rules
    
    // For now, return budget data with some variance as placeholder
    const budgetData = await this.getBudgetData(params);
    return budgetData.map(amount => amount * (0.95 + Math.random() * 0.1)); // ±5% variance
  }

  private async getActualData(params: ComparativaParams): Promise<number[]> {
    const db = await initDB();
    const currentMonth = new Date().getMonth();
    const monthlyActual = new Array(12).fill(0);
    
    try {
      // Get all treasury movements for the year
      const movements = await db.getAll('movements');
      const yearMovements = movements.filter(movement => {
        const moveDate = new Date(movement.date);
        return moveDate.getFullYear() === params.year;
      });

      // Filter by property if needed (would need property linkage in movements)
      // For now, use all movements for consolidado view
      
      yearMovements.forEach(movement => {
        const moveDate = new Date(movement.date);
        const monthIndex = moveDate.getMonth();
        
        // Only include data up to current month for current year
        if (params.year === new Date().getFullYear() && monthIndex > currentMonth) {
          return;
        }
        
        // Add income, subtract expenses based on movement category
        if (movement.category?.startsWith('ingresos') || movement.amount > 0) {
          monthlyActual[monthIndex] += Math.abs(movement.amount);
        } else {
          monthlyActual[monthIndex] -= Math.abs(movement.amount);
        }
      });

    } catch (error) {
      console.error('Error calculating actual data:', error);
    }

    return monthlyActual;
  }

  private calculateMonthlyComparisons(
    budgetData: number[],
    forecastData: number[],
    actualData: number[]
  ): MonthlyData[] {
    return budgetData.map((budget, index) => {
      const forecast = forecastData[index] || 0;
      const actual = actualData[index] || 0;
      
      // Calculate deviation: (actual - budget) / budget * 100
      const deviation = budget !== 0 ? ((actual - budget) / Math.abs(budget)) * 100 : 0;
      
      // Determine deviation status based on thresholds
      const deviationStatus = this.getDeviationStatus(Math.abs(deviation));
      
      return {
        budget,
        forecast,
        actual,
        deviation,
        deviationStatus
      };
    });
  }

  private calculateYTDTotals(monthlyData: MonthlyData[]): MonthlyData {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // For current year, sum up to current month; for future years, sum all months
    const endMonth = currentYear === new Date().getFullYear() ? currentMonth : 11;
    
    const ytdBudget = monthlyData.slice(0, endMonth + 1).reduce((sum, data) => sum + data.budget, 0);
    const ytdForecast = monthlyData.slice(0, endMonth + 1).reduce((sum, data) => sum + data.forecast, 0);
    const ytdActual = monthlyData.slice(0, endMonth + 1).reduce((sum, data) => sum + data.actual, 0);
    
    const ytdDeviation = ytdBudget !== 0 ? ((ytdActual - ytdBudget) / Math.abs(ytdBudget)) * 100 : 0;
    const deviationStatus = this.getDeviationStatus(Math.abs(ytdDeviation));
    
    return {
      budget: ytdBudget,
      forecast: ytdForecast,
      actual: ytdActual,
      deviation: ytdDeviation,
      deviationStatus
    };
  }

  private calculateKPIs(
    budgetData: number[],
    forecastData: number[],
    actualData: number[]
  ): ComparativaKPIs {
    const currentMonth = new Date().getMonth();
    
    // Calculate YTD sums (up to current month)
    const budgetYTD = budgetData.slice(0, currentMonth + 1).reduce((sum, val) => sum + val, 0);
    const forecastYTD = forecastData.slice(0, currentMonth + 1).reduce((sum, val) => sum + val, 0);
    const actualYTD = actualData.slice(0, currentMonth + 1).reduce((sum, val) => sum + val, 0);
    
    // For this simplified version, assume positive values are ingresos, negative are gastos
    // In reality, would need to separate by category
    const ingresosYTD = {
      budget: Math.max(0, budgetYTD),
      forecast: Math.max(0, forecastYTD),
      actual: Math.max(0, actualYTD)
    };
    
    const gastosYTD = {
      budget: Math.abs(Math.min(0, budgetYTD)),
      forecast: Math.abs(Math.min(0, forecastYTD)),
      actual: Math.abs(Math.min(0, actualYTD))
    };
    
    const resultadoNetoYTD = actualYTD;
    
    // DSCR calculation would require debt service information
    // For now, return null unless we have debt data
    const dscrYTD = null;
    
    return {
      ingresosYTD,
      gastosYTD,
      resultadoNetoYTD,
      dscrYTD
    };
  }

  private async getMonthlyDetails(params: ComparativaParams): Promise<MonthlyDetail[]> {
    // TODO: Implement detailed category breakdown for each month
    // This would require more sophisticated data aggregation by category
    
    // Return empty details for now
    const monthlyDetails: MonthlyDetail[] = [];
    
    for (let month = 0; month < 12; month++) {
      monthlyDetails.push({
        month: month + 1,
        ingresos: [
          {
            category: 'Alquileres',
            budget: 0,
            forecast: 0,
            actual: 0,
            deviation: 0,
            deviationStatus: 'green'
          }
        ],
        gastos: [
          {
            category: 'IBI',
            budget: 0,
            forecast: 0,
            actual: 0,
            deviation: 0,
            deviationStatus: 'green'
          }
        ]
      });
    }
    
    return monthlyDetails;
  }

  private getDeviationStatus(absDeviation: number): 'green' | 'amber' | 'red' {
    if (absDeviation <= 5) return 'green';
    if (absDeviation <= 15) return 'amber';
    return 'red';
  }

  // Export functions
  async exportToCSV(data: ComparativaData, params: ComparativaParams): Promise<string> {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    let csv = 'Mes,Presupuesto,Forecast,Real,Desviación\n';
    
    data.monthlyData.forEach((monthData, index) => {
      const month = monthNames[index];
      const budget = monthData.budget.toLocaleString('es-ES', { minimumFractionDigits: 2 });
      const forecast = monthData.forecast.toLocaleString('es-ES', { minimumFractionDigits: 2 });
      const actual = monthData.actual.toLocaleString('es-ES', { minimumFractionDigits: 2 });
      const deviation = `${monthData.deviation >= 0 ? '+' : ''}${monthData.deviation.toFixed(1)}%`;
      
      csv += `${month},"${budget} €","${forecast} €","${actual} €",${deviation}\n`;
    });

    // Add YTD row
    const ytd = data.ytdTotals;
    const budgetYTD = ytd.budget.toLocaleString('es-ES', { minimumFractionDigits: 2 });
    const forecastYTD = ytd.forecast.toLocaleString('es-ES', { minimumFractionDigits: 2 });
    const actualYTD = ytd.actual.toLocaleString('es-ES', { minimumFractionDigits: 2 });
    const deviationYTD = `${ytd.deviation >= 0 ? '+' : ''}${ytd.deviation.toFixed(1)}%`;
    
    csv += `YTD,"${budgetYTD} €","${forecastYTD} €","${actualYTD} €",${deviationYTD}\n`;

    return csv;
  }

  async exportToPDF(data: ComparativaData, params: ComparativaParams): Promise<Blob> {
    // TODO: Implement PDF export
    // For now, return a simple text blob
    const csvData = await this.exportToCSV(data, params);
    return new Blob([csvData], { type: 'application/pdf' });
  }
}

export const comparativaService = new ComparativaService();