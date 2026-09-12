// ============================================================================
// Conciliar extracto · LA PANTALLA (mockup `mockup-conciliacion_11.html`)
// ============================================================================
//
// Tres zonas, agrupando por ENTIDAD (un CUPS, un contrato, una persona, «los
// traspasos entre tus cuentas»), no por texto del banco ni por familia:
//
//   1 · HERO navy · la cuenta, el rango real, el saldo del último día y lo
//       que entró y salió con sus familias gordas.
//   2 · «Confirma el destino» · las entidades que piden decisión. Una respuesta
//       coloca todos sus movimientos.
//   3 · «Colocado en su sitio» · lo que ATLAS colocó solo, plegado, con visto
//       bueno en bloque y por entidad. Se corrige solo lo que falle.
//
// Esta pantalla no escribe nada. Recibe el estado de la sesión y devuelve los
// gestos del usuario a quien los sabe aplicar (el drawer, que sigue siendo el
// dueño del `confirmDecisions`). `renderLinea` es una función que pasa el
// drawer: así el `LineaExtractoItem` de siempre —con sus acciones ya
// probadas— sigue montándose donde están sus manejadores. «OK» y «Está todo
// bien» son estado de VISTA (P2 · Jose): lo único que escribe es Guardar.
// ============================================================================

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { LineaExtracto } from '../extractoSesion';
import type { Cuadre } from '../conciliarBuckets';
import type { Propuesta } from './propuestaDeLinea';
import type { LoQueYaReconoce } from './loQueYaReconoce';
import type { LineaExtractoPersistida } from '../../../../services/db/types-lineasExtracto';
import type { PropuestaDeApertura } from '../../../../services/aperturaDerivada';
import HeroConciliar from './HeroConciliar';
import TarjetaAccion from './TarjetaAccion';
import ZonaColocado from './ZonaColocado';
import YaEstaban from './YaEstaban';
import { agruparPorEntidad, resumenDelFlujo } from './agruparPorEntidad';
import { atajosDeBusqueda, filtrarPorTexto } from './buscarLineas';
import styles from './PanelConciliar.module.css';

export interface PanelConciliarProps {
  /** El nombre de la cuenta · «Santander Alquileres». */
  titularCuenta: string;
  elCuadre: Cuadre;
  necesitan: LineaExtracto[];
  resueltas: LineaExtracto[];
  personales: LineaExtracto[];
  ignoradas: LineaExtracto[];
  propuestas: Map<number, Propuesta>;
  aprendido: LoQueYaReconoce;
  avisos: string[];
  /** La pregunta del arrastre con tope, si la hay · va junto a los avisos. */
  pregunta?: React.ReactNode;
  error: string | null;
  guardando: boolean;
  /**
   * §31 · el saldo que dice el banco a la línea más reciente, si el fichero lo
   * trae · solo para el hero. El aviso de cuadre/apertura NO se pinta aquí
   * (Jose · 12 sep): el saldo es un debe aparte y no ocupa media pantalla.
   */
  apertura?: PropuestaDeApertura | null;
  /** Las filas del fichero que ya estaban en ATLAS · se enseñan plegadas. */
  yaEstaban?: ReadonlyArray<LineaExtractoPersistida>;
  /** Los pisos del usuario · para los botones de piso de una entidad. */
  inmuebles?: ReadonlyArray<{ id: number; alias: string }>;
  /** El drawer monta aquí su `LineaExtractoItem`, con sus manejadores. */
  renderLinea: (linea: LineaExtracto) => React.ReactNode;
  onRecuperar: (lineaId: number) => void;
  /** «No es esto» sobre una línea que ATLAS colocó solo · vuelve a «Confirma el destino». */
  onNoEsEsto: (lineaId: number) => void;
  onIgnorarVarias: (lineaIds: number[]) => void;
  cuentasTraspaso?: Array<{ id: number; nombre: string }>;
  onTraspasarVarias?: (lineaIds: number[], cuentaDestinoId: number) => void;
  /** «Clasificar los N como…» · abre la ficha UNA vez para todos. */
  onClasificarVarias?: (lineaIds: number[]) => void;
  /** El botón de piso · la misma ficha, prerrellenada con ese piso (`null` = personal). */
  onClasificarVariasEnPiso?: (lineaIds: number[], inmuebleId: number | null) => void;
  onGuardar: () => void;
  onOtroFichero: () => void;
}

const SIN_PROPUESTA: Propuesta = {
  tono: 'pregunta',
  titular: 'No sé qué es · dímelo tú una vez',
  ayuda: 'si subes la factura, la leo y relleno proveedor e importe solo',
  seRecuerda: false,
};

function alternarEn(previas: ReadonlySet<string>, clave: string): Set<string> {
  const siguiente = new Set(previas);
  if (siguiente.has(clave)) siguiente.delete(clave);
  else siguiente.add(clave);
  return siguiente;
}

const PanelConciliar: React.FC<PanelConciliarProps> = ({
  titularCuenta,
  elCuadre,
  necesitan,
  resueltas,
  personales,
  ignoradas,
  propuestas,
  aprendido,
  avisos,
  pregunta,
  error,
  guardando,
  apertura,
  yaEstaban = [],
  inmuebles = [],
  renderLinea,
  onRecuperar,
  onNoEsEsto,
  onIgnorarVarias,
  cuentasTraspaso = [],
  onTraspasarVarias,
  onClasificarVarias,
  onClasificarVariasEnPiso,
  onGuardar,
  onOtroFichero,
}) => {
  const b = elCuadre.porBucket;

  // ── Estado de VISTA · no sobrevive a guardar ni tiene por qué ──────────
  const [consulta, setConsulta] = React.useState('');
  const [elegidas, setElegidas] = React.useState<ReadonlySet<string>>(new Set());
  const [abiertas, setAbiertas] = React.useState<ReadonlySet<string>>(new Set());
  const [dadasPorBuenas, setDadasPorBuenas] = React.useState<ReadonlySet<string>>(new Set());

  const aliasPorInmueble = React.useMemo(
    () => new Map(inmuebles.map((i) => [i.id, i.alias] as const)),
    [inmuebles],
  );

  // El hero · todo lo que trae el fichero, ignoradas incluidas (son dinero del banco).
  const flujo = React.useMemo(
    () => resumenDelFlujo([...necesitan, ...resueltas, ...personales, ...ignoradas]),
    [necesitan, resueltas, personales, ignoradas],
  );
  const saldo = apertura ? { fecha: apertura.fecha, importe: apertura.saldoBanco } : null;

  // ── Zona 2 · buscar estrecha, la casilla acumula, la barra remata ────────
  const atajos = React.useMemo(() => atajosDeBusqueda(necesitan), [necesitan]);
  const visibles = React.useMemo(() => filtrarPorTexto(necesitan, consulta), [necesitan, consulta]);
  const entidades = React.useMemo(() => agruparPorEntidad(visibles, aliasPorInmueble), [visibles, aliasPorInmueble]);
  const filtrando = consulta.trim().length > 0;

  // Lo que la barra puede tocar es lo elegido QUE SE VE: lo que no se ve, no se toca.
  const enJuego = React.useMemo(
    () => entidades.filter((e) => elegidas.has(e.clave)).flatMap((e) => e.lineas.map((l) => l.lineaId)),
    [entidades, elegidas],
  );
  const todoSonCargos =
    enJuego.length > 0 && entidades.every((e) => !elegidas.has(e.clave) || e.lineas.every((l) => l.importe < 0));
  const cabeTraspaso = todoSonCargos && cuentasTraspaso.length > 0 && onTraspasarVarias != null;

  // P2 · cuando ya no queda nada por confirmar y todo se dio por bueno, Guardar es el paso obvio.
  const colocadas = React.useMemo(
    () => agruparPorEntidad([...resueltas, ...personales], aliasPorInmueble),
    [resueltas, personales, aliasPorInmueble],
  );
  const todoVisto = necesitan.length === 0 && colocadas.every((e) => dadasPorBuenas.has(e.clave));

  return (
    <section className={styles.superficie} aria-label="Conciliar extracto">
      <div className={styles.scroll}>
        <HeroConciliar nombreCuenta={titularCuenta} flujo={flujo} saldo={saldo} onOtroFichero={onOtroFichero} />

        {avisos.map((a, i) => (
          <div key={i} className={styles.aviso}>
            {a}
          </div>
        ))}
        {pregunta}
        {error && <div className={`${styles.aviso} ${styles.avisoError}`}>{error}</div>}
        <YaEstaban lineas={yaEstaban} />

        {/* ── Zona 2 · Confirma el destino ─────────────────────────────── */}
        <div className={styles.sec} data-testid="zona-confirmar">
          <div className={styles.secTitle}>
            <h2>Confirma el destino</h2>
            <span className={`${styles.secN} ${necesitan.length > 0 ? styles.secNWarn : ''}`}>
              {filtrando ? `${entidades.length} de ` : ''}
              {agruparPorEntidad(necesitan).length}
            </span>
          </div>
          <div className={styles.secNota}>
            {necesitan.length === 0
              ? `Nada que preguntarte. Las ${elCuadre.delBanco} líneas del banco están colocadas.`
              : 'ATLAS agrupó por entidad · confirma adónde va cada una y coloca todos sus movimientos de golpe'}
          </div>

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
                  aria-label="Buscar en las líneas que piden decisión"
                />
                {filtrando && (
                  <button type="button" className={styles.campoX} onClick={() => setConsulta('')} aria-label="Vaciar la búsqueda">
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
              {entidades.length > 1 && (
                <button
                  type="button"
                  className={styles.enlace}
                  style={{ marginTop: 0 }}
                  onClick={() => setElegidas(new Set(entidades.map((e) => e.clave)))}
                >
                  <Icons.Check size={13} />
                  elegir las {entidades.length} entidades que se ven
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
              {onClasificarVarias && (
                <button type="button" className={`${styles.btnBloque} ${styles.btnBloqueFuerte}`} onClick={() => onClasificarVarias(enJuego)}>
                  <Icons.Tag size={14} />
                  {enJuego.length === 1 ? 'Clasificar la 1 como…' : `Clasificar las ${enJuego.length} como…`}
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
              <button type="button" className={styles.enlace} style={{ marginTop: 0 }} onClick={() => setElegidas(new Set())}>
                Quitar la selección
              </button>
            </div>
          )}

          {necesitan.length > 0 && visibles.length === 0 && (
            // Filtro sin resultados · se dice qué se buscó y se ofrece la vuelta.
            <div className={styles.bloque}>
              <div className={styles.vacioBloque}>Ninguna de las {necesitan.length} dice «{consulta.trim()}».</div>
              <button type="button" className={styles.enlace} onClick={() => setConsulta('')}>
                <Icons.Refresh size={13} />
                Quitar el filtro
              </button>
            </div>
          )}

          {entidades.map((e) => (
            <TarjetaAccion
              key={e.clave}
              entidad={e}
              propuesta={propuestas.get(e.lineas[0].lineaId) ?? SIN_PROPUESTA}
              abierta={abiertas.has(e.clave)}
              onAbrir={() => setAbiertas((p) => alternarEn(p, e.clave))}
              elegible={{ elegida: elegidas.has(e.clave), onElegir: () => setElegidas((p) => alternarEn(p, e.clave)) }}
              inmuebles={inmuebles}
              cuentasTraspaso={cuentasTraspaso}
              onClasificar={(ids) => onClasificarVarias?.(ids)}
              onClasificarEnPiso={onClasificarVariasEnPiso}
              onIgnorar={onIgnorarVarias}
              onTraspasar={onTraspasarVarias}
              renderLinea={renderLinea}
            />
          ))}
        </div>

        {/* ── Zona 3 · Colocado en su sitio ────────────────────────────── */}
        <ZonaColocado
          resueltas={resueltas}
          personales={personales}
          ignoradas={ignoradas}
          aprendido={aprendido}
          aliasPorInmueble={aliasPorInmueble}
          dadasPorBuenas={dadasPorBuenas}
          onDarPorBuena={(clave) => setDadasPorBuenas((p) => new Set(p).add(clave))}
          onDeshacerBuena={(clave) =>
            setDadasPorBuenas((p) => {
              const s = new Set(p);
              s.delete(clave);
              return s;
            })
          }
          onDarTodasPorBuenas={(claves) => setDadasPorBuenas((p) => new Set([...Array.from(p), ...claves]))}
          onRecuperar={onRecuperar}
          onNoEsEsto={onNoEsEsto}
        />
      </div>

      {/* ── Pie · el único botón que escribe ──────────────────────────── */}
      <div className={`${styles.pie} ${todoVisto ? styles.pieDestacado : ''}`}>
        <div className={styles.pieNota} data-cuadra={elCuadre.cuadra ? 'si' : 'no'}>
          {elCuadre.cuadra ? (
            <>
              <b>
                {elCuadre.delBanco} del banco = {elCuadre.colocadas} colocadas.
              </b>{' '}
              {todoVisto
                ? 'Todo confirmado · guarda y esta cuenta queda conciliada.'
                : `Se crea lo que decidas de las ${b.te_necesitan}; el resto queda como está. Nada se aparta ni se borra en silencio.`}
            </>
          ) : (
            <>
              <b>No cuadra.</b> {elCuadre.delBanco - elCuadre.colocadas} línea(s) del banco no han quedado colocadas · no se
              guarda hasta que cuadre.
            </>
          )}
        </div>
        <div className={styles.pieAcciones}>
          <button type="button" className={`${styles.btnPie} ${styles.btnPieOro}`} onClick={onGuardar} disabled={guardando}>
            <Icons.Check size={15} />
            {guardando ? 'Guardando…' : 'Guardar extracto'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default PanelConciliar;
