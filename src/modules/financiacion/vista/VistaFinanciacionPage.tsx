// ENTREGABLE A · la vista principal de Financiación · `/financiacion`.
//
// Sustituye a las cuatro pestañas (Dashboard · Listado · Snowball · Calendario)
// y a sus tablas de 12 y 18 columnas por una sola pantalla sin scroll: qué
// debes, qué pagas, cuándo te liberas y tu cartera. Fuente visual ·
// `atlas-financiacion-v10.html`.
//
// Regla innegociable: cada número sale de `generarCuadro` a través de las
// lecturas por fecha de `services/prestamos/lecturas`. Ni una cifra viene de
// `modules/financiacion/helpers.ts` ni de `prestamo.cuotaMensual`.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import type { FinanciacionOutletContext } from '../FinanciacionContext';
import { escaleraDeLiberacion } from '../../../services/prestamos/lecturas';
import { queTraeLaRevision } from '../../../services/prestamos/queTraeLaRevision';
import EscaleraLiberacion from './EscaleraLiberacion';
import {
  cuadroSeguroDe,
  filaDe,
  ordenar,
  totalesDe,
  ETIQUETA_ORDEN,
  type FamiliaPrestamo,
  type FilaCartera,
  type OrdenCartera,
} from './datos';
import {
  anio as soloAnio,
  diaMesAnio,
  eurAFavor,
  eurDeuda,
  eurPlano,
  mesAnio,
  mesCorto,
  pct,
} from './formato';
import styles from './VistaFinanciacion.module.css';

const CLAVE_ALERTA = 'atlas.financiacion.alerta-revision-descartada';

/** Hoy en ISO · el único sitio de la vista que mira el reloj. */
const hoyISO = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// ─── Amortizado · segmentos (opción E) ──────────────────────────────────────

const Segmentos: React.FC<{ pct: number }> = ({ pct: valor }) => {
  const encendidos = Math.round(Math.min(100, Math.max(0, valor)) / 10);
  return (
    <div className={styles.pips} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < encendidos ? styles.pipOn : undefined} />
      ))}
    </div>
  );
};

// ─── La fila de la cartera ──────────────────────────────────────────────────

const FilaPrestamo: React.FC<{ fila: FilaCartera; onAbrir: () => void }> = ({
  fila,
  onAbrir,
}) => {
  const marcaClase = fila.banco.marca ? styles[fila.banco.marca] : styles.sinMarca;
  const sube = fila.revision ? fila.revision.cuotaDespues > fila.revision.cuotaAntes : false;

  return (
    <div
      className={styles.fila}
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAbrir();
        }
      }}
    >
      <div
        className={`${styles.logoBanco} ${marcaClase}`}
        title={fila.banco.nombre || 'Banco sin apuntar'}
      >
        {fila.banco.abbr}
      </div>
      <div className={styles.celdaNombre}>
        <div className={styles.nombre}>{fila.nombre}</div>
        <div className={styles.meta}>{fila.meta}</div>
      </div>
      <div className={styles.valor}>{eurDeuda(fila.capitalVivo)}</div>
      <div className={styles.valor}>
        {eurDeuda(fila.cuota)}
        {fila.revision && (
          <small>
            {sube ? '↑' : '↓'} {eurPlano(fila.revision.cuotaDespues)}{' '}
            {mesCorto(fila.revision.fecha)}
          </small>
        )}
      </div>
      <div className={styles.valor}>
        {pct(fila.tin)}
        {fila.revision && Math.abs(fila.revision.tinDespues - fila.revision.tinAntes) >= 0.005 && (
          <small>→ {pct(fila.revision.tinDespues).replace(' %', '')}</small>
        )}
      </div>
      <div className={styles.celdaAmortizado}>
        <Segmentos pct={fila.pctAmortizado} />
        <span className={styles.amortizadoTxt}>{Math.round(fila.pctAmortizado)}%</span>
      </div>
      <div className={styles.vence}>{soloAnio(fila.vencimiento)}</div>
    </div>
  );
};

// ─── La vista ───────────────────────────────────────────────────────────────

const VistaFinanciacionPage: React.FC = () => {
  const navigate = useNavigate();
  const { prestamos } = useOutletContext<FinanciacionOutletContext>();

  const hoy = useMemo(() => hoyISO(), []);
  const [familias, setFamilias] = useState<FamiliaPrestamo[]>(['hipoteca', 'personal']);
  const [orden, setOrden] = useState<OrdenCartera>('vencimiento');
  const [alertaDescartada, setAlertaDescartada] = useState<string | null>(null);

  useEffect(() => {
    try {
      setAlertaDescartada(window.sessionStorage.getItem(CLAVE_ALERTA));
    } catch {
      // Modo privado sin sessionStorage · la alerta simplemente no se recuerda.
    }
  }, []);

  const filas = useMemo(() => {
    return prestamos
      .filter((p) => p.activo !== false && p.estado !== 'cancelado')
      .map((p) => {
        const cuadro = cuadroSeguroDe(p);
        return cuadro ? filaDe(p, cuadro, hoy) : null;
      })
      .filter((f): f is FilaCartera => f !== null);
  }, [prestamos, hoy]);

  const totales = useMemo(() => totalesDe(filas, hoy), [filas, hoy]);
  const escalera = useMemo(() => escaleraDeLiberacion(filas, hoy), [filas, hoy]);

  const visibles = useMemo(
    () => ordenar(filas.filter((f) => familias.includes(f.familia)), orden),
    [filas, familias, orden],
  );

  const numHipotecas = totales.numHipotecas;
  const numPersonales = totales.numPersonales;

  // La revisión más próxima que mueve la cuota · una sola alerta, la que antes
  // llega. Anunciar nueve a la vez sería ruido, no un aviso.
  const alerta = useMemo(() => {
    const candidatas = filas
      .filter((f) => f.revision)
      .sort((a, b) => a.revision!.fecha.localeCompare(b.revision!.fecha));
    const fila = candidatas[0];
    if (!fila) return null;
    const trae = queTraeLaRevision(fila.prestamo, fila.revision!.fecha, hoy);
    return {
      clave: `${fila.id}:${fila.revision!.fecha}`,
      nombre: fila.nombre,
      revision: fila.revision!,
      acabaElTramoFijo: Boolean(trae.acabaElTramoFijo),
      estrenanLasBonificaciones: Boolean(trae.estrenanLasBonificaciones),
    };
  }, [filas, hoy]);

  const descartarAlerta = useCallback(() => {
    if (!alerta) return;
    setAlertaDescartada(alerta.clave);
    try {
      window.sessionStorage.setItem(CLAVE_ALERTA, alerta.clave);
    } catch {
      // Sin sessionStorage el descarte dura lo que dure la pantalla.
    }
  }, [alerta]);

  const alternarFamilia = (f: FamiliaPrestamo) => {
    setFamilias((prev) => {
      if (prev.includes(f)) {
        // Nunca se apagan las dos · una cartera vacía por filtro no dice nada.
        return prev.length === 1 ? prev : prev.filter((x) => x !== f);
      }
      return [...prev, f];
    });
  };

  const mostrarAlerta = alerta != null && alertaDescartada !== alerta.clave;

  return (
    <div className={styles.vista}>
      {/* ── HERO GESTIÓN · navy con borde oro ── */}
      <div className={styles.hero}>
        <div className={styles.kpiRow}>
          <div className={styles.kpi}>
            <div className={styles.kpiLab}>Debes ahora</div>
            <div className={`${styles.kpiVal} ${styles.grande}`}>
              {eurDeuda(totales.capitalVivo)}
            </div>
            <div className={styles.kpiSub}>
              <span className={styles.mono}>{totales.numPrestamos}</span> préstamos ·{' '}
              <span className={styles.mono}>{totales.numBancos}</span> bancos ·{' '}
              <span className={styles.mono}>{numHipotecas}</span> hip +{' '}
              <span className={styles.mono}>{numPersonales}</span> pers
            </div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLab}>Pagas este mes</div>
            <div className={`${styles.kpiVal} ${styles.medio}`}>{eurDeuda(totales.cuotaMes)}</div>
            <div className={styles.kpiSub}>
              interés <span className={styles.mono}>{eurPlano(totales.interesMes)}</span> · capital{' '}
              <span className={styles.mono}>{eurPlano(totales.capitalMes)}</span>
            </div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLab}>Libre de deuda</div>
            <div className={`${styles.kpiVal} ${styles.medio} ${styles.oro}`}>
              {mesAnio(totales.ultimoVencimiento)}
            </div>
            <div className={styles.kpiSub}>
              {totales.penultimoVencimiento && totales.nombreUltimo ? (
                <>
                  sin {totales.nombreUltimo} ·{' '}
                  <span className={styles.mono}>{soloAnio(totales.penultimoVencimiento)}</span>
                </>
              ) : (
                'último vencimiento de tu cartera'
              )}
            </div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLab}>Deducible {hoy.slice(0, 4)}</div>
            <div className={`${styles.kpiVal} ${styles.medio}`}>{eurAFavor(totales.deducible)}</div>
            <div className={styles.kpiSub}>
              casilla 0105 ·{' '}
              <span className={styles.mono}>{totales.numDeducibles}</span>{' '}
              {totales.numDeducibles === 1 ? 'préstamo' : 'préstamos'}
            </div>
          </div>

          <div className={styles.kpiBtn}>
            <button
              type="button"
              className={styles.btnOro}
              onClick={() => navigate('/financiacion/nuevo')}
            >
              <Icons.Plus size={14} strokeWidth={2.2} />
              Nuevo préstamo
            </button>
          </div>
        </div>

        <div className={styles.heroChart}>
          <div className={styles.chartHead}>
            <div className={styles.chartTitle}>Tu cuota bajando hacia cero</div>
            <div className={styles.chartHint}>cada préstamo que vence libera su cuota</div>
          </div>
          <EscaleraLiberacion escalera={escalera} />
        </div>
      </div>

      {/* ── ALERTA · guía v5 §9.1 · cerrable ── */}
      {mostrarAlerta && alerta && (
        <div className={styles.alerta} role="status">
          <div className={styles.alertaIcono}>
            <Icons.Warning size={16} strokeWidth={2} />
          </div>
          <div className={styles.alertaTexto}>
            {alerta.nombre} revisa el <strong>{diaMesAnio(alerta.revision.fecha)}</strong> ·{' '}
            {alerta.acabaElTramoFijo && 'acaba el tramo fijo y '}la cuota{' '}
            {alerta.revision.cuotaDespues > alerta.revision.cuotaAntes ? 'sube' : 'baja'} de{' '}
            <strong>{eurPlano(alerta.revision.cuotaAntes)} €</strong> a{' '}
            <strong>{eurPlano(alerta.revision.cuotaDespues)} €</strong>
            {alerta.estrenanLasBonificaciones && ' con las bonificaciones'}
          </div>
          <button
            type="button"
            className={styles.alertaX}
            title="Descartar"
            aria-label="Descartar aviso"
            onClick={descartarAlerta}
          >
            <Icons.Close size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ── CARTERA ── */}
      <div className={styles.carteraWrap}>
        <div className={styles.carteraBar}>
          <div className={styles.carteraBarIzq}>
            <span className={styles.secLab}>Tus préstamos</span>
            <div className={styles.chips} role="group" aria-label="Filtrar cartera">
              <button
                type="button"
                className={`${styles.chip} ${familias.includes('hipoteca') ? styles.chipOn : ''}`}
                aria-pressed={familias.includes('hipoteca')}
                onClick={() => alternarFamilia('hipoteca')}
              >
                Hipotecas <span className={styles.chipN}>{numHipotecas}</span>
              </button>
              <button
                type="button"
                className={`${styles.chip} ${familias.includes('personal') ? styles.chipOn : ''}`}
                aria-pressed={familias.includes('personal')}
                onClick={() => alternarFamilia('personal')}
              >
                Personales <span className={styles.chipN}>{numPersonales}</span>
              </button>
            </div>
          </div>
          <div className={styles.orden}>
            <select
              value={orden}
              aria-label="Ordenar la cartera"
              onChange={(e) => setOrden(e.target.value as OrdenCartera)}
            >
              {(Object.keys(ETIQUETA_ORDEN) as OrdenCartera[]).map((o) => (
                <option key={o} value={o}>
                  {ETIQUETA_ORDEN[o]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.cartera}>
          <div className={`${styles.fila} ${styles.cabecera}`}>
            <div />
            <div className={styles.th}>Préstamo</div>
            <div className={`${styles.th} ${styles.thR}`}>Capital vivo</div>
            <div className={`${styles.th} ${styles.thR}`}>Cuota/mes</div>
            <div className={`${styles.th} ${styles.thR}`}>TIN hoy</div>
            <div className={`${styles.th} ${styles.thR}`}>Amortizado</div>
            <div className={`${styles.th} ${styles.thR}`}>Vence</div>
          </div>
          <div className={styles.filas}>
            {visibles.map((fila) => (
              <FilaPrestamo
                key={fila.id}
                fila={fila}
                onAbrir={() => navigate(`/financiacion/${fila.id}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VistaFinanciacionPage;
