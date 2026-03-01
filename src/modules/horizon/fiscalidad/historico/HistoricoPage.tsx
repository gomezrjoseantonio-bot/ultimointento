import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CircleDollarSign, HandCoins } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { calcularDeclaracionIRPF } from '../../../../services/irpfCalculationService';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
          <div
            className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
            style={{ borderColor: 'var(--hz-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tabla histórico */}
          <div className="bg-[var(--hz-card-bg)] border border-[color:var(--hz-neutral-300)] rounded-lg shadow-sm overflow-hidden">
            <div className="grid grid-cols-5 text-xs font-semibold text-[var(--hz-neutral-700)] uppercase tracking-wide bg-[var(--hz-neutral-100)] px-4 py-3 border-b border-[color:var(--hz-neutral-300)]">
              <span>Ejercicio</span>
              <span>Cuota líquida</span>
              <span>Retenciones</span>
              <span>Resultado</span>
              <span>Tipo efectivo</span>
            </div>
            {historico.map(row => (
              <div key={row.ejercicio} className="grid grid-cols-5 text-sm px-4 py-3 border-b border-[color:var(--hz-neutral-100)] last:border-0 items-center">
                <span className="font-semibold text-[var(--hz-neutral-900)]">{row.ejercicio}</span>
                <span>{fmt(row.cuotaLiquida)}</span>
                <span style={{ color: 'var(--ok)' }}>{fmt(row.retenciones)}</span>
                <span
                  className="font-medium"
                  style={{
                    color: row.resultado > 0
                      ? 'var(--error)'
                      : row.resultado < 0
                        ? 'var(--ok)'
                        : 'var(--hz-neutral-500)'
                  }}
                >
                  {row.resultado > 0 ? `A pagar: ${fmt(row.resultado)}` : row.resultado < 0 ? `A devolver: ${fmt(Math.abs(row.resultado))}` : '—'}
                </span>
                <span className="text-[var(--hz-neutral-700)]">{row.tipoEfectivo.toFixed(1)}%</span>
              </div>
            ))}
          </div>

          {/* Evolución visual */}
          <div className="bg-[var(--hz-card-bg)] border border-[color:var(--hz-neutral-300)] rounded-lg p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--hz-neutral-900)] mb-4">Evolución cuota líquida vs retenciones</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...historico].sort((a, b) => a.ejercicio - b.ejercicio)} margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(20, 44, 80, 0.12)" />
                  <XAxis dataKey="ejercicio" tick={{ fill: 'var(--hz-neutral-700)', fontSize: 12 }} axisLine={{ stroke: 'var(--hz-neutral-300)' }} tickLine={{ stroke: 'var(--hz-neutral-300)' }} />
                  <YAxis
                    tickFormatter={(value: number) => `${Math.round(value / 1000)}k€`}
                    tick={{ fill: 'var(--hz-neutral-700)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--hz-neutral-300)' }}
                    tickLine={{ stroke: 'var(--hz-neutral-300)' }}
                  />
                  <Tooltip
                    formatter={(value: number) => fmt(value)}
                    labelFormatter={(label) => `Ejercicio ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="cuotaLiquida" name="Cuota líquida" radius={[6, 6, 0, 0]} fill="var(--error)" />
                  <Bar dataKey="retenciones" name="Retenciones" radius={[6, 6, 0, 0]} fill="var(--ok)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-[var(--hz-neutral-700)]">
                <CircleDollarSign className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />
                Cuota líquida
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--hz-neutral-700)]">
                <HandCoins className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} />
                Retenciones
              </div>
            </div>
          </div>

          {/* Note about pending data */}
          <div className="rounded-lg p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(4, 44, 94, 0.08)', border: '1px solid rgba(4, 44, 94, 0.25)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--atlas-blue)' }} />
            <p className="text-sm" style={{ color: 'var(--atlas-blue)' }}>
              Los datos históricos se calculan en base a la información disponible en la aplicación. Para ejercicios anteriores es posible que no estén todos los datos introducidos.
            </p>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default HistoricoPage;
