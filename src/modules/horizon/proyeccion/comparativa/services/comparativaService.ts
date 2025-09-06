import { initDB, Property } from '../../../../../services/db';
import { getLatestBudgetByYear } from '../../presupuesto/services/budgetService';
import { formatEuro } from '../../../../../utils/formatUtils';

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
        // Use fiscal category to determine if it's income or expense
        if (line.category === 'ingresos-alquiler') {
          monthlyBudget[monthIndex] += amount;
        } else {
          // All other categories are expenses
          monthlyBudget[monthIndex] -= amount;
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
        return moveDate.getFullYear() === params.year && 
               movement.estado_conciliacion === 'conciliado'; // Only reconciled movements
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
        
        // Classify movement as income or expense based on linked records or amount
        if (movement.linked_registro?.type === 'ingreso' || 
            (movement.amount > 0 && !movement.linked_registro)) {
          monthlyActual[monthIndex] += Math.abs(movement.amount);
        } else if (movement.linked_registro?.type === 'gasto' || 
                   movement.linked_registro?.type === 'capex' ||
                   (movement.amount < 0 && !movement.linked_registro)) {
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
    
    // For KPIs, we need separate income and expense calculations
    // Since our main data arrays contain net amounts, we need to get detailed data
    
    // Calculate YTD sums (up to current month)
    const budgetYTD = budgetData.slice(0, currentMonth + 1).reduce((sum, val) => sum + val, 0);
    const forecastYTD = forecastData.slice(0, currentMonth + 1).reduce((sum, val) => sum + val, 0);
    const actualYTD = actualData.slice(0, currentMonth + 1).reduce((sum, val) => sum + val, 0);
    
    // For simplified KPIs, we'll show absolute values for income/expenses
    // In a real implementation, these would come from detailed category breakdowns
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
    const monthlyDetails: MonthlyDetail[] = [];
    
    // Get the latest confirmed budget for the year
    const latestBudget = await getLatestBudgetByYear(params.year);
    
    for (let month = 0; month < 12; month++) {
      const monthDetails: MonthlyDetail = {
        month: month + 1,
        ingresos: [],
        gastos: []
      };
      
      // Income categories
      const incomeCategories = [
        { category: 'Alquileres', fiscalCategory: 'ingresos-alquiler' as any }
      ];
      
      // Expense categories
      const expenseCategories = [
        { category: 'Hipoteca/Intereses', fiscalCategory: 'intereses-prestamos' as any },
        { category: 'IBI', fiscalCategory: 'ibi' as any },
        { category: 'Seguro', fiscalCategory: 'seguros' as any },
        { category: 'Comunidad', fiscalCategory: 'comunidad' as any },
        { category: 'Suministros', fiscalCategory: 'suministros' as any },
        { category: 'Reparación y conservación', fiscalCategory: 'reparacion-conservacion' as any },
        { category: 'Mejora', fiscalCategory: 'mejora' as any },
        { category: 'Mobiliario', fiscalCategory: 'mobiliario' as any },
        { category: 'Otros', fiscalCategory: 'otros-deducibles' as any }
      ];
      
      // Calculate budget amounts for each category
      incomeCategories.forEach(catConfig => {
        let budgetAmount = 0;
        if (latestBudget && latestBudget.status === 'confirmed') {
          const relevantLines = latestBudget.lines.filter(line => 
            line.category === catConfig.fiscalCategory &&
            (!params.propertyId || line.propertyId === params.propertyId)
          );
          budgetAmount = relevantLines.reduce((sum, line) => sum + (line.monthlyAmounts[month] || 0), 0);
        }
        
        // For now, use budget as forecast (would be calculated dynamically in real implementation)
        const forecastAmount = budgetAmount * (0.95 + Math.random() * 0.1); // ±5% variance
        
        // Actual would come from treasury movements - placeholder for now
        const actualAmount = 0;
        
        const deviation = budgetAmount !== 0 ? ((actualAmount - budgetAmount) / Math.abs(budgetAmount)) * 100 : 0;
        const deviationStatus = this.getDeviationStatus(Math.abs(deviation));
        
        monthDetails.ingresos.push({
          category: catConfig.category,
          budget: budgetAmount,
          forecast: forecastAmount,
          actual: actualAmount,
          deviation,
          deviationStatus
        });
      });
      
      // Calculate expense amounts for each category
      expenseCategories.forEach(catConfig => {
        let budgetAmount = 0;
        if (latestBudget && latestBudget.status === 'confirmed') {
          const relevantLines = latestBudget.lines.filter(line => 
            line.category === catConfig.fiscalCategory &&
            (!params.propertyId || line.propertyId === params.propertyId)
          );
          budgetAmount = relevantLines.reduce((sum, line) => sum + (line.monthlyAmounts[month] || 0), 0);
        }
        
        // For now, use budget as forecast (would be calculated dynamically in real implementation)
        const forecastAmount = budgetAmount * (0.95 + Math.random() * 0.1); // ±5% variance
        
        // Actual would come from treasury movements - placeholder for now
        const actualAmount = 0;
        
        const deviation = budgetAmount !== 0 ? ((actualAmount - budgetAmount) / Math.abs(budgetAmount)) * 100 : 0;
        const deviationStatus = this.getDeviationStatus(Math.abs(deviation));
        
        monthDetails.gastos.push({
          category: catConfig.category,
          budget: budgetAmount,
          forecast: forecastAmount,
          actual: actualAmount,
          deviation,
          deviationStatus
        });
      });
      
      monthlyDetails.push(monthDetails);
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
    // Dynamic import to avoid bundling issues
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Comparativa Anual', 20, 20);
    
    // Add subtitle with parameters
    doc.setFontSize(12);
    const subtitle = `Año ${params.year} - ${params.scope === 'consolidado' ? 'Consolidado' : 'Por inmueble'}`;
    doc.text(subtitle, 20, 30);
    
    // Add generation date
    doc.setFontSize(10);
    const currentDate = new Date().toLocaleDateString('es-ES');
    doc.text(`Generado el ${currentDate}`, 20, 40);
    
    // Monthly data table
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const tableData = data.monthlyData.map((monthData, index) => [
      monthNames[index],
      monthData.budget.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
      monthData.forecast.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
      monthData.actual.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
      `${monthData.deviation >= 0 ? '+' : ''}${monthData.deviation.toFixed(1)}%`
    ]);
    
    // Add YTD totals row
    const ytd = data.ytdTotals;
    tableData.push([
      'YTD',
      ytd.budget.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
      ytd.forecast.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
      ytd.actual.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
      `${ytd.deviation >= 0 ? '+' : ''}${ytd.deviation.toFixed(1)}%`
    ]);
    
    autoTable(doc, {
      head: [['Mes', 'Presupuesto', 'Forecast', 'Real', 'Desviación']],
      body: tableData,
      startY: 50,
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [11, 43, 92], // Navy color from Horizon theme
        textColor: 255
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        1: { halign: 'right' }, // Budget
        2: { halign: 'right' }, // Forecast
        3: { halign: 'right' }, // Actual
        4: { halign: 'center' } // Deviation
      }
    });
    
    // Add KPI summary
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    
    doc.setFontSize(14);
    doc.text('Resumen KPIs YTD', 20, finalY + 20);
    
    doc.setFontSize(10);
    const kpiY = finalY + 30;
    doc.text(`Ingresos YTD: Budget ${formatEuro(data.kpis.ingresosYTD.budget)}, Forecast ${formatEuro(data.kpis.ingresosYTD.forecast)}, Actual ${formatEuro(data.kpis.ingresosYTD.actual)}`, 20, kpiY);
    doc.text(`Gastos YTD: Budget ${formatEuro(data.kpis.gastosYTD.budget)}, Forecast ${formatEuro(data.kpis.gastosYTD.forecast)}, Actual ${formatEuro(data.kpis.gastosYTD.actual)}`, 20, kpiY + 8);
    doc.text(`Resultado neto YTD: ${formatEuro(data.kpis.resultadoNetoYTD)}`, 20, kpiY + 16);
    
    if (data.kpis.dscrYTD !== null) {
      doc.text(`DSCR YTD: ${data.kpis.dscrYTD.toFixed(2)} x`, 20, kpiY + 24);
    }
    
    return doc.output('blob');
  }
}

export const comparativaService = new ComparativaService();