// BloqueCostes · P3 ficha plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.4).
// PR 4 · cableado · TIPO-AWARE · `getCopyPorTipo(tipoAdministrativo)` controla
// título + banner.
//
// T-FICHA-PP-PULIDO v1 ·
//   · Bug #1 · TER no hardcoded · llega resuelto (catálogo / override / null).
//   · Bug #2 · botón "Buscar plan con TER menor" eliminado · el KPI de
//     ahorro se conserva como dato educativo sin CTA. Cuando exista
//     comparador real se reintroducirá.
//
// T-FICHA-PP-DEUDA v1 ·
//   · Fix #3 · fila "Media del mercado" con badge comparativo (sin colores
//     semánticos rojo/verde) usando `TER_MEDIA_MERCADO` por tipo de plan.
//   · Fix #4 · banner orphan `coste-cambio-gestora-cta` eliminado · solo
//     queda banner informativo para PPE/PPA-garantizado.

import { useMemo } from 'react';
import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import { getCopyPorTipo } from './tipoPlanCopy';
import { useAvisoCerrable } from './useAvisoCerrable';
import styles from './bloques.module.css';

/** Subtipos del plan a efectos de copy (§5.4). */
export type TipoPlanCoste = 'PPI' | 'PPE' | 'PPES' | 'PPA';

export type TerFuente = 'manual' | 'catalogo' | 'desconocido';

export interface BloqueCostesProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Tipo administrativo · gobierna copy y accionables. */
  tipoPlan: TipoPlanCoste;
  /** PPA garantizado · cambia banner a info-garantizado. */
  garantizado?: boolean;
  /** Empresa promotora · sustituye {nombreEmpresa} en el copy PPE. */
  nombreEmpresa?: string | null;
  /** TER del plan en formato porcentual · 1.5 = 1,50 %. null · sin dato. */
  ter: number | null;
  /** Procedencia del TER · controla copy de fuente y CTA. */
  terFuente: TerFuente;
  /** Texto humano de la fuente (ej. 'bbva.es') cuando `terFuente='catalogo'`. */
  terFuenteDetalle?: string;
  /** Callback para abrir el editor manual de TER. */
  onEditTer?: () => void;
  /** Saldo medio anual estimado · para calcular comisión anual. */
  saldoMedioAnual: number;
  /** Años desde apertura. */
  anosTranscurridos: number;
  /** Años hasta rescate · para proyectar comisión futura. */
  anosHastaRescate: number;
  /** Saldo medio proyectado en el periodo futuro. */
  saldoMedioProyectado: number;
  /** TER objetivo si se cambia a un plan más barato (default 0,5 %). */
  terObjetivo?: number;
  /**
   * TER medio del mercado para este tipo de plan, en formato porcentual.
   * null · sin dato (ej. tipo desconocido). Fix #3.
   */
  terMediaMercado?: number | null;
  /**
   * Si `anosHastaRescate` viene de defaults educativos (sin fecha de
   * nacimiento del usuario) la UI muestra un hint hacia Mi Plan. Fix #1.
   */
  esEstimacionPorDefecto?: boolean;
  /** Navegar a Mi Plan desde el hint de estimación por defecto. */
  onIrAMiPlan?: () => void;
}

type ClaseComparativa = 'por-debajo' | 'en-linea' | 'por-encima';

function claseComparativa(ter: number, media: number): ClaseComparativa {
  if (media <= 0) return 'en-linea';
  const ratio = ter / media;
  if (ratio < 0.9) return 'por-debajo';
  if (ratio <= 1.1) return 'en-linea';
  return 'por-encima';
}

function textoComparativa(clase: ClaseComparativa): string {
  switch (clase) {
    case 'por-debajo':
      return '↓ Por debajo';
    case 'en-linea':
      return '= En línea';
    case 'por-encima':
      return '↑ Por encima';
  }
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
  terFuente,
  terFuenteDetalle,
  onEditTer,
  saldoMedioAnual,
  anosTranscurridos,
  anosHastaRescate,
  saldoMedioProyectado,
  terObjetivo = 0.5,
  terMediaMercado = null,
  esEstimacionPorDefecto = false,
  onIrAMiPlan,
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

  // ter llega como porcentual (1.5 = 1,50 %) · convertir a decimal para cálculo.
  const terDec = ter != null ? ter / 100 : null;
  const terObjetivoDec = terObjetivo / 100;

  const comisionesAcumuladas = useMemo(
    () =>
      terDec == null
        ? null
        : terDec * saldoMedioAnual * Math.max(0, anosTranscurridos),
    [terDec, saldoMedioAnual, anosTranscurridos],
  );

  const comisionesFuturas = useMemo(
    () =>
      terDec == null
        ? null
        : terDec * saldoMedioProyectado * Math.max(0, anosHastaRescate),
    [terDec, saldoMedioProyectado, anosHastaRescate],
  );

  const ahorroHipotetico = useMemo(() => {
    if (terDec == null) return null;
    const futuras = terDec * saldoMedioProyectado * Math.max(0, anosHastaRescate);
    const futurasObjetivo =
      terObjetivoDec * saldoMedioProyectado * Math.max(0, anosHastaRescate);
    return Math.max(0, futuras - futurasObjetivo);
  }, [terDec, terObjetivoDec, saldoMedioProyectado, anosHastaRescate]);

  // Fix #4 · el banner sólo se renderiza para tonos informativos
  // (PPE / PPA-garantizado). El antiguo `coste-cambio-gestora-cta` queda
  // eliminado · su CTA ya no existe desde #1383 y el comparativo lo
  // sustituye visualmente en la fila "Media del mercado".
  const mostrarBanner =
    copy.costesBannerTono === 'educativo' ||
    copy.costesBannerTono === 'info-garantizado';
  const avisoId = tipoPlan === 'PPE' ? 'coste-ppe-info' : 'coste-ppa-info';
  const { visible: bannerVisibleRaw, cerrar } = useAvisoCerrable(avisoId, {
    ubicacionContexto: `/inversiones/${posicionId}`,
    etiqueta: copy.costesTitulo,
  });
  const bannerVisible = mostrarBanner && bannerVisibleRaw;

  // Bug #2 · sin botón · copy educativo seco con el ahorro hipotético al
  // pie del KPI · sustituye el "{ahorro}" del template.
  const bannerCopy =
    ahorroHipotetico != null
      ? copy.costesBannerTemplate.replace(
          '{ahorro}',
          new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(
            ahorroHipotetico,
          ),
        )
      : copy.costesBannerTemplate.replace('{ahorro}', '—');

  // Fix #3 · fila comparativa "Media del mercado" con badge.
  const claseCompar =
    ter != null && terMediaMercado != null
      ? claseComparativa(ter, terMediaMercado)
      : null;

  const subFuente = (() => {
    if (terFuente === 'manual') return ' · dato introducido por ti';
    if (terFuente === 'catalogo')
      return terFuenteDetalle
        ? ` · catálogo ATLAS · ${terFuenteDetalle}`
        : ' · catálogo ATLAS';
    return '';
  })();

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
          {ter != null ? (
            <div className={styles.bloqueSub}>
              TER actual · {ter.toFixed(2)} %{subFuente}. Cálculo · TER × saldo
              medio × años.
            </div>
          ) : (
            <div className={styles.bloqueSub}>
              No tenemos el TER de este plan en nuestro catálogo. Consulta el
              cuadro de comisiones de tu gestora y añádelo aquí.
            </div>
          )}
          {terMediaMercado != null && (
            <div
              className={styles.filaComparativa}
              data-testid="ter-fila-comparativa"
            >
              <span className={styles.filaComparativaLab}>
                Media del mercado
              </span>
              <span className={styles.filaComparativaVal}>
                {terMediaMercado.toFixed(2)} %
              </span>
              {claseCompar && (
                <span
                  className={`${styles.badgeComparativa} ${styles[`badgeComparativa--${claseCompar}`]}`}
                >
                  {textoComparativa(claseCompar)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={styles.bloqueBody}>
        {ter != null ? (
          <>
            <div className={styles.minisRow}>
              <div className={styles.mini}>
                <div className={styles.miniLab}>Acumulado pagado</div>
                <div className={styles.miniVal}>
                  {comisionesAcumuladas != null
                    ? fmtEur(comisionesAcumuladas)
                    : '—'}
                </div>
                <div className={styles.miniSub}>{anosTranscurridos} años</div>
              </div>
              <div className={styles.mini}>
                <div className={styles.miniLab}>Proyectado hasta rescate</div>
                <div className={styles.miniVal}>
                  {comisionesFuturas != null ? fmtEur(comisionesFuturas) : '—'}
                </div>
                <div className={styles.miniSub}>{anosHastaRescate} años</div>
                {esEstimacionPorDefecto && (
                  <div className={styles.hintDefault}>
                    Estimación por defecto ·{' '}
                    {onIrAMiPlan ? (
                      <button
                        type="button"
                        className={styles.linkInline}
                        onClick={onIrAMiPlan}
                      >
                        configura tu escenario en Mi Plan
                      </button>
                    ) : (
                      <span>configura tu escenario en Mi Plan</span>
                    )}{' '}
                    para una proyección personalizada.
                  </div>
                )}
              </div>
              <div className={styles.mini}>
                <div className={styles.miniLab}>
                  Ahorro a TER {terObjetivo.toFixed(1)} %
                </div>
                <div
                  className={styles.miniVal}
                  style={{ color: 'var(--atlas-v5-pos)' }}
                >
                  {ahorroHipotetico != null ? fmtEur(ahorroHipotetico) : '—'}
                </div>
                <div className={styles.miniSub}>
                  hipotético · si cambias a una gestora con TER{' '}
                  {terObjetivo.toFixed(1)} %
                </div>
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {onEditTer && (
              <div className={styles.bloqueActions}>
                <button
                  type="button"
                  className={styles.btnPrimario}
                  onClick={onEditTer}
                  aria-label="Editar TER manualmente"
                >
                  ¿No coincide con tu cuadro de comisiones? · editar TER
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.bloqueActions}>
            <button
              type="button"
              className={styles.btnPrimario}
              onClick={onEditTer}
              disabled={!onEditTer}
              aria-label="Añadir TER manualmente"
            >
              Añadir TER manualmente
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default BloqueCostes;
