import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Edit2, FileText, Trash2, XCircle, Search, Building, User, Calendar, Euro, Send, CheckCircle2, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Contract, Property } from '../../../../../services/db';
import {
  getAllContracts,
  deleteContract,
  rescindContract,
  getContractStatus,
  sendContractForSignature,
  markContractAsSigned,
  SignatureStatus
} from '../../../../../services/contractService';
import { formatEuro, formatDate } from '../../../../../utils/formatUtils';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../../../services/confirmationService';
import { showPrompt } from '../../../../../services/promptService';
import VinculacionDrawer from './VinculacionDrawer';

interface ContractsListaEnhancedProps {
  onEditContract: (contract?: Contract) => void;
  onContractsUpdated?: (contracts: Contract[]) => void;
}

type SortKey = 'property' | 'tenant' | 'dates' | 'modalidad' | 'rent' | 'indexation' | 'nextDueDate' | 'signature' | 'status';
type SortDirection = 'asc' | 'desc';

const ContractsListaEnhanced: React.FC<ContractsListaEnhancedProps> = ({ onEditContract, onContractsUpdated }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'terminated'>('active');
  const [modalidadFilter, setModalidadFilter] = useState<'all' | 'habitual' | 'temporada' | 'vacacional'>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'property', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [signatureProcessingId, setSignatureProcessingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'terminated' | 'sin_identificar'>('active');
  const [vinculacionDrawer, setVinculacionDrawer] = useState<{
    open: boolean;
    sinIdentificadorId: number;
    ejercicio: number;
    inmuebleAlias: string;
  }>({ open: false, sinIdentificadorId: 0, ejercicio: 0, inmuebleAlias: '' });
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const pageSize = 10;

  const getRoomOrder = (contract: Contract): number => {
    if (contract.unidadTipo !== 'habitacion') {
      return -1;
    }

    const rawRoomId = (contract.habitacionId || '').toString();
    const match = rawRoomId.match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
  };


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
    // First filter out any undefined or invalid contracts, and exclude sin_identificar from main list
    let filtered = contracts.filter(contract => contract && contract.inquilino && contract.estadoContrato !== 'sin_identificar');

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

    const propertyNameById = new Map(properties.map((property) => [property.id, (property.alias || '').toLowerCase()]));

    const getSortValue = (contract: Contract, sortKey: SortKey): string | number => {
      const tenantName = `${contract.inquilino?.nombre || ''} ${contract.inquilino?.apellidos || ''}`.trim();
      switch (sortKey) {
        case 'property':
          return `${propertyNameById.get(contract.inmuebleId) || ''}-${getUnitDisplay(contract).toLowerCase()}-${getRoomOrder(contract)}`;
        case 'tenant':
          return tenantName;
        case 'dates':
          return new Date(contract.fechaInicio).getTime();
        case 'modalidad':
          return contract.modalidad || '';
        case 'rent':
          return contract.rentaMensual || 0;
        case 'indexation':
          return contract.indexacion || '';
        case 'nextDueDate': {
          const now = new Date();
          let nextDate = new Date(now.getFullYear(), now.getMonth(), contract.diaPago);
          if (nextDate < now) {
            nextDate = new Date(now.getFullYear(), now.getMonth() + 1, contract.diaPago);
          }
          return nextDate.getTime();
        }
        case 'signature':
          return contract.firma?.estado || 'manual';
        case 'status':
          return getContractStatus(contract);
        default:
          return '';
      }
    };

    filtered.sort((a, b) => {
      const left = getSortValue(a, sortConfig.key);
      const right = getSortValue(b, sortConfig.key);
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
      }

      return String(left).localeCompare(String(right), 'es', { sensitivity: 'base' }) * direction;
    });

    setFilteredContracts(filtered);
  }, [contracts, searchTerm, statusFilter, modalidadFilter, selectedPropertyId, sortConfig, properties]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, modalidadFilter, selectedPropertyId, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / pageSize));
  const paginatedContracts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContracts.slice(start, start + pageSize);
  }, [filteredContracts, currentPage]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const scrollTableHorizontally = (offset: number) => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

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

  const sinIdentificarContratos = contracts.filter(c => c.estadoContrato === 'sin_identificar');

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div className="lg:order-3">
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

          {/* Modalidad Filter */}
          <div className="lg:order-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modalidad
            </label>
            <select
              value={modalidadFilter}
              onChange={(e) => setModalidadFilter(e.target.value as 'all' | 'habitual' | 'temporada' | 'vacacional')}
              className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value="all">Todas</option>
              <option value="habitual">Habitual</option>
              <option value="temporada">Temporada</option>
              <option value="vacacional">Vacacional</option>
            </select>
          </div>

          {/* Property Filter */}
          <div className="lg:order-2">
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
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-medium text-gray-900">
              Contratos ({activeTab === 'sin_identificar' ? sinIdentificarContratos.length : filteredContracts.length})
            </h3>
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtrar contratos por estado">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'active', label: 'Activos' },
                { id: 'terminated', label: 'Finalizados' },
                ...(sinIdentificarContratos.length > 0
                  ? [{ id: 'sin_identificar', label: `Sin identificar (${sinIdentificarContratos.length})` }]
                  : []),
              ].map((pill) => {
                const isActive = activeTab === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveTab(pill.id as typeof activeTab);
                      if (pill.id !== 'sin_identificar') {
                        setStatusFilter(pill.id as typeof statusFilter);
                      }
                    }}
                    className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-brand-navy bg-primary-50 text-brand-navy'
                        : 'border-neutral-300 bg-white text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollTableHorizontally(-320)}
              className="rounded-md border border-neutral-300 p-2 text-neutral-600 hover:bg-neutral-50"
              aria-label="Desplazar tabla a la izquierda"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTableHorizontally(320)}
              className="rounded-md border border-neutral-300 p-2 text-neutral-600 hover:bg-neutral-50"
              aria-label="Desplazar tabla a la derecha"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {activeTab === 'sin_identificar' ? (
          <div className="p-6">
            {sinIdentificarContratos.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No hay contratos sin identificar.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sinIdentificarContratos.map((contrato) => {
                  const inmuebleAlias = getPropertyName(contrato.inmuebleId);
                  const ejercicios = Object.entries(contrato.ejerciciosFiscales ?? {}).sort(
                    ([a], [b]) => Number(a) - Number(b)
                  );
                  return (
                    <div
                      key={contrato.id}
                      style={{
                        border: '1px solid var(--grey-200)',
                        borderRadius: 10,
                        padding: '16px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)' }}>
                          {inmuebleAlias}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            background: 'var(--grey-100, #f3f4f6)',
                            color: 'var(--grey-500, #6b7280)',
                            borderRadius: 6,
                            padding: '2px 8px',
                          }}
                        >
                          Sin identificar
                        </span>
                      </div>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--grey-500)' }}>
                        Ejercicios con ingresos declarados sin inquilino:
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ejercicios.map(([anio, data]) => {
                          const esSinVincular = data.fuente === 'manual';
                          return (
                            <div
                              key={anio}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'IBM Plex Mono, monospace',
                                  fontSize: 13,
                                  color: 'var(--navy-900)',
                                }}
                              >
                                {anio} ·{' '}
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                                  data.importeDeclarado ?? 0
                                )}
                              </span>
                              {esSinVincular ? (
                                <span style={{ fontSize: 12, color: 'var(--grey-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  ✓ Sin vincular
                                </span>
                              ) : (
                                <button
                                  onClick={() =>
                                    setVinculacionDrawer({
                                      open: true,
                                      sinIdentificadorId: contrato.id!,
                                      ejercicio: Number(anio),
                                      inmuebleAlias,
                                    })
                                  }
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '4px 12px',
                                    background: 'var(--navy-900)',
                                    color: 'var(--white)',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Vincular <ArrowRight size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay contratos</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'active' || modalidadFilter !== 'all' || selectedPropertyId !== 'all'
                ? 'No se encontraron contratos que coincidan con los filtros.'
                : 'Comience creando su primer contrato.'}
            </p>
          </div>
        ) : (
          <>
          <div ref={tableScrollRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('property')} className="inline-flex items-center gap-1">
                      Inmueble/Unidad
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'property' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'property' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('tenant')} className="inline-flex items-center gap-1">
                      Inquilino
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'tenant' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'tenant' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('dates')} className="inline-flex items-center gap-1">
                      Fechas
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'dates' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'dates' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('modalidad')} className="inline-flex items-center gap-1">
                      Modalidad
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'modalidad' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'modalidad' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('rent')} className="inline-flex items-center gap-1">
                      Renta
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'rent' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'rent' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('indexation')} className="inline-flex items-center gap-1">
                      Indexación
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'indexation' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'indexation' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('nextDueDate')} className="inline-flex items-center gap-1">
                      Próximo vencimiento
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'nextDueDate' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'nextDueDate' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('signature')} className="inline-flex items-center gap-1">
                      Firma
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'signature' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'signature' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1">
                      Estado
                      <span className="inline-flex flex-col leading-none">
                        <ChevronUp className={`h-3 w-3 ${sortConfig.key === 'status' && sortConfig.direction === 'asc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                        <ChevronDown className={`-mt-1 h-3 w-3 ${sortConfig.key === 'status' && sortConfig.direction === 'desc' ? 'text-brand-navy' : 'text-gray-400'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedContracts
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
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
            <p className="text-sm text-gray-500">Página {currentPage} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
          </>
        )}
      </div>

      <VinculacionDrawer
        open={vinculacionDrawer.open}
        sinIdentificadorId={vinculacionDrawer.sinIdentificadorId}
        ejercicio={vinculacionDrawer.ejercicio}
        inmuebleAlias={vinculacionDrawer.inmuebleAlias}
        onClose={() => setVinculacionDrawer((prev) => ({ ...prev, open: false }))}
        onVinculado={() => loadData()}
      />
    </div>
  );
};

export default ContractsListaEnhanced;
