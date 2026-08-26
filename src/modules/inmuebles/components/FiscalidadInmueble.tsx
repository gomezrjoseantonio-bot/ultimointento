import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoneyValue } from '../../../design-system/v5';
import RotuloReduccion from '../../../components/fiscal/RotuloReduccion';
import type { DesgloseReduccion } from '../../../services/desgloseReduccion';
import {
  recopilarDatosInmuebles,
  type RendimientoInmueble,
} from '../../../services/irpfCalculationService';
import { getLatestConfirmedSaleForProperty } from '../../../services/propertySaleService';
import type { PropertySale } from '../../../services/db';
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
  /** Solo la línea de reducción · el rótulo por tramo va bajo el nombre. */
  reduccion?: DesgloseReduccion;
}

/** Un porcentaje redondeado · lo usa el reparto de días, no la reducción. */
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
      // Decía «Reducción 26 % · vivienda» con el porcentaje EFECTIVO. Ese 26 no
      // se aplicó a nada: es la media entre el tramo de larga estancia y el que
      // no reduce. El nominal de cada uno va ahora en los chips.
      nombre: 'Reducción Ley Vivienda',
      hint: 'tu ahorro fiscal',
      valor: r.reduccionHabitual,
      reduccion: r.reduccion,
      detalle: [
        { texto: 'Sobre el rendimiento neto positivo', valor: '' },
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
  const navigate = useNavigate();
  const anioActual = new Date().getFullYear();
  const [ejercicio, setEjercicio] = useState<number>(anioActual - 1);
  const [rend, setRend] = useState<RendimientoInmueble | null>(null);
  const [venta, setVenta] = useState<PropertySale | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [avisoVisible, setAvisoVisible] = useState(true);

  // Venta confirmada del inmueble (si la hay): su ganancia patrimonial tributa
  // en la declaración del año de la venta. Se muestra en la pestaña aunque no
  // haya rendimiento de alquiler (caso de un inmueble ya vendido).
  useEffect(() => {
    let activo = true;
    getLatestConfirmedSaleForProperty(inmuebleId)
      .then((s) => {
        if (activo) setVenta(s);
      })
      .catch(() => {
        if (activo) setVenta(null);
      });
    return () => {
      activo = false;
    };
  }, [inmuebleId]);

  const ventaDelEjercicio = useMemo(
    () =>
      venta?.saleDate && new Date(venta.saleDate).getFullYear() === ejercicio ? venta : null,
    [venta, ejercicio],
  );

  // Si el inmueble se vendió, arrancar el selector en el año de la venta (dentro
  // del rango disponible) para que su ganancia se vea sin tener que buscar el año.
  useEffect(() => {
    if (!venta?.saleDate) return;
    const y = new Date(venta.saleDate).getFullYear();
    if (y >= anioActual - 2 && y <= anioActual) setEjercicio(y);
  }, [venta, anioActual]);

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

      {ventaDelEjercicio && (
        <div className={styles.nvHero}>
          <div className={styles.nvId}>
            <div className={styles.nvT}>
              <span className={styles.nvDot} />
              Venta · ganancia patrimonial
            </div>
            <div className={styles.nvS}>tributa en la declaración de {ejercicio}</div>
          </div>
          <div className={styles.nvKpis}>
            <div className={styles.nvK}>
              <div className={styles.kL}>Ganancia</div>
              <div className={`${styles.kV} ${styles.gold}`}>
                <MoneyValue value={ventaDelEjercicio.fiscalSnapshot?.gananciaPatrimonial ?? 0} decimals={0} />
              </div>
              <div className={styles.kH}>patrimonial</div>
            </div>
            <div className={styles.nvK}>
              <div className={styles.kL}>Impuesto estimado</div>
              <div className={styles.kV}>
                <MoneyValue value={ventaDelEjercicio.fiscalSnapshot?.irpfEstimado ?? 0} decimals={0} />
              </div>
              <div className={styles.kH}>base ahorro</div>
            </div>
            <div className={styles.nvK}>
              <div className={styles.kL}>Valor transmisión</div>
              <div className={styles.kV}>
                <MoneyValue value={ventaDelEjercicio.fiscalSnapshot?.valorNetoTransmision ?? ventaDelEjercicio.salePrice} decimals={0} />
              </div>
              <div className={styles.kH}>tras gastos deducibles</div>
            </div>
          </div>
        </div>
      )}

      {ventaDelEjercicio && (
        <button
          type="button"
          className={styles.calcNote}
          style={{ cursor: 'pointer', textAlign: 'left', width: '100%', background: 'none', border: 0 }}
          onClick={() => navigate(`/fiscal/ejercicio/${ejercicio}/venta/${ventaDelEjercicio.id}`)}
        >
          Ver el desglose completo de la venta →
        </button>
      )}

      {cargando ? (
        <div className={styles.empty}>Calculando el rendimiento fiscal…</div>
      ) : !rend ? (
        ventaDelEjercicio ? null : (
          <div className={styles.empty}>
            Sin actividad fiscal registrada para este inmueble en {ejercicio}.
          </div>
        )
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
                  <RotuloReduccion desglose={rend.reduccion} conImporte={false} />
                </div>
              </div>
            </div>
          </div>

          {avisoVisible && (
            <div className={styles.readNote}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v4h1" />
              </svg>
              <span className={styles.readNoteTx}>
                Solo son deducibles los gastos del periodo <b>con contrato de alquiler</b>. El consumo
                en uso propio o vacío no genera deducción; se <b>prorratean por días alquilados</b> (
                {rend.diasAlquilado}/{rend.diasTotal} en {ejercicio}).
              </span>
              <button
                type="button"
                className={styles.rnX}
                aria-label="Descartar aviso"
                onClick={() => setAvisoVisible(false)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

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
                      {l.reduccion && <RotuloReduccion desglose={l.reduccion} conImporte={false} />}
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
