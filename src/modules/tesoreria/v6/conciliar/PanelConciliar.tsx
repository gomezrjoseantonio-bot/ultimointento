// ============================================================================
// Conciliar extracto · LA PANTALLA (mockup `atlas-conciliar-v1.html`)
// ============================================================================
//
// Sustituye a la lista corrida del drawer. La lista no estaba mal dibujada:
// estaba mal PLANTEADA. Enseñaba ciento y pico líneas del banco en el mismo tono,
// así que las seis que necesitaban al usuario pesaban lo mismo que las ciento
// dieciocho que no. Aquí se separan: a la izquierda lo que hay que contestar, a
// la derecha lo que ya está.
//
// Esta pantalla no escribe nada. Recibe el estado de la sesión y devuelve los
// gestos del usuario a quien los sabe aplicar (el drawer, que sigue siendo el
// dueño del `confirmDecisions`). En particular `renderLinea` es una función que
// pasa el drawer: así el `LineaExtractoItem` de siempre —con sus acciones ya
// probadas— sigue montándose donde están sus manejadores, y esta pantalla se
// ocupa solo de dónde va cada cosa y de qué se le dice al usuario.
// ============================================================================

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { LineaExtracto } from '../extractoSesion';
import type { Cuadre } from '../conciliarBuckets';
import type { Propuesta } from './propuestaDeLinea';
import type { LoQueYaReconoce } from './loQueYaReconoce';
import TarjetaAccion from './TarjetaAccion';
import CuadreConElBanco from './CuadreConElBanco';
import type { PropuestaDeAnclaje } from '../../../../services/anclajeSaldoExtracto';
import ColumnaResto from './ColumnaResto';
import { atajosDeBusqueda, filtrarPorTexto } from './buscarLineas';
import styles from './PanelConciliar.module.css';

export interface PanelConciliarProps {
  /** «Santander · ····2715 · 124 líneas · ago 2026». */
  titularCuenta: string;
  colorBanco?: string;
  elCuadre: Cuadre;
  necesitan: LineaExtracto[];
  resueltas: LineaExtracto[];
  personales: LineaExtracto[];
  ignoradas: LineaExtracto[];
  propuestas: Map<number, Propuesta>;
  aprendido: LoQueYaReconoce;
  avisos: string[];
  error: string | null;
  guardando: boolean;
  /** E1.5-anclaje-saldo · el cuadre con el banco, si el fichero trae saldo. */
  anclaje?: PropuestaDeAnclaje | null;
  anclar?: boolean;
  onAnclar?: (anclar: boolean) => void;
  /** El drawer monta aquí su `LineaExtractoItem`, con sus manejadores. */
  renderLinea: (linea: LineaExtracto) => React.ReactNode;
  onRecuperar: (lineaId: number) => void;
  /** «No es esto» sobre una línea que ATLAS colocó solo · vuelve a «te necesitan». */
  onNoEsEsto: (lineaId: number) => void;
  /** Ignorar de un gesto todas las elegidas · el remate de buscar y marcar. */
  onIgnorarVarias: (lineaIds: number[]) => void;
  /** Cuentas a las que se puede traspasar en bloque · vacío si no hay ninguna. */
  cuentasTraspaso?: Array<{ id: number; nombre: string }>;
  /** «Son traspaso a esta cuenta» sobre todas las elegidas de un gesto. */
  onTraspasarVarias?: (lineaIds: number[], cuentaDestinoId: number) => void;
  /**
   * «Clasificar las N como…» · abre la ficha UNA vez para todas las elegidas.
   *
   * Es la acción que faltaba y la única que resuelve una línea de verdad:
   * ignorar y traspasar son lo que NO se hace con cinco recibos del agua.
   */
  onClasificarVarias?: (lineaIds: number[]) => void;
  onGuardar: () => void;
  onOtroFichero: () => void;
}

/** Porcentaje de la barra · con cero líneas no se divide por cero. */
function pct(n: number, total: number): string {
  return total > 0 ? `${(n / total) * 100}%` : '0%';
}

const PanelConciliar: React.FC<PanelConciliarProps> = ({
  titularCuenta,
  colorBanco,
  elCuadre,
  necesitan,
  resueltas,
  personales,
  ignoradas,
  propuestas,
  aprendido,
  avisos,
  error,
  guardando,
  anclaje,
  anclar = false,
  onAnclar,
  renderLinea,
  onRecuperar,
  onNoEsEsto,
  onIgnorarVarias,
  cuentasTraspaso = [],
  onTraspasarVarias,
  onClasificarVarias,
  onGuardar,
  onOtroFichero,
}) => {
  const total = elCuadre.delBanco;
  const b = elCuadre.porBucket;
  const elResto = b.resueltas + b.personal + b.ignorados;

  // ── Buscar y elegir ──────────────────────────────────────────────────────
  //
  // Con 95 líneas delante, contestarlas de una en una no es un trabajo
  // razonable. El buscador estrecha y la casilla acumula; la barra de abajo
  // remata. Los tres viven aquí, en la pantalla, y no en el drawer: son estado
  // de VISTA —lo que estoy mirando y lo que llevo marcado— y no sobreviven a
  // guardar ni tienen por qué.
  const [consulta, setConsulta] = React.useState('');
  const [elegidas, setElegidas] = React.useState<ReadonlySet<number>>(new Set());

  const atajos = React.useMemo(() => atajosDeBusqueda(necesitan), [necesitan]);
  const visibles = React.useMemo(() => filtrarPorTexto(necesitan, consulta), [necesitan, consulta]);

  // Lo que la barra puede tocar es lo elegido QUE SE VE. Si eliges el gas,
  // buscas «bizum» y le das a ignorar, no puede llevarse por delante el gas que
  // ya no tienes delante: lo que no se ve, no se toca.
  const enJuego = React.useMemo(
    () => visibles.filter((l) => elegidas.has(l.lineaId)).map((l) => l.lineaId),
    [visibles, elegidas],
  );

  const alternarElegida = (lineaId: number) =>
    setElegidas((previas) => {
      const siguiente = new Set(previas);
      if (siguiente.has(lineaId)) siguiente.delete(lineaId);
      else siguiente.add(lineaId);
      return siguiente;
    });

  const filtrando = consulta.trim().length > 0;

  // El traspaso en bloque sólo cabe sobre CARGOS. La pata de salida de un
  // traspaso es un cargo; ofrecerlo sobre un abono sería invitar a crear el
  // traspaso al revés, que es dinero inventado. Ignorar, en cambio, vale para
  // cualquier signo, y por eso sigue ahí en los dos casos.
  const todoSonCargos =
    enJuego.length > 0 && visibles.every((l) => !elegidas.has(l.lineaId) || l.importe < 0);
  const cabeTraspaso = todoSonCargos && cuentasTraspaso.length > 0 && onTraspasarVarias != null;

  return (
    <section className={styles.superficie} aria-label="Conciliar extracto">
      {/* ── Cabecera GESTIÓN · navy ───────────────────────────────────── */}
      <div className={styles.cab}>
        <div className={styles.cabTop}>
          <div>
            <h1 className={styles.cabTitulo}>Conciliar extracto</h1>
            <div className={styles.cabSub}>
              {colorBanco && (
                <span
                  className={styles.punto}
                  style={{ background: colorBanco }}
                  aria-hidden="true"
                />
              )}
              <span className={styles.cabMask}>{titularCuenta}</span>
              <span className={styles.punto} aria-hidden="true" />
              <span>
                {aprendido.total > 0
                  ? `ATLAS ya reconoce ${aprendido.total} ${aprendido.total === 1 ? 'cosa' : 'cosas'} de esta cuenta`
                  : 'ATLAS todavía no reconoce nada de esta cuenta'}
              </span>
            </div>
          </div>
          <button type="button" className={styles.btnCab} onClick={onOtroFichero}>
            <Icons.ArrowLeft size={15} />
            Otro fichero
          </button>
        </div>

        {/* El reparto a escala · orientación periférica, sin cifras. */}
        <div className={styles.barra} aria-hidden="true">
          <i className={styles.segResueltas} style={{ width: pct(b.resueltas, total) }} />
          <i className={styles.segNecesitan} style={{ width: pct(b.te_necesitan, total) }} />
          <i className={styles.segPersonal} style={{ width: pct(b.personal, total) }} />
          <i className={styles.segIgnorados} style={{ width: pct(b.ignorados, total) }} />
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <span className={styles.kpiN}>{b.resueltas}</span>
            <span className={styles.kpiL}>resueltas solas</span>
          </div>
          <div className={`${styles.kpi} ${styles.kpiNecesitan}`}>
            <span className={styles.kpiN}>{b.te_necesitan}</span>
            <span className={styles.kpiL}>te necesitan · una vez</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiN}>{b.personal}</span>
            <span className={styles.kpiL}>personal</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiN}>{b.ignorados}</span>
            <span className={styles.kpiL}>ignorados</span>
          </div>

          {/* El cuadre · la promesa de esta pantalla, siempre a la vista. */}
          <div className={styles.cuadre} data-cuadra={elCuadre.cuadra ? 'si' : 'no'}>
            <Icons.Check size={15} />
            {elCuadre.cuadra ? (
              <span>
                <b>{elCuadre.delBanco}</b> del banco · <b>{elCuadre.colocadas}</b> colocadas ·{' '}
                <b>ninguna se pierde</b>
              </span>
            ) : (
              <span>
                <b>{elCuadre.delBanco}</b> del banco pero solo <b>{elCuadre.colocadas}</b>{' '}
                colocadas · faltan {elCuadre.delBanco - elCuadre.colocadas}
              </span>
            )}
          </div>
        </div>
      </div>

      {avisos.map((a, i) => (
        <div key={i} className={styles.aviso}>
          {a}
        </div>
      ))}
      {error && <div className={`${styles.aviso} ${styles.avisoError}`}>{error}</div>}
      {anclaje && onAnclar && (
        <CuadreConElBanco propuesta={anclaje} anclar={anclar} onAnclar={onAnclar} desactivado={guardando} />
      )}

      {/* ── Cuerpo · dos columnas, cada una con su scroll ──────────────── */}
      <div className={styles.cuerpo}>
        <div className={styles.col}>
          <div className={styles.colCab}>
            <div className={styles.colT}>
              <Icons.Clock size={16} />
              Te necesitan · una vez cada una
            </div>
            <div className={styles.colC}>
              {filtrando
                ? `viendo ${visibles.length} de ${necesitan.length}`
                : 'responder crea lo que falta · y no se vuelve a preguntar'}
            </div>
          </div>

          {/* ── Buscar · con los atajos que salen de este fichero ────────── */}
          {necesitan.length > 0 && (
            <div className={styles.buscar}>
              <label className={styles.campo}>
                <Icons.Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  className={styles.campoInput}
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  placeholder="Buscar en el extracto · texto o importe"
                  aria-label="Buscar en las líneas que te necesitan"
                />
                {filtrando && (
                  <button
                    type="button"
                    className={styles.campoX}
                    onClick={() => setConsulta('')}
                    aria-label="Vaciar la búsqueda"
                  >
                    <Icons.Close size={14} />
                  </button>
                )}
              </label>
              {atajos.length > 0 && (
                <div className={styles.atajos}>
                  {atajos.map((a) => (
                    <button
                      key={a.consulta}
                      type="button"
                      className={styles.atajo}
                      data-activo={consulta === a.consulta ? 'si' : 'no'}
                      onClick={() => setConsulta(consulta === a.consulta ? '' : a.consulta)}
                    >
                      {a.etiqueta} · {a.cuantas}
                    </button>
                  ))}
                </div>
              )}
              {visibles.length > 1 && (
                <button
                  type="button"
                  className={styles.enlace}
                  style={{ marginTop: 0 }}
                  onClick={() => setElegidas(new Set(visibles.map((l) => l.lineaId)))}
                >
                  <Icons.Check size={13} />
                  elegir las {visibles.length} que se ven
                </button>
              )}
            </div>
          )}

          {/* ── La barra · sólo cuando hay algo elegido que la justifique ── */}
          {enJuego.length > 0 && (
            <div className={styles.enBloque}>
              <span className={styles.enBloqueN}>
                {enJuego.length === 1 ? '1 elegida' : `${enJuego.length} elegidas`}
              </span>
              {/* Clasificar va PRIMERO · es lo que de verdad resuelve la línea.
                  Ignorar la aparta y traspasar la mueve; sólo clasificar dice
                  qué es, y es lo que el usuario viene a hacer. */}
              {onClasificarVarias && (
                <button
                  type="button"
                  className={`${styles.btnBloque} ${styles.btnBloqueFuerte}`}
                  onClick={() => onClasificarVarias(enJuego)}
                >
                  <Icons.Tag size={14} />
                  {enJuego.length === 1
                    ? 'Clasificar la 1 como…'
                    : `Clasificar las ${enJuego.length} como…`}
                </button>
              )}
              <button
                type="button"
                className={styles.btnBloque}
                onClick={() => {
                  onIgnorarVarias(enJuego);
                  setElegidas(new Set());
                }}
              >
                <Icons.Minus size={14} />
                {enJuego.length === 1 ? 'Ignorar la 1' : `Ignorar las ${enJuego.length}`}
              </button>
              {cabeTraspaso && (
                <label className={styles.bloqueSel}>
                  Son traspaso a
                  <select
                    className={styles.bloqueSelect}
                    value=""
                    aria-label="Son traspaso a la cuenta"
                    onChange={(e) => {
                      const destino = Number(e.target.value);
                      if (!destino) return;
                      onTraspasarVarias?.(enJuego, destino);
                      setElegidas(new Set());
                    }}
                  >
                    <option value="">elige la cuenta…</option>
                    {cuentasTraspaso.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className={styles.enlace}
                style={{ marginTop: 0 }}
                onClick={() => setElegidas(new Set())}
              >
                Quitar la selección
              </button>
            </div>
          )}

          <div className={styles.scroll}>
            {necesitan.length === 0 ? (
              <div className={styles.bloque}>
                <div className={styles.vacioBloque}>
                  Nada que preguntarte. Las {elCuadre.delBanco} líneas del banco están colocadas.
                </div>
              </div>
            ) : visibles.length === 0 ? (
              // Filtro sin resultados · se dice qué se buscó y se ofrece la
              // vuelta. Una lista vacía sin explicación parece una pantalla rota.
              <div className={styles.bloque}>
                <div className={styles.vacioBloque}>
                  Ninguna de las {necesitan.length} dice «{consulta.trim()}».
                </div>
                <button type="button" className={styles.enlace} onClick={() => setConsulta('')}>
                  <Icons.Refresh size={13} />
                  Quitar el filtro
                </button>
              </div>
            ) : (
              visibles.map((l) => (
                <TarjetaAccion
                  key={l.lineaId}
                  propuesta={
                    propuestas.get(l.lineaId) ?? {
                      tono: 'pregunta',
                      titular: 'No sé qué es · dímelo tú una vez',
                      ayuda: 'si subes la factura, la leo y relleno proveedor e importe solo',
                      seRecuerda: false,
                    }
                  }
                  elegible={{
                    etiqueta: l.textoBanco,
                    elegida: elegidas.has(l.lineaId),
                    onElegir: () => alternarElegida(l.lineaId),
                  }}
                >
                  {renderLinea(l)}
                </TarjetaAccion>
              ))
            )}
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.colCab}>
            <div className={styles.colT}>
              <Icons.Check size={16} />
              El resto · {elResto}
            </div>
            <div className={styles.colC}>nada que hacer</div>
          </div>
          <div className={styles.scroll}>
            <ColumnaResto
              resueltas={resueltas}
              personales={personales}
              ignoradas={ignoradas}
              aprendido={aprendido}
              onRecuperar={onRecuperar}
              onNoEsEsto={onNoEsEsto}
            />
          </div>
        </div>
      </div>

      {/* ── Pie ────────────────────────────────────────────────────────── */}
      <div className={styles.pie}>
        <div className={styles.pieNota} data-cuadra={elCuadre.cuadra ? 'si' : 'no'}>
          {elCuadre.cuadra ? (
            <>
              <b>
                {elCuadre.delBanco} del banco = {elCuadre.colocadas} colocadas.
              </b>{' '}
              Se crea lo que decidas de las {b.te_necesitan}; el resto queda como está. Nada se
              aparta ni se borra en silencio.
            </>
          ) : (
            <>
              <b>No cuadra.</b> {elCuadre.delBanco - elCuadre.colocadas} línea(s) del banco no han
              quedado colocadas · no se guarda hasta que cuadre.
            </>
          )}
        </div>
        <div className={styles.pieAcciones}>
          <button
            type="button"
            className={`${styles.btnPie} ${styles.btnPieOro}`}
            onClick={onGuardar}
            disabled={guardando}
          >
            <Icons.Check size={15} />
            {guardando ? 'Guardando…' : 'Guardar extracto'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default PanelConciliar;
