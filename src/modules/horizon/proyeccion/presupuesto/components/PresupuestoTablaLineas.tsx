import React from 'react';
import { Edit2, Trash2, Copy } from 'lucide-react';
import { PresupuestoLinea, UUID } from '../../../../../services/db';

interface PresupuestoTablaLineasProps {
  lineas: PresupuestoLinea[];
  onEdit: (linea: PresupuestoLinea) => void;
  onDelete: (lineaId: UUID) => void;
}

const PresupuestoTablaLineas: React.FC<PresupuestoTablaLineasProps> = ({
  lineas,
  onEdit,
  onDelete
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getOrigenBadgeColor = (origen: string) => {
    switch (origen) {
      case 'SemillaAuto':
        return 'bg-primary-100 text-primary-800';
      case 'ManualUsuario':
        return 'bg-success-100 text-success-800';
      case 'AjusteSistema':
        return 'bg-warning-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTipoColor = (tipo: string) => {
    return tipo === 'Ingreso' ? 'text-success-600' : 'text-error-600';
  };

  if (lineas.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No hay líneas de presupuesto. Usa "Sembrar" para generar automáticamente o "Añadir" para crear manualmente.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Inmueble
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Categoría
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Concepto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Frecuencia
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Importe
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cuenta
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vigencia
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Origen
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {lineas.map((linea) => (
            <tr key={linea.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`text-sm font-medium ${getTipoColor(linea.tipo || linea.type)}`}>
                  {linea.tipo || linea.type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {linea.inmuebleId ? (
                  <span>Inmueble {linea.inmuebleId.slice(-4)}</span>
                ) : (
                  <span className="text-gray-400">Global</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {linea.categoria}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {linea.tipoConcepto}
                {linea.proveedor && (
                  <div className="text-xs text-gray-500">
                    {linea.proveedor}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {linea.frecuencia}
                {linea.dayOfMonth && (
                  <div className="text-xs text-gray-500">
                    Día {linea.dayOfMonth}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {formatCurrency(linea.importeUnitario || 0)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {linea.cuentaId ? (
                  <span>Cuenta {linea.cuentaId.slice(-4)}</span>
                ) : (
                  <span className="text-error-500 text-xs">Pendiente</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div className="text-xs">
                  {linea.desde ? new Date(linea.desde).toLocaleDateString() : '01/01'} - 
                  {linea.hasta ? new Date(linea.hasta).toLocaleDateString() : '31/12'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrigenBadgeColor(linea.origen || 'ManualUsuario')}`}>
                  {linea.origen || 'Manual'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onEdit(linea)}
                    className="text-primary-600 hover:text-primary-900"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(linea, null, 2))}
                    className="text-gray-600 hover:text-gray-900"
                    title="Duplicar"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.// TODO: Replace with ATLAS confirmation modal
    // confirm('¿Estás seguro de que quieres eliminar esta línea?')) {
                        onDelete(linea.id);
                      }
                    }}
                    className="text-error-600 hover:text-error-900"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PresupuestoTablaLineas;