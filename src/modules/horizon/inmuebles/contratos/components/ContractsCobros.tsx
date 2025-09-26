import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Check, DollarSign, FileText } from 'lucide-react';
import { Contract, RentPayment } from '../../../../../services/db';
import { getAllContracts, getRentPayments, markPaymentAsPaid, markPaymentAsPartial } from '../../../../../services/contractService';
import { formatEuro, parseEuroInput, formatDate } from '../../../../../utils/formatUtils';
import toast from 'react-hot-toast';

interface PaymentEntry extends RentPayment {
  contractInfo?: {
    tenantName: string;
    propertyId: number;
  };
}

interface PaymentModalData {
  paymentId: number;
  expectedAmount: number;
  currentStatus: string;
}

const ContractsCobros: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentEntry[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'partial'>('all');
  const [loading, setLoading] = useState(true);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<PaymentModalData | null>(null);
  const [modalForm, setModalForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    isPartial: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const filterPayments = useCallback(() => {
    let filtered = [...payments];

    // Filter by contract
    if (selectedContractId !== 'all') {
      filtered = filtered.filter(payment => payment.contractId.toString() === selectedContractId);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    // Sort by period (descending)
    filtered.sort((a, b) => b.period.localeCompare(a.period));

    setFilteredPayments(filtered);
  }, [payments, selectedContractId, statusFilter]);

  useEffect(() => {
    filterPayments();
  }, [filterPayments]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load contracts
      const contractsData = await getAllContracts();
      setContracts(contractsData);
      
      // Load payments for all contracts
      const allPayments: PaymentEntry[] = [];
      
      for (const contract of contractsData) {
        if (contract.id) {
          const contractPayments = await getRentPayments(contract.id);
          const paymentsWithContractInfo = contractPayments.map(payment => ({
            ...payment,
            contractInfo: {
              tenantName: contract.inquilino ? `${contract.inquilino.nombre} ${contract.inquilino.apellidos}` : 
                         contract.tenant?.name || 'Inquilino sin nombre',
              propertyId: contract.inmuebleId || contract.propertyId || 0,
            },
          }));
          allPayments.push(...paymentsWithContractInfo);
        }
      }
      
      setPayments(allPayments);
    } catch (error) {
      console.error('Error loading payments data:', error);
      toast.error('Error al cargar los cobros');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const visiblePayments = filteredPayments;
    
    const pending = visiblePayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.expectedAmount, 0);
    
    const paid = visiblePayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.paidAmount || p.expectedAmount), 0);
    
    const partial = visiblePayments
      .filter(p => p.status === 'partial')
      .reduce((sum, p) => sum + (p.paidAmount || 0), 0);

    return { pending, paid: paid + partial };
  };

  const openPaymentModal = (payment: PaymentEntry, isPartial: boolean = false) => {
    setPaymentModalData({
      paymentId: payment.id!,
      expectedAmount: payment.expectedAmount,
      currentStatus: payment.status,
    });
    
    setModalForm({
      amount: isPartial ? '' : formatEuro(payment.expectedAmount).replace('€', '').trim(),
      date: new Date().toISOString().split('T')[0],
      notes: '',
      isPartial,
    });
    
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentModalData(null);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentModalData) return;

    const amount = parseEuroInput(modalForm.amount);
    if (!amount || amount <= 0) {
      toast.error('El importe debe ser mayor que 0');
      return;
    }

    if (modalForm.isPartial && amount >= paymentModalData.expectedAmount) {
      toast.error('Para pago parcial, el importe debe ser menor que el esperado');
      return;
    }

    try {
      if (modalForm.isPartial) {
        await markPaymentAsPartial(
          paymentModalData.paymentId,
          amount,
          modalForm.date,
          modalForm.notes.trim() || undefined
        );
        toast.success('Pago parcial registrado');
      } else {
        await markPaymentAsPaid(
          paymentModalData.paymentId,
          amount,
          modalForm.date,
          modalForm.notes.trim() || undefined
        );
        toast.success('Pago registrado como cobrado');
      }
      
      loadData();
      closePaymentModal();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Error al actualizar el pago');
    }
  };

  const formatPeriod = (period: string): string => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return new Intl.DateTimeFormat('es-ES', { 
      month: 'long', 
      year: 'numeric' 
    }).format(date);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'paid':
        return 'Cobrado';
      case 'partial':
        return 'Parcial';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning-100 text-yellow-800';
      case 'paid':
        return 'bg-success-100 text-success-800';
      case 'partial':
        return 'bg-primary-100 text-primary-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Totals */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <CreditCard className="h-6 w-6 text-brand-navy" />
            <h2 className="text-xl font-semibold text-neutral-900">Cobros</h2>
          </div>
          
          {/* Totals */}
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-sm text-neutral-600">Pendiente</div>
              <div className="text-lg font-semibold text-warning-600">
                {formatEuro(totals.pending)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-neutral-600">Cobrado</div>
              <div className="text-lg font-semibold text-success-600">
                {formatEuro(totals.paid)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Contrato
            </label>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="all">Todos los contratos</option>
              {contracts.map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.inquilino ? `${contract.inquilino.nombre} ${contract.inquilino.apellidos}` : 
                   contract.tenant?.name || 'Inquilino sin nombre'} - Inmueble #{contract.inmuebleId || contract.propertyId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="paid">Cobrados</option>
              <option value="partial">Parciales</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            {payments.length === 0 ? 'No hay cobros registrados' : 'No se encontraron cobros con los filtros aplicados'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Período
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Contrato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Inmueble
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Importe previsto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Importe cobrado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Fecha de cobro
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      {formatPeriod(payment.period)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {payment.contractInfo?.tenantName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      Inmueble #{payment.contractInfo?.propertyId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      {formatEuro(payment.expectedAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {payment.paidAmount ? formatEuro(payment.paidAmount) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {getStatusText(payment.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {payment.paymentDate ? formatDate(payment.paymentDate) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {payment.status === 'pending' && (
                          <>
                            <button
                              onClick={() => openPaymentModal(payment, false)}
                              className="text-success-600 hover:text-success-800 transition-colors"
            title="Marcar como cobrado"
          >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openPaymentModal(payment, true)}
                              className="text-primary-600 hover:text-primary-800 transition-colors"
            title="Pago parcial"
          >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        
                        {payment.status === 'partial' && (
                          <button
                            onClick={() => openPaymentModal(payment, false)}
                            className="text-success-600 hover:text-success-800 transition-colors"
            title="Completar pago"
          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          className="text-neutral-600 hover:text-neutral-800 transition-colors"
            title="Adjuntar justificante"
          >
                          <FileText className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && paymentModalData && (
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalForm.isPartial ? 'Registrar pago parcial' : 'Marcar como cobrado'}
              </h3>
              <button
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importe esperado
                </label>
                <input
                  type="text"
                  value={formatEuro(paymentModalData.expectedAmount)}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importe {modalForm.isPartial ? 'parcial' : 'cobrado'} *
                </label>
                <input
                  type="text"
                  value={modalForm.amount}
                  onChange={(e) => setModalForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                  placeholder="1.200,00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de cobro *
                </label>
                <input
                  type="date"
                  value={modalForm.date}
                  onChange={(e) => setModalForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            required
          />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={modalForm.notes}
                  onChange={(e) => setModalForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                  >
                  rows={3}
                  placeholder="Notas sobre el pago..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors"
                >
                  {modalForm.isPartial ? 'Registrar pago parcial' : 'Marcar como cobrado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractsCobros;