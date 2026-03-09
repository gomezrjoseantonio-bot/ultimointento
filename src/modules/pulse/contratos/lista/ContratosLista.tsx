import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import { Contract } from '../../../../services/db';
import {
  getAllContracts,
  calculateRentPeriodsFromContract,
  getContractStatus
} from '../../../../services/contractService';
import { formatEuro } from '../../../../utils/formatUtils';
import ContractsListaEnhanced from '../../../horizon/inmuebles/contratos/components/ContractsListaEnhanced';
import { Users, TrendingUp, Signature, Calendar, Building2 } from 'lucide-react';

const ContratosLista: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const navigate = useNavigate();

  const loadOverview = async () => {
    try {
      setLoadingOverview(true);
      const data = await getAllContracts();
      setContracts(data);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const activeContracts = useMemo(
    () => contracts.filter(contract => getContractStatus(contract) === 'active').length,
    [contracts]
  );

  const vacationalContracts = useMemo(
    () => contracts.filter(contract => contract.modalidad === 'vacacional').length,
    [contracts]
  );

  const digitalPending = useMemo(
    () => contracts.filter(contract => contract.firma?.metodo === 'digital' && contract.firma?.estado !== 'firmado').length,
    [contracts]
  );

  const annualForecast = useMemo(() => {
    const now = new Date();
    const limit = new Date(now.getFullYear() + 1, now.getMonth(), 1);

    return contracts.reduce((total, contract) => {
      const periods = calculateRentPeriodsFromContract(contract);
      const contractSum = periods
        .filter(period => {
          const [year, month] = period.periodo.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          return date >= new Date(now.getFullYear(), now.getMonth(), 1) && date < limit;
        })
        .reduce((sum, period) => sum + period.importe, 0);

      return total + contractSum;
    }, 0);
  }, [contracts]);

  const upcomingDigitalSignatures = useMemo(() => {
    return contracts
      .filter(contract => contract.firma?.metodo === 'digital' && contract.firma?.estado !== 'firmado')
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())
      .slice(0, 3);
  }, [contracts]);

  const upcomingRenewals = useMemo(() => {
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + 3);

    return contracts
      .filter(contract => {
        const endDate = new Date(contract.fechaFin);
        return endDate > new Date() && endDate <= horizon;
      })
      .sort((a, b) => new Date(a.fechaFin).getTime() - new Date(b.fechaFin).getTime())
      .slice(0, 3);
  }, [contracts]);

  const handleEditContract = (contract?: Contract) => {
    if (contract && contract.id) {
      navigate(`/contratos/nuevo?id=${contract.id}`);
    } else {
      navigate('/contratos/nuevo');
    }
  };

  const handleContractsUpdated = (updatedContracts: Contract[]) => {
    setContracts(updatedContracts);
  };

  const formatDate = (value: string) => {
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  return (
    <PageLayout
      title="Alquileres"
      subtitle="Crea contratos, controla las firmas digitales y visualiza la previsión de ingresos de tu cartera."
      primaryAction={{
        label: 'Nuevo contrato',
        onClick: () => navigate('/contratos/nuevo')
      }}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Contratos activos</span>
              <Users className="h-5 w-5 text-brand-navy" />
            </div>
            <p className="text-3xl font-semibold text-neutral-900 mt-3">
              {loadingOverview ? '—' : activeContracts}
            </p>
            <p className="text-sm text-neutral-500 mt-1">Gestionados en tiempo real</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Ingreso anual previsto</span>
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-semibold text-neutral-900 mt-3">
              {loadingOverview ? '—' : formatEuro(annualForecast)}
            </p>
            <p className="text-sm text-neutral-500 mt-1">Suma de los próximos 12 meses</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Firmas digitales pendientes</span>
              <Signature className="h-5 w-5 text-orange-500" />
            </div>
            <p className="text-3xl font-semibold text-neutral-900 mt-3">
              {loadingOverview ? '—' : digitalPending}
            </p>
            <p className="text-sm text-neutral-500 mt-1">Listas para enviar o revisar</p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Contratos vacacionales</span>
              <Building2 className="h-5 w-5 text-warning-600" />
            </div>
            <p className="text-3xl font-semibold text-neutral-900 mt-3">
              {loadingOverview ? '—' : vacationalContracts}
            </p>
            <p className="text-sm text-neutral-500 mt-1">Ajusta precios y estancias fácilmente</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Próximas firmas digitales</h3>
              <Signature className="h-5 w-5 text-brand-navy" />
            </div>
            {upcomingDigitalSignatures.length === 0 ? (
              <p className="text-sm text-neutral-500">No hay firmas pendientes. Configura un contrato digital para comenzar.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingDigitalSignatures.map(contract => (
                  <li key={contract.id} className="flex items-center justify-between border border-neutral-200 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {contract.inquilino?.nombre} {contract.inquilino?.apellidos}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Inicio {formatDate(contract.fechaInicio)} · {contract.modalidad === 'vacacional' ? 'Vacacional' : 'Residencial'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleEditContract(contract)}
                      className="text-sm font-medium text-brand-navy hover:text-brand-navy/80"
                    >
                      Revisar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Renovaciones en horizonte</h3>
              <Calendar className="h-5 w-5 text-brand-navy" />
            </div>
            {upcomingRenewals.length === 0 ? (
              <p className="text-sm text-neutral-500">No hay contratos próximos a renovar en los próximos 90 días.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingRenewals.map(contract => (
                  <li key={contract.id} className="border border-neutral-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-neutral-900">
                      {contract.inquilino?.nombre} {contract.inquilino?.apellidos}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Finaliza el {formatDate(contract.fechaFin)} · {contract.modalidad === 'vacacional' ? 'Vacacional' : 'Habitual/Temporada'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <ContractsListaEnhanced
          onEditContract={handleEditContract}
          onContractsUpdated={handleContractsUpdated}
        />
      </div>
    </PageLayout>
  );
};

export default ContratosLista;
