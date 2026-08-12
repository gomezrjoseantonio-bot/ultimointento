import React, { useEffect, useMemo, useState } from 'react';
import { MoneyValue } from '../../../design-system/v5';
import {
  recopilarDatosInmuebles,
  type RendimientoInmueble,
} from '../../../services/irpfCalculationService';
import styles from './FiscalidadInmueble.module.css';

export interface FiscalidadInmuebleProps {
  inmuebleId: number;
}

interface LineaCascada {
  key: string;
  op: '+' | '−' | '=';
  nombre: string;
  hint?: string;
  valor: number;
  tipo?: 'sub' | 'tot';
  detalle?: Array<{ texto: string; valor: string }>;
}

const pct = (n: number): string => `${Math.round(n)} %`;

/** Construye la cascada del rendimiento a partir del cálculo IRPF real. */
function construirCascada(r: RendimientoInmueble): LineaCascada[] {
  const lineas: LineaCascada[] = [
    {
      key: 'ingresos',
      op: '+',
      nombre: 'Ingresos íntegros',
      valor: r.ingresosIntegros,
      detalle: [
        { texto: 'Renta con contrato de alquiler', valor: '' },
        {
          texto: `Periodo con contrato · ${r.diasAlquilado} de ${r.diasTotal} días`,
          valor: pct((r.diasAlquilado / (r.diasTotal || 1)) * 100),
        },
        { texto: 'Días vacío / uso propio · no computan', valor: `${r.diasVacio + r.diasEnObras} días` },
      ],
    },
    {
      key: 'gastos',
      op: '−',
      nombre: 'Gastos deducibles',
      hint: `prorrateados ${r.diasAlquilado}/${r.diasTotal}`,
      valor: r.gastosDeducibles,
      detalle: [
        ...(r.comisionGestion
          ? [{ texto: 'Comisión de gestión (casilla 0112)', valor: '' }]
          : []),
        { texto: 'Gastos del inmueble + intereses (prorrateados)', valor: '' },
        { texto: 'Mejoras y mobiliario · no deducen (amortizan)', valor: '—' },
      ],
    },
    {
      key: 'amort',
      op: '−',
      nombre: 'Amortización',
      hint: 'del inmueble y muebles',
      valor: r.amortizacion,
    },
    {
      key: 'neto',
      op: '=',
      nombre: 'Rendimiento neto del alquiler',
      valor: r.rendimientoNetoAlquiler,
      tipo: 'sub',
    },
  ];

  if (r.reduccionHabitual > 0) {
    lineas.push({
      key: 'reduccion',
      op: '−',
      nombre: `Reducción ${pct(r.porcentajeReduccionHabitual)} · vivienda`,
      hint: 'tu ahorro fiscal',
      valor: r.reduccionHabitual,
      detalle: [
        { texto: 'Sobre el rendimiento neto positivo', valor: '' },
        { texto: 'Reducción por alquiler de vivienda', valor: pct(r.porcentajeReduccionHabitual) },
      ],
    });
  }

  lineas.push({
    key: 'declarar',
    op: '=',
    nombre: 'A declarar por el alquiler',
    valor: r.rendimientoNetoReducido,
    tipo: 'tot',
  });

  return lineas;
}

const FiscalidadInmueble: React.FC<FiscalidadInmuebleProps> = ({ inmuebleId }) => {
  const anioActual = new Date().getFullYear();
  const [ejercicio, setEjercicio] = useState<number>(anioActual - 1);
  const [rend, setRend] = useState<RendimientoInmueble | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    recopilarDatosInmuebles(ejercicio, null)
      .then((res) => {
        if (!activo) return;
        setRend(res.inmuebles.find((i) => i.inmuebleId === inmuebleId) ?? null);
      })
      .catch(() => {
        if (activo) setRend(null);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [inmuebleId, ejercicio]);

  const cascada = useMemo(() => (rend ? construirCascada(rend) : []), [rend]);
  const anios = useMemo(() => [anioActual - 2, anioActual - 1, anioActual], [anioActual]);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <div className={styles.eyebrow}>Fiscalidad del inmueble · IRPF</div>
          <div className={styles.sub}>rendimiento del capital inmobiliario</div>
        </div>
        <div className={styles.yrSeg} role="group" aria-label="Ejercicio">
          {anios.map((a) => (
            <button key={a} type="button" className={a === ejercicio ? styles.yrOn : ''} onClick={() => setEjercicio(a)}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className={styles.empty}>Calculando el rendimiento fiscal…</div>
      ) : !rend ? (
        <div className={styles.empty}>
          Sin actividad fiscal registrada para este inmueble en {ejercicio}.
        </div>
      ) : (
        <>
          {/* Hero navy · resumen del rendimiento */}
          <div className={styles.nvHero}>
            <div className={styles.nvId}>
              <div className={styles.nvT}>
                <span className={styles.nvDot} />
                Rendimiento · IRPF
              </div>
              <div className={styles.nvS}>capital inmobiliario · {ejercicio}</div>
            </div>
            <div className={styles.nvKpis}>
              <div className={styles.nvK}>
                <div className={styles.kL}>A declarar</div>
                <div className={`${styles.kV} ${styles.gold}`}>
                  <MoneyValue value={rend.rendimientoNetoReducido} decimals={0} />
                </div>
                <div className={styles.kH}>neto reducido</div>
              </div>
              <div className={styles.nvK}>
                <div className={styles.kL}>Ingresos</div>
                <div className={styles.kV}>
                  <MoneyValue value={rend.ingresosIntegros} decimals={0} />
                </div>
                <div className={styles.kH}>renta con contrato</div>
              </div>
              <div className={styles.nvK}>
                <div className={styles.kL}>Ahorro fiscal</div>
                <div className={styles.kV}>
                  <MoneyValue value={rend.reduccionHabitual} decimals={0} />
                </div>
                <div className={styles.kH}>
                  {rend.porcentajeReduccionHabitual > 0
                    ? `reducción ${pct(rend.porcentajeReduccionHabitual)}`
                    : 'sin reducción'}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.calcNote}>
            Cómo se calcula · <b>pulsa cada línea para ver el desglose</b>
          </div>

          {/* Cascada del rendimiento */}
          <div className={styles.fxList}>
            {cascada.map((l) => {
              const tieneDetalle = (l.detalle?.length ?? 0) > 0;
              const open = abierta === l.key;
              return (
                <React.Fragment key={l.key}>
                  <div
                    className={`${styles.fxRow} ${l.tipo === 'sub' ? styles.sub : ''} ${l.tipo === 'tot' ? styles.tot : ''} ${open ? styles.open : ''}`}
                    role={tieneDetalle ? 'button' : undefined}
                    tabIndex={tieneDetalle ? 0 : undefined}
                    onClick={() => tieneDetalle && setAbierta(open ? null : l.key)}
                    onKeyDown={(e) => {
                      if (tieneDetalle && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setAbierta(open ? null : l.key);
                      }
                    }}
                  >
                    <span className={styles.op}>{l.op}</span>
                    <span className={styles.fxNm}>
                      {l.nombre}
                      {l.hint && <span className={styles.fxHint}>{l.hint}</span>}
                    </span>
                    <span className={styles.fxVal}>
                      <MoneyValue value={l.valor} decimals={0} />
                    </span>
                    {tieneDetalle && (
                      <span className={styles.fxExp} aria-hidden>
                        {open ? '▾' : '▸'}
                      </span>
                    )}
                  </div>
                  {open &&
                    l.detalle?.map((d, i) => (
                      <div key={i} className={styles.fxSubRow}>
                        <span>{d.texto}</span>
                        {d.valor && <span className={styles.sv}>{d.valor}</span>}
                      </div>
                    ))}
                </React.Fragment>
              );
            })}
          </div>

          {/* Contexto */}
          <div className={styles.ctxGrid}>
            <div className={styles.ctxCard}>
              <div className={styles.ctxLab}>Días alquilado</div>
              <div className={styles.ctxBig}>
                {rend.diasAlquilado}
                <span className={styles.ctxUnit}> / {rend.diasTotal}</span>
              </div>
              <div className={styles.ctxSub}>
                vacío {rend.diasVacio} · obras {rend.diasEnObras}
              </div>
            </div>
            <div className={styles.ctxCard}>
              <div className={styles.ctxLab}>Amortización del ejercicio</div>
              <div className={styles.ctxBig}>
                <MoneyValue value={rend.amortizacion} decimals={0} />
              </div>
              <div className={styles.ctxSub}>deducible · 3 % s/ base amortizable</div>
            </div>
            <div className={styles.ctxCard}>
              <div className={styles.ctxLab}>Imputación de renta</div>
              <div className={styles.ctxBig}>
                <MoneyValue value={rend.imputacionRenta} decimals={0} />
              </div>
              <div className={styles.ctxSub}>por días a disposición del titular</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FiscalidadInmueble;
