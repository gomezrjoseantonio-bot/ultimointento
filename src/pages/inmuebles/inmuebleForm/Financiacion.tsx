// Ficha de inmueble · bloque FINANCIACIÓN (dentro de "Compra y coste").
//
// Tres estados, según haya préstamo vinculado o no:
//   · VINCULADO  → el importe financiado se LEE del préstamo (solo lectura),
//     con enlace a editarlo. La aportación se deriva del coste.
//   · SIN VINCULAR + financiado > 0 → botones "Crear préstamo" (abre el
//     asistente prerrellenado) y "Vincular existente" (selector).
//   · Reconciliación viva: coste total = aportación + financiado.

import React, { useState } from 'react';
import { Banknote as IconBank, Plus as IconPlus, Link2 as IconLink, ExternalLink } from 'lucide-react';
import type { Prestamo } from '../../../types/prestamos';
import type { FinanciacionLineaInmueble } from '../../../modules/inmuebles/adapters/patrimonioInmuebleAdapter';
import styles from '../InmueblePage.module.css';

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export interface FinanciacionBlockProps {
  costeTotal: number;
  aportacion: number;
  financiado: number;
  onAportacion: (n: number) => void;
  onFinanciado: (n: number) => void;
  num: (v: string) => number;
  /** Líneas de préstamo ya imputadas al inmueble (vía servicio canónico). */
  vinculadas: FinanciacionLineaInmueble[];
  /** Préstamos vivos aún no imputados (para "vincular existente"). */
  vinculables: Prestamo[];
  onCrearPrestamo: () => void;
  onVincularExistente: (prestamoId: string) => void;
  onEditarPrestamo: (prestamoId: string) => void;
}

const FinanciacionBlock: React.FC<FinanciacionBlockProps> = ({
  costeTotal,
  aportacion,
  financiado,
  onAportacion,
  onFinanciado,
  num,
  vinculadas,
  vinculables,
  onCrearPrestamo,
  onVincularExistente,
  onEditarPrestamo,
}) => {
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const vinculado = vinculadas.length > 0;

  // Con préstamo vinculado, el financiado lo manda el préstamo (una sola fuente).
  const financiadoEfectivo = vinculado
    ? vinculadas.reduce((s, l) => s + (l.principalInicial || 0), 0)
    : financiado;

  const suma = aportacion + financiadoEfectivo;
  const descuadre = costeTotal > 0 ? suma - costeTotal : 0;
  const hayDescuadre = costeTotal > 0 && Math.abs(descuadre) >= 1;

  return (
    <div className={styles.finBlock}>
      <div className={styles.finHead}>
        <IconBank size={14} />
        <span>Financiación de la operación</span>
      </div>

      <div className={styles.finRow}>
        <div className={styles.finField}>
          <label className={styles.finLabel}>Aportación propia</label>
          <div className={styles.finInputWrap}>
            <input
              className={`${styles.input} ${styles.inputMono}`}
              value={aportacion || ''}
              onChange={(e) => {
                const v = num(e.target.value);
                onAportacion(v);
                // Deriva el financiado con el coste (solo si no lo manda un préstamo).
                if (!vinculado && costeTotal > 0) onFinanciado(Math.max(0, costeTotal - v));
              }}
              inputMode="decimal"
            />
            <span className={styles.suffix}>€</span>
          </div>
        </div>

        <div className={styles.finField}>
          <label className={styles.finLabel}>
            Importe financiado {vinculado && <span className={styles.finBadge}>del préstamo</span>}
          </label>
          <div className={styles.finInputWrap}>
            <input
              className={`${styles.input} ${styles.inputMono} ${vinculado ? styles.inputReadonlyTeal : ''}`}
              value={vinculado ? eur(financiadoEfectivo) : financiado || ''}
              readOnly={vinculado}
              onChange={(e) => {
                if (vinculado) return;
                const v = num(e.target.value);
                onFinanciado(v);
                if (costeTotal > 0) onAportacion(Math.max(0, costeTotal - v));
              }}
              inputMode="decimal"
            />
            <span className={styles.suffix}>€</span>
          </div>
        </div>
      </div>

      {/* Reconciliación con el coste total */}
      {costeTotal > 0 && (
        <div className={`${styles.finRecon} ${hayDescuadre ? styles.finReconWarn : ''}`}>
          {hayDescuadre ? (
            <>
              Aportación + financiado = <b>{eur(suma)} €</b> · no cuadra con el coste total{' '}
              <b>{eur(costeTotal)} €</b> ({descuadre > 0 ? 'sobran' : 'faltan'} {eur(Math.abs(descuadre))} €)
            </>
          ) : (
            <>
              Cuadra con el coste total <b>{eur(costeTotal)} €</b>
            </>
          )}
        </div>
      )}

      {/* Estado del vínculo con Financiación */}
      {vinculado ? (
        <div className={styles.finLinked}>
          {vinculadas.map((l) => (
            <button
              key={l.id}
              type="button"
              className={styles.finLinkedItem}
              onClick={() => onEditarPrestamo(l.id)}
              title="Editar préstamo en Financiación"
            >
              <span className={styles.finLinkedName}>
                <IconLink size={13} /> {l.nombre || 'Préstamo'}
              </span>
              <span className={styles.finLinkedMeta}>
                {l.porcentajeAfectacion < 100 ? `${Math.round(l.porcentajeAfectacion)}% · ` : ''}
                {eur(l.principalInicial)} € <ExternalLink size={12} />
              </span>
            </button>
          ))}
        </div>
      ) : financiado > 0 ? (
        <div className={styles.finActions}>
          <span className={styles.finPrompt}>Este importe está financiado:</span>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onCrearPrestamo}
          >
            <IconPlus size={14} /> Crear préstamo
          </button>
          {vinculables.length > 0 && (
            <div className={styles.finSelectWrap}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setMostrarSelector((v) => !v)}
              >
                <IconLink size={14} /> Vincular existente
              </button>
              {mostrarSelector && (
                <select
                  className={styles.input}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onVincularExistente(e.target.value);
                      setMostrarSelector(false);
                    }
                  }}
                >
                  <option value="">— Elige un préstamo —</option>
                  {vinculables.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || `Préstamo ${p.id}`} · {eur(p.principalVivo ?? 0)} €
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default FinanciacionBlock;
