import React from 'react';
import { Eye, Edit, Trash2 } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, item: any) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface Action {
  type: 'view' | 'edit' | 'delete' | 'custom';
  label: string;
  onClick: (item: any) => void;
  icon?: React.ReactNode;
  disabled?: (item: any) => boolean;
  className?: string;
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  actions?: Action[];
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  className?: string;
  showActions?: boolean;
}

const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  actions = [],
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  emptyIcon,
  onSort,
  sortKey,
  sortDirection,
  className = '',
  showActions = true
}) => {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'view':
        return <Eye className="h-4 w-4" />;
      case 'edit':
        return <Edit className="h-4 w-4" />;
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getActionClassName = (type: string) => {
    switch (type) {
      case 'view':
        return 'text-hz-info hover:text-primary-700';
      case 'edit':
        return 'hover:text-gray-700';
      case 'delete':
        return 'text-hz-error hover:text-error-700';
      default:
        return 'text-gray-600 hover:text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-50 border-b border-gray-200"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-gray-200 last:border-b-0"></div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="text-center py-12">
          {emptyIcon && <div className="mb-4 flex justify-center">{emptyIcon}</div>}
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.className || ''
                  } ${column.sortable && onSort ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                  onClick={() => {
                    if (column.sortable && onSort) {
                      const newDirection = sortKey === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
                      onSort(column.key, newDirection);
                    }
                  }}
                >
                  <div className="flex items-center">
                    {column.label}
                    {column.sortable && sortKey === column.key && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {showActions && actions.length > 0 && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td key={column.key} className={`px-6 py-4 whitespace-nowrap text-sm ${column.className || ''}`}>
                    {column.render ? column.render(item[column.key], item) : item[column.key]}
                  </td>
                ))}
                {showActions && actions.length > 0 && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      {actions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          onClick={() => action.onClick(item)}
                          disabled={action.disabled ? action.disabled(item) : false}
                          className={`p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            action.className || getActionClassName(action.type)
                          }`}
                          title={action.label}
                        >
                          {action.icon || getActionIcon(action.type)}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;