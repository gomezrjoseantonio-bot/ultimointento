import React, { useState, useEffect } from 'react';
import { PlusIcon, SearchIcon, EyeIcon, PencilIcon, CopyIcon, TrashIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ExpenseH5, initDB, Property } from '../../../../../services/db';
import { AEAT_FISCAL_TYPES, getFiscalTypeLabel, getAEATBoxLabel } from '../../../../../utils/aeatUtils';
import { formatEuro, formatDate } from '../../../../../utils/formatUtils';
import ExpenseFormModal from './ExpenseFormModal';
import toast from 'react-hot-toast';

interface GastosTabProps {
  triggerAddExpense?: boolean;
}

const GastosTab: React.FC<GastosTabProps> = ({ triggerAddExpense = false }) => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<ExpenseH5[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseH5 | undefined>(undefined);
  const [filters, setFilters] = useState({
    fiscalType: '',
    status: '',
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

      setExpenses(expensesData);
      setProperties(propertiesData);
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast.error('Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const property = properties.find(p => p.id === expense.propertyId);
    const matchesSearch = 
      expense.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property?.alias.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFiscalType = !filters.fiscalType || expense.fiscalType === filters.fiscalType;
    const matchesStatus = !filters.status || expense.status === filters.status;
    const matchesProperty = !filters.propertyId || expense.propertyId === parseInt(filters.propertyId);
    const matchesDateRange = 
      (!filters.startDate || expense.date >= filters.startDate) &&
      (!filters.endDate || expense.date <= filters.endDate);

    return matchesSearch && matchesFiscalType && matchesStatus && matchesProperty && matchesDateRange;
  });

  const getPropertyName = (propertyId: number): string => {
    const property = properties.find(p => p.id === propertyId);
    return property?.alias || 'Inmueble no encontrado';
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'validado': 'bg-green-100 text-green-800',
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'por-revisar': 'bg-red-100 text-red-800'
    };
    
    const statusLabels = {
      'validado': 'Validado',
      'pendiente': 'Pendiente',
      'por-revisar': 'Por revisar'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusMap[status as keyof typeof statusMap] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </span>
    );
  };

  const getOriginBadge = (origin: string) => {
    const originMap = {
      'manual': 'bg-blue-100 text-blue-800',
      'inbox': 'bg-teal-100 text-teal-800'
    };
    
    const originLabels = {
      'manual': 'Manual',
      'inbox': 'Inbox'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${originMap[origin as keyof typeof originMap] || 'bg-gray-100 text-gray-800'}`}>
        {originLabels[origin as keyof typeof originLabels] || origin}
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

  const handleEditExpense = (expense: ExpenseH5) => {
    setEditingExpense(expense);
    setShowExpenseModal(true);
  };

  const handleDuplicateExpense = (expense: ExpenseH5) => {
    const duplicated = {
      ...expense,
      id: undefined,
      concept: `${expense.concept} (copia)`,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingExpense(duplicated);
    setShowExpenseModal(true);
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este gasto?')) {
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
              Para gestionar gastos, primero necesitas registrar al menos un inmueble.
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
      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
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
                className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              />
            </div>
          </div>

          {/* Fiscal Type Filter */}
          <div>
            <select
              value={filters.fiscalType}
              onChange={(e) => setFilters(prev => ({ ...prev, fiscalType: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">Todos los tipos</option>
              {AEAT_FISCAL_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">Todos los estados</option>
              <option value="validado">Validado</option>
              <option value="pendiente">Pendiente</option>
              <option value="por-revisar">Por revisar</option>
            </select>
          </div>

          {/* Property Filter */}
          <div>
            <select
              value={filters.propertyId}
              onChange={(e) => setFilters(prev => ({ ...prev, propertyId: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">Todos los inmuebles</option>
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
                  fiscalType: '',
                  status: '',
                  propertyId: '',
                  startDate: '',
                  endDate: ''
                });
              }}
              className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No hay gastos registrados</div>
            <p className="text-gray-500 mb-4">
              Comienza añadiendo tu primer gasto o importa documentos desde la bandeja.
            </p>
            <button 
              onClick={handleAddExpense}
              className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-navy-800 transition-colors"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo fiscal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Casilla AEAT</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inmueble</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
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
                        <div className="font-medium">{expense.provider}</div>
                        {expense.providerNIF && (
                          <div className="text-gray-500 text-xs">{expense.providerNIF}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.concept}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                      {formatEuro(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getFiscalTypeLabel(expense.fiscalType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.aeatBox ? getAEATBoxLabel(expense.aeatBox) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{getPropertyName(expense.propertyId)}</div>
                        <div className="text-gray-500 text-xs">
                          {expense.unit === 'completo' ? 'Completo' : expense.unit}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(expense.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getOriginBadge(expense.origin)}
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
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="text-brand-navy hover:text-navy-800 p-1"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicateExpense(expense)}
                          className="text-brand-navy hover:text-navy-800 p-1"
                          title="Duplicar"
                        >
                          <CopyIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id!)}
                          className="text-red-600 hover:text-red-800 p-1"
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