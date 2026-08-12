import React, { useMemo, useState } from 'react';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../services/db';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import { MoneyValue } from '../../../design-system/v5';
import {
  construirListaVisualGastosInmueble,
  calcularResumenGastosInmueble,
  type GastoInmuebleVisual,
  type GrupoVisualInmueble,
} from '../adapters/gastosInmuebleAdapter';
import styles from './CostesInmueble.module.css';

export interface CostesInmuebleProps {
  inmuebleId: number;
  compromisos?: readonly CompromisoRecurrente[];
  gastosReales?: readonly GastoInmueble[];
  mejoras?: readonly MejoraInmueble[];
  mobiliario?: readonly MuebleInmueble[];
  /** Abre la gestión de recurrentes (vista Previsto). */
  onGestionarRecurrentes?: () => void;
  /** Abre la edición de un registro real concreto. */
  onEditarReal?: (registroId: number, origen: 'real' | 'mejora' | 'mobiliario') => void;
}

type GrupoKey = 'mantener' | 'explotar' | 'mejorar' | 'mobiliario';

interface GrupoConfig {
  key: GrupoKey;
  label: string;
  hint: string;
  chip: string;
}

const GRUPOS: GrupoConfig[] = [
  { key: 'mantener', label: 'Mantenimiento', hint: 'IBI, comunidad, seguros', chip: styles.g1 },
  { key: 'explotar', label: 'Explotación', hint: 'luz, agua, gestión', chip: styles.g2 },
  { key: 'mejorar', label: 'Mejoras', hint: 'reformas y CAPEX', chip: styles.g3 },
  { key: 'mobiliario', label: 'Mobiliario', hint: 'muebles y equipo', chip: styles.g4 },
];

const GRUPO_LABEL: Record<GrupoVisualInmueble, string> = {
  mantener: 'Mantenimiento',
  explotar: 'Explotación',
  mejorar: 'Mejoras',
  mobiliario: 'Mobiliario',
  sin_clasificar: 'Otros',
};

const GRUPO_CHIP: Record<GrupoVisualInmueble, string> = {
  mantener: styles.g1,
  explotar: styles.g2,
  mejorar: styles.g3,
  mobiliario: styles.g4,
  sin_clasificar: styles.g4,
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtFecha = (iso: string): string => {
  const [a, m, d] = iso.split('-');
  const mi = Number(m) - 1;
  if (mi < 0 || mi > 11) return iso;
  return d ? `${d} ${MESES[mi]}` : `${MESES[mi]} ${a}`;
};

interface ConceptoAgrupado {
  concepto: string;
  grupo: GrupoVisualInmueble;
  total: number;
  items: GastoInmuebleVisual[];
}

/** Agrupa los registros reales por concepto (descripción) sumando importes. */
function agruparRealPorConcepto(items: GastoInmuebleVisual[]): ConceptoAgrupado[] {
  const mapa = new Map<string, ConceptoAgrupado>();
  for (const it of items) {
    const clave = `${it.grupoVisual}::${it.descripcion}`;
    const prev = mapa.get(clave);
    const importe = it.importeReal ?? 0;
    if (prev) {
      prev.total += importe;
      prev.items.push(it);
    } else {
      mapa.set(clave, { concepto: it.descripcion, grupo: it.grupoVisual, total: importe, items: [it] });
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

const CostesInmueble: React.FC<CostesInmuebleProps> = ({
  inmuebleId,
  compromisos,
  gastosReales,
  mejoras,
  mobiliario,
  onGestionarRecurrentes,
  onEditarReal,
}) => {
  const anioActual = new Date().getFullYear();
  const [ejercicio, setEjercicio] = useState<number>(anioActual);
  const [vista, setVista] = useState<'prev' | 'real'>('prev');
  const [grupoActivo, setGrupoActivo] = useState<GrupoKey | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      construirListaVisualGastosInmueble({
        inmuebleId,
        compromisosRecurrentes: compromisos ?? [],
        gastosReales: gastosReales ?? [],
        mejoras: mejoras ?? [],
        mobiliario: mobiliario ?? [],
      }),
    [inmuebleId, compromisos, gastosReales, mejoras, mobiliario],
  );

  const resumen = useMemo(() => calcularResumenGastosInmueble(lista, ejercicio), [lista, ejercicio]);

  const previstoItems = useMemo(
    () =>
      lista.filter(
        (i) => i.origen === 'recurrente' && (!grupoActivo || i.grupoVisual === grupoActivo),
      ),
    [lista, grupoActivo],
  );

  const realAgrupado = useMemo(() => {
    const reales = lista.filter(
      (i) =>
        i.origen !== 'recurrente' &&
        (i.ejercicio === undefined || i.ejercicio === ejercicio) &&
        (!grupoActivo || i.grupoVisual === grupoActivo),
    );
    return agruparRealPorConcepto(reales);
  }, [lista, ejercicio, grupoActivo]);

  const anios = useMemo(() => [anioActual - 2, anioActual - 1, anioActual], [anioActual]);

  const totalRealFiltrado = realAgrupado.reduce((s, c) => s + c.total, 0);

  return (
    <div className={styles.wrap}>
      {/* Cabecera + selector de año */}
      <div className={styles.head}>
        <div>
          <div className={styles.eyebrow}>Coste de propiedad</div>
          <div className={styles.sub}>lo que cuesta tener el activo · previsto vs real</div>
        </div>
        <div className={styles.yrSeg} role="group" aria-label="Ejercicio">
          {anios.map((a) => (
            <button
              key={a}
              type="button"
              className={a === ejercicio ? styles.yrOn : ''}
              onClick={() => setEjercicio(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Cards-filtro por grupo */}
      <div className={styles.gFilter}>
        {GRUPOS.map((g) => {
          const datos = resumen[g.key];
          const importe = vista === 'prev' ? datos.previsto : datos.real;
          const secundario =
            vista === 'prev'
              ? datos.real !== undefined
                ? datos.real
                : undefined
              : datos.previsto;
          const on = grupoActivo === g.key;
          return (
            <button
              key={g.key}
              type="button"
              className={`${styles.fCard} ${g.chip} ${on ? styles.fOn : ''}`}
              aria-pressed={on}
              onClick={() => setGrupoActivo(on ? null : g.key)}
            >
              <span className={styles.fName}>{g.label}</span>
              <span className={styles.fHint}>{g.hint}</span>
              <span className={styles.fAmt}>
                {importe !== undefined ? <MoneyValue value={importe} decimals={0} /> : '—'}
              </span>
              <span className={styles.fPrev}>
                {secundario !== undefined ? (
                  <>
                    {vista === 'prev' ? 'real ' : 'previsto '}
                    <MoneyValue value={secundario} decimals={0} />
                  </>
                ) : vista === 'prev' ? (
                  'sin registro'
                ) : (
                  'sin previsión'
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toggle Previsto / Real + estado del filtro */}
      <div className={styles.filtBar}>
        <div className={styles.gToggle} role="group" aria-label="Previsto o real">
          <button type="button" className={vista === 'prev' ? styles.gvOn : ''} onClick={() => setVista('prev')}>
            Previsto
          </button>
          <button type="button" className={vista === 'real' ? styles.gvOn : ''} onClick={() => setVista('real')}>
            Real
          </button>
        </div>
        <span className={styles.filtState}>
          {grupoActivo ? `Grupo · ${GRUPOS.find((g) => g.key === grupoActivo)?.label}` : 'Todos los grupos'}
        </span>
        {grupoActivo && (
          <button type="button" className={styles.filtClear} onClick={() => setGrupoActivo(null)}>
            Quitar filtro
          </button>
        )}
      </div>

      {/* PREVISTO · compromisos recurrentes */}
      {vista === 'prev' && (
        <>
          {onGestionarRecurrentes && (
            <div className={styles.actionsRow}>
              <button type="button" className={styles.linkBtn} onClick={onGestionarRecurrentes}>
                Gestionar recurrentes
              </button>
            </div>
          )}
          {previstoItems.length > 0 ? (
            <div className={styles.mov}>
              <div className={styles.movHd}>
                <span>Compromiso</span>
                <span>Grupo</span>
                <span className={styles.right}>Previsto</span>
              </div>
              {previstoItems.map((it) => (
                <div key={it.idVisual} className={styles.movRow}>
                  <span className={styles.mCon}>{it.descripcion}</span>
                  <span className={`${styles.mCat} ${GRUPO_CHIP[it.grupoVisual]}`}>
                    {GRUPO_LABEL[it.grupoVisual]}
                  </span>
                  <span className={styles.mAmt}>
                    {it.importePrevisto !== undefined ? <MoneyValue value={it.importePrevisto} decimals={0} /> : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>Sin compromisos recurrentes en este grupo.</div>
          )}
        </>
      )}

      {/* REAL · agrupado por concepto */}
      {vista === 'real' && (
        <>
          <div className={styles.filtHint}>
            <b>{realAgrupado.reduce((s, c) => s + c.items.length, 0)} movimientos</b> en {ejercicio} ·
            agrupados por concepto — pulsa un concepto para ver el detalle
          </div>
          {realAgrupado.length > 0 ? (
            <div className={styles.cxList}>
              <div className={styles.cxHd}>
                <span>Concepto</span>
                <span>Grupo</span>
                <span>Movimientos</span>
                <span className={styles.right}>Real</span>
                <span />
              </div>
              {realAgrupado.map((c) => {
                const clave = `${c.grupo}::${c.concepto}`;
                const abierto = expandido === clave;
                return (
                  <React.Fragment key={clave}>
                    <div
                      className={`${styles.cxRow} ${abierto ? styles.cxOpen : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandido(abierto ? null : clave)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandido(abierto ? null : clave);
                        }
                      }}
                    >
                      <span className={styles.cxNm}>{c.concepto}</span>
                      <span className={`${styles.mCat} ${GRUPO_CHIP[c.grupo]}`}>{GRUPO_LABEL[c.grupo]}</span>
                      <span className={styles.cxCount}>
                        {c.items.length} mov.
                      </span>
                      <span className={styles.cxAmt}>
                        <MoneyValue value={c.total} decimals={0} />
                      </span>
                      <span className={styles.cxExp} aria-hidden>
                        {abierto ? '▾' : '▸'}
                      </span>
                    </div>
                    {abierto &&
                      c.items.map((it) => (
                        <div
                          key={it.idVisual}
                          className={`${styles.cxSubRow} ${onEditarReal && it.registroId != null ? styles.cxSubClickable : ''}`}
                          role={onEditarReal && it.registroId != null ? 'button' : undefined}
                          tabIndex={onEditarReal && it.registroId != null ? 0 : undefined}
                          onClick={() => {
                            if (onEditarReal && it.registroId != null && it.origen !== 'recurrente') {
                              onEditarReal(it.registroId, it.origen);
                            }
                          }}
                        >
                          <span className={styles.sNm}>{it.descripcion}</span>
                          <span className={styles.sDt}>{fmtFecha(it.fecha)}</span>
                          <span className={styles.sAm}>
                            <MoneyValue value={it.importeReal ?? 0} decimals={0} />
                          </span>
                        </div>
                      ))}
                  </React.Fragment>
                );
              })}
              <div className={styles.cxTotal}>
                <span className={styles.cxTotalLabel}>Total {grupoActivo ? 'del grupo' : 'real'} · {ejercicio}</span>
                <span className={styles.cxTotalValue}>
                  <MoneyValue value={totalRealFiltrado} decimals={0} />
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.empty}>Sin gastos registrados en este grupo para {ejercicio}.</div>
          )}
        </>
      )}
    </div>
  );
};

export default CostesInmueble;
