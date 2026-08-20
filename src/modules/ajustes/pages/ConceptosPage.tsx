// Ajustes → Conceptos · la tabla de qué puede ser un gasto.
//
// Es la pantalla que faltaba: hasta ahora la clasificación vivía repartida en
// dos catálogos de código que nadie podía ver ni tocar, y cuando algo caía
// entre los dos —un seguro de vida de ámbito personal con familia de
// inmueble— desaparecía sin dejar rastro.
//
// Nace PLEGADA por familia. Son 60 conceptos: en lista abierta es un muro por
// el que hay que hacer scroll para encontrar nada, y lo que se viene a hacer
// aquí es tocar uno concreto, no leerlos todos.
//
// Lo editable es DELIBERADAMENTE poco, y la pantalla lo dice en vez de dejarlo
// adivinar: de un concepto de fábrica sólo el nombre, porque su familia decide
// su casilla AEAT y moverlo reescribiría en silencio cómo declara todo el que
// lo use. De los tuyos, todo menos el id.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import containerStyles from '../AjustesPage.module.css';
import styles from './ConceptosPage.module.css';
import {
  ambitosDe,
  conceptosEfectivos,
  donanteDe,
  familiasEfectivas,
} from '../../../services/conceptos/catalogoConceptos';
import type { Ambito, Concepto, FamiliaId } from '../../../services/conceptos/catalogoConceptos';
import {
  borrarConceptoPropio,
  borrarFamiliaPropia,
  cargarConceptosUsuario,
  crearConceptoPropio,
  crearFamiliaPropia,
  editarConceptoPropio,
  ocultar,
  renombrar,
  renombrarFamilia,
} from '../../../services/conceptos/conceptosUsuarioService';
import type { ConceptosUsuario } from '../../../services/conceptos/conceptosUsuarioService';
import { getCategoryByKey } from '../../../services/categoryCatalog';

const AMBITO_LABEL: Record<Ambito, string> = {
  personal: 'Tuyo',
  inmueble: 'De un inmueble',
};

/**
 * A qué casilla AEAT lleva ESTE concepto cuando el gasto es DE UN INMUEBLE.
 *
 * Sólo entonces. Un gasto tuyo —el IBI de tu casa, tu seguro de hogar— no se
 * declara: no hay rendimiento del que restarlo. El mismo concepto puede existir
 * en los dos ámbitos y sólo llevar casilla en uno, y enseñar la casilla en una
 * columna suelta se leía como que también aplicaba a los tuyos.
 */
function casillaDe(c: Concepto): string {
  if (!c.inmueble) return '—';
  if (c.inmueble.categoryKey === null) return 'se pregunta';
  return getCategoryByKey(c.inmueble.categoryKey)?.casillaAEAT ?? '—';
}

/**
 * Cómo se lee la casilla en una frase.
 *
 * La derrama no tiene casilla fija —depende de si la obra es conservación o
 * mejora, y eso lo dice el acta—, así que decir «casilla se pregunta» sería
 * llamar casilla a una pregunta.
 */
function fraseCasilla(c: Concepto): string {
  const casilla = casillaDe(c);
  return casilla === 'se pregunta' ? 'se pregunta al confirmarlo' : `casilla ${casilla}`;
}

/** Lo que se está editando ahora mismo · null = nadie. */
interface Edicion {
  id: string;
  familia: FamiliaId;
  label: string;
  ambitos: Ambito[];
  esPropio: boolean;
}

const ConceptosPage: React.FC = () => {
  const [datos, setDatos] = useState<ConceptosUsuario>({
    propios: [],
    ajustes: {},
    familias: [],
    ajustesFamilia: {},
  });
  const [cargando, setCargando] = useState(true);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  // Alta
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [nuevaFamilia, setNuevaFamilia] = useState<FamiliaId>('otros');
  const [nuevoLabel, setNuevoLabel] = useState('');
  const [nuevosAmbitos, setNuevosAmbitos] = useState<Ambito[]>(['personal']);
  // Tipos (carpetas) · P8b
  const [nuevoTipoAbierto, setNuevoTipoAbierto] = useState(false);
  const [nuevoTipoLabel, setNuevoTipoLabel] = useState('');
  const [renombrandoTipo, setRenombrandoTipo] = useState<{ id: string; label: string } | null>(null);

  const recargar = useCallback(async () => {
    setDatos(await cargarConceptosUsuario());
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar().catch((e) => {
      showToastV5(`No se pudieron cargar los conceptos · ${(e as Error).message}`, 'error');
      setCargando(false);
    });
  }, [recargar]);

  const propios = useMemo(() => new Set(datos.propios.map((p) => p.id)), [datos]);
  const familiasPropias = useMemo(
    () => new Set(datos.familias.map((f) => f.id)),
    [datos],
  );
  // `cargando` entra en las dependencias a propósito: la lista se recalcula
  // cuando el registro en memoria ya tiene aplicados los conceptos del usuario.
  const familias = useMemo(
    () => familiasEfectivas(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos, cargando],
  );
  const porFamilia = useMemo(
    () =>
      familias
        .map((f) => ({
          familia: f,
          conceptos: conceptosEfectivos().filter((c) => c.familia === f.id),
        }))
        // Un Tipo propio recién creado aún no tiene conceptos · se muestra para
        // poder colgarle uno. Uno de fábrica vacío no se pinta (no los hay).
        .filter((g) => g.conceptos.length > 0 || familiasPropias.has(g.familia.id)),
    [familias, familiasPropias],
  );

  const conAviso = async (accion: () => Promise<ConceptosUsuario>, exito: string) => {
    try {
      await accion();
      await recargar();
      showToastV5(exito, 'success');
      return true;
    } catch (e) {
      showToastV5((e as Error).message, 'error');
      return false;
    }
  };

  const alternarFamilia = (id: string) =>
    setAbiertas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const abrirEdicion = (c: Concepto) =>
    setEdicion({
      id: c.id,
      familia: c.familia,
      label: c.label,
      ambitos: ambitosDe(c),
      esPropio: propios.has(c.id),
    });

  const guardarEdicion = async () => {
    if (!edicion) return;
    const ok = edicion.esPropio
      ? await conAviso(
          () =>
            editarConceptoPropio(edicion.id, {
              familia: edicion.familia,
              label: edicion.label,
              ambitos: edicion.ambitos,
            }),
          `«${edicion.label.trim()}» guardado`,
        )
      : await conAviso(
          () => renombrar(edicion.id, edicion.label),
          `Ahora se llama «${edicion.label.trim()}»`,
        );
    if (ok) setEdicion(null);
  };

  // Sólo se ofrecen los ámbitos en los que esa familia tiene de quién heredar.
  const ambitosDeFamilia = (f: FamiliaId): Ambito[] =>
    (['personal', 'inmueble'] as Ambito[]).filter((a) => donanteDe(f, a));

  const ambitosPosibles = useMemo(() => ambitosDeFamilia(nuevaFamilia), [nuevaFamilia]);
  useEffect(() => {
    setNuevosAmbitos((prev) => {
      const validos = prev.filter((a) => ambitosPosibles.includes(a));
      return validos.length > 0 ? validos : ambitosPosibles.slice(0, 1);
    });
  }, [ambitosPosibles]);

  const onCrear = async () => {
    const ok = await conAviso(
      () => crearConceptoPropio(nuevaFamilia, nuevoLabel, nuevosAmbitos),
      `«${nuevoLabel.trim()}» añadido`,
    );
    if (!ok) return;
    // Se abre su familia para que se vea dónde ha caído.
    setAbiertas((prev) => new Set(prev).add(nuevaFamilia));
    setNuevoLabel('');
    setAltaAbierta(false);
  };

  const onCrearTipo = async () => {
    const ok = await conAviso(
      () => crearFamiliaPropia(nuevoTipoLabel),
      `Tipo «${nuevoTipoLabel.trim()}» creado`,
    );
    if (!ok) return;
    setNuevoTipoLabel('');
    setNuevoTipoAbierto(false);
  };

  const guardarRenombreTipo = async () => {
    if (!renombrandoTipo) return;
    const ok = await conAviso(
      () => renombrarFamilia(renombrandoTipo.id, renombrandoTipo.label),
      `Tipo renombrado a «${renombrandoTipo.label.trim()}»`,
    );
    if (ok) setRenombrandoTipo(null);
  };

  /** Los checkboxes de ámbito · los comparten el alta y la edición. */
  const ChecksAmbito: React.FC<{
    familia: FamiliaId;
    valor: Ambito[];
    onChange: (v: Ambito[]) => void;
  }> = ({ familia, valor, onChange }) => (
    <div className={styles.checks}>
      {ambitosDeFamilia(familia).map((a) => (
        <label key={a} className={styles.check}>
          <input
            type="checkbox"
            checked={valor.includes(a)}
            onChange={(e) => onChange(e.target.checked ? [...valor, a] : valor.filter((x) => x !== a))}
          />
          {AMBITO_LABEL[a]}
        </label>
      ))}
    </div>
  );

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Conceptos</h1>
          <div className={containerStyles.contentSub}>
            qué puede ser un gasto · abre una familia para ver los suyos · la casilla AEAT es sólo del gasto de un inmueble
          </div>
        </div>
        <div className={styles.headAcciones}>
          <button
            type="button"
            className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
            onClick={() => setNuevoTipoAbierto((v) => !v)}
          >
            <Icons.Plus size={14} strokeWidth={1.8} />
            Nuevo Tipo
          </button>
          <button
            type="button"
            className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
            onClick={() => setAltaAbierta((v) => !v)}
          >
            <Icons.Plus size={14} strokeWidth={1.8} />
            Añadir concepto
          </button>
        </div>
      </div>

      {nuevoTipoAbierto && (
        <div className={styles.alta}>
          <div className={styles.altaCampos}>
            <label className={styles.campo}>
              <span className={styles.lab}>Nombre del Tipo</span>
              <input
                className={styles.input}
                value={nuevoTipoLabel}
                onChange={(e) => setNuevoTipoLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onCrearTipo();
                }}
                placeholder="Cómo llamas a esta carpeta"
              />
            </label>
          </div>
          <p className={styles.nota}>
            Un Tipo es una carpeta para agrupar conceptos. Los que le cuelgues se clasifican como
            «Otros» hasta que la fiscalidad los afine · el catálogo es para saber de dónde sale el
            dinero.
          </p>
          <button
            type="button"
            className={`${containerStyles.btn} ${containerStyles.btnPrimary}`}
            onClick={onCrearTipo}
            disabled={!nuevoTipoLabel.trim()}
          >
            Crear Tipo
          </button>
        </div>
      )}

      {altaAbierta && (
        <div className={styles.alta}>
          <div className={styles.altaCampos}>
            <label className={styles.campo}>
              <span className={styles.lab}>Familia</span>
              <select
                className={styles.input}
                value={nuevaFamilia}
                onChange={(e) => setNuevaFamilia(e.target.value as FamiliaId)}
              >
                {familias.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.campo}>
              <span className={styles.lab}>Nombre</span>
              <input
                className={styles.input}
                value={nuevoLabel}
                onChange={(e) => setNuevoLabel(e.target.value)}
                placeholder="Cómo lo llamas tú"
              />
            </label>
            <div className={styles.campo}>
              <span className={styles.lab}>Dónde se usa</span>
              <ChecksAmbito familia={nuevaFamilia} valor={nuevosAmbitos} onChange={setNuevosAmbitos} />
            </div>
          </div>
          <p className={styles.nota}>
            Se clasificará como el resto de «{familias.find((f) => f.id === nuevaFamilia)?.label}»
            {nuevosAmbitos.includes('inmueble') &&
              donanteDe(nuevaFamilia, 'inmueble') &&
              ` · ${fraseCasilla(donanteDe(nuevaFamilia, 'inmueble') as Concepto)}`}
            . La casilla no se elige aquí: se hereda, para que dar de alta un concepto no pueda
            cambiar tu declaración.
          </p>
          <button
            type="button"
            className={`${containerStyles.btn} ${containerStyles.btnPrimary}`}
            onClick={onCrear}
            disabled={!nuevoLabel.trim() || nuevosAmbitos.length === 0}
          >
            Añadir
          </button>
        </div>
      )}

      {cargando ? (
        <div className={styles.empty}>Cargando…</div>
      ) : (
        porFamilia.map(({ familia, conceptos }) => {
          const abierta = abiertas.has(familia.id);
          const esPropia = familiasPropias.has(familia.id);
          const renombrando = renombrandoTipo?.id === familia.id;
          return (
            <section key={familia.id} className={styles.familia}>
              <div className={styles.familiaFila}>
                <button
                  type="button"
                  className={styles.familiaHead}
                  aria-expanded={abierta}
                  onClick={() => alternarFamilia(familia.id)}
                >
                  <Icons.ChevronRight
                    size={14}
                    strokeWidth={2}
                    className={abierta ? styles.chevronAbierto : styles.chevron}
                  />
                  {renombrando ? (
                    <input
                      className={styles.input}
                      value={renombrandoTipo!.label}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setRenombrandoTipo({ id: familia.id, label: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void guardarRenombreTipo();
                        if (e.key === 'Escape') setRenombrandoTipo(null);
                      }}
                      aria-label={`Nombre del Tipo ${familia.label}`}
                    />
                  ) : (
                    <>
                      <span className={styles.familiaLabel}>{familia.label}</span>
                      <span className={styles.familiaSub}>{familia.descripcion}</span>
                    </>
                  )}
                  <span className={styles.familiaCuenta}>{conceptos.length}</span>
                </button>
                <div className={styles.familiaAcciones}>
                  {renombrando ? (
                    <>
                      <button
                        type="button"
                        className={styles.accion}
                        onClick={() => void guardarRenombreTipo()}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        className={styles.accion}
                        onClick={() => setRenombrandoTipo(null)}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.accion}
                        onClick={() => setRenombrandoTipo({ id: familia.id, label: familia.label })}
                      >
                        Renombrar
                      </button>
                      {esPropia && (
                        <button
                          type="button"
                          className={styles.accion}
                          onClick={() =>
                            void conAviso(
                              () => borrarFamiliaPropia(familia.id),
                              `Tipo «${familia.label}» borrado`,
                            )
                          }
                        >
                          Borrar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {abierta && (
                <div className={styles.tabla}>
                  <div className={styles.cabecera}>
                    <span>Concepto</span>
                    <span>Gasto tuyo</span>
                    <span>Gasto de un inmueble</span>
                    <span />
                  </div>
                  {conceptos.map((c) => {
                    const esPropio = propios.has(c.id);
                    const editandoEste = edicion?.id === c.id;

                    if (editandoEste && edicion) {
                      return (
                        <div key={c.id} className={styles.filaEdicion}>
                          <div className={styles.altaCampos}>
                            <label className={styles.campo}>
                              <span className={styles.lab}>Nombre</span>
                              <input
                                className={styles.input}
                                value={edicion.label}
                                autoFocus
                                onChange={(e) => setEdicion({ ...edicion, label: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void guardarEdicion();
                                  if (e.key === 'Escape') setEdicion(null);
                                }}
                                aria-label={`Nombre de ${c.label}`}
                              />
                            </label>
                            {edicion.esPropio ? (
                              <>
                                <label className={styles.campo}>
                                  <span className={styles.lab}>Familia</span>
                                  <select
                                    className={styles.input}
                                    value={edicion.familia}
                                    onChange={(e) => {
                                      const f = e.target.value as FamiliaId;
                                      const posibles = ambitosDeFamilia(f);
                                      const validos = edicion.ambitos.filter((a) =>
                                        posibles.includes(a),
                                      );
                                      setEdicion({
                                        ...edicion,
                                        familia: f,
                                        ambitos: validos.length > 0 ? validos : posibles.slice(0, 1),
                                      });
                                    }}
                                  >
                                    {familias.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className={styles.campo}>
                                  <span className={styles.lab}>Dónde se usa</span>
                                  <ChecksAmbito
                                    familia={edicion.familia}
                                    valor={edicion.ambitos}
                                    onChange={(v) => setEdicion({ ...edicion, ambitos: v })}
                                  />
                                </div>
                              </>
                            ) : (
                              <div className={styles.campo}>
                                <span className={styles.lab}>Clasificación</span>
                                <div className={styles.soloLectura}>
                                  {familia.label}
                                  {c.personal && ' · como gasto tuyo no se declara'}
                                  {c.inmueble && ` · como gasto de un inmueble, ${fraseCasilla(c)}`}
                                </div>
                              </div>
                            )}
                          </div>
                          <p className={styles.nota}>
                            {edicion.esPropio
                              ? 'Su clasificación la hereda de la familia · cambiar de familia cambia también a qué casilla lleva.'
                              : 'De un concepto de fábrica sólo se cambia el nombre · su familia decide su casilla AEAT, y moverlo cambiaría cómo declara todo el que lo use.'}
                          </p>
                          <div className={styles.celdaAcciones}>
                            <button
                              type="button"
                              className={`${containerStyles.btn} ${containerStyles.btnPrimary}`}
                              onClick={() => void guardarEdicion()}
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              className={styles.accion}
                              onClick={() => setEdicion(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={c.id} className={c.oculto ? styles.filaOculta : styles.fila}>
                        <div className={styles.celdaNombre}>
                          <span className={styles.nombre}>{c.label}</span>
                          <span className={styles.id}>{c.id}</span>
                        </div>
                        <span className={c.personal ? styles.celdaSi : styles.celdaNo}>
                          {c.personal ? 'sí · no se declara' : 'no aplica'}
                        </span>
                        <span className={c.inmueble ? styles.celdaSi : styles.celdaNo}>
                          {c.inmueble ? `sí · ${fraseCasilla(c)}` : 'no aplica'}
                        </span>
                        <div className={styles.celdaAcciones}>
                          {esPropio && <span className={styles.tagPropio}>tuyo</span>}
                          <button
                            type="button"
                            className={styles.accion}
                            onClick={() => abrirEdicion(c)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={styles.accion}
                            onClick={() =>
                              void conAviso(
                                () => ocultar(c.id, !c.oculto),
                                c.oculto
                                  ? `«${c.label}» vuelve a ofrecerse`
                                  : `«${c.label}» ya no se ofrece`,
                              )
                            }
                          >
                            {c.oculto ? 'Mostrar' : 'Esconder'}
                          </button>
                          {esPropio && (
                            <button
                              type="button"
                              className={styles.accion}
                              onClick={() =>
                                void conAviso(
                                  () => borrarConceptoPropio(c.id),
                                  `«${c.label}» borrado`,
                                )
                              }
                            >
                              Borrar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}

      <p className={styles.pie}>
        La casilla AEAT es <strong>sólo del gasto de un inmueble</strong>. Un gasto tuyo no se
        declara —el IBI de tu casa no se resta de nada—, así que el mismo concepto puede llevar
        casilla como gasto de un piso alquilado y ninguna como gasto tuyo. La deducción por
        alquiler de tu vivienda habitual va por otro lado, en el propio gasto.
      </p>
      <p className={styles.pie}>
        Esconder no borra: los gastos que ya usan ese concepto lo conservan y se siguen clasificando
        igual. Sólo deja de ofrecerse al crear o editar un gasto. Los conceptos de fábrica no se
        pueden borrar, y uno tuyo tampoco mientras haya un gasto usándolo.
      </p>
    </>
  );
};

export default ConceptosPage;
export { ConceptosPage };
