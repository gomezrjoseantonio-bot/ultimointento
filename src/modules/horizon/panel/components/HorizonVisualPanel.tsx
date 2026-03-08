import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, ChevronDown, ChevronUp, RefreshCw, Settings, Wallet } from 'lucide-react';
import { dashboardService } from '../../../../services/dashboardService';
import type { DashboardSnapshot } from '../../../../services/dashboardService';
import ActualizacionValoresDrawer from '../../../../components/dashboard/ActualizacionValoresDrawer';

export interface PanelFilters {
  excludePersonal?: boolean;
  dateRange: 'today' | '7days' | '30days';
}

type SortColumn = 'banco' | 'hoy' | 'porCobrar' | 'porPagar' | 'proyeccion';
type SortDirection = 'asc' | 'desc';
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

const HorizonVisualPanel: React.FC = () => {
  const navigate = useNavigate();
  const [filters] = useState<PanelFilters>({ excludePersonal: false, dateRange: '30days' });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardSnapshot>(DEFAULT_DATA);
  const [sortBy, setSortBy] = useState<SortColumn>('banco');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pageSize = 6;

  const loadDashboardData = async () => {
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

  useEffect(() => {
    void loadDashboardData();
  }, [filters.dateRange]);

  const sortedRows = useMemo(() => {
    const rows = [...data.tesoreria.filas];
    rows.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (sortBy === 'banco') {
        return a.banco.localeCompare(b.banco) * direction;
      }

      return (a[sortBy] - b[sortBy]) * direction;
    });
    return rows;
  }, [data.tesoreria.filas, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSort = (column: SortColumn) => {
    setCurrentPage(1);
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDirection('asc');
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortBy !== column) return <ChevronDown className="w-3 h-3 opacity-40" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const handleConfigureClick = () => navigate('/configuracion/preferencias-datos#panel');

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
                onClick={() => setDrawerOpen(true)}
                className="px-3 py-2 text-sm rounded-lg bg-hz-primary text-white hover:opacity-90"
              >
                Actualizar valores
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
          <article className="col-span-12 xl:col-span-7 bg-hz-card-bg border border-hz-neutral-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-hz-neutral-900 flex items-center gap-2"><Wallet className="w-4 h-4" />Balance Bancario</p>
              <span className="text-xs text-hz-neutral-600">{new Date(data.tesoreria.asOf).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-hz-neutral-600">
                  <tr>
                    <th className="text-left py-2">
                      <button onClick={() => handleSort('banco')} className="inline-flex items-center gap-1 font-semibold">
                        Banco {renderSortIcon('banco')}
                      </button>
                    </th>
                    <th className="text-right py-2">
                      <button onClick={() => handleSort('hoy')} className="inline-flex items-center gap-1 font-semibold">
                        Hoy {renderSortIcon('hoy')}
                      </button>
                    </th>
                    <th className="text-right py-2">
                      <button onClick={() => handleSort('porCobrar')} className="inline-flex items-center gap-1 font-semibold">
                        Por cobrar {renderSortIcon('porCobrar')}
                      </button>
                    </th>
                    <th className="text-right py-2">
                      <button onClick={() => handleSort('porPagar')} className="inline-flex items-center gap-1 font-semibold">
                        Por pagar {renderSortIcon('porPagar')}
                      </button>
                    </th>
                    <th className="text-right py-2">
                      <button onClick={() => handleSort('proyeccion')} className="inline-flex items-center gap-1 font-semibold">
                        Proyección {renderSortIcon('proyeccion')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((fila) => (
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
            <div className="mt-3 flex items-center justify-between text-xs text-hz-neutral-700">
              <span>Página {currentPage} de {totalPages} · {sortedRows.length} cuentas</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded border border-hz-neutral-300 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded border border-hz-neutral-300 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
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

        <ActualizacionValoresDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setDrawerOpen(false);
            void loadDashboardData();
          }}
        />
      </div>
    </div>
  );
};

export default HorizonVisualPanel;
