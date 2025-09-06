import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Calculator, Calendar, Building, FileText } from 'lucide-react';
import { initDB, CAPEX, Property, CAPEXTipo, CAPEXEstado } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';

const CAPEXPanel: React.FC = () => {
  const [capexRecords, setCapexRecords] = useState<CAPEX[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    inmueble_id: 0,
    proveedor: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    total: 0,
    tipo: 'mejora' as CAPEXTipo,
    anos_amortizacion: 10,
    estado: 'completo' as CAPEXEstado
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const [capexData, propertiesData] = await Promise.all([
        db.getAll('capex'),
        db.getAll('properties')
      ]);

      setCapexRecords(capexData);
      setProperties(propertiesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.proveedor || formData.total <= 0 || !formData.inmueble_id) {
      toast.error('Por favor, completa todos los campos requeridos');
      return;
    }

    try {
      const db = await initDB();
      const newCapex: CAPEX = {
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.add('capex', newCapex);
      
      const propertyName = properties.find(p => p.id === formData.inmueble_id)?.alias || 'Inmueble';
      toast.success(`✓ Guardado en Tesorería > CAPEX: ${formatEuro(formData.total)} — ${formData.proveedor} / ${propertyName}`);
      
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving CAPEX:', error);
      toast.error('Error al guardar la inversión');
    }
  };

  const resetForm = () => {
    setFormData({
      inmueble_id: 0,
      proveedor: '',
      fecha_emision: new Date().toISOString().split('T')[0],
      total: 0,
      tipo: 'mejora',
      anos_amortizacion: 10,
      estado: 'completo'
    });
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'pagado': return 'bg-success-100 text-success-800';
      case 'completo': return 'bg-primary-100 text-primary-800';
      case 'incompleto': return 'bg-warning-100 text-orange-800';
      case 'amortizando': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'mejora': return 'bg-primary-100 text-primary-800';
      case 'ampliacion': return 'bg-success-100 text-success-800';
      case 'mobiliario': return 'bg-warning-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPropertyName = (inmuebleId: number) => {
    return properties.find(p => p.id === inmuebleId)?.alias || 'Sin especificar';
  };

  const calculateAmortizationPerYear = (total: number, anos: number) => {
    return total / anos;
  };

  const filteredCapex = capexRecords.filter(capex => {
    const matchesStatus = statusFilter === 'all' || capex.estado === statusFilter;
    const matchesSearch = searchTerm === '' || 
      capex.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPropertyName(capex.inmueble_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      capex.tipo.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const capexTypes: { value: CAPEXTipo; label: string; defaultYears: number }[] = [
    { value: 'mejora', label: 'Mejora', defaultYears: 15 },
    { value: 'ampliacion', label: 'Ampliación', defaultYears: 15 },
    { value: 'mobiliario', label: 'Mobiliario', defaultYears: 10 },
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 rounded-lg"></div>
        <div className="h-64 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Inversión
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Todos los estados</option>
              <option value="completo">Completo</option>
              <option value="incompleto">Incompleto</option>
              <option value="pagado">Pagado</option>
              <option value="amortizando">Amortizando</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por proveedor, inmueble o tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Total Invertido</h3>
            <Calculator className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatEuro(filteredCapex.reduce((sum, capex) => sum + capex.total, 0))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Amortización Anual</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatEuro(filteredCapex.reduce((sum, capex) => sum + calculateAmortizationPerYear(capex.total, capex.anos_amortizacion), 0))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Proyectos</h3>
            <Building className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-primary-600">
            {filteredCapex.length}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Amortizando</h3>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600">
            {filteredCapex.filter(c => c.estado === 'amortizando').length}
          </div>
        </div>
      </div>

      {/* CAPEX Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inmueble
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amortización
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCapex.map((capex) => (
                <tr key={capex.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building className="w-4 h-4 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">
                        {getPropertyName(capex.inmueble_id)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {capex.proveedor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTipoColor(capex.tipo)}`}>
                      {capex.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-error-600">
                      {formatEuro(capex.total)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-900">
                      {capex.anos_amortizacion} años
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatEuro(calculateAmortizationPerYear(capex.total, capex.anos_amortizacion))}/año
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(capex.estado)}`}>
                      {capex.estado}
                    </span>
                    {capex.source_doc_id && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-1 text-xs bg-success-100 text-success-800 rounded-full">
                          <FileText className="w-3 h-3 mr-1" />
                          OCR
                        </span>
                      </div>
                    )}
                    {capex.movement_id && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded-full">
                          Conciliado
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredCapex.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">No se encontraron inversiones CAPEX</div>
            <div className="text-sm text-gray-500">
              {capexRecords.length === 0 
                ? 'Añade inversiones para gestionar la amortización'
                : 'Intenta ajustar los filtros'
              }
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Nueva Inversión CAPEX</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inmueble *
                  </label>
                  <select
                    required
                    value={formData.inmueble_id}
                    onChange={(e) => setFormData({...formData, inmueble_id: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={0}>Seleccionar inmueble</option>
                    {properties.map(property => (
                      <option key={property.id} value={property.id}>
                        {property.alias}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proveedor *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.proveedor}
                    onChange={(e) => setFormData({...formData, proveedor: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Emisión *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_emision}
                    onChange={(e) => setFormData({...formData, fecha_emision: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.total}
                    onChange={(e) => setFormData({...formData, total: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo *
                  </label>
                  <select
                    required
                    value={formData.tipo}
                    onChange={(e) => {
                      const selectedType = capexTypes.find(t => t.value === e.target.value);
                      setFormData({
                        ...formData, 
                        tipo: e.target.value as CAPEXTipo,
                        anos_amortizacion: selectedType?.defaultYears || 10
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {capexTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Años Amortización *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={formData.anos_amortizacion}
                    onChange={(e) => setFormData({...formData, anos_amortizacion: parseInt(e.target.value) || 10})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Guardar Inversión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CAPEXPanel;