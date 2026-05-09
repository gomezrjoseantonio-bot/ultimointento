// src/components/personal/planes/TraspasosHistorial.tsx
// V65 · canónico traspasosPlanPensionesService.
//
// Lee `TraspasoPlanPensiones` del store V65. La identidad del plan es estable ·
// cada traspaso muestra "Plan · Gestora origen → Gestora destino".
//
// El servicio legacy `traspasosPlanesService` (sobre store legacy
// `traspasosPlanes`) fue eliminado en D-CRUD-MEDIA sub-tarea 18 al confirmar
// que no tenía consumidores reales (V65 ya migró el store al boot).

import React from 'react';
import { ArrowRight, ArrowLeftRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';
import {
  traspasosPlanPensionesService,
  valorTraspasoNormalizado,
} from '../../../services/traspasosPlanPensionesService';
import type { TraspasoPlanPensiones, PlanPensiones } from '../../../types/planesPensiones';

interface TraspasosHistorialProps {
  traspasos: TraspasoPlanPensiones[];
  planes: PlanPensiones[];
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

const TraspasosHistorial: React.FC<TraspasosHistorialProps> = ({ traspasos, planes, onChanged }) => {
  const planById = React.useMemo(() => {
    const m = new Map<string, PlanPensiones>();
    for (const p of planes) m.set(p.id, p);
    return m;
  }, [planes]);

  const handleDelete = async (t: TraspasoPlanPensiones) => {
    if (t.id === undefined) return;
    const plan = planById.get(t.planId);
    const planNombre = plan?.nombre ?? '(plan desconocido)';
    const importe = valorTraspasoNormalizado(t) ?? t.importeTraspasado;
    const confirmed = await confirmDelete(
      `este traspaso de ${formatCurrency(importe)} (${planNombre} · ${t.gestoraOrigen} → ${t.gestoraDestino})`,
    );
    if (!confirmed) return;

    try {
      await traspasosPlanPensionesService.eliminarTraspaso(t.id);
      toast.success('Traspaso eliminado del historial.');
      onChanged();
    } catch (err) {
      console.error('Error eliminando traspaso:', err);
      toast.error(err instanceof Error ? err.message : 'Error al eliminar el traspaso');
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
          Aún no has registrado ningún traspaso entre gestoras.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {traspasos.map((t) => {
            const plan = planById.get(t.planId);
            const planNombre = plan?.nombre ?? '(plan desconocido)';
            const importeMostrado = valorTraspasoNormalizado(t) ?? t.importeTraspasado;
            return (
              <li
                key={t.id ?? `${t.planId}-${t.fechaEjecucion}`}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-medium text-gray-900">{planNombre}</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-gray-700">{t.gestoraOrigen}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900">{t.gestoraDestino}</span>
                    {t.esTotal ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded">
                        Total
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                        Parcial
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {formatDate(t.fechaEjecucion)} · {formatCurrency(importeMostrado)}
                    {t.fechaSolicitud && t.fechaSolicitud !== t.fechaEjecucion && (
                      <span className="ml-1">· solicitado {formatDate(t.fechaSolicitud)}</span>
                    )}
                    {t.notas && <span className="ml-1">· {t.notas}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(t)}
                  className="p-2 text-gray-400 hover:text-error-600 flex-shrink-0"
                  title="Eliminar traspaso del historial"
                  aria-label="Eliminar traspaso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TraspasosHistorial;
