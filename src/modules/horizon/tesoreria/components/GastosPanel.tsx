import React, { useState, useEffect } from 'react';
import { Plus, Search, X, CreditCard, Calendar, User, FileText } from 'lucide-react';
import { initDB, Gasto, Property, AEATFiscalType, GastoEstado, GastoDestino } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';
import { confirmAction } from '../../../../services/confirmationService';

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

const GastosPanel: React.FC = () => {
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

    // Business logic validation: Personal expenses cannot be assigned to properties
    if (formData.destino === 'personal' && formData.destino_id !== 0) {
      toast.error('Los gastos personales no pueden asignarse a un inmueble específico');
      return;
    }

    // Business logic validation: Property expenses must have a valid property selected
    if (formData.destino === 'inmueble_id' && formData.destino_id === 0) {
      toast.error('Debes seleccionar un inmueble para gastos asociados a propiedades');
      return;
    }

    // Business logic validation: Some categories should typically be property-related
    if (formData.categoria_AEAT === 'suministros' && formData.destino === 'personal') {
      const shouldProceed = await confirmAction(
        'registrar este gasto como personal',
        'Los suministros suelen estar asociados a inmuebles.'
      );
      if (!shouldProceed) return;
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
      const destinoName = formData.destino === 'personal' ? 'Personal' : 
                         properties.find(p => p.id === formData.destino_id)?.alias || 'Inmueble';
      toast.success(`✓ Guardado en Tesorería > Gastos: ${formatEuro(formData.total)} — ${formData.proveedor_nombre} / ${categoryName} / ${destinoName}`);
      
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

  // Helper function to handle destino changes
  const handleDestinoChange = (newDestino: GastoDestino) => {
    setFormData(prev => ({
      ...prev,
      destino: newDestino,
      destino_id: newDestino === 'personal' ? 0 : prev.destino_id // Clear property selection for personal
    }));
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
    { value: 'comunidad', label: 'Gastos de comunidad' },
    { value: 'seguros', label: 'Seguros' },
    { value: 'tributos-locales', label: 'Tributos locales' },
    { value: 'servicios-personales', label: 'Servicios personales' },
    { value: 'reparacion-conservacion', label: 'Reparación y conservación' },
    { value: 'financiacion', label: 'Financiación' },
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200"></div>
        <div className="h-64 bg-gray-200"></div>
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
            className="flex items-center gap-2 px-4 py-2 bg-gray-600"
          >
            <Plus className="w-4 h-4" />
            Nuevo Gasto
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
              className="w-48 px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Todos los estados</option>
              <option value="completo">Completo</option>
              <option value="incompleto">Incompleto</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por proveedor, inmueble o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Total Gastos</h3>
            <CreditCard className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatEuro(filteredGastos.reduce((sum, gasto) => sum + gasto.total, 0))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Completos</h3>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-primary-600">
            {filteredGastos.filter(g => g.estado === 'completo').length}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Pagados</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-success-600">
            {filteredGastos.filter(g => g.estado === 'pagado').length}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Incompletos</h3>
            <User className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-warning-600">
            {filteredGastos.filter(g => g.estado === 'incompleto').length}
          </div>
        </div>
      </div>

      {/* Gastos Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contraparte
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría AEAT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inmueble/Personal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Emisión
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGastos.map((gasto) => (
                <tr key={gasto.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{gasto.contraparte_nombre}</div>
                    {gasto.contraparte_nif && (
                      <div className="text-sm text-gray-500">{gasto.contraparte_nif}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold ${getCategoryColor(gasto.categoria_AEAT)}`}>
                      {gasto.categoria_AEAT}
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
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {new Date(gasto.fecha_emision).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold ${getStatusColor(gasto.estado)}`}>
                      {gasto.estado}
                    </span>
                    {gasto.movement_id && (
                      <div className="mt-1">
                        <span className="atlas-atlas-atlas-atlas-atlas-btn-primary inline-flex items-center px-2 py-1 text-xs text-primary-800">
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
        
        {filteredGastos.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">No se encontraron gastos</div>
            <div className="text-sm text-gray-500">
              {gastos.length === 0 
                ? 'Añade gastos para comenzar a gestionar tus deducciones'
                : 'Intenta ajustar los filtros'
              }
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Gasto</h3>
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
                    value={formData.proveedor_nombre}
                    onChange={(e) => setFormData({...formData, proveedor_nombre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIF/CIF
                  </label>
                  <input
                    type="text"
                    value={formData.proveedor_nif}
                    onChange={(e) => setFormData({...formData, proveedor_nif: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Pago Prevista *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_pago_prevista}
                    onChange={(e) => setFormData({...formData, fecha_pago_prevista: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    required
                    value={formData.total}
                    onChange={(e) => setFormData({...formData, total: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.base}
                    onChange={(e) => setFormData({...formData, base: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IVA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.iva}
                    onChange={(e) => setFormData({...formData, iva: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría AEAT *
                </label>
                <select
                  required
                  value={formData.categoria_AEAT}
                  onChange={(e) => setFormData({...formData, categoria_AEAT: e.target.value as AEATFiscalType})}
                  className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {aeatCategories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destino *
                  </label>
                  <select
                    required
                    value={formData.destino}
                    onChange={(e) => handleDestinoChange(e.target.value as GastoDestino)}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                      className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  className="px-4 py-2 text-gray-700 bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-600"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GastosPanel;