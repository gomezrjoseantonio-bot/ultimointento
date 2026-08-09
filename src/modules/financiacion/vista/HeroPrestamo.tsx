// El hero navy de la ficha · el nombre y sus seis cifras.
//
// Salió de `DetallePrestamoPage` cuando esa página rozó las 800 líneas con la
// ficha en plena remodelación. Es la mitad de la pantalla que NO cambia con el
// tipo de préstamo —siempre son las mismas seis— frente a la rejilla de abajo,
// que sí se adapta; separarlas hace que tocar una no obligue a leer la otra.
//
// Sin estado ni lecturas propias: recibe lo ya calculado y lo pinta.

import React from 'react';
import { Icons } from '../../../design-system/v5';
import type { Prestamo } from '../../../types/prestamos';
import type { ResumenBonificaciones } from './detalleDatos';
import { metaDestino } from './datos';
import {
  ETIQUETA_TIPO,
  eurAFavor,
  eurDeuda,
  eurPlano,
  mesAnio,
  pct,
} from './formato';
import styles from './DetallePrestamo.module.css';

export interface HeroPrestamoProps {
  prestamo: Prestamo;
  /** Lo que la ficha ya ha derivado del cuadro · `detalleDatos`. */
  datos: DatosDelHero;
  bonificaciones: ResumenBonificaciones;
  /** El año que se enseña en «Deducible AAAA». */
  anio: string;
  /** Los cuatro últimos dígitos del contrato · `null` si no llegan a cuatro. */
  numContrato: string | null;
  /** Si los intereses reducen el IRPF · manda qué KPI ocupa la última casilla. */
  mostrarDeducible: boolean;
  /** Qué parte del capital deduce · 0..100. */
  pctDeducible: number;
  esMixtoOVariable: boolean;
  onAmortizar: () => void;
  onEditar: () => void;
}

/** Lo que el hero necesita de `datos` · nada más. */
export interface DatosDelHero {
  capitalVivo: number;
  principalInicial: number;
  cuota: number;
  tin: number;
  pctAmortizado: number;
  vencimiento: string | null;
  deducible: number;
  interesPendiente: number;
  progreso: { pagadas: number; total: number; restantes: number };
  revision: { cuotaAntes: number; cuotaDespues: number; tinAntes: number; tinDespues: number; fecha: string } | null;
}

/** Los diez segmentos de «Amortizado» · uno por cada 10 %. */
const Segmentos: React.FC<{ pct: number }> = ({ pct: valor }) => {
  const encendidos = Math.round(Math.min(100, Math.max(0, valor)) / 10);
  return (
    <div className={styles.heroAmort} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < encendidos ? styles.pipOn : undefined} />
      ))}
    </div>
  );
};

const HeroPrestamo: React.FC<HeroPrestamoProps> = ({
  prestamo,
  datos,
  bonificaciones,
  anio,
  numContrato,
  mostrarDeducible,
  pctDeducible,
  esMixtoOVariable,
  onAmortizar,
  onEditar,
}) => (
  <div className={styles.hero}>
  <div className={styles.heroHead}>
    <div className={styles.heroHeadIzq}>
      <h1 className={styles.heroTitulo}>{prestamo.nombre || 'Préstamo sin nombre'}</h1>
      <div className={styles.heroSub}>
        {ETIQUETA_TIPO[prestamo.tipo] ?? 'préstamo'} · destino{' '}
        <span className={styles.mono}>{metaDestino(prestamo)}</span>
        {numContrato && (
          <>
            {' · nº '}
            <span className={styles.mono}>{numContrato}</span>
          </>
        )}
      </div>
    </div>
    <div className={styles.heroAcciones}>
      {/* No hay pantalla ni documento de FEIN enlazable todavía · el botón
          se deja visible y deshabilitado en vez de inventar un destino. */}
      <button type="button" className={styles.btnGhostNavy} disabled title="Pendiente · no hay FEIN enlazada">
        <Icons.Contratos size={14} strokeWidth={2} />
        Ver FEIN
      </button>
      {/* Tercera acción · no está en el mockup, pero adelantar capital es
          una operación real que ya funciona y el Detalle era su única
          puerta. Decisión de Jose · se mantiene aquí hasta que Mi Plan /
          Acelerar le dé sitio propio. */}
      <button type="button" className={styles.btnGhostNavy} onClick={onAmortizar}>
        <Icons.Amortizar size={14} strokeWidth={2} />
        Amortizar
      </button>
      <button
        type="button"
        className={styles.btnOroNavy}
        onClick={onEditar}
      >
        <Icons.Edit size={14} strokeWidth={2} />
        Editar
      </button>
    </div>
  </div>
    <div className={styles.hkRow}>
    <div className={styles.hk}>
      <div className={styles.hkLab}>Capital vivo</div>
      <div className={styles.hkVal}>{eurDeuda(datos.capitalVivo)}</div>
      <div className={styles.hkSub}>
        de <span className={styles.mono}>{eurPlano(datos.principalInicial)}</span> inicial
      </div>
    </div>

    <div className={styles.hk}>
      <div className={styles.hkLab}>Cuota{esMixtoOVariable ? ' actual' : ''}</div>
      <div className={styles.hkVal}>{eurDeuda(datos.cuota)}</div>
      <div className={styles.hkSub}>
        {datos.revision ? (
          <span className={styles.hkCambio}>
            {datos.revision.cuotaDespues > datos.revision.cuotaAntes ? '↑' : '↓'}{' '}
            {eurPlano(datos.revision.cuotaDespues)} desde{' '}
            {mesAnio(datos.revision.fecha).split(' ')[0]}
          </span>
        ) : (
          'constante · sin revisiones'
        )}
      </div>
    </div>

    <div className={styles.hk}>
      {/* «TIN BONIFICADO 2,60 %» era la misma mentira que la tarjeta, en el
          número más grande de la pantalla: en el tramo fijo de esta mixta
          no hay nada bonificado — el 2,600 % es el tipo a secas. Lo decide
          `rebajanHoy`, la misma respuesta que usa el cuadro. */}
      <div className={styles.hkLab}>
        TIN{' '}
        {bonificaciones.rebajanHoy && bonificaciones.rebajaTotal > 0
          ? 'bonificado'
          : prestamo.tipo === 'FIJO'
            ? 'fijo'
            : 'vigente'}
      </div>
      <div className={styles.hkVal}>{pct(datos.tin)}</div>
      <div className={styles.hkSub}>
        {datos.revision &&
        Math.abs(datos.revision.tinDespues - datos.revision.tinAntes) >= 0.005 ? (
          <>
            → <span className={styles.mono}>{pct(datos.revision.tinDespues).replace(' %', '')}</span>{' '}
            tras revisión
          </>
        ) : prestamo.tipo === 'FIJO' ? (
          'toda la vida del préstamo'
        ) : (
          'sin revisión a la vista'
        )}
      </div>
    </div>

    <div className={styles.hk}>
      <div className={styles.hkLab}>Amortizado</div>
      <Segmentos pct={datos.pctAmortizado} />
      <div className={styles.hkSub}>
        <span className={styles.mono}>{Math.round(datos.pctAmortizado)}%</span> ·{' '}
        <span className={styles.mono}>{datos.progreso.pagadas}</span> de{' '}
        <span className={styles.mono}>{datos.progreso.total}</span> cuotas
      </div>
    </div>

    <div className={styles.hk}>
      <div className={styles.hkLab}>Vence</div>
      <div className={`${styles.hkVal} ${styles.oro}`}>{mesAnio(datos.vencimiento)}</div>
      <div className={styles.hkSub}>
        quedan <span className={styles.mono}>{datos.progreso.restantes}</span> cuotas
      </div>
    </div>

    <div className={styles.hk}>
      <div className={styles.hkLab}>
        {mostrarDeducible ? `Deducible ${anio}` : 'Interés pendiente'}
      </div>
      <div className={styles.hkVal}>
        {mostrarDeducible ? eurAFavor(datos.deducible) : eurDeuda(datos.interesPendiente)}
      </div>
      <div className={styles.hkSub}>
        {mostrarDeducible ? (
          <>
            <span className={styles.mono}>{Math.round(pctDeducible)}%</span> · casilla
            0105
          </>
        ) : (
          'lo que queda de coste'
        )}
      </div>
    </div>
    </div>
  </div>
);

export default HeroPrestamo;
