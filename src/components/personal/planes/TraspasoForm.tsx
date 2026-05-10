// src/components/personal/planes/TraspasoForm.tsx
// V65 · servicios canónicos.
//
// Lectura planesPensionesService + escritura traspasosPlanPensionesService.registrarTraspaso
// (que ejecuta los side-effects de §5.8 spec: actualizar plan + crear valoración
// histórica con valorTraspaso). El service legacy traspasosPlanesService quedó
// eliminado en D-CRUD-MEDIA sub-tarea 18.

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
  // Si se invoca desde la cabecera global ("Nuevo traspaso") · puede venir
  // null y el usuario escoge el plan origen dentro del formulario.
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
  const [planesActivos, setPlanesActivos] = useState<PlanPensiones[]>([]);
  // TAREA 13 lote B · sub-tarea 2 · cuando planOrigen viene null (entrada
  // por botón global "Nuevo traspaso"), el usuario selecciona el origen aquí.
  const [planOrigenSeleccionadoId, setPlanOrigenSeleccionadoId] = useState<string>('');
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
    if (!isOpen) return;
    setPlanOrigenSeleccionadoId('');
    setPlanDestinoId('');
    setGestoraDestinoManual('');
    setIsinDestino('');
    setTipo('total');
    setImporteTraspasado('');
    setValorTraspaso(planOrigen && planOrigen.saldo > 0 ? String(planOrigen.saldo) : '');
    setFechaSolicitud('');
    setFechaEjecucion(today());
    setNotas('');

    (async () => {
      try {
        const planes = await planesPensionesService.getAllPlanes({
          personalDataId,
          estado: 'activo',
        });
        setPlanesActivos(planes);
      } catch (e) {
        console.error('[TraspasoForm] error cargando planes:', e);
      }
    })();
  }, [isOpen, personalDataId, planOrigen]);

  if (!isOpen) return null;

  // Origen efectivo · si llega por prop se usa; si no, el seleccionado en el
  // selector interno (botón global "Nuevo traspaso").
  const planOrigenInternoSeleccionado = planesActivos.find(
    (p) => p.id === planOrigenSeleccionadoId,
  );
  const effectiveOrigen: PlanOrigenInput | null =
    planOrigen ??
    (planOrigenInternoSeleccionado
      ? {
          id: planOrigenInternoSeleccionado.id,
          nombre: planOrigenInternoSeleccionado.nombre,
          entidad: planOrigenInternoSeleccionado.gestoraActual,
          saldo: planOrigenInternoSeleccionado.valorActual ?? 0,
        }
      : null);

  const saldoOrigen = effectiveOrigen?.saldo ?? 0;
  const destinos = effectiveOrigen
    ? planesActivos.filter((p) => p.id !== effectiveOrigen.id)
    : planesActivos;
  const planDestinoSeleccionado = destinos.find((d) => d.id === planDestinoId);
  const gestoraDestinoFinal =
    planDestinoSeleccionado?.gestoraActual ?? gestoraDestinoManual.trim();
  const isinDestinoFinal =
    planDestinoSeleccionado?.isinActual ?? (isinDestino.trim() || undefined);

  // TAREA 13 lote B · sub-tarea 4 (C6) · validación en tiempo real ·
  // si hay error el botón "Registrar traspaso" queda deshabilitado y el
  // mensaje aparece inline. Cubre los 2 casos exigidos por el spec:
  //   · importeTraspasado ≤ valorTraspaso
  //   · importeTraspasado ≤ saldo origen del plan
  // (más coherencia básica: origen, gestora destino, valor > 0, margen 10 %).
  const valorNumLive = parseFloat(valorTraspaso.replace(',', '.'));
  const importeNumLive =
    tipo === 'total'
      ? valorNumLive
      : parseFloat(importeTraspasado.replace(',', '.'));

  let validationError: string | null = null;
  if (!effectiveOrigen) {
    validationError = 'Selecciona el plan origen.';
  } else if (!gestoraDestinoFinal) {
    validationError = 'Indica la gestora destino (selecciona un plan o escríbela).';
  } else if (!Number.isFinite(valorNumLive) || valorNumLive <= 0) {
    validationError = 'Indica el valor del plan en el momento del traspaso.';
  } else if (saldoOrigen > 0 && valorNumLive > saldoOrigen * 1.1) {
    validationError = `El valor del traspaso (${formatCurrency(valorNumLive)}) supera en >10 % el saldo registrado del plan (${formatCurrency(saldoOrigen)}). Actualiza la valoración del plan antes de registrar el traspaso.`;
  } else if (tipo === 'parcial') {
    if (!Number.isFinite(importeNumLive) || importeNumLive <= 0) {
      validationError = 'Indica el importe a traspasar.';
    } else if (importeNumLive > valorNumLive) {
      validationError = `El importe traspasado no puede superar el valor del traspaso (${formatCurrency(valorNumLive)} €).`;
    } else if (saldoOrigen > 0 && importeNumLive > saldoOrigen) {
      validationError = `El importe traspasado supera el saldo disponible del plan origen (${formatCurrency(saldoOrigen)} €).`;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError || !effectiveOrigen) {
      if (validationError) toast.error(validationError);
      return;
    }
    const valorNum = valorNumLive;
    const importeNum = importeNumLive;

    setLoading(true);
    try {
      // Plan origen actual · necesario para snapshot de tipo y política
      const planOrigenActual = await planesPensionesService.getPlan(effectiveOrigen.id);
      if (!planOrigenActual) {
        throw new Error(`Plan origen ${effectiveOrigen.id} no encontrado`);
      }

      await traspasosPlanPensionesService.registrarTraspaso({
        planId: effectiveOrigen.id,
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
          <label
            htmlFor={planOrigen ? undefined : 'planOrigenSelect'}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Plan origen{planOrigen ? '' : ' *'}
          </label>
          {planOrigen ? (
            <div className="border rounded-md px-3 py-2 bg-gray-50 text-sm">
              <span className="font-medium">{planOrigen.nombre}</span>
              {planOrigen.entidad && (
                <span className="text-gray-500"> · {planOrigen.entidad}</span>
              )}
              <span className="block text-xs text-gray-600 mt-0.5">
                Saldo registrado: {formatCurrency(saldoOrigen)}
              </span>
            </div>
          ) : planesActivos.length === 0 ? (
            <p className="text-xs text-gray-500">
              No tienes planes activos · crea un plan antes de registrar un traspaso.
            </p>
          ) : (
            <>
              <select
                id="planOrigenSelect"
                value={planOrigenSeleccionadoId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPlanOrigenSeleccionadoId(id);
                  // Pre-rellenar el valor del plan al seleccionar origen
                  const sel = planesActivos.find((p) => p.id === id);
                  setValorTraspaso(sel && (sel.valorActual ?? 0) > 0 ? String(sel.valorActual) : '');
                  // Si el destino coincide con el nuevo origen, limpiar
                  if (id === planDestinoId) setPlanDestinoId('');
                }}
                className="w-full border rounded-md px-3 py-2 text-sm"
                required
              >
                <option value="">— Selecciona el plan origen —</option>
                {planesActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.gestoraActual ? ` (${p.gestoraActual})` : ''}
                  </option>
                ))}
              </select>
              {effectiveOrigen && (
                <p className="text-xs text-gray-600 mt-1">
                  Saldo registrado: {formatCurrency(saldoOrigen)}
                </p>
              )}
            </>
          )}
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
              max={saldoOrigen > 0 ? saldoOrigen : undefined}
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

        {validationError && (
          <div
            role="alert"
            className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800"
          >
            {validationError}
          </div>
        )}

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
            disabled={loading || validationError !== null}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-navy rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Registrando…' : 'Registrar traspaso'}
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default TraspasoForm;
