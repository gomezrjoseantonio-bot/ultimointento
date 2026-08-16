// ============================================================================
// Cuánto y cada cuánto · el editor de reglas
// ============================================================================
//
// Sale del panel porque el panel llegó a novecientas líneas y ahí dentro había
// tres cosas distintas: plantear la pregunta, escribir las reglas y leer el
// resultado. Esto es la de en medio, y es la única que el usuario TECLEA.
//
// Varias reglas a la vez no es un lujo: «200 €/mes **y** 3.000 € cada junio» es
// un caso corriente —el ahorro del mes por un lado y la paga extra por otro— y
// con una sola habría que elegir cuál se simula.
// ============================================================================

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ReglaDeAdelanto } from '../../../../services/prestamos/planDeAdelantos';
import { MESES, campo, etiqueta, type Fin, type ReglaEditable } from './planDeAmortizacionesUI';

interface Props {
  reglas: ReglaEditable[];
  onCambiar: (id: string, cambios: Partial<ReglaEditable>) => void;
  onQuitar: (id: string) => void;
  onAnadir: () => void;
}

const ReglasDelPlan: React.FC<Props> = ({ reglas, onCambiar, onQuitar, onAnadir }) => {
  return (
    <>
{/* ── Las reglas ──────────────────────────────────────────────────── */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
        Cuánto y cada cuánto
      </h3>
      <p className="text-sm text-gray-500 mt-1">
        Puedes combinar varias: el ahorro del mes por un lado y la paga extra por otro.
      </p>
    </div>
    <button
      type="button"
      onClick={onAnadir}
      className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700"
    >
      <Plus className="h-4 w-4" /> Añadir regla
    </button>
  </div>

  {reglas.map((r) => (
    <div key={r.id} className="rounded-xl border border-gray-200 p-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <span className={etiqueta}>Cada cuánto</span>
          <select
            value={r.cadencia}
            onChange={(e) => onCambiar(r.id, { cadencia: e.target.value as ReglaDeAdelanto['cadencia'] })}
            className={campo}
            aria-label="Periodicidad de la amortización"
          >
            <option value="MENSUAL">Todos los meses</option>
            <option value="CADA_N_MESES">Cada N meses</option>
            <option value="ANUAL">Una vez al año</option>
            <option value="UNICA">Una sola vez</option>
          </select>
        </div>

        <div>
          <span className={etiqueta}>Importe cada vez</span>
          <input
            type="number"
            min="0"
            step="50"
            value={r.importe}
            onChange={(e) => onCambiar(r.id, { importe: Number(e.target.value) })}
            className={campo}
            aria-label="Importe de cada amortización"
          />
        </div>

        {r.cadencia === 'CADA_N_MESES' && (
          <div>
            <span className={etiqueta}>Cada cuántos meses</span>
            <input
              type="number"
              min="1"
              max="60"
              value={r.cadaMeses ?? 3}
              onChange={(e) => onCambiar(r.id, { cadaMeses: Number(e.target.value) })}
              className={campo}
              aria-label="Número de meses entre amortizaciones"
            />
          </div>
        )}

        {r.cadencia === 'ANUAL' && (
          <div>
            <span className={etiqueta}>En qué mes</span>
            <select
              value={r.mes ?? 6}
              onChange={(e) => onCambiar(r.id, { mes: Number(e.target.value) })}
              className={campo}
              aria-label="Mes del año en que se amortiza"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <span className={etiqueta}>Desde</span>
          <input
            type="date"
            value={r.desde}
            onChange={(e) => onCambiar(r.id, { desde: e.target.value })}
            className={campo}
            aria-label="Fecha de la primera amortización"
          />
        </div>

        {r.cadencia !== 'UNICA' && (
          <div>
            <span className={etiqueta}>Hasta</span>
            <select
              value={r.fin}
              onChange={(e) => onCambiar(r.id, { fin: e.target.value as Fin })}
              className={campo}
              aria-label="Hasta cuándo se repite"
            >
              <option value="FINAL">El final del préstamo</option>
              <option value="FECHA">Una fecha</option>
              <option value="VECES">Un número de veces</option>
            </select>
          </div>
        )}

        {r.cadencia !== 'UNICA' && r.fin === 'FECHA' && (
          <div>
            <span className={etiqueta}>Fecha final</span>
            <input
              type="date"
              value={r.hasta ?? ''}
              onChange={(e) => onCambiar(r.id, { hasta: e.target.value })}
              className={campo}
              aria-label="Fecha de la última amortización"
            />
          </div>
        )}

        {r.cadencia !== 'UNICA' && r.fin === 'VECES' && (
          <div>
            <span className={etiqueta}>Cuántas veces</span>
            <input
              type="number"
              min="1"
              value={r.veces ?? 12}
              onChange={(e) => onCambiar(r.id, { veces: Number(e.target.value) })}
              className={campo}
              aria-label="Número de amortizaciones"
            />
          </div>
        )}

        {r.cadencia !== 'UNICA' && (
          <div>
            <span className={etiqueta}>Sube cada año</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                value={r.crecimientoAnual ?? 0}
                onChange={(e) => onCambiar(r.id, { crecimientoAnual: Number(e.target.value) })}
                className={campo}
                aria-label="Subida anual del importe en porcentaje"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        )}
      </div>

      {reglas.length > 1 && (
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={() => onQuitar(r.id)}
            className="flex items-center gap-1 text-sm text-red-600"
            aria-label="Quitar esta regla"
          >
            <Trash2 className="h-4 w-4" /> Quitar
          </button>
        </div>
      )}
    </div>
  ))}
</div>
    </>
  );
};

export default ReglasDelPlan;
