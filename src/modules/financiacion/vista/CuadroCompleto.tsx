// El cuadro de amortización entero · las 240 filas.
//
// Aquí había un botón deshabilitado que decía «Pendiente · la pantalla del
// cuadro completo aún no existe». Y el cuadro **sí existe**: el motor lo genera
// entero para dar la cuota, el asistente lo enseña al dar de alta el préstamo y
// la ficha ya estaba pintando sus tres primeras filas. Lo único que faltaba era
// dejar verlo *(Jose · 8 ago 2026: «dice que no se puede ver cuando en la
// creación existe. absurdo»)*.
//
// Se pagina y no hace scroll, como la cartera: la vista no crece hacia abajo.

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Cuadro } from '../../../services/prestamos/cuadro';
import { eurPlano, mesAnio } from './formato';
import styles from './CuadroCompleto.module.css';

interface Props {
  cuadro: Cuadro;
  nombre: string;
  /** Para arrancar en el año que se está pagando y no en 2023. */
  hoy: string;
  onCerrar: () => void;
}

const POR_PAGINA = 12;

const CuadroCompleto: React.FC<Props> = ({ cuadro, nombre, hoy, onCerrar }) => {
  const lineas = useMemo(() => cuadro.plan.periodos, [cuadro]);

  // Se abre por donde vas, no por el principio · en un cuadro de veinte años la
  // primera página es historia y lo que se viene a mirar es lo que queda.
  const paginaDeHoy = useMemo(() => {
    const i = lineas.findIndex((p) => p.fechaCargo >= hoy);
    return i < 0 ? 0 : Math.floor(i / POR_PAGINA);
  }, [lineas, hoy]);

  const [pagina, setPagina] = useState(paginaDeHoy);
  const total = Math.max(1, Math.ceil(lineas.length / POR_PAGINA));
  const segura = Math.min(Math.max(0, pagina), total - 1);
  const desde = segura * POR_PAGINA;
  const visibles = lineas.slice(desde, desde + POR_PAGINA);

  return (
    <div className={styles.fondo} role="dialog" aria-modal="true" aria-label={`Cuadro de ${nombre}`}>
      <div className={styles.panel}>
        <div className={styles.cab}>
          <div>
            <div className={styles.tit}>Cuadro de amortización</div>
            <div className={styles.sub}>
              {nombre} · <span className={styles.mono}>{lineas.length}</span> cuotas
            </div>
          </div>
          <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">
            <Icons.Close size={16} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.tabla}>
          <div className={`${styles.fila} ${styles.cabecera}`}>
            <div className={styles.th}>Nº</div>
            <div className={styles.th}>Mes</div>
            <div className={`${styles.th} ${styles.r}`}>Cuota</div>
            <div className={`${styles.th} ${styles.r}`}>Interés</div>
            <div className={`${styles.th} ${styles.r}`}>Capital</div>
            <div className={`${styles.th} ${styles.r}`}>Pendiente</div>
          </div>
          {visibles.map((p) => (
            <div
              key={p.periodo}
              className={`${styles.fila} ${p.fechaCargo < hoy ? styles.pasada : ''}`}
            >
              <div className={styles.c}>
                {/* La línea 0 es la carencia técnica, no una cuota · se dice en
                    vez de numerarla como si lo fuera. */}
                {p.periodo === 0 ? 'días' : p.periodo}
              </div>
              <div className={styles.c}>{mesAnio(p.fechaCargo)}</div>
              <div className={`${styles.c} ${styles.r} ${styles.mono}`}>{eurPlano(p.cuota)}</div>
              <div className={`${styles.c} ${styles.r} ${styles.mono}`}>{eurPlano(p.interes)}</div>
              <div className={`${styles.c} ${styles.r} ${styles.mono}`}>
                {eurPlano(p.amortizacion)}
              </div>
              <div className={`${styles.c} ${styles.r} ${styles.mono}`}>
                {eurPlano(p.principalFinal)}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.pie}>
          <button
            type="button"
            disabled={segura === 0}
            onClick={() => setPagina(segura - 1)}
            aria-label="Cuotas anteriores"
          >
            ‹
          </button>
          <span className={styles.pieN}>
            {desde + 1}–{Math.min(desde + POR_PAGINA, lineas.length)} de {lineas.length}
          </span>
          <button
            type="button"
            disabled={segura >= total - 1}
            onClick={() => setPagina(segura + 1)}
            aria-label="Cuotas siguientes"
          >
            ›
          </button>
          {segura !== paginaDeHoy && (
            <button type="button" className={styles.hoy} onClick={() => setPagina(paginaDeHoy)}>
              ir a hoy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CuadroCompleto;
