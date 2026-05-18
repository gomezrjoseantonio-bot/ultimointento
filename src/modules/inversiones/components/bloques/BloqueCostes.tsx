// BloqueCostes · P3 ficha plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.4).
// PR 4 · cableado · TIPO-AWARE · `getCopyPorTipo(tipoAdministrativo)` controla
// título + banner + botón "Buscar TER menor".
//
// PPI/PPA/PPES · accionable · botón sí · banner cerrable `coste-cambio-gestora-cta`.
// PPE · educativo · sin botón · banner cerrable `coste-ppe-info`.
// PPA garantizado · banner info-garantizado.

import { useMemo } from 'react';
import { showToastV5 } from '../../../../design-system/v5';
import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import { getCopyPorTipo } from './tipoPlanCopy';
import { useAvisoCerrable } from './useAvisoCerrable';
import styles from './bloques.module.css';

/** Subtipos del plan a efectos de copy (§5.4). */
export type TipoPlanCoste = 'PPI' | 'PPE' | 'PPES' | 'PPA';

export interface BloqueCostesProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Tipo administrativo · gobierna copy y accionables. */
  tipoPlan: TipoPlanCoste;
  /** PPA garantizado · cambia banner a info-garantizado. */
  garantizado?: boolean;
  /** Empresa promotora · sustituye {nombreEmpresa} en el copy PPE. */
  nombreEmpresa?: string | null;
  /** TER del plan · decimal (0.0138 = 1,38 %). */
  ter: number;
  /** Saldo medio anual estimado · para calcular comisión anual. */
  saldoMedioAnual: number;
  /** Años desde apertura. */
  anosTranscurridos: number;
  /** Años hasta rescate · para proyectar comisión futura. */
  anosHastaRescate: number;
  /** Saldo medio proyectado en el periodo futuro. */
  saldoMedioProyectado: number;
  /** TER objetivo si se cambia a un plan más barato (default 0,005 = 0,5 %). */
  terObjetivo?: number;
}

function fmtEur(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

const BloqueCostes = ({
  posicionId,
  tipoActivo,
  tipoPlan,
  garantizado,
  nombreEmpresa,
  ter,
  saldoMedioAnual,
  anosTranscurridos,
  anosHastaRescate,
  saldoMedioProyectado,
  terObjetivo = 0.005,
}: BloqueCostesProps) => {
  const copy = useMemo(
    () =>
      getCopyPorTipo({
        tipoAdministrativo: tipoPlan,
        garantizado,
        nombreEmpresa,
      }),
    [tipoPlan, garantizado, nombreEmpresa],
  );

  const comisionesAcumuladas = useMemo(
    () => ter * saldoMedioAnual * Math.max(0, anosTranscurridos),
    [ter, saldoMedioAnual, anosTranscurridos],
  );

  const comisionesFuturas = useMemo(
    () => ter * saldoMedioProyectado * Math.max(0, anosHastaRescate),
    [ter, saldoMedioProyectado, anosHastaRescate],
  );

  const ahorroHipotetico = useMemo(() => {
    const futuras = ter * saldoMedioProyectado * Math.max(0, anosHastaRescate);
    const futurasObjetivo = terObjetivo * saldoMedioProyectado * Math.max(0, anosHastaRescate);
    return Math.max(0, futuras - futurasObjetivo);
  }, [ter, terObjetivo, saldoMedioProyectado, anosHastaRescate]);

  // ID aviso depende del tipo · spec §9.1.
  const avisoId = tipoPlan === 'PPE' ? 'coste-ppe-info' : 'coste-cambio-gestora-cta';
  const { visible: bannerVisible, cerrar } = useAvisoCerrable(avisoId, {
    ubicacionContexto: `/inversiones/${posicionId}`,
    etiqueta: copy.costesTitulo,
  });

  const bannerCopy = copy.costesBannerTemplate.replace(
    '{ahorro}',
    new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(ahorroHipotetico),
  );

  return (
    <section
      className={styles.bloque}
      data-bloque="P3"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      data-tipo-plan={tipoPlan}
      aria-label="Coste de comisiones"
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Comisiones</div>
          <div className={styles.bloqueMensaje}>{copy.costesTitulo}</div>
          <div className={styles.bloqueSub}>
            TER actual · {(ter * 100).toFixed(2)} %. Cálculo · TER × saldo medio × años.
          </div>
        </div>
      </div>
      <div className={styles.bloqueBody}>
        <div className={styles.minisRow}>
          <div className={styles.mini}>
            <div className={styles.miniLab}>Acumulado pagado</div>
            <div className={styles.miniVal}>{fmtEur(comisionesAcumuladas)}</div>
            <div className={styles.miniSub}>{anosTranscurridos} años</div>
          </div>
          <div className={styles.mini}>
            <div className={styles.miniLab}>Proyectado hasta rescate</div>
            <div className={styles.miniVal}>{fmtEur(comisionesFuturas)}</div>
            <div className={styles.miniSub}>{anosHastaRescate} años</div>
          </div>
          <div className={styles.mini}>
            <div className={styles.miniLab}>Ahorro a TER {(terObjetivo * 100).toFixed(1)} %</div>
            <div
              className={styles.miniVal}
              style={{ color: 'var(--atlas-v5-pos)' }}
            >
              {fmtEur(ahorroHipotetico)}
            </div>
            <div className={styles.miniSub}>hipotético · si cambias gestora</div>
          </div>
        </div>

        {bannerVisible && (
          <div
            className={`${styles.banner} ${copy.costesBannerTono === 'educativo' || copy.costesBannerTono === 'info-garantizado' ? styles.bannerInfo : styles.bannerWarn}`}
            role="status"
          >
            <div className={styles.bannerBody}>{bannerCopy}</div>
            <button
              type="button"
              className={styles.bannerClose}
              onClick={cerrar}
              aria-label="Cerrar aviso de comisiones"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {copy.mostrarBotonBuscarTerMenor && (
          <div className={styles.bloqueActions}>
            <button
              type="button"
              className={styles.btnPrimario}
              onClick={() =>
                showToastV5(
                  'Buscar plan con TER menor · próximamente · comparador integrado',
                  'success',
                )
              }
            >
              Buscar plan con TER menor →
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default BloqueCostes;
