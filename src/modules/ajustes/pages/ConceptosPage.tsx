// Ajustes → Conceptos · la tabla de qué puede ser un movimiento.
//
// E2.4.1c · UN solo catálogo (DEFINITIVO · principio 1): esta pantalla ENSEÑA
// el catálogo único —naturaleza → familia → subtipos— y qué casilla del Modelo
// 100 le pone la lente fiscal a cada familia cuando el gasto es de un inmueble.
// No se edita: crear, renombrar u ocultar conceptos propios era un segundo
// árbol al lado del catálogo, y la casilla de un concepto propio se heredaba a
// ciegas. El catálogo lo decide Jose en `ATLAS-CATALOGO-clasificacion-DEFINITIVO.md`.

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import containerStyles from '../AjustesPage.module.css';
import styles from './ConceptosPage.module.css';
import {
  FAMILIAS,
  LABEL_NATURALEZA,
  NATURALEZAS,
  type Familia,
  type Naturaleza,
} from '../../../services/catalogo/catalogoUnico';
import { casillaDe, fiscalidadDe } from '../../../services/fiscal/lenteFiscal';

const AMBITO_LABEL: Record<Familia['ambitosAplicables'], string> = {
  personal: 'Tuyo',
  inmueble: 'De un inmueble',
  ambos: 'Tuyo · de un inmueble',
};

/**
 * Cómo se lee la fiscalidad de una familia en una frase, cuando el gasto es DE
 * UN INMUEBLE. Sólo entonces: un gasto tuyo no se declara.
 */
function fraseFiscal(f: Familia): string {
  if (f.naturaleza !== 'gasto') return '—';
  const conVida = f.id === 'seguros_alarmas';
  const casilla = casillaDe({ familia: f.id, ambito: 'inmueble' });
  const fisc = fiscalidadDe({ familia: f.id, ambito: 'inmueble' });
  if (f.id === 'reforma_mejora') return 'se amortiza al 3 % (mejoras)';
  if (f.id === 'mobiliario_enseres') return `casilla ${casilla} · se amortiza al 10 %`;
  if (f.id === 'prestamo_hipoteca') return 'el interés (casilla 0105) lo pone el cuadro del préstamo';
  if (!casilla) return fisc.frase;
  return conVida ? `casilla ${casilla} (vida → 0105 · alarma → 0112)` : `casilla ${casilla}`;
}

const ConceptosPage: React.FC = () => {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const porNaturaleza = useMemo(
    () => NATURALEZAS.map((n) => ({ naturaleza: n, familias: FAMILIAS.filter((f) => f.naturaleza === n) })),
    [],
  );

  const toggle = (id: string) =>
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={containerStyles.content}>
      <header className={containerStyles.contentHead}>
        <h2 className={containerStyles.contentTitle}>Conceptos</h2>
        <p className={containerStyles.contentSub}>
          El catálogo único con el que se clasifica cualquier movimiento: naturaleza, familia y subtipo. La
          casilla del Modelo 100 la pone la lente fiscal según la familia, y solo cuando el gasto es de un
          inmueble.
        </p>
      </header>

      {porNaturaleza.map(({ naturaleza, familias }) => (
        <section key={naturaleza} className={styles.familia}>
          <div className={styles.familiaSub}>{LABEL_NATURALEZA[naturaleza as Naturaleza]}</div>
          {familias.map((f) => {
            const abierta = abiertas.has(f.id);
            return (
              <div key={f.id} className={styles.familiaFila}>
                <button type="button" className={styles.familiaHead} onClick={() => toggle(f.id)}>
                  <span className={abierta ? styles.chevronAbierto : styles.chevron}>
                    <Icons.ChevronRight size={14} strokeWidth={2} />
                  </span>
                  <span className={styles.familiaLabel}>{f.label}</span>
                  <span className={styles.familiaCuenta}>
                    {f.subtipos.length > 0 ? `${f.subtipos.length} subtipos` : 'sin subtipos'}
                  </span>
                  <span className={styles.familiaSub}>{AMBITO_LABEL[f.ambitosAplicables]}</span>
                </button>
                {abierta && (
                  <div className={styles.tabla}>
                    <div className={styles.cabecera}>
                      <span>Subtipo</span>
                      <span>Casilla (gasto de un inmueble)</span>
                    </div>
                    {f.descripcion && <div className={styles.nota}>{f.descripcion}</div>}
                    {f.subtipos.length === 0 ? (
                      <div className={styles.fila}>
                        <span className={styles.celdaNombre}>
                          <span className={styles.nombre}>{f.label}</span>
                          <span className={styles.id}>{f.id}</span>
                        </span>
                        <span className={styles.soloLectura}>{fraseFiscal(f)}</span>
                      </div>
                    ) : (
                      f.subtipos.map((st) => {
                        const casilla = casillaDe({ familia: f.id, subtipo: st.id, ambito: 'inmueble' });
                        return (
                          <div key={st.id} className={styles.fila}>
                            <span className={styles.celdaNombre}>
                              <span className={styles.nombre}>{st.label}</span>
                              <span className={styles.id}>{f.id} · {st.id}</span>
                            </span>
                            <span className={styles.soloLectura}>
                              {f.naturaleza === 'gasto' ? (casilla ? `casilla ${casilla}` : fraseFiscal(f)) : '—'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <p className={styles.pie}>
        El catálogo es único y lo fija el DEFINITIVO. El subtipo es opcional: nunca obliga. Un mismo
        concepto puede ser tuyo o de un inmueble; el ámbito se decide en cada movimiento.
      </p>
    </div>
  );
};

export default ConceptosPage;
