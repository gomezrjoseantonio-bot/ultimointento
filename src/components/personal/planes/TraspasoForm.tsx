// src/components/personal/planes/TraspasoForm.tsx
// TAREA 13 v4 · Commit 2 (D) · migrado a servicios V65.
//
// Antes: lectura mezcla planesInversionService (legacy) + inversiones[tipo IN
// PLAN_PENSIONES_TIPOS_INVERSION] + escritura traspasosPlanesService (V62 legacy).
//
// Ahora: lectura planesPensionesService (V65) + escritura
// traspasosPlanPensionesService.registrarTraspaso (que ejecuta los side-effects
// de §5.8 spec: actualizar plan + crear valoración histórica con valorTraspaso).

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { planesPensionesService } from '../../../services/planesPensionesService';
import { traspasosPlanPensionesService } from '../../../services/traspasosPlanPensionesService';
import type { PlanPensiones } from '../../../types/planesPensiones';

export interface PlanOrigenInput {
  id: string; // UUID estable de planesPensiones
  nombre: string;
  entidad?: string;
  saldo: number;
}

interface TraspasoFormProps {
  isOpen: boolean;
  onClose: () => void;
  personalDataId: number;
  planOrigen: PlanOrigenInput | null;
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
  const [destinos, setDestinos] = useState<PlanPensiones[]>([]);
  const [planDestinoId, setPlanDestinoId] = useState<string>('');
  const [gestoraDestinoManual, setGestoraDestinoManual] = useState<string>('');
  const [isinDestino, setIsinDestino] = useState<string>('');
  const [tipo, setTipo] = useState<'total' | 'parcial'>('total');
  const [importeTraspasado, setImporteTraspasado] = useState<string>('');
  const [valorTraspaso, setValorTraspaso] = useState<string>('');
  const [fechaSolicitud, setFechaSolicitud] = useState<string>('');
  const [fechaEjecucion, setFechaEjecucion] = useState<string>(today());
  const [notas, setNotas] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !planOrigen) return;
    setPlanDestinoId('');
    setGestoraDestinoManual('');
    setIsinDestino('');
    setTipo('total');
    setImporteTraspasado('');
    setValorTraspaso(planOrigen.saldo > 0 ? String(planOrigen.saldo) : '');
    setFechaSolicitud('');
    setFechaEjecucion(today());
    setNotas('');

    (async () => {
      try {
        const planes = await planesPensionesService.getAllPlanes({
          personalDataId,
          estado: 'activo',
        });
        // Excluir el propio plan origen del listado de destinos
        setDestinos(planes.filter((p) => p.id !== planOrigen.id));
      } catch (e) {
        console.error('[TraspasoForm] error cargando destinos:', e);
      }
    })();
  }, [isOpen, personalDataId, planOrigen]);

  if (!planOrigen) return null;

  const saldoOrigen = planOrigen.saldo;
  const planDestinoSeleccionado = destinos.find((d) => d.id === planDestinoId);
  const gestoraDestinoFinal =
    planDestinoSeleccionado?.gestoraActual ?? gestoraDestinoManual.trim();
  const isinDestinoFinal =
    planDestinoSeleccionado?.isinActual ?? (isinDestino.trim() || undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gestoraDestinoFinal) {
      toast.error('Indica la gestora destino (selecciona un plan o escríbela).');
      return;
    }
    const valorNum = parseFloat(valorTraspaso.replace(',', '.'));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      toast.error('Indica el valor del plan en el momento del traspaso.');
      return;
    }
    const importeNum =
      tipo === 'total' ? valorNum : parseFloat(importeTraspasado.replace(',', '.'));
    if (tipo === 'parcial' && (!Number.isFinite(importeNum) || importeNum <= 0)) {
      toast.error('Indica el importe a traspasar.');
      return;
    }

    setLoading(true);
    try {
      // Plan origen actual · necesario para snapshot de tipo y política
      const planOrigenActual = await planesPensionesService.getPlan(planOrigen.id);
      if (!planOrigenActual) {
        throw new Error(`Plan origen ${planOrigen.id} no encontrado`);
      }

      await traspasosPlanPensionesService.registrarTraspaso({
        planId: planOrigen.id,
        planIdDestino: planDestinoSeleccionado?.id,
        fechaSolicitud: fechaSolicitud || undefined,
        fechaEjecucion,
        gestoraOrigen: planOrigenActual.gestoraActual,
        gestoraDestino: gestoraDestinoFinal,
        isinOrigen: planOrigenActual.isinActual,
        isinDestino: isinDestinoFinal,
        valorTraspaso: valorNum,
        importeTraspasado: importeNum,
        esTotal: tipo === 'total',
        tipoAdministrativoOrigen: planOrigenActual.tipoAdministrativo,
        politicaInversionOrigen: planOrigenActual.politicaInversion,
        notas: notas.trim() || undefined,
      });

      toast.success(`Traspaso de ${formatCurrency(importeNum)} registrado correctamente.`);
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
          consume el límite anual de aportaciones deducibles. La identidad del
          plan se mantiene · solo cambia la gestora actual.
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plan origen</label>
          <div className="border rounded-md px-3 py-2 bg-gray-50 text-sm">
            <span className="font-medium">{planOrigen.nombre}</span>
            {planOrigen.entidad && <span className="text-gray-500"> · {planOrigen.entidad}</span>}
            <span className="block text-xs text-gray-600 mt-0.5">
              Saldo registrado: {formatCurrency(saldoOrigen)}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="planDestino" className="block text-sm font-medium text-gray-700 mb-1">
            Plan destino (opcional)
          </label>
          {destinos.length === 0 ? (
            <p className="text-xs text-gray-500 mb-1">
              No tienes otro plan registrado · escribe a mano la gestora destino.
            </p>
          ) : (
            <select
              id="planDestino"
              value={planDestinoId}
              onChange={(e) => setPlanDestinoId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm mb-2"
            >
              <option value="">— Manual (escribir gestora destino) —</option>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                  {d.gestoraActual ? ` (${d.gestoraActual})` : ''}
                </option>
              ))}
            </select>
          )}
          {!planDestinoSeleccionado && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={gestoraDestinoManual}
                onChange={(e) => setGestoraDestinoManual(e.target.value)}
                placeholder="Gestora destino *"
                className="border rounded-md px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                value={isinDestino}
                onChange={(e) => setIsinDestino(e.target.value)}
                placeholder="ISIN destino (opcional)"
                className="border rounded-md px-3 py-2 text-sm"
                maxLength={12}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de traspaso</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tipoTraspaso"
                value="total"
                checked={tipo === 'total'}
                onChange={() => setTipo('total')}
              />
              Total
            </label>
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
          </div>
        </div>

        <div>
          <label htmlFor="valorTraspaso" className="block text-sm font-medium text-gray-700 mb-1">
            Valor del plan en el momento del traspaso (€) *
          </label>
          <input
            id="valorTraspaso"
            type="number"
            step="0.01"
            min="0"
            value={valorTraspaso}
            onChange={(e) => setValorTraspaso(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="0,00"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Imprescindible para el cálculo de rentabilidad por bloque (cierra el
            bloque de la gestora origen y abre el de la destino).
          </p>
        </div>

        {tipo === 'parcial' && (
          <div>
            <label htmlFor="importeTraspasado" className="block text-sm font-medium text-gray-700 mb-1">
              Importe efectivo traspasado (€) *
            </label>
            <input
              id="importeTraspasado"
              type="number"
              step="0.01"
              min="0"
              max={saldoOrigen}
              value={importeTraspasado}
              onChange={(e) => setImporteTraspasado(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="0,00"
              required
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="fechaSolicitud" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha solicitud
            </label>
            <input
              id="fechaSolicitud"
              type="date"
              value={fechaSolicitud}
              onChange={(e) => setFechaSolicitud(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="fechaEjecucion" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha ejecución *
            </label>
            <input
              id="fechaEjecucion"
              type="date"
              value={fechaEjecucion}
              onChange={(e) => setFechaEjecucion(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />
          </div>
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
            disabled={loading}
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
