import React from 'react';
import { ArrowRight, ArrowLeftRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';
import { traspasosPlanesService } from '../../../services/traspasosPlanesService';
import type { TraspasoPlan } from '../../../types/personal';

interface TraspasosHistorialProps {
  traspasos: TraspasoPlan[];
  onChanged: () => void;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y) return iso;
  return `${d ?? '01'}/${m ?? '01'}/${y}`;
};

const TraspasosHistorial: React.FC<TraspasosHistorialProps> = ({ traspasos, onChanged }) => {
  const handleDelete = async (t: TraspasoPlan) => {
    if (t.id === undefined) return;
    const confirmed = await confirmDelete(
      `este traspaso de ${formatCurrency(t.importe)} (${t.planOrigenNombre} → ${t.planDestinoNombre})`
    );
    if (!confirmed) return;

    try {
      await traspasosPlanesService.deleteTraspaso(t.id);
      toast.success('Traspaso anulado. Saldos restaurados.');
      onChanged();
    } catch (err) {
      console.error('Error anulando traspaso:', err);
      toast.error(err instanceof Error ? err.message : 'Error al anular el traspaso');
    }
  };

  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
        <h4 className="text-lg font-medium text-gray-900">Traspasos</h4>
      </div>

      {traspasos.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aún no has registrado ningún traspaso entre planes de pensiones.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {traspasos.map((t) => (
            <li key={t.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-medium text-gray-900">{t.planOrigenNombre}</span>
                  {t.planOrigenEntidad && (
                    <span className="text-xs text-gray-500">({t.planOrigenEntidad})</span>
                  )}
                  <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-900">{t.planDestinoNombre}</span>
                  {t.planDestinoEntidad && (
                    <span className="text-xs text-gray-500">({t.planDestinoEntidad})</span>
                  )}
                  {t.esTotal && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded">
                      Total
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {formatDate(t.fecha)} · {formatCurrency(t.importe)}
                  {t.notas && <span className="ml-1">· {t.notas}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(t)}
                className="p-2 text-gray-400 hover:text-error-600 flex-shrink-0"
                title="Anular traspaso y restaurar saldos"
                aria-label="Anular traspaso"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TraspasosHistorial;
