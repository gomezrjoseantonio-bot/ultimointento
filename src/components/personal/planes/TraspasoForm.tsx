import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { planesInversionService } from '../../../services/planesInversionService';
import { traspasosPlanesService } from '../../../services/traspasosPlanesService';
import type { PlanPensionInversion } from '../../../types/personal';

interface TraspasoFormProps {
  isOpen: boolean;
  onClose: () => void;
  personalDataId: number;
  planOrigen: PlanPensionInversion | null;
  onSaved: () => void;
}

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

const TraspasoForm: React.FC<TraspasoFormProps> = ({
  isOpen,
  onClose,
  personalDataId,
  planOrigen,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [planesDestinoCandidatos, setPlanesDestinoCandidatos] = useState<PlanPensionInversion[]>([]);
  const [planDestinoId, setPlanDestinoId] = useState<number | ''>('');
  const [tipo, setTipo] = useState<'total' | 'parcial'>('parcial');
  const [importe, setImporte] = useState<string>('');
  const [fecha, setFecha] = useState<string>(today());
  const [notas, setNotas] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !planOrigen) return;
    // Reset al abrir
    setPlanDestinoId('');
    setTipo('parcial');
    setImporte('');
    setFecha(today());
    setNotas('');

    (async () => {
      try {
        const todos = await planesInversionService.getPlanes(personalDataId);
        setPlanesDestinoCandidatos(
          todos.filter((p) => p.tipo === 'plan-pensiones' && p.id !== planOrigen.id)
        );
      } catch (e) {
        console.error('Error cargando planes destino:', e);
      }
    })();
  }, [isOpen, personalDataId, planOrigen]);

  if (!planOrigen) return null;

  const saldoOrigen = planOrigen.valorActual ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planDestinoId) {
      toast.error('Selecciona el plan de destino.');
      return;
    }
    const importeNum = tipo === 'total' ? saldoOrigen : parseFloat(importe.replace(',', '.'));
    if (tipo === 'parcial' && (!Number.isFinite(importeNum) || importeNum <= 0)) {
      toast.error('Indica un importe válido.');
      return;
    }

    setLoading(true);
    try {
      await traspasosPlanesService.createTraspaso({
        personalDataId,
        planOrigenId: planOrigen.id!,
        planDestinoId: Number(planDestinoId),
        fecha,
        importe: importeNum,
        esTotal: tipo === 'total',
        notas: notas.trim() || undefined,
      });
      toast.success(
        `Traspaso de ${formatCurrency(importeNum)} registrado correctamente.`
      );
      onSaved();
      onClose();
    } catch (err) {
      console.error('Error al crear traspaso:', err);
      toast.error(err instanceof Error ? err.message : 'Error al registrar el traspaso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={loading ? () => undefined : onClose}
      title="Traspaso de plan de pensiones"
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="rounded-md bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-900">
          Un traspaso entre planes de pensiones no tributa (art. 8.8 LRPFP) y no
          consume el límite anual de aportaciones deducibles. Se mantiene el
          histórico de valoraciones de cada plan por separado.
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plan origen</label>
          <div className="border rounded-md px-3 py-2 bg-gray-50 text-sm">
            <span className="font-medium">{planOrigen.nombre}</span>
            {planOrigen.entidad && <span className="text-gray-500"> · {planOrigen.entidad}</span>}
            <span className="block text-xs text-gray-600 mt-0.5">
              Saldo actual: {formatCurrency(saldoOrigen)}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="planDestino" className="block text-sm font-medium text-gray-700 mb-1">
            Plan destino *
          </label>
          {planesDestinoCandidatos.length === 0 ? (
            <p className="text-sm text-gray-500">
              No tienes otro plan de pensiones registrado. Crea primero el plan de destino
              (Personal → Planes → Nuevo Plan) y vuelve aquí.
            </p>
          ) : (
            <select
              id="planDestino"
              value={planDestinoId}
              onChange={(e) => setPlanDestinoId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            >
              <option value="">— Selecciona un plan —</option>
              {planesDestinoCandidatos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.entidad ? ` (${p.entidad})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de traspaso</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tipoTraspaso"
                value="parcial"
                checked={tipo === 'parcial'}
                onChange={() => setTipo('parcial')}
              />
              Parcial
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tipoTraspaso"
                value="total"
                checked={tipo === 'total'}
                onChange={() => setTipo('total')}
              />
              Total ({formatCurrency(saldoOrigen)})
            </label>
          </div>
        </div>

        {tipo === 'parcial' && (
          <div>
            <label htmlFor="importe" className="block text-sm font-medium text-gray-700 mb-1">
              Importe (€) *
            </label>
            <input
              id="importe"
              type="number"
              step="0.01"
              min="0"
              max={saldoOrigen}
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="0,00"
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="fechaTraspaso" className="block text-sm font-medium text-gray-700 mb-1">
            Fecha del traspaso *
          </label>
          <input
            id="fechaTraspaso"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="notasTraspaso" className="block text-sm font-medium text-gray-700 mb-1">
            Notas
          </label>
          <textarea
            id="notasTraspaso"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
            rows={2}
            placeholder="Opcional"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || planesDestinoCandidatos.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-navy rounded-md disabled:opacity-60"
          >
            {loading ? 'Registrando…' : 'Registrar traspaso'}
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default TraspasoForm;
