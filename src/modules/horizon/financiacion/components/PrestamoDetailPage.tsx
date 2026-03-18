import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Prestamo, PlanPagos } from '../../../../types/prestamos';
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
