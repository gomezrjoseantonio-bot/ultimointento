import React, { useState, useEffect, useCallback } from 'react';
import { CalendarIcon, TrendingUpIcon, AlertTriangleIcon, Download } from 'lucide-react';
import { AEATCarryForward, PropertyDays, initDB, Property } from '../../../../../services/db';
import { calculateAEATLimits } from '../../../../../utils/aeatUtils';
import { formatEuro } from '../../../../../utils/formatUtils';
import toast from 'react-hot-toast';

interface PropertySummary {
  property: Property;
  expenses: {
    financiacion: number;
    reparacionConservacion: number;
    tributos: number;
    seguros: number;
    serviciosPersonales: number;
    capexMejora: number;
    mobiliario: number;
  };
  limits: {
    totalIncome: number;
    limit: number;
    applied: number;
    excess: number;
  };
  carryForwards: AEATCarryForward[];
  days: PropertyDays | null;
}

const ResumenTab: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [summaries, setSummaries] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const availableYears = [2023, 2024, 2025]; // Simplified for demo

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await initDB();
      
      const [propertiesData, expensesData, carryForwardsData, propertyDaysData] = await Promise.all([
        db.getAll('properties'),
        db.getAll('expensesH5'),
        db.getAll('aeatCarryForwards'),
        db.getAll('propertyDays')
      ]);

      // Group data by property
      const summariesData: PropertySummary[] = propertiesData.map(property => {
        // Filter expenses for current year and property
        const propertyExpenses = expensesData.filter(
          exp => exp.propertyId === property.id && exp.taxYear === selectedYear
        );

        // Calculate expense totals by category
        const expenses = propertyExpenses.reduce((acc, exp) => {
          switch (exp.fiscalType) {
            case 'financiacion':
              acc.financiacion += exp.amount;
              break;
            case 'reparacion-conservacion':
              acc.reparacionConservacion += exp.amount;
              break;
            case 'tributos-locales':
              acc.tributos += exp.amount;
              break;
            case 'seguros':
              acc.seguros += exp.amount;
              break;
            case 'servicios-personales':
              acc.serviciosPersonales += exp.amount;
              break;
            case 'capex-mejora-ampliacion':
              acc.capexMejora += exp.amount;
              break;
            case 'amortizacion-muebles':
              acc.mobiliario += exp.amount;
              break;
          }
          return acc;
        }, {
          financiacion: 0,
          reparacionConservacion: 0,
          tributos: 0,
          seguros: 0,
          serviciosPersonales: 0,
          capexMejora: 0,
          mobiliario: 0
        });

        // Get property carry forwards for current year
        const propertyCarryForwards = carryForwardsData.filter(
          cf => cf.propertyId === property.id && cf.taxYear === selectedYear
        );

        // Get property days for current year
        const propertyDays = propertyDaysData.find(
          pd => pd.propertyId === property.id && pd.taxYear === selectedYear
        ) || null;

        // Calculate AEAT limits (using a default income if not available)
        const totalIncome = propertyCarryForwards[0]?.totalIncome || 0;
        const limits = calculateAEATLimits(
          totalIncome,
          expenses.financiacion,
          expenses.reparacionConservacion
        );

        return {
          property,
          expenses,
          limits: {
            totalIncome,
            ...limits
          },
          carryForwards: propertyCarryForwards,
          days: propertyDays
        };
      });

      setSummaries(summariesData);
    } catch (error) {
      console.error('Error loading summary data:', error);
      toast.error('Error al cargar el resumen');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [selectedYear, loadData]);

  // Export to CSV functionality
  const exportToCSV = () => {
    try {
      // Create CSV content
      const headers = [
        'Inmueble',
        'Dirección', 
        'Año',
        'Financiación',
        'R&C',
        'Tributos',
        'Seguros',
        'Servicios Personales',
        'CAPEX Mejora',
        'Mobiliario (10a)',
        'Total Gastos',
        'Ingresos Íntegros',
        'Límite AEAT',
        'Límite Aplicado',
        'Exceso'
      ];

      const rows = summaries.map(summary => [
        summary.property.alias,
        summary.property.address,
        selectedYear.toString(),
        summary.expenses.financiacion.toFixed(2),
        summary.expenses.reparacionConservacion.toFixed(2),
        summary.expenses.tributos.toFixed(2),
        summary.expenses.seguros.toFixed(2),
        summary.expenses.serviciosPersonales.toFixed(2),
        summary.expenses.capexMejora.toFixed(2),
        summary.expenses.mobiliario.toFixed(2),
        (Object.values(summary.expenses).reduce((a, b) => a + b, 0)).toFixed(2),
        summary.limits.totalIncome.toFixed(2),
        summary.limits.limit.toFixed(2),
        summary.limits.applied.toFixed(2),
        summary.limits.excess.toFixed(2)
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `gastos-capex-resumen-${selectedYear}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Resumen exportado a CSV correctamente');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Error al exportar el resumen');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Year Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Resumen por inmueble y año</h2>
          <p className="text-sm text-gray-600">
            Tarjetas por categoría y límites AEAT con arrastres
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={exportToCSV}
            disabled={summaries.length === 0}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-brand-navy hover:bg-brand-navy/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-navy disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </button>
          <CalendarIcon className="h-5 w-5 text-gray-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Property Summaries */}
      <div className="space-y-8">
        {summaries.map((summary) => (
          <PropertySummaryCard
            key={summary.property.id}
            summary={summary}
            selectedYear={selectedYear}
          />
        ))}
      </div>

      {summaries.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 text-lg mb-2">No hay datos para {selectedYear}</div>
          <p className="text-gray-500">
            Los resúmenes aparecerán cuando registres gastos para este año.
          </p>
        </div>
      )}
    </div>
  );
};

// Property Summary Card Component
interface PropertySummaryCardProps {
  summary: PropertySummary;
  selectedYear: number;
}

const PropertySummaryCard: React.FC<PropertySummaryCardProps> = ({ summary, selectedYear }) => {
  const { property, expenses, limits, carryForwards, days } = summary;

  const categoryCards = [
    { label: 'Financiación', amount: expenses.financiacion, color: 'bg-primary-100 border-primary-200' },
    { label: 'R&C', amount: expenses.reparacionConservacion, color: 'bg-success-100 border-success-200' },
    { label: 'Tributos', amount: expenses.tributos, color: 'bg-warning-100 border-yellow-200' },
    { label: 'Seguros', amount: expenses.seguros, color: 'bg-primary-100 border-primary-200' },
    { label: 'Servicios personales', amount: expenses.serviciosPersonales, color: 'bg-teal-100 border-teal-200' },
    { label: 'CAPEX Mejora', amount: expenses.capexMejora, color: 'bg-warning-100 border-orange-200' },
    { label: 'Mobiliario (10a)', amount: expenses.mobiliario, color: 'bg-pink-100 border-pink-200' }
  ];

  const getTotalCarryForwardPending = (): number => {
    return carryForwards
      .filter(cf => cf.expirationYear > selectedYear && cf.remainingAmount > 0)
      .reduce((sum, cf) => sum + cf.remainingAmount, 0);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Property Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{property.alias}</h3>
        <p className="text-sm text-gray-600">{property.address}</p>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {categoryCards.map((card) => (
          <div
            key={card.label}
            className={`p-4 rounded-lg border ${card.color}`}
          >
            <div className="text-xs font-medium text-gray-600 mb-1">{card.label}</div>
            <div className="text-lg font-semibold text-gray-900">
              {card.amount > 0 ? formatEuro(card.amount) : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* AEAT Limits Section */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
          <TrendingUpIcon className="h-5 w-5 mr-2 text-brand-navy" />
          Límite AEAT ({selectedYear})
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-600 mb-1">Ingresos íntegros</div>
            <div className="text-sm font-medium text-gray-900">
              {limits.totalIncome > 0 ? formatEuro(limits.totalIncome) : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Límite</div>
            <div className="text-sm font-medium text-gray-900">
              {formatEuro(limits.limit)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Aplicado este año</div>
            <div className="text-sm font-medium text-success-700">
              {formatEuro(limits.applied)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Exceso arrastrable</div>
            <div className="text-sm font-medium text-orange-700">
              {limits.excess > 0 ? formatEuro(limits.excess) : '—'}
            </div>
          </div>
        </div>

        {limits.excess > 0 && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
            <div className="flex items-center">
              <AlertTriangleIcon className="h-4 w-4 text-orange-500 mr-2" />
              <span className="text-xs text-orange-700">
                Se ha generado un arrastre de {formatEuro(limits.excess)} con caducidad en {selectedYear + 4}
              </span>
            </div>
          </div>
        )}

        {/* Pending Carry Forwards */}
        {getTotalCarryForwardPending() > 0 && (
          <div className="mt-3">
            <div className="text-xs text-gray-600 mb-1">Pendiente de futuro</div>
            <div className="text-sm font-medium text-brand-navy">
              {formatEuro(getTotalCarryForwardPending())}
            </div>
            <div className="text-xs text-gray-500">
              Saldo de arrastres por años futuros
            </div>
          </div>
        )}
      </div>

      {/* Rental/Availability Days */}
      <div className="bg-primary-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">
          Días arrendado / a disposición
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-600 mb-1">Días arrendado</div>
            <div className="text-sm font-medium text-gray-900">
              {days?.daysRented || 0} días
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Días a disposición</div>
            <div className="text-sm font-medium text-gray-900">
              {days?.daysAvailable || 0} días
            </div>
          </div>
        </div>

        {(!days || days.daysRented === 0) && (
          <div className="mt-2 text-xs text-primary-600">
            Sin contratos registrados. Permite input anual provisional.
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumenTab;