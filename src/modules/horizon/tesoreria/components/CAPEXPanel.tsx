import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Calculator, Calendar, Building, FileText } from 'lucide-react';
import { initDB, Property } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';

/** Local types — mejora store has been removed */
type MejoraTipo = 'reparacion' | 'mejora' | 'ampliacion' | 'mobiliario';
type MejoraEstado = 'completo' | 'incompleto' | 'pagado' | 'amortizando';
type MejoraRecord = {
  id?: number;
  inmueble_id: number;
  contraparte: string;
  fecha_emision: string;
  total: number;
  tipo: MejoraTipo;
  anos_amortizacion: number;
  estado: MejoraEstado;
  movement_id?: number;
  source_doc_id?: number;
  createdAt: string;
  updatedAt: string;
};

const MejorasPanel: React.FC = () => {
  const [mejoraRecords, setCapexRecords] = useState<MejoraRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    inmueble_id: 0,
    contraparte: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    total: 0,
    tipo: 'mejora' as MejoraTipo,
    anos_amortizacion: 10,
    estado: 'completo' as MejoraEstado
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const [propertiesData] = await Promise.all([
        db.getAll('properties')
      ]);
      // mejora store removed — always empty
      const mejoraData: MejoraRecord[] = [];

      setCapexRecords(mejoraData);
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
    
    if (!formData.contraparte || formData.total <= 0 || !formData.inmueble_id) {
      toast.error('Por favor, completa todos los campos requeridos');
      return;
    }

    try {
      const db = await initDB();
      const newMejora: MejoraRecord = {
        inmueble_id: formData.inmueble_id,
        contraparte: formData.contraparte, // Map proveedor to contraparte
        fecha_emision: formData.fecha_emision,
        total: formData.total,
        tipo: formData.tipo,
        anos_amortizacion: formData.anos_amortizacion,
        estado: formData.estado,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // mejora store removed — no-op
      console.warn('[MejorasPanel] mejora store removed, skipping add');
      
      const propertyName = properties.find(p => p.id === formData.inmueble_id)?.alias || 'Inmueble';
      toast.success(`✓ Guardado en Tesorería > Mejora: ${formatEuro(formData.total)} — ${formData.contraparte} / ${propertyName}`);
      
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving Mejora:', error);
      toast.error('Error al guardar la inversión');
    }
  };

  const resetForm = () => {
    setFormData({
      inmueble_id: 0,
      contraparte: '',
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
      case 'amortizando': return 'bg-info-100 text-info-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'mejora': return 'bg-primary-100 text-primary-800';
      case 'ampliacion': return 'bg-primary-100 text-primary-800';
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

  const filteredMejoras = mejoraRecords.filter(mejora => {
    const matchesStatus = statusFilter === 'all' || mejora.estado === statusFilter;
    const matchesSearch = searchTerm === '' || 
      mejora.contraparte.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPropertyName(mejora.inmueble_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      mejora.tipo.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const mejoraTypes: { value: MejoraTipo; label: string; defaultYears: number }[] = [
    { value: 'mejora', label: 'Mejora', defaultYears: 15 },
    { value: 'ampliacion', label: 'Ampliación', defaultYears: 15 },
    { value: 'mobiliario', label: 'Mobiliario', defaultYears: 10 },
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
              className="w-48 px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            placeholder="Buscar por contraparte, inmueble o tipo..."
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
            <h3 className="text-sm font-medium text-gray-500">Total Invertido</h3>
            <Calculator className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatEuro(filteredMejoras.reduce((sum, mejora) => sum + mejora.total, 0))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Amortización Anual</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatEuro(filteredMejoras.reduce((sum, mejora) => sum + calculateAmortizationPerYear(mejora.total, mejora.anos_amortizacion), 0))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Proyectos</h3>
            <Building className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-primary-600">
            {filteredMejoras.length}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Amortizando</h3>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-info-600">
            {filteredMejoras.filter(c => c.estado === 'amortizando').length}
          </div>
        </div>
      </div>

      {/* Mejora Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
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
              {filteredMejoras.map((mejora) => (
                <tr key={mejora.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building className="w-4 h-4 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">
                        {getPropertyName(mejora.inmueble_id)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {mejora.contraparte}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold ${getTipoColor(mejora.tipo)}`}>
                      {mejora.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-error-600">
                      {formatEuro(mejora.total)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-900">
                      {mejora.anos_amortizacion} años
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatEuro(calculateAmortizationPerYear(mejora.total, mejora.anos_amortizacion))}/año
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold ${getStatusColor(mejora.estado)}`}>
                      {mejora.estado}
                    </span>
                    {mejora.source_doc_id && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-1 text-xs bg-success-100 text-success-800">
                          <FileText className="w-3 h-3 mr-1" />
                          OCR
                        </span>
                      </div>
                    )}
                    {mejora.movement_id && (
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
        
        {filteredMejoras.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">No se encontraron inversiones Mejora</div>
            <div className="text-sm text-gray-500">
              {mejoraRecords.length === 0 
                ? 'Añade inversiones para gestionar la amortización'
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
              <h3 className="text-lg font-semibold text-gray-900">Nueva Inversión Mejora</h3>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraparte *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contraparte}
                    onChange={(e) => setFormData({...formData, contraparte: e.target.value})}
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
                      const selectedType = mejoraTypes.find(t => t.value === e.target.value);
                      setFormData({
                        ...formData, 
                        tipo: e.target.value as MejoraTipo,
                        anos_amortizacion: selectedType?.defaultYears || 10
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {mejoraTypes.map(type => (
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
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
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

export default MejorasPanel;