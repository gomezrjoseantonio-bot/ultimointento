import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import type {
  EtiquetaDato,
  MetricaEtiquetada,
  RentabilidadInmuebleResumen,
} from '../adapters/rentabilidadInmuebleAdapter';
import styles from './RentabilidadInmueble.module.css';

export interface RentabilidadInmuebleProps {
  resumen: RentabilidadInmuebleResumen;
}

const ETIQUETA_LABEL: Record<EtiquetaDato, string> = {
  real: 'Real',
  previsto: '≈ Previsto',
  estimado: '≈ Estimado',
};

const badgeClass = (etiqueta: EtiquetaDato): string =>
  etiqueta === 'real' ? styles.badgeReal : styles.badgeEst;

/** Tarjeta de importe · muestra "No disponible" cuando el valor no existe. */
const CardMoney: React.FC<{
  label: string;
  valor?: number;
  etiqueta: EtiquetaDato;
  sinDato?: string;
  firmado?: boolean;
}> = ({ label, valor, etiqueta, sinDato = 'Sin datos', firmado = false }) => (
  <div className={styles.card}>
    <div className={styles.cardLabel}>{label}</div>
    {valor !== undefined ? (
      <>
        <div
          className={`${styles.cardValue} ${firmado ? (valor >= 0 ? styles.pos : styles.neg) : ''}`}
        >
          {firmado && valor >= 0 ? '+' : ''}
          <MoneyValue value={valor} decimals={0} />
        </div>
        <div className={badgeClass(etiqueta)}>{ETIQUETA_LABEL[etiqueta]}</div>
      </>
    ) : (
      <>
        <div className={styles.noData}>{sinDato}</div>
        <div className={styles.badgeNa}>No disponible</div>
      </>
    )}
  </div>
);

/** Tarjeta de porcentaje etiquetada (rentabilidad bruta/neta). */
const CardPct: React.FC<{ label: string; metrica?: MetricaEtiquetada; sinDato: string }> = ({
  label,
  metrica,
  sinDato,
}) => (
  <div className={styles.card}>
    <div className={styles.cardLabel}>{label}</div>
    {metrica ? (
      <>
        <div className={styles.cardValue}>{metrica.valor.toFixed(2)} %</div>
        <div className={badgeClass(metrica.etiqueta)}>{ETIQUETA_LABEL[metrica.etiqueta]}</div>
      </>
    ) : (
      <>
        <div className={styles.noData}>{sinDato}</div>
        <div className={styles.badgeNa}>No disponible</div>
      </>
    )}
  </div>
);

const RentabilidadInmueble: React.FC<RentabilidadInmuebleProps> = ({ resumen }) => {
  const {
    ejercicio,
    ingresosPrevistos,
    ingresosCobrados,
    gastosPrevistos,
    gastosPagados,
    resultadoOperativoEstimado,
    resultadoOperativoReal,
    rentabilidadBruta,
    rentabilidadNeta,
    cuotaPrestamoAnual,
    cashflowEstimado,
    cashflowReal,
  } = resumen;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Rentabilidad del activo · {ejercicio}</div>
        <div className={styles.sub}>
          Se distingue lo previsto de lo real · los valores estimados se marcan con ≈
        </div>
      </div>

      <div className={styles.blocks}>
        <section className={styles.block}>
          <div className={styles.blockTitle}>Ingresos (anuales)</div>
          <div className={styles.grid}>
            <CardMoney label="Previstos" valor={ingresosPrevistos} etiqueta="previsto" sinDato="Sin contrato activo" />
            <CardMoney label="Cobrados" valor={ingresosCobrados} etiqueta="real" sinDato="Sin cobros en Tesorería" />
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.blockTitle}>Gastos de explotación (anuales)</div>
          <div className={styles.grid}>
            <CardMoney label="Previstos" valor={gastosPrevistos} etiqueta="previsto" sinDato="Sin recurrentes" />
            <CardMoney label="Pagados" valor={gastosPagados} etiqueta="real" sinDato="Sin gastos registrados" />
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.blockTitle}>Resultado operativo (anual)</div>
          <div className={styles.grid}>
            <CardMoney
              label="Estimado"
              valor={resultadoOperativoEstimado}
              etiqueta="estimado"
              sinDato="Faltan previstos"
              firmado
            />
            <CardMoney
              label="Real"
              valor={resultadoOperativoReal}
              etiqueta="real"
              sinDato="Faltan cobros o pagos"
              firmado
            />
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.blockTitle}>Rentabilidad</div>
          <div className={styles.grid}>
            <CardPct label="Bruta" metrica={rentabilidadBruta} sinDato="Sin ingresos o coste" />
            <CardPct label="Neta" metrica={rentabilidadNeta} sinDato="Sin resultado o coste" />
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.blockTitle}>Cashflow (tras cuota de préstamo)</div>
          <div className={styles.grid}>
            <CardMoney
              label="Estimado"
              valor={cashflowEstimado}
              etiqueta="estimado"
              sinDato="Faltan previstos"
              firmado
            />
            <CardMoney
              label="Real"
              valor={cashflowReal}
              etiqueta="real"
              sinDato="Faltan cobros o pagos"
              firmado
            />
            <CardMoney
              label="Cuota de préstamo"
              valor={cuotaPrestamoAnual}
              etiqueta="real"
              sinDato="Sin financiación"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default RentabilidadInmueble;
