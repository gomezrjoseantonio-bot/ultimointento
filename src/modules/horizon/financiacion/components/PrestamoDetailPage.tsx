import React, { useState, useEffect } from 'react';
import { ArrowLeft, Home, User, BarChart2, Wrench, CreditCard, TrendingUp, MoreHorizontal, ShieldCheck } from 'lucide-react';
import { Prestamo, PlanPagos, DestinoCapital, Garantia } from '../../../../types/prestamos';
import { prestamosService } from '../../../../services/prestamosService';
import { LoanSettlement } from '../../../../services/db';
import { getLoanSettlementsByLoanId } from '../../../../services/loanSettlementService';
import { formatDate, formatEuro } from '../../../../utils/formatUtils';
import HeaderSection from './detail/HeaderSection';
import CondicionesSection from './detail/CondicionesSection';
import BonificacionesSection from './detail/BonificacionesSection';
import CalendarioPagosSection from './detail/CalendarioPagosSection';
import AmortizationSimulator from '../../inmuebles/prestamos/components/AmortizationSimulator';
import LoanSettlementModal from './LoanSettlementModal';

// ── Helpers for Destino / Garantia display ────────────────────────────────

const TIPO_DESTINO_LABELS: Record<DestinoCapital['tipo'], string> = {
  ADQUISICION:       'Compra inmueble',
  REFORMA:           'Reforma inmueble',
  CANCELACION_DEUDA: 'Cancelación de deuda',
  INVERSION:         'Inversión',
  PERSONAL:          'Personal',
  OTRA:              'Otro',
};

const TIPO_DESTINO_ICONS: Record<DestinoCapital['tipo'], React.ReactNode> = {
  ADQUISICION:       <Home size={14} strokeWidth={1.5} />,
  REFORMA:           <Wrench size={14} strokeWidth={1.5} />,
  CANCELACION_DEUDA: <CreditCard size={14} strokeWidth={1.5} />,
  INVERSION:         <TrendingUp size={14} strokeWidth={1.5} />,
  PERSONAL:          <User size={14} strokeWidth={1.5} />,
  OTRA:              <MoreHorizontal size={14} strokeWidth={1.5} />,
};

const TIPO_GARANTIA_LABELS: Record<Garantia['tipo'], string> = {
  HIPOTECARIA:  'Hipotecaria',
  PERSONAL:     'Personal',
  PIGNORATICIA: 'Pignoraticia',
};

const TIPO_GARANTIA_ICONS: Record<Garantia['tipo'], React.ReactNode> = {
  HIPOTECARIA:  <Home size={14} strokeWidth={1.5} />,
  PERSONAL:     <User size={14} strokeWidth={1.5} />,
  PIGNORATICIA: <BarChart2 size={14} strokeWidth={1.5} />,
};

const isDeducible = (tipo: DestinoCapital['tipo']) =>
  tipo === 'ADQUISICION' || tipo === 'REFORMA';

// ── DestinoCapitalSection ────────────────────────────────────────────────

function DestinoCapitalSection({ prestamo }: { prestamo: Prestamo }) {
  const destinos = prestamo.destinos;
  if (!destinos?.length) return null;

  const total = destinos.reduce((s, d) => s + (d.importe || 0), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--atlas-navy-1)' }}>
        Destino del capital
      </h3>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Descripción / Inmueble</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Importe</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">%</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Deducible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {destinos.map((d) => {
              const pct = prestamo.principalInicial > 0
                ? ((d.importe / prestamo.principalInicial) * 100).toFixed(1)
                : '—';
              const deducible = isDeducible(d.tipo);
              return (
                <tr key={d.id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2" style={{ color: 'var(--atlas-navy-1)' }}>
                      {TIPO_DESTINO_ICONS[d.tipo]}
                      <span>{TIPO_DESTINO_LABELS[d.tipo]}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {d.descripcion || d.inmuebleId || '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--atlas-navy-1)' }}>
                    {formatEuro(d.importe)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">{pct}%</td>
                  <td className="px-3 py-2 text-center">
                    {deducible ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Sí (0105)</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="px-3 py-2 text-xs font-semibold text-gray-600" colSpan={2}>Total</td>
              <td className="px-3 py-2 text-right text-xs font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
                {formatEuro(total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      {Math.abs(total - prestamo.principalInicial) > 1 && (
        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Los importes de destino ({formatEuro(total)}) no cuadran con el capital inicial ({formatEuro(prestamo.principalInicial)}).
        </div>
      )}
    </div>
  );
}

// ── GarantiaSection ──────────────────────────────────────────────────────

function GarantiaSection({ prestamo }: { prestamo: Prestamo }) {
  const garantias = prestamo.garantias;
  if (!garantias?.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-navy-1)' }} />
        <h3 className="text-base font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
          Garantía
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ml-1">
          Informativa · no afecta fiscalidad
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {garantias.map((g, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            style={{ color: 'var(--atlas-navy-1)' }}
          >
            {TIPO_GARANTIA_ICONS[g.tipo]}
            <span className="font-medium">{TIPO_GARANTIA_LABELS[g.tipo]}</span>
            {(g.inmuebleId || g.descripcion) && (
              <span className="text-gray-500">— {g.descripcion || g.inmuebleId}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PrestamoDetailPageProps {
  prestamoId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}

const PrestamoDetailPage: React.FC<PrestamoDetailPageProps> = ({ prestamoId, onBack, onEdit }) => {
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [planPagos, setPlanPagos] = useState<PlanPagos | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlements, setSettlements] = useState<LoanSettlement[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [p, plan, settlementHistory] = await Promise.all([
          prestamosService.getPrestamoById(prestamoId),
          prestamosService.getPaymentPlan(prestamoId),
          getLoanSettlementsByLoanId(prestamoId),
        ]);
        if (!cancelled) {
          setPrestamo(p);
          setPlanPagos(plan);
          setSettlements(settlementHistory);
        }
      } catch (e) {
        console.error('[PrestamoDetailPage] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [prestamoId]);

  const reloadData = async () => {
    const [p, plan, settlementHistory] = await Promise.all([
      prestamosService.getPrestamoById(prestamoId),
      prestamosService.getPaymentPlan(prestamoId),
      getLoanSettlementsByLoanId(prestamoId),
    ]);
    setPrestamo(p);
    setPlanPagos(plan);
    setSettlements(settlementHistory);
  };

  const handleCuotaPagada = async (numeroPeriodo: number, pagado: boolean) => {
    await prestamosService.marcarCuotaManual(prestamoId, numeroPeriodo, { pagado });
    // Reload
    await reloadData();
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar el préstamo "${prestamo?.nombre}"?`)) return;
    await prestamosService.deletePrestamo(prestamoId);
    onBack();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-atlas-blue border-t-transparent mx-auto mb-4" />
          <p style={{ color: 'var(--atlas-navy-1)' }}>Cargando préstamo...</p>
        </div>
      </div>
    );
  }

  if (!prestamo) {
    return (
      <div className="p-6 text-center" style={{ color: 'var(--error)' }}>
        Préstamo no encontrado.
        <br />
        <button onClick={onBack} className="mt-4 underline" style={{ color: 'var(--atlas-blue)' }}>
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Back button */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--atlas-blue)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a préstamos
        </button>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <HeaderSection
          prestamo={prestamo}
          planPagos={planPagos}
          onEdit={() => onEdit(prestamoId)}
          onDelete={handleDelete}
          onSimular={() => setShowSimulator(true)}
          onGestionarOperacion={() => setShowSettlementModal(true)}
        />
        <DestinoCapitalSection prestamo={prestamo} />
        <GarantiaSection prestamo={prestamo} />
        <BonificacionesSection prestamo={prestamo} />
        <CondicionesSection prestamo={prestamo} />
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>Histórico de operaciones</h3>
              <p className="text-sm text-gray-500 mt-1">Cancelaciones y amortizaciones registradas sobre este préstamo.</p>
            </div>
            {!prestamo.activo || prestamo.estado === 'cancelado' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700">Préstamo cancelado</span>
            ) : (
              <button
                onClick={() => setShowSettlementModal(true)}
                className="px-3 py-2 text-sm rounded-lg border border-atlas-blue text-atlas-blue hover:bg-primary-50"
              >
                Nueva operación
              </button>
            )}
          </div>

          {settlements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Aún no se ha registrado ninguna cancelación o amortización manual.
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement) => (
                <div key={settlement.id} className="rounded-xl border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Operación</div>
                    <div className="font-medium" style={{ color: 'var(--atlas-navy-1)' }}>
                      {settlement.operationType === 'TOTAL'
                        ? 'Cancelación total'
                        : `Amortización ${settlement.partialMode === 'REDUCIR_CUOTA' ? '→ cuota' : '→ plazo'}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Fecha</div>
                    <div className="font-medium">{formatDate(settlement.operationDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Salida de caja</div>
                    <div className="font-medium">{formatEuro(settlement.totalCashOut)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Principal tras operación</div>
                    <div className="font-medium">{formatEuro(settlement.principalAfter)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Impacto</div>
                    <div className="font-medium">
                      {settlement.operationType === 'TOTAL'
                        ? 'Cuota = 0 €'
                        : `${settlement.termMonthsAfter} meses · ${formatEuro(settlement.monthlyPaymentAfter || 0)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <CalendarioPagosSection
          prestamo={prestamo}
          planPagos={planPagos}
          onCuotaPagada={handleCuotaPagada}
        />
      </div>

      {showSimulator && (
        <AmortizationSimulator
          prestamo={prestamo}
          onClose={() => setShowSimulator(false)}
        />
      )}

      {showSettlementModal && (
        <LoanSettlementModal
          prestamo={prestamo}
          isOpen={showSettlementModal}
          onClose={() => setShowSettlementModal(false)}
          onConfirmed={reloadData}
        />
      )}
    </div>
  );
};

export default PrestamoDetailPage;
