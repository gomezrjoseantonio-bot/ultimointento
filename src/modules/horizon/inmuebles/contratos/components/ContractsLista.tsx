import React, { useState, useEffect, useCallback } from 'react';
import { Edit2, FileText, Trash2, XCircle, Search } from 'lucide-react';
import { Contract } from '../../../../../services/db';
import { getAllContracts, deleteContract, terminateContract, getContractStatus } from '../../../../../services/contractService';
import { formatEuro, formatDate } from '../../../../../utils/formatUtils';
import toast from 'react-hot-toast';

interface ContractsListaProps {
  onEditContract: (contract?: Contract) => void;
}

const ContractsLista: React.FC<ContractsListaProps> = ({ onEditContract }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'terminated'>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');

  useEffect(() => {
    loadContracts();
  }, []);

  const filterContracts = useCallback(() => {
    let filtered = [...contracts];

    // Filter by search term (tenant name)
    if (searchTerm.trim()) {
      filtered = filtered.filter(contract => {
        const tenantName = contract.inquilino ? `${contract.inquilino.nombre} ${contract.inquilino.apellidos}` : 
                          contract.tenant?.name || '';
        const tenantDni = contract.inquilino?.dni || contract.tenant?.nif || '';
        const tenantEmail = contract.inquilino?.email || contract.tenant?.email || '';
        
        return tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               tenantDni.toLowerCase().includes(searchTerm.toLowerCase()) ||
               tenantEmail.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(contract => getContractStatus(contract) === statusFilter);
    }

    // Filter by property
    if (selectedPropertyId !== 'all') {
      filtered = filtered.filter(contract => 
        (contract.inmuebleId || contract.propertyId || 0).toString() === selectedPropertyId
      );
    }

    setFilteredContracts(filtered);
  }, [contracts, searchTerm, statusFilter, selectedPropertyId]);

  useEffect(() => {
    filterContracts();
  }, [filterContracts]);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const data = await getAllContracts();
      setContracts(data);
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('Error al cargar los contratos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContract = async (id: number) => {
    if (!window.// TODO: Replace with ATLAS confirmation modal
    // confirm('¿Está seguro de que desea eliminar este contrato? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await deleteContract(id);
      toast.success('Contrato eliminado correctamente');
      loadContracts();
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast.error('Error al eliminar el contrato');
    }
  };

  const handleTerminateContract = async (id: number) => {
    const terminationDate = // TODO: Replace with ATLAS input modal
    // prompt('Ingrese la fecha de terminación (YYYY-MM-DD):');
    if (!terminationDate) return;

    try {
      await terminateContract(id, terminationDate, 'Manual termination');
      toast.success('Contrato terminado correctamente');
      loadContracts();
    } catch (error) {
      console.error('Error terminating contract:', error);
      toast.error('Error al terminar el contrato');
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'upcoming':
        return 'Próximo';
      case 'terminated':
        return 'Finalizado';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success-100 text-success-800';
      case 'upcoming':
        return 'bg-primary-100 text-primary-800';
      case 'terminated':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatUnits = (contract: Contract) => {
    if (contract.scope === 'full-property') {
      return 'Inmueble completo';
    }
    return contract.selectedUnits?.join(', ') || 'Unidades seleccionadas';
  };

  const formatContractType = (type: string) => {
    return type === 'vivienda' ? 'Vivienda' : 'Habitación';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar inquilino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="upcoming">Próximos</option>
              <option value="terminated">Finalizados</option>
            </select>
          </div>

          {/* Property Filter */}
          <div>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="all">Todos los inmuebles</option>
              {/* TODO: Load actual properties */}
            </select>
          </div>

          {/* New Contract Button */}
          <div>
            <button
              onClick={() => onEditContract()}
              className="w-full bg-brand-navy text-white px-4 py-2 rounded-md hover:bg-brand-navy/90 transition-colors"
            >
              Nuevo contrato
            </button>
          </div>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        {filteredContracts.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            {contracts.length === 0 ? 'No hay contratos registrados' : 'No se encontraron contratos con los filtros aplicados'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Inmueble / Unidad(es)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Inquilino
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Fechas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Renta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {filteredContracts.map((contract) => {
                  const status = getContractStatus(contract);
                  return (
                    <tr key={contract.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">
                            Inmueble #{contract.propertyId}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {formatUnits(contract)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">
                            {contract.inquilino ? `${contract.inquilino.nombre} ${contract.inquilino.apellidos}` : 
                             contract.tenant?.name || 'Inquilino sin nombre'}
                          </div>
                          {(contract.inquilino?.dni || contract.tenant?.nif) && (
                            <div className="text-sm text-neutral-500">
                              {contract.inquilino?.dni || contract.tenant?.nif}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {formatContractType(contract.unidadTipo || contract.type || 'vivienda')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-neutral-900">
                            {formatDate(contract.fechaInicio || contract.startDate || '')}
                          </div>
                          <div className="text-sm text-neutral-500">
                            {contract.isIndefinite ? 'Indef.' : ((contract.fechaFin || contract.endDate) ? formatDate(contract.fechaFin || contract.endDate || '') : '—')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                        {formatEuro(contract.monthlyRent)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                          {getStatusText(status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onEditContract(contract)}
                            className="text-brand-navy hover:text-brand-navy/80 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          
                          <button
                            className="text-neutral-600 hover:text-neutral-800 transition-colors"
                            title="Adjuntos"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          
                          {status === 'active' && (
                            <button
                              onClick={() => handleTerminateContract(contract.id!)}
                              className="text-warning-600 hover:text-yellow-800 transition-colors"
                              title="Terminar contrato"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDeleteContract(contract.id!)}
                            className="text-error-600 hover:text-error-800 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractsLista;