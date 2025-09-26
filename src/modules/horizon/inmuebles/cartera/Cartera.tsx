import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { Property, initDB } from '../../../../services/db';
import { formatEuro, formatDate, formatInteger } from '../../../../utils/formatUtils';
import toast from 'react-hot-toast';

const Cartera: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortField, setSortField] = useState<string>('purchaseDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadProperties();
    
    // Check for refresh parameter
    const refreshParam = searchParams.get('refresh');
    if (refreshParam === '1') {
      // Remove the refresh parameter from URL without reloading
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('refresh');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filterAndSortProperties = useCallback(() => {
    let filtered = [...properties];

    // Search filter (alias, address, cadastral reference)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(prop => 
        prop.alias.toLowerCase().includes(search) ||
        prop.address.toLowerCase().includes(search) ||
        (prop.cadastralReference && prop.cadastralReference.toLowerCase().includes(search))
      );
    }

    // State filter
    if (stateFilter) {
      filtered = filtered.filter(prop => prop.state === stateFilter);
    }

    // Date range filter
    if (dateFromFilter) {
      filtered = filtered.filter(prop => new Date(prop.purchaseDate) >= new Date(dateFromFilter));
    }
    if (dateToFilter) {
      filtered = filtered.filter(prop => new Date(prop.purchaseDate) <= new Date(dateToFilter));
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'purchaseDate':
          aValue = new Date(a.purchaseDate);
          bValue = new Date(b.purchaseDate);
          break;
        case 'squareMeters':
          aValue = a.squareMeters;
          bValue = b.squareMeters;
          break;
        case 'totalCost':
          aValue = calculateTotalCost(a);
          bValue = calculateTotalCost(b);
          break;
        case 'alias':
          aValue = a.alias.toLowerCase();
          bValue = b.alias.toLowerCase();
          break;
        default:
          aValue = a.alias.toLowerCase();
          bValue = b.alias.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredProperties(filtered);
  }, [properties, searchTerm, stateFilter, dateFromFilter, dateToFilter, sortField, sortDirection]);

  useEffect(() => {
    filterAndSortProperties();
  }, [filterAndSortProperties]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const allProperties = await db.getAll('properties');
      
      // Sort by creation date (newest first) to show new properties at the top
      const sortedProperties = allProperties.sort((a, b) => {
        const dateA = new Date(a.purchaseDate);
        const dateB = new Date(b.purchaseDate);
        return dateB.getTime() - dateA.getTime();
      });
      
      setProperties(sortedProperties);
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Error al cargar las propiedades');
    } finally {
      setLoading(false);
    }
  };

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

  const calculatePricePerSqm = (property: Property): number => {
    const totalCost = calculateTotalCost(property);
    return property.squareMeters > 0 ? totalCost / property.squareMeters : 0;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (property: Property) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${property.alias}"?`)) {
      return;
    }

    try {
      const db = await initDB();
      await db.delete('properties', property.id!);
      toast.success('Inmueble eliminado correctamente');
      loadProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error('Error al eliminar el inmueble');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <PageLayout 
        title="Cartera" 
        subtitle="Resumen de todas tus propiedades de inversión." 
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
      subtitle="Resumen de todas tus propiedades de inversión." 
      showInfoIcon={true}
    >
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex justify-between items-center">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-3 text-neutral-400" size={24}  />
              <input
                type="text"
                placeholder="Buscar por alias, dirección o ref. catastral..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent" />
            </div>
          </div>
          <button
            onClick={() => navigate('/inmuebles/cartera/nuevo')}
            className="flex items-center px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" size={24}  />
            Nuevo inmueble
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Estado
              </label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="vendido">Vendido</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Desde
              </label>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Ordenar por
              </label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="purchaseDate">Fecha compra</option>
                <option value="squareMeters">m²</option>
                <option value="totalCost">Coste total</option>
                <option value="alias">Alias</option>
              </select>
            </div>
          </div>

          {(searchTerm || stateFilter || dateFromFilter || dateToFilter) && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStateFilter('');
                  setDateFromFilter('');
                  setDateToFilter('');
                }}
                className="text-sm text-brand-navy hover:text-brand-navy/80"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="text-sm text-neutral-600">
          {filteredProperties.length} inmueble{filteredProperties.length !== 1 ? 's' : ''}
          {filteredProperties.length !== properties.length && ` de ${properties.length} total`}
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
                  {searchTerm || stateFilter || dateFromFilter || dateToFilter 
                    ? 'No se encontraron inmuebles' 
                    : 'No tienes inmuebles registrados'
                  }
                </h3>
                <p className="text-neutral-600 mt-1">
                  {searchTerm || stateFilter || dateFromFilter || dateToFilter
                    ? 'Intenta cambiar los filtros de búsqueda.'
                    : 'Comienza registrando tu primer inmueble de inversión.'}
                </p>
              </div>
              {!(searchTerm || stateFilter || dateFromFilter || dateToFilter) && (
                <button
                  onClick={() => navigate('/inmuebles/cartera/nuevo')}
                  className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" size={24}  />
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
          >
                      onClick={() => handleSort('alias')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Alias</span>
                        <span className="text-neutral-400">{getSortIcon('alias')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Dirección
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
          >
                      onClick={() => handleSort('purchaseDate')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Fecha compra</span>
                        <span className="text-neutral-400">{getSortIcon('purchaseDate')}</span>
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
          >
                      onClick={() => handleSort('squareMeters')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>m²</span>
                        <span className="text-neutral-400">{getSortIcon('squareMeters')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Habitaciones
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Baños
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
          >
                      onClick={() => handleSort('totalCost')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Coste adquisición total</span>
                        <span className="text-neutral-400">{getSortIcon('totalCost')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      €/m²
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      CAPEX (acumulado)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {filteredProperties.map((property) => {
                    const totalCost = calculateTotalCost(property);
                    const pricePerSqm = calculatePricePerSqm(property);
                    
                    return (
                      <tr key={property.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-neutral-900">{property.alias}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-900">{property.address}</div>
                          <div className="text-sm text-neutral-500">{property.municipality}, {property.province}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {formatDate(property.purchaseDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {formatInteger(property.squareMeters)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {formatInteger(property.bedrooms)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {formatInteger(property.bathrooms)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {formatEuro(totalCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {formatEuro(pricePerSqm)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                          —
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            property.state === 'activo' 
                              ? 'bg-success-100 text-success-800'
                              : property.state === 'vendido'
                              ? 'bg-primary-100 text-primary-800'
                              : 'bg-neutral-100 text-neutral-800'
                          }`}>
                            {property.state.charAt(0).toUpperCase() + property.state.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => navigate(`/inmuebles/cartera/${property.id}`)}
                              className="text-brand-navy hover:text-brand-navy/80"
            title="Ver"
          >
                              <Eye className="h-4 w-4" size={24}  />
                            </button>
                            <button
                              onClick={() => navigate(`/inmuebles/cartera/${property.id}/editar`)}
                              className="text-brand-navy hover:text-brand-navy/80"
            title="Editar"
          >
                              <Pencil className="h-4 w-4" size={24}  />
                            </button>
                            <button
                              onClick={() => handleDelete(property)}
                              className="text-error-600 hover:text-error-800"
            title="Borrar"
          >
                              <Trash2 className="h-4 w-4"  />
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
    </PageLayout>
  );
};

export default Cartera;