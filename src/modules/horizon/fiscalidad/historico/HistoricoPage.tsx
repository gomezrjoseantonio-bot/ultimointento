import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { calcularDeclaracionIRPF } from '../../../../services/irpfCalculationService';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const CURRENT_YEAR = new Date().getFullYear();
const HISTORIC_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

interface AnioHistorico {
  ejercicio: number;
  cuotaLiquida: number;
  retenciones: number;
  resultado: number;
  tipoEfectivo: number;
}

const HistoricoPage: React.FC = () => {
  const [historico, setHistorico] = useState<AnioHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results: AnioHistorico[] = [];
      for (const year of HISTORIC_YEARS) {
        try {
          const decl = await calcularDeclaracionIRPF(year);
          results.push({
            ejercicio: year,
            cuotaLiquida: decl.liquidacion.cuotaLiquida,
            retenciones: decl.retenciones.total,
            resultado: decl.resultado,
            tipoEfectivo: decl.tipoEfectivo,
          });
        } catch {
          results.push({
            ejercicio: year,
            cuotaLiquida: 0,
            retenciones: 0,
            resultado: 0,
            tipoEfectivo: 0,
          });
        }
      }
      setHistorico(results);
    } catch (e) {
      console.error('Error loading historico:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <PageLayout
      title="Histórico IRPF"
      subtitle="Evolución anual de cuotas, retenciones y resultado de la declaración"
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tabla histórico */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="grid grid-cols-5 text-xs font-semibold text-gray-600 uppercase tracking-wide bg-gray-50 px-4 py-3 border-b border-gray-200">
              <span>Ejercicio</span>
              <span>Cuota líquida</span>
              <span>Retenciones</span>
              <span>Resultado</span>
              <span>Tipo efectivo</span>
            </div>
            {historico.map(row => (
              <div key={row.ejercicio} className="grid grid-cols-5 text-sm px-4 py-3 border-b border-gray-100 last:border-0 items-center">
                <span className="font-semibold text-gray-900">{row.ejercicio}</span>
                <span>{fmt(row.cuotaLiquida)}</span>
                <span className="text-green-700">{fmt(row.retenciones)}</span>
                <span className={`font-medium ${row.resultado > 0 ? 'text-red-600' : row.resultado < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  {row.resultado > 0 ? `A pagar: ${fmt(row.resultado)}` : row.resultado < 0 ? `A devolver: ${fmt(Math.abs(row.resultado))}` : '—'}
                </span>
                <span className="text-gray-600">{row.tipoEfectivo.toFixed(1)}%</span>
              </div>
            ))}
          </div>

          {/* Evolución visual (simple bar chart) */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Evolución cuota líquida vs retenciones</h3>
            <div className="space-y-3">
              {historico.map(row => {
                const maxVal = Math.max(...historico.map(h => Math.max(h.cuotaLiquida, h.retenciones)), 1);
                return (
                  <div key={row.ejercicio}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-700 w-10">{row.ejercicio}</span>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-4 bg-red-400 rounded-sm"
                            style={{ width: `${(row.cuotaLiquida / maxVal) * 100}%` }}
                          />
                          <span className="text-xs text-gray-500">{fmt(row.cuotaLiquida)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-4 bg-green-400 rounded-sm"
                            style={{ width: `${(row.retenciones / maxVal) * 100}%` }}
                          />
                          <span className="text-xs text-gray-500">{fmt(row.retenciones)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded-sm" /><span className="text-xs text-gray-600">Cuota líquida</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-400 rounded-sm" /><span className="text-xs text-gray-600">Retenciones</span></div>
              </div>
            </div>
          </div>

          {/* Note about pending data */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              Los datos históricos se calculan en base a la información disponible en la aplicación. Para ejercicios anteriores es posible que no estén todos los datos introducidos.
            </p>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default HistoricoPage;
