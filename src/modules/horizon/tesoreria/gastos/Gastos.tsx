import React, { useState, useEffect } from 'react';
import { Search, X, CreditCard, Calendar, User, FileText } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, Gasto, Property, AEATFiscalType, GastoEstado, GastoDestino } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';

interface GastoFormData {
  proveedor_nombre: string;
  proveedor_nif: string;
  fecha_emision: string;
  fecha_pago_prevista: string;
  total: number;
  base: number;
  iva: number;
  categoria_AEAT: AEATFiscalType;
  destino: GastoDestino;
  destino_id: number;
  estado: GastoEstado;
}

const Gastos: React.FC = () => {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<GastoFormData>({
    proveedor_nombre: '',
    proveedor_nif: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_pago_prevista: new Date().toISOString().split('T')[0],
    total: 0,
    base: 0,
    iva: 0,
    categoria_AEAT: 'suministros',
    destino: 'inmueble_id',
    destino_id: 0,
    estado: 'completo'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const [gastosData, propertiesData] = await Promise.all([
        db.getAll('gastos'),
        db.getAll('properties')
      ]);

      setGastos(gastosData);
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
    
    if (!formData.proveedor_nombre || formData.total <= 0 || !formData.fecha_emision) {
      toast.error('Por favor, completa todos los campos requeridos');
      return;
    }

    try {
      const db = await initDB();
      const newGasto: Gasto = {
        contraparte_nombre: formData.proveedor_nombre, // Map proveedor_nombre to contraparte_nombre
        contraparte_nif: formData.proveedor_nif, // Map proveedor_nif to contraparte_nif
        fecha_emision: formData.fecha_emision,
        fecha_pago_prevista: formData.fecha_pago_prevista,
        total: formData.total,
        base: formData.base,
        iva: formData.iva,
        categoria_AEAT: formData.categoria_AEAT,
        destino: formData.destino,
        destino_id: formData.destino_id,
        estado: formData.estado,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.add('gastos', newGasto);
      
      // Create toast message following the requirement
      const categoryName = formData.categoria_AEAT.charAt(0).toUpperCase() + formData.categoria_AEAT.slice(1);
      toast.success(`✓ Guardado en Tesorería > Gastos: ${formatEuro(formData.total)} — ${formData.proveedor_nombre} / ${categoryName}`);
      
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving gasto:', error);
      toast.error('Error al guardar el gasto');
    }
  };

  const resetForm = () => {
    setFormData({
      proveedor_nombre: '',
      proveedor_nif: '',
      fecha_emision: new Date().toISOString().split('T')[0],
      fecha_pago_prevista: new Date().toISOString().split('T')[0],
      total: 0,
      base: 0,
      iva: 0,
      categoria_AEAT: 'suministros',
      destino: 'inmueble_id',
      destino_id: 0,
      estado: 'completo'
    });
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'pagado': return 'bg-success-100 text-success-800';
      case 'completo': return 'bg-primary-100 text-primary-800';
      case 'incompleto': return 'bg-warning-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case 'suministros': return 'bg-warning-100 text-yellow-800';
      case 'comunidad': return 'bg-info-100 text-info-800';
      case 'seguros': return 'bg-primary-100 text-primary-800';
      case 'tributos-locales': return 'bg-error-100 text-error-800';
      case 'servicios-personales': return 'bg-primary-100 text-primary-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPropertyName = (destino: string, destino_id?: number) => {
    if (destino === 'personal') return 'Personal';
    return properties.find(p => p.id === destino_id)?.alias || 'Sin especificar';
  };

  const filteredGastos = gastos.filter(gasto => {
    const matchesStatus = statusFilter === 'all' || gasto.estado === statusFilter;
    const matchesSearch = searchTerm === '' || 
      gasto.contraparte_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPropertyName(gasto.destino, gasto.destino_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      gasto.categoria_AEAT.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const aeatCategories: { value: AEATFiscalType; label: string }[] = [
    { value: 'suministros', label: 'Suministros' },
    { value: 'comunidad', label: 'Comunidad' },
    { value: 'seguros', label: 'Seguros' },
    { value: 'tributos-locales', label: 'Tributos Locales (IBI)' },
    { value: 'servicios-personales', label: 'Servicios Personales' },
    { value: 'amortizacion-muebles', label: 'Amortización Muebles' }
  ];

  if (loading) {
    return (
      <PageLayout title="Gastos" subtitle="Gestión de gastos deducibles y no deducibles.">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="Gastos" 
      subtitle="Suministros, comunidad, seguros y otros gastos deducibles."
      primaryAction={{
        label: "Nuevo Gasto",
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
              <option value="completo">Completo</option>
              <option value="pagado">Pagado</option>
              <option value="incompleto">Incompleto</option>
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por proveedor, categoría o inmueble..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {filteredGastos.length} gastos encontrados
          </div>
        </div>

        {/* Gastos Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Pago</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGastos.map(gasto => (
                <tr key={gasto.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {new Date(gasto.fecha_pago_prevista).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {gasto.contraparte_nombre}
                        </div>
                        {gasto.contraparte_nif && (
                          <div className="text-xs text-gray-500">
                            {gasto.contraparte_nif}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(gasto.categoria_AEAT)}`}>
                      {gasto.categoria_AEAT.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getPropertyName(gasto.destino, gasto.destino_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-error-600">
                      {formatEuro(gasto.total)}
                    </div>
                    {gasto.base && gasto.iva && (
                      <div className="text-xs text-gray-500">
                        Base: {formatEuro(gasto.base)} + IVA: {formatEuro(gasto.iva)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(gasto.estado)}`}>
                      {gasto.estado}
                    </span>
                    {gasto.source_doc_id && (
                      <div className="mt-1">
                        <FileText className="w-3 h-3 text-gray-400 mx-auto" />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredGastos.length === 0 && (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay gastos</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza creando un nuevo gasto.
              </p>
            </div>
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-gray-200 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Nuevo Gasto</h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Proveedor *
                      </label>
                      <input
                        type="text"
                        value={formData.proveedor_nombre}
                        onChange={(e) => setFormData(prev => ({ ...prev, proveedor_nombre: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        NIF/CIF
                      </label>
                      <input
                        type="text"
                        value={formData.proveedor_nif}
                        onChange={(e) => setFormData(prev => ({ ...prev, proveedor_nif: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="12345678A"
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
                        value={formData.fecha_emision}
                        onChange={(e) => setFormData(prev => ({ ...prev, fecha_emision: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha Pago Prevista *
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_pago_prevista}
                        onChange={(e) => setFormData(prev => ({ ...prev, fecha_pago_prevista: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.total}
                        onChange={(e) => setFormData(prev => ({ ...prev, total: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Base
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.base}
                        onChange={(e) => setFormData(prev => ({ ...prev, base: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IVA
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.iva}
                        onChange={(e) => setFormData(prev => ({ ...prev, iva: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría AEAT *
                    </label>
                    <select
                      value={formData.categoria_AEAT}
                      onChange={(e) => setFormData(prev => ({ ...prev, categoria_AEAT: e.target.value as AEATFiscalType }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      {aeatCategories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
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
                      Guardar Gasto
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

export default Gastos;