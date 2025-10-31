import React, { useState, useEffect, useCallback } from 'react';
import { Edit2, FileText, Trash2, XCircle, Search, Building, User, Calendar, Euro, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Contract, Property } from '../../../../../services/db';
import {
  getAllContracts,
  deleteContract,
  rescindContract,
  getContractStatus,
  sendContractForSignature,
  markContractAsSigned,
  SignatureStatus
} from '../../../../../services/contractServiceNew';
import { formatEuro, formatDate } from '../../../../../utils/formatUtils';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../../../services/confirmationService';
import { showPrompt } from '../../../../../services/promptService';

interface ContractsListaEnhancedProps {
  onEditContract: (contract?: Contract) => void;
  onContractsUpdated?: (contracts: Contract[]) => void;
}

const ContractsListaEnhanced: React.FC<ContractsListaEnhancedProps> = ({ onEditContract, onContractsUpdated }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'terminated'>('all');
  const [modalidadFilter, setModalidadFilter] = useState<'all' | 'habitual' | 'temporada' | 'vacacional'>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [signatureProcessingId, setSignatureProcessingId] = useState<number | null>(null);

  const loadData = useCallback(async (retry = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Load contracts with timeout
      const contractsPromise = getAllContracts();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout loading contracts')), 10000)
      );
      
      const contractsData = await Promise.race([contractsPromise, timeoutPromise]);
      setContracts(contractsData);
      onContractsUpdated?.(contractsData);
      
      // Load properties for display with timeout
      const dbPromise = (await import('../../../../../services/db')).initDB();
      const dbTimeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout initializing database')), 5000)
      );
      
      const db = await Promise.race([dbPromise, dbTimeoutPromise]);
      const propertiesData = await db.getAll('properties');
      setProperties(propertiesData);
      
      setRetryCount(0);
      
    } catch (error) {
      console.error('Error loading data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(`Error al cargar los datos: ${errorMessage}`);
      
      // Auto-retry logic for certain errors
      if (retryCount < 3 && (
        errorMessage.includes('Timeout') || 
        errorMessage.includes('Database') ||
        errorMessage.includes('network')
      )) {
        console.log(`Retrying data load (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => loadData(true), 2000);
        return;
      }
      
      if (!retry) {
        toast.error('Error al cargar los datos. Intente recargar la página.');
      }
    } finally {
      setLoading(false);
    }
  }, [retryCount, onContractsUpdated]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // First filter out any undefined or invalid contracts
    let filtered = contracts.filter(contract => contract && contract.inquilino);

    // Filter by search term (tenant name, DNI, or email)
    if (searchTerm.trim()) {
      filtered = filtered.filter(contract => {
        // Check if contract and inquilino exist before accessing properties
        if (!contract || !contract.inquilino) {
          return false;
        }
        return contract.inquilino.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               contract.inquilino.apellidos?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               contract.inquilino.dni?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               contract.inquilino.email?.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(contract => getContractStatus(contract) === statusFilter);
    }

    // Filter by modalidad
    if (modalidadFilter !== 'all') {
      filtered = filtered.filter(contract => contract.modalidad === modalidadFilter);
    }

    // Filter by property
    if (selectedPropertyId !== 'all') {
      filtered = filtered.filter(contract => contract && contract.inmuebleId?.toString() === selectedPropertyId);
    }

    setFilteredContracts(filtered);
  }, [contracts, searchTerm, statusFilter, modalidadFilter, selectedPropertyId]);

  const handleDeleteContract = async (contract: Contract) => {
    if (!contract || !contract.inquilino) {
      toast.error('Contrato inválido');
      return;
    }

    const confirmed = await confirmDelete(`el contrato de ${contract.inquilino.nombre} ${contract.inquilino.apellidos}`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteContract(contract.id!);
      toast.success('Contrato eliminado correctamente');
      loadData();
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast.error('Error al eliminar el contrato');
    }
  };

  const handleRescindContract = async (contract: Contract) => {
    const motivo = await showPrompt({
      title: 'Motivo de la rescisión',
      placeholder: 'Ingrese el motivo de la rescisión del contrato',
      type: 'textarea'
    });
    if (!motivo) return;

    const fechaRescision = await showPrompt({
      title: 'Fecha de rescisión',
      type: 'date',
      defaultValue: new Date().toISOString().split('T')[0]
    });
    if (!fechaRescision) return;

    try {
      await rescindContract(contract.id!, fechaRescision, motivo);
      toast.success('Contrato rescindido correctamente');
      loadData();
    } catch (error) {
      console.error('Error rescinding contract:', error);
      toast.error('Error al rescindir el contrato');
    }
  };

  const handleSendSignature = async (contract: Contract) => {
    if (!contract.id) return;

    if (contract.firma?.metodo !== 'digital') {
      toast.error('Este contrato está configurado para firma manual. Cambia la modalidad en la ficha del contrato.');
      return;
    }

    try {
      setSignatureProcessingId(contract.id);
      await sendContractForSignature(contract.id, contract.firma?.emails);
      toast.success('Contrato enviado a firma digital');
      loadData();
    } catch (error) {
      console.error('Error sending contract for signature:', error);
      const message = error instanceof Error ? error.message : 'Error al enviar a firma digital';
      toast.error(message);
    } finally {
      setSignatureProcessingId(null);
    }
  };

  const handleMarkSigned = async (contract: Contract) => {
    if (!contract.id) return;

    if (contract.firma?.metodo !== 'digital') {
      toast.error('Solo los contratos digitales pueden marcarse como firmados desde aquí.');
      return;
    }

    try {
      setSignatureProcessingId(contract.id);
      await markContractAsSigned(contract.id);
      toast.success('Contrato marcado como firmado');
      loadData();
    } catch (error) {
      console.error('Error marking contract as signed:', error);
      toast.error('Error al marcar el contrato como firmado');
    } finally {
      setSignatureProcessingId(null);
    }
  };

  const getPropertyName = (inmuebleId: number): string => {
    const property = properties.find(p => p.id === inmuebleId);
    return property ? property.alias : `Inmueble ${inmuebleId}`;
  };

  const getStatusBadge = (contract: Contract) => {
    const status = getContractStatus(contract);
    const statusConfig = {
      active: { bg: 'bg-ok', text: 'text-white', label: 'Activo' },
      upcoming: { bg: 'bg-warn', text: 'text-gray-900', label: 'Próximo' },
      terminated: { bg: 'bg-error', text: 'text-white', label: 'Finalizado' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getModalidadBadge = (modalidad: Contract['modalidad']) => {
    const configMap: Record<Contract['modalidad'], { bg: string; text: string; label: string }> = {
      habitual: { bg: 'bg-atlas-blue', text: 'text-white', label: 'Habitual' },
      temporada: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Temporada' },
      vacacional: { bg: 'bg-warning-100', text: 'text-orange-800', label: 'Vacacional' }
    };

    const config = configMap[modalidad] || configMap.habitual;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getSignatureBadge = (contract: Contract) => {
    if (!contract.firma || contract.firma.metodo === 'manual') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-700">
          Firma manual
        </span>
      );
    }

    const estado = (contract.firma.estado || 'borrador') as SignatureStatus;
    const badgeConfig: Record<SignatureStatus, { bg: string; text: string; label: string }> = {
      borrador: { bg: 'bg-neutral-100', text: 'text-neutral-700', label: 'Borrador' },
      preparado: { bg: 'bg-primary-100', text: 'text-primary-800', label: 'Preparado' },
      enviado: { bg: 'bg-warning-100', text: 'text-yellow-800', label: 'Enviado' },
      firmado: { bg: 'bg-success-100', text: 'text-success-800', label: 'Firmado' },
      rechazado: { bg: 'bg-error-100', text: 'text-error-800', label: 'Rechazado' },
    };

    const config = badgeConfig[estado] || badgeConfig.borrador;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getIndexationBadge = (indexacion: string) => {
    if (indexacion === 'none') return null;
    
    const config = {
      ipc: { bg: 'bg-primary-100', text: 'text-primary-800', label: 'IPC' },
      irav: { bg: 'bg-success-100', text: 'text-success-800', label: 'IRAV' },
      otros: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Otros' }
    };

    const badgeConfig = config[indexacion as keyof typeof config] || config.otros;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${badgeConfig.bg} ${badgeConfig.text}`}>
        {badgeConfig.label}
      </span>
    );
  };

  const getUnitDisplay = (contract: Contract): string => {
    if (contract.unidadTipo === 'vivienda') {
      return 'Vivienda completa';
    }
    return `Habitación ${contract.habitacionId || '?'}`;
  };

  const getNextDueDate = (contract: Contract): string => {
    // Calculate next payment due date based on current date and payment day
    const now = new Date();
    const paymentDay = contract.diaPago;
    
    let nextDate = new Date(now.getFullYear(), now.getMonth(), paymentDay);
    
    // If the payment day for this month has passed, move to next month
    if (nextDate < now) {
      nextDate = new Date(now.getFullYear(), now.getMonth() + 1, paymentDay);
    }
    
    return nextDate.toLocaleDateString('es-ES');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Filters skeleton */}
        <div className="bg-white border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Contracts table skeleton */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-40 animate-pulse"></div>
          </div>
          <div className="p-8">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-12 bg-gray-200 rounded w-full animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="atlas-atlas-atlas-atlas-atlas-btn-destructive border border-error-200 p-6 max-w-md">
          <div className="flex items-center mb-4">
            <XCircle className="h-6 w-6 text-error-500 mr-2" />
            <h3 className="text-lg font-medium text-error-900">Error de carga</h3>
          </div>
          <p className="text-error-700 mb-4">{error}</p>
          <div className="flex space-x-3">
            <button
              onClick={() => loadData()}
              className="px-4 py-2 bg-atlas-blue"
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 text-gray-800"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
                placeholder="Nombre, DNI, email..."
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="upcoming">Próximos</option>
              <option value="terminated">Finalizados</option>
            </select>
          </div>

          {/* Modalidad Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modalidad
            </label>
            <select
              value={modalidadFilter}
              onChange={(e) => setModalidadFilter(e.target.value as any)}
              className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value="all">Todas</option>
              <option value="habitual">Habitual</option>
              <option value="temporada">Temporada</option>
              <option value="vacacional">Vacacional</option>
            </select>
          </div>

          {/* Property Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inmueble
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value="all">Todos</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id?.toString()}>
                  {property.alias}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Contratos ({filteredContracts.length})
          </h3>
        </div>

        {filteredContracts.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay contratos</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' || modalidadFilter !== 'all' || selectedPropertyId !== 'all'
                ? 'No se encontraron contratos que coincidan con los filtros.'
                : 'Comience creando su primer contrato.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inmueble/Unidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inquilino
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fechas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modalidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Renta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Indexación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Próximo vencimiento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Firma
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContracts
                  .filter(contract => contract && contract.inquilino) // Filter out undefined contracts
                  .map((contract) => (
                  <tr key={contract.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getPropertyName(contract.inmuebleId)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {getUnitDisplay(contract)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {contract.inquilino?.nombre || 'N/A'} {contract.inquilino?.apellidos || ''}
                          </div>
                          <div className="text-sm text-gray-500">
                            {contract.inquilino?.dni || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(contract.fechaInicio)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(contract.fechaFin)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getModalidadBadge(contract.modalidad)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Euro className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatEuro(contract.rentaMensual)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Día {contract.diaPago}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getIndexationBadge(contract.indexacion)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getNextDueDate(contract)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Pendiente
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSignatureBadge(contract)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(contract)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {contract.firma?.metodo === 'digital' && (
                          <>
                            {(['borrador', 'preparado'] as SignatureStatus[]).includes(((contract.firma?.estado) || 'borrador') as SignatureStatus) && (
                              <button
                                onClick={() => handleSendSignature(contract)}
                                className="text-brand-navy hover:text-brand-navy/80"
                                title="Enviar a firma digital"
                                disabled={signatureProcessingId === contract.id}
                              >
                                {signatureProcessingId === contract.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            {contract.firma?.estado === 'enviado' && (
                              <button
                                onClick={() => handleMarkSigned(contract)}
                                className="text-success-600 hover:text-success-700"
                                title="Marcar como firmado"
                                disabled={signatureProcessingId === contract.id}
                              >
                                {signatureProcessingId === contract.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => onEditContract(contract)}
                          className="text-atlas-blue hover:text-primary-800"
                          title="Editar contrato"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        
                        {contract.estadoContrato === 'activo' && (
                          <button
                            onClick={() => handleRescindContract(contract)}
                            className="text-warn hover:text-warning-700"
                            title="Rescindir contrato"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDeleteContract(contract)}
                          className="text-error hover:text-error-700"
                          title="Eliminar contrato"
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
};

export default ContractsListaEnhanced;