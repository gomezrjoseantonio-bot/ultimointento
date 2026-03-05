import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, FileText, Clipboard, LayoutList, TrendingDown, Users } from 'lucide-react';
import { Property, Contract, initDB } from '../../../../services/db';
import { ensurePropertyOccupancy, savePropertyOccupancy } from '../../../../services/propertyOccupancyService';
import { formatEuro, formatDate, formatInteger, formatPercentage } from '../../../../utils/formatUtils';
import { getITPRateForCCAA } from '../../../../utils/locationUtils';
import { getAllContracts, getContractStatus } from '../../../../services/contractService';
import toast from 'react-hot-toast';
import InmueblePresupuestoTab from '../../../../components/inmuebles/InmueblePresupuestoTab';


type DetailTab = 'resumen' | 'contratos' | 'presupuesto' | 'fiscal';

const isDetailTab = (value: string | null): value is DetailTab =>
  value === 'resumen' || value === 'contratos' || value === 'presupuesto' || value === 'fiscal';

const getContractDateRange = (contract: Contract): { start: Date; end: Date } | null => {
  const startRaw = contract.fechaInicio || contract.startDate;
  const endRaw = contract.fechaFin || contract.endDate;
  if (!startRaw || !endRaw) return null;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return start <= end ? { start, end } : { start: end, end: start };
};

const calculateOccupiedDaysFromContracts = (contracts: Contract[], year: number): number => {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const occupiedDays = new Set<string>();

  contracts.forEach((contract) => {
    const range = getContractDateRange(contract);
    if (!range) return;

    const start = range.start > yearStart ? range.start : yearStart;
    const end = range.end < yearEnd ? range.end : yearEnd;
    if (start > end) return;

    const cursor = new Date(start);
    while (cursor <= end) {
      occupiedDays.add(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return occupiedDays.size;
};

const PropertyDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
  const [occupancyYear, setOccupancyYear] = useState<number>(new Date().getFullYear());
  const [occupancy, setOccupancy] = useState<{ daysUnderRenovation: number; daysAvailable: number; notes: string }>({ daysUnderRenovation: 0, daysAvailable: 365, notes: '' });
  const [savingOccupancy, setSavingOccupancy] = useState(false);

  const loadProperty = useCallback(async (propertyId: number) => {
    try {
      setLoading(true);
      const db = await initDB();
      const prop = await db.get('properties', propertyId);
      
      if (prop) {
        setProperty(prop);
        try {
          const allContracts = await getAllContracts();
          setContracts(allContracts.filter(c => c.inmuebleId === propertyId || c.propertyId === propertyId));
        } catch {
          setContracts([]);
        }
      } else {
        toast.error('Inmueble no encontrado');
        navigate('/inmuebles/cartera');
      }
    } catch (error) {
      console.error('Error loading property:', error);
      toast.error('Error al cargar el inmueble');
      navigate('/inmuebles/cartera');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (id) {
      loadProperty(parseInt(id));
    }
  }, [id, loadProperty]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isDetailTab(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    const loadOccupancy = async () => {
      if (!property?.id) return;
      try {
        const data = await ensurePropertyOccupancy(property.id, occupancyYear);
        setOccupancy({
                    daysUnderRenovation: data.daysUnderRenovation ?? 0,
          daysAvailable: data.daysAvailable ?? (new Date(occupancyYear, 1, 29).getDate() === 29 ? 366 : 365),
          notes: data.notes ?? '',
        });
      } catch (e) {
        console.error('Error loading occupancy', e);
      }
    };
    loadOccupancy();
  }, [property?.id, occupancyYear]);

  const handleSaveOccupancy = async () => {
    if (!property?.id) return;
    try {
      setSavingOccupancy(true);
      const saved = await savePropertyOccupancy(property.id, occupancyYear, {
        daysRented: calculatedOccupiedDays,
        daysUnderRenovation: occupancy.daysUnderRenovation,
        notes: occupancy.notes,
      });
      setOccupancy(prev => ({
        ...prev,
        daysUnderRenovation: saved.daysUnderRenovation || 0,
        daysAvailable: saved.daysAvailable,
      }));
      toast.success('Ocupación anual guardada');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar la ocupación anual');
    } finally {
      setSavingOccupancy(false);
    }
  };

  const calculateTotalCost = (prop: Property): number => {
    const costs = prop.acquisitionCosts;
    return costs.price +
           (costs.itp || 0) +
           (costs.iva || 0) +
           (costs.notary || 0) +
           (costs.registry || 0) +
           (costs.management || 0) +
           (costs.psi || 0) +
           (costs.realEstate || 0) +
           (costs.other?.reduce((sum, item) => sum + item.amount, 0) || 0);
  };

  const calculatePricePerSqm = (prop: Property): number => {
    const totalCost = calculateTotalCost(prop);
    return prop.squareMeters > 0 ? totalCost / prop.squareMeters : 0;
  };

  const copyEmailAlias = () => {
    if (property) {
      // Generate email alias based on property alias (simplified)
      const emailAlias = `inmueble-${property.alias.toLowerCase().replace(/\s+/g, '-')}-${property.id}@inbound.atlas.app`;
      navigator.clipboard.writeText(emailAlias);
      toast.success('Alias de email copiado al portapapeles');
    }
  };

  const viewDocuments = () => {
    if (property) {
      // Navigate to inbox filtered by this property
      navigate(`/inbox?destino=inmueble-${property.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-neutral-600">Cargando inmueble...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-neutral-600">Inmueble no encontrado</div>
      </div>
    );
  }

  const totalCost = calculateTotalCost(property);
  const pricePerSqm = calculatePricePerSqm(property);
  const activeContractsAtQueryDate = contracts.filter((contract) => getContractStatus(contract) === 'active');
  const calculatedOccupiedDays = calculateOccupiedDaysFromContracts(contracts, occupancyYear);
  const daysAtDisposal = Math.max(0, occupancy.daysAvailable - calculatedOccupiedDays - occupancy.daysUnderRenovation);
  const occupancyRate = occupancy.daysAvailable > 0 ? (calculatedOccupiedDays / occupancy.daysAvailable) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/inmuebles/cartera')}
            className="p-2 text-neutral-600 hover:text-neutral-800"
          >
            <ArrowLeft className="h-5 w-5" size={24}  />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{property.alias}</h1>
            <p className="text-neutral-600">{property.address}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/inmuebles/cartera/${property.id}/editar`)}
          className="flex items-center px-4 py-2 bg-brand-navy"
        >
          <Pencil className="h-5 w-5 mr-2" size={24}  />
          Editar
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 rounded-lg p-1 w-fit" role="tablist">
        {(
          [
            { id: 'resumen', label: 'Operación', Icon: LayoutList },
            { id: 'contratos', label: 'Alquileres', Icon: Users },
            { id: 'presupuesto', label: 'Gastos', Icon: TrendingDown },
            { id: 'fiscal', label: 'Fiscal', Icon: FileText },
          ] as { id: DetailTab; label: string; Icon: React.ElementType }[]
        ).map(({ id: tabId, label, Icon }) => {
          const isActive = activeTab === tabId;
          return (
            <button
              key={tabId}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tabId)}
              className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white text-atlas-blue shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className={`-ml-0.5 mr-2 h-4 w-4 ${isActive ? 'text-atlas-blue' : 'text-gray-400'}`} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'presupuesto' ? (
        <InmueblePresupuestoTab propertyId={property.id!} />
      ) : activeTab === 'contratos' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-neutral-900">Contratos / Ingresos</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/tesoreria')}
                className="text-sm text-brand-navy hover:text-brand-navy/80"
              >
                Ver cobros en Tesorería →
              </button>
              <button
                onClick={() => navigate('/inmuebles/contratos')}
                className="text-sm text-brand-navy hover:text-brand-navy/80"
              >
                Gestionar todos los contratos →
              </button>
            </div>
          </div>
          {activeContractsAtQueryDate.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-neutral-300 mb-3" />
              <p className="text-sm text-neutral-600">No hay contratos activos para la fecha de consulta.</p>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Inquilino</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Inicio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Renta mensual</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {activeContractsAtQueryDate.map((contract) => (
                    <tr key={contract.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {contract.inquilino
                          ? `${contract.inquilino.nombre} ${contract.inquilino.apellidos}`
                          : (contract.tenant?.name ?? '—')}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {formatDate(contract.fechaInicio || contract.startDate || '')}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {formatDate(contract.fechaFin || contract.endDate || '')}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900">
                        {formatEuro(contract.rentaMensual || contract.monthlyRent || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          contract.estadoContrato === 'activo' || contract.status === 'active'
                            ? 'bg-success-100 text-success-800'
                            : contract.estadoContrato === 'rescindido' || contract.status === 'terminated'
                            ? 'bg-error-100 text-error-800'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {contract.estadoContrato === 'activo' || contract.status === 'active'
                            ? 'Activo'
                            : contract.estadoContrato === 'rescindido' || contract.status === 'terminated'
                            ? 'Rescindido'
                            : 'Finalizado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
      <div className="bg-white border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Resumen</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-neutral-500">Alias</dt>
              <dd className="mt-1 text-sm text-neutral-900">{property.alias}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Dirección</dt>
              <dd className="mt-1 text-sm text-neutral-900">{property.address}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Ubicación</dt>
              <dd className="mt-1 text-sm text-neutral-900">
                {property.ccaa} · {property.province} · {property.municipality} · {property.postalCode}
              </dd>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-neutral-500">Fecha de compra</dt>
              <dd className="mt-1 text-sm text-neutral-900">{formatDate(property.purchaseDate)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Superficie</dt>
              <dd className="mt-1 text-sm text-neutral-900">{formatInteger(property.squareMeters)} m²</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">Composición</dt>
              <dd className="mt-1 text-sm text-neutral-900">
                {formatInteger(property.bedrooms)} habitaciones · {formatInteger(property.bathrooms)} baños
              </dd>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-neutral-500">Estado</dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-medium ${
                  property.state === 'activo' 
                    ? 'bg-success-100 text-success-800'
                    : property.state === 'vendido'
                    ? 'bg-primary-100 text-primary-800'
                    : 'bg-neutral-100 text-neutral-800'
                }`}>
                  {property.state.charAt(0).toUpperCase() + property.state.slice(1)}
                </span>
              </dd>
            </div>
            {property.cadastralReference && (
              <div>
                <dt className="text-sm font-medium text-neutral-500">Referencia catastral</dt>
                <dd className="mt-1 text-sm text-neutral-900 font-mono">{property.cadastralReference}</dd>
              </div>
            )}
            {property.notes && (
              <div>
                <dt className="text-sm font-medium text-neutral-500">Notas</dt>
                <dd className="mt-1 text-sm text-neutral-900">{property.notes}</dd>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Costes de adquisición */}
      <div className="bg-white border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Costes de adquisición</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between py-2">
            <span className="text-sm text-neutral-600">Precio de compra</span>
            <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.price)}</span>
          </div>

          {property.transmissionRegime === 'usada' && property.acquisitionCosts.itp && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">
                ITP ({getITPRateForCCAA(property.ccaa)}% {property.ccaa})
                {property.acquisitionCosts.itpIsManual && (
                  <span className="ml-2 bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded text-xs">Manual</span>
                )}
              </span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.itp)}</span>
            </div>
          )}

          {property.transmissionRegime === 'obra-nueva' && property.acquisitionCosts.iva && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">IVA</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.iva)}</span>
            </div>
          )}

          {property.acquisitionCosts.notary && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">Notaría</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.notary)}</span>
            </div>
          )}

          {property.acquisitionCosts.registry && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">Registro</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.registry)}</span>
            </div>
          )}

          {property.acquisitionCosts.management && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">Gestoría</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.management)}</span>
            </div>
          )}

          {property.acquisitionCosts.psi && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">PSI (personal shopper)</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.psi)}</span>
            </div>
          )}

          {property.acquisitionCosts.realEstate && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">Inmobiliaria</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(property.acquisitionCosts.realEstate)}</span>
            </div>
          )}

          {property.acquisitionCosts.other?.map((item, index) => (
            <div key={index} className="flex justify-between py-2">
              <span className="text-sm text-neutral-600">{item.concept}</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(item.amount)}</span>
            </div>
          ))}

          <div className="border-t pt-3 mt-4">
            <div className="flex justify-between py-2">
              <span className="text-base font-semibold text-neutral-900">Coste total</span>
              <span className="text-base font-semibold text-neutral-900">{formatEuro(totalCost)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-sm text-neutral-600">€/m²</span>
              <span className="text-sm font-medium text-neutral-900">{formatEuro(pricePerSqm)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CAPEX (placeholder for H5) */}
      <div className="bg-white border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">CAPEX</h3>
        <div className="flex justify-between py-2">
          <span className="text-sm text-neutral-600">CAPEX (acumulado)</span>
          <span className="text-sm text-neutral-500">—</span>
        </div>
        <p className="text-xs text-neutral-500 mt-2">El cálculo de CAPEX se implementará en H5</p>
      </div>

      {activeTab === 'fiscal' && (
        <>
      {/* H5: Datos fiscales auxiliares */}
      <div className="bg-white border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Datos fiscales auxiliares</h3>
        <p className="text-sm text-neutral-600 mb-4">Capturar ahora, calcular en H9</p>
        
        <div className="space-y-4">
          {/* Valores catastrales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-neutral-600">Valor catastral</div>
              <div className="text-sm font-medium text-neutral-900">
                {property.fiscalData?.cadastralValue ? formatEuro(property.fiscalData.cadastralValue) : '—'}
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-600">Valor catastral construcción</div>
              <div className="text-sm font-medium text-neutral-900">
                {property.fiscalData?.constructionCadastralValue ? formatEuro(property.fiscalData.constructionCadastralValue) : '—'}
              </div>
            </div>
          </div>

          {/* Porcentaje construcción calculado */}
          {property.fiscalData?.cadastralValue && property.fiscalData?.constructionCadastralValue && (
            <div>
              <div className="text-sm text-neutral-600">% construcción (calculado)</div>
              <div className="text-sm font-medium text-neutral-900">
                {formatPercentage((property.fiscalData.constructionCadastralValue / property.fiscalData.cadastralValue) * 100)}
              </div>
            </div>
          )}

          {/* Fecha de adquisición */}
          <div>
            <div className="text-sm text-neutral-600">Fecha de adquisición</div>
            <div className="text-sm font-medium text-neutral-900">
              {property.fiscalData?.acquisitionDate ? formatDate(property.fiscalData.acquisitionDate) : formatDate(property.purchaseDate)}
            </div>
          </div>

          {/* Uso del contrato */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-neutral-600">Uso contrato</div>
              <div className="text-sm font-medium text-neutral-900">
                {property.fiscalData?.contractUse ? 
                  (property.fiscalData.contractUse === 'vivienda-habitual' ? 'Vivienda habitual' :
                   property.fiscalData.contractUse === 'turistico' ? 'Turístico' : 'Otros') : '—'}
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-600">¿Reducción vivienda?</div>
              <div className="text-sm font-medium text-neutral-900">
                {property.fiscalData?.housingReduction !== undefined ? 
                  (property.fiscalData.housingReduction ? 'Sí' : 'No') : '—'}
              </div>
            </div>
          </div>

          {/* Inmueble accesorio */}
          {property.fiscalData?.isAccessory && (
            <div className="bg-[var(--atlas-info-100)] border border-[var(--atlas-info-300)] p-3">
              <div className="text-sm font-medium text-primary-900 mb-2">Inmueble accesorio</div>
              {property.fiscalData.mainPropertyId && (
                <div className="text-xs text-primary-700">
                  Vinculado a inmueble principal ID: {property.fiscalData.mainPropertyId}
                </div>
              )}
              {property.fiscalData.accessoryData && (
                <div className="mt-2 space-y-1 text-xs text-primary-700">
                  <div>Ref. catastral: {property.fiscalData.accessoryData.cadastralReference}</div>
                  <div>Fecha adquisición: {formatDate(property.fiscalData.accessoryData.acquisitionDate)}</div>
                  <div>Valor catastral: {formatEuro(property.fiscalData.accessoryData.cadastralValue)}</div>
                  <div>Valor construcción: {formatEuro(property.fiscalData.accessoryData.constructionCadastralValue)}</div>
                </div>
              )}
            </div>
          )}

          {/* Note about editing */}
          <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200">
            <div className="text-xs text-neutral-600">
              Para editar estos datos fiscales auxiliares, utiliza el botón "Editar" en la parte superior de la página.
            </div>
          </div>
        </div>
      </div>

      {/* Ocupación anual (Grupo 1.1) */}
      <div className="bg-white border border-neutral-200 p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Ocupación anual</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600">Ejercicio</label>
            <input
              type="number"
              className="w-28 px-3 py-2 border border-neutral-300 rounded-md"
              value={occupancyYear}
              onChange={(e) => setOccupancyYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-neutral-600 mb-1">Días alquilado (derivado de contratos)</div>
            <div className="h-10 px-3 py-2 border border-neutral-200 rounded-md bg-neutral-50 text-sm text-neutral-900">{calculatedOccupiedDays}</div>
          </div>
          <div>
            <div className="text-sm text-neutral-600 mb-1">Días en obras</div>
            <input type="number" min={0} max={Math.max(0, occupancy.daysAvailable - calculatedOccupiedDays)} className="w-full px-3 py-2 border border-neutral-300 rounded-md" value={occupancy.daysUnderRenovation} onChange={(e) => setOccupancy(prev => ({ ...prev, daysUnderRenovation: Number(e.target.value) || 0 }))} />
          </div>
          <div>
            <div className="text-sm text-neutral-600 mb-1">Días a disposición</div>
            <div className="h-10 px-3 py-2 border border-neutral-200 rounded-md bg-neutral-50 text-sm text-neutral-900">{daysAtDisposal}</div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded-md text-xs text-neutral-600">
          La ocupación y tasa de ocupación se calculan automáticamente desde las fechas de los contratos.
          Puedes añadir únicamente ajustes manuales por excepciones (por ejemplo, días en obras).
        </div>
        <div className="mt-3 text-sm text-neutral-700">
          Tasa de ocupación del ejercicio: <span className="font-semibold">{occupancyRate.toFixed(2)}%</span>
        </div>
        <div className="mt-4">
          <div className="text-sm text-neutral-600 mb-1">Notas</div>
          <textarea className="w-full px-3 py-2 border border-neutral-300 rounded-md" rows={2} value={occupancy.notes} onChange={(e) => setOccupancy(prev => ({ ...prev, notes: e.target.value }))} />
        </div>
        <div className="mt-4">
          <button onClick={handleSaveOccupancy} disabled={savingOccupancy} className="atlas-btn-primary">{savingOccupancy ? 'Guardando…' : 'Guardar ocupación'}</button>
        </div>
      </div>


        </>
      )}

      {/* Atajos */}
      <div className="bg-white border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Atajos</h3>
        
        <div className="space-y-3">
          <button
            onClick={viewDocuments}
            className="flex items-center w-full p-3 text-left border border-neutral-200"
          >
            <FileText className="h-5 w-5 text-brand-navy mr-3" size={24}  />
            <div>
              <div className="text-sm font-medium text-neutral-900">Ver documentos de este inmueble</div>
              <div className="text-xs text-neutral-500">Abre la bandeja filtrada por este inmueble</div>
            </div>
          </button>

          <button
            onClick={copyEmailAlias}
            className="flex items-center w-full p-3 text-left border border-neutral-200"
          >
            <Clipboard className="h-5 w-5 text-brand-navy mr-3" size={24}  />
            <div>
              <div className="text-sm font-medium text-neutral-900">Copiar alias de email del inmueble</div>
              <div className="text-xs text-neutral-500">Copia la dirección de email para envío de documentos</div>
            </div>
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default PropertyDetail;
