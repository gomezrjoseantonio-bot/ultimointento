import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, AlertCircle, Home, ShoppingCart, Car, Smile, Heart, Shield, GraduationCap, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { PersonalExpense, PersonalExpenseCategory, PersonalExpenseFrequency } from '../../../types/personal';
import { personalExpensesService } from '../../../services/personalExpensesService';
import { personalDataService } from '../../../services/personalDataService';
import { Account, initDB } from '../../../services/db';
import PersonalExpenseForm from './PersonalExpenseForm';

const FREQUENCY_LABELS: Record<PersonalExpenseFrequency, string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

const CATEGORY_LABELS: Record<PersonalExpenseCategory, string> = {
  vivienda: 'Vivienda',
  alimentacion: 'Alimentación',
  transporte: 'Transporte',
  ocio: 'Ocio',
  salud: 'Salud',
  seguros: 'Seguros',
  educacion: 'Educación',
  otros: 'Otros',
};

const CATEGORY_ICONS: Record<PersonalExpenseCategory, React.ElementType> = {
  vivienda: Home,
  alimentacion: ShoppingCart,
  transporte: Car,
  ocio: Smile,
  salud: Heart,
  seguros: Shield,
  educacion: GraduationCap,
  otros: MoreHorizontal,
};

const formatEuro = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

const GastosManager: React.FC = () => {
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PersonalExpense | undefined>(undefined);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    initDB().then((db) => {
      db.getAll('accounts').then((all) => {
        setAccounts(all.filter((a) => a.activa && a.status !== 'DELETED'));
      }).catch((err) => console.error('Error loading accounts:', err));
    }).catch((err) => console.error('Error initializing DB:', err));
  }, []);

  useEffect(() => {
    personalDataService.getPersonalData().then((data) => {
      if (data?.id) setPersonalDataId(data.id);
    }).catch((err) => console.error('Error loading personal data:', err));
  }, []);

  const loadExpenses = useCallback(async () => {
    if (!personalDataId) return;
    setLoading(true);
    try {
      const data = await personalExpensesService.getExpenses(personalDataId);
      setExpenses(data);
    } catch (error) {
      console.error('Error loading personal expenses:', error);
      toast.error('Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  }, [personalDataId]);

  useEffect(() => {
    if (personalDataId !== null) {
      loadExpenses();
    }
  }, [loadExpenses, personalDataId]);

  const getAccountName = (accountId?: number): string => {
    if (!accountId) return '—';
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return '—';
    if (acc.alias) return acc.alias;
    const iban = acc.iban ?? '';
    const last4 = iban.length >= 4 ? iban.slice(-4) : iban;
    if (acc.banco?.name) return `${acc.banco.name} ···${last4}`;
    return last4 ? `···${last4}` : '—';
  };

  const handleAddNew = () => {
    setEditingExpense(undefined);
    setShowForm(true);
  };

  const handleEdit = (expense: PersonalExpense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleDelete = async (expense: PersonalExpense) => {
    if (!expense.id) return;
    if (!window.confirm(`¿Eliminar el gasto "${expense.concepto}"?`)) return;
    try {
      await personalExpensesService.deleteExpense(expense.id);
      toast.success('Gasto eliminado');
      await loadExpenses();
    } catch {
      toast.error('Error al eliminar el gasto');
    }
  };

  const handleSave = async (
    formData: Omit<PersonalExpense, 'createdAt' | 'updatedAt'> & { id?: number }
  ) => {
    try {
      if (formData.id) {
        await personalExpensesService.updateExpense(formData.id, formData);
        toast.success('Gasto actualizado');
      } else {
        await personalExpensesService.saveExpense(formData);
        toast.success('Gasto creado');
      }
      setShowForm(false);
      setEditingExpense(undefined);
      await loadExpenses();
    } catch {
      toast.error('Error al guardar el gasto');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingExpense(undefined);
  };

  const monthlyTotal = expenses
    .filter((e) => e.activo)
    .reduce((sum, e) => sum + personalExpensesService.calcularImporteMensual(e), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-atlas-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Gasto mensual estimado:{' '}
            <span className="font-semibold text-gray-900">{formatEuro(monthlyTotal)}</span>
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-atlas-blue rounded-md hover:bg-atlas-blue/90"
        >
          <Plus className="h-4 w-4" />
          Añadir Gasto
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No hay gastos registrados.</p>
          <button
            onClick={handleAddNew}
            className="mt-3 text-sm text-atlas-blue hover:underline"
          >
            Añadir el primer gasto
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Concepto
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe/ciclo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frecuencia
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cuenta
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {expenses.map((expense) => {
                const Icon = CATEGORY_ICONS[expense.categoria] ?? MoreHorizontal;
                return (
                  <tr
                    key={expense.id}
                    className={`hover:bg-gray-50 transition-colors ${!expense.activo ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                        {CATEGORY_LABELS[expense.categoria] ?? expense.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{expense.concepto}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatEuro(expense.importe)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {FREQUENCY_LABELS[expense.frecuencia] ?? expense.frecuencia}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {getAccountName(expense.accountId)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="p-1 text-gray-400 hover:text-atlas-blue transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && personalDataId && (
        <PersonalExpenseForm
          personalDataId={personalDataId}
          expense={editingExpense}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default GastosManager;
