// La tarjeta del cuadro · las próximas cuotas y qué hace Hacienda con ellas.
//
// Vivía dentro de `DetallePrestamoPage`, que ya pasaba de 800 líneas. Sale
// entera —no partida— porque es lo que es: una tarjeta que solo pinta.

import React from 'react';
import { Icons } from '../../../design-system/v5';
import type {
  getPreviewCuadro,
  getProximaRevision,
} from '../../../services/prestamos/lecturas';
import type { Fiscalidad } from './detalleDatos';
import { eurPlano, mesAnio } from './formato';
import styles from './DetallePrestamo.module.css';
import rev from './RevisionEnBonificaciones.module.css';

export interface CuadroPreviewProps {
  datos: {
    preview: ReturnType<typeof getPreviewCuadro>;
    progreso: { restantes: number };
    revision: ReturnType<typeof getProximaRevision>;
    fiscalidad: Fiscalidad;
  };
  /**
   * Obligatorio a propósito · el botón ya no se deshabilita, así que un
   * `undefined` lo dejaría activo sin hacer nada. Era opcional cuando la
   * pantalla del cuadro completo no existía; ahora existe.
   */
  onVerCompleto: () => void;
}

const CuadroPreview: React.FC<CuadroPreviewProps> = ({ datos, onVerCompleto }) => (
  <div className={`${styles.card} ${styles.topGoldSoft}`}>
    <div className={styles.cardT}>
      <Icons.Panel size={15} strokeWidth={2} aria-hidden />
      Cuadro de amortización
      <span className={styles.cardNota}>
        {datos.revision ? 'sube en la revisión' : 'cuota constante'}
      </span>
    </div>
    <div className={`${styles.qrow} ${styles.qhead}`}>
      <div className={styles.qh}>Mes</div>
      <div className={`${styles.qh} ${styles.qr}`}>Cuota</div>
      <div className={`${styles.qh} ${styles.qr}`}>Interés</div>
      <div className={`${styles.qh} ${styles.qr}`}>Capital</div>
    </div>
    {datos.preview.map((p) => (
      <div key={p.periodo} className={styles.qrow}>
        <div className={`${styles.qc} ${p.esRevision ? styles.qmesRev : styles.qmes}`}>
          {mesAnio(p.fechaCargo)}
          {p.esRevision && <span className={styles.revTag}>revisión</span>}
        </div>
        <div className={`${styles.qc} ${styles.qr}`}>{eurPlano(p.cuota)}</div>
        <div className={`${styles.qc} ${styles.qr}`}>{eurPlano(p.interes)}</div>
        <div className={`${styles.qc} ${styles.qr}`}>{eurPlano(p.amortizacion)}</div>
      </div>
    ))}
    {/* Qué hace Hacienda con esos intereses · vive AQUÍ, debajo de la columna
        que los cuenta. Estaba al pie de «Condiciones del banco», y eso decía
        que la deducción es algo que concede el banco *(Jose · 8 ago 2026: «¿una
        condición del banco es decir que hay deducción fiscal? eso es absurdo»)*.
        No la concede nadie: la genera que el inmueble esté alquilado. */}
    <div className={rev.fiscalPie}>
      <span className={styles.dlK}>Intereses · IRPF</span>
      <span className={rev.fiscalTexto}>
        {datos.fiscalidad.destino} ·{' '}
        {datos.fiscalidad.deducible === null ? (
          <span className={styles.chipNeutro}>comprobando el alquiler</span>
        ) : datos.fiscalidad.deducible ? (
          <span className={styles.chipOro}>
            deducible {Math.round(datos.fiscalidad.pctDeducible)}% · casilla 0105
          </span>
        ) : (
          <span className={styles.chipNeutro}>no deducible</span>
        )}
      </span>
    </div>
    <div className={styles.cardPie}>
      <button type="button" onClick={onVerCompleto}>
        Ver cuadro completo · {datos.progreso.restantes} cuotas restantes →
      </button>
    </div>
  </div>
);

export default CuadroPreview;
