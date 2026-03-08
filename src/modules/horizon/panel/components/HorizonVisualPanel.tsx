import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarRange, RefreshCw, Settings, Wallet } from 'lucide-react';
import { dashboardService } from '../../../../services/dashboardService';

export interface PanelFilters {
  excludePersonal: boolean;
  dateRange: 'today' | '7days' | '30days';
}

type HorizonId = 'corto' | 'medio' | 'largo';

interface DashboardSnapshot {
  patrimonio: Awaited<ReturnType<typeof dashboardService.getPatrimonioNeto>>;
  liquidez: Awaited<ReturnType<typeof dashboardService.getLiquidez>>;
  salud: Awaited<ReturnType<typeof dashboardService.getSaludFinanciera>>;
  tesoreria: Awaited<ReturnType<typeof dashboardService.getTesoreriaPanel>>;
  alertas: Awaited<ReturnType<typeof dashboardService.getAlertas>>;
}

const DEFAULT_DATA: DashboardSnapshot = {
  patrimonio: {
    total: 0,
    variacionMes: 0,
    variacionPorcentaje: 0,
    fechaCalculo: new Date().toISOString(),
    desglose: { inmuebles: 0, inversiones: 0, cuentas: 0, deuda: 0 }
  },
  liquidez: {
    disponibleHoy: 0,
    comprometido30d: 0,
    ingresos30d: 0,
    proyeccion30d: 0
  },
  salud: {
    liquidezHoy: 0,
    gastoMedioMensual: 0,
    colchonMeses: 0,
    estado: 'critical',
    proyeccion30d: { estimado: 0, ingresos: 0, gastos: 0 }
  },
  tesoreria: {
    asOf: new Date().toISOString(),
    filas: [],
    totales: { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 }
  },
  alertas: []
};

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

const HorizonVisualPanel: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PanelFilters>({ excludePersonal: true, dateRange: '30days' });
  const [activeHorizon, setActiveHorizon] = useState<HorizonId>('corto');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardSnapshot>(DEFAULT_DATA);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [patrimonio, liquidez, salud, tesoreria, alertas] = await Promise.all([
        dashboardService.getPatrimonioNeto(),
        dashboardService.getLiquidez(),
        dashboardService.getSaludFinanciera(),
        dashboardService.getTesoreriaPanel(),
        dashboardService.getAlertas()
      ]);
      setData({ patrimonio, liquidez, salud, tesoreria, alertas });
      setLoading(false);
    };

    void load();
  }, [filters.excludePersonal, filters.dateRange]);

  const horizonKpis = useMemo(() => {
    const deudaRatio = data.patrimonio.total > 0
      ? Math.abs(data.patrimonio.desglose.deuda) / data.patrimonio.total * 100
      : 0;

    return {
      corto: {
        titulo: 'Corto plazo (0-90 días)',
        metricaPrincipal: euro.format(data.liquidez.disponibleHoy),
        detalle: `Caja disponible hoy`,
        kpi2: `${data.salud.colchonMeses.toFixed(1)} meses de colchón`,
        kpi3: `${data.tesoreria.filas.length} cuentas monitorizadas`
      },
      medio: {
        titulo: 'Medio plazo (3-18 meses)',
        metricaPrincipal: `${data.patrimonio.variacionMes >= 0 ? '+' : ''}${euro.format(data.patrimonio.variacionMes)}`,
        detalle: 'Variación mensual de patrimonio',
        kpi2: `${data.patrimonio.variacionPorcentaje >= 0 ? '+' : ''}${percent.format(data.patrimonio.variacionPorcentaje)}%`,
        kpi3: `${euro.format(data.salud.gastoMedioMensual)} gasto medio mensual`
      },
      largo: {
        titulo: 'Largo plazo (18+ meses)',
        metricaPrincipal: euro.format(data.patrimonio.total),
        detalle: 'Patrimonio neto consolidado',
        kpi2: `${percent.format(deudaRatio)}% ratio de deuda`,
        kpi3: `${euro.format(data.patrimonio.desglose.inversiones)} en inversiones`
      }
    };
  }, [data]);

  const handleConfigureClick = () => navigate('/configuracion/preferencias-datos#panel');

  const riskBadgeStyles: Record<HorizonCard['riesgo'], string> = {
    bajo: 'bg-emerald-100 text-emerald-700',
    medio: 'bg-amber-100 text-amber-700',
    alto: 'bg-red-100 text-red-700'
  };

  const activeNarrative = useMemo(
    () => HORIZON_CARDS.find((card) => card.id === activeHorizon),
    [activeHorizon]
  );

  return (
    <div className="min-h-screen bg-hz-bg">
      <div className="max-w-[1320px] mx-auto p-6 space-y-5">
        <header className="bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-hz-neutral-900">Dashboard ejecutivo</h1>
              <p className="text-sm text-hz-neutral-700">KPIs reales de patrimonio, liquidez, riesgo y alertas en corto, medio y largo plazo.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, excludePersonal: !prev.excludePersonal }))}
                className="px-3 py-2 text-sm rounded-lg bg-hz-neutral-100 text-hz-neutral-900"
              >
                {filters.excludePersonal ? 'Personal excluido' : 'Personal incluido'}
              </button>
              <button
                onClick={handleConfigureClick}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-hz-neutral-900 border border-hz-neutral-300 rounded-lg hover:bg-hz-neutral-100"
              >
                <Settings className="w-4 h-4" />
                Configurar
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-12 gap-4">
          <article className="col-span-12 md:col-span-3 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
            <p className="text-xs text-hz-neutral-600">Patrimonio neto</p>
            <p className="text-2xl font-bold text-hz-neutral-900">{euro.format(data.patrimonio.total)}</p>
            <p className={`text-sm ${data.patrimonio.variacionMes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {data.patrimonio.variacionMes >= 0 ? '+' : ''}{euro.format(data.patrimonio.variacionMes)} ({percent.format(data.patrimonio.variacionPorcentaje)}%)
            </p>
          </article>
          <article className="col-span-12 md:col-span-3 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
            <p className="text-xs text-hz-neutral-600">Liquidez hoy</p>
            <p className="text-2xl font-bold text-hz-neutral-900">{euro.format(data.liquidez.disponibleHoy)}</p>
            <p className="text-sm text-hz-neutral-700">Comprometido 30d: {euro.format(data.liquidez.comprometido30d)}</p>
          </article>
          <article className="col-span-12 md:col-span-3 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
            <p className="text-xs text-hz-neutral-600">Proyección 30 días</p>
            <p className={`text-2xl font-bold ${data.liquidez.proyeccion30d >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {euro.format(data.liquidez.proyeccion30d)}
            </p>
            <p className="text-sm text-hz-neutral-700">Ingresos esperados: {euro.format(data.liquidez.ingresos30d)}</p>
          </article>
          <article className="col-span-12 md:col-span-3 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
            <p className="text-xs text-hz-neutral-600">Alertas activas</p>
            <p className="text-2xl font-bold text-hz-neutral-900">{data.alertas.length}</p>
            <p className="text-sm text-hz-neutral-700">Alta: {data.alertas.filter((a) => a.urgencia === 'alta').length} · Media: {data.alertas.filter((a) => a.urgencia === 'media').length}</p>
          </article>
        </section>

        <section className="bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarRange className="w-4 h-4 text-hz-neutral-700" />
            <p className="text-sm font-semibold text-hz-neutral-900">Seguimiento por horizonte</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {(['corto', 'medio', 'largo'] as HorizonId[]).map((h) => (
              <button
                key={h}
                onClick={() => setActiveHorizon(h)}
                className={`text-left rounded-lg border p-4 ${activeHorizon === h ? 'border-hz-primary bg-blue-50' : 'border-hz-neutral-300 bg-white'}`}
              >
                <p className="text-sm font-semibold text-hz-neutral-900">{horizonKpis[h].titulo}</p>
                <p className="text-xl font-bold text-hz-neutral-900 mt-1">{horizonKpis[h].metricaPrincipal}</p>
                <p className="text-sm text-hz-neutral-700">{horizonKpis[h].detalle}</p>
                <p className="text-xs text-hz-neutral-600 mt-2">{horizonKpis[h].kpi2}</p>
                <p className="text-xs text-hz-neutral-600">{horizonKpis[h].kpi3}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-12 gap-4">
          <article className="col-span-12 xl:col-span-7 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-hz-neutral-900 flex items-center gap-2"><Wallet className="w-4 h-4" />Tesorería por cuenta</p>
              <span className="text-xs text-hz-neutral-600">{new Date(data.tesoreria.asOf).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-hz-neutral-600">
                  <tr>
                    <th className="text-left py-2">Banco</th>
                    <th className="text-right py-2">Hoy</th>
                    <th className="text-right py-2">Por cobrar</th>
                    <th className="text-right py-2">Por pagar</th>
                    <th className="text-right py-2">Proyección</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tesoreria.filas.slice(0, 6).map((fila) => (
                    <tr key={fila.accountId} className="border-t border-hz-neutral-200">
                      <td className="py-2">{fila.banco}</td>
                      <td className="text-right">{euro.format(fila.hoy)}</td>
                      <td className="text-right text-emerald-700">{euro.format(fila.porCobrar)}</td>
                      <td className="text-right text-red-700">{euro.format(fila.porPagar)}</td>
                      <td className={`text-right font-medium ${fila.proyeccion >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{euro.format(fila.proyeccion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="col-span-12 xl:col-span-5 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
            <p className="text-sm font-semibold text-hz-neutral-900 flex items-center gap-2 mb-3"><Bell className="w-4 h-4" />Alertas prioritarias</p>
            <div className="space-y-2">
              {data.alertas.slice(0, 5).map((alerta) => (
                <div key={alerta.id} className="rounded-md border border-hz-neutral-200 p-3">
                  <p className="text-sm font-medium text-hz-neutral-900">{alerta.titulo}</p>
                  <p className="text-xs text-hz-neutral-700">{alerta.descripcion}</p>
                </div>
              ))}
              {data.alertas.length === 0 && (
                <div className="rounded-md bg-emerald-50 text-emerald-700 p-3 text-sm">Sin alertas activas.</div>
              )}
            </div>
          </article>
        </section>

        <footer className="bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-hz-neutral-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Estado financiero: <span className="font-semibold uppercase">{data.salud.estado}</span> · Colchón {data.salud.colchonMeses.toFixed(1)} meses
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm px-3 py-2 rounded-lg bg-hz-neutral-100 text-hz-neutral-900 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar KPIs
          </button>
        </footer>
      </div>
    </div>
  );
};

export default HorizonVisualPanel;
