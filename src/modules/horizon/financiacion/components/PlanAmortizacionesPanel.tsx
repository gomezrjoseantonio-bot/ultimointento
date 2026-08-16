// ============================================================================
// Amortizar SIEMPRE, no una vez · la pantalla · §6 bis · quater
// ============================================================================
//
// El modal de al lado registra UNA operación: la del día que metes el dinero.
// Esto contesta a la otra pregunta, la que se hace antes de meterlo:
//
//   > Quiero meter 200 € todos los meses, y 3.000 € cada junio con la extra.
//   > ¿Cuándo acabo, y cuánto me ahorro de verdad?
//
// Aquí no se confirma nada. Un plan a diez años son ciento veinte operaciones
// que aún no han ocurrido, y darlas por hechas convertiría una intención en un
// saldo: ni movimiento de tesorería, ni cuadro guardado. Lo que ocurra de
// verdad se registra el día que ocurra, por la pestaña de al lado.
// ============================================================================

import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Prestamo } from '../../../../types/prestamos';
import {
  simulateLoanAmortizationPlan,
} from '../../../../services/loanSettlementService';
import type {
  ReglaDeAdelanto,
  SimulacionDelPlan,
} from '../../../../services/prestamos/planDeAdelantos';
import { comisionPactadaDe } from '../../../../services/prestamos/comisiones';
import { formatEuro, formatDate } from '../../../../utils/formatUtils';

interface Props {
  prestamo: Prestamo;
}

type Fin = 'FINAL' | 'FECHA' | 'VECES';

/** Una regla en la pantalla · el «hasta cuándo» se teclea de tres maneras. */
interface ReglaEditable extends ReglaDeAdelanto {
  fin: Fin;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const campo = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
const etiqueta = 'block text-xs font-medium text-gray-600 mb-1';

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

/** El primer día del mes que viene · una amortización se planifica hacia delante. */
const mesQueViene = (): string => {
  const [y, m] = hoyISO().split('-').map(Number);
  return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
};

let contador = 0;
const nuevaRegla = (): ReglaEditable => ({
  id: `regla-${++contador}`,
  cadencia: 'MENSUAL',
  importe: 200,
  desde: mesQueViene(),
  fin: 'FINAL',
});

const PlanAmortizacionesPanel: React.FC<Props> = ({ prestamo }) => {
  const [reglas, setReglas] = useState<ReglaEditable[]>([nuevaRegla()]);
  const [modo, setModo] = useState<'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'>('REDUCIR_PLAZO');
  const [cupoImporte, setCupoImporte] = useState('');
  const [cupoPorcentaje, setCupoPorcentaje] = useState('');
  const [cupoBase, setCupoBase] = useState<'ANIO_NATURAL' | 'ANUALIDAD'>('ANUALIDAD');
  const [gastosPorOperacion, setGastosPorOperacion] = useState('0');
  const [resultado, setResultado] = useState<{
    reducirPlazo: SimulacionDelPlan;
    reducirCuota: SimulacionDelPlan;
  } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const lista = useRef<HTMLDivElement>(null);

  // Un resumen calculado con otras cifras que las que hay en pantalla se lee
  // como el de ahora · es la misma razón por la que el modal de al lado limpia
  // su simulación al tocar cualquier campo.
  const invalidar = () => {
    setResultado(null);
    setVerTodos(false);
  };

  const cambiar = (id: string, cambios: Partial<ReglaEditable>) => {
    setReglas((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
    invalidar();
  };

  const quitar = (id: string) => {
    setReglas((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
    invalidar();
  };

  /** Lo que dice la escritura sobre la comisión · para avisar de si es estimada. */
  const comision = useMemo(() => comisionPactadaDe(prestamo, 'PARCIAL'), [prestamo]);

  const calcular = async () => {
    try {
      setCargando(true);
      setError('');

      const limpias: ReglaDeAdelanto[] = reglas.map(({ fin, ...r }) => ({
        ...r,
        importe: Number(r.importe) || 0,
        hasta: fin === 'FECHA' ? r.hasta : undefined,
        veces: fin === 'VECES' ? Number(r.veces) || undefined : undefined,
      }));

      const cupo = Number(cupoImporte) || 0;
      const pct = Number(cupoPorcentaje) || 0;

      setResultado(
        await simulateLoanAmortizationPlan({
          loanId: prestamo.id,
          reglas: limpias,
          gastosFijosPorOperacion: Number(gastosPorOperacion) || 0,
          limiteAnualExento:
            cupo > 0 || pct > 0
              ? { base: cupoBase, importe: cupo || undefined, porcentajeDelCapitalInicial: pct || undefined }
              : null,
        })
      );
      // El resultado aparece más abajo · sin esto hay que buscarlo a mano.
      setTimeout(() => lista.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'No se pudo simular el plan');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  };

  const elegido = resultado ? (modo === 'REDUCIR_PLAZO' ? resultado.reducirPlazo : resultado.reducirCuota) : null;

  return (
    <div className="space-y-6">
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
            onClick={() => {
              setReglas((prev) => [...prev, nuevaRegla()]);
              invalidar();
            }}
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
                  onChange={(e) => cambiar(r.id, { cadencia: e.target.value as ReglaDeAdelanto['cadencia'] })}
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
                  onChange={(e) => cambiar(r.id, { importe: Number(e.target.value) })}
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
                    onChange={(e) => cambiar(r.id, { cadaMeses: Number(e.target.value) })}
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
                    onChange={(e) => cambiar(r.id, { mes: Number(e.target.value) })}
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
                  onChange={(e) => cambiar(r.id, { desde: e.target.value })}
                  className={campo}
                  aria-label="Fecha de la primera amortización"
                />
              </div>

              {r.cadencia !== 'UNICA' && (
                <div>
                  <span className={etiqueta}>Hasta</span>
                  <select
                    value={r.fin}
                    onChange={(e) => cambiar(r.id, { fin: e.target.value as Fin })}
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
                    onChange={(e) => cambiar(r.id, { hasta: e.target.value })}
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
                    onChange={(e) => cambiar(r.id, { veces: Number(e.target.value) })}
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
                      onChange={(e) => cambiar(r.id, { crecimientoAnual: Number(e.target.value) })}
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
                  onClick={() => quitar(r.id)}
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

      {/* ── Lo que cuesta amortizar ─────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 p-4" style={{ backgroundColor: 'var(--bg)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
          Lo que cuesta amortizar
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {comision
            ? `Tu escritura cobra ${comision.tramos[0].porcentaje} % por amortización parcial${
                comision.origen === 'TOPE_LEGAL' ? ' (estimado por ATLAS · confírmalo en tu escritura)' : ''
              }.`
            : 'No hay comisión de amortización parcial pactada en este préstamo.'}{' '}
          Muchas escrituras dejan amortizar una cantidad al año sin comisión: si es tu caso, ponla
          aquí o el plan saldrá más caro de lo que es.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div>
            <span className={etiqueta}>Cupo exento al año</span>
            <input
              type="number"
              min="0"
              step="100"
              value={cupoImporte}
              onChange={(e) => {
                setCupoImporte(e.target.value);
                invalidar();
              }}
              placeholder="€ / año"
              className={campo}
              aria-label="Cupo anual exento de comisión en euros"
            />
          </div>
          <div>
            <span className={etiqueta}>…o % del capital</span>
            <input
              type="number"
              min="0"
              step="1"
              value={cupoPorcentaje}
              onChange={(e) => {
                setCupoPorcentaje(e.target.value);
                invalidar();
              }}
              placeholder="% concedido"
              className={campo}
              aria-label="Cupo anual exento como porcentaje del capital concedido"
            />
          </div>
          <div>
            <span className={etiqueta}>El año se cuenta</span>
            <select
              value={cupoBase}
              onChange={(e) => {
                setCupoBase(e.target.value as 'ANIO_NATURAL' | 'ANUALIDAD');
                invalidar();
              }}
              className={campo}
              aria-label="Base del año para el cupo exento"
            >
              <option value="ANUALIDAD">Desde la firma</option>
              <option value="ANIO_NATURAL">Año natural</option>
            </select>
          </div>
          <div>
            <span className={etiqueta}>Gastos por operación</span>
            <input
              type="number"
              min="0"
              step="1"
              value={gastosPorOperacion}
              onChange={(e) => {
                setGastosPorOperacion(e.target.value);
                invalidar();
              }}
              className={campo}
              aria-label="Gastos fijos por operación en euros"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Solo simulación · no genera movimientos ni cambia tu cuadro.
        </p>
        <button
          type="button"
          onClick={calcular}
          disabled={cargando}
          className="px-4 py-2 rounded-lg bg-atlas-blue text-white disabled:opacity-60"
        >
          {cargando ? 'Calculando…' : 'Simular plan'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* ── El resultado, por los dos caminos ───────────────────────────── */}
      <div ref={lista}>
        {resultado && elegido && (
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
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanAmortizacionesPanel;
