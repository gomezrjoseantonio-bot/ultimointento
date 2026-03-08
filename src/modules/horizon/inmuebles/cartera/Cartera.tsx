import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Users, TrendingDown, FileText, CircleDollarSign } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { Property, Contract, initDB } from '../../../../services/db';
import PropertySaleModal from '../components/PropertySaleModal';
import { formatEuro } from '../../../../utils/formatUtils';
import { getAllContracts } from '../../../../services/contractService';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../../services/confirmationService';
import type { ValoracionHistorica } from '../../../../types/valoraciones';

const calculateTotalCost = (property: Property): number => {
  const costs = property.acquisitionCosts;
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

const isActiveContract = (c: Contract): boolean =>
  c.estadoContrato === 'activo' || c.status === 'active';

const getCashflow = (property: Property, contracts: Contract[]): number => {
  return contracts
    .filter(c => (c.inmuebleId === property.id || c.propertyId === property.id) && isActiveContract(c))
    .reduce((sum, c) => sum + (c.rentaMensual || c.monthlyRent || 0), 0);
};

const getYield = (property: Property, contracts: Contract[]): number => {
  const totalCost = calculateTotalCost(property);
  if (totalCost <= 0) return 0;
  return (getCashflow(property, contracts) * 12 / totalCost) * 100;
};

const getLatestValuation = (property: Property, valuations: ValoracionHistorica[]): number | null => {
  if (!property.id) return null;
  const latest = valuations
    .filter(v => v.tipo_activo === 'inmueble' && v.activo_id === property.id)
    .sort((a, b) => b.fecha_valoracion.localeCompare(a.fecha_valoracion))[0];
  return latest?.valor ?? null;
};

const getTotalRevaluationPct = (property: Property, valuations: ValoracionHistorica[]): number | null => {
  const totalCost = calculateTotalCost(property);
  const currentValue = getLatestValuation(property, valuations);
  if (!currentValue || totalCost <= 0) return null;
  return ((currentValue - totalCost) / totalCost) * 100;
};

const getAnnualizedRevaluationPct = (property: Property, valuations: ValoracionHistorica[]): number | null => {
  const totalCost = calculateTotalCost(property);
  const currentValue = getLatestValuation(property, valuations);
  if (!currentValue || totalCost <= 0 || !property.purchaseDate) return null;

  const purchaseDate = new Date(property.purchaseDate);
  const now = new Date();
  const years = Math.max(1 / 365, (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365));

  return (Math.pow(currentValue / totalCost, 1 / years) - 1) * 100;
};

const Cartera: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [valuations, setValuations] = useState<ValoracionHistorica[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('alias');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [saleModalProperty, setSaleModalProperty] = useState<Property | null>(null);

  useEffect(() => {
    loadData();

    const refreshParam = searchParams.get('refresh');
    if (refreshParam === '1') {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('refresh');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filterAndSortProperties = useCallback(() => {
    let filtered = [...properties];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(prop =>
        prop.alias.toLowerCase().includes(search) ||
        prop.address.toLowerCase().includes(search) ||
        (prop.cadastralReference && prop.cadastralReference.toLowerCase().includes(search))
      );
    }

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortField) {
        case 'totalCost':
          aValue = calculateTotalCost(a);
          bValue = calculateTotalCost(b);
          break;
        case 'yield':
          aValue = getYield(a, contracts);
          bValue = getYield(b, contracts);
          break;
        case 'currentValue':
          aValue = getLatestValuation(a, valuations) ?? -Infinity;
          bValue = getLatestValuation(b, valuations) ?? -Infinity;
          break;
        case 'revaluationTotal':
          aValue = getTotalRevaluationPct(a, valuations) ?? -Infinity;
          bValue = getTotalRevaluationPct(b, valuations) ?? -Infinity;
          break;
        case 'revaluationAnnualized':
          aValue = getAnnualizedRevaluationPct(a, valuations) ?? -Infinity;
          bValue = getAnnualizedRevaluationPct(b, valuations) ?? -Infinity;
          break;
        case 'alias':
        default:
          aValue = a.alias.toLowerCase();
          bValue = b.alias.toLowerCase();
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredProperties(filtered);
  }, [properties, contracts, valuations, searchTerm, sortField, sortDirection]);

  useEffect(() => {
    filterAndSortProperties();
  }, [filterAndSortProperties]);

  const loadData = async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const allProperties = await db.getAll('properties');
      setProperties(allProperties);
      const allValuations = await db.getAll('valoraciones_historicas');
      setValuations(allValuations as ValoracionHistorica[]);
      try {
        const allContracts = await getAllContracts();
        setContracts(allContracts);
      } catch {
        setContracts([]);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Error al cargar las propiedades');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-neutral-400" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 text-brand-navy" />
      : <ArrowDown className="h-3 w-3 text-brand-navy" />;
  };

  const handleDelete = async (property: Property) => {
    const confirmed = await confirmDelete(`"${property.alias}"`);
    if (!confirmed) return;
    try {
      const db = await initDB();
      await db.delete('properties', property.id!);
      toast.success('Inmueble eliminado correctamente');
      loadData();
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Error al eliminar el inmueble');
    }
  };

  if (loading) {
    return (
      <PageLayout
        title="Cartera"
        subtitle="Dashboard financiero de tus propiedades de inversión."
        showInfoIcon={true}
      >
        <div className="flex items-center justify-center min-h-96">
          <div className="text-neutral-600">Cargando propiedades...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Cartera"
      subtitle="Dashboard financiero de tus propiedades de inversión."
      showInfoIcon={true}
    >
      <div className="space-y-4">
        {/* Header with search + new button */}
        <div className="flex justify-between items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por alias o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            />
          </div>
          <button
            onClick={() => navigate('/inmuebles/cartera/nuevo')}
            className="flex items-center px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors text-sm font-medium shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo inmueble
          </button>
        </div>

        {/* Results count */}
        <div className="text-xs text-neutral-500">
          {filteredProperties.length} inmueble{filteredProperties.length !== 1 ? 's' : ''}
          {filteredProperties.length !== properties.length && ` de ${properties.length}`}
        </div>

        {/* Table or empty state */}
        {filteredProperties.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
            <div className="space-y-4">
              <div className="text-neutral-400">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-6 0H3m0 0V9a2 2 0 012-2h4l2 2h4a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-neutral-900">
                  {searchTerm ? 'No se encontraron inmuebles' : 'No tienes inmuebles registrados'}
                </h3>
                <p className="text-neutral-600 mt-1">
                  {searchTerm
                    ? 'Intenta cambiar los términos de búsqueda.'
                    : 'Comienza registrando tu primer inmueble de inversión.'}
                </p>
              </div>
              {!searchTerm && (
                <button
                  onClick={() => navigate('/inmuebles/cartera/nuevo')}
                  className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo inmueble
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                      onClick={() => handleSort('alias')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Dirección / Alias</span>
                        {getSortIcon('alias')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                      onClick={() => handleSort('totalCost')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Coste inversión</span>
                        {getSortIcon('totalCost')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                      onClick={() => handleSort('currentValue')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Valor actual</span>
                        {getSortIcon('currentValue')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                      onClick={() => handleSort('revaluationTotal')}
                    >
                      <div className="flex items-center gap-1">
                        <span>% reval. total</span>
                        {getSortIcon('revaluationTotal')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                      onClick={() => handleSort('revaluationAnnualized')}
                    >
                      <div className="flex items-center gap-1">
                        <span>% reval. media anual</span>
                        {getSortIcon('revaluationAnnualized')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                      onClick={() => handleSort('yield')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Yield (%)</span>
                        {getSortIcon('yield')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {filteredProperties.map((property) => {
                    const totalCost = calculateTotalCost(property);
                    const yieldPct = getYield(property, contracts);
                    const currentValue = getLatestValuation(property, valuations);
                    const revaluationTotal = getTotalRevaluationPct(property, valuations);
                    const revaluationAnnualized = getAnnualizedRevaluationPct(property, valuations);

                    return (
                      <tr key={property.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-neutral-900">{property.alias}</div>
                          <div className="text-xs text-neutral-500">{property.address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {formatEuro(totalCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {currentValue ? formatEuro(currentValue) : <span className="text-neutral-400">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {revaluationTotal !== null
                            ? <span className={revaluationTotal >= 0 ? 'text-teal-600 font-medium' : 'text-red-600 font-medium'}>{revaluationTotal.toFixed(2)}%</span>
                            : <span className="text-neutral-400">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {revaluationAnnualized !== null
                            ? <span className={revaluationAnnualized >= 0 ? 'text-teal-600 font-medium' : 'text-red-600 font-medium'}>{revaluationAnnualized.toFixed(2)}%</span>
                            : <span className="text-neutral-400">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {yieldPct > 0
                            ? <span className="text-teal-600 font-medium">{yieldPct.toFixed(2)}%</span>
                            : <span className="text-neutral-400">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => navigate(`/inmuebles/cartera/${property.id}`)}
                              className="p-1.5 text-neutral-500 hover:text-brand-navy hover:bg-neutral-100 rounded transition-colors"
                              title="Ver"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/inmuebles/cartera/${property.id}/editar`)}
                              className="p-1.5 text-neutral-500 hover:text-brand-navy hover:bg-neutral-100 rounded transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {property.state === 'activo' && (
                              <button
                                onClick={() => setSaleModalProperty(property)}
                                className="p-1.5 text-neutral-500 hover:text-error-600 hover:bg-neutral-100 rounded transition-colors"
                                title="Vender inmueble"
                              >
                                <CircleDollarSign className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(property)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/inmuebles/contratos?propertyId=${property.id}`)}
                              className="p-1.5 text-neutral-500 hover:text-brand-navy hover:bg-neutral-100 rounded transition-colors"
                              title="Alquileres"
                            >
                              <Users className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/inmuebles/gastos?propertyId=${property.id}`)}
                              className="p-1.5 text-neutral-500 hover:text-brand-navy hover:bg-neutral-100 rounded transition-colors"
                              title="Gastos"
                            >
                              <TrendingDown className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/inmuebles/cartera/${property.id}?tab=fiscal`)}
                              className="p-1.5 text-neutral-500 hover:text-brand-navy hover:bg-neutral-100 rounded transition-colors"
                              title="Fiscal"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <PropertySaleModal
        open={Boolean(saleModalProperty)}
        property={saleModalProperty}
        source="cartera"
        onClose={() => setSaleModalProperty(null)}
        onConfirmed={() => {
          void loadData();
        }}
      />
    </PageLayout>
  );
};

export default Cartera;
