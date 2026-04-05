import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  RotateCcw,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Users,
  TrendingDown,
  FileText,
  CircleDollarSign,
  MoreHorizontal,
  Wallet,
  Home,
  Shield,
  Filter,
  TriangleAlert
} from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { Property, Contract, FiscalSummary, initDB } from '../../../../services/db';
import { gastosInmuebleService } from '../../../../services/gastosInmuebleService';
import PropertySaleModal from '../components/PropertySaleModal';
import { formatEuro } from '../../../../utils/formatUtils';
import toast from 'react-hot-toast';
import { confirmAction, confirmDelete } from '../../../../services/confirmationService';
import { cancelPropertySale, getLatestConfirmedSaleForProperty } from '../../../../services/propertySaleService';
import type { ValoracionHistorica } from '../../../../types/valoraciones';
import { getCachedStoreRecords, invalidateCachedStores } from '../../../../services/indexedDbCacheService';

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

const isActiveContract = (c: Contract): boolean => c.estadoContrato === 'activo' || c.status === 'active';

const getCashflow = (property: Property, contracts: Contract[], fiscalSummaries: FiscalSummary[] = []): number => {
  const fromContracts = contracts
    .filter(c => (c.inmuebleId === property.id || c.propertyId === property.id) && isActiveContract(c))
    .reduce((sum, c) => sum + (c.rentaMensual || c.monthlyRent || 0), 0);
  if (fromContracts > 0) return fromContracts;
  // Fallback: usar box0102 del FiscalSummary más reciente
  if (!property.id) return 0;
  const propSummaries = fiscalSummaries
    .filter(fs => Number(fs.propertyId) === Number(property.id) && fs.box0102 && fs.box0102 > 0)
    .sort((a, b) => b.exerciseYear - a.exerciseYear);
  // DIAG: T48 debug — trazar fallback fiscal
  const allForProp = fiscalSummaries.filter(fs => fs.propertyId === property.id);
  if (allForProp.length > 0 || fromContracts === 0) {
    console.log(`[getCashflow] property=${property.id} (${property.alias}) contracts=${fromContracts} fsTotal=${allForProp.length} fsWithBox0102=${propSummaries.length}`, allForProp.map(fs => ({ id: fs.id, year: fs.exerciseYear, box0102: fs.box0102, propId: fs.propertyId, propIdType: typeof fs.propertyId })));
  }
  if (propSummaries.length > 0) {
    return Math.round((propSummaries[0].box0102! / 12) * 100) / 100;
  }
  return 0;
};

const getYield = (property: Property, contracts: Contract[], fiscalSummaries: FiscalSummary[] = []): number => {
  const totalCost = calculateTotalCost(property);
  if (totalCost <= 0) return 0;
  return (getCashflow(property, contracts, fiscalSummaries) * 12 / totalCost) * 100;
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
  const [fiscalSummaries, setFiscalSummaries] = useState<FiscalSummary[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('alias');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openMenuPropertyId, setOpenMenuPropertyId] = useState<number | null>(null);
  const actionMenuContainerRef = useRef<HTMLDivElement | null>(null);

  const [saleModalProperty, setSaleModalProperty] = useState<Property | null>(null);
  const [latestSaleByPropertyId, setLatestSaleByPropertyId] = useState<Record<number, number | null>>({});

  useEffect(() => {
    void loadData();

    const refreshParam = searchParams.get('refresh');
    if (refreshParam === '1') {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('refresh');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filterAndSortProperties = useCallback(() => {
    const filtered = [...properties]
      .filter((prop) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          prop.alias.toLowerCase().includes(search) ||
          prop.address.toLowerCase().includes(search) ||
          (prop.cadastralReference && prop.cadastralReference.toLowerCase().includes(search))
        );
      })
      .sort((a, b) => {
        let aValue: number | string = '';
        let bValue: number | string = '';
        switch (sortField) {
          case 'totalCost':
            aValue = calculateTotalCost(a);
            bValue = calculateTotalCost(b);
            break;
          case 'yield':
            aValue = getYield(a, contracts, fiscalSummaries);
            bValue = getYield(b, contracts, fiscalSummaries);
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
          case 'cashflow':
            aValue = getCashflow(a, contracts, fiscalSummaries);
            bValue = getCashflow(b, contracts, fiscalSummaries);
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
  }, [properties, contracts, valuations, fiscalSummaries, searchTerm, sortField, sortDirection]);

  useEffect(() => {
    filterAndSortProperties();
  }, [filterAndSortProperties]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allProperties, allValuations, allContracts, allGastos] = await Promise.all([
        getCachedStoreRecords<Property>('properties'),
        getCachedStoreRecords<ValoracionHistorica>('valoraciones_historicas'),
        getCachedStoreRecords<Contract>('contracts'),
        gastosInmuebleService.getAll(),
      ]);
      setProperties(allProperties);
      setValuations(allValuations);
      // Build FiscalSummary[] from gastosInmueble for display compatibility
      const summaryMap = new Map<string, FiscalSummary>();
      for (const g of allGastos) {
        const key = `${g.inmuebleId}-${g.ejercicio}`;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            propertyId: g.inmuebleId, exerciseYear: g.ejercicio,
            box0105: 0, box0106: 0, box0109: 0, box0112: 0, box0113: 0, box0114: 0, box0115: 0, box0117: 0,
            mejorasTotal: 0, deductibleExcess: 0, constructionValue: 0, annualDepreciation: 0,
            status: 'Vivo', createdAt: g.createdAt, updatedAt: g.updatedAt,
          });
        }
        const s = summaryMap.get(key)!;
        const boxKey = `box${g.casillaAEAT}` as keyof FiscalSummary;
        if (boxKey in s) (s as any)[boxKey] = ((s as any)[boxKey] || 0) + g.importe;
      }
      const allFiscalSummaries = Array.from(summaryMap.values());
      setFiscalSummaries(allFiscalSummaries);

      const latestSalesEntries = await Promise.all(
        allProperties
          .filter((property) => typeof property.id === 'number')
          .map(async (property) => {
            const latestSale = await getLatestConfirmedSaleForProperty(property.id!);
            return [property.id!, latestSale?.id ?? null] as const;
          })
      );
      setLatestSaleByPropertyId(Object.fromEntries(latestSalesEntries));

      setContracts(allContracts);
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Error al cargar las propiedades');
    } finally {
      setLoading(false);
    }
  };

  const totalPortfolioCost = filteredProperties.reduce((sum, p) => sum + calculateTotalCost(p), 0);
  const totalPortfolioValue = filteredProperties.reduce((sum, p) => sum + (getLatestValuation(p, valuations) ?? 0), 0);
  const totalLatentGain = totalPortfolioValue - totalPortfolioCost;
  const totalOccupancy = filteredProperties.length > 0
    ? (filteredProperties.filter(p => getCashflow(p, contracts, fiscalSummaries) > 0).length / filteredProperties.length) * 100
    : 0;
  const totalRent = filteredProperties.reduce((sum, p) => sum + getCashflow(p, contracts, fiscalSummaries), 0);

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
      invalidateCachedStores(['properties']);
      toast.success('Inmueble eliminado correctamente');
      void loadData();
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Error al eliminar el inmueble');
    }
  };

  const handleRowAction = (action: () => void) => {
    setOpenMenuPropertyId(null);
    action();
  };

  const handleRevertSale = async (property: Property) => {
    if (!property.id) return;
    const latestSaleId = latestSaleByPropertyId[property.id];

    if (!latestSaleId) {
      toast.error('No se encontró una venta confirmada para revertir');
      return;
    }

    const confirmed = await confirmAction('revertir la venta', `Se restaurará el inmueble "${property.alias}" y sus movimientos asociados.`);
    if (!confirmed) return;

    try {
      await cancelPropertySale(latestSaleId);
      toast.success('Venta revertida correctamente');
      void loadData();
    } catch (error) {
      console.error('Error reverting sale:', error);
      const message = error instanceof Error ? error.message : 'No se pudo revertir la venta';
      toast.error(message);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionMenuContainerRef.current && !actionMenuContainerRef.current.contains(target)) {
        setOpenMenuPropertyId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuPropertyId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

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
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="inline-flex p-2 rounded-lg bg-gray-100 text-gray-900 mb-3"><Wallet className="h-4 w-4" /></div>
            <p className="text-xs font-medium text-neutral-500">Plusvalía latente</p>
            <p className={`text-4xl font-semibold mt-1 ${totalLatentGain >= 0 ? 'text-[var(--s-pos)]' : 'text-[var(--s-neg)]'}`}>{formatEuro(totalLatentGain)}</p>
            <p className="text-sm text-neutral-500 mt-1">Sobre coste de adquisición</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="inline-flex p-2 rounded-lg bg-cyan-50 text-cyan-600 mb-3"><Home className="h-4 w-4" /></div>
            <p className="text-xs font-medium text-neutral-500">Ocupación</p>
            <p className="text-4xl font-semibold mt-1 text-brand-navy">{totalOccupancy.toFixed(1)}%</p>
            <p className="text-sm text-neutral-500 mt-1">
              {filteredProperties.filter(p => getCashflow(p, contracts, fiscalSummaries) > 0).length} de {filteredProperties.length} unidades alquiladas
            </p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="inline-flex p-2 rounded-lg bg-indigo-50 text-indigo-600 mb-3"><Shield className="h-4 w-4" /></div>
            <p className="text-xs font-medium text-neutral-500">Cobertura hipotecas</p>
            <p className="text-4xl font-semibold mt-1 text-brand-navy">N/D</p>
            <p className="text-sm text-neutral-500 mt-1">CF ingresos / CF financiación</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-700">Cartera detallada</h3>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 text-sm">
              <Filter className="h-4 w-4" /> Filtrar
            </button>
          </div>

          <div className="px-5 pt-4 flex justify-between items-center gap-4">
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

          <div className="px-5 pb-2 pt-2 text-xs text-neutral-500">
            {filteredProperties.length} inmueble{filteredProperties.length !== 1 ? 's' : ''}
            {filteredProperties.length !== properties.length && ` de ${properties.length}`}
          </div>

          {filteredProperties.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">No se encontraron inmuebles.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('alias')}><div className="flex items-center gap-1"><span>Propiedad</span>{getSortIcon('alias')}</div></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('totalCost')}><div className="flex items-center gap-1"><span>Coste</span>{getSortIcon('totalCost')}</div></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('currentValue')}><div className="flex items-center gap-1"><span>Valor actual</span>{getSortIcon('currentValue')}</div></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('revaluationTotal')}><div className="flex items-center gap-1"><span>Plusvalía</span>{getSortIcon('revaluationTotal')}</div></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('cashflow')}><div className="flex items-center gap-1"><span>Renta/mes</span>{getSortIcon('cashflow')}</div></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('yield')}><div className="flex items-center gap-1"><span>Yield bruto</span>{getSortIcon('yield')}</div></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {filteredProperties.map((property) => {
                    const propId = property.id ?? -1;
                    const totalCost = calculateTotalCost(property);
                    const currentValue = getLatestValuation(property, valuations);
                    const plusvalia = currentValue !== null ? currentValue - totalCost : null;
                    const yieldPct = getYield(property, contracts, fiscalSummaries);
                    const rent = getCashflow(property, contracts, fiscalSummaries);
                    const isRented = rent > 0;
                    const annualized = getAnnualizedRevaluationPct(property, valuations);

                    return (
                      <tr key={propId} className="hover:bg-neutral-50/80">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-brand-navy">{property.alias}</div>
                          <div className="text-sm text-neutral-500">{property.address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">{formatEuro(totalCost)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">{currentValue !== null ? formatEuro(currentValue) : <span className="text-neutral-400">—</span>}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {plusvalia !== null ? <span className={plusvalia >= 0 ? 'text-[var(--s-pos)] font-medium' : 'text-[var(--s-neg)] font-medium'}>{formatEuro(plusvalia)}</span> : <span className="text-neutral-400">—</span>}
                          {annualized !== null && <div className="text-xs text-neutral-500 mt-0.5">{annualized.toFixed(2)}% anual</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">{rent > 0 ? formatEuro(rent) : <span className="text-[var(--s-neg)]">0 €</span>}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {yieldPct > 0 ? <span className="font-semibold text-cyan-600">{yieldPct.toFixed(2)}%</span> : <span className="font-medium text-[var(--s-neg)]">0%</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {isRented ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium bg-[var(--s-pos-bg)] text-[var(--s-pos)]">Alquilado</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-700"><TriangleAlert className="h-3.5 w-3.5" />Vacío</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div ref={actionMenuContainerRef} className="relative flex items-center gap-1">
                            <button onClick={() => navigate(`/inmuebles/cartera/${propId}`)} className="p-1.5 text-neutral-500 hover:text-brand-navy hover:bg-neutral-100 rounded transition-colors" title="Ver detalle"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => navigate(`/inmuebles/gastos?propertyId=${propId}`)} className="p-1.5 text-neutral-500 hover:text-brand-navy hover:bg-neutral-100 rounded transition-colors" title="Ver gastos"><TrendingDown className="h-4 w-4" /></button>
                            {property.state === 'activo' && (
                              <button
                                onClick={() => setSaleModalProperty(property)}
                                className="p-1.5 text-neutral-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                title="Vender inmueble"
                              >
                                <CircleDollarSign className="h-4 w-4" />
                              </button>
                            )}
                            {property.state === 'vendido' && (
                              <button
                                onClick={() => void handleRevertSale(property)}
                                className="p-1.5 text-neutral-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                title="Revertir venta"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                            <button onClick={() => setOpenMenuPropertyId(openMenuPropertyId === propId ? null : propId)} className="p-1.5 text-neutral-500 hover:text-brand-navy hover:bg-neutral-100 rounded transition-colors" title="Más opciones"><MoreHorizontal className="h-4 w-4" /></button>
                            {openMenuPropertyId === propId && (
                              <div className="absolute right-0 top-9 z-20 w-48 rounded-md border bg-white shadow-lg py-1">
                                <button onClick={() => handleRowAction(() => navigate(`/inmuebles/cartera/${propId}/editar`))} className="w-full px-3 py-2 text-left text-sm text-[var(--n-700)] hover:bg-[var(--n-100)] inline-flex items-center gap-2"><Pencil className="h-4 w-4" /> Editar</button>
                                <button onClick={() => handleRowAction(() => navigate(`/inmuebles/contratos?propertyId=${propId}`))} className="w-full px-3 py-2 text-left text-sm text-[var(--n-700)] hover:bg-[var(--n-100)] inline-flex items-center gap-2"><Users className="h-4 w-4" /> Inquilinos</button>
                                <button onClick={() => handleRowAction(() => navigate(`/inmuebles/gastos?propertyId=${propId}`))} className="w-full px-3 py-2 text-left text-sm text-[var(--n-700)] hover:bg-[var(--n-100)] inline-flex items-center gap-2"><TrendingDown className="h-4 w-4" /> Gastos</button>
                                <button onClick={() => handleRowAction(() => navigate(`/inmuebles/cartera/${propId}?tab=fiscal`))} className="w-full px-3 py-2 text-left text-sm text-[var(--n-700)] hover:bg-[var(--n-100)] inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Fiscal</button>
                                {property.state === 'activo' && (
                                  <button onClick={() => handleRowAction(() => setSaleModalProperty(property))} className="w-full px-3 py-2 text-left text-sm text-[var(--n-700)] hover:bg-[var(--n-100)] inline-flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /> Vender inmueble</button>
                                )}
                                {property.state === 'vendido' && (
                                  <button onClick={() => handleRowAction(() => void handleRevertSale(property))} className="w-full px-3 py-2 text-left text-sm text-[var(--n-700)] hover:bg-[var(--n-100)] inline-flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /> Revertir venta</button>
                                )}
                                <div className="my-1 border-t border-[var(--n-200)]" />
                                <button onClick={() => handleRowAction(() => handleDelete(property))} className="w-full px-3 py-2 text-left text-sm text-[var(--s-neg)] hover:bg-[var(--s-neg-bg)] inline-flex items-center gap-2"><Trash2 className="h-4 w-4" /> Eliminar</button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-neutral-50 font-semibold text-brand-navy">
                    <td className="px-6 py-3">Total cartera</td>
                    <td className="px-6 py-3">{formatEuro(totalPortfolioCost)}</td>
                    <td className="px-6 py-3">{formatEuro(totalPortfolioValue)}</td>
                    <td className={`px-6 py-3 ${totalLatentGain >= 0 ? 'text-[var(--s-pos)]' : 'text-[var(--s-neg)]'}`}>{formatEuro(totalLatentGain)}</td>
                    <td className="px-6 py-3">{formatEuro(totalRent)}</td>
                    <td className="px-6 py-3">{totalPortfolioCost > 0 ? `${((totalRent * 12 / totalPortfolioCost) * 100).toFixed(2)}%` : '—'}</td>
                    <td className="px-6 py-3">{totalOccupancy.toFixed(1)}%</td>
                    <td className="px-6 py-3">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
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
