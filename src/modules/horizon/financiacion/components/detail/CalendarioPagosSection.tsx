import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Prestamo, PlanPagos, PeriodoPago } from '../../../../../types/prestamos';
import CollapsibleSection from '../CollapsibleSection';

interface CalendarioPagosSectionProps {
  prestamo: Prestamo;
  planPagos: PlanPagos | null;
  onCuotaPagada: (numeroPeriodo: number, pagado: boolean) => void;
}

type FilterTab = 'todas' | 'pagadas' | 'proximas' | 'futuras';

const PAGE_SIZE = 12;

const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getCuotaStatus(periodo: PeriodoPago): 'pagada' | 'vencida' | 'proxima' | 'futura' {
  if (periodo.pagado) return 'pagada';
  const today = new Date();
  const fechaCargo = new Date(periodo.fechaCargo);
  const diffMs = fechaCargo.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'vencida';
  if (diffDays <= 30) return 'proxima';
  return 'futura';
}

const CalendarioPagosSection: React.FC<CalendarioPagosSectionProps> = ({
  prestamo,
  planPagos,
  onCuotaPagada,
}) => {
  const [filter, setFilter] = useState<FilterTab>('todas');
  const [yearFilter, setYearFilter] = useState<string>('todos');
  const [page, setPage] = useState(1);

  const periodos = planPagos?.periodos ?? [];

  const totalCuotas = periodos.length;
  const totalIntereses = planPagos?.resumen?.totalIntereses ?? 0;
  const fechaFin = planPagos?.resumen?.fechaFinalizacion ?? '';
  const pagadas = periodos.filter(p => p.pagado).length;
  const pendientes = totalCuotas - pagadas;

  const years = Array.from(new Set(periodos.map(p => new Date(p.fechaCargo).getFullYear().toString()))).sort();

  const filtered = periodos.filter(p => {
    const status = getCuotaStatus(p);
    if (yearFilter !== 'todos' && new Date(p.fechaCargo).getFullYear().toString() !== yearFilter) return false;
    if (filter === 'pagadas') return status === 'pagada';
    if (filter === 'proximas') return status === 'proxima' || status === 'vencida';
    if (filter === 'futuras') return status === 'futura';
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const todayIdx = periodos.findIndex(p => !p.pagado);

  const handleToggle = (periodo: PeriodoPago) => {
    if (window.confirm(`¿${periodo.pagado ? 'Desmarcar' : 'Marcar'} la cuota ${periodo.periodo} como ${periodo.pagado ? 'pendiente' : 'pagada'}?`)) {
      onCuotaPagada(periodo.periodo, !periodo.pagado);
    }
  };

  const rowStyle = (p: PeriodoPago): React.CSSProperties => {
    const status = getCuotaStatus(p);
    if (status === 'pagada') return { backgroundColor: 'rgba(40,167,69,0.05)' };
    if (status === 'vencida') return { backgroundColor: 'rgba(220,53,69,0.05)', borderLeft: '2px solid var(--error)' };
    if (status === 'proxima') return { backgroundColor: 'rgba(255,193,7,0.08)', borderLeft: '2px solid var(--warn)' };
    return {};
  };

  const statusBadge = (p: PeriodoPago) => {
    const status = getCuotaStatus(p);
    const map = {
      pagada: { label: '✅ Pagada', color: 'var(--ok)' },
      vencida: { label: '⚠ Vencida', color: 'var(--error)' },
      proxima: { label: '⏳ Próxima', color: 'var(--warn)' },
      futura: { label: '○ Futura', color: 'var(--text-gray)' },
    };
    const { label, color } = map[status];
    return <span className="text-xs" style={{ color }}>{label}</span>;
  };

  const badge = (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--atlas-blue)' }}>
      {pagadas}/{totalCuotas}
    </span>
  );

  if (!planPagos) {
    return (
      <CollapsibleSection title="Calendario de pagos" icon={Calendar} defaultExpanded badge={badge}>
        <div className="p-6 text-sm" style={{ color: 'var(--text-gray)' }}>
          No hay plan de pagos disponible.
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection title="Calendario de pagos" icon={Calendar} defaultExpanded badge={badge}>
      <div className="p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total cuotas', value: totalCuotas },
            { label: 'Total intereses', value: `${fmt(totalIntereses)} €` },
            { label: 'Pagadas', value: pagadas },
            { label: 'Pendientes', value: pendientes },
          ].map(item => (
            <div key={item.label} className="border border-gray-100 rounded p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-gray)' }}>{item.label}</div>
              <div className="font-semibold text-sm" style={{ color: 'var(--atlas-navy-1)' }}>{item.value}</div>
            </div>
          ))}
        </div>
        {fechaFin && (
          <div className="text-xs" style={{ color: 'var(--text-gray)' }}>
            Fecha fin: <span className="font-medium" style={{ color: 'var(--atlas-navy-1)' }}>{new Date(fechaFin).toLocaleDateString('es-ES')}</span>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'todas', label: 'Todas' },
            { key: 'pagadas', label: '✅ Pagadas' },
            { key: 'proximas', label: '⏳ Próximas' },
            { key: 'futuras', label: '○ Futuras' },
          ] as { key: FilterTab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1); }}
              className="text-xs px-3 py-1 rounded-full border transition-colors"
              style={{
                borderColor: filter === tab.key ? 'var(--atlas-blue)' : 'var(--border-light, #e5e7eb)',
                backgroundColor: filter === tab.key ? 'rgba(37,99,235,0.08)' : 'transparent',
                color: filter === tab.key ? 'var(--atlas-blue)' : 'var(--text-gray)',
              }}
            >
              {tab.label}
            </button>
          ))}
          {years.length > 1 && (
            <select
              value={yearFilter}
              onChange={e => { setYearFilter(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded px-2 py-1"
              style={{ color: 'var(--atlas-navy-1)' }}
            >
              <option value="todos">Todos los años</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-100 rounded">
          <table
            className="min-w-full divide-y divide-gray-100 text-sm"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <thead>
              <tr className="bg-gray-50">
                {['Nº', 'Fecha', 'Cuota', 'Interés', 'Capital', 'Pendiente', 'Estado'].map(h => (
                  <th key={h} className="px-3 py-2 text-xs font-medium uppercase text-left"
                    style={{ color: 'var(--text-gray)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageItems.map((p, i) => {
                const globalIdx = filtered.indexOf(p);
                const showTodaySeparator = filter === 'todas' && globalIdx === todayIdx && todayIdx > 0;
                return (
                  <React.Fragment key={p.periodo}>
                    {showTodaySeparator && (
                      <tr>
                        <td colSpan={7}>
                          <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold"
                            style={{ color: 'var(--atlas-blue)', backgroundColor: 'rgba(37,99,235,0.06)' }}>
                            ── HOY ──
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      style={rowStyle(p)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleToggle(p)}
                    >
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-gray)' }}>{p.periodo}</td>
                      <td className="px-3 py-2">{new Date(p.fechaCargo).toLocaleDateString('es-ES')}</td>
                      <td className="px-3 py-2 text-right">{fmt(p.cuota)} €</td>
                      <td className="px-3 py-2 text-right">{fmt(p.interes)} €</td>
                      <td className="px-3 py-2 text-right">{fmt(p.amortizacion)} €</td>
                      <td className="px-3 py-2 text-right">{fmt(p.principalFinal)} €</td>
                      <td className="px-3 py-2">{statusBadge(p)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-gray)' }}>
                    No hay cuotas en este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-gray)' }}>
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
              >
                ‹
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default CalendarioPagosSection;
