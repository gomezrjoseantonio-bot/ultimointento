// src/modules/horizon/proyeccion/mensual/ProyeccionMensual.tsx
// ATLAS HORIZON: Monthly financial projection page (Phase 1)

import React, { useEffect, useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import { generateProyeccionMensual } from './services/proyeccionMensualService';
import { ProyeccionAnual } from './types/proyeccionMensual';
import MonthlyProjectionTable from './components/MonthlyProjectionTable';
import YearSelector from './components/YearSelector';
import SummaryCards from './components/SummaryCards';

const START_YEAR = new Date().getFullYear();
const PROJECTION_YEARS = 20;

const ALL_YEARS = Array.from(
  { length: PROJECTION_YEARS },
  (_, i) => START_YEAR + i,
);

const ProyeccionMensual: React.FC = () => {
  const [proyecciones, setProyecciones] = useState<ProyeccionAnual[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(START_YEAR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateProyeccionMensual();
      setProyecciones(data);
    } catch (err) {
      console.error('[ProyeccionMensual] Error loading projections:', err);
      setError(
        'No se pudieron calcular las proyecciones. Verifica que tienes datos configurados en los módulos de Nómina, Inmuebles y Préstamos.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentProjection = proyecciones.find(p => p.year === selectedYear);

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proyección Mensual</h1>
        <p className="mt-1 text-sm text-gray-500">
          Proyección financiera detallada basada en tu situación actual
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <span className="text-sm">Calculando proyecciones…</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && proyecciones.length > 0 && (
        <>
          {/* Controls: year selector + export */}
          <div className="flex items-center justify-between">
            <YearSelector
              selectedYear={selectedYear}
              years={ALL_YEARS}
              onChange={setSelectedYear}
            />
            <button
              disabled
              title="Exportación disponible en Fase 2"
              className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Exportar a Excel
            </button>
          </div>

          {/* Summary cards */}
          {currentProjection && (
            <SummaryCards
              ingresos={currentProjection.totalesAnuales.ingresosTotales}
              gastos={currentProjection.totalesAnuales.gastosTotales}
              flujoNeto={currentProjection.totalesAnuales.flujoNetoAnual}
              patrimonioNeto={currentProjection.totalesAnuales.patrimonioNetoFinal}
            />
          )}

          {/* Projection table */}
          {currentProjection ? (
            <MonthlyProjectionTable projection={currentProjection} />
          ) : (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center text-sm text-yellow-800">
              No hay datos de proyección para el año {selectedYear}.
            </div>
          )}
        </>
      )}

      {/* Empty state (no data, no error) */}
      {!loading && !error && proyecciones.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-gray-500 text-sm">
            No se encontraron datos para generar la proyección. Configura al menos una
            nómina, contrato de alquiler o préstamo para ver resultados.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProyeccionMensual;
