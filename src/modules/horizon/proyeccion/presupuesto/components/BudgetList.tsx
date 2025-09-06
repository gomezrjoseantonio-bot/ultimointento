import React from 'react';
import { FileText, Calendar, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react';
import { Budget } from '../../../../../services/db';
import { formatEuro } from '../../../../../utils/formatUtils';

interface BudgetListProps {
  budgets: Budget[];
  onRefresh: () => void;
}

const BudgetList: React.FC<BudgetListProps> = ({ budgets, onRefresh }) => {
  const handleViewBudget = (budget: Budget) => {
    // TODO: Implement budget view
    console.log('View budget', budget);
  };

  const handleEditBudget = (budget: Budget) => {
    // TODO: Implement budget edit
    console.log('Edit budget', budget);
  };

  const handleDeleteBudget = (budget: Budget) => {
    // TODO: Implement budget delete with confirmation
    console.log('Delete budget', budget);
  };

  const getStatusColor = (status: Budget['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-warning-100 text-yellow-800';
      case 'confirmed':
        return 'bg-success-100 text-success-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Presupuestos Existentes</h3>
        <p className="text-sm text-gray-600">Gestiona tus presupuestos anuales y versiones</p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {budgets.map((budget) => (
          <div key={budget.id} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-primary-100 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-primary-600" />
                </div>
                
                <div>
                  <div className="flex items-center space-x-3">
                    <h4 className="font-semibold text-gray-900">{budget.name}</h4>
                    <span className="text-sm text-gray-500">{budget.version}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                      {budget.status === 'draft' ? 'Borrador' : 'Confirmado'}
                    </span>
                    {budget.isLocked && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Bloqueado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {budget.year}
                    </span>
                    <span>{budget.scope.propertyIds.length} inmuebles</span>
                    <span>
                      Creado: {new Date(budget.createdAt).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatEuro(budget.totals.annualIncome - budget.totals.annualExpenses)}
                  </div>
                  <div className="text-xs text-gray-500">Resultado anual</div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-success-600 font-medium">
                    {formatEuro(budget.totals.annualIncome)}
                  </div>
                  <div className="text-xs text-gray-500">Ingresos</div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-error-600 font-medium">
                    {formatEuro(budget.totals.annualExpenses)}
                  </div>
                  <div className="text-xs text-gray-500">Gastos</div>
                </div>
                
                <div className="relative">
                  <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  {/* TODO: Implement dropdown menu */}
                  <div className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => handleViewBudget(budget)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        <Eye className="h-4 w-4 mr-3" />
                        Ver detalle
                      </button>
                      {!budget.isLocked && (
                        <button
                          onClick={() => handleEditBudget(budget)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                          <Edit className="h-4 w-4 mr-3" />
                          Editar
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBudget(budget)}
                        className="flex items-center px-4 py-2 text-sm text-error-600 hover:bg-error-50 w-full text-left"
                      >
                        <Trash2 className="h-4 w-4 mr-3" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BudgetList;