// «El resto» · la columna derecha · lo que NO necesita al usuario.
//
// Tres montones cerrados (resueltas · personal · ignorados) y el panel dorado de
// lo aprendido. Ninguno de los tres lista línea a línea: el extracto ya lo tiene
// el usuario en su banco, y reimprimirlo aquí sería enterrar las seis decisiones
// que sí importan bajo ciento y pico filas que no.
//
// Los tres montones son de LECTURA salvo «reactivar», que es la vuelta atrás de
// la única acción destructiva-en-apariencia que ofrece la pantalla.

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { LineaExtracto } from '../extractoSesion';
import { agruparResueltas } from './agruparResueltas';
import type { LoQueYaReconoce } from './loQueYaReconoce';
import { importeConSigno } from '../formatoV6';
import styles from './PanelConciliar.module.css';

export interface ColumnaRestoProps {
  resueltas: LineaExtracto[];
  personales: LineaExtracto[];
  ignoradas: LineaExtracto[];
  aprendido: LoQueYaReconoce;
  /** Devuelve una línea ignorada a la circulación (§4.7). */
  onRecuperar: (movementId: number) => void;
}

/** Cuántas filas se enseñan antes del «ver las N» · lo que cabe sin scroll. */
const FILAS_VISIBLES = 5;

const ColumnaResto: React.FC<ColumnaRestoProps> = ({
  resueltas,
  personales,
  ignoradas,
  aprendido,
  onRecuperar,
}) => {
  const [verTodasResueltas, setVerTodasResueltas] = React.useState(false);
  const [verTodasPersonales, setVerTodasPersonales] = React.useState(false);

  const gruposResueltas = React.useMemo(() => agruparResueltas(resueltas), [resueltas]);
  const gruposPersonales = React.useMemo(() => agruparResueltas(personales), [personales]);

  const visiblesResueltas = verTodasResueltas
    ? gruposResueltas
    : gruposResueltas.slice(0, FILAS_VISIBLES);
  const visiblesPersonales = verTodasPersonales
    ? gruposPersonales
    : gruposPersonales.slice(0, FILAS_VISIBLES);

  return (
    <>
      {/* ── Resueltas solas ─────────────────────────────────────────────── */}
      <div className={styles.bloque}>
        <div className={styles.bloqueCab}>
          <div className={`${styles.bloqueT} ${styles.bloqueTOk}`}>
            <Icons.Success size={15} />
            Resueltas solas · {resueltas.length}
          </div>
        </div>
        {gruposResueltas.length === 0 ? (
          <div className={styles.vacioBloque}>
            Todavía ninguna. A medida que le digas qué es cada cosa, esta lista crece sola.
          </div>
        ) : (
          <>
            {visiblesResueltas.map((g) => (
              <div key={g.clave} className={styles.fila}>
                <span className={styles.filaIco} aria-hidden="true">
                  <Icons.Check size={13} />
                </span>
                <span className={styles.filaTxt}>
                  <span className={styles.filaA}>
                    {g.cuantas > 1 ? `${g.cuantas} · ${g.titulo}` : g.titulo}
                  </span>
                  <span className={styles.filaB}>{g.detalle}</span>
                </span>
                <span className={styles.filaN}>{importeConSigno(g.total)}</span>
              </div>
            ))}
            {gruposResueltas.length > FILAS_VISIBLES && (
              <button
                type="button"
                className={styles.enlace}
                onClick={() => setVerTodasResueltas((v) => !v)}
              >
                <Icons.ChevronDown size={13} />
                {verTodasResueltas ? 'ver menos' : `ver las ${gruposResueltas.length}`}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Personal ────────────────────────────────────────────────────── */}
      <div className={styles.bloque}>
        <div className={styles.bloqueCab}>
          <div className={styles.bloqueT}>
            <Icons.Personal size={15} />
            Personal · {personales.length}
          </div>
        </div>
        {gruposPersonales.length === 0 ? (
          // Que esto salga vacío hoy NO es un fallo de la pantalla: una línea
          // solo cae aquí cuando el usuario ya enseñó que es suya. En una cuenta
          // recién importada nadie ha enseñado nada todavía.
          <div className={styles.vacioBloque}>
            Nada por ahora. Aquí caerá lo que ya me hayas dicho que es tuyo y no de un piso.
          </div>
        ) : (
          <>
            {visiblesPersonales.map((g) => (
              <div key={g.clave} className={styles.fila}>
                <span className={`${styles.filaIco} ${styles.filaIcoBrand}`} aria-hidden="true">
                  <Icons.CreditCard size={13} />
                </span>
                <span className={styles.filaTxt}>
                  <span className={styles.filaA}>
                    {g.cuantas > 1 ? `${g.cuantas} · ${g.titulo}` : g.titulo}
                  </span>
                </span>
                <span className={styles.filaN}>{importeConSigno(g.total)}</span>
              </div>
            ))}
            {gruposPersonales.length > FILAS_VISIBLES && (
              <button
                type="button"
                className={styles.enlace}
                onClick={() => setVerTodasPersonales((v) => !v)}
              >
                <Icons.ChevronDown size={13} />
                {verTodasPersonales ? 'ver menos' : `ver las ${gruposPersonales.length}`}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Ignorados · con la puerta de vuelta ─────────────────────────── */}
      <div className={styles.bloque}>
        <div className={styles.bloqueCab}>
          <div className={styles.bloqueT}>
            <Icons.Minus size={15} />
            Ignorados · {ignoradas.length}
          </div>
        </div>
        {ignoradas.length === 0 ? (
          <div className={styles.vacioBloque}>Ninguna. Nada se aparta sin que tú lo digas.</div>
        ) : (
          ignoradas.map((l) => (
            <div key={l.movementId} className={styles.fila}>
              <span className={`${styles.filaIco} ${styles.filaIcoMudo}`} aria-hidden="true">
                <Icons.Minus size={13} />
              </span>
              <span className={styles.filaTxt}>
                <span className={styles.filaA}>{l.textoBanco}</span>
                <span className={styles.filaB}>{l.fecha}</span>
              </span>
              <button
                type="button"
                className={styles.enlace}
                style={{ marginTop: 0 }}
                onClick={() => onRecuperar(l.movementId)}
              >
                <Icons.Refresh size={13} />
                reactivar
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── La próxima vez, sola ────────────────────────────────────────── */}
      <div className={`${styles.bloque} ${styles.aprende}`}>
        <div className={styles.bloqueCab}>
          <div className={styles.bloqueT}>
            <Icons.Lightbulb size={15} />
            La próxima vez, sola
          </div>
        </div>
        {aprendido.nuevas.map((c, i) => (
          <div key={c.id ?? `n${i}`} className={styles.aprendida}>
            <Icons.Check size={14} />
            <span>
              <b>{c.quien}</b> → {c.enQue}
            </span>
          </div>
        ))}
        {aprendido.deAntes > 0 && (
          <div className={`${styles.aprendida} ${styles.aprendidaVieja}`}>
            <Icons.Clock size={14} />
            <span>y otras {aprendido.deAntes} cosas que ya reconoce de antes</span>
          </div>
        )}
        {aprendido.total === 0 && (
          <div className={styles.vacioBloque}>
            Todavía no reconozco nada de esta cuenta. Lo que contestes hoy es lo que aprendo.
          </div>
        )}
        <div className={styles.aprendeNota}>
          Lo que confirmes hoy, el próximo extracto de esta cuenta ya no te lo pregunta. Da igual
          que sea de este mes o de hace dos años: el camino es el mismo.
        </div>
      </div>
    </>
  );
};

export default ColumnaResto;
