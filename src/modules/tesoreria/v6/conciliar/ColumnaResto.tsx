// «El resto» · la columna derecha · lo que NO necesita al usuario.
//
// Tres montones (resueltas · personal · ignorados) y el panel dorado de lo
// aprendido. Plegados de entrada: el extracto ya lo tiene el usuario en su
// banco, y reimprimirlo aquí sería enterrar las seis decisiones que sí importan
// bajo ciento y pico filas que no.
//
// PLEGADO NO ES CERRADO. Antes lo era, y estaba mal: «los ok que me das personal
// y no personal no veo lo que hay dentro, además si te equivocas ni puedo
// corregirlo». Tenía las dos razones. Un montón que ATLAS llena solo, que el
// usuario no puede abrir y del que no puede sacar nada no es un resumen: es un
// sitio donde las equivocaciones se guardan calladas. Peor cuanto mejor
// funciona el reconocedor, porque más cosas mete sin preguntar.
//
// Así que cada fila abre, dentro salen sus líneas con el texto literal del
// banco, y cada una lleva su «No es esto» — que no borra nada: devuelve la línea
// a «te necesitan», que es donde el usuario puede decidir. La vuelta atrás de
// «ignorar» sigue siendo «reactivar».

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
  onRecuperar: (lineaId: number) => void;
  /**
   * «No es esto» · el usuario corrige a ATLAS sobre una línea que ATLAS colocó
   * solo. La línea vuelve a «te necesitan». No borra ni oculta nada.
   */
  onNoEsEsto: (lineaId: number) => void;
}

/** Cuántas filas se enseñan antes del «ver las N» · lo que cabe sin scroll. */
const FILAS_VISIBLES = 5;

interface MontonProps {
  titulo: string;
  icono: React.ReactNode;
  iconoFila: React.ReactNode;
  claseIcono?: string;
  claseTitulo?: string;
  lineas: LineaExtracto[];
  vacio: string;
  conDetalle?: boolean;
  onNoEsEsto: (lineaId: number) => void;
}

/**
 * Un montón · la fila resumen y, al abrirla, las líneas que hay debajo.
 *
 * Los dos montones que ATLAS llena solo (resueltas y personal) son el mismo
 * componente porque tienen el mismo problema y merecen la misma salida. Lo
 * único que cambia entre ellos es el icono y si el renglón pequeño aporta algo.
 */
const Monton: React.FC<MontonProps> = ({
  titulo,
  icono,
  iconoFila,
  claseIcono,
  claseTitulo,
  lineas,
  vacio,
  conDetalle,
  onNoEsEsto,
}) => {
  const [verTodos, setVerTodos] = React.useState(false);
  const [abiertos, setAbiertos] = React.useState<ReadonlySet<string>>(new Set());

  const grupos = React.useMemo(() => agruparResueltas(lineas), [lineas]);
  const visibles = verTodos ? grupos : grupos.slice(0, FILAS_VISIBLES);

  const alternar = (clave: string) =>
    setAbiertos((previos) => {
      const siguiente = new Set(previos);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });

  return (
    <div className={styles.bloque}>
      <div className={styles.bloqueCab}>
        <div className={`${styles.bloqueT} ${claseTitulo ?? ''}`}>
          {icono}
          {titulo} · {lineas.length}
        </div>
      </div>
      {grupos.length === 0 ? (
        <div className={styles.vacioBloque}>{vacio}</div>
      ) : (
        <>
          {visibles.map((g) => {
            const abierto = abiertos.has(g.clave);
            return (
              <div key={g.clave} className={styles.grupo}>
                <button
                  type="button"
                  className={`${styles.fila} ${styles.filaAbrible}`}
                  onClick={() => alternar(g.clave)}
                  aria-expanded={abierto}
                >
                  <span className={`${styles.filaIco} ${claseIcono ?? ''}`} aria-hidden="true">
                    {iconoFila}
                  </span>
                  <span className={styles.filaTxt}>
                    <span className={styles.filaA}>
                      {g.cuantas > 1 ? `${g.cuantas} · ${g.titulo}` : g.titulo}
                    </span>
                    {conDetalle && g.detalle && <span className={styles.filaB}>{g.detalle}</span>}
                  </span>
                  <span className={styles.filaN}>{importeConSigno(g.total)}</span>
                  <span className={styles.filaChevron} aria-hidden="true">
                    <Icons.ChevronDown size={13} />
                  </span>
                </button>
                {abierto && (
                  <div className={styles.dentro}>
                    {g.lineas.map((l) => (
                      <div key={`${l.lineaId}:${l.movementId}`} className={styles.dentroFila}>
                        <span className={styles.dentroTxt}>
                          {/* El texto LITERAL del banco · es lo que el usuario
                              puede reconocer en su cuenta para decidir. */}
                          <span className={styles.dentroA}>{l.textoBanco}</span>
                          <span className={styles.dentroB}>{l.fecha}</span>
                        </span>
                        <span className={styles.dentroN}>{importeConSigno(l.importe)}</span>
                        <button
                          type="button"
                          className={styles.noEsEsto}
                          onClick={() => onNoEsEsto(l.lineaId)}
                        >
                          <Icons.Refresh size={12} />
                          No es esto
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {grupos.length > FILAS_VISIBLES && (
            <button type="button" className={styles.enlace} onClick={() => setVerTodos((v) => !v)}>
              <Icons.ChevronDown size={13} />
              {verTodos ? 'ver menos' : `ver las ${grupos.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
};

const ColumnaResto: React.FC<ColumnaRestoProps> = ({
  resueltas,
  personales,
  ignoradas,
  aprendido,
  onRecuperar,
  onNoEsEsto,
}) => {
  return (
    <>
      {/* ── Resueltas solas ─────────────────────────────────────────────── */}
      <Monton
        titulo="Resueltas solas"
        icono={<Icons.Success size={15} />}
        iconoFila={<Icons.Check size={13} />}
        claseTitulo={styles.bloqueTOk}
        lineas={resueltas}
        conDetalle
        vacio="Todavía ninguna. A medida que le digas qué es cada cosa, esta lista crece sola."
        onNoEsEsto={onNoEsEsto}
      />

      {/* ── Personal ────────────────────────────────────────────────────── */}
      {/* Que esto salga vacío hoy NO es un fallo de la pantalla: una línea solo
          cae aquí cuando el usuario ya enseñó que es suya. En una cuenta recién
          importada nadie ha enseñado nada todavía. */}
      <Monton
        titulo="Personal"
        icono={<Icons.Personal size={15} />}
        iconoFila={<Icons.CreditCard size={13} />}
        claseIcono={styles.filaIcoBrand}
        lineas={personales}
        vacio="Nada por ahora. Aquí caerá lo que ya me hayas dicho que es tuyo y no de un piso."
        onNoEsEsto={onNoEsEsto}
      />

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
            <div key={`${l.lineaId}:${l.movementId}`} className={styles.fila}>
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
                onClick={() => onRecuperar(l.lineaId)}
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
