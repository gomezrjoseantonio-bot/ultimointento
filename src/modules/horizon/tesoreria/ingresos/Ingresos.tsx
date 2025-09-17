import React, { useState, useEffect } from 'react';
import { Search, X, DollarSign, Calendar, User } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
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

const Ingresos: React.FC = () => {
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
    
    if (!formData.proveedor_contraparte || formData.importe <= 0) {
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
      
      // Create toast message following the requirement
      const date = new Date(formData.fecha_prevista_cobro).toLocaleDateString('es-ES', { month: 'long' });
      toast.success(`✓ Guardado en Tesorería > Ingresos: ${formatEuro(formData.importe)} — ${formData.proveedor_contraparte} / ${date}`);
      
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
      case 'cobrado': return 'bg-success-100 text-success-800';
      case 'previsto': return 'bg-primary-100 text-primary-800';
      case 'incompleto': return 'bg-warning-100 text-orange-800';
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
      ingreso.contraparte.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPropertyName(ingreso.destino, ingreso.destino_id).toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <PageLayout title="Ingresos" subtitle="Gestión de ingresos previstos y cobrados.">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="Ingresos" 
      subtitle="Alquileres, nóminas y otros ingresos previstos y cobrados."
      primaryAction={{
        label: "Nuevo Ingreso",
        onClick: () => setShowForm(true)
      }}
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
              <option value="previsto">Previsto</option>
              <option value="cobrado">Cobrado</option>
              <option value="incompleto">Incompleto</option>
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por proveedor o inmueble..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {filteredIngresos.length} ingresos encontrados
          </div>
        </div>

        {/* Ingresos Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Cobro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor/Contraparte</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIngresos.map(ingreso => (
                <tr key={ingreso.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {new Date(ingreso.fecha_prevista_cobro).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {ingreso.contraparte}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getPropertyName(ingreso.destino, ingreso.destino_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-success-600">
                      {formatEuro(ingreso.importe)}
                    </span>
                    <div className="text-xs text-gray-500">{ingreso.moneda}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ingreso.estado)}`}>
                      {ingreso.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-xs text-gray-500">
                      {ingreso.origen.replace('_', ' ')}
                      {ingreso.from_doc && ' (doc)'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredIngresos.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ingresos</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza creando un nuevo ingreso previsto.
              </p>
            </div>
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-gray-200 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Nuevo Ingreso</h3>
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
                      Proveedor/Contraparte *
                    </label>
                    <input
                      type="text"
                      value={formData.proveedor_contraparte}
                      onChange={(e) => setFormData(prev => ({ ...prev, proveedor_contraparte: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                        Fecha Prevista Cobro *
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_prevista_cobro}
                        onChange={(e) => setFormData(prev => ({ ...prev, fecha_prevista_cobro: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
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
                        min="0"
                        value={formData.importe}
                        onChange={(e) => setFormData(prev => ({ ...prev, importe: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Moneda
                      </label>
                      <select
                        value={formData.moneda}
                        onChange={(e) => setFormData(prev => ({ ...prev, moneda: e.target.value as 'EUR' | 'USD' | 'GBP' }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destino *
                    </label>
                    <select
                      value={formData.destino}
                      onChange={(e) => setFormData(prev => ({ ...prev, destino: e.target.value as 'personal' | 'inmueble_id' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="personal">Personal</option>
                      <option value="inmueble_id">Inmueble</option>
                    </select>
                  </div>

                  {formData.destino === 'inmueble_id' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inmueble
                      </label>
                      <select
                        value={formData.destino_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, destino_id: parseInt(e.target.value) }))}
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
                      Guardar Ingreso
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

export default Ingresos;