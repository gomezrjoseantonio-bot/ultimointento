import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { PresupuestoLinea, PlanningLayer } from '../../../../../services/db';

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
  const [activeLayer, setActiveLayer] = useState<PlanningLayer>('FORECAST');
  const editInputRef = useRef<HTMLInputElement>(null);

  const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
    'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const getAmountsByLayer = (line: PresupuestoLinea, layer: PlanningLayer): number[] => {
    let base: number[] | undefined;
    if (layer === 'LRP') base = line.lrpAmountByMonth;
    if (layer === 'BUDGET') base = line.planAmountByMonth;
    if (layer === 'FORECAST') base = line.forecastAmountByMonth || line.amountByMonth;
    if (layer === 'ACTUAL') base = line.actualAmountByMonth;

    const normalized = new Array(12).fill(0);
    const source = base || [];
    for (let i = 0; i < Math.min(source.length, 12); i += 1) {
      normalized[i] = Number(source[i] || 0);
    }
    return normalized;
  };

  const getEditableAmounts = (line: PresupuestoLinea): number[] => getAmountsByLayer(line, activeLayer);

  const getLineCertidumbre = (line: PresupuestoLinea, monthIndex: number): string | null => {
    return line.statusCertidumbreByMonth?.[monthIndex] || null;
  };

  const incomeLines = lines.filter(line => line.type === 'INGRESO');
  const expenseLines = lines.filter(line => line.type === 'COSTE');

  const monthlyIncomeTotals = new Array(12).fill(0);
  const monthlyExpenseTotals = new Array(12).fill(0);

  incomeLines.forEach(line => {
    getEditableAmounts(line).forEach((amount, month) => {
      monthlyIncomeTotals[month] += amount || 0;
    });
  });

  expenseLines.forEach(line => {
    getEditableAmounts(line).forEach((amount, month) => {
      monthlyExpenseTotals[month] += amount || 0;
    });
  });

  const monthlyNetTotals = monthlyIncomeTotals.map((income, month) =>
    income - monthlyExpenseTotals[month]
  );

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
      value = (getEditableAmounts(line)[month] || 0).toString();
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
        const newAmounts = [...getEditableAmounts(line)];
        newAmounts[editingCell.month] = parseFloat(editValue) || 0;

        if (activeLayer === 'LRP') updates.lrpAmountByMonth = newAmounts;
        if (activeLayer === 'BUDGET') updates.planAmountByMonth = newAmounts;
        if (activeLayer === 'FORECAST') {
          updates.forecastAmountByMonth = newAmounts;
          updates.amountByMonth = newAmounts;
        }
        if (activeLayer === 'ACTUAL') updates.actualAmountByMonth = newAmounts;
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
      id: `temp-${Date.now()}`,
      label: `${lineToClone.label} (copia)`,
      amountByMonth: [...getAmountsByLayer(lineToClone, 'FORECAST')],
      forecastAmountByMonth: [...getAmountsByLayer(lineToClone, 'FORECAST')],
      lrpAmountByMonth: lineToClone.lrpAmountByMonth ? [...lineToClone.lrpAmountByMonth] : undefined,
      planAmountByMonth: lineToClone.planAmountByMonth ? [...lineToClone.planAmountByMonth] : undefined,
      actualAmountByMonth: lineToClone.actualAmountByMonth ? [...lineToClone.actualAmountByMonth] : undefined,
      statusCertidumbreByMonth: lineToClone.statusCertidumbreByMonth ? [...lineToClone.statusCertidumbreByMonth] : undefined
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
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">Tipo</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Categoría</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Subtipo</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-64">Descripción</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">Proveedor</th>
              {monthNames.map((month) => (
                <th key={month} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">{month}</th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">Total</th>
              {!readonly && scope !== 'CONSOLIDADO' && (
                <th className="w-16 px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {sectionLines.map((line) => {
              const displayAmounts = getEditableAmounts(line);
              const lineTotal = displayAmounts.reduce((sum, amount) => sum + (amount || 0), 0);

              return (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2">
                    {scope === 'CONSOLIDADO' && (
                      <span className={`inline-block w-3 h-3 ${line.scope === 'PERSONAL' ? 'bg-primary-500' : 'bg-success-500'}`} title={line.scope} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm">{renderEditableCell(line.type, line.id, 'type')}</td>
                  <td className="px-3 py-2 text-sm">{renderEditableCell(line.category, line.id, 'category')}</td>
                  <td className="px-3 py-2 text-sm">{renderEditableCell(line.subcategory || '', line.id, 'subcategory')}</td>
                  <td className="px-3 py-2 text-sm">{renderEditableCell(line.label, line.id, 'label')}</td>
                  <td className="px-3 py-2 text-sm">{renderEditableCell(line.counterpartyName || '', line.id, 'counterpartyName')}</td>
                  {displayAmounts.map((amount, monthIndex) => (
                    <td key={monthIndex} className="px-2 py-2 text-sm text-right">
                      <div className="flex flex-col items-end">
                        {renderEditableCell(amount || 0, line.id, 'amount', monthIndex, 'text-right')}
                        {activeLayer === 'FORECAST' && getLineCertidumbre(line, monthIndex) && (
                          <span className="text-[10px] uppercase text-gray-500">{getLineCertidumbre(line, monthIndex)}</span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-sm text-right font-medium">{formatEuro(lineTotal)}</td>
                  {!readonly && scope !== 'CONSOLIDADO' && (
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button onClick={() => handleDuplicateLine(line.id)} className="p-1 text-gray-400 hover:text-gray-600" title="Duplicar línea">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteLine(line.id)} className="p-1 text-gray-400 hover:text-error-600" title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            <tr className="bg-gray-100 font-medium">
              <td colSpan={6} className="px-3 py-2 text-sm text-right">Total {title}:</td>
              {monthlyTotals.map((total, monthIndex) => (
                <td key={monthIndex} className="px-2 py-2 text-sm text-right font-bold">{formatEuro(total)}</td>
              ))}
              <td className="px-3 py-2 text-sm text-right font-bold">{formatEuro(monthlyTotals.reduce((sum, month) => sum + month, 0))}</td>
              {!readonly && scope !== 'CONSOLIDADO' && <td></td>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs text-gray-500">
          Estás editando la capa <strong>{activeLayer}</strong>.
        </div>
        <div className="flex items-center gap-2">
          {(['LRP', 'BUDGET', 'FORECAST', 'ACTUAL'] as PlanningLayer[]).map(layer => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`px-3 py-1 text-xs border ${activeLayer === layer ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              {layer}
            </button>
          ))}
        </div>
      </div>

      {renderTableSection('Ingresos', incomeLines, monthlyIncomeTotals)}
      {renderTableSection('Costes', expenseLines, monthlyExpenseTotals)}

      <div className="btn-secondary-horizon atlas-atlas-atlas-atlas-atlas-btn-primary ">
        <h3 className="text-lg font-semibold text-primary-900 mb-4">Resumen Neto ({activeLayer})</h3>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-sm font-medium text-primary-800 px-3 py-2 w-48">Concepto</th>
                {monthNames.map((month) => (
                  <th key={month} className="text-center text-sm font-medium text-primary-800 px-2 py-2 w-24">{month}</th>
                ))}
                <th className="text-center text-sm font-medium text-primary-800 px-3 py-2 w-24">Total Anual</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 text-sm text-primary-900">Neto (Ingresos - Costes)</td>
                {monthlyNetTotals.map((net, monthIndex) => (
                  <td key={monthIndex} className={`px-2 py-2 text-sm text-center font-medium ${net >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                    {formatEuro(net)}
                  </td>
                ))}
                <td className={`px-3 py-2 text-sm text-center font-bold text-lg ${annualNetTotal >= 0 ? 'text-success-600' : 'text-error-600'}`}>
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
