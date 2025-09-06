import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Calculator, Calendar, User, Building, FileText } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, CAPEX, Property, CAPEXTipo, CAPEXEstado } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';

const CapexComponent: React.FC = () => {
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
    
    if (!formData.proveedor || formData.total <= 0 || formData.inmueble_id === 0 || !formData.fecha_emision) {
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
      
      // Create toast message following the requirement
      const propertyName = properties.find(p => p.id === formData.inmueble_id)?.alias || 'Sin especificar';
      const tipoName = formData.tipo.charAt(0).toUpperCase() + formData.tipo.slice(1);
      toast.success(`✓ Guardado en Tesorería > CAPEX: ${formatEuro(formData.total)} — ${tipoName} ${propertyName} (${formData.anos_amortizacion} años)`);
      
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving CAPEX:', error);
      toast.error('Error al guardar el CAPEX');
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
      case 'amortizando': return 'bg-purple-100 text-purple-800';
      case 'completo': return 'bg-primary-100 text-primary-800';
      case 'incompleto': return 'bg-warning-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'mejora': return 'bg-success-100 text-success-800';
      case 'ampliacion': return 'bg-primary-100 text-primary-800';
      case 'mobiliario': return 'bg-warning-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPropertyName = (inmueble_id: number) => {
    return properties.find(p => p.id === inmueble_id)?.alias || 'Sin especificar';
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

  const capexTipos: { value: CAPEXTipo; label: string }[] = [
    { value: 'mejora', label: 'Mejora' },
    { value: 'ampliacion', label: 'Ampliación' },
    { value: 'mobiliario', label: 'Mobiliario' }
  ];

  const capexEstados: { value: CAPEXEstado; label: string }[] = [
    { value: 'completo', label: 'Completo' },
    { value: 'incompleto', label: 'Incompleto' },
    { value: 'pagado', label: 'Pagado' },
    { value: 'amortizando', label: 'Amortizando' }
  ];

  if (loading) {
    return (
      <PageLayout title="CAPEX" subtitle="Gestión de inversiones en capital (reformas, mejoras, ampliaciones).">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="CAPEX" 
      subtitle="Reformas, mejoras, ampliaciones y mobiliario con amortización."
      primaryAction={
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo CAPEX
        </button>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Todos los estados</option>
              <option value="completo">Completo</option>
              <option value="pagado">Pagado</option>
              <option value="amortizando">Amortizando</option>
              <option value="incompleto">Incompleto</option>
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por proveedor, tipo o inmueble..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {filteredCapex.length} registros CAPEX encontrados
          </div>
        </div>

        {/* CAPEX Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inmueble</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Amortización</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCapex.map(capex => (
                <tr key={capex.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {new Date(capex.fecha_emision).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {getPropertyName(capex.inmueble_id)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {capex.proveedor}
                      </span>
                    </div>
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
                        <FileText className="w-3 h-3 text-gray-400 mx-auto" />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCapex.length === 0 && (
            <div className="text-center py-12">
              <Calculator className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay registros CAPEX</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza creando un nuevo registro de inversión en capital.
              </p>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {filteredCapex.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Total Invertido</h3>
                <Calculator className="w-5 h-5 text-gray-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {formatEuro(filteredCapex.reduce((sum, capex) => sum + capex.total, 0))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Amortización Anual</h3>
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {formatEuro(filteredCapex.reduce((sum, capex) => sum + calculateAmortizationPerYear(capex.total, capex.anos_amortizacion), 0))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Registros Activos</h3>
                <Building className="w-5 h-5 text-gray-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {filteredCapex.filter(capex => capex.estado === 'amortizando' || capex.estado === 'pagado').length}
              </div>
            </div>
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Nuevo CAPEX</h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Inmueble *
                    </label>
                    <select
                      value={formData.inmueble_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, inmueble_id: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
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
                      value={formData.proveedor}
                      onChange={(e) => setFormData(prev => ({ ...prev, proveedor: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Nombre del proveedor o contratista"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Emisión *
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_emision}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha_emision: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Importe Total *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.total}
                      onChange={(e) => setFormData(prev => ({ ...prev, total: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo *
                      </label>
                      <select
                        value={formData.tipo}
                        onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as CAPEXTipo }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      >
                        {capexTipos.map(tipo => (
                          <option key={tipo.value} value={tipo.value}>
                            {tipo.label}
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
                        min="1"
                        max="50"
                        value={formData.anos_amortizacion}
                        onChange={(e) => setFormData(prev => ({ ...prev, anos_amortizacion: parseInt(e.target.value) || 10 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado
                    </label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value as CAPEXEstado }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {capexEstados.map(estado => (
                        <option key={estado.value} value={estado.value}>
                          {estado.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preview Calculation */}
                  {formData.total > 0 && formData.anos_amortizacion > 0 && (
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-primary-900 mb-2">
                        Vista previa de amortización:
                      </div>
                      <div className="text-sm text-primary-700">
                        {formatEuro(calculateAmortizationPerYear(formData.total, formData.anos_amortizacion))} por año durante {formData.anos_amortizacion} años
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Guardar CAPEX
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default CapexComponent;