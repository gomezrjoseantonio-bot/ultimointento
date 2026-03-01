import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import EmptyState from '../../../../components/common/EmptyState';
import { BarChart3 } from 'lucide-react';
import { Property, initDB } from '../../../../services/db';
import type { Contract, Ingreso } from '../../../../services/db';
import type { Prestamo } from '../../../../types/prestamos';
import type { ValoracionHistorica } from '../../../../types/valoraciones';
import {
  getAnnualOpexForProperty,
  getExpenseDiagnosticsForProperty,
} from '../../../../services/propertyExpenses';
import { 
  PropertyAnalysis, 
  PropertyDecision,
  DEFAULT_ANALYSIS_CONFIG 
} from '../../../../types/propertyAnalysis';
import {
  calculateOperationalPerformance,
  calculateFinancialProfitability,
  calculateFiscalROI,
  calculateSaleSimulation,
  buildPropertyAnalysisInputs,
} from '../../../../utils/propertyAnalysisUtils';
import PropertyHeader from './components/PropertyHeader';
import OperationalPerformanceSection from './components/OperationalPerformanceSection';
import FinancialProfitabilitySection from './components/FinancialProfitabilitySection';
import FiscalROISection from './components/FiscalROISection';
import SaleSimulationSection from './components/SaleSimulationSection';
import RecommendationActionSection from './components/RecommendationActionSection';
import toast from 'react-hot-toast';

const Analisis: React.FC = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<PropertyAnalysis | null>(null);
  const [saleOverrides, setSaleOverrides] = useState<{ precioVenta: number; comisionVenta: number } | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [valoraciones, setValoraciones] = useState<ValoracionHistorica[]>([]);
  const [gastosOperativosMensuales, setGastosOperativosMensuales] = useState<number>(0);
  const [expenseWarning, setExpenseWarning] = useState<string | null>(null);
  const [mortgageWarning, setMortgageWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProperties = useCallback(async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const [
        allProperties,
        contractsData,
        ingresosData,
        prestamosData,
        valoracionesData,
      ] = await Promise.all([
        db.getAll('properties'),
        db.getAll('contracts'),
        db.getAll('ingresos'),
        db.getAll('prestamos'),
        db.getAll('valoraciones_historicas'),
      ]);
      const activeProperties = allProperties.filter(p => p.state === 'activo');
      setProperties(activeProperties);
      setContracts(contractsData);
      setIngresos(ingresosData);
      setPrestamos(prestamosData as Prestamo[]);
      setValoraciones(valoracionesData as ValoracionHistorica[]);
      
      if (activeProperties.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(activeProperties[0].id!);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Error al cargar los inmuebles');
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (selectedPropertyId && properties.length > 0) {
      void calculateAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, properties, contracts, ingresos, prestamos, valoraciones, saleOverrides]);

  const calculateAnalysis = async () => {
    const property = properties.find(p => p.id === selectedPropertyId);
    if (!property) return;

    const propertyId = property.id!;
    const annualOpex = await getAnnualOpexForProperty(propertyId);
    const diagnostics = await getExpenseDiagnosticsForProperty(propertyId);
    const monthlyOpex = annualOpex / 12;

    setGastosOperativosMensuales(monthlyOpex);
    setExpenseWarning(diagnostics.warning || null);

    const { inputs, missingFields: missingData, warnings } = buildPropertyAnalysisInputs({
      property,
      contracts,
      ingresos,
      gastosOperativosOverride: monthlyOpex,
      prestamos,
      valoraciones,
    });

    const mergedInputs = {
      ...inputs,
      ...(saleOverrides ? {
        precioVenta: saleOverrides.precioVenta,
        comisionVenta: saleOverrides.comisionVenta,
      } : {}),
    };

    setMissingFields(missingData);
    setMortgageWarning(warnings.length > 0 ? warnings.join(' ') : null);

    // Calculate operational performance
    const operational = calculateOperationalPerformance(
      mergedInputs.ingresosMensuales,
      mergedInputs.gastosOperativos,
      mergedInputs.cuotaHipoteca
    );

    // Calculate financial profitability
    const financial = calculateFinancialProfitability(
      mergedInputs.valorActualActivo,
      mergedInputs.deudaPendiente,
      mergedInputs.precioTotalCompra,
      operational.ingresosMensuales * 12,
      mergedInputs.noi,
      operational.cashflowAnual,
      mergedInputs.amortizacionAnual,
      mergedInputs.revalorizacionAnual
    );

    // Calculate fiscal ROI
    const fiscal = calculateFiscalROI(
      operational.cashflowAnual,
      financial.equityActual,
      DEFAULT_ANALYSIS_CONFIG
    );

    // Calculate sale simulation
    const saleSimulation = calculateSaleSimulation(
      mergedInputs.precioVenta,
      mergedInputs.comisionVenta,
      mergedInputs.deudaPendiente,
      mergedInputs.comisionCancelacion,
      mergedInputs.precioTotalCompra,
      mergedInputs.itpOIva,
      mergedInputs.reformaTotal,
      mergedInputs.gastosCompra,
      DEFAULT_ANALYSIS_CONFIG
    );

    const newAnalysis: PropertyAnalysis = {
      propertyId: property.id!,
      propertyAlias: property.alias,
      location: `${property.municipality}, ${property.province}`,
      purchaseDate: new Date(property.purchaseDate).toLocaleDateString('es-ES'),
      operational,
      financial,
      fiscal,
      saleSimulation,
      lastUpdated: new Date().toISOString(),
    };

    setAnalysis(newAnalysis);
  };

  const handleUpdateSalePrice = (value: number) => {
    setSaleOverrides(prev => ({
      precioVenta: value,
      comisionVenta: prev?.comisionVenta ?? analysis?.saleSimulation.comisionVenta ?? 0,
    }));
  };

  const handleUpdateCommission = (value: number) => {
    setSaleOverrides(prev => ({
      precioVenta: prev?.precioVenta ?? analysis?.saleSimulation.precioVenta ?? 0,
      comisionVenta: value,
    }));
  };

  useEffect(() => {
    setSaleOverrides(null);
  }, [selectedPropertyId]);

  const handleDecision = (decision: PropertyDecision, targetDate?: string) => {
    if (!analysis) return;

    const updatedAnalysis: PropertyAnalysis = {
      ...analysis,
      decision,
      decisionDate: new Date().toISOString(),
      ...(decision === 'REVISAR' && targetDate && { reviewScheduledDate: targetDate }),
      ...(decision === 'VENDER' && targetDate && { targetSaleDate: targetDate }),
    };

    setAnalysis(updatedAnalysis);

    // Show success message
    let message = '';
    switch (decision) {
      case 'MANTENER':
        message = 'Estado guardado: Mantener activo';
        break;
      case 'REVISAR':
        message = `Revisión agendada para ${targetDate}`;
        break;
      case 'VENDER':
        message = `Venta objetivo programada para ${targetDate}`;
        break;
    }
    toast.success(message);

    // In production, this would save to database and potentially trigger Plan Base/Copiloto
  };

  if (loading) {
    return (
      <PageLayout
        title="Análisis"
        subtitle="Análisis de rentabilidad y rendimiento con métricas avanzadas"
      >
        <div className="flex items-center justify-center min-h-96">
          <div className="text-neutral-600">Cargando análisis...</div>
        </div>
      </PageLayout>
    );
  }

  const hasMissingData = missingFields.length > 0;

  if (properties.length === 0) {
    return (
      <PageLayout
        title="Análisis"
        subtitle="Análisis de rentabilidad y rendimiento con métricas avanzadas"
      >
        <EmptyState
          icon={<BarChart3 className="h-12 w-12 text-gray-400" />}
          title="Sin inmuebles activos"
          description="No tienes inmuebles activos en cartera. Añade un inmueble para comenzar el análisis."
          action={{
            label: "Ir a Cartera",
            onClick: () => navigate('/inmuebles/cartera')
          }}
        />
      </PageLayout>
    );
  }

  if (!analysis) {
    return (
      <PageLayout
        title="Análisis"
        subtitle="Análisis de rentabilidad y rendimiento con métricas avanzadas"
      >
        <div className="flex items-center justify-center min-h-96">
          <div className="text-neutral-600">Calculando análisis...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Análisis"
      subtitle="Análisis de rentabilidad y rendimiento con métricas avanzadas"
    >
      <div className="space-y-6">
        {hasMissingData && (
          <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--error)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-sm" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
              <strong>Faltan datos para calcular la rentabilidad.</strong> Completa: {missingFields.join(', ')}.
            </div>
          </div>
        )}

        {expenseWarning && (
          <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--warning)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-sm" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
              <strong>Gastos OPEX.</strong> {expenseWarning} (estimado mensual: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(gastosOperativosMensuales)}).
            </div>
          </div>
        )}


        {mortgageWarning && (
          <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--warning)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-sm" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
              <strong>Hipoteca.</strong> {mortgageWarning}
            </div>
          </div>
        )}

        {/* Property selector */}
        {properties.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Seleccionar inmueble
            </label>
            <select
              value={selectedPropertyId || ''}
              onChange={(e) => setSelectedPropertyId(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-md text-sm"
              style={{ fontSize: '14px' }}
            >
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.alias}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Header with traffic light */}
        <PropertyHeader
          propertyAlias={analysis.propertyAlias}
          location={analysis.location}
          purchaseDate={analysis.purchaseDate}
          fiscalROI={analysis.fiscal}
        />

        {/* BLOQUE 1 - Current Performance and Fiscal ROI */}
        <div
          className="p-6 rounded-lg border"
          style={{
            borderColor: 'var(--border-color)',
            opacity: hasMissingData ? 0.65 : 1,
          }}
        >
          <h2 className="text-base font-semibold mb-6" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            BLOQUE 1 — Rendimiento actual y ROI fiscal
          </h2>
          
          <div className="space-y-8">
            <OperationalPerformanceSection data={analysis.operational} />
            
            <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
            
            <FinancialProfitabilitySection data={analysis.financial} />
            
            <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
            
            <FiscalROISection data={analysis.fiscal} />
          </div>
        </div>

        {/* BLOQUE 3 - Sale Simulation + Recommendation + Action */}
        <div
          className="p-6 rounded-lg border"
          style={{
            borderColor: 'var(--border-color)',
            opacity: hasMissingData ? 0.65 : 1,
          }}
        >
          <h2 className="text-base font-semibold mb-6" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            BLOQUE 3 — Simulación de venta + Recomendación + Acción
          </h2>
          
          <div className="space-y-8">
            <SaleSimulationSection
              data={analysis.saleSimulation}
              onUpdateSalePrice={handleUpdateSalePrice}
              onUpdateCommission={handleUpdateCommission}
              disabled={hasMissingData}
            />
            
            <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
            
            <RecommendationActionSection
              fiscalROI={analysis.fiscal}
              capitalNetoFinal={analysis.saleSimulation.capitalNetoFinal}
              onDecision={handleDecision}
              disabled={hasMissingData}
            />
          </div>
        </div>

        {/* Decision status (if any) */}
        {analysis.decision && (
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-sm" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
              <strong>Última decisión:</strong> {analysis.decision}
              {analysis.reviewScheduledDate && ` - Revisión programada: ${analysis.reviewScheduledDate}`}
              {analysis.targetSaleDate && ` - Venta objetivo: ${analysis.targetSaleDate}`}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Analisis;
