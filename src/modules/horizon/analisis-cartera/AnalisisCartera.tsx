import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart2, Download, Plus } from 'lucide-react';
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, ArcElement } from 'chart.js';
import { initDB, Property } from '../../../services/db';
import { inversionesService } from '../../../services/inversionesService';

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, ArcElement);

type Scope = 'inmuebles' | 'inversiones';

interface Props {
  scope: Scope;
}

const euro = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);

const AnalisisCartera: React.FC<Props> = ({ scope }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [invResumen, setInvResumen] = useState({ valor_total: 0, total_aportado: 0, rentabilidad_porcentaje: 0, num_posiciones: 0 });
  const [invByType, setInvByType] = useState<Record<string, number>>({});

  const inmLineRef = useRef<HTMLCanvasElement>(null);
  const invDonutRef = useRef<HTMLCanvasElement>(null);
  const inmChart = useRef<Chart | null>(null);
  const invChart = useRef<Chart | null>(null);

  useEffect(() => {
    const load = async () => {
      const db = await initDB();
      const allProperties = ((await db.getAll('properties')) as Property[]).filter((p) => p.state === 'activo');
      setProperties(allProperties);

      const [resumen, posiciones] = await Promise.all([
        inversionesService.getResumenCartera(),
        inversionesService.getPosiciones(),
      ]);

      setInvResumen(resumen);
      const grouped = posiciones.reduce<Record<string, number>>((acc, item) => {
        const key = item.tipo || 'Otro';
        acc[key] = (acc[key] || 0) + Number(item.valor_actual || 0);
        return acc;
      }, {});
      setInvByType(grouped);
    };

    void load();
  }, []);

  const propertyTotals = useMemo(() => {
    const totalCost = properties.reduce((sum, p) => sum + Number(p.acquisitionCosts?.price || 0), 0);
    const totalValue = properties.reduce((sum, p) => sum + Number(p.acquisitionCosts?.price || 0), 0);
    return { totalCost, totalValue, count: properties.length };
  }, [properties]);

  useEffect(() => {
    if (scope !== 'inmuebles' || !inmLineRef.current) return;
    inmChart.current?.destroy();
    inmChart.current = new Chart(inmLineRef.current, {
      type: 'line',
      data: {
        labels: ['2022', '2023', '2024', '2025', '2026'],
        datasets: [
          { label: 'Valor cartera', data: [0.72, 0.78, 0.84, 0.89, propertyTotals.totalValue / 1_000_000], borderColor: 'var(--blue)', tension: 0.35 },
          { label: 'Coste acumulado', data: [0.51, 0.52, 0.53, 0.54, propertyTotals.totalCost / 1_000_000], borderColor: 'var(--c2)', borderDash: [6, 4], tension: 0.35 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });

    return () => inmChart.current?.destroy();
  }, [scope, propertyTotals.totalValue, propertyTotals.totalCost]);

  useEffect(() => {
    if (scope !== 'inversiones' || !invDonutRef.current) return;
    invChart.current?.destroy();
    const labels = Object.keys(invByType);
    const values = Object.values(invByType);
    invChart.current = new Chart(invDonutRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: ['#042C5E', '#5B8DB8', '#1DA0BA', '#A8C4DE'] }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    });

    return () => invChart.current?.destroy();
  }, [scope, invByType]);

  return (
    <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart2 color="var(--blue)" />
          <div>
            <h1 style={{ margin: 0, color: 'var(--blue)' }}>Análisis de cartera</h1>
            <p style={{ margin: 0, color: 'var(--n-500)' }}>Inmuebles · Inversiones · Proyecciones</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" type="button"><Download size={14} /> Exportar</button>
          <button className="btn btn-primary btn-sm" type="button"><Plus size={14} /> Nuevo activo</button>
        </div>
      </div>

      {scope === 'inmuebles' ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div style={{ border: '1px solid var(--n-300)', borderRadius: 12, background: 'var(--white)', padding: 16 }}>
              <div style={{ color: 'var(--n-500)', fontSize: 12 }}>Coste total</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 30 }}>{euro(propertyTotals.totalCost)}</div>
            </div>
            <div style={{ border: '1px solid var(--n-300)', borderRadius: 12, background: 'var(--white)', padding: 16 }}>
              <div style={{ color: 'var(--n-500)', fontSize: 12 }}>Valor actual</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 30 }}>{euro(propertyTotals.totalValue)}</div>
            </div>
          </div>
          <div style={{ marginTop: 16, border: '1px solid var(--n-300)', borderRadius: 12, background: 'var(--white)', padding: 16, height: 300 }}>
            <canvas ref={inmLineRef} />
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            <div style={{ border: '1px solid var(--n-300)', borderRadius: 12, background: 'var(--white)', padding: 16 }}>
              <div style={{ color: 'var(--n-500)', fontSize: 12 }}>Valor total</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 30 }}>{euro(invResumen.valor_total)}</div>
            </div>
            <div style={{ border: '1px solid var(--n-300)', borderRadius: 12, background: 'var(--white)', padding: 16 }}>
              <div style={{ color: 'var(--n-500)', fontSize: 12 }}>Total aportado</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 30 }}>{euro(invResumen.total_aportado)}</div>
            </div>
            <div style={{ border: '1px solid var(--n-300)', borderRadius: 12, background: 'var(--white)', padding: 16 }}>
              <div style={{ color: 'var(--n-500)', fontSize: 12 }}>Rentabilidad</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 30, color: 'var(--s-pos)' }}>{invResumen.rentabilidad_porcentaje.toFixed(2)}%</div>
            </div>
          </div>
          <div style={{ marginTop: 16, border: '1px solid var(--n-300)', borderRadius: 12, background: 'var(--white)', padding: 16, height: 320 }}>
            <canvas ref={invDonutRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisCartera;
