// TraspasoModal · traspaso entre gestoras de plan de pensiones · PR 4 T-INVERSIONES-V5
// Sustituye TraspasoPlanDialog. Solo para planes (Q3 spec · 0 traspasos fondo).
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §I (modal-traspaso).
// Preview · PLAN ORIGEN · régimen sin tributación.

import React, { useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { PlanPensiones } from '../../../../types/planesPensiones';
import ModalAtlas, { ModalAtlasBody, ModalAtlasForm } from './ModalAtlas';
import ModalAtlasHeader from './ModalAtlasHeader';
import ModalAtlasFooter, {
  ModalAtlasButtonGhost,
  ModalAtlasButtonGold,
} from './ModalAtlasFooter';
import ModalAtlasPreview, {
  ModalAtlasPreviewBanner,
  ModalAtlasPreviewBlock,
  ModalAtlasPreviewCardDark,
  ModalAtlasPreviewRow,
} from './ModalAtlasPreview';
import { formatCurrency } from '../../helpers';
import styles from '../../styles/atlas-inversiones.module.css';

export interface TraspasoInput {
  gestoraDestino: string;
  isinDestino?: string;
  valorTraspaso: number;
  fechaSolicitud?: string;
  fechaEjecucion: string;
  esTotal: boolean;
  motivo?: string;
}

export interface TraspasoModalProps {
  plan: PlanPensiones;
  onSave: (input: TraspasoInput) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const TraspasoModal: React.FC<TraspasoModalProps> = ({ plan, onSave, onClose }) => {
  const [gestoraDestino, setGestoraDestino] = useState('');
  const [isinDestino, setIsinDestino] = useState('');
  const [valorTraspaso, setValorTraspaso] = useState(String(plan.valorActual ?? 0));
  const [fechaSolicitud, setFechaSolicitud] = useState(today());
  const [fechaEjecucion, setFechaEjecucion] = useState(today());
  const [esTotal, setEsTotal] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const valorNum = parseFloat(valorTraspaso) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gestoraDestino.trim()) {
      showToastV5('Indica la gestora destino');
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      showToastV5('El valor del traspaso debe ser mayor que 0');
      return;
    }
    if (!fechaEjecucion) {
      showToastV5('La fecha de ejecución es obligatoria');
      return;
    }
    setLoading(true);
    try {
      await onSave({
        gestoraDestino: gestoraDestino.trim(),
        isinDestino: isinDestino.trim() || undefined,
        valorTraspaso: valorNum,
        fechaSolicitud,
        fechaEjecucion,
        esTotal,
        motivo: motivo.trim() || undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} ariaLabel="Traspaso de plan">
      <ModalAtlasHeader
        icon={<Icons.PiggyBank size={18} strokeWidth={1.7} />}
        title="Traspaso entre gestoras"
        subtitle={`${plan.nombre} · ${plan.gestoraActual} → nueva gestora`}
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Destino</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Nueva gestora<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={gestoraDestino}
                    onChange={(e) => setGestoraDestino(e.target.value)}
                    placeholder="Ej. Indexa Capital, Renta 4…"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    ISIN nuevo<span className={styles.opt}>opcional</span>
                  </label>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.mono}`}
                    value={isinDestino}
                    onChange={(e) => setIsinDestino(e.target.value)}
                    placeholder="ES0123456789"
                    maxLength={12}
                  />
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Importe y fechas</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Valor del traspaso<span className={styles.req}>€</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={valorTraspaso}
                    onChange={(e) => setValorTraspaso(e.target.value)}
                    aria-label="Valor del traspaso"
                  />
                </div>
                <div className={styles.field}>
                  <button
                    type="button"
                    className={`${styles.check}${esTotal ? ' ' + styles.active : ''}`}
                    onClick={() => setEsTotal((v) => !v)}
                    aria-pressed={esTotal}
                    style={{ marginTop: 22 }}
                  >
                    <span className={styles.checkBox} aria-hidden>
                      {esTotal ? '✓' : ''}
                    </span>
                    <div>
                      <div className={styles.checkTit}>Traspaso total</div>
                      <div className={styles.checkSub}>
                        si desmarcas · queda saldo en la gestora origen
                      </div>
                    </div>
                  </button>
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha de solicitud<span className={styles.opt}>opcional</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={fechaSolicitud}
                    onChange={(e) => setFechaSolicitud(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha de ejecución<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={fechaEjecucion}
                    onChange={(e) => setFechaEjecucion(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className={`${styles.row} ${styles.cols1}`}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Motivo<span className={styles.opt}>opcional · no se persiste todavía</span>
                  </label>
                  <textarea
                    className={styles.textarea}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Mejorar política de inversión, comisiones, etc."
                  />
                  <div className={styles.hint}>
                    El schema actual de `traspasosPlanPensiones` no guarda
                    este campo · queda pendiente para T13-bis.
                  </div>
                </div>
              </div>
            </div>
          </ModalAtlasForm>

          <ModalAtlasPreview
            header="Plan origen"
            headerIcon={<Icons.PiggyBank size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label="Valor a traspasar"
              value={formatCurrency(valorNum)}
              valueVariant="gold"
              sub={`${plan.gestoraActual} → ${gestoraDestino || 'nueva gestora'}`}
              subAsText
            />
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow k="Gestora actual" v={plan.gestoraActual} variant="txt" />
              <ModalAtlasPreviewRow k="Tipo administrativo" v={plan.tipoAdministrativo} variant="txt" />
              <ModalAtlasPreviewRow k="Traspaso total" v={esTotal ? 'Sí' : 'No · parcial'} variant="txt" />
            </ModalAtlasPreviewBlock>
            <ModalAtlasPreviewBanner variant="pos">
              <strong>Sin tributación</strong> · los traspasos entre planes
              de pensiones NO generan ganancia patrimonial. El régimen fiscal
              del plan se mantiene intacto.
            </ModalAtlasPreviewBanner>
          </ModalAtlasPreview>
        </ModalAtlasBody>

        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              Identidad del plan estable · las aportaciones previas se conservan.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Registrar traspaso'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default TraspasoModal;
