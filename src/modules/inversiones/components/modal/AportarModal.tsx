// AportarModal · Modal de aportación a posición existente · PR 4 T-INVERSIONES-V5
// Sustituye AportacionFormDialog y DialogAportar (con picker para galería).
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §H (modal-aportar).
// Preview · IMPACTO FISCAL · ahorro estimado IRPF al marginal del usuario.

import React, { useEffect, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import { cuentasService } from '../../../../services/cuentasService';
import type { Account } from '../../../../services/db';
import type { Aportacion, PosicionInversion } from '../../../../types/inversiones';
import type { PlanPensiones } from '../../../../types/planesPensiones';
import type { CartaItem } from '../../types/cartaItem';
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

const MARGINAL_IRPF_DEFAULT = 0.45;

export interface AportarModalProps {
  /** Posición preseleccionada · si null/undefined activa picker. */
  posicion?: CartaItem | null;
  /** Lista para el picker · solo se usa si `posicion` es null. */
  posiciones?: CartaItem[];
  /** Marginal IRPF para preview (default 0.45). */
  marginalIrpf?: number;
  /**
   * Service de planes · llamado cuando la posición seleccionada es un plan
   * (CartaItem._origen === 'planesPensiones').
   */
  onSavePlan?: (
    plan: PlanPensiones,
    aportacion: {
      fecha: string;
      ejercicioFiscal: number;
      importeTitular: number;
      importeEmpresa: number;
      cuentaCargoId?: number;
      notas?: string;
    },
  ) => Promise<void> | void;
  /**
   * Service de inversiones · llamado cuando la posición seleccionada es
   * una inversión (CartaItem._origen === 'inversiones').
   */
  onSaveInversion?: (
    posicion: PosicionInversion,
    aportacion: Omit<Aportacion, 'id'>,
  ) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const AportarModal: React.FC<AportarModalProps> = ({
  posicion: posicionInicial,
  posiciones,
  marginalIrpf = MARGINAL_IRPF_DEFAULT,
  onSavePlan,
  onSaveInversion,
  onClose,
}) => {
  const [seleccionada, setSeleccionada] = useState<CartaItem | null>(
    posicionInicial ?? null,
  );
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState(today());
  const [notas, setNotas] = useState('');
  const [cuentaCargoId, setCuentaCargoId] = useState('');
  const [cuentas, setCuentas] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    cuentasService.list()
      .then((list) => { if (!cancelled) setCuentas(list); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  const esPlan = seleccionada?._origen === 'planesPensiones';
  const importeNum = parseFloat(importe) || 0;
  const ahorroEstimado = useMemo(
    () => (esPlan ? Math.round(importeNum * marginalIrpf) : 0),
    [esPlan, importeNum, marginalIrpf],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seleccionada) {
      showToastV5('Selecciona la posición a la que aportar');
      return;
    }
    if (!Number.isFinite(importeNum) || importeNum <= 0) {
      showToastV5('El importe debe ser mayor que 0');
      return;
    }
    if (!fecha) {
      showToastV5('La fecha es obligatoria');
      return;
    }
    setLoading(true);
    try {
      if (esPlan && onSavePlan) {
        await onSavePlan(seleccionada._original as PlanPensiones, {
          fecha,
          ejercicioFiscal: new Date(fecha).getUTCFullYear(),
          importeTitular: importeNum,
          importeEmpresa: 0,
          cuentaCargoId: cuentaCargoId ? Number(cuentaCargoId) : undefined,
          notas: notas.trim() || undefined,
        });
      } else if (!esPlan && onSaveInversion) {
        await onSaveInversion(seleccionada._original as PosicionInversion, {
          fecha: `${fecha}T12:00:00.000Z`,
          importe: importeNum,
          tipo: 'aportacion',
          notas: notas.trim() || undefined,
          cuenta_cargo_id: cuentaCargoId ? Number(cuentaCargoId) : undefined,
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} ariaLabel="Aportar a posición">
      <ModalAtlasHeader
        icon={<Icons.Plus size={18} strokeWidth={2} />}
        title="Aportar a posición"
        subtitle={
          seleccionada
            ? `${seleccionada.nombre} · ${seleccionada.entidad}`
            : 'elige posición y cuanto aportas'
        }
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            {!posicionInicial && posiciones && posiciones.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  Posición<span className={styles.req}>*</span>
                </div>
                <div className={`${styles.row} ${styles.cols1}`}>
                  <select
                    className={styles.select}
                    value={seleccionada ? String(seleccionada._idOriginal) : ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSeleccionada(
                        posiciones.find((p) => String(p._idOriginal) === id) ?? null,
                      );
                    }}
                    aria-label="Posición destino"
                  >
                    <option value="">Selecciona…</option>
                    {posiciones.map((p) => (
                      <option key={String(p._idOriginal)} value={String(p._idOriginal)}>
                        {p.nombre} · {p.entidad}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Aportación</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Importe<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    placeholder="1500.00"
                    aria-label="Importe a aportar"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
              </div>
              <div className={`${styles.row} ${styles.cols1}`}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Cuenta de cargo<span className={styles.opt}>opcional</span>
                  </label>
                  <select
                    className={styles.select}
                    value={cuentaCargoId}
                    onChange={(e) => setCuentaCargoId(e.target.value)}
                  >
                    <option value="">No vincular a tesorería</option>
                    {cuentas.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.alias || c.ibanMasked || c.iban || `Cuenta #${c.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={`${styles.row} ${styles.cols1}`}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Notas<span className={styles.opt}>opcional</span>
                  </label>
                  <textarea
                    className={styles.textarea}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Comentario interno"
                  />
                </div>
              </div>
            </div>
          </ModalAtlasForm>

          <ModalAtlasPreview
            header="Impacto fiscal"
            headerIcon={<Icons.Info size={12} strokeWidth={2} />}
          >
            {esPlan ? (
              <>
                <ModalAtlasPreviewCardDark
                  label="Ahorro estimado IRPF"
                  value={formatCurrency(ahorroEstimado)}
                  valueVariant="pos"
                  sub={`marginal ${(marginalIrpf * 100).toFixed(0)}% · importe ${formatCurrency(importeNum)}`}
                  subAsText
                />
                <ModalAtlasPreviewBlock>
                  <ModalAtlasPreviewRow k="Importe aportado" v={formatCurrency(importeNum)} />
                  <ModalAtlasPreviewRow
                    k={`Marginal ${(marginalIrpf * 100).toFixed(0)}%`}
                    v={formatCurrency(ahorroEstimado)}
                    variant="pos"
                  />
                </ModalAtlasPreviewBlock>
                <ModalAtlasPreviewBanner>
                  El ahorro es estimativo · depende del límite anual del plan
                  y del marginal real del IRPF en tu declaración.
                </ModalAtlasPreviewBanner>
              </>
            ) : (
              <>
                <ModalAtlasPreviewCardDark
                  label="Aportación a posición"
                  value={formatCurrency(importeNum)}
                  valueVariant="gold"
                  sub={
                    seleccionada
                      ? `${seleccionada.nombre} · ${seleccionada.entidad}`
                      : 'sin posición seleccionada'
                  }
                  subAsText
                />
                <ModalAtlasPreviewBanner>
                  Inversiones · sin deducción IRPF. La aportación incrementa
                  el coste de adquisición de la posición.
                </ModalAtlasPreviewBanner>
              </>
            )}
          </ModalAtlasPreview>
        </ModalAtlasBody>

        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              La aportación se registra como movimiento de la posición.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Aportar'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default AportarModal;
