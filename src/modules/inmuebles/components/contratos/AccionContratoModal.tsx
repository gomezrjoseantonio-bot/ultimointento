// Consolidación Contratos → Alquileres · Fase F (parte 2) · modal de acciones
// contractuales reales (Renovar / Finalizar) sobre la ficha del contrato.
//
// Escribe vía `contractLifecycleService` (que APENDA al histórico, nunca lo
// modifica ni borra). Al confirmar, avisa al padre (`onHecho`) para recargar la
// lista. Sin dependencias de router (se usa dentro del drawer, testeable aislado).

import React, { useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { Contract, MotivoFin } from '../../../../services/db';
import {
  renovarContrato,
  finalizarContrato,
} from '../../../../services/contractLifecycleService';
import { esFechaIndefinida } from '../../utils/formatFechaFin';
import styles from './AccionContratoModal.module.css';

export type AccionContratoModo = 'renovar' | 'finalizar';

export interface AccionContratoModalProps {
  contrato: Contract & { id: number };
  modo: AccionContratoModo;
  onClose: () => void;
  /** Se llama tras aplicar el cambio con éxito (para recargar la lista). */
  onHecho: () => void;
}

const MOTIVO_FIN_LABEL: Record<MotivoFin, string> = {
  fin_natural: 'Fin natural del contrato',
  cambio_ciudad: 'El inquilino cambia de ciudad',
  no_renovacion_precio: 'No se renueva por precio',
  incidencia_convivencia: 'Incidencia de convivencia',
  rescision_impago: 'Rescisión por impago',
  otros: 'Otros',
};

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

const AccionContratoModal: React.FC<AccionContratoModalProps> = ({
  contrato,
  modo,
  onClose,
  onHecho,
}) => {
  const esRenovar = modo === 'renovar';

  // Renovar · fecha fin prefijada a la actual (si es definida) y renta actual.
  const [nuevaFechaFin, setNuevaFechaFin] = useState<string>(
    esFechaIndefinida(contrato.fechaFin) ? '' : contrato.fechaFin,
  );
  const [nuevaRenta, setNuevaRenta] = useState<string>(String(contrato.rentaMensual ?? ''));

  // Finalizar · fecha de salida (hoy) + motivo.
  const [fechaCierre, setFechaCierre] = useState<string>(hoyISO());
  const [motivoFin, setMotivoFin] = useState<MotivoFin>('fin_natural');
  const [nota, setNota] = useState<string>('');

  const [enviando, setEnviando] = useState(false);

  const puedeConfirmar = esRenovar
    ? nuevaFechaFin.trim() !== ''
    : fechaCierre.trim() !== '';

  const confirmar = async (): Promise<void> => {
    if (!puedeConfirmar || enviando) return;
    setEnviando(true);
    try {
      if (esRenovar) {
        const rentaNum = Number(nuevaRenta);
        await renovarContrato(contrato.id, {
          nuevaFechaFin,
          ...(Number.isFinite(rentaNum) && rentaNum > 0 && rentaNum !== contrato.rentaMensual
            ? { nuevaRenta: rentaNum }
            : {}),
          ...(nota.trim() !== '' ? { nota: nota.trim() } : {}),
        });
        showToastV5('Contrato renovado');
      } else {
        await finalizarContrato(contrato.id, {
          fechaCierre,
          motivoFin,
          ...(nota.trim() !== '' ? { detalleMotivoFin: nota.trim() } : {}),
        });
        showToastV5('Contrato finalizado');
      }
      onHecho();
    } catch (err) {
      console.error('Error aplicando acción de contrato', err);
      showToastV5(esRenovar ? 'No se pudo renovar el contrato' : 'No se pudo finalizar el contrato');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={esRenovar ? 'Renovar contrato' : 'Finalizar contrato'}
        className={styles.modal}
      >
        <div className={styles.head}>
          <h3 className={styles.title}>{esRenovar ? 'Renovar contrato' : 'Finalizar contrato'}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className={styles.body}>
          {esRenovar ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Nueva fecha fin</span>
                <input
                  type="date"
                  className={styles.input}
                  value={nuevaFechaFin}
                  onChange={(e) => setNuevaFechaFin(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Nueva renta mensual (€)</span>
                <input
                  type="number"
                  className={styles.input}
                  value={nuevaRenta}
                  min={0}
                  onChange={(e) => setNuevaRenta(e.target.value)}
                />
                <span className={styles.hint}>
                  Si cambia, se registra como renegociación en el histórico.
                </span>
              </label>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Fecha de salida</span>
                <input
                  type="date"
                  className={styles.input}
                  value={fechaCierre}
                  onChange={(e) => setFechaCierre(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Motivo</span>
                <select
                  className={styles.input}
                  value={motivoFin}
                  onChange={(e) => setMotivoFin(e.target.value as MotivoFin)}
                >
                  {(Object.keys(MOTIVO_FIN_LABEL) as MotivoFin[]).map((m) => (
                    <option key={m} value={m}>
                      {MOTIVO_FIN_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className={styles.field}>
            <span className={styles.label}>Nota (opcional)</span>
            <textarea
              className={styles.textarea}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
            />
          </label>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={enviando}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={confirmar}
            disabled={!puedeConfirmar || enviando}
          >
            {enviando ? 'Guardando…' : esRenovar ? 'Renovar' : 'Finalizar'}
          </button>
        </div>
      </div>
    </>
  );
};

export default AccionContratoModal;
export { AccionContratoModal };
