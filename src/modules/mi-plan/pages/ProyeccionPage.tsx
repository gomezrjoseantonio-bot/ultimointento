// PANTALLA-PRESUPUESTO · la vista del año
// =====================================================================
// Presupuesto leído (nunca tecleado). El PREVISTO se calcula completo de enero
// a diciembre SIEMPRE (sección 1.5); la pantalla PINTA el real donde el mes está
// PUNTEADO en Tesorería (lo refleja, no lo decide · 1.3) y el previsto donde no.
// «Te queda» es flujo (entra − sale del mes); «Saldo a fin de mes» es stock: la
// escalera NACE en el mes del ancla con el saldo observado (sección 1.1), no el
// 1 de enero. Los meses anteriores al ancla no se pintan (recorte · 1.3). Los
// tres espacios temporales (cerrado · en curso · futuro · 1.4) se distinguen a
// simple vista; el mes en curso lleva el borde de oro «aquí estás». El selector
// elige año natural o año rodante (sección 2) y recuerda la elección. Fiel a
// atlas-mi-plan-e2e2 · v-pre.
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import {
  buildPresupuestoAnual,
  type PresupuestoAnual,
  type FilaGrupo,
  type CeldaNeta,
  type ColumnaMes,
  type EspacioMes,
  type ModoVista,
  type GrupoKey,
} from '../services/presupuestoAnualService';
import './PresupuestoAnual.css';

const MES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmt = (n: number): string => Math.round(n).toLocaleString('es-ES');
const MODO_KEY = 'mi-plan.presupuesto.modo';

/** Desviación significativa (sección 4.1): más de 100 € o más del 25 %. */
const significativa = (real: number, previsto: number): boolean => {
  const d = Math.abs(real - previsto);
  return d > 100 || (Math.abs(previsto) > 0 && d / Math.abs(previsto) > 0.25);
};

/** Clases del espacio temporal (sección 1.4): la tinta distingue cerrado/futuro,
 *  el borde de oro marca el mes en curso. Sin colores nuevos · sin semántica de
 *  color sobre el dato. `real` = tinta normal (cerrado y en curso), `fut` = tinta
 *  apagada (futuro), `hoy-col` = rieles de oro «aquí estás». */
const claseEspacio = (espacio: EspacioMes): string =>
  `${espacio === 'futuro' ? 'fut' : 'real'}${espacio === 'curso' ? ' hoy-col' : ''}`;

interface HijoPivot { concepto: string; fuente?: string; meses: number[]; }

/** Pivota el desglose (por columna) a una fila por concepto con N valores previstos. */
function pivotDesglose(fila: FilaGrupo): HijoPivot[] {
  const n = fila.meses.length;
  const map = new Map<string, HijoPivot>();
  fila.meses.forEach((cell, i) => {
    for (const d of cell.desglose) {
      const key = `${d.concepto}|${d.fuente ?? ''}`;
      let row = map.get(key);
      if (!row) { row = { concepto: d.concepto, fuente: d.fuente, meses: Array(n).fill(0) }; map.set(key, row); }
      row.meses[i] = Math.round((row.meses[i] + d.importe) * 100) / 100;
    }
  });
  return [...map.values()];
}

const ProyeccionPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [tab, setTab] = useState<'anio' | 'largo'>('anio');
  const [modo, setModo] = useState<ModoVista>(() => {
    try {
      const v = localStorage.getItem(MODO_KEY);
      return v === 'rodante' ? 'rodante' : 'natural';
    } catch { return 'natural'; }
  });
  const [data, setData] = useState<PresupuestoAnual | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<GrupoKey>>(new Set());

  // Recuerda la elección del selector (sección 2).
  useEffect(() => {
    try { localStorage.setItem(MODO_KEY, modo); } catch { /* almacenamiento no disponible */ }
  }, [modo]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    buildPresupuestoAnual(year, modo)
      .then((d) => { if (!cancel) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancel) { setError(e?.message ?? String(e)); setLoading(false); } });
    return () => { cancel = true; };
  }, [year, modo]);

  const toggle = useCallback((k: GrupoKey) => {
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }, []);

  // Columnas pintadas · el servicio ya recortó por el ancla. Fallback (mock del
  // smoke test u datos antiguos sin `columnas`): 12 meses de calendario con el
  // mes en curso marcado por `mesActualIndex`.
  const columnas: ColumnaMes[] = data?.columnas ?? MES_ABBR.map((label, i): ColumnaMes => {
    const ma = data?.mesActualIndex ?? -1;
    const espacio: EspacioMes = i === ma ? 'curso' : ma >= 0 && i < ma ? 'cerrado' : 'futuro';
    return { year, mesIndex: i, label, espacio };
  });
  const punteado = data?.punteado ?? Array(columnas.length).fill(false);
  const totalLabel = data?.totalLabel ?? 'Año';

  // Celda de grupo/hijo: el NÚMERO es el real en un mes PUNTEADO (Tesorería tiene
  // actividad conciliada · 1.3) y el previsto en el resto. La CLASE es el espacio
  // temporal (1.4), independiente del punteo. Si en un mes punteado el real se
  // desvía, la desviación colorea ese mismo número (`desv`) · no lo subraya.
  const celdaGrupo = (cell: FilaGrupo['meses'][number], i: number): React.ReactNode => {
    const punt = punteado[i];
    const real = punt ? cell.real : null; // number | null (narrowing directo, sin cast)
    const desv = real != null && significativa(real, cell.previsto);
    const valor = real != null ? real : cell.previsto;
    return (
      <span key={i} className={`yc ${claseEspacio(columnas[i].espacio)}${desv ? ' desv' : ''}`}>
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
                    <span key={mi} className={`yc ${claseEspacio(columnas[mi].espacio)}`}>{fmt(Math.abs(m))}</span>
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
  // ser negativos). Nunca lee el saldo de tesorería. El riel de oro del mes en
  // curso se pinta también aquí para que la marca «aquí estás» cruce toda la tabla.
  const filaTotal = (label: string, cls: string, meses: CeldaNeta[], anioEsSaldo = false): React.ReactNode => (
    <div className={`yl ${cls}`}>
      <span className="ycon">{label}</span>
      {meses.map((cell, i) => (
        <span key={i} className={`yc${columnas[i].espacio === 'curso' ? ' hoy-col' : ''}`}>{fmt(cell.previsto)}</span>
      ))}
      <span className="yc tot">
        {fmt(anioEsSaldo ? (meses.length > 0 ? meses[meses.length - 1].previsto : 0) : meses.reduce((s, c) => s + c.previsto, 0))}
      </span>
    </div>
  );

  const entra = data?.grupos.filter((g) => g.signo === 'entra') ?? [];
  const sale = data?.grupos.filter((g) => g.signo === 'sale') ?? [];
  const totalMeses = (grupos: FilaGrupo[]): CeldaNeta[] =>
    columnas.map((_, i) => ({
      previsto: grupos.reduce((s, g) => s + Math.abs(g.meses[i]?.previsto ?? 0), 0),
      real: null,
    }));

  const esRodante = modo === 'rodante';

  return (
    <div className="presAnual">
      <div className="head">
        <div>
          <h1 className="h1">Presupuesto</h1>
          <div className="hsub">Se lee de lo que ya tienes registrado · pincha una fila para su desglose</div>
        </div>
        <div className="ctl">
          {tab === 'anio' && (
            <div className="modosel" role="group" aria-label="Modo de la vista">
              <button type="button" className={`tb${!esRodante ? ' on' : ''}`} onClick={() => setModo('natural')}>Año natural</button>
              <button type="button" className={`tb${esRodante ? ' on' : ''}`} onClick={() => setModo('rodante')}>Año rodante</button>
            </div>
          )}
          {/* Navegación de años · solo en modo natural (el rodante siempre arranca hoy).
              Solo hacia delante desde el año en curso (sección 2 · el motor no cubre
              años anteriores al actual). */}
          {tab === 'anio' && !esRodante && (
            <div className="anosel">
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
                <div className="ti-l">{esRodante ? 'Dentro de 12 meses' : 'Cierras el año con'}</div>
                <div className="ti-v gold">{fmt(data.tira.cierreAnio.previsto)} €</div>
                <div className="ti-s">{esRodante ? 'hoy tienes' : 'empezaste con'} {fmt(data.tira.cierreAnio.inicioCaja)} €</div>
              </div>
            </div>

            {/* La tabla · el nº de columnas varía con el recorte del ancla / rodante */}
            <div className="tabla-scroll">
              <div className="tab-c" style={{ ['--cols' as string]: columnas.length } as React.CSSProperties}>
                <div className="yl head">
                  <span className="ycon">Concepto</span>
                  {columnas.map((c, i) => (
                    <span key={i} className={`yc${c.espacio === 'curso' ? ' hoy hoy-col' : ''}`}>{c.label}</span>
                  ))}
                  <span className="yc tot">{totalLabel}</span>
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
