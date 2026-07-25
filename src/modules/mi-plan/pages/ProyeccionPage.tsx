// PANTALLA-PRESUPUESTO · la vista del año
// =====================================================================
// Presupuesto leído (nunca tecleado) de lo ya registrado. Dos pestañas:
// «Este año» (tabla 12 meses × 8 grupos, previsto vs real) y «A largo plazo»
// (estado vacío honesto · el motor de 20 años no existe · sección 4.5).
// Fiel a `atlas-mi-plan-e2e2.html` vista v-pre. Colores por token V5.
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import {
  buildPresupuestoAnual,
  type PresupuestoAnual,
  type FilaGrupo,
  type GrupoKey,
} from '../services/presupuestoAnualService';
import './PresupuestoAnual.css';

const MES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmt = (n: number): string => Math.round(n).toLocaleString('es-ES');
const fmtEuro = (n: number): string => `${Math.round(n).toLocaleString('es-ES')} €`;

/** Desviación significativa (sección 4.1): más de 100 € o más del 25 %. */
const significativa = (real: number, previsto: number): boolean => {
  const d = Math.abs(real - previsto);
  return d > 100 || (Math.abs(previsto) > 0 && d / Math.abs(previsto) > 0.25);
};

interface HijoPivot { concepto: string; fuente?: string; meses: number[]; }

/** Pivota el desglose (que es por mes) a una fila por concepto con 12 valores. */
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

const ProyeccionPage: React.FC = () => {
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [tab, setTab] = useState<'anio' | 'largo'>('anio');
  const [data, setData] = useState<PresupuestoAnual | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<GrupoKey>>(new Set());

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    buildPresupuestoAnual(year)
      .then((d) => { if (!cancel) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancel) { setError(e?.message ?? String(e)); setLoading(false); } });
    return () => { cancel = true; };
  }, [year]);

  const toggle = useCallback((k: GrupoKey) => {
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }, []);

  const mesActual = data?.mesActualIndex ?? -1;

  // Celdas de una fila: real hasta el mes cerrado, previsto de ahí en adelante.
  const celdas = (meses: FilaGrupo['meses'], magnitud = true): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < 12; i++) {
      const cell = meses[i];
      const closed = i <= mesActual;
      const raw = closed ? (cell.real ?? 0) : cell.previsto;
      const desv = closed && cell.real != null && significativa(cell.real, cell.previsto);
      const v = magnitud ? Math.abs(raw) : raw;
      out.push(
        <span key={i} className={`yc ${closed ? 'real' : 'fut'}${desv ? ' desv' : ''}`}>{fmt(v)}</span>,
      );
    }
    return out;
  };
  const anioMostrado = (fila: FilaGrupo, magnitud = true): number => {
    let s = 0;
    for (let i = 0; i < 12; i++) {
      const raw = i <= mesActual ? (fila.meses[i].real ?? 0) : fila.meses[i].previsto;
      s += magnitud ? Math.abs(raw) : raw;
    }
    return s;
  };

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
          {celdas(fila.meses)}
          <span className="yc tot">{fmt(anioMostrado(fila))}</span>
        </div>
        {fila.desplegable && abierto && hijos.length > 0 && (
          <div className="hijos">
            {hijos.map((h, hi) => {
              const cero = h.meses.every((m) => Math.abs(m) < 0.005);
              return (
                <div className={`yl hijo${cero ? ' cero' : ''}`} key={hi}>
                  <span className="ycon">{h.concepto}{h.fuente ? ` · ${h.fuente}` : ''}</span>
                  {h.meses.map((m, mi) => (
                    <span key={mi} className={`yc ${mi <= mesActual ? 'real' : 'fut'}`}>{fmt(Math.abs(m))}</span>
                  ))}
                  <span className="yc tot">{fmt(h.meses.reduce((s, m) => s + Math.abs(m), 0))}</span>
                </div>
              );
            })}
          </div>
        )}
      </React.Fragment>
    );
  };

  const filaTotal = (label: string, cls: string, meses: PresupuestoAnual['teQueda'], firmado = false): React.ReactNode => {
    const out: React.ReactNode[] = [];
    let anio = 0;
    for (let i = 0; i < 12; i++) {
      const cell = meses[i];
      const closed = i <= mesActual;
      const raw = closed ? (cell.real ?? 0) : cell.previsto;
      const v = firmado ? raw : Math.abs(raw);
      anio += cls === 'saldo' ? 0 : v;
      out.push(<span key={i} className={`yc ${closed ? 'real' : 'fut'}`}>{fmt(v)}</span>);
    }
    // Para «Saldo» el Año es el saldo de diciembre; para el resto, la suma.
    const anioVal = cls === 'saldo'
      ? (() => { const c = meses[11]; const closed = 11 <= mesActual; return firmado ? (closed ? (c.real ?? 0) : c.previsto) : Math.abs(closed ? (c.real ?? 0) : c.previsto); })()
      : anio;
    return (
      <div className={`yl ${cls}`}>
        <span className="ycon">{label}</span>
        {out}
        <span className="yc tot">{fmt(anioVal)}</span>
      </div>
    );
  };

  const entra = data?.grupos.filter((g) => g.signo === 'entra') ?? [];
  const sale = data?.grupos.filter((g) => g.signo === 'sale') ?? [];

  return (
    <div className="presAnual">
      {/* Cabecera · controles en la misma fila que el título */}
      <div className="head">
        <div>
          <h1 className="h1">Presupuesto</h1>
          <div className="hsub">Se lee de lo que ya tienes registrado · pincha una fila para su desglose</div>
        </div>
        <div className="ctl">
          <div className="anosel">
            <button type="button" aria-label="Año anterior" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
            <span>{year}</span>
            <button type="button" aria-label="Año siguiente" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
          </div>
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
            {/* La tira superior · cinco cifras calculadas */}
            <div className="tira">
              <div className="ti">
                <div className="ti-l">Hasta {MES_ABBR[Math.max(0, mesActual)].toLowerCase()} preveías</div>
                <div className="ti-v">{fmtEuro(data.tira.previstoAcumulado)}</div>
                <div className="ti-s">de ahorro acumulado</div>
              </div>
              <div className="ti">
                <div className="ti-l">Llevas de verdad</div>
                <div className="ti-v">{data.esFuturo ? '—' : fmtEuro(data.tira.realAcumulado)}</div>
                <div className="ti-s">{data.tira.mesesCerrados} {data.tira.mesesCerrados === 1 ? 'mes cerrado' : 'meses cerrados'}</div>
              </div>
              <div className="ti">
                <div className="ti-l">Desviación</div>
                <div className={`ti-v${data.tira.desviacion < 0 ? ' mal' : ''}`}>{data.esFuturo ? '—' : fmtEuro(data.tira.desviacion)}</div>
                <div className="ti-s">
                  {data.tira.desviacionConceptos.length > 0
                    ? data.tira.desviacionConceptos.map((c) => c.concepto.toLowerCase()).join(' y ')
                    : 'sin desvíos relevantes'}
                </div>
              </div>
              <div className="ti">
                <div className="ti-l">El mes más justo</div>
                <div className="ti-v">{data.tira.mesMasJusto ? MES_ABBR[data.tira.mesMasJusto.mes - 1] : '—'}</div>
                <div className="ti-s">{data.tira.mesMasJusto ? `te quedan ${fmtEuro(data.tira.mesMasJusto.teQueda)}` : ''}</div>
              </div>
              <div className="ti">
                <div className="ti-l">Cierras el año con</div>
                <div className="ti-v gold">{fmtEuro(data.tira.cierreAnio.previsto)}</div>
                <div className="ti-s">previsto</div>
              </div>
            </div>

            {/* La tabla */}
            <div className="tabla-scroll">
              <div className="tab-c">
                <div className="yl head">
                  <span className="ycon">Concepto</span>
                  {MES_ABBR.map((m, i) => (
                    <span key={i} className={`yc${i === mesActual ? ' hoy' : ''}`}>{m}</span>
                  ))}
                  <span className="yc tot">Año</span>
                </div>

                <div className="ygrp">Entra</div>
                {entra.map(filaGrupo)}
                {filaTotal('Total entra', 'sum', data.teQueda.map((_, i) => ({
                  previsto: entra.reduce((s, g) => s + g.meses[i].previsto, 0),
                  real: entra.some((g) => g.meses[i].real != null) ? entra.reduce((s, g) => s + (g.meses[i].real ?? 0), 0) : null,
                })))}

                <div className="ygrp">Sale</div>
                {sale.map(filaGrupo)}
                {filaTotal('Total sale', 'sum', data.teQueda.map((_, i) => ({
                  previsto: sale.reduce((s, g) => s + g.meses[i].previsto, 0),
                  real: sale.some((g) => g.meses[i].real != null) ? sale.reduce((s, g) => s + (g.meses[i].real ?? 0), 0) : null,
                })))}

                {filaTotal('Te queda', 'queda', data.teQueda, true)}
                {filaTotal('Saldo a fin de mes', 'saldo', data.saldoFinMes, true)}
              </div>
            </div>

            {/* Pie de lectura · hasta 3 frases · nada si no hay nada que decir */}
            {data.pie.length > 0 && (
              <div className="avisos">
                {data.pie.map((frase, i) => (
                  <div className="av" key={i}>
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
