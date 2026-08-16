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
// saldo: no se toca el cuadro ni se apunta ningún movimiento. Lo que ocurra de
// verdad se registra el día que ocurra, por la pestaña de al lado.
//
// El plan SÍ se puede guardar, y entonces salen previsiones de tesorería — pero
// `predicted`, que es lo que son: dinero que va a salir, no que ha salido. Sin
// ellas la tesorería diría que en junio salen 455 € cuando su dueño ya ha
// decidido que salen 3.655, y el aviso de saldo corto llegaría tarde.
// ============================================================================

import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Prestamo } from '../../../../types/prestamos';
import {
  saveLoanAmortizationPlan,
  simulateLoanAmortizationPlan,
  solveLoanAmortizationTarget,
} from '../../../../services/loanSettlementService';
import type {
  Cadencia,
  ReglaDeAdelanto,
  SimulacionDelPlan,
  SolucionDelObjetivo,
} from '../../../../services/prestamos/planDeAdelantos';
import { comisionPactadaDe } from '../../../../services/prestamos/comisiones';
import { formatEuro, formatDate } from '../../../../utils/formatUtils';
import { CardV5 } from '../../../../design-system/v5';
import ReglasDelPlan from './ReglasDelPlan';
import ResultadoDelPlan from './ResultadoDelPlan';
import { MESES, campo, etiqueta, type ReglaEditable } from './planDeAmortizacionesUI';

interface Props {
  prestamo: Prestamo;
}

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

/**
 * Una regla guardada, lista para editarse.
 *
 * El «hasta cuándo» se guarda como lo que es —una fecha o un número de veces— y
 * en pantalla es un desplegable, así que al abrir hay que deducir cuál de los
 * tres estaba puesto.
 */
const comoEditable = (r: ReglaDeAdelanto): ReglaEditable => ({
  ...r,
  fin: r.hasta ? 'FECHA' : r.veces ? 'VECES' : 'FINAL',
});

/**
 * Las dos maneras de plantear lo mismo.
 *
 * `IMPORTE` es «puedo meter 200 € al mes, ¿hasta dónde llego?» · `FECHA` es
 * «quiero acabar en 2032, ¿cuánto tengo que meter?». La segunda no se puede
 * contestar a ojo con la primera: son diez simulaciones apuntando resultados en
 * un papel, y es justo lo que la pantalla puede hacer por su cuenta.
 */
type Planteamiento = 'IMPORTE' | 'FECHA';

/** Dentro de N años, para proponer una fecha objetivo que no sea hoy. */
const dentroDeAnios = (n: number): string => {
  const [y, m, d] = hoyISO().split('-');
  return `${Number(y) + n}-${m}-${d}`;
};

const PlanAmortizacionesPanel: React.FC<Props> = ({ prestamo }) => {
  // Lo guardado manda al abrir · si no hay nada, una regla de ejemplo.
  const previo = prestamo.planDeAmortizaciones;

  const [reglas, setReglas] = useState<ReglaEditable[]>(
    previo?.reglas?.length ? previo.reglas.map(comoEditable) : [nuevaRegla()]
  );
  const [modo, setModo] = useState<'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'>(previo?.modo ?? 'REDUCIR_PLAZO');
  const [cupoImporte, setCupoImporte] = useState(
    previo?.limiteAnualExento?.importe ? String(previo.limiteAnualExento.importe) : ''
  );
  const [cupoPorcentaje, setCupoPorcentaje] = useState(
    previo?.limiteAnualExento?.porcentajeDelCapitalInicial
      ? String(previo.limiteAnualExento.porcentajeDelCapitalInicial)
      : ''
  );
  const [cupoBase, setCupoBase] = useState<'ANIO_NATURAL' | 'ANUALIDAD'>(
    previo?.limiteAnualExento?.base ?? 'ANUALIDAD'
  );
  const [gastosPorOperacion, setGastosPorOperacion] = useState(
    String(previo?.gastosFijosPorOperacion ?? 0)
  );
  const [resultado, setResultado] = useState<{
    reducirPlazo: SimulacionDelPlan;
    reducirCuota: SimulacionDelPlan;
  } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const lista = useRef<HTMLDivElement>(null);

  // ── Guardar el plan · lo que su dueño dice que va a hacer ────────────────
  const [generaPrevisiones, setGeneraPrevisiones] = useState(
    prestamo.planDeAmortizaciones?.generaPrevisiones ?? false
  );
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState('');

  // ── El planteamiento · «cuánto meto» o «cuándo quiero acabar» ────────────
  const [planteamiento, setPlanteamiento] = useState<Planteamiento>('IMPORTE');
  const [fechaObjetivo, setFechaObjetivo] = useState(dentroDeAnios(10));
  const [cadenciaObjetivo, setCadenciaObjetivo] = useState<Cadencia>('MENSUAL');
  const [mesObjetivo, setMesObjetivo] = useState(6);
  const [solucion, setSolucion] = useState<SolucionDelObjetivo | null>(null);

  // Un resumen calculado con otras cifras que las que hay en pantalla se lee
  // como el de ahora · es la misma razón por la que el modal de al lado limpia
  // su simulación al tocar cualquier campo.
  const invalidar = () => {
    setResultado(null);
    setSolucion(null);
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

  /** El cupo tal como lo entiende el motor · `null` si no se ha puesto ninguno. */
  const cupoDeLaEscritura = () => {
    const cupo = Number(cupoImporte) || 0;
    const pct = Number(cupoPorcentaje) || 0;
    return cupo > 0 || pct > 0
      ? { base: cupoBase, importe: cupo || undefined, porcentajeDelCapitalInicial: pct || undefined }
      : null;
  };

  const calcular = async () => {
    try {
      setCargando(true);
      setError('');

      setResultado(
        await simulateLoanAmortizationPlan({
          loanId: prestamo.id,
          reglas: reglasLimpias(),
          gastosFijosPorOperacion: Number(gastosPorOperacion) || 0,
          limiteAnualExento: cupoDeLaEscritura(),
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

  /**
   * La pregunta al revés · se resuelve buscando sobre el mismo motor.
   *
   * El resultado se vuelca en las reglas de arriba: quien pregunta «¿cuánto
   * meto?» quiere después tocar la cifra a mano y ver qué pasa, y dejarla en un
   * cuadro aparte obligaría a copiarla. Así la respuesta es el punto de partida.
   */
  const resolverObjetivo = async () => {
    try {
      setCargando(true);
      setError('');

      const sol = await solveLoanAmortizationTarget({
        loanId: prestamo.id,
        objetivo: {
          fechaObjetivo,
          cadencia: cadenciaObjetivo,
          desde: reglas[0]?.desde || mesQueViene(),
          mes: cadenciaObjetivo === 'ANUAL' ? mesObjetivo : undefined,
          cadaMeses: cadenciaObjetivo === 'CADA_N_MESES' ? reglas[0]?.cadaMeses ?? 3 : undefined,
        },
        gastosFijosPorOperacion: Number(gastosPorOperacion) || 0,
        limiteAnualExento: cupoDeLaEscritura(),
      });

      setSolucion(sol);
      setResultado(null);

      // Sin fecha alcanzable no hay cifra que copiar: dejarla arriba haría creer
      // que ese importe llega, que es justo lo que el motor acaba de negar.
      if (sol.alcanzado && sol.importe > 0) {
        setReglas([
          {
            id: `regla-${++contador}`,
            cadencia: cadenciaObjetivo,
            importe: sol.importe,
            desde: reglas[0]?.desde || mesQueViene(),
            mes: cadenciaObjetivo === 'ANUAL' ? mesObjetivo : undefined,
            cadaMeses: cadenciaObjetivo === 'CADA_N_MESES' ? reglas[0]?.cadaMeses ?? 3 : undefined,
            fin: 'FINAL',
          },
        ]);
      }
      setTimeout(() => lista.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'No se pudo calcular el importe');
      setSolucion(null);
    } finally {
      setCargando(false);
    }
  };

  /** Las reglas tal como se guardan · sin el «fin» de la pantalla. */
  const reglasLimpias = (): ReglaDeAdelanto[] =>
    reglas
      .map(({ fin, ...r }) => ({
        ...r,
        importe: Number(r.importe) || 0,
        hasta: fin === 'FECHA' ? r.hasta : undefined,
        veces: fin === 'VECES' ? Number(r.veces) || undefined : undefined,
      }))
      .filter((r) => r.importe > 0 && !!r.desde);

  const guardar = async () => {
    try {
      setGuardando(true);
      setError('');
      const limpias = reglasLimpias();
      if (limpias.length === 0) {
        setError('Añade al menos una regla con importe y fecha antes de guardar');
        return;
      }

      const { emitidas } = await saveLoanAmortizationPlan(prestamo.id, {
        reglas: limpias,
        modo,
        limiteAnualExento: cupoDeLaEscritura(),
        gastosFijosPorOperacion: Number(gastosPorOperacion) || 0,
        generaPrevisiones,
      });

      setGuardado(
        generaPrevisiones
          ? `Plan guardado · ${emitidas} ${emitidas === 1 ? 'previsión' : 'previsiones'} en tesorería`
          : 'Plan guardado'
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'No se pudo guardar el plan');
    } finally {
      setGuardando(false);
    }
  };

  const borrarPlan = async () => {
    try {
      setGuardando(true);
      setError('');
      await saveLoanAmortizationPlan(prestamo.id, null);
      setGeneraPrevisiones(false);
      setGuardado('Plan borrado · sus previsiones pendientes también');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'No se pudo borrar el plan');
    } finally {
      setGuardando(false);
    }
  };

  const elegido = resultado ? (modo === 'REDUCIR_PLAZO' ? resultado.reducirPlazo : resultado.reducirCuota) : null;

  return (
    <div className="space-y-6">
      {/* ── El planteamiento · las dos maneras de plantear lo mismo ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setPlanteamiento('IMPORTE');
            invalidar();
          }}
          className={`rounded-xl border p-4 text-left ${
            planteamiento === 'IMPORTE' ? 'border-atlas-blue bg-primary-50' : 'border-gray-200'
          }`}
        >
          <div className="font-medium">Sé cuánto puedo meter</div>
          <div className="text-sm text-gray-500 mt-1">200 € al mes · ¿hasta dónde llego?</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setPlanteamiento('FECHA');
            invalidar();
          }}
          className={`rounded-xl border p-4 text-left ${
            planteamiento === 'FECHA' ? 'border-atlas-blue bg-primary-50' : 'border-gray-200'
          }`}
        >
          <div className="font-medium">Sé cuándo quiero acabar</div>
          <div className="text-sm text-gray-500 mt-1">En 2036 · ¿cuánto tengo que meter?</div>
        </button>
      </div>

      {planteamiento === 'FECHA' && (
        <CardV5>
          <CardV5.Body className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className={etiqueta}>Quiero acabar antes de</span>
              <input
                type="date"
                value={fechaObjetivo}
                onChange={(e) => {
                  setFechaObjetivo(e.target.value);
                  invalidar();
                }}
                className={campo}
                aria-label="Fecha en la que quieres terminar de pagar"
              />
            </div>
            <div>
              <span className={etiqueta}>Metiendo dinero</span>
              <select
                value={cadenciaObjetivo}
                onChange={(e) => {
                  setCadenciaObjetivo(e.target.value as Cadencia);
                  invalidar();
                }}
                className={campo}
                aria-label="Con qué periodicidad puedes amortizar"
              >
                <option value="MENSUAL">Todos los meses</option>
                <option value="CADA_N_MESES">Cada N meses</option>
                <option value="ANUAL">Una vez al año</option>
              </select>
            </div>
            {cadenciaObjetivo === 'ANUAL' && (
              <div>
                <span className={etiqueta}>En qué mes</span>
                <select
                  value={mesObjetivo}
                  onChange={(e) => {
                    setMesObjetivo(Number(e.target.value));
                    invalidar();
                  }}
                  className={campo}
                  aria-label="Mes del año en que amortizas"
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <button
                type="button"
                onClick={resolverObjetivo}
                disabled={cargando}
                className="w-full px-4 py-2 rounded-lg bg-atlas-blue text-white disabled:opacity-60"
              >
                {cargando ? 'Buscando…' : 'Calcular importe'}
              </button>
            </div>
          </div>

          {solucion && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                solucion.alcanzado
                  ? 'border-gray-200 bg-white'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {solucion.alcanzado && solucion.importe > 0 ? (
                <>
                  <span className="text-gray-500">Tendrías que amortizar </span>
                  <strong style={{ color: 'var(--atlas-navy-1)' }}>
                    {formatEuro(solucion.importe)}
                  </strong>
                  <span className="text-gray-500">
                    {cadenciaObjetivo === 'MENSUAL'
                      ? ' cada mes'
                      : cadenciaObjetivo === 'ANUAL'
                        ? ` cada ${MESES[mesObjetivo - 1]}`
                        : ' cada vez'}
                    , y acabarías el{' '}
                  </span>
                  <strong style={{ color: 'var(--atlas-navy-1)' }}>
                    {solucion.simulacion.fechaFinDespues
                      ? formatDate(solucion.simulacion.fechaFinDespues)
                      : '—'}
                  </strong>
                  <span className="text-gray-500">
                    . Lo hemos puesto abajo como regla: cámbialo y vuelve a simular si quieres
                    ajustarlo.
                  </span>
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{solucion.motivo}</span>
                </div>
              )}
            </div>
          )}
          </CardV5.Body>
        </CardV5>
      )}

      <ReglasDelPlan
        reglas={reglas}
        onCambiar={cambiar}
        onQuitar={quitar}
        onAnadir={() => {
          setReglas((prev) => [...prev, nuevaRegla()]);
          invalidar();
        }}
      />

      {/* ── Lo que cuesta amortizar ─────────────────────────────────────── */}
      <CardV5>
        <CardV5.Body>
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
        </CardV5.Body>
      </CardV5>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Simular no cambia nada · tu cuadro y tu tesorería se quedan como están.
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

      {/* ── Guardarlo · para volver a verlo y para que cuente en tesorería ── */}
      <CardV5>
        <CardV5.Body>
        <h3 className="font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
          Guardar este plan
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Guardarlo no es haberlo hecho: tu préstamo sigue debiendo lo mismo y el cuadro no se toca.
          Cada amortización se registra el día que la hagas, desde «Amortización parcial».
        </p>

        <label className="flex items-start gap-3 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={generaPrevisiones}
            onChange={(e) => {
              setGeneraPrevisiones(e.target.checked);
              setGuardado('');
            }}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium">Contar estas salidas en mi tesorería</span>
            <span className="block text-gray-500">
              Aparecerán como previsiones pendientes de confirmar, con la comisión incluida, para
              que el saldo previsto cuente con ellas. Lo que ya hayas confirmado o descartado no se
              toca.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="text-xs text-gray-500">
            {previo?.actualizadoEn
              ? `Guardado por última vez el ${formatDate(previo.actualizadoEn.slice(0, 10))}.`
              : 'Todavía no has guardado ningún plan para este préstamo.'}
            {guardado && <span className="block text-green-700 font-medium mt-1">{guardado}</span>}
          </div>
          <div className="flex items-center gap-3">
            {previo && (
              <button
                type="button"
                onClick={borrarPlan}
                disabled={guardando}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-60"
              >
                Borrar plan
              </button>
            )}
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="px-4 py-2 rounded-lg border border-atlas-blue text-atlas-blue disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar plan'}
            </button>
          </div>
        </div>
        </CardV5.Body>
      </CardV5>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* ── El resultado, por los dos caminos ───────────────────────────── */}
      <div ref={lista}>
        {resultado && elegido && (
          <ResultadoDelPlan
            prestamo={prestamo}
            resultado={resultado}
            elegido={elegido}
            modo={modo}
            setModo={setModo}
            verTodos={verTodos}
            setVerTodos={setVerTodos}
          />
        )}
      </div>
    </div>
  );
};

export default PlanAmortizacionesPanel;
