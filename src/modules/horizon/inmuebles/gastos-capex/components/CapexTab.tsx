import React, { useState, useEffect, useCallback } from 'react';
import { PlusIcon, CogIcon, EyeIcon, PencilIcon, TrashIcon, CheckCircleIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Reform, initDB, Property } from '../../../../../services/db';
import { formatEuro, formatDate } from '../../../../../utils/formatUtils';
import ReformFormModal from './ReformFormModal';
import toast from 'react-hot-toast';

const CapexTab: React.FC = () => {
  const navigate = useNavigate();
  const [reforms, setReforms] = useState<Reform[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReformModal, setShowReformModal] = useState(false);
  const [editingReform, setEditingReform] = useState<Reform | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const db = await initDB();
      
      const [reformsData, propertiesData] = await Promise.all([
        db.getAll('reforms'),
        db.getAll('properties')
      ]);

      setReforms(reformsData);
      setProperties(propertiesData);
    } catch (error) {
      console.error('Error loading reforms:', error);
      toast.error('Error al cargar las reformas');
    } finally {
      setLoading(false);
    }
  };

  const getPropertyName = (propertyId: number): string => {
    const property = properties.find(p => p.id === propertyId);
    return property?.alias || 'Inmueble no encontrado';
  };

  const handleAddReform = () => {
    // Check if there are properties available
    if (properties.length === 0) {
      toast.error('Primero debes crear un inmueble antes de añadir reformas');
      return;
    }
    
    setEditingReform(undefined);
    setShowReformModal(true);
  };

  const handleEditReform = (reform: Reform) => {
    setEditingReform(reform);
    setShowReformModal(true);
  };

  const handleDeleteReform = async (reformId: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta reforma?')) {
      return;
    }

    try {
      const db = await initDB();
      
      // Delete reform line items first
      const lineItems = await db.getAllFromIndex('reformLineItems', 'reformId', reformId);
      for (const item of lineItems) {
        await db.delete('reformLineItems', item.id!);
      }
      
      // Delete reform
      await db.delete('reforms', reformId);
      await loadData();
      toast.success('Reforma eliminada correctamente');
    } catch (error) {
      console.error('Error deleting reform:', error);
      toast.error('Error al eliminar la reforma');
    }
  };

  const handleSaveReform = async (reform: Reform) => {
    try {
      const db = await initDB();
      
      if (reform.id) {
        // Update existing reform
        await db.put('reforms', reform);
        toast.success('Reforma actualizada correctamente');
      } else {
        // Create new reform
        await db.add('reforms', reform);
        toast.success('Reforma creada correctamente');
      }
      
      await loadData();
      setShowReformModal(false);
    } catch (error) {
      console.error('Error saving reform:', error);
      toast.error('Error al guardar la reforma');
    }
  };

  // Mock function to calculate reform totals
  const calculateReformTotals = async (reformId: number) => {
    try {
      const db = await initDB();
      const lineItems = await db.getAllFromIndex('reformLineItems', 'reformId', reformId);
      
      const totals = lineItems.reduce((acc, item) => {
        switch (item.treatment) {
          case 'capex-mejora':
            acc.capexMejora += item.amount;
            break;
          case 'mobiliario-10-años':
            acc.mobiliario += item.amount;
            break;
          case 'reparacion-conservacion':
            acc.reparacion += item.amount;
            break;
        }
        acc.total += item.amount;
        return acc;
      }, {
        capexMejora: 0,
        mobiliario: 0,
        reparacion: 0,
        total: 0,
        partidas: lineItems.length
      });

      return totals;
    } catch (error) {
      console.error('Error calculating reform totals:', error);
      return {
        capexMejora: 0,
        mobiliario: 0,
        reparacion: 0,
        total: 0,
        partidas: 0
      };
    }
  };

  const handleCloseReform = async (reformId: number) => {
    try {
      const db = await initDB();
      const reform = await db.get('reforms', reformId);
      
      if (!reform) {
        toast.error('Reforma no encontrada');
        return;
      }

      // Update reform status
      await db.put('reforms', {
        ...reform,
        status: 'cerrada',
        endDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      });

      // Calculate totals and update property CAPEX
      const totals = await calculateReformTotals(reformId);
      const capexIncrease = totals.capexMejora + totals.mobiliario;

      if (capexIncrease > 0) {
        const property = await db.get('properties', reform.propertyId);
        if (property) {
          // Note: This would need to be implemented in the property interface
          // For now, we'll just show a toast
          toast.success(`Reforma cerrada. CAPEX actualizado: ${formatEuro(capexIncrease)}`);
        }
      }

      // Reload data
      await loadData();
      toast.success('Reforma cerrada correctamente');
    } catch (error) {
      console.error('Error closing reform:', error);
      toast.error('Error al cerrar la reforma');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy"></div>
      </div>
    );
  }

  // Show message when no properties exist
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
            <h3 className="text-lg font-medium text-gray-900">
              No tienes inmuebles registrados
            </h3>
            <p className="text-gray-600 mt-1">
              Para gestionar reformas (CAPEX), primero necesitas registrar al menos un inmueble.
            </p>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reformas (CAPEX)</h2>
          <p className="text-sm text-gray-600">
            Agrupa mejoras/ampliaciones y mobiliario (no gasto del año)
          </p>
        </div>
        <button
          onClick={handleAddReform}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-navy-800 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nueva reforma
        </button>
      </div>

      {/* Reforms List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {reforms.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No hay reformas registradas</div>
            <p className="text-gray-500 mb-4">
              Comienza creando tu primera reforma para agrupar mejoras y ampliaciones.
            </p>
            <button 
              onClick={handleAddReform}
              className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-navy-800 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Crear primera reforma
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inmueble</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe total</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Partidas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reforms.map((reform) => (
                  <ReformRow
                    key={reform.id}
                    reform={reform}
                    propertyName={getPropertyName(reform.propertyId)}
                    onClose={() => handleCloseReform(reform.id!)}
                    onEdit={() => handleEditReform(reform)}
                    onDelete={() => handleDeleteReform(reform.id!)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reform Form Modal */}
      <ReformFormModal
        isOpen={showReformModal}
        onClose={() => setShowReformModal(false)}
        onSave={handleSaveReform}
        reform={editingReform}
        properties={properties}
      />
    </div>
  );
};

// Individual Reform Row Component
interface ReformRowProps {
  reform: Reform;
  propertyName: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ReformRow: React.FC<ReformRowProps> = ({ reform, propertyName, onClose, onEdit, onDelete }) => {
  const [totals, setTotals] = useState({
    capexMejora: 0,
    mobiliario: 0,
    reparacion: 0,
    total: 0,
    partidas: 0
  });

  const calculateTotals = useCallback(async () => {
    try {
      const db = await initDB();
      const lineItems = await db.getAllFromIndex('reformLineItems', 'reformId', reform.id!);
      
      const calculated = lineItems.reduce((acc, item) => {
        switch (item.treatment) {
          case 'capex-mejora':
            acc.capexMejora += item.amount;
            break;
          case 'mobiliario-10-años':
            acc.mobiliario += item.amount;
            break;
          case 'reparacion-conservacion':
            acc.reparacion += item.amount;
            break;
        }
        acc.total += item.amount;
        return acc;
      }, {
        capexMejora: 0,
        mobiliario: 0,
        reparacion: 0,
        total: 0,
        partidas: lineItems.length
      });

      setTotals(calculated);
    } catch (error) {
      console.error('Error calculating totals:', error);
    }
  }, [reform.id]);

  useEffect(() => {
    if (reform.id) {
      calculateTotals();
    }
  }, [reform.id, calculateTotals]);

  const getPeriodText = () => {
    const start = formatDate(reform.startDate);
    const end = reform.endDate ? formatDate(reform.endDate) : 'En curso';
    return `${start} - ${end}`;
  };

  const getStatusIcon = () => {
    return reform.status === 'cerrada' ? (
      <CheckCircleIcon className="h-5 w-5 text-success-500" />
    ) : (
      <CogIcon className="h-5 w-5 text-orange-500" />
    );
  };

  const getStatusBadge = () => {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        reform.status === 'cerrada' 
          ? 'bg-success-100 text-success-800' 
          : 'bg-warning-100 text-orange-800'
      }`}>
        {reform.status === 'cerrada' ? 'Cerrada' : 'Abierta'}
      </span>
    );
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <div className="flex items-center">
          {getStatusIcon()}
          <div className="ml-3">
            <div className="font-medium">{reform.title}</div>
            {reform.notes && (
              <div className="text-gray-500 text-xs truncate max-w-xs">{reform.notes}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {propertyName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {getPeriodText()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
        <div>
          <div className="font-medium">{formatEuro(totals.total)}</div>
          {totals.total > 0 && (
            <div className="text-xs text-gray-500">
              M: {formatEuro(totals.capexMejora)} | 
              Mob: {formatEuro(totals.mobiliario)} | 
              R&C: {formatEuro(totals.reparacion)}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
        <span className="font-medium">{totals.partidas}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {getStatusBadge()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          <button
            className="text-brand-navy hover:text-navy-800 p-1"
            title="Ver detalles"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          {reform.status === 'abierta' && (
            <>
              <button
                onClick={onEdit}
                className="text-brand-navy hover:text-navy-800 p-1"
                title="Editar"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="text-success-600 hover:text-success-800 p-1"
                title="Cerrar reforma"
              >
                <CheckCircleIcon className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            className="text-error-600 hover:text-error-800 p-1"
            title="Eliminar"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default CapexTab;