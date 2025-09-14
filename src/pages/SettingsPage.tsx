import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getAllProviders, 
  saveProvider, 
  updateProvider, 
  deleteProvider, 
  initializeDefaultProviders,
  type ProviderDirectoryEntry 
} from '../services/providerDirectoryService';
import { getAutoSaveConfig, setAutoSaveConfig, toggleAutoSave } from '../services/autoSaveService';

const SettingsPage: React.FC = () => {
  const [providers, setProviders] = useState<ProviderDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderDirectoryEntry | null>(null);
  const [formData, setFormData] = useState({
    canonicalName: '',
    nif: '',
    aliases: ''
  });
  // H3: Auto-save configuration state
  const [autoSaveConfig, setAutoSaveConfigState] = useState(getAutoSaveConfig());

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      // Initialize default providers if none exist
      await initializeDefaultProviders();
      const providerList = await getAllProviders();
      setProviders(providerList);
    } catch (error) {
      console.error('Error loading providers:', error);
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = () => {
    setFormData({ canonicalName: '', nif: '', aliases: '' });
    setEditingProvider(null);
    setShowAddModal(true);
  };

  const handleEditProvider = (provider: ProviderDirectoryEntry) => {
    setFormData({
      canonicalName: provider.canonicalName,
      nif: provider.nif || '',
      aliases: provider.aliases.join(', ')
    });
    setEditingProvider(provider);
    setShowAddModal(true);
  };

  const handleSaveProvider = async () => {
    if (!formData.canonicalName.trim()) {
      toast.error('El nombre canónico es obligatorio');
      return;
    }

    try {
      const providerData = {
        canonicalName: formData.canonicalName.trim(),
        nif: formData.nif.trim(),
        aliases: formData.aliases.split(',').map(a => a.trim()).filter(a => a)
      };

      if (editingProvider) {
        await updateProvider(editingProvider.id!, providerData);
        toast.success('Proveedor actualizado');
      } else {
        await saveProvider(providerData);
        toast.success('Proveedor añadido');
      }

      setShowAddModal(false);
      loadProviders();
    } catch (error) {
      toast.error(editingProvider ? 'Error al actualizar proveedor' : 'Error al añadir proveedor');
    }
  };

  const handleDeleteProvider = async (id: number, name: string) => {
    if (!window.// TODO: Replace with ATLAS confirmation modal
    // confirm(`¿Eliminar proveedor "${name}"?`)) return;

    try {
      await deleteProvider(id);
      toast.success('Proveedor eliminado');
      loadProviders();
    } catch (error) {
      toast.error('Error al eliminar proveedor');
    }
  };

  // H3: Auto-save configuration handlers
  const handleToggleAutoSave = () => {
    const newEnabled = toggleAutoSave();
    setAutoSaveConfigState(prev => ({ ...prev, enabled: newEnabled }));
    toast.success(`Auto-guardado ${newEnabled ? 'activado' : 'desactivado'}`);
  };

  const handleUpdateAutoSaveConfig = (updates: any) => {
    const newConfig = { ...autoSaveConfig, ...updates };
    setAutoSaveConfig(newConfig);
    setAutoSaveConfigState(newConfig);
    toast.success('Configuración actualizada');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Configuración</h1>
      </div>

      {/* Provider Directory Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Directorio de Proveedores</h2>
              <p className="text-sm text-gray-500 mt-1">
                Gestiona los nombres canónicos y aliases de proveedores para mejorar la precisión del OCR
              </p>
            </div>
            <button
              onClick={handleAddProvider}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Añadir Proveedor
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-600">Cargando proveedores...</p>
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay proveedores configurados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Nombre Canónico</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">NIF/CIF</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Aliases</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => (
                    <tr key={provider.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{provider.canonicalName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-600">{provider.nif || '—'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {provider.aliases.slice(0, 3).map((alias, index) => (
                            <span 
                              key={index}
                              className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {alias}
                            </span>
                          ))}
                          {provider.aliases.length > 3 && (
                            <span className="inline-block px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                              +{provider.aliases.length - 3} más
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditProvider(provider)}
                            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProvider(provider.id!, provider.canonicalName)}
                            className="p-2 text-gray-600 hover:text-error-600 hover:bg-error-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Provider Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium">
                {editingProvider ? 'Editar Proveedor' : 'Añadir Proveedor'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Canónico *
                </label>
                <input
                  type="text"
                  value={formData.canonicalName}
                  onChange={(e) => setFormData({...formData, canonicalName: e.target.value})}
                  placeholder="ej. ENDESA"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIF/CIF
                </label>
                <input
                  type="text"
                  value={formData.nif}
                  onChange={(e) => setFormData({...formData, nif: e.target.value})}
                  placeholder="ej. A81948077"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aliases (separados por comas)
                </label>
                <textarea
                  value={formData.aliases}
                  onChange={(e) => setFormData({...formData, aliases: e.target.value})}
                  placeholder="ej. Endesa Energía XXI, Endesa S.A., ENDESA ENERGIA"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
            </div>
            
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={handleSaveProvider}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingProvider ? 'Actualizar' : 'Guardar'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Configuration Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Configuración OCR</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Procesamiento automático</p>
              <p className="text-sm text-gray-500">Procesar documentos automáticamente al subirlos</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
          
          <div>
            <p className="font-medium text-gray-900 mb-2">Umbral de confianza</p>
            <p className="text-sm text-gray-500 mb-3">Confianza mínima para aplicar campos automáticamente</p>
            <input 
              type="range" 
              min="0.5" 
              max="1" 
              step="0.05" 
              defaultValue="0.8"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>50%</span>
              <span>80%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* H3: Auto-save Configuration Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Auto-guardado (H3+H8)</h2>
        <div className="space-y-6">
          {/* Main toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Auto-guardado activado</p>
              <p className="text-sm text-gray-500">
                {autoSaveConfig.enabled 
                  ? 'Todos los documentos se procesan y archivan automáticamente' 
                  : 'Solo documentos claros se archivan, documentos dudosos quedan pendientes'
                }
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={autoSaveConfig.enabled}
                onChange={handleToggleAutoSave}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Destination routing */}
          <div>
            <p className="font-medium text-gray-900 mb-3">Destinos de archivado</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Facturas</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={autoSaveConfig.destinations.facturas}
                  onChange={(e) => handleUpdateAutoSaveConfig({
                    destinations: { ...autoSaveConfig.destinations, facturas: e.target.value }
                  })}
                >
                  <option value="tesoreria-gastos">Tesorería → Gastos</option>
                  <option value="tesoreria-capex">Tesorería → CAPEX</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Extractos bancarios</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={autoSaveConfig.destinations.extractos}
                  onChange={(e) => handleUpdateAutoSaveConfig({
                    destinations: { ...autoSaveConfig.destinations, extractos: e.target.value }
                  })}
                >
                  <option value="tesoreria-movimientos">Tesorería → Movimientos</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Contratos</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={autoSaveConfig.destinations.contratos}
                  onChange={(e) => handleUpdateAutoSaveConfig({
                    destinations: { ...autoSaveConfig.destinations, contratos: e.target.value }
                  })}
                >
                  <option value="horizon-contratos">Horizon → Contratos</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Otros documentos</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={autoSaveConfig.destinations.otros}
                  onChange={(e) => handleUpdateAutoSaveConfig({
                    destinations: { ...autoSaveConfig.destinations, otros: e.target.value }
                  })}
                >
                  <option value="archivo-general">Archivo General</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clear criteria for auto-save OFF mode */}
          {!autoSaveConfig.enabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="font-medium text-amber-900 mb-2">Criterios CLARO (modo auto-guardado OFF)</p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-amber-800">Facturas CLARAS requieren:</p>
                  <ul className="list-disc list-inside text-amber-700 mt-1 space-y-1">
                    <li>Proveedor resuelto</li>
                    <li>Total y fecha válidos</li>
                    <li>Clasificación fiscal segura (≥80%)</li>
                    <li>Inmueble/personal definido</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-amber-800">Extractos CLAROS requieren:</p>
                  <ul className="list-disc list-inside text-amber-700 mt-1 space-y-1">
                    <li>Plantilla de banco válida</li>
                    <li>Fechas/decimales consistentes</li>
                    <li>Cuenta identificada</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Confidence thresholds */}
          <div>
            <p className="font-medium text-gray-900 mb-3">Umbrales de confianza mínimos</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Facturas</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1" 
                  step="0.05" 
                  value={autoSaveConfig.confidenceThresholds.factura}
                  onChange={(e) => handleUpdateAutoSaveConfig({
                    confidenceThresholds: { 
                      ...autoSaveConfig.confidenceThresholds, 
                      factura: parseFloat(e.target.value) 
                    }
                  })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-center text-xs text-gray-500 mt-1">
                  {Math.round(autoSaveConfig.confidenceThresholds.factura * 100)}%
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Extractos</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1" 
                  step="0.05" 
                  value={autoSaveConfig.confidenceThresholds.extracto}
                  onChange={(e) => handleUpdateAutoSaveConfig({
                    confidenceThresholds: { 
                      ...autoSaveConfig.confidenceThresholds, 
                      extracto: parseFloat(e.target.value) 
                    }
                  })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-center text-xs text-gray-500 mt-1">
                  {Math.round(autoSaveConfig.confidenceThresholds.extracto * 100)}%
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Contratos</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1" 
                  step="0.05" 
                  value={autoSaveConfig.confidenceThresholds.contrato}
                  onChange={(e) => handleUpdateAutoSaveConfig({
                    confidenceThresholds: { 
                      ...autoSaveConfig.confidenceThresholds, 
                      contrato: parseFloat(e.target.value) 
                    }
                  })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-center text-xs text-gray-500 mt-1">
                  {Math.round(autoSaveConfig.confidenceThresholds.contrato * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;