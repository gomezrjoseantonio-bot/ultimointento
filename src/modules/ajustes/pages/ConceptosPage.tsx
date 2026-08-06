// Ajustes → Conceptos · la tabla de qué puede ser un gasto.
//
// Es la pantalla que faltaba: hasta ahora la clasificación vivía repartida en
// dos catálogos de código que nadie podía ver ni tocar, y cuando algo caía
// entre los dos —un seguro de vida de ámbito personal con familia de
// inmueble— desaparecía sin dejar rastro. Aquí se ve entera, con la casilla
// AEAT a la que lleva cada concepto y cuántos gastos lo usan.
//
// Lo editable es DELIBERADAMENTE poco: el nombre y si se ofrece o no. La
// proyección —categoría y casilla— no se teclea; un concepto propio hereda la
// de su familia. Poder escribir una casilla desde Ajustes sería poder cambiar
// la declaración desde Ajustes.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import containerStyles from '../AjustesPage.module.css';
import styles from './ConceptosPage.module.css';
import {
  FAMILIAS,
  ambitosDe,
  conceptosEfectivos,
  donanteDe,
} from '../../../services/conceptos/catalogoConceptos';
import type { Ambito, Concepto, FamiliaId } from '../../../services/conceptos/catalogoConceptos';
import {
  borrarConceptoPropio,
  cargarConceptosUsuario,
  contarUsos,
  crearConceptoPropio,
  ocultar,
  renombrar,
} from '../../../services/conceptos/conceptosUsuarioService';
import type { ConceptosUsuario } from '../../../services/conceptos/conceptosUsuarioService';
import { getCategoryByKey } from '../../../services/categoryCatalog';

const AMBITO_LABEL: Record<Ambito, string> = {
  personal: 'Tuyo',
  inmueble: 'De un inmueble',
};

/** A qué casilla AEAT lleva · vacío en personal, que no declara gastos. */
function casillaDe(c: Concepto): string {
  if (!c.inmueble) return '—';
  if (c.inmueble.categoryKey === null) return 'se pregunta';
  return getCategoryByKey(c.inmueble.categoryKey)?.casillaAEAT ?? '—';
}

const ConceptosPage: React.FC = () => {
  const [datos, setDatos] = useState<ConceptosUsuario>({ propios: [], ajustes: {} });
  const [usos, setUsos] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');
  // Alta
  const [abierto, setAbierto] = useState(false);
  const [nuevaFamilia, setNuevaFamilia] = useState<FamiliaId>('otros');
  const [nuevoLabel, setNuevoLabel] = useState('');
  const [nuevosAmbitos, setNuevosAmbitos] = useState<Ambito[]>(['personal']);

  const recargar = useCallback(async () => {
    const [d, u] = await Promise.all([cargarConceptosUsuario(), contarUsos()]);
    setDatos(d);
    setUsos(u);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar().catch((e) => {
      showToastV5(`No se pudieron cargar los conceptos · ${(e as Error).message}`, 'error');
      setCargando(false);
    });
  }, [recargar]);

  const propios = useMemo(() => new Set(datos.propios.map((p) => p.id)), [datos]);
  // `cargando` entra en las dependencias a propósito: la lista se recalcula
  // cuando el registro en memoria ya tiene aplicados los conceptos del usuario.
  const porFamilia = useMemo(
    () =>
      FAMILIAS.map((f) => ({
        familia: f,
        conceptos: conceptosEfectivos().filter((c) => c.familia === f.id),
      })).filter((g) => g.conceptos.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos, cargando],
  );

  const conAviso = async (accion: () => Promise<ConceptosUsuario>, exito: string) => {
    try {
      await accion();
      await recargar();
      showToastV5(exito, 'success');
    } catch (e) {
      showToastV5((e as Error).message, 'error');
    }
  };

  const onGuardarNombre = async (c: Concepto) => {
    setEditando(null);
    if (borrador.trim() === c.label) return;
    await conAviso(() => renombrar(c.id, borrador), `Ahora se llama «${borrador.trim() || c.label}»`);
  };

  const onCrear = async () => {
    await conAviso(
      () => crearConceptoPropio(nuevaFamilia, nuevoLabel, nuevosAmbitos),
      `«${nuevoLabel.trim()}» añadido`,
    );
    setNuevoLabel('');
    setAbierto(false);
  };

  // Sólo se ofrecen los ámbitos en los que esa familia tiene de quién heredar.
  const ambitosPosibles = useMemo(
    () => (['personal', 'inmueble'] as Ambito[]).filter((a) => donanteDe(nuevaFamilia, a)),
    [nuevaFamilia],
  );
  useEffect(() => {
    setNuevosAmbitos((prev) => {
      const validos = prev.filter((a) => ambitosPosibles.includes(a));
      return validos.length > 0 ? validos : ambitosPosibles.slice(0, 1);
    });
  }, [ambitosPosibles]);

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Conceptos</h1>
          <div className={containerStyles.contentSub}>
            qué puede ser un gasto · el nombre y si se ofrece los decides tú · la casilla AEAT se
            hereda de la familia
          </div>
        </div>
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
          onClick={() => setAbierto((v) => !v)}
        >
          <Icons.Plus size={14} strokeWidth={1.8} />
          Añadir concepto
        </button>
      </div>

      {abierto && (
        <div className={styles.alta}>
          <div className={styles.altaCampos}>
            <label className={styles.campo}>
              <span className={styles.lab}>Familia</span>
              <select
                className={styles.input}
                value={nuevaFamilia}
                onChange={(e) => setNuevaFamilia(e.target.value as FamiliaId)}
              >
                {FAMILIAS.map((f) => (
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
              <div className={styles.checks}>
                {ambitosPosibles.map((a) => (
                  <label key={a} className={styles.check}>
                    <input
                      type="checkbox"
                      checked={nuevosAmbitos.includes(a)}
                      onChange={(e) =>
                        setNuevosAmbitos((prev) =>
                          e.target.checked ? [...prev, a] : prev.filter((x) => x !== a),
                        )
                      }
                    />
                    {AMBITO_LABEL[a]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <p className={styles.altaNota}>
            Se clasificará como el resto de «{FAMILIAS.find((f) => f.id === nuevaFamilia)?.label}»
            {nuevosAmbitos.includes('inmueble') &&
              donanteDe(nuevaFamilia, 'inmueble') &&
              ` · casilla ${casillaDe(donanteDe(nuevaFamilia, 'inmueble') as Concepto)}`}
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
        porFamilia.map(({ familia, conceptos }) => (
          <section key={familia.id} className={styles.familia}>
            <div className={styles.familiaHead}>
              <span className={styles.familiaLabel}>{familia.label}</span>
              <span className={styles.familiaSub}>{familia.descripcion}</span>
            </div>
            <div className={styles.tabla}>
              {conceptos.map((c) => {
                const esPropio = propios.has(c.id);
                const n = usos[c.id] ?? 0;
                return (
                  <div key={c.id} className={c.oculto ? styles.filaOculta : styles.fila}>
                    <div className={styles.celdaNombre}>
                      {editando === c.id ? (
                        <input
                          className={styles.input}
                          value={borrador}
                          autoFocus
                          onChange={(e) => setBorrador(e.target.value)}
                          onBlur={() => void onGuardarNombre(c)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void onGuardarNombre(c);
                            if (e.key === 'Escape') setEditando(null);
                          }}
                          aria-label={`Nombre de ${c.label}`}
                        />
                      ) : (
                        <button
                          type="button"
                          className={styles.nombre}
                          onClick={() => {
                            setEditando(c.id);
                            setBorrador(c.label);
                          }}
                        >
                          {c.label}
                        </button>
                      )}
                      <span className={styles.id}>{c.id}</span>
                    </div>
                    <span className={styles.celdaAmbito}>
                      {ambitosDe(c)
                        .map((a) => AMBITO_LABEL[a])
                        .join(' · ')}
                    </span>
                    <span className={styles.celdaCasilla}>{casillaDe(c)}</span>
                    <span className={styles.celdaUsos}>
                      {n > 0 ? `${n} gasto${n === 1 ? '' : 's'}` : '—'}
                    </span>
                    <div className={styles.celdaAcciones}>
                      {esPropio && <span className={styles.tagPropio}>tuyo</span>}
                      <button
                        type="button"
                        className={styles.accion}
                        onClick={() =>
                          void conAviso(
                            () => ocultar(c.id, !c.oculto),
                            c.oculto ? `«${c.label}» vuelve a ofrecerse` : `«${c.label}» ya no se ofrece`,
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
                            void conAviso(() => borrarConceptoPropio(c.id), `«${c.label}» borrado`)
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
          </section>
        ))
      )}

      <p className={styles.pie}>
        Esconder no borra: los gastos que ya usan ese concepto lo conservan y se siguen clasificando
        igual. Sólo deja de ofrecerse al crear o editar. Los conceptos de fábrica no se pueden
        borrar, y uno tuyo tampoco mientras haya un gasto usándolo.
      </p>
    </>
  );
};

export default ConceptosPage;
export { ConceptosPage };
