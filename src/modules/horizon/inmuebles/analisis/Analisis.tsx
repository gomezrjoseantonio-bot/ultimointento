import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import EmptyState from '../../../../components/common/EmptyState';
import { BarChart3 } from 'lucide-react';
import { Property, initDB } from '../../../../services/db';
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
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration - In production, this would come from actual property data
  const [mockInputs, setMockInputs] = useState({
    ingresosMensuales: 1200,
    gastosOperativos: 150,
    cuotaHipoteca: 600,
    valorActualActivo: 250000,
    deudaPendiente: 180000,
    precioTotalCompra: 200000,
    noi: 12600, // Net Operating Income
    amortizacionAnual: 3000,
    revalorizacionAnual: 5000,
    precioVenta: 260000,
    comisionVenta: 8000,
    comisionCancelacion: 1800,
    itpOIva: 12000,
    reformaTotal: 5000,
    gastosCompra: 8000,
  });

  const loadProperties = useCallback(async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const allProperties = await db.getAll('properties');
      const activeProperties = allProperties.filter(p => p.state === 'activo');
      setProperties(activeProperties);
      
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
      calculateAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, mockInputs, properties]);

  const calculateAnalysis = () => {
    const property = properties.find(p => p.id === selectedPropertyId);
    if (!property) return;

    // Calculate operational performance
    const operational = calculateOperationalPerformance(
      mockInputs.ingresosMensuales,
      mockInputs.gastosOperativos,
      mockInputs.cuotaHipoteca
    );

    // Calculate financial profitability
    const financial = calculateFinancialProfitability(
      mockInputs.valorActualActivo,
      mockInputs.deudaPendiente,
      mockInputs.precioTotalCompra,
      operational.ingresosMensuales * 12,
      mockInputs.noi,
      operational.cashflowAnual,
      mockInputs.amortizacionAnual,
      mockInputs.revalorizacionAnual
    );

    // Calculate fiscal ROI
    const fiscal = calculateFiscalROI(
      operational.cashflowAnual,
      financial.equityActual,
      DEFAULT_ANALYSIS_CONFIG
    );

    // Calculate sale simulation
    const saleSimulation = calculateSaleSimulation(
      mockInputs.precioVenta,
      mockInputs.comisionVenta,
      mockInputs.deudaPendiente,
      mockInputs.comisionCancelacion,
      mockInputs.precioTotalCompra,
      mockInputs.itpOIva,
      mockInputs.reformaTotal,
      mockInputs.gastosCompra,
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
    setMockInputs(prev => ({ ...prev, precioVenta: value }));
  };

  const handleUpdateCommission = (value: number) => {
    setMockInputs(prev => ({ ...prev, comisionVenta: value }));
  };

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
        <div className="p-6 rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
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
        <div className="p-6 rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-base font-semibold mb-6" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            BLOQUE 3 — Simulación de venta + Recomendación + Acción
          </h2>
          
          <div className="space-y-8">
            <SaleSimulationSection
              data={analysis.saleSimulation}
              onUpdateSalePrice={handleUpdateSalePrice}
              onUpdateCommission={handleUpdateCommission}
            />
            
            <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
            
            <RecommendationActionSection
              fiscalROI={analysis.fiscal}
              capitalNetoFinal={analysis.saleSimulation.capitalNetoFinal}
              onDecision={handleDecision}
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