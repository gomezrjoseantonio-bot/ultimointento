import React, { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { initDB, Property, type MejoraInmueble } from '../../../../../services/db';
import { formatEuro, formatDate } from '../../../../../utils/formatUtils';
import { mejorasInmuebleService } from '../../../../../services/mejorasInmuebleService';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../../../services/confirmationService';

const CapexTab: React.FC = () => {
  const navigate = useNavigate();
  const [mejoras, setMejoras] = useState<MejoraInmueble[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MejoraInmueble | undefined>(undefined);

  // Form state
  const [formData, setFormData] = useState({
    inmuebleId: 0,
    ejercicio: new Date().getFullYear(),
    descripcion: '',
    tipo: 'mejora' as 'mejora' | 'ampliacion' | 'reparacion',
    importe: 0,
    fecha: new Date().toISOString().split('T')[0],
    proveedorNIF: '',
    proveedorNombre: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const [propertiesData, allMejorasRaw] = await Promise.all([
        db.getAll('properties'),
        db.getAll('mejorasInmueble') as Promise<MejoraInmueble[]>,
      ]);
      setProperties(propertiesData);

      // Filter to CAPEX only (mejora/ampliacion)
      const allMejoras = allMejorasRaw.filter(x => x.tipo === 'mejora' || x.tipo === 'ampliacion');
      setMejoras(allMejoras);
    } catch (error) {
      console.error('Error loading CAPEX data:', error);
      toast.error('Error al cargar las mejoras');
    } finally {
      setLoading(false);
    }
  };

  const getPropertyName = (propertyId: number): string => {
    const property = properties.find(p => p.id === propertyId);
    return property?.alias || `Inmueble #${propertyId}`;
  };

  const resetForm = (mejora?: MejoraInmueble) => {
    if (mejora) {
      setFormData({
        inmuebleId: mejora.inmuebleId,
        ejercicio: mejora.ejercicio,
        descripcion: mejora.descripcion,
        tipo: mejora.tipo,
        importe: mejora.importe,
        fecha: mejora.fecha,
        proveedorNIF: mejora.proveedorNIF || '',
        proveedorNombre: mejora.proveedorNombre || '',
      });
    } else {
      setFormData({
        inmuebleId: properties[0]?.id || 0,
        ejercicio: new Date().getFullYear(),
        descripcion: '',
        tipo: 'mejora',
        importe: 0,
        fecha: new Date().toISOString().split('T')[0],
        proveedorNIF: '',
        proveedorNombre: '',
      });
    }
  };

  const handleAdd = () => {
    if (properties.length === 0) {
      toast.error('Primero debes crear un inmueble antes de añadir mejoras');
      return;
    }
    setEditing(undefined);
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (mejora: MejoraInmueble) => {
    setEditing(mejora);
    resetForm(mejora);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDelete('¿Estás seguro de que deseas eliminar esta mejora?');
    if (!confirmed) return;

    try {
      await mejorasInmuebleService.eliminar(id);
      await loadData();
      toast.success('Mejora eliminada correctamente');
    } catch (error) {
      console.error('Error deleting mejora:', error);
      toast.error('Error al eliminar la mejora');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descripcion || !formData.inmuebleId || formData.importe <= 0) {
      toast.error('Completa descripción, inmueble e importe');
      return;
    }

    try {
      if (editing?.id) {
        await mejorasInmuebleService.actualizar(editing.id, {
          inmuebleId: formData.inmuebleId,
          ejercicio: formData.ejercicio,
          descripcion: formData.descripcion,
          tipo: formData.tipo,
          importe: formData.importe,
          fecha: formData.fecha,
          proveedorNIF: formData.proveedorNIF || undefined,
          proveedorNombre: formData.proveedorNombre || undefined,
        });
        toast.success('Mejora actualizada correctamente');
      } else {
        await mejorasInmuebleService.crear({
          inmuebleId: formData.inmuebleId,
          ejercicio: formData.ejercicio,
          descripcion: formData.descripcion,
          tipo: formData.tipo,
          importe: formData.importe,
          fecha: formData.fecha,
          proveedorNIF: formData.proveedorNIF || undefined,
          proveedorNombre: formData.proveedorNombre || undefined,
        });
        toast.success('Mejora creada correctamente');
      }
      setShowForm(false);
      await loadData();
    } catch (error) {
      console.error('Error saving mejora:', error);
      toast.error('Error al guardar la mejora');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy"></div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="space-y-4">
          <div className="text-gray-400">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-6 0H3m0 0V9a2 2 0 012-2h4l2 2h4a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">No tienes inmuebles registrados</h3>
            <p className="text-gray-600 mt-1">Para gestionar mejoras (CAPEX), primero necesitas registrar al menos un inmueble.</p>
          </div>
          <button
            onClick={() => navigate('/inmuebles/cartera')}
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Ir a Cartera para crear inmueble
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Mejoras y ampliaciones (CAPEX)</h2>
          <p className="text-sm text-gray-600">Inversiones que incrementan el valor del inmueble</p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-navy-800 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nueva mejora
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="text-md font-medium text-gray-900">{editing ? 'Editar mejora' : 'Nueva mejora'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inmueble *</label>
              <select value={formData.inmuebleId} onChange={e => setFormData(f => ({ ...f, inmuebleId: Number(e.target.value) }))} className="w-full border rounded-md px-3 py-2 text-sm">
                {properties.map(p => <option key={p.id} value={p.id}>{p.alias || `Inmueble #${p.id}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={formData.tipo} onChange={e => setFormData(f => ({ ...f, tipo: e.target.value as any }))} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="mejora">Mejora</option>
                <option value="ampliacion">Ampliación</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ejercicio *</label>
              <input type="number" value={formData.ejercicio} onChange={e => setFormData(f => ({ ...f, ejercicio: Number(e.target.value) }))} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
              <input type="text" value={formData.descripcion} onChange={e => setFormData(f => ({ ...f, descripcion: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Ej: Reforma cocina" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importe (€) *</label>
              <input type="number" step="0.01" value={formData.importe} onChange={e => setFormData(f => ({ ...f, importe: Number(e.target.value) }))} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" value={formData.fecha} onChange={e => setFormData(f => ({ ...f, fecha: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIF proveedor</label>
              <input type="text" value={formData.proveedorNIF} onChange={e => setFormData(f => ({ ...f, proveedorNIF: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre proveedor</label>
              <input type="text" value={formData.proveedorNombre} onChange={e => setFormData(f => ({ ...f, proveedorNombre: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-brand-navy text-white rounded-md text-sm hover:bg-navy-800">Guardar</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {mejoras.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No hay mejoras registradas</div>
            <p className="text-gray-500 mb-4">Comienza registrando tu primera mejora o ampliación.</p>
            <button onClick={handleAdd} className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-navy-800 transition-colors">
              <PlusIcon className="h-5 w-5 mr-2" />
              Crear primera mejora
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inmueble</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ejercicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mejoras.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{m.descripcion}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getPropertyName(m.inmuebleId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        m.tipo === 'mejora' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {m.tipo === 'mejora' ? 'Mejora' : 'Ampliación'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{m.ejercicio}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(m.fecha)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">{formatEuro(m.importe)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => handleEdit(m)} className="text-brand-navy hover:text-navy-800 p-1" title="Editar">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(m.id!)} className="text-error-600 hover:text-error-800 p-1" title="Eliminar">
                          <TrashIcon className="h-4 w-4" />
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
  );
};

export default CapexTab;
