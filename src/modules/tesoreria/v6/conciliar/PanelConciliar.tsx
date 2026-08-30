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
import ColumnaResto from './ColumnaResto';
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
  /** El drawer monta aquí su `LineaExtractoItem`, con sus manejadores. */
  renderLinea: (linea: LineaExtracto) => React.ReactNode;
  onRecuperar: (movementId: number) => void;
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
  renderLinea,
  onRecuperar,
  onGuardar,
  onOtroFichero,
}) => {
  const total = elCuadre.delBanco;
  const b = elCuadre.porBucket;
  const elResto = b.resueltas + b.personal + b.ignorados;

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

      {/* ── Cuerpo · dos columnas, cada una con su scroll ──────────────── */}
      <div className={styles.cuerpo}>
        <div className={styles.col}>
          <div className={styles.colCab}>
            <div className={styles.colT}>
              <Icons.Clock size={16} />
              Te necesitan · una vez cada una
            </div>
            <div className={styles.colC}>responder crea lo que falta · y no se vuelve a preguntar</div>
          </div>
          <div className={styles.scroll}>
            {necesitan.length === 0 ? (
              <div className={styles.bloque}>
                <div className={styles.vacioBloque}>
                  Nada que preguntarte. Las {elCuadre.delBanco} líneas del banco están colocadas.
                </div>
              </div>
            ) : (
              necesitan.map((l) => (
                <TarjetaAccion
                  key={l.movementId}
                  propuesta={
                    propuestas.get(l.movementId) ?? {
                      tono: 'pregunta',
                      titular: 'No sé qué es · dímelo tú una vez',
                      ayuda: 'si subes la factura, la leo y relleno proveedor e importe solo',
                      seRecuerda: false,
                    }
                  }
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
