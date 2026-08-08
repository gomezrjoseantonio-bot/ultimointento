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
import { conIndiceDeHoy } from '../../../services/prestamos/indiceDeHoy';
import { inmueblesAlquiladosEn } from '../../../services/prestamos/inmueblesAlquilados';
import { getFinancialValuesSnapshot } from '../../../services/financialValuesService';
import EscaleraLiberacion from './EscaleraLiberacion';
import {
  cuadroSeguroDe,
  filaDe,
  ordenar,
  alPulsarCabecera,
  ORDEN_POR_DEFECTO,
  totalesDe,
  type FamiliaPrestamo,
  type FilaCartera,
  type OrdenCartera,
  type CampoOrden,
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

/**
 * Cuántos préstamos caben sin scroll.
 *
 * La vista es de una pantalla y no puede crecer hacia abajo, así que la cartera
 * no lleva scroll propio: lo que no cabe se pagina. Con scroll, las filas de
 * abajo existen y no se ven — y el que se te olvida es siempre el de abajo.
 */
const POR_PAGINA = 7;

interface CabeceraProps {
  campo: CampoOrden;
  orden: OrdenCartera;
  onOrdenar: (o: OrdenCartera) => void;
  derecha?: boolean;
  children: React.ReactNode;
}

/**
 * Una cabecera que ordena · con su flecha cuando manda.
 *
 * Ordenar por una columna se pide pulsando ESA columna. El desplegable que
 * había repetía los nombres de las columnas en una lista aparte y no decía por
 * cuál se estaba ordenando ahora mismo.
 */
const Cabecera: React.FC<CabeceraProps> = ({ campo, orden, onOrdenar, derecha, children }) => {
  const activa = orden.campo === campo;
  return (
    <button
      type="button"
      className={`${styles.th} ${derecha ? styles.thR : ''} ${styles.thOrd} ${activa ? styles.thOn : ''}`}
      onClick={() => onOrdenar(alPulsarCabecera(orden, campo))}
      aria-label={`Ordenar por ${typeof children === 'string' ? children.toLowerCase() : campo}${
        activa ? (orden.asc ? ' · ahora de menor a mayor' : ' · ahora de mayor a menor') : ''
      }`}
    >
      {children}
      <span className={styles.thFlecha} aria-hidden>
        {activa ? (orden.asc ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
};

const VistaFinanciacionPage: React.FC = () => {
  const navigate = useNavigate();
  const { prestamos } = useOutletContext<FinanciacionOutletContext>();

  const hoy = useMemo(() => hoyISO(), []);
  const [familias, setFamilias] = useState<FamiliaPrestamo[]>(['hipoteca', 'personal']);
  const [orden, setOrden] = useState<OrdenCartera>(ORDEN_POR_DEFECTO);
  // Página de la cartera · nunca scroll (guía v5): la pantalla no crece, se
  // pagina. Con scroll, lo de abajo existe y no se ve — y una cartera es
  // justamente una lista que hay que poder recorrer entera de un vistazo.
  const [pagina, setPagina] = useState(0);
  const [alertaDescartada, setAlertaDescartada] = useState<string | null>(null);

  useEffect(() => {
    try {
      setAlertaDescartada(window.sessionStorage.getItem(CLAVE_ALERTA));
    } catch {
      // Modo privado sin sessionStorage · la alerta simplemente no se recuerda.
    }
  }, []);

  // El euríbor de «Actualizar valores» y los inmuebles alquilados este año · la
  // cartera necesita los dos para no contestar distinto que el detalle: el
  // primero pone al día la presunción de índice de las variables, el segundo
  // decide qué intereses deducen. Mientras el segundo no llega, el conjunto
  // vacío deja el total deducible en cero en vez de afirmarlo sin comprobarlo.
  const [indiceHoy, setIndiceHoy] = useState<number | null>(null);
  const [alquilados, setAlquilados] = useState<ReadonlySet<string>>(() => new Set<string>());
  useEffect(() => {
    let cancelado = false;
    getFinancialValuesSnapshot()
      .then((v) => {
        if (!cancelado) setIndiceHoy(v.euriborPercent);
      })
      .catch(() => {
        // Sin valoraciones no se presume nada · no se inventa un índice.
      });
    inmueblesAlquiladosEn(Number(hoy.slice(0, 4))).then((s) => {
      if (!cancelado) setAlquilados(s);
    });
    return () => {
      cancelado = true;
    };
  }, [hoy]);

  const filas = useMemo(() => {
    return prestamos
      .filter((p) => p.activo !== false && p.estado !== 'cancelado')
      .map((p) => {
        const proyectado = conIndiceDeHoy(p, indiceHoy);
        const cuadro = cuadroSeguroDe(proyectado);
        return cuadro ? filaDe(proyectado, cuadro, hoy) : null;
      })
      .filter((f): f is FilaCartera => f !== null);
  }, [prestamos, hoy, indiceHoy]);

  const totales = useMemo(() => totalesDe(filas, hoy, alquilados), [filas, hoy, alquilados]);
  const escalera = useMemo(() => escaleraDeLiberacion(filas, hoy), [filas, hoy]);

  const ordenadas = useMemo(
    () => ordenar(filas.filter((f) => familias.includes(f.familia)), orden),
    [filas, familias, orden],
  );

  // Lo que cabe sin scroll · si sobran, se pagina. La página se reinicia al
  // filtrar o reordenar: quedarse en la 3 de una lista que ahora tiene una
  // enseñaría un vacío que parece «no tienes préstamos».
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const desde = paginaSegura * POR_PAGINA;
  const visibles = ordenadas.slice(desde, desde + POR_PAGINA);

  useEffect(() => {
    setPagina(0);
  }, [familias, orden]);

  const numHipotecas = totales.numHipotecas;
  const numPersonales = totales.numPersonales;

  // La revisión más próxima que mueve la cuota · una sola alerta, la que antes
  // llega. Anunciar nueve a la vez sería ruido, no un aviso.
  const alerta = useMemo(() => {
    const candidatas = filas
      .filter((f) => f.revision)
      .sort((a, b) => a.revision!.aplicaDesde.localeCompare(b.revision!.aplicaDesde));
    const fila = candidatas[0];
    if (!fila) return null;
    // El día en que REVISA, no el del primer recibo · el parámetro se llama
    // `revisionDesde` y se le estaba pasando la fecha de cargo, que va un mes
    // por detrás.
    const trae = queTraeLaRevision(fila.prestamo, fila.revision!.aplicaDesde, hoy);
    return {
      clave: `${fila.id}:${fila.revision!.aplicaDesde}`,
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
        {/* El título vive DENTRO del hero, como en Tesorería · una cabecera
            aparte encima repetía el nombre del menú y se comía una banda
            entera de pantalla en una vista que no puede tener scroll. */}
        <div className={styles.heroLab}>
          <div className={styles.heroTitle}>
            <span className={styles.heroDot} /> Mi financiación
          </div>
          <div className={styles.heroSub}>tu deuda · tu cuota · cuándo te liberas</div>
        </div>
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

          {/* UN botón. La FEIN no es otra puerta: es una forma de rellenar el
              alta, así que vive DENTRO del alta y no compitiendo con ella aquí
              *(Jose · 8 ago 2026)*. Como enlace debajo seguía siendo una
              segunda salida en la misma pantalla. */}
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
            {alerta.nombre} revisa el <strong>{diaMesAnio(alerta.revision.aplicaDesde)}</strong> ·{' '}
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
          {/* El desplegable «Ordenar · …» se ha ido a las cabeceras: ordenar
              por una columna se pide pulsando esa columna, no buscándola en una
              lista que además repetía sus nombres. */}
          {totalPaginas > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                aria-label="Página anterior"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
              >
                ‹
              </button>
              <span className={styles.pagerN}>
                {desde + 1}–{Math.min(desde + POR_PAGINA, ordenadas.length)} de {ordenadas.length}
              </span>
              <button
                type="button"
                aria-label="Página siguiente"
                disabled={pagina >= totalPaginas - 1}
                onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
              >
                ›
              </button>
            </div>
          )}
        </div>

        <div className={styles.cartera}>
          <div className={`${styles.fila} ${styles.cabecera}`}>
            <div />
            <Cabecera campo="nombre" orden={orden} onOrdenar={setOrden}>Préstamo</Cabecera>
            <Cabecera campo="capital" orden={orden} onOrdenar={setOrden} derecha>Capital vivo</Cabecera>
            <Cabecera campo="cuota" orden={orden} onOrdenar={setOrden} derecha>Cuota/mes</Cabecera>
            <Cabecera campo="tin" orden={orden} onOrdenar={setOrden} derecha>TIN hoy</Cabecera>
            <Cabecera campo="amortizado" orden={orden} onOrdenar={setOrden} derecha>Amortizado</Cabecera>
            <Cabecera campo="vencimiento" orden={orden} onOrdenar={setOrden} derecha>Vence</Cabecera>
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
