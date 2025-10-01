import React, { useState, useEffect } from 'react';
import { PlusIcon, SearchIcon, EyeIcon, PencilIcon, TrashIcon, CheckCircleIcon, ClockIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ExpenseH5, initDB, Property, TipoGasto, EstadoConciliacion } from '../../../../../services/db';
import { formatEuro, formatDate } from '../../../../../utils/formatUtils';
import ExpenseFormModal from './ExpenseFormModal';

import toast from 'react-hot-toast';
import { confirmDelete } from '../../../../../services/confirmationService';

interface GastosTabProps {
  triggerAddExpense?: boolean;
}

// UNICORNIO REFACTOR: Expense type options for unified filtering
const TIPO_GASTO_OPTIONS: Array<{ value: TipoGasto; label: string }> = [
  { value: 'suministro_electricidad', label: 'Electricidad' },
  { value: 'suministro_agua', label: 'Agua' },
  { value: 'suministro_gas', label: 'Gas' },
  { value: 'internet', label: 'Internet' },
  { value: 'reparacion_conservacion', label: 'Reparación y conservación' },
  { value: 'mejora', label: 'Mejora' },
  { value: 'mobiliario', label: 'Mobiliario' },
  { value: 'comunidad', label: 'Comunidad' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'ibi', label: 'IBI' },
  { value: 'intereses', label: 'Intereses' },
  { value: 'comisiones', label: 'Comisiones' },
  { value: 'otros', label: 'Otros' }
];

const GastosTab: React.FC<GastosTabProps> = ({ triggerAddExpense = false }) => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<ExpenseH5[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseH5 | undefined>(undefined);
  const [filters, setFilters] = useState({
    tipo_gasto: '',
    origen: '',
    estado_conciliacion: '',
    destino: '',
    propertyId: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  // Handle trigger from parent component
  useEffect(() => {
    if (triggerAddExpense) {
      // Check if there are properties available
      if (properties.length === 0) {
        toast.error('Primero debes crear un inmueble antes de añadir gastos');
        return;
      }
      
      setEditingExpense(undefined);
      setShowExpenseModal(true);
    }
  }, [triggerAddExpense, properties.length]);

  const loadData = async () => {
    try {
      setLoading(true);
      const db = await initDB();
      
      // Load expenses and properties
      const [expensesData, propertiesData] = await Promise.all([
        db.getAll('expensesH5'),
        db.getAll('properties')
      ]);

      // UNICORNIO REFACTOR: Migrate legacy expenses to unified structure
      const migratedExpenses = expensesData.map(expense => {
        if (!expense.tipo_gasto) {
          // Auto-migrate legacy expenses
          return {
            ...expense,
            tipo_gasto: 'otros' as TipoGasto,
            destino: 'inmueble' as const,
            destino_id: expense.propertyId,
            estado_conciliacion: 'pendiente' as EstadoConciliacion,
            currency: expense.currency || 'EUR'
          };
        }
        return expense;
      });

      setExpenses(migratedExpenses);
      setProperties(propertiesData);
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast.error('Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    // Handle both legacy propertyId and new destino_id structure
    const propertyId = expense.destino === 'inmueble' ? expense.destino_id : expense.propertyId;
    const property = properties.find(p => p.id === propertyId);
    
    const matchesSearch = 
      expense.counterparty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property?.alias.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipoGasto = !filters.tipo_gasto || expense.tipo_gasto === filters.tipo_gasto;
    const matchesOrigen = !filters.origen || expense.origin === filters.origen;
    const matchesEstadoConciliacion = !filters.estado_conciliacion || expense.estado_conciliacion === filters.estado_conciliacion;
    const matchesDestino = !filters.destino || expense.destino === filters.destino;
    
    // Handle property filter including 'personal'
    let matchesProperty = true;
    if (filters.propertyId) {
      if (filters.propertyId === 'personal') {
        matchesProperty = expense.destino === 'personal';
      } else {
        matchesProperty = propertyId === parseInt(filters.propertyId);
      }
    }
    
    const matchesDateRange = 
      (!filters.startDate || expense.date >= filters.startDate) &&
      (!filters.endDate || expense.date <= filters.endDate);

    return matchesSearch && matchesTipoGasto && matchesOrigen && matchesEstadoConciliacion && 
           matchesDestino && matchesProperty && matchesDateRange;
  });

  const getPropertyName = (expense: ExpenseH5): string => {
    const propertyId = expense.destino === 'inmueble' ? expense.destino_id : expense.propertyId;
    const property = properties.find(p => p.id === propertyId);
    return property?.alias || (expense.destino === 'personal' ? 'Personal' : 'Inmueble no encontrado');
  };

  const getTipoGastoLabel = (tipo: TipoGasto): string => {
    const option = TIPO_GASTO_OPTIONS.find(opt => opt.value === tipo);
    return option?.label || tipo;
  };

  const getConciliationBadge = (estado: EstadoConciliacion) => {
    const statusMap = {
      'pendiente': 'bg-warning-100 text-yellow-800',
      'conciliado': 'bg-success-100 text-success-800'
    };
    
    const statusLabels = {
      'pendiente': 'Pendiente',
      'conciliado': 'Conciliado'
    };

    const iconMap = {
      'pendiente': ClockIcon,
      'conciliado': CheckCircleIcon
    };

    const Icon = iconMap[estado];

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${statusMap[estado] || 'bg-gray-100 text-gray-800'}`}>
        <Icon className="h-3 w-3 mr-1" />
        {statusLabels[estado] || estado}
      </span>
    );
  };

  const handleAddExpense = () => {
    // Check if there are properties available
    if (properties.length === 0) {
      toast.error('Primero debes crear un inmueble antes de añadir gastos');
      return;
    }
    
    setEditingExpense(undefined);
    setShowExpenseModal(true);
  };

  const handleEditExpense = async (expense: ExpenseH5) => {
    setEditingExpense(expense);
    setShowExpenseModal(true);
  };

  const handleDeleteExpense = async (expenseId: number) => {
    const confirmed = await confirmDelete('Estás seguro de que deseas eliminar este gasto');
    if (!confirmed) {
      return;
    }

    try {
      const db = await initDB();
      await db.delete('expensesH5', expenseId);
      await loadData();
      toast.success('Gasto eliminado correctamente');
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Error al eliminar el gasto');
    }
  };

  const handleSaveExpense = async (expense: ExpenseH5) => {
    try {
      const db = await initDB();
      
      if (expense.id) {
        // Update existing expense
        await db.put('expensesH5', expense);
        toast.success('Gasto actualizado correctamente');
      } else {
        // Create new expense
        await db.add('expensesH5', expense);
        toast.success('Gasto creado correctamente');
      }
      
      await loadData();
      setShowExpenseModal(false);
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Error al guardar el gasto');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-b-2 border-brand-navy"></div>
      </div>
    );
  }

  // Show message when no properties exist
  if (properties.length === 0) {
    return (
      <div className="bg-white border border-gray-200 p-12 text-center">
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
              Para gestionar gastos, primero necesitas registrar al menos un inmueble.
            </p>
          </div>
          <button
            onClick={() => navigate('/inmuebles/cartera')}
            className="inline-flex items-center px-4 py-2 bg-brand-navy"
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
      {/* KPIs Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Total Gastos</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatEuro(filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">% Conciliado</div>
          <div className="text-2xl font-bold text-success-600">
            {filteredExpenses.length ? Math.round((filteredExpenses.filter(e => e.estado_conciliacion === 'conciliado').length / filteredExpenses.length) * 100) : 0}%
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Suministros</div>
          <div className="text-2xl font-bold text-primary-600">
            {formatEuro(filteredExpenses.filter(e => e.tipo_gasto?.startsWith('suministro_') || e.tipo_gasto === 'internet').reduce((sum, exp) => sum + exp.amount, 0))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Reparación/Conservación</div>
          <div className="text-2xl font-bold text-warning-600">
            {formatEuro(filteredExpenses.filter(e => e.tipo_gasto === 'reparacion_conservacion').reduce((sum, exp) => sum + exp.amount, 0))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Mejora</div>
          <div className="text-2xl font-bold text-info-600">
            {formatEuro(filteredExpenses.filter(e => e.tipo_gasto === 'mejora').reduce((sum, exp) => sum + exp.amount, 0))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">Mobiliario</div>
          <div className="text-2xl font-bold text-indigo-600">
            {formatEuro(filteredExpenses.filter(e => e.tipo_gasto === 'mobiliario').reduce((sum, exp) => sum + exp.amount, 0))}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar proveedor, concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              />
            </div>
          </div>

          {/* Tipo de Gasto Filter */}
          <div>
            <select
              value={filters.tipo_gasto}
              onChange={(e) => setFilters(prev => ({ ...prev, tipo_gasto: e.target.value }))}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">Todos los tipos</option>
              {TIPO_GASTO_OPTIONS.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Origen Filter */}
          <div>
            <select
              value={filters.origen}
              onChange={(e) => setFilters(prev => ({ ...prev, origen: e.target.value }))}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">Todos los orígenes</option>
              <option value="manual">Manual</option>
              <option value="inbox">Inbox</option>
            </select>
          </div>

          {/* Estado Conciliación Filter */}
          <div>
            <select
              value={filters.estado_conciliacion}
              onChange={(e) => setFilters(prev => ({ ...prev, estado_conciliacion: e.target.value }))}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">Conciliación</option>
              <option value="pendiente">Pendiente</option>
              <option value="conciliado">Conciliado</option>
            </select>
          </div>

          {/* Property Filter */}
          <div>
            <select
              value={filters.propertyId}
              onChange={(e) => setFilters(prev => ({ ...prev, propertyId: e.target.value }))}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">Inmueble/Personal</option>
              <option value="personal">Personal</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.alias}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilters({
                  tipo_gasto: '',
                  origen: '',
                  estado_conciliacion: '',
                  destino: '',
                  propertyId: '',
                  startDate: '',
                  endDate: ''
                });
              }}
              className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No hay gastos registrados</div>
            <p className="text-gray-500 mb-4">
              Comienza añadiendo tu primer gasto o importa documentos desde la bandeja.
            </p>
            <button 
              onClick={handleAddExpense}
              className="inline-flex items-center px-4 py-2 bg-brand-navy"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Añadir primer gasto
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inmueble/Personal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conciliación</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{getPropertyName(expense)}</div>
                        <div className="text-gray-500 text-xs">
                          {expense.unit === 'completo' ? 'Completo' : expense.unit}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{expense.counterparty}</div>
                        {expense.counterpartyNIF && (
                          <div className="text-gray-500 text-xs">{expense.counterpartyNIF}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{expense.concept}</div>
                        {expense.desglose_amortizable && (
                          <div className="text-gray-500 text-xs">
                            {expense.desglose_amortizable.mejora_importe > 0 && `Mejora: ${formatEuro(expense.desglose_amortizable.mejora_importe)} `}
                            {expense.desglose_amortizable.mobiliario_importe > 0 && `Mobiliario: ${formatEuro(expense.desglose_amortizable.mobiliario_importe)}`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="atlas-atlas-btn-primary inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-primary-800">
                        {getTipoGastoLabel(expense.tipo_gasto)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                      {formatEuro(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getConciliationBadge(expense.estado_conciliacion)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {expense.documentId && (
                          <button
                            className="text-brand-navy hover:text-navy-800 p-1"
                            title="Ver documento"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        )}
                        {expense.estado_conciliacion === 'pendiente' && (
                          <button
                            className="text-success-600 hover:text-success-800 p-1"
                            title="Conciliar"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="text-brand-navy hover:text-navy-800 p-1"
                          title="Ver/Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id!)}
                          className="text-error-600 hover:text-error-800 p-1"
                          title="Eliminar"
                        >
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

      {/* Expense Form Modal */}
      <ExpenseFormModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSave={handleSaveExpense}
        expense={editingExpense}
        properties={properties}
      />
    </div>
  );
};

export default GastosTab;