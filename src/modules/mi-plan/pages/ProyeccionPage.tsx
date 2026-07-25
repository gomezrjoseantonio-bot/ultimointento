// PANTALLA-PRESUPUESTO · la vista del año · modelo temporal
// =====================================================================
// Presupuesto leído (nunca tecleado). El PREVISTO está completo de enero a
// diciembre SIEMPRE (sección 1.2); lo que se PINTA es el real en los meses
// PUNTEADOS y el previsto en el resto (1.3-1.5). La escalera del saldo NACE en
// el mes del ANCLA (la observación con fecha del saldo · 1.1) y los meses
// anteriores al ancla no se pintan (recorte · 1.3). Tres espacios temporales:
// cerrados (tinta normal), mes en curso (borde oro · «aquí estás»), futuros
// (tinta apagada). El selector ofrece año natural o año rodante y recuerda la
// elección (sección 2). Fiel a atlas-mi-plan-e2e2 · v-pre.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import {
  buildPresupuesto,
  type PresupuestoAnual,
  type FilaGrupo,
  type CeldaNeta,
  type GrupoKey,
  type Modo,
} from '../services/presupuestoAnualService';
import './PresupuestoAnual.css';

const MES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmt = (n: number): string => Math.round(n).toLocaleString('es-ES');
const MODO_KEY = 'presupuesto.modo';

/** Desviación significativa (sección 4.1): más de 100 € o más del 25 %. */
const significativa = (real: number, previsto: number): boolean => {
  const d = Math.abs(real - previsto);
  return d > 100 || (Math.abs(previsto) > 0 && d / Math.abs(previsto) > 0.25);
};

interface HijoPivot { concepto: string; fuente?: string; meses: number[]; }

/** Pivota el desglose (por mes) a una fila por concepto con 12 valores previstos. */
function pivotDesglose(fila: FilaGrupo): HijoPivot[] {
  const map = new Map<string, HijoPivot>();
  fila.meses.forEach((cell, i) => {
    for (const d of cell.desglose) {
      const key = `${d.concepto}|${d.fuente ?? ''}`;
      let row = map.get(key);
      if (!row) { row = { concepto: d.concepto, fuente: d.fuente, meses: Array(12).fill(0) }; map.set(key, row); }
      row.meses[i] = Math.round((row.meses[i] + d.importe) * 100) / 100;
    }
  });
  return [...map.values()];
}

function readModo(): Modo {
  try { return localStorage.getItem(MODO_KEY) === 'rodante' ? 'rodante' : 'natural'; }
  catch { return 'natural'; }
}

const ProyeccionPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [modo, setModo] = useState<Modo>(readModo);
  const [tab, setTab] = useState<'anio' | 'largo'>('anio');
  const [data, setData] = useState<PresupuestoAnual | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<GrupoKey>>(new Set());

  useEffect(() => {
    try { localStorage.setItem(MODO_KEY, modo); } catch { /* sin persistencia */ }
  }, [modo]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    buildPresupuesto(modo === 'rodante' ? { modo: 'rodante' } : { modo: 'natural', year })
      .then((d) => { if (!cancel) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancel) { setError(e?.message ?? String(e)); setLoading(false); } });
    return () => { cancel = true; };
  }, [year, modo]);

  // El ancla puede permitir navegar hacia atrás hasta su año (nunca antes · 2).
  const anchorYear = data?.ancla?.year ?? null;
  const minYear = anchorYear ?? currentYear;
  // Si un año pintado quedara por debajo del ancla (p. ej. por URL), se corrige.
  useEffect(() => {
    if (anchorYear != null && year < anchorYear) setYear(anchorYear);
  }, [anchorYear, year]);

  const toggle = useCallback((k: GrupoKey) => {
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }, []);

  const punteado = data?.punteado ?? Array(12).fill(false);
  const mesActual = data?.mesActualIndex ?? -1;
  const desdeMes = data?.desdeMes ?? 0;
  const mesLabels = data?.mesLabels ?? MES_ABBR;
  const columnaAnioLabel = data?.columnaAnioLabel ?? 'Año';
  // Columnas PINTADAS · desde el recorte del ancla hasta diciembre (1.3).
  const cols = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i).filter((i) => i >= desdeMes),
    [desdeMes],
  );
  const gridStyle = { '--pa-cols': cols.length } as React.CSSProperties;

  // Celda de grupo/hijo: el punteo es del GRUPO, no del mes (1.1). Si el grupo tiene
  // real ese mes (`cell.real != null`) se pinta el real; si no, el previsto (nunca 0
  // mudo). La desviación colorea ese mismo número (`desv`). El mes en curso lleva el
  // borde oro (`enc`) · «aquí estás» (1.4).
  const celdaGrupo = (cell: FilaGrupo['meses'][number], i: number): React.ReactNode => {
    const real = cell.real; // number | null · null → el grupo no conció ese mes
    const desv = real != null && significativa(real, cell.previsto);
    const valor = real != null ? real : cell.previsto; // efectivo
    const enc = i === mesActual ? ' enc' : '';
    return (
      <span key={i} className={`yc ${real != null ? 'real' : 'fut'}${desv ? ' desv' : ''}${enc}`}>
        {fmt(Math.abs(valor))}
      </span>
    );
  };
  // Total de año de la fila · el previsto es el plan (la columna Año es correcta en
  // previsto · P1); solo sobre los meses pintados (respeta el recorte).
  const anioAbs = (meses: FilaGrupo['meses']): number =>
    Math.abs(cols.reduce((s, i) => s + meses[i].previsto, 0));

  const filaGrupo = (fila: FilaGrupo): React.ReactNode => {
    if (fila.vacio) {
      return (
        <div className="yl vacia" key={fila.key}>
          <span className="ycon">{fila.label}</span>
          <span className="motivo">{fila.vacio.motivo}</span>
        </div>
      );
    }
    const hijos = fila.desplegable ? pivotDesglose(fila) : [];
    const abierto = abiertos.has(fila.key);
    return (
      <React.Fragment key={fila.key}>
        <div
          className="yl pad"
          onClick={fila.desplegable ? () => toggle(fila.key) : undefined}
          role={fila.desplegable ? 'button' : undefined}
          tabIndex={fila.desplegable ? 0 : undefined}
        >
          <span className="ycon">
            <span className={`chv${abierto ? ' op' : ''}`} style={fila.desplegable ? undefined : { visibility: 'hidden' }}>›</span>
            {fila.label}
            {fila.desplegable && hijos.length > 0 && <em>{hijos.length}</em>}
          </span>
          {cols.map((i) => celdaGrupo(fila.meses[i], i))}
          <span className="yc tot">{fmt(anioAbs(fila.meses))}</span>
        </div>
        {fila.desplegable && abierto && hijos.length > 0 && (
          <div className="hijos">
            {hijos.map((h, hi) => {
              const cero = cols.every((i) => Math.abs(h.meses[i]) < 0.005);
              return (
                <div className={`yl hijo${cero ? ' cero' : ''}`} key={hi}>
                  <span className="ycon">{h.concepto}{h.fuente && !h.concepto.includes(h.fuente) ? ` · ${h.fuente}` : ''}</span>
                  {cols.map((i) => (
                    <span key={i} className={`yc ${punteado[i] ? 'real' : 'fut'}${i === mesActual ? ' enc' : ''}`}>{fmt(Math.abs(h.meses[i]))}</span>
                  ))}
                  <span className="yc tot">{fmt(Math.abs(cols.reduce((s, i) => s + h.meses[i], 0)))}</span>
                </div>
              );
            })}
          </div>
        )}
      </React.Fragment>
    );
  };

  // Fila de total/queda/saldo: valor EFECTIVO firmado (real donde lo hay, previsto
  // donde no · 1.2). Nunca lee el saldo de tesorería. El total del saldo es el del
  // último mes pintado (stock); el resto suma los meses pintados (flujo). `saleAbs`
  // muestra la magnitud (Total sale se ve positivo aunque el flujo sea negativo).
  const filaTotal = (
    label: string, cls: string, meses: CeldaNeta[], anioEsSaldo = false, saleAbs = false,
  ): React.ReactNode => {
    const disp = (v: number): number => (saleAbs ? Math.abs(v) : v);
    const suma = cols.reduce((s, i) => s + meses[i].efectivo, 0);
    return (
      <div className={`yl ${cls}`}>
        <span className="ycon">{label}</span>
        {cols.map((i) => (
          <span key={i} className={`yc ${punteado[i] ? 'real' : 'fut'}${i === mesActual ? ' enc' : ''}`}>{fmt(disp(meses[i].efectivo))}</span>
        ))}
        <span className="yc tot">{fmt(anioEsSaldo ? meses[11].efectivo : disp(suma))}</span>
      </div>
    );
  };

  const entra = data?.grupos.filter((g) => g.signo === 'entra') ?? [];
  const sale = data?.grupos.filter((g) => g.signo === 'sale') ?? [];
  // Total de un conjunto de grupos por mes · EFECTIVO firmado (real donde lo hay).
  // Firmado, sin Math.abs: así un autónomo en pérdidas RESTA de «Total entra» y
  // Total entra − Total sale = Te queda con los números que se ven (P3 · criterio 1).
  const totalMeses = (grupos: FilaGrupo[]): CeldaNeta[] =>
    Array.from({ length: 12 }, (_, i) => {
      const efectivo = grupos.reduce((s, g) => s + (g.meses[i].real ?? g.meses[i].previsto), 0);
      const previsto = grupos.reduce((s, g) => s + g.meses[i].previsto, 0);
      return { previsto, real: null, efectivo };
    });

  const rangoRodante = data ? `${mesLabels[cols[0]]} – ${mesLabels[cols[cols.length - 1]]}` : '';

  return (
    <div className="presAnual">
      <div className="head">
        <div>
          <h1 className="h1">Presupuesto</h1>
          <div className="hsub">Se lee de lo que ya tienes registrado · pincha una fila para su desglose</div>
        </div>
        <div className="ctl">
          {tab === 'anio' && (
            <div className="tabs" role="group" aria-label="Modo de vista">
              {/* Año natural o año rodante · se recuerda la elección (sección 2) */}
              <button type="button" aria-pressed={modo === 'natural'} className={`tb${modo === 'natural' ? ' on' : ''}`} onClick={() => setModo('natural')}>Natural</button>
              <button type="button" aria-pressed={modo === 'rodante'} className={`tb${modo === 'rodante' ? ' on' : ''}`} onClick={() => setModo('rodante')}>Rodante</button>
            </div>
          )}
          {tab === 'anio' && modo === 'natural' && (
            <div className="anosel">
              {/* Hacia delante libre; hacia atrás solo hasta el año del ancla (sección 2) */}
              <button
                type="button"
                aria-label="Año anterior"
                onClick={() => setYear((y) => Math.max(minYear, y - 1))}
                style={year <= minYear ? { visibility: 'hidden' } : undefined}
              >
                <ChevronLeft size={15} strokeWidth={2.2} />
              </button>
              <span>{year}</span>
              <button type="button" aria-label="Año siguiente" onClick={() => setYear((y) => y + 1)}>
                <ChevronRight size={15} strokeWidth={2.2} />
              </button>
            </div>
          )}
          {tab === 'anio' && modo === 'rodante' && (
            <div className="anosel"><span className="rango">{rangoRodante}</span></div>
          )}
          <div className="tabs">
            <button type="button" className={`tb${tab === 'anio' ? ' on' : ''}`} onClick={() => setTab('anio')}>Este año</button>
            <button type="button" className={`tb${tab === 'largo' ? ' on' : ''}`} onClick={() => setTab('largo')}>A largo plazo</button>
          </div>
        </div>
      </div>

      {error && <div className="tabla-vacia">No se pudo calcular el presupuesto: {error}</div>}

      {tab === 'anio' && (
        loading || !data ? (
          <div className="cargando">Calculando…</div>
        ) : (
          <>
            {/* La tira superior · cinco cifras, todas de la tabla pintada */}
            <div className="tira">
              <div className="ti">
                <div className="ti-l">Hasta ahora preveías</div>
                <div className="ti-v">{data.tira.mesesCerrados > 0 ? fmt(data.tira.previstoAcumulado) + ' €' : '—'}</div>
                <div className="ti-s">{data.tira.mesesCerrados > 0 ? 'de ahorro acumulado' : 'nada punteado aún'}</div>
              </div>
              <div className="ti">
                <div className="ti-l">Llevas de verdad</div>
                <div className="ti-v">{data.tira.mesesCerrados > 0 ? fmt(data.tira.realAcumulado) + ' €' : '—'}</div>
                <div className="ti-s">{data.tira.mesesCerrados} {data.tira.mesesCerrados === 1 ? 'mes punteado' : 'meses punteados'}</div>
              </div>
              <div className="ti">
                <div className="ti-l">Desviación</div>
                <div className={`ti-v${data.tira.desviacion < 0 ? ' mal' : ''}`}>{data.tira.mesesCerrados > 0 ? fmt(data.tira.desviacion) + ' €' : '—'}</div>
                <div className="ti-s">
                  {data.tira.mesesCerrados === 0
                    ? 'aún no hay con qué comparar'
                    : data.tira.desviacionConceptos.length > 0
                      ? data.tira.desviacionConceptos.map((c) => c.concepto.toLowerCase()).join(' y ')
                      : 'sin desvíos relevantes'}
                </div>
              </div>
              <div className="ti">
                <div className="ti-l">El mes más justo</div>
                <div className="ti-v">{data.tira.mesMasJusto ? MES_ABBR[data.tira.mesMasJusto.mes - 1] : '—'}</div>
                <div className="ti-s">{data.tira.mesMasJusto ? `te quedan ${fmt(data.tira.mesMasJusto.teQueda)} €` : ''}</div>
              </div>
              <div className="ti">
                <div className="ti-l">Cierras con</div>
                <div className="ti-v gold">{fmt(data.tira.cierreAnio.previsto)} €</div>
                <div className="ti-s">empezaste con {fmt(data.tira.cierreAnio.inicioCaja)} €</div>
              </div>
            </div>

            {/* La tabla */}
            <div className="tabla-scroll">
              <div className="tab-c" style={gridStyle}>
                <div className="yl head">
                  <span className="ycon">Concepto</span>
                  {cols.map((i) => (
                    <span key={i} className={`yc${i === mesActual ? ' hoy enc' : ''}`}>{mesLabels[i]}</span>
                  ))}
                  <span className="yc tot">{columnaAnioLabel}</span>
                </div>

                <div className="ygrp">Entra</div>
                {entra.map(filaGrupo)}
                {filaTotal('Total entra', 'sum', totalMeses(entra))}

                <div className="ygrp">Sale</div>
                {sale.map(filaGrupo)}
                {filaTotal('Total sale', 'sum', totalMeses(sale), false, true)}

                {filaTotal('Te queda', 'queda', data.teQueda)}
                {filaTotal('Saldo a fin de mes', 'saldo', data.saldoFinMes, true)}
              </div>
            </div>

            {/* Avisos · meses sin puntear (acción · 4.5) + pie de lectura */}
            {(data.sinPuntear.length > 0 || data.pie.length > 0) && (
              <div className="avisos">
                {data.sinPuntear.map((frase, i) => (
                  <div className="av accion" key={`sp${i}`}>
                    <span className="av-p" />
                    <span className="av-c">{frase}</span>
                  </div>
                ))}
                {data.pie.map((frase, i) => (
                  <div className="av" key={`pie${i}`}>
                    <span className="av-p" />
                    <span className="av-c">{frase}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}

      {tab === 'largo' && (
        <div className="vacio-lp">
          <div className="icono"><CalendarClock size={38} strokeWidth={1.5} /></div>
          <div className="titulo">La proyección a largo plazo aún no está disponible</div>
          <div className="texto">
            La vista a diez años necesita el motor de proyección de veinte años, que hoy solo
            cubre el año en curso. No se muestra una serie estimada para no dar cifras que no
            se pueden calcular.
          </div>
        </div>
      )}
    </div>
  );
};

export default ProyeccionPage;
