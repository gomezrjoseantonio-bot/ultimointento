// PANTALLA-PRESUPUESTO · la vista del año
// =====================================================================
// Presupuesto leído (nunca tecleado). El PREVISTO está completo de enero a
// diciembre SIEMPRE (sección 1.2); lo único que cambia es si un mes está
// PUNTEADO en Tesorería (esta pantalla lo refleja, no lo decide · 1.3).
// «Te queda» es flujo (entra − sale del mes); «Saldo a fin de mes» es stock
// (escalera desde el saldo de partida de enero · 1.1). Ninguna celda lee el
// saldo de una cuenta. El selector arranca en el año en curso y navega solo
// hacia delante (sección 2). Fiel a atlas-mi-plan-e2e2 · v-pre.
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import {
  buildPresupuestoAnual,
  type PresupuestoAnual,
  type FilaGrupo,
  type CeldaNeta,
  type GrupoKey,
} from '../services/presupuestoAnualService';
import './PresupuestoAnual.css';

const MES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmt = (n: number): string => Math.round(n).toLocaleString('es-ES');

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

const ProyeccionPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
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

  const punteado = data?.punteado ?? Array(12).fill(false);
  const mesActual = data?.mesActualIndex ?? -1;

  // Celda de grupo/hijo: en un mes PUNTEADO (Tesorería tiene actividad
  // conciliada · 1.3) se pinta el REAL; el resto de meses pintan el previsto
  // (que está calculado completo de enero a diciembre). El previsto se calcula
  // siempre; lo que se PINTA depende de si el mes está punteado. Si en un mes
  // punteado el real se desvía, la desviación colorea ese mismo número (`desv`).
  const celdaGrupo = (cell: FilaGrupo['meses'][number], i: number): React.ReactNode => {
    const punt = punteado[i];
    const real = punt ? cell.real : null; // number | null (narrowing directo, sin cast)
    const desv = real != null && significativa(real, cell.previsto);
    const valor = real != null ? real : cell.previsto;
    return (
      <span key={i} className={`yc ${punt ? 'real' : 'fut'}${desv ? ' desv' : ''}`}>
        {fmt(Math.abs(valor))}
      </span>
    );
  };
  const anioAbs = (meses: FilaGrupo['meses']): number =>
    Math.abs(meses.reduce((s, c) => s + c.previsto, 0));

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
          {fila.meses.map((cell, i) => celdaGrupo(cell, i))}
          <span className="yc tot">{fmt(anioAbs(fila.meses))}</span>
        </div>
        {fila.desplegable && abierto && hijos.length > 0 && (
          <div className="hijos">
            {hijos.map((h, hi) => {
              const cero = h.meses.every((m) => Math.abs(m) < 0.005);
              return (
                <div className={`yl hijo${cero ? ' cero' : ''}`} key={hi}>
                  <span className="ycon">{h.concepto}{h.fuente && !h.concepto.includes(h.fuente) ? ` · ${h.fuente}` : ''}</span>
                  {h.meses.map((m, mi) => (
                    <span key={mi} className={`yc ${punteado[mi] ? 'real' : 'fut'}`}>{fmt(Math.abs(m))}</span>
                  ))}
                  <span className="yc tot">{fmt(Math.abs(h.meses.reduce((s, m) => s + m, 0)))}</span>
                </div>
              );
            })}
          </div>
        )}
      </React.Fragment>
    );
  };

  // Fila de total/queda/saldo: valor FIRMADO del previsto (Te queda y Saldo pueden
  // ser negativos). Nunca lee el saldo de tesorería.
  const filaTotal = (label: string, cls: string, meses: CeldaNeta[], anioEsSaldo = false): React.ReactNode => (
    <div className={`yl ${cls}`}>
      <span className="ycon">{label}</span>
      {meses.map((cell, i) => (
        <span key={i} className={`yc ${punteado[i] ? 'real' : 'fut'}`}>{fmt(cell.previsto)}</span>
      ))}
      <span className="yc tot">
        {fmt(anioEsSaldo ? meses[11].previsto : meses.reduce((s, c) => s + c.previsto, 0))}
      </span>
    </div>
  );

  const entra = data?.grupos.filter((g) => g.signo === 'entra') ?? [];
  const sale = data?.grupos.filter((g) => g.signo === 'sale') ?? [];
  const totalMeses = (grupos: FilaGrupo[]): CeldaNeta[] =>
    Array.from({ length: 12 }, (_, i) => ({
      previsto: grupos.reduce((s, g) => s + Math.abs(g.meses[i].previsto), 0),
      real: null,
    }));

  return (
    <div className="presAnual">
      <div className="head">
        <div>
          <h1 className="h1">Presupuesto</h1>
          <div className="hsub">Se lee de lo que ya tienes registrado · pincha una fila para su desglose</div>
        </div>
        <div className="ctl">
          <div className="anosel">
            {/* Solo hacia delante desde el año en curso (sección 2) · sin flecha atrás en el año actual */}
            <button
              type="button"
              aria-label="Año anterior"
              onClick={() => setYear((y) => Math.max(currentYear, y - 1))}
              style={year <= currentYear ? { visibility: 'hidden' } : undefined}
            >
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
                    ? 'sin meses punteados'
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
                <div className="ti-l">Cierras el año con</div>
                <div className="ti-v gold">{fmt(data.tira.cierreAnio.previsto)} €</div>
                <div className="ti-s">empezaste con {fmt(data.tira.cierreAnio.inicioCaja)} €</div>
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
                {filaTotal('Total entra', 'sum', totalMeses(entra))}

                <div className="ygrp">Sale</div>
                {sale.map(filaGrupo)}
                {filaTotal('Total sale', 'sum', totalMeses(sale))}

                {filaTotal('Te queda', 'queda', data.teQueda)}
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
