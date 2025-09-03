import React, { useState, useEffect } from 'react';
import { Plus, Search, X, DollarSign, Calendar, User, FileText } from 'lucide-react';
import { initDB, Ingreso, Property, IngresoOrigen, IngresoDestino, IngresoEstado } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';

interface IngresoFormData {
  origen: IngresoOrigen;
  origen_id: number;
  proveedor_contraparte: string;
  fecha_emision: string;
  fecha_prevista_cobro: string;
  importe: number;
  moneda: 'EUR' | 'USD' | 'GBP';
  destino: IngresoDestino;
  destino_id: number;
  estado: IngresoEstado;
  from_doc: boolean;
}

const IngresosPanel: React.FC = () => {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<IngresoFormData>({
    origen: 'contrato_id',
    origen_id: 0,
    proveedor_contraparte: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_prevista_cobro: new Date().toISOString().split('T')[0],
    importe: 0,
    moneda: 'EUR',
    destino: 'inmueble_id',
    destino_id: 0,
    estado: 'previsto',
    from_doc: false
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const [ingresosData, propertiesData] = await Promise.all([
        db.getAll('ingresos'),
        db.getAll('properties')
      ]);

      setIngresos(ingresosData);
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
    
    if (!formData.proveedor_contraparte || formData.importe <= 0 || !formData.fecha_emision) {
      toast.error('Por favor, completa todos los campos requeridos');
      return;
    }

    try {
      const db = await initDB();
      const newIngreso: Ingreso = {
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.add('ingresos', newIngreso);
      
      const destinoName = formData.destino === 'personal' ? 'Personal' : 
        properties.find(p => p.id === formData.destino_id)?.alias || 'Inmueble';
      toast.success(`✓ Guardado en Tesorería > Ingresos: ${formatEuro(formData.importe)} — ${formData.proveedor_contraparte} / ${destinoName}`);
      
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving ingreso:', error);
      toast.error('Error al guardar el ingreso');
    }
  };

  const resetForm = () => {
    setFormData({
      origen: 'contrato_id',
      origen_id: 0,
      proveedor_contraparte: '',
      fecha_emision: new Date().toISOString().split('T')[0],
      fecha_prevista_cobro: new Date().toISOString().split('T')[0],
      importe: 0,
      moneda: 'EUR',
      destino: 'inmueble_id',
      destino_id: 0,
      estado: 'previsto',
      from_doc: false
    });
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'cobrado': return 'bg-green-100 text-green-800';
      case 'previsto': return 'bg-blue-100 text-blue-800';
      case 'incompleto': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrigenColor = (origen: string) => {
    switch (origen) {
      case 'contrato_id': return 'bg-blue-100 text-blue-800';
      case 'nomina_id': return 'bg-green-100 text-green-800';
      case 'doc_id': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPropertyName = (destino: string, destino_id?: number) => {
    if (destino === 'personal') return 'Personal';
    return properties.find(p => p.id === destino_id)?.alias || 'Sin especificar';
  };

  const filteredIngresos = ingresos.filter(ingreso => {
    const matchesStatus = statusFilter === 'all' || ingreso.estado === statusFilter;
    const matchesSearch = searchTerm === '' || 
      ingreso.proveedor_contraparte.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPropertyName(ingreso.destino, ingreso.destino_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      ingreso.origen.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const origenTypes: { value: IngresoOrigen; label: string }[] = [
    { value: 'contrato_id', label: 'Contrato de alquiler' },
    { value: 'nomina_id', label: 'Nómina' },
    { value: 'doc_id', label: 'Documento/Factura' },
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
            Nuevo Ingreso
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
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="previsto">Previsto</option>
              <option value="cobrado">Cobrado</option>
              <option value="incompleto">Incompleto</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por contraparte, inmueble o origen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Total Ingresos</h3>
            <DollarSign className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatEuro(filteredIngresos.reduce((sum, ingreso) => sum + ingreso.importe, 0))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Previstos</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">
            {filteredIngresos.filter(i => i.estado === 'previsto').length}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Cobrados</h3>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-green-600">
            {filteredIngresos.filter(i => i.estado === 'cobrado').length}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Incompletos</h3>
            <User className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-600">
            {filteredIngresos.filter(i => i.estado === 'incompleto').length}
          </div>
        </div>
      </div>

      {/* Ingresos Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contraparte
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destino
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Prevista
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIngresos.map((ingreso) => (
                <tr key={ingreso.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{ingreso.proveedor_contraparte}</div>
                    <div className="text-sm text-gray-500">
                      Emisión: {new Date(ingreso.fecha_emision).toLocaleDateString('es-ES')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getOrigenColor(ingreso.origen)}`}>
                      {ingreso.origen === 'contrato_id' ? 'Contrato' :
                       ingreso.origen === 'nomina_id' ? 'Nómina' : 'Documento'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getPropertyName(ingreso.destino, ingreso.destino_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-green-600">
                      {formatEuro(ingreso.importe)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {ingreso.moneda}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {new Date(ingreso.fecha_prevista_cobro).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ingreso.estado)}`}>
                      {ingreso.estado}
                    </span>
                    {ingreso.movement_id && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Conciliado
                        </span>
                      </div>
                    )}
                    {ingreso.from_doc && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                          <FileText className="w-3 h-3 mr-1" />
                          OCR
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredIngresos.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">No se encontraron ingresos</div>
            <div className="text-sm text-gray-500">
              {ingresos.length === 0 
                ? 'Añade ingresos para gestionar tu cartera'
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
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Ingreso</h3>
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
                    Contraparte *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.proveedor_contraparte}
                    onChange={(e) => setFormData({...formData, proveedor_contraparte: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Origen *
                  </label>
                  <select
                    required
                    value={formData.origen}
                    onChange={(e) => setFormData({...formData, origen: e.target.value as IngresoOrigen})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {origenTypes.map(origen => (
                      <option key={origen.value} value={origen.value}>
                        {origen.label}
                      </option>
                    ))}
                  </select>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Prevista Cobro *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_prevista_cobro}
                    onChange={(e) => setFormData({...formData, fecha_prevista_cobro: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Importe *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.importe}
                    onChange={(e) => setFormData({...formData, importe: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moneda *
                  </label>
                  <select
                    required
                    value={formData.moneda}
                    onChange={(e) => setFormData({...formData, moneda: e.target.value as 'EUR' | 'USD' | 'GBP'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destino *
                  </label>
                  <select
                    required
                    value={formData.destino}
                    onChange={(e) => setFormData({...formData, destino: e.target.value as IngresoDestino})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="personal">Personal</option>
                    <option value="inmueble_id">Inmueble</option>
                  </select>
                </div>

                {formData.destino === 'inmueble_id' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Inmueble *
                    </label>
                    <select
                      required
                      value={formData.destino_id}
                      onChange={(e) => setFormData({...formData, destino_id: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>Seleccionar inmueble</option>
                      {properties.map(property => (
                        <option key={property.id} value={property.id}>
                          {property.alias}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                  Guardar Ingreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IngresosPanel;