// ============================================================================
// Qué pasa con tu préstamo · el resultado, por los dos caminos
// ============================================================================
//
// Reducir plazo y reducir cuota, en paralelo: es LA decisión que se toma en
// esta pantalla, y enseñarla de una en una obliga a apuntar la cifra anterior
// en un papel para compararla.
//
// Debajo, lo que el plan no pudo hacer. Un plan que se queda corto en silencio
// se lee como un plan que cabía.
// ============================================================================

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CardV5 } from '../../../../design-system/v5';
import type { Prestamo } from '../../../../types/prestamos';
import type { SimulacionDelPlan } from '../../../../services/prestamos/planDeAdelantos';
import { formatEuro, formatDate } from '../../../../utils/formatUtils';

interface Props {
  prestamo: Prestamo;
  resultado: { reducirPlazo: SimulacionDelPlan; reducirCuota: SimulacionDelPlan };
  elegido: SimulacionDelPlan;
  modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  setModo: (m: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA') => void;
  verTodos: boolean;
  setVerTodos: React.Dispatch<React.SetStateAction<boolean>>;
}

const ResultadoDelPlan: React.FC<Props> = ({
  prestamo,
  resultado,
  elegido,
  modo,
  setModo,
  verTodos,
  setVerTodos,
}) => (
  <div className="space-y-4">
    <div>
      <h3 className="font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
        Qué pasa con tu préstamo
      </h3>
      <p className="text-sm text-gray-500 mt-1">
        Comparado desde el {formatDate(elegido.desde)}. Elige qué le pides al banco que haga
        con lo que amortizas.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {(['REDUCIR_PLAZO', 'REDUCIR_CUOTA'] as const).map((m) => {
        const sim = m === 'REDUCIR_PLAZO' ? resultado.reducirPlazo : resultado.reducirCuota;
        const activo = modo === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={`rounded-2xl border p-5 text-left ${
              activo ? 'border-atlas-blue bg-primary-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="font-medium" style={{ color: 'var(--atlas-navy-1)' }}>
              {m === 'REDUCIR_PLAZO' ? 'Reducir plazo' : 'Reducir cuota'}
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Acabas de pagar</dt>
                <dd className="font-medium text-right">
                  {sim.fechaFinDespues ? formatDate(sim.fechaFinDespues) : '—'}
                  {sim.mesesGanados > 0 && (
                    <span className="text-gray-500"> · {sim.mesesGanados} meses antes</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Cuota dentro de un año</dt>
                <dd className="font-medium text-right">
                  {formatEuro(sim.antes.cuota)} → {formatEuro(sim.cuotaEnUnAnio)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Intereses que te ahorras</dt>
                <dd className="font-medium text-right">{formatEuro(sim.ahorroIntereses)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Comisiones y gastos</dt>
                <dd className="font-medium text-right">
                  −{formatEuro(sim.totalComisiones + sim.totalGastos)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-gray-200 pt-2">
                <dt className="text-gray-700 font-medium">Ahorro neto</dt>
                <dd className="font-semibold text-right" style={{ color: 'var(--atlas-navy-1)' }}>
                  {formatEuro(sim.ahorroNeto)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Capital que aportas</dt>
                <dd className="font-medium text-right">
                  {formatEuro(sim.totalAportado)}{' '}
                  <span className="text-gray-500">en {sim.adelantos.length} veces</span>
                </dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>

    {/* Un plan que se queda corto en silencio se lee como un plan que
        cabía · si algo no se pudo hacer, se dice. */}
    {elegido.avisos.length > 0 && (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
        {elegido.avisos.map((a) => (
          <div key={a} className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{a}</span>
          </div>
        ))}
      </div>
    )}

    {prestamo.inmuebleId && (
      <p className="text-xs text-gray-500">
        Este préstamo está vinculado a un inmueble: si lo tienes alquilado, los intereses que
        dejas de pagar también dejan de ser gasto deducible, así que el ahorro real en tu
        bolsillo es algo menor que el financiero.
      </p>
    )}

    {/* ── Las operaciones, una a una ────────────────────────────── */}
    <CardV5 className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Fecha</th>
              <th className="text-right px-4 py-2 font-medium">Amortizas</th>
              <th className="text-right px-4 py-2 font-medium">Sin comisión</th>
              <th className="text-right px-4 py-2 font-medium">Comisión</th>
              <th className="text-right px-4 py-2 font-medium">Sale de la cuenta</th>
              <th className="text-right px-4 py-2 font-medium">Queda vivo</th>
            </tr>
          </thead>
          <tbody>
            {(verTodos ? elegido.adelantos : elegido.adelantos.slice(0, 12)).map((a) => (
              <tr key={a.fecha} className="border-t border-gray-100">
                <td className="px-4 py-2">{formatDate(a.fecha)}</td>
                <td className="px-4 py-2 text-right">{formatEuro(a.aplicado)}</td>
                <td className="px-4 py-2 text-right text-gray-500">{formatEuro(a.exento)}</td>
                <td className="px-4 py-2 text-right">{formatEuro(a.comision)}</td>
                <td className="px-4 py-2 text-right">{formatEuro(a.salidaCaja)}</td>
                <td className="px-4 py-2 text-right">{formatEuro(a.principalDespues)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {elegido.adelantos.length > 12 && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          className="w-full px-4 py-3 text-sm text-center border-t border-gray-200 bg-gray-50 text-gray-700"
        >
          {verTodos
            ? 'Ver solo las 12 primeras'
            : `Ver las ${elegido.adelantos.length} operaciones del plan`}
        </button>
      )}
    </CardV5>
  </div>
);

export default ResultadoDelPlan;
