import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { PresupuestoLinea } from '../../../../../services/db';

interface BudgetTableEditorProps {
  lines: PresupuestoLinea[];
  scope: 'PERSONAL' | 'INMUEBLES' | 'CONSOLIDADO';
  readonly?: boolean;
  onLinesChange?: (lines: PresupuestoLinea[]) => void;
  onAddLine?: () => void;
}

interface EditCell {
  lineId: string;
  field: string;
  month?: number;
}

const BudgetTableEditor: React.FC<BudgetTableEditorProps> = ({
  lines,
  scope,
  readonly = false,
  onLinesChange,
  onAddLine
}) => {
  const [editingCell, setEditingCell] = useState<EditCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 
                     'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  // Income and expense lines
  const incomeLines = lines.filter(line => line.type === 'INGRESO');
  const expenseLines = lines.filter(line => line.type === 'COSTE');

  // Calculate monthly totals
  const monthlyIncomeTotals = new Array(12).fill(0);
  const monthlyExpenseTotals = new Array(12).fill(0);

  incomeLines.forEach(line => {
    line.amountByMonth.forEach((amount, month) => {
      monthlyIncomeTotals[month] += amount || 0;
    });
  });

  expenseLines.forEach(line => {
    line.amountByMonth.forEach((amount, month) => {
      monthlyExpenseTotals[month] += amount || 0;
    });
  });

  const monthlyNetTotals = monthlyIncomeTotals.map((income, month) => 
    income - monthlyExpenseTotals[month]
  );

  // Annual totals
  const annualIncomeTotal = monthlyIncomeTotals.reduce((sum, month) => sum + month, 0);
  const annualExpenseTotal = monthlyExpenseTotals.reduce((sum, month) => sum + month, 0);
  const annualNetTotal = annualIncomeTotal - annualExpenseTotal;

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (lineId: string, field: string, month?: number) => {
    if (readonly) return;
    
    const line = lines.find(l => l.id === lineId);
    if (!line) return;

    let value = '';
    if (field === 'label') {
      value = line.label || '';
    } else if (field === 'category') {
      value = line.category || '';
    } else if (field === 'subcategory') {
      value = line.subcategory || '';
    } else if (field === 'counterpartyName') {
      value = line.counterpartyName || '';
    } else if (field === 'amount' && month !== undefined) {
      value = (line.amountByMonth[month] || 0).toString();
    }

    setEditValue(value);
    setEditingCell({ lineId, field, month });
  };

  const handleCellSave = () => {
    if (!editingCell || !onLinesChange) return;

    const updatedLines = lines.map(line => {
      if (line.id !== editingCell.lineId) return line;

      const updates: Partial<PresupuestoLinea> = {};

      if (editingCell.field === 'label') {
        updates.label = editValue;
      } else if (editingCell.field === 'category') {
        updates.category = editValue;
      } else if (editingCell.field === 'subcategory') {
        updates.subcategory = editValue;
      } else if (editingCell.field === 'counterpartyName') {
        updates.counterpartyName = editValue;
      } else if (editingCell.field === 'amount' && editingCell.month !== undefined) {
        const newAmounts = [...line.amountByMonth];
        newAmounts[editingCell.month] = parseFloat(editValue) || 0;
        updates.amountByMonth = newAmounts;
      }

      return { ...line, ...updates };
    });

    onLinesChange(updatedLines);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellSave();
      // TODO: Move to next cell
    }
  };

  const handleDeleteLine = (lineId: string) => {
    if (!onLinesChange) return;
    const updatedLines = lines.filter(line => line.id !== lineId);
    onLinesChange(updatedLines);
  };

  const handleDuplicateLine = (lineId: string) => {
    if (!onLinesChange) return;
    const lineToClone = lines.find(line => line.id === lineId);
    if (!lineToClone) return;

    const newLine: PresupuestoLinea = {
      ...lineToClone,
      id: `temp-${Date.now()}`, // Temporary ID
      label: `${lineToClone.label} (copia)`,
      amountByMonth: [...lineToClone.amountByMonth]
    };

    onLinesChange([...lines, newLine]);
  };

  const formatEuro = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const renderEditableCell = (
    value: string | number,
    lineId: string,
    field: string,
    month?: number,
    className?: string
  ) => {
    const isEditing = editingCell?.lineId === lineId && 
                     editingCell?.field === field && 
                     editingCell?.month === month;

    if (isEditing) {
      return (
        <input
          ref={editInputRef}
          type={field === 'amount' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCellSave}
          onKeyDown={handleKeyDown}
          className={`w-full px-2 py-1 border-2 border-primary-500 rounded ${className || ''}`}
          step={field === 'amount' ? '0.01' : undefined}
        />
      );
    }

    return (
      <div
        onClick={() => handleCellClick(lineId, field, month)}
        className={`px-2 py-1 cursor-pointer min-h-[2rem] flex items-center ${className || ''}`}
      >
        {field === 'amount' ? formatEuro(Number(value)) : value || '—'}
      </div>
    );
  };

  const renderTableSection = (
    title: string,
    sectionLines: PresupuestoLinea[],
    monthlyTotals: number[]
  ) => (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      <div className="overflow-x-auto border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {!readonly && scope !== 'CONSOLIDADO' && 
                  <button
                    onClick={onAddLine}
                    className="p-1 text-primary-600 hover:text-primary-800"
                    title="Añadir fila"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                }
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">
                Tipo
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                Categoría
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                Subtipo
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-64">
                Descripción
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">
                Proveedor
              </th>
              {monthNames.map((month, index) => (
                <th key={month} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">
                  {month}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">
                Total
              </th>
              {!readonly && scope !== 'CONSOLIDADO' && (
                <th className="w-16 px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {sectionLines.map((line) => {
              const lineTotal = line.amountByMonth.reduce((sum, amount) => sum + (amount || 0), 0);
              
              return (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2">
                    {scope === 'CONSOLIDADO' && (
                      <span className={`inline-block w-3 h-3 ${
                        line.scope === 'PERSONAL' ? 'bg-primary-500' : 'bg-success-500'
                      }`} title={line.scope} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {renderEditableCell(line.type, line.id, 'type')}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {renderEditableCell(line.category, line.id, 'category')}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {renderEditableCell(line.subcategory || '', line.id, 'subcategory')}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {renderEditableCell(line.label, line.id, 'label')}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {renderEditableCell(line.counterpartyName || '', line.id, 'counterpartyName')}
                  </td>
                  {line.amountByMonth.map((amount, monthIndex) => (
                    <td key={monthIndex} className="px-2 py-2 text-sm text-right">
                      {renderEditableCell(
                        amount || 0, 
                        line.id, 
                        'amount', 
                        monthIndex,
                        'text-right'
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-sm text-right font-medium">
                    {formatEuro(lineTotal)}
                  </td>
                  {!readonly && scope !== 'CONSOLIDADO' && (
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleDuplicateLine(line.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Duplicar línea"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLine(line.id)}
                          className="p-1 text-gray-400 hover:text-error-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            
            {/* Monthly totals row */}
            <tr className="bg-gray-100 font-medium">
              <td colSpan={6} className="px-3 py-2 text-sm text-right">
                Total {title}:
              </td>
              {monthlyTotals.map((total, monthIndex) => (
                <td key={monthIndex} className="px-2 py-2 text-sm text-right font-bold">
                  {formatEuro(total)}
                </td>
              ))}
              <td className="px-3 py-2 text-sm text-right font-bold">
                {formatEuro(monthlyTotals.reduce((sum, month) => sum + month, 0))}
              </td>
              {!readonly && scope !== 'CONSOLIDADO' && (
                <td></td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Ingresos Section */}
      {renderTableSection('Ingresos', incomeLines, monthlyIncomeTotals)}
      
      {/* Costes Section */}
      {renderTableSection('Costes', expenseLines, monthlyExpenseTotals)}
      
      {/* Net Totals */}
      <div className="btn-secondary-horizon atlas-atlas-atlas-btn-primary ">
        <h3 className="text-lg font-semibold text-primary-900 mb-4">Resumen Neto</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-sm font-medium text-primary-800 px-3 py-2 w-48">
                  Concepto
                </th>
                {monthNames.map((month) => (
                  <th key={month} className="text-center text-sm font-medium text-primary-800 px-2 py-2 w-24">
                    {month}
                  </th>
                ))}
                <th className="text-center text-sm font-medium text-primary-800 px-3 py-2 w-24">
                  Total Anual
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 text-sm text-primary-900">Neto (Ingresos - Costes)</td>
                {monthlyNetTotals.map((net, monthIndex) => (
                  <td key={monthIndex} className={`px-2 py-2 text-sm text-center font-medium ${
                    net >= 0 ? 'text-success-600' : 'text-error-600'
                  }`}>
                    {formatEuro(net)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-sm text-center font-bold text-lg ${
                  annualNetTotal >= 0 ? 'text-success-600' : 'text-error-600'
                }`}>
                  {formatEuro(annualNetTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BudgetTableEditor;