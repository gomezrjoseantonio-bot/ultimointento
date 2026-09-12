// ============================================================================
// Conciliar · Zona 3 · «Colocado en su sitio» · lo que ATLAS colocó solo
// ============================================================================
//
// Entidades ya clasificadas con sus 4 ejes, plegadas: nombre, destino (piso,
// contrato, categoría), nº de movimientos e importe en tinta. Al desplegar, sus
// movimientos, cada uno con su fecha y su vuelta atrás («No es esto»).
//
// Validación por excepción (P2 · Jose): «OK» por entidad y «Está todo bien ·
// confirmar» dan por bueno EN PANTALLA (la entidad se retira de la lista);
// no escriben nada. Lo único que escribe sigue siendo «Guardar extracto».
//
// Los movimientos internos (traspasos, ahorro, efectivo) van en su entidad,
// marcados «no cuenta como gasto ni ingreso», con importe «neutro».
// ============================================================================

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { LineaExtracto } from '../extractoSesion';
import type { LoQueYaReconoce } from './loQueYaReconoce';
import { agruparPorEntidad, type Entidad } from './agruparPorEntidad';
import { nombreDeLineaResuelta } from './agruparResueltas';
import GrupoEntidad from './GrupoEntidad';
import { importeConSigno } from '../formatoV6';
import styles from './PanelConciliar.module.css';

export interface ZonaColocadoProps {
  resueltas: LineaExtracto[];
  personales: LineaExtracto[];
  ignoradas: LineaExtracto[];
  aprendido: LoQueYaReconoce;
  aliasPorInmueble?: ReadonlyMap<number, string>;
  /** Las entidades que el usuario ya dio por buenas · estado de VISTA. */
  dadasPorBuenas: ReadonlySet<string>;
  onDarPorBuena: (clave: string) => void;
  onDeshacerBuena: (clave: string) => void;
  onDarTodasPorBuenas: (claves: string[]) => void;
  /** Devuelve una línea ignorada a la circulación (§4.7). */
  onRecuperar: (lineaId: number) => void;
  /** «No es esto» · la línea vuelve a «Confirma el destino». No borra ni oculta nada. */
  onNoEsEsto: (lineaId: number) => void;
}

/** Cuántas entidades se enseñan antes del «ver todas» · lo que se lee de un vistazo. */
const ENTIDADES_VISIBLES = 8;

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y.slice(2)}` : iso;
}

const Detalle: React.FC<{ e: Entidad; onNoEsEsto: (lineaId: number) => void }> = ({ e, onNoEsEsto }) => (
  <>
    {e.lineas.map((l) => (
      <div key={l.lineaId} className={styles.dentroFila}>
        <span className={styles.dentroF}>{fechaCorta(l.fecha)}</span>
        <span className={styles.dentroTxt}>
          {/* El texto LITERAL del banco · es lo que el usuario reconoce en su cuenta. */}
          <span className={styles.dentroA}>{l.textoBanco}</span>
          <span className={styles.dentroB}>{nombreDeLineaResuelta(l)}</span>
        </span>
        <span className={styles.dentroN}>{importeConSigno(l.importe)}</span>
        <button type="button" className={styles.noEsEsto} onClick={() => onNoEsEsto(l.lineaId)}>
          <Icons.Refresh size={12} />
          No es esto
        </button>
      </div>
    ))}
    {e.lineas.length > 1 && (
      <div className={styles.dentroPie}>
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnMini}`} onClick={() => e.lineas.forEach((l) => onNoEsEsto(l.lineaId))}>
          <Icons.Refresh size={13} />
          Reasignar {e.lineas.length === 1 ? 'este' : `los ${e.lineas.length}`}
        </button>
      </div>
    )}
  </>
);

const ZonaColocado: React.FC<ZonaColocadoProps> = ({
  resueltas,
  personales,
  ignoradas,
  aprendido,
  aliasPorInmueble,
  dadasPorBuenas,
  onDarPorBuena,
  onDeshacerBuena,
  onDarTodasPorBuenas,
  onRecuperar,
  onNoEsEsto,
}) => {
  const [verTodas, setVerTodas] = React.useState(false);
  const [abiertas, setAbiertas] = React.useState<ReadonlySet<string>>(new Set());

  const entidades = React.useMemo(
    () => agruparPorEntidad([...resueltas, ...personales], aliasPorInmueble),
    [resueltas, personales, aliasPorInmueble],
  );
  const pendientes = entidades.filter((e) => !dadasPorBuenas.has(e.clave));
  const buenas = entidades.filter((e) => dadasPorBuenas.has(e.clave));
  const visibles = verTodas ? pendientes : pendientes.slice(0, ENTIDADES_VISIBLES);
  const colocadas = resueltas.length + personales.length;

  const alternar = (clave: string) =>
    setAbiertas((previas) => {
      const siguiente = new Set(previas);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });

  return (
    <div className={styles.sec} data-testid="zona-colocado">
      <div className={styles.secTitle}>
        <h2>Colocado en su sitio</h2>
        <span className={styles.secN}>{colocadas}</span>
      </div>
      <div className={styles.secNota}>
        Cada punto en su piso · cada cobro en su contrato · dale el visto bueno y desaparecen · corrige solo si algo falla
      </div>

      {pendientes.length > 0 && (
        <div className={styles.barraConfirmar}>
          <Icons.Check size={18} />
          <div className={styles.barraTxt}>
            ATLAS colocó{' '}
            <strong>
              {pendientes.reduce((n, e) => n + e.cuantas, 0)} movimientos en {pendientes.length}{' '}
              {pendientes.length === 1 ? 'entidad' : 'entidades'}
            </strong>{' '}
            · si está bien, dales el visto bueno de una vez
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOro}`}
            onClick={() => onDarTodasPorBuenas(pendientes.map((e) => e.clave))}
          >
            <Icons.Check size={14} />
            Está todo bien · confirmar
          </button>
        </div>
      )}

      {entidades.length === 0 && (
        <div className={styles.vacioBloque}>
          Todavía nada. A medida que le digas qué es cada cosa, esta lista crece sola. Aquí caerá lo que ya me hayas dicho que es tuyo y lo que reconozca por su cuenta.
        </div>
      )}

      {visibles.map((e) => (
        <GrupoEntidad
          key={e.clave}
          entidad={e}
          variante="colocado"
          abierta={abiertas.has(e.clave)}
          onAbrir={() => alternar(e.clave)}
          acciones={
            <button type="button" className={styles.entOk} onClick={() => onDarPorBuena(e.clave)} aria-label={`OK · ${e.nombre}`}>
              <Icons.Check size={14} />
              OK
            </button>
          }
        >
          <Detalle e={e} onNoEsEsto={onNoEsEsto} />
        </GrupoEntidad>
      ))}
      {pendientes.length > ENTIDADES_VISIBLES && (
        <button type="button" className={styles.enlace} onClick={() => setVerTodas((v) => !v)}>
          <Icons.ChevronDown size={13} />
          {verTodas ? 'ver menos' : `… ${pendientes.length - ENTIDADES_VISIBLES} entidades más · ver todas`}
        </button>
      )}

      {buenas.length > 0 && (
        <details className={styles.buenas}>
          <summary>
            <Icons.Check size={13} />
            {buenas.length === 1 ? '1 entidad dada por buena' : `${buenas.length} entidades dadas por buenas`} ·{' '}
            {buenas.reduce((n, e) => n + e.cuantas, 0)} movimientos · <u>ver</u>
          </summary>
          {buenas.map((e) => (
            <div key={e.clave} className={styles.fila}>
              <span className={`${styles.filaIco} ${styles.filaIcoBrand}`} aria-hidden="true">
                <Icons.Check size={13} />
              </span>
              <span className={styles.filaTxt}>
                <span className={styles.filaA}>{e.nombre}</span>
                <span className={styles.filaB}>{e.destino} · {e.cuantas} {e.cuantas === 1 ? 'movimiento' : 'movimientos'}</span>
              </span>
              <span className={styles.filaN}>{e.interno ? 'neutro' : importeConSigno(e.total)}</span>
              <button type="button" className={styles.enlace} style={{ marginTop: 0 }} onClick={() => onDeshacerBuena(e.clave)}>
                <Icons.Undo size={13} />
                deshacer
              </button>
            </div>
          ))}
        </details>
      )}

      {/* ── Ignorados · con la puerta de vuelta ─────────────────────────── */}
      {ignoradas.length > 0 && (
        <div className={`${styles.bloque} ${styles.bloqueSuelto}`}>
          <div className={styles.bloqueCab}>
            <div className={styles.bloqueT}>
              <Icons.Minus size={15} />
              Ignorados · {ignoradas.length}
            </div>
          </div>
          {ignoradas.map((l) => (
            <div key={l.lineaId} className={styles.fila}>
              <span className={`${styles.filaIco} ${styles.filaIcoMudo}`} aria-hidden="true">
                <Icons.Minus size={13} />
              </span>
              <span className={styles.filaTxt}>
                <span className={styles.filaA}>{l.textoBanco}</span>
                <span className={styles.filaB}>{l.fecha}</span>
              </span>
              <button type="button" className={styles.enlace} style={{ marginTop: 0 }} onClick={() => onRecuperar(l.lineaId)}>
                <Icons.Refresh size={13} />
                reactivar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── La próxima vez, sola ────────────────────────────────────────── */}
      <div className={`${styles.bloque} ${styles.bloqueSuelto} ${styles.aprende}`}>
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
          Lo que confirmes hoy, el próximo extracto de esta cuenta ya no te lo pregunta. Da igual que sea de este mes o de hace dos años: el camino es el mismo.
        </div>
      </div>
    </div>
  );
};

export default ZonaColocado;
