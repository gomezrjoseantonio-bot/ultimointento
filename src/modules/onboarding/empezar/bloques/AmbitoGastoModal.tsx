/**
 * Modal "¿De qué es este gasto?" (FIX PUNTO 4 · P10).
 *
 * El alta de recurrente a mano y la confirmación de CADA sugerencia detectada
 * empiezan preguntando el ámbito · un inmueble (deducible · `gastosInmueble`)
 * o personal/hogar (Personal · Gastos). El motor pre-marca una opción por el
 * concepto, pero el usuario SIEMPRE confirma o cambia · nunca se crea solo y
 * NUNCA se cruzan los ámbitos.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../../../../design-system/v5';
import type { AmbitoRecurrente, InmuebleLite } from '../../../../services/onboardingDetectionService';
import styles from '../empezar.module.css';

interface Props {
  open: boolean;
  /** Inmuebles del usuario (para el selector cuando el ámbito es inmueble). */
  inmuebles: InmuebleLite[];
  /** Valor pre-marcado por el motor (el usuario puede cambiarlo). */
  initial?: AmbitoRecurrente;
  /** Texto del concepto detectado · contexto para el usuario (opcional). */
  concepto?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (sel: AmbitoRecurrente) => void;
}

const inmuebleLabel = (inm: InmuebleLite): string =>
  inm.alias || inm.address || `Inmueble ${inm.id}`;

const AmbitoGastoModal: React.FC<Props> = ({
  open,
  inmuebles,
  initial,
  concepto,
  confirmLabel = 'Continuar',
  onClose,
  onConfirm,
}) => {
  const [ambito, setAmbito] = useState<'personal' | 'inmueble'>(initial?.ambito ?? 'personal');
  const [inmuebleId, setInmuebleId] = useState<number | ''>(
    initial?.inmuebleId ?? (inmuebles[0]?.id ?? ''),
  );

  // Reabrir con un valor pre-marcado distinto (otra sugerencia) → resetea.
  useEffect(() => {
    if (!open) return;
    setAmbito(initial?.ambito ?? 'personal');
    setInmuebleId(initial?.inmuebleId ?? (inmuebles[0]?.id ?? ''));
  }, [open, initial, inmuebles]);

  const sinInmuebles = inmuebles.length === 0;
  const puedeConfirmar = useMemo(
    () => ambito === 'personal' || (ambito === 'inmueble' && inmuebleId !== ''),
    [ambito, inmuebleId],
  );

  if (!open) return null;

  const confirmar = () => {
    if (ambito === 'inmueble' && inmuebleId !== '') {
      onConfirm({ ambito: 'inmueble', inmuebleId: Number(inmuebleId) });
    } else {
      onConfirm({ ambito: 'personal' });
    }
  };

  return (
    <div className={styles.ambOverlay} role="dialog" aria-modal="true" aria-label="¿De qué es este gasto?">
      <div className={styles.ambModal}>
        <h2 className={styles.ambTitle}>¿De qué es este gasto?</h2>
        <p className={styles.ambSub}>
          {concepto ? `"${concepto}" · ` : ''}
          Lo enrutamos al sitio correcto · un gasto de inmueble es deducible y va a su inmueble.
        </p>

        <div className={styles.ambOptions}>
          <button
            type="button"
            className={`${styles.ambOpt} ${ambito === 'personal' ? styles.ambOptOn : ''}`}
            onClick={() => setAmbito('personal')}
            aria-pressed={ambito === 'personal'}
          >
            <Icons.Personal size={18} strokeWidth={1.8} className={styles.ambOptIcon} />
            <span>
              <span className={styles.ambOptName}>Personal · hogar</span>
              <span className={styles.ambOptHint}>Va a Personal · Gastos</span>
            </span>
          </button>

          <button
            type="button"
            className={`${styles.ambOpt} ${ambito === 'inmueble' ? styles.ambOptOn : ''}`}
            onClick={() => !sinInmuebles && setAmbito('inmueble')}
            aria-pressed={ambito === 'inmueble'}
            disabled={sinInmuebles}
          >
            <Icons.Inmuebles size={18} strokeWidth={1.8} className={styles.ambOptIcon} />
            <span>
              <span className={styles.ambOptName}>Un inmueble</span>
              <span className={styles.ambOptHint}>
                {sinInmuebles ? 'Aún no tienes inmuebles' : 'Gasto deducible del inmueble'}
              </span>
            </span>
          </button>

          {ambito === 'inmueble' && !sinInmuebles && (
            <select
              className={styles.ambSelect}
              value={inmuebleId}
              onChange={(e) => setInmuebleId(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="Inmueble"
            >
              {inmuebles.map((inm) => (
                <option key={inm.id} value={inm.id}>
                  {inmuebleLabel(inm)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.ambFooter}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.btnGold} onClick={confirmar} disabled={!puedeConfirmar}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AmbitoGastoModal;
