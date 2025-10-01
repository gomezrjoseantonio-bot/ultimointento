import React, { useState, useEffect } from 'react';
import { TrendingUp, Settings, PiggyBank, Target } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { formatEuro, formatPercentage } from '../../../../utils/formatUtils';
import AdjustAssumptionsModal from './components/AdjustAssumptionsModal';
import ProjectionChart from './components/ProjectionChart';
import { proyeccionService } from './services/proyeccionService';
import type { BaseAssumptions, BaseProjection } from './services/proyeccionService';

interface ProyeccionBaseProps {
  isEmbedded?: boolean;
}

const ProyeccionBase: React.FC<ProyeccionBaseProps> = ({ isEmbedded = false }): React.ReactElement => {
  const [assumptions, setAssumptions] = useState<BaseAssumptions | null>(null);
  const [projection, setProjection] = useState<BaseProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const [baseAssumptions, baseProjection] = await Promise.all([
        proyeccionService.getBaseAssumptions(),
        proyeccionService.getBaseProjection()
      ]);
      setAssumptions(baseAssumptions);
      setProjection(baseProjection);
    } catch (error) {
      console.error('Error loading base data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssumptionsUpdate = async (newAssumptions: BaseAssumptions) => {
    try {
      await proyeccionService.saveBaseAssumptions(newAssumptions);
      const updatedProjection = await proyeccionService.getBaseProjection();
      setAssumptions(newAssumptions);
      setProjection(updatedProjection);
      setShowModal(false);
    } catch (error) {
      console.error('Error updating assumptions:', error);
    }
  };

  if (loading) {
    const content = (
      <div className="flex justify-center py-12">
        <div className="btn-secondary-horizon animate-spin h-8 w-8 "></div>
      </div>
    );
    
    if (isEmbedded) return content;
    
    return (
      <PageLayout title="Proyección Base" subtitle="Cargando datos...">
        {content}
      </PageLayout>
    );
  }

  if (!projection || !assumptions) {
    const content = (
      <div className="text-center py-12 bg-gray-50">
        <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay datos para mostrar
        </h3>
        <p className="text-gray-600">
          Configura tus contratos de alquiler e hipotecas para ver la proyección base
        </p>
      </div>
    );
    
    if (isEmbedded) return content;
    
    return (
      <PageLayout title="Proyección Base" subtitle="No hay datos disponibles">
        {content}
      </PageLayout>
    );
  }

  const content = (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Proyección</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="atlas-atlas-atlas-atlas-btn-primary flex items-center space-x-2 px-4 py-2"
          >
            <Settings className="h-4 w-4" />
            <span>Ajustar supuestos</span>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cashflow neto anual actual */}
          <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-[#F8F9FA]">
                <TrendingUp className="h-5 w-5 text-primary-700" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Cashflow neto anual actual</p>
              </div>
            </div>
            <p className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {formatEuro(projection.currentAnnualCashflow)}
            </p>
          </div>

          {/* Patrimonio neto estimado a 20 años */}
          <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-[#F8F9FA]">
                <PiggyBank className="h-5 w-5 text-primary-700" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Patrimonio neto estimado (20a)</p>
              </div>
            </div>
            <p className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {formatEuro(projection.netWorth20Y)}
            </p>
          </div>

          {/* DSCR actual */}
          <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-[#F8F9FA]">
                <Target className="h-5 w-5 text-primary-700" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">DSCR actual</p>
              </div>
            </div>
            <p className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {projection.currentDSCR.toFixed(2)} x
            </p>
          </div>
        </div>

        {/* Main Chart */}
        <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-6">
            Proyección a 20 años
          </h3>
          <ProjectionChart data={projection.yearlyData} />
        </div>

        {/* Assumptions Summary */}
        <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Supuestos base
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-primary-700 tabular-nums">
                {formatPercentage(assumptions.rentGrowth / 100)}
              </p>
              <p className="text-sm text-gray-500">Crecimiento rentas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-primary-700 tabular-nums">
                {formatPercentage(assumptions.expenseInflation / 100)}
              </p>
              <p className="text-sm text-gray-500">Inflación gastos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-primary-700 tabular-nums">
                {formatPercentage(assumptions.propertyAppreciation / 100)}
              </p>
              <p className="text-sm text-gray-500">Revalorización activos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-primary-700 tabular-nums">
                {formatPercentage(assumptions.vacancyRate / 100)}
              </p>
              <p className="text-sm text-gray-500">Vacancia</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-primary-700 tabular-nums">
                {formatPercentage(assumptions.referenceRate / 100)}
              </p>
              <p className="text-sm text-gray-500">Tipo de interés ref.</p>
            </div>
          </div>
        </div>

        {/* Top Impacts */}
        {projection.upcomingImpacts.length > 0 && (
          <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Top impactos próximos 90 días
            </h3>
            <div className="flex flex-wrap gap-2">
              {projection.upcomingImpacts.map((impact, index) => (
                <div
                  key={index}
                  className="inline-flex items-center px-3 py-1 text-sm bg-[#F8F9FA] text-primary-700 border border-[#D7DEE7]"
                >
                  {impact.description}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adjust Assumptions Modal */}
        {showModal && (
          <AdjustAssumptionsModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            assumptions={assumptions}
            onSave={handleAssumptionsUpdate}
          />
        )}
      </div>
    );

    if (isEmbedded) return content;

    return (
      <PageLayout title="Proyección Base" subtitle="Línea base a 20 años derivada de contratos y gastos recurrentes">
        {content}
      </PageLayout>
    );
};

export default ProyeccionBase;