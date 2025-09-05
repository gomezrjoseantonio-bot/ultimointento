import React from 'react';

interface MobileTableProps {
  data: any[];
  columns: {
    key: string;
    label: string;
    render?: (value: any, item: any) => React.ReactNode;
    className?: string;
    hideOnMobile?: boolean;
  }[];
  onRowClick?: (item: any) => void;
  className?: string;
}

const MobileTable: React.FC<MobileTableProps> = ({
  data,
  columns,
  onRowClick,
  className = ''
}) => {
  return (
    <div className={`overflow-hidden ${className}`}>
      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.className || ''
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr
                key={index}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 lg:px-6 py-4 whitespace-nowrap text-sm ${
                      column.className || ''
                    }`}
                  >
                    {column.render
                      ? column.render(item[column.key], item)
                      : item[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {data.map((item, index) => (
          <div
            key={index}
            onClick={() => onRowClick?.(item)}
            className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${
              onRowClick ? 'cursor-pointer active:bg-gray-50' : ''
            }`}
          >
            {columns
              .filter((column) => !column.hideOnMobile)
              .map((column) => (
                <div key={column.key} className="flex justify-between items-center mb-2 last:mb-0">
                  <span className="text-sm font-medium text-gray-600">
                    {column.label}:
                  </span>
                  <span className="text-sm text-gray-900 text-right">
                    {column.render
                      ? column.render(item[column.key], item)
                      : item[column.key]}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      )}
    </div>
  );
};

export default MobileTable;