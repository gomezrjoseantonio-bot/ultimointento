// Panel · héroe navy · patrimonio neto + composición + activos/deuda/cuota +
// anillo de libertad. Mitad derecha: curva de patrimonio a 20 años leyendo LA
// salida canónica del motor (C-PROY-5 · B4) · SOLO lectura — los supuestos se
// configuran en Mi Plan (B5). Sin serie → estado vacío honesto.

import React from 'react';
import { Icons } from '../../../design-system/v5';
import LibertadRing from './LibertadRing';
import CurvaPatrimonio from '../../../components/proyeccion/CurvaPatrimonio';
import type { PuntoPatrimonioAnual } from '../../horizon/proyeccion/mensual/types/proyeccionMensual';
import { fmtEur } from './format';
import type { AnilloState } from './types';
import styles from './HeroPatrimonio.module.css';

export interface HeroPatrimonioProps {
  patrimonioNeto: number;
  activosTotales: number;
  deudaViva: number;
  cuotaMensual: number;
  valorInmuebles: number;
  saldoTesoreria: number;
  valorInversiones: number;
  anillo: AnilloState;
  onNavigate: (ruta: string) => void;
  /** Salida canónica del motor (B4) · null/vacía → estado vacío honesto. */
  seriePatrimonio?: PuntoPatrimonioAnual[] | null;
}

const HeroPatrimonio: React.FC<HeroPatrimonioProps> = ({
  patrimonioNeto,
  activosTotales,
  deudaViva,
  cuotaMensual,
  valorInmuebles,
  saldoTesoreria,
  valorInversiones,
  anillo,
  onNavigate,
  seriePatrimonio,
}) => {
  const haySerie =
    Array.isArray(seriePatrimonio) &&
    seriePatrimonio.length > 1 &&
    seriePatrimonio.some((p) => p.patrimonioNeto !== 0);
  const total = valorInmuebles + saldoTesoreria + valorInversiones || 1;
  const pct = (v: number) => `${(v / total) * 100}%`;

  return (
    <section className={styles.hero}>
      <div className={styles.grid}>
        {/* Mitad izquierda · patrimonio y su composición */}
        <div className={styles.main}>
          <div className={styles.tag}>Patrimonio neto</div>
          <div className={`${styles.val} mono`}>{fmtEur(patrimonioNeto)}</div>
          {/* Variación 12 meses · sin histórico reconstruible (V62) → vacío */}
          <div className={styles.delta}>Variación a 12 meses · aún sin histórico para calcularla</div>

          <div className={styles.compo}>
            <div className={styles.compoBar}>
              {valorInmuebles > 0 && (
                <span className={`${styles.seg} ${styles.segInmuebles}`} style={{ width: pct(valorInmuebles) }} />
              )}
              {saldoTesoreria > 0 && (
                <span className={`${styles.seg} ${styles.segTesoreria}`} style={{ width: pct(saldoTesoreria) }} />
              )}
              {valorInversiones > 0 && (
                <span className={`${styles.seg} ${styles.segInversiones}`} style={{ width: pct(valorInversiones) }} />
              )}
            </div>
            <div className={styles.legend}>
              <button className={styles.item} onClick={() => onNavigate('/inmuebles')}>
                <span className={`${styles.dot} ${styles.segInmuebles}`} />
                Inmuebles <b className="mono">{fmtEur(valorInmuebles)}</b>
              </button>
              <button className={styles.item} onClick={() => onNavigate('/tesoreria')}>
                <span className={`${styles.dot} ${styles.segTesoreria}`} />
                Tesorería <b className="mono">{fmtEur(saldoTesoreria)}</b>
              </button>
              <button className={styles.item} onClick={() => onNavigate('/inversiones')}>
                <span className={`${styles.dot} ${styles.segInversiones}`} />
                Inversiones <b className="mono">{fmtEur(valorInversiones)}</b>
              </button>
            </div>
          </div>

          <div className={styles.deuda}>
            <div>
              <div className={styles.hdLab}>Activos</div>
              <div className={`${styles.hdVal} mono`}>{fmtEur(activosTotales)}</div>
            </div>
            <div>
              <div className={styles.hdLab}>Deuda viva</div>
              <div className={`${styles.hdVal} mono`}>{fmtEur(-deudaViva, true)}</div>
            </div>
            <div>
              <div className={styles.hdLab}>Cuota mensual</div>
              <div className={`${styles.hdVal} mono`}>
                {cuotaMensual > 0 ? fmtEur(-cuotaMensual, true) : '—'}
              </div>
            </div>
            <LibertadRing anillo={anillo} onDefinirObjetivo={() => onNavigate('/mi-plan')} />
          </div>
        </div>

        {/* Mitad derecha · curva a 20 años · salida canónica del motor (B4) */}
        {haySerie ? (
          <div className={`${styles.chart} ${styles.chartConCurva}`}>
            <div className={styles.chartHead}>
              <span className={styles.chartTit}>Trayectoria a 20 años</span>
              <span className={styles.chartSub}>
                según tus supuestos de Mi Plan · sin fiscalidad futura
              </span>
            </div>
            <CurvaPatrimonio serie={seriePatrimonio!} variante="navy" alto={150} />
          </div>
        ) : (
          <div className={styles.chart}>
            <div className={styles.chartEmpty}>
              <Icons.Proyeccion size={26} strokeWidth={1.6} className={styles.chartIcon} />
              <div className={styles.chartTit}>Trayectoria a 20 años</div>
              <div className={styles.chartSub}>
                La proyección de patrimonio a largo plazo aparecerá cuando haya datos que proyectar
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroPatrimonio;
