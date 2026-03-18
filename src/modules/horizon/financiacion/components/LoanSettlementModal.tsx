import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Euro, Wallet, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Prestamo } from '../../../../types/prestamos';
import {
  confirmLoanSettlement,
  prepareLoanSettlement,
  simulateLoanSettlement,
  LoanSettlementSimulationResult,
} from '../../../../services/loanSettlementService';
import { initDB } from '../../../../services/db';
import { formatEuro, formatDate } from '../../../../utils/formatUtils';

interface LoanSettlementModalProps {
  prestamo: Prestamo;
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: () => Promise<void> | void;
}

interface AccountOption {
  id: number;
  label: string;
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const percentToAmount = (percentLike: number | undefined, base: number): number => {
  const numeric = Number(percentLike || 0);
  if (!numeric || !base) return 0;
  const normalizedRate = numeric <= 1 ? numeric : numeric / 100;
  return round2(base * normalizedRate);
};

const LoanSettlementModal: React.FC<LoanSettlementModalProps> = ({ prestamo, isOpen, onClose, onConfirmed }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [operationType, setOperationType] = useState<'TOTAL' | 'PARTIAL'>('TOTAL');
  const [partialMode, setPartialMode] = useState<'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'>('REDUCIR_PLAZO');
  const [operationDate, setOperationDate] = useState(today);
  const [principalAmount, setPrincipalAmount] = useState('');
  const [feeAmount, setFeeAmount] = useState('0');
  const [fixedCosts, setFixedCosts] = useState(String(prestamo.gastosFijosOperacion || 0));
  const [settlementAccountId, setSettlementAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof prepareLoanSettlement>> | null>(null);
  const [simulation, setSimulation] = useState<LoanSettlementSimulationResult | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [db, preparedResult] = await Promise.all([
          initDB(),
          prepareLoanSettlement(prestamo.id, operationDate),
        ]);
        if (cancelled) return;

        const accountList = (await db.getAll('accounts') as any[])
          .filter((account) => account && account.deleted_at !== true && account.isActive !== false)
          .map((account) => ({
            id: Number(account.id),
            label: account.alias ?? account.name ?? account.banco?.name ?? `Cuenta ${account.id}`,
          }));

        setAccounts(accountList);
        setSettlementAccountId((prev) => prev || String(accountList[0]?.id || ''));
        setPrepared(preparedResult);
        setPrincipalAmount(String(preparedResult.principalPendienteEstimado));
        setFeeAmount(String(percentToAmount(prestamo.comisionCancelacionTotal, preparedResult.principalPendienteEstimado)));
        setFixedCosts(String(prestamo.gastosFijosOperacion || 0));
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('No se pudo preparar la operación del préstamo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isOpen, prestamo.id, prestamo.comisionCancelacionTotal, prestamo.gastosFijosOperacion, operationDate]);

  useEffect(() => {
    if (!prepared) return;

    if (operationType === 'TOTAL') {
      setPrincipalAmount(String(prepared.principalPendienteEstimado));
      setFeeAmount(String(percentToAmount(prestamo.comisionCancelacionTotal, prepared.principalPendienteEstimado)));
    } else {
      setPrincipalAmount(String(Math.min(prepared.principalPendienteEstimado, prepared.principalPendienteEstimado)));
      setFeeAmount(String(percentToAmount(
        prestamo.comisionAmortizacionAnticipada ?? prestamo.comisionAmortizacionParcial,
        Number(prepared.principalPendienteEstimado || 0),
      )));
    }
    setSimulation(null);
  }, [operationType, partialMode, prepared, prestamo.comisionAmortizacionAnticipada, prestamo.comisionAmortizacionParcial, prestamo.comisionCancelacionTotal]);

  const summaryCards = useMemo(() => {
    if (!prepared) return [];
    return [
      { label: 'Principal pendiente', value: formatEuro(prepared.principalPendienteEstimado) },
      { label: 'Interés corrido estimado', value: formatEuro(prepared.interesesCorridosEstimados) },
      { label: 'Cuota actual', value: formatEuro(prepared.cuotaActualEstimada) },
      { label: 'Plazo restante', value: `${prepared.plazoRestanteEstimado} meses` },
    ];
  }, [prepared]);

  const handleSimulate = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await simulateLoanSettlement({
        loanId: prestamo.id,
        operationType,
        operationDate,
        partialMode: operationType === 'PARTIAL' ? partialMode : undefined,
        principalAmount: operationType === 'PARTIAL' ? Number(principalAmount || 0) : undefined,
        feeAmount: Number(feeAmount || 0),
        fixedCosts: Number(fixedCosts || 0),
      });
      setSimulation(result);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'No se pudo calcular la operación');
      setSimulation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      if (!settlementAccountId) {
        setError('Selecciona una cuenta de tesorería.');
        return;
      }
      if (!simulation) {
        await handleSimulate();
        return;
      }

      setLoading(true);
      setError('');
      await confirmLoanSettlement({
        loanId: prestamo.id,
        operationType,
        operationDate,
        partialMode: operationType === 'PARTIAL' ? partialMode : undefined,
        principalAmount: operationType === 'PARTIAL' ? Number(principalAmount || 0) : undefined,
        feeAmount: Number(feeAmount || 0),
        fixedCosts: Number(fixedCosts || 0),
        settlementAccountId: Number(settlementAccountId),
        notes,
        source: 'financiacion',
      });
      toast.success(operationType === 'TOTAL' ? 'Préstamo cancelado correctamente' : 'Amortización registrada correctamente');
      await onConfirmed();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'No se pudo confirmar la operación');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)' }}>
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>Cancelar o amortizar préstamo</h2>
            <p className="text-sm text-gray-500 mt-1">{prestamo.nombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Cerrar modal operación préstamo">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-200 p-4" style={{ backgroundColor: 'var(--bg)' }}>
                <div className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</div>
                <div className="text-sm font-semibold mt-2" style={{ color: 'var(--atlas-navy-1)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de operación</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOperationType('TOTAL')}
                    className={`rounded-xl border p-4 text-left ${operationType === 'TOTAL' ? 'border-atlas-blue bg-primary-50' : 'border-gray-200'}`}
                  >
                    <div className="font-medium">Cancelación total</div>
                    <div className="text-sm text-gray-500 mt-1">Liquida por completo el préstamo.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperationType('PARTIAL')}
                    className={`rounded-xl border p-4 text-left ${operationType === 'PARTIAL' ? 'border-atlas-blue bg-primary-50' : 'border-gray-200'}`}
                  >
                    <div className="font-medium">Amortización parcial</div>
                    <div className="text-sm text-gray-500 mt-1">Reduce cuota o plazo.</div>
                  </button>
                </div>
              </div>

              {operationType === 'PARTIAL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modo</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPartialMode('REDUCIR_PLAZO')}
                      className={`rounded-xl border p-4 text-left ${partialMode === 'REDUCIR_PLAZO' ? 'border-atlas-blue bg-primary-50' : 'border-gray-200'}`}
                    >
                      <div className="font-medium">Reducir plazo</div>
                      <div className="text-sm text-gray-500 mt-1">Mantiene la cuota actual.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartialMode('REDUCIR_CUOTA')}
                      className={`rounded-xl border p-4 text-left ${partialMode === 'REDUCIR_CUOTA' ? 'border-atlas-blue bg-primary-50' : 'border-gray-200'}`}
                    >
                      <div className="font-medium">Reducir cuota</div>
                      <div className="text-sm text-gray-500 mt-1">Mantiene el plazo restante.</div>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />Fecha operación
                  </label>
                  <input type="date" value={operationDate} onChange={(e) => setOperationDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Wallet className="inline h-4 w-4 mr-1" />Cuenta de tesorería
                  </label>
                  <select value={settlementAccountId} onChange={(e) => setSettlementAccountId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                    <option value="">Selecciona una cuenta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Euro className="inline h-4 w-4 mr-1" />{operationType === 'TOTAL' ? 'Principal liquidado' : 'Importe a amortizar'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    disabled={operationType === 'TOTAL'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comisión</label>
                  <input type="number" min="0" step="0.01" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gastos fijos</label>
                  <input type="number" min="0" step="0.01" value={fixedCosts} onChange={(e) => setFixedCosts(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Observaciones opcionales" />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-5 space-y-4" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>Resumen de la operación</h3>
                  <p className="text-sm text-gray-500 mt-1">Simula antes de confirmar.</p>
                </div>
                <button type="button" onClick={handleSimulate} disabled={loading} className="px-4 py-2 rounded-lg bg-atlas-blue text-white disabled:opacity-60">
                  {loading ? 'Calculando…' : 'Actualizar resumen'}
                </button>
              </div>

              {simulation ? (
                <div className="space-y-3 text-sm">
                  <div className="rounded-xl bg-white border border-gray-200 p-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-gray-500">Fecha</div>
                      <div className="font-medium">{formatDate(simulation.operationDate)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Salida total</div>
                      <div className="font-medium">{formatEuro(simulation.totalCashOut)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Principal antes</div>
                      <div className="font-medium">{formatEuro(simulation.principalBefore)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Principal después</div>
                      <div className="font-medium">{formatEuro(simulation.principalAfter)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Comisión</div>
                      <div className="font-medium">{formatEuro(simulation.feeAmount)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Gastos fijos</div>
                      <div className="font-medium">{formatEuro(simulation.fixedCosts)}</div>
                    </div>
                    {simulation.operationType === 'TOTAL' && (
                      <>
                        <div>
                          <div className="text-gray-500">Interés corrido</div>
                          <div className="font-medium">{formatEuro(simulation.accruedInterest)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Nueva cuota</div>
                          <div className="font-medium">0,00 €</div>
                        </div>
                      </>
                    )}
                    {simulation.operationType === 'PARTIAL' && (
                      <>
                        <div>
                          <div className="text-gray-500">Cuota antes / después</div>
                          <div className="font-medium">
                            {formatEuro(simulation.monthlyPaymentBefore || 0)} → {formatEuro(simulation.monthlyPaymentAfter || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Plazo antes / después</div>
                          <div className="font-medium">
                            {simulation.termMonthsBefore} → {simulation.termMonthsAfter} meses
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-gray-500">Ahorro estimado de intereses</div>
                          <div className="font-medium">{formatEuro(simulation.interestSavings || 0)}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
                  Completa los datos y pulsa <strong>Actualizar resumen</strong> para ver el impacto antes de confirmar.
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-white sticky bottom-0">
          <div className="text-xs text-gray-500">
            La operación generará salida de tesorería y actualizará el cuadro de amortización.
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} disabled={loading} className="px-4 py-2 rounded-lg bg-atlas-blue text-white disabled:opacity-60">
              {loading ? 'Guardando…' : operationType === 'TOTAL' ? 'Confirmar cancelación' : 'Confirmar amortización'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanSettlementModal;
