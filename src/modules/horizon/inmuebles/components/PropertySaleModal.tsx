import React, { useEffect, useMemo, useState } from 'react';
import { Account, Property, initDB } from '../../../../services/db';
import {
  confirmPropertySale,
  preparePropertySale,
  simulatePropertySale,
} from '../../../../services/propertySaleService';
import toast from 'react-hot-toast';

interface PropertySaleModalProps {
  open: boolean;
  property: Property | null;
  source: 'cartera' | 'detalle' | 'analisis';
  initialDate?: string;
  onClose: () => void;
  onConfirmed: () => void;
}

const PropertySaleModal: React.FC<PropertySaleModalProps> = ({
  open,
  property,
  source,
  initialDate,
  onClose,
  onConfirmed,
}) => {
  const [saleDate, setSaleDate] = useState(initialDate ?? '');
  const [salePrice, setSalePrice] = useState(0);
  const [agencyCommission, setAgencyCommission] = useState(0);
  const [municipalTax, setMunicipalTax] = useState(0);
  const [saleNotaryCosts, setSaleNotaryCosts] = useState(0);
  const [loanPayoffAmount, setLoanPayoffAmount] = useState(0);
  const [loanCancellationFee, setLoanCancellationFee] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [notes, setNotes] = useState('');
  const [autoTerminateContracts, setAutoTerminateContracts] = useState(false);
  const [activeContractsCount, setActiveContractsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settlementAccountId, setSettlementAccountId] = useState<number | ''>('');

  useEffect(() => {
    if (!open || !property?.id) return;

    const defaultSaleDate = initialDate ?? new Date().toISOString().slice(0, 10);
    setSaleDate(defaultSaleDate);
    setSalePrice(0);
    setAgencyCommission(0);
    setMunicipalTax(0);
    setSaleNotaryCosts(0);
    setLoanPayoffAmount(0);
    setLoanCancellationFee(0);
    setOtherCosts(0);
    setNotes('');
    setAutoTerminateContracts(false);

    void initDB()
      .then((db) => db.getAll('accounts'))
      .then((allAccounts) => {
        const activeAccounts = allAccounts.filter((account) => !account.deleted_at && account.isActive !== false);
        setAccounts(activeAccounts);
        setSettlementAccountId(activeAccounts[0]?.id ?? '');
      })
      .catch((error) => {
        console.error(error);
        toast.error('No se pudieron cargar las cuentas de tesorería');
      });
  }, [open, property?.id, initialDate]);

  useEffect(() => {
    if (!open || !property?.id || !saleDate) return;

    void preparePropertySale(property.id, saleDate)
      .then((result) => setActiveContractsCount(result.activeContracts.length))
      .catch((error) => {
        console.error(error);
        toast.error('No se pudieron verificar los contratos activos');
      });
  }, [open, property?.id, saleDate]);

  const simulation = useMemo(
    () =>
      simulatePropertySale({
        salePrice,
        agencyCommission,
        municipalTax,
        saleNotaryCosts,
        loanPayoffAmount,
        loanCancellationFee,
        otherCosts,
      }),
    [salePrice, agencyCommission, municipalTax, saleNotaryCosts, loanPayoffAmount, loanCancellationFee, otherCosts]
  );

  if (!open || !property) return null;

  const handleConfirm = async () => {
    if (!property.id) return;

    try {
      setLoading(true);
      await confirmPropertySale({
        propertyId: property.id,
        saleDate,
        salePrice,
        agencyCommission,
        municipalTax,
        saleNotaryCosts,
        loanPayoffAmount,
        loanCancellationFee,
        otherCosts,
        settlementAccountId: settlementAccountId === '' ? undefined : settlementAccountId,
        notes,
        source,
        autoTerminateContracts,
      });
      toast.success('Venta registrada correctamente');
      onConfirmed();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar la venta';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--n-300)]/60 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="border-b border-neutral-200 p-4">
          <h3 className="text-lg font-semibold text-neutral-900">Vender inmueble</h3>
          <p className="text-sm text-neutral-600">{property.alias}</p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-neutral-700">
              Fecha de venta
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" />
            </label>
            <label className="text-sm text-neutral-700">
              Cuenta de tesorería
              <select
                value={settlementAccountId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSettlementAccountId(value ? Number(value) : '');
                }}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              >
                <option value="">Seleccionar cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.alias || account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-neutral-700">
              Precio de venta (€)
              <input type="number" min={0} value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value || 0))} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" />
            </label>
            <label className="text-sm text-neutral-700">
              Comisión agencia (€)
              <input type="number" min={0} value={agencyCommission} onChange={(e) => setAgencyCommission(Number(e.target.value || 0))} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" />
            </label>
            <label className="text-sm text-neutral-700">
              Plusvalía municipal (€)
              <input type="number" min={0} value={municipalTax} onChange={(e) => setMunicipalTax(Number(e.target.value || 0))} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" />
            </label>
            <label className="text-sm text-neutral-700">
              Notaría/Gestoría venta (€)
              <input type="number" min={0} value={saleNotaryCosts} onChange={(e) => setSaleNotaryCosts(Number(e.target.value || 0))} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" />
            </label>
            <label className="text-sm text-neutral-700">
              Otros gastos (€)
              <input type="number" min={0} value={otherCosts} onChange={(e) => setOtherCosts(Number(e.target.value || 0))} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" />
            </label>
            <label className="text-sm text-neutral-700">
              Cancelación deuda (€)
              <input type="number" min={0} value={loanPayoffAmount} onChange={(e) => setLoanPayoffAmount(Number(e.target.value || 0))} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" />
            </label>
            <label className="text-sm text-neutral-700">
              Comisión cancelación (€)
              <input type="number" min={0} value={loanCancellationFee} onChange={(e) => setLoanCancellationFee(Number(e.target.value || 0))} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" />
            </label>
          </div>

          {activeContractsCount > 0 && (
            <div className="rounded border border-warning-300 bg-warning-100 p-3 text-sm text-neutral-800">
              Este inmueble tiene {activeContractsCount} contrato(s) activo(s).
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoTerminateContracts}
                  onChange={(e) => setAutoTerminateContracts(e.target.checked)}
                />
                Cerrar contratos automáticamente con fecha de venta
              </label>
            </div>
          )}

          <label className="block text-sm text-neutral-700">
            Notas
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border border-neutral-300 px-3 py-2" rows={2} />
          </label>

          <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div>Entrada bruta: <strong>{simulation.grossProceeds.toFixed(2)} €</strong></div>
            <div>Gastos de venta: <strong>{simulation.totalSaleCosts.toFixed(2)} €</strong></div>
            <div>Cancelación deuda: <strong>{simulation.totalLoanSettlement.toFixed(2)} €</strong></div>
            <div className="mt-1">Liquidez neta estimada: <strong>{simulation.netProceeds.toFixed(2)} €</strong></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 p-4">
          <button onClick={onClose} className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !saleDate || salePrice <= 0 || settlementAccountId === '' || (activeContractsCount > 0 && !autoTerminateContracts)}
            className="rounded bg-error-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirmar venta
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertySaleModal;
