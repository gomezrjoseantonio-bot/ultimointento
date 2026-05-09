// D-CRUD-MEDIA sub-tarea 16 · pantalla gestión movement learning rules
// Sustituye el stub anterior. Lista las reglas implícitas aprendidas a partir
// de la conciliación bancaria y permite borrarlas individualmente.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import {
  listRules,
  deleteRule,
} from '../../../../services/movementLearningService';
import type { MovementLearningRule } from '../../../../services/db';
import ConfirmationModal from '../../../../components/common/ConfirmationModal';

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
};

const AutomatizacionesReglas: React.FC = () => {
  const [rules, setRules] = useState<MovementLearningRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<MovementLearningRule | null>(null);
  const [working, setWorking] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    listRules()
      .then(setRules)
      .catch((err) => {
        console.error('Error listando reglas de aprendizaje', err);
        toast.error('No se pudieron cargar las reglas');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (): Promise<void> => {
    if (!pendingDelete?.id) return;
    setWorking(true);
    try {
      await deleteRule(pendingDelete.id);
      toast.success('Regla eliminada');
      setPendingDelete(null);
      reload();
    } catch (err) {
      console.error('Error eliminando regla', err);
      toast.error('Error al eliminar la regla');
    } finally {
      setWorking(false);
    }
  };

  return (
    <PageLayout
      title="Automatizaciones · reglas de aprendizaje"
      subtitle="Reglas implícitas creadas al clasificar movimientos manualmente · se aplican a importaciones futuras"
    >
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Cargando reglas…</div>
        ) : rules.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500">Sin reglas configuradas</p>
            <p className="text-sm text-gray-400 mt-1">
              Las reglas se crean automáticamente al clasificar movimientos en Tesorería.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 text-xs uppercase tracking-wider">Contraparte</th>
                  <th className="py-2 pr-3 text-xs uppercase tracking-wider">Descripción</th>
                  <th className="py-2 pr-3 text-xs uppercase tracking-wider">Tipo</th>
                  <th className="py-2 pr-3 text-xs uppercase tracking-wider">Categoría</th>
                  <th className="py-2 pr-3 text-xs uppercase tracking-wider">Ámbito</th>
                  <th className="py-2 pr-3 text-xs uppercase tracking-wider text-right">Veces aplicada</th>
                  <th className="py-2 pr-3 text-xs uppercase tracking-wider">Última</th>
                  <th className="py-2 pr-3 text-xs uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-900">{r.counterpartyPattern || '—'}</td>
                    <td className="py-2 pr-3 text-gray-700 max-w-[260px] truncate" title={r.descriptionPattern}>
                      {r.descriptionPattern || '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">
                      {r.amountSign === 'positive' ? 'Ingreso' : 'Gasto'}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{r.categoria}</td>
                    <td className="py-2 pr-3 text-gray-600">{r.ambito}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium">{r.appliedCount}</td>
                    <td className="py-2 pr-3 text-gray-500 text-xs">{formatDate(r.lastAppliedAt)}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => setPendingDelete(r)}
                        aria-label={`Eliminar regla ${r.counterpartyPattern}`}
                        title="Eliminar regla"
                        className="inline-flex items-center justify-center p-1.5 rounded border border-transparent hover:border-gray-200 hover:bg-gray-50"
                        style={{ color: 'var(--s-neg, #b91c1c)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => { if (!working) setPendingDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar regla de aprendizaje"
        message={
          pendingDelete
            ? `Vas a eliminar la regla "${pendingDelete.counterpartyPattern || pendingDelete.descriptionPattern}" (categoría ${pendingDelete.categoria}, ${pendingDelete.appliedCount} aplicación(es)). Los movimientos ya clasificados conservan su categoría · futuras importaciones no la aplicarán. Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={working}
      />
    </PageLayout>
  );
};

export default AutomatizacionesReglas;
