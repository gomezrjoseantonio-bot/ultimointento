import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import type { ValoracionPunto } from '../adapters/patrimonioInmuebleAdapter';
import styles from './ValorHoyHero.module.css';

export interface ValorHoyHeroProps {
  /** Valor actual del activo · `null` si no hay valoración registrada. */
  valorActual: number | null;
  /** Etiqueta de fecha ya formateada (p. ej. «jun 2026») · `null` si no hay. */
  fechaEtiqueta: string | null;
  /** Revalorización sobre coste en % · `null` sin valoración. */
  revalorizacionPct: number | null;
  /** Variación del valor en el año en curso · `null` si no es calculable. */
  cambioAnual: number | null;
}

/** Año de una fecha 'YYYY-MM[-DD]'. */
const anioDe = (fecha: string): number => Number(fecha.split('-')[0]);

/**
 * Variación del valor «este año»: valor más reciente menos el último valor
 * registrado en un año anterior. `null` si no hay dos ejercicios distintos con
 * los que comparar.
 */
export function calcularCambioAnual(historico: ValoracionPunto[]): number | null {
  const validos = historico.filter((p) => Number.isFinite(p.valor) && p.fecha);
  if (validos.length < 2) return null;

  const asc = [...validos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimo = asc[asc.length - 1];
  const anioUltimo = anioDe(ultimo.fecha);

  const previo = [...asc].reverse().find((p) => anioDe(p.fecha) < anioUltimo);
  if (!previo) return null;

  return Math.round((ultimo.valor - previo.valor) * 100) / 100;
}

/**
 * Hero patrimonial «Valor hoy»: destaca el valor actual del activo sobre fondo
 * navy, con la variación del año y la revalorización sobre coste. Sustituye a
 * la antigua tarjeta de «Valor actual» dándole el protagonismo del mockup.
 */
const ValorHoyHero: React.FC<ValorHoyHeroProps> = ({
  valorActual,
  fechaEtiqueta,
  revalorizacionPct,
  cambioAnual,
}) => {
  const kicker = fechaEtiqueta ? `Valor hoy · ${fechaEtiqueta}` : 'Valor hoy';

  if (valorActual === null) {
    return (
      <div className={styles.hero}>
        <div className={styles.kick}>Valor hoy</div>
        <div className={styles.noData}>Sin valoración registrada</div>
      </div>
    );
  }

  const partes: React.ReactNode[] = [];
  if (cambioAnual !== null) {
    partes.push(
      <span key="anual">
        {cambioAnual >= 0 ? '+' : '−'}
        <MoneyValue value={Math.abs(cambioAnual)} decimals={0} /> este año
      </span>,
    );
  }
  if (revalorizacionPct !== null) {
    partes.push(
      <span key="reval">
        {revalorizacionPct >= 0 ? '+' : '−'}
        {Math.abs(revalorizacionPct).toFixed(0)} % s/ coste de compra
      </span>,
    );
  }

  return (
    <div className={styles.hero}>
      <div className={styles.kick}>{kicker}</div>
      <div className={styles.big}>
        <MoneyValue value={valorActual} decimals={0} />
      </div>
      {partes.length > 0 && (
        <div className={styles.delta}>
          {partes.map((parte, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className={styles.sep}> · </span>}
              {parte}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default ValorHoyHero;
