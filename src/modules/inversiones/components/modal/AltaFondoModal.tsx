// AltaFondoModal · alta de fondo de inversión · PR 3 T-INVERSIONES-V5
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §C (modal-alta-fondo).
// Preview · informativo Art. 94 LIRPF · diferimiento.
// MVP minimal · modelo de datos fondos diferido a T13-bis (§1.2 spec).

import React, { useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { PosicionInversion } from '../../../../types/inversiones';
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
import CuentaSelect from './CuentaSelect';
import styles from '../../styles/atlas-inversiones.module.css';

export interface AltaFondoModalProps {
  onSave: (data: Partial<PosicionInversion> & { importe_inicial?: number }) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const AltaFondoModal: React.FC<AltaFondoModalProps> = ({ onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [entidad, setEntidad] = useState('');
  const [isin, setIsin] = useState('');
  const [fechaCompra, setFechaCompra] = useState(today());
  const [importeInicial, setImporteInicial] = useState('');
  const [valorActual, setValorActual] = useState('');
  const [cuentaCargo, setCuentaCargo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !entidad.trim()) return;
    const importe = importeInicial ? parseFloat(importeInicial) : 0;
    if (importeInicial && (!Number.isFinite(importe) || importe < 0)) {
      showToastV5('El capital aportado no puede ser negativo');
      return;
    }
    if (!cuentaCargo) {
      showToastV5('Selecciona la cuenta de cargo de la compra');
      return;
    }
    setLoading(true);
    try {
      const valor = valorActual ? parseFloat(valorActual) : importe;
      await onSave({
        nombre: nombre.trim(),
        tipo: 'fondo_inversion',
        entidad: entidad.trim(),
        isin: isin.trim() || undefined,
        fecha_compra: `${fechaCompra}T12:00:00.000Z`,
        fecha_valoracion: `${fechaCompra}T12:00:00.000Z`,
        valor_actual: valor,
        importe_inicial: importe,
        total_aportado: importe,
        rentabilidad_euros: valor - importe,
        rentabilidad_porcentaje: importe > 0 ? ((valor - importe) / importe) * 100 : 0,
        aportaciones: [],
        activo: true,
        cuenta_cargo_id: Number(cuentaCargo),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} ariaLabel="Alta fondo de inversión">
      <ModalAtlasHeader
        icon={<Icons.Fondos size={18} strokeWidth={1.7} />}
        title="Nuevo fondo de inversión"
        subtitle="FI español o UCITS · régimen de diferimiento art. 94"
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Identificación</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Nombre del fondo<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. MSCI World UCITS"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Gestora / broker<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    placeholder="Ej. MyInvestor, Indexa…"
                    required
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    ISIN<span className={styles.opt}>opcional</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={isin}
                    onChange={(e) => setIsin(e.target.value)}
                    placeholder="Ej. IE00B4L5Y983"
                    maxLength={12}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha de compra<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={fechaCompra}
                    onChange={(e) => setFechaCompra(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Valoración</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Capital aportado<span className={styles.opt}>€</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={importeInicial}
                    onChange={(e) => setImporteInicial(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Valor actual<span className={styles.opt}>€</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={valorActual}
                    onChange={(e) => setValorActual(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Cuenta</div>
              <div className={`${styles.row} ${styles.cols1}`}>
                <CuentaSelect
                  label="Cuenta de cargo de la compra"
                  value={cuentaCargo}
                  onChange={setCuentaCargo}
                  required
                />
              </div>
            </div>
          </ModalAtlasForm>
          <ModalAtlasPreview
            header="Régimen fiscal"
            headerIcon={<Icons.Info size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label="Régimen aplicable"
              value="Art. 94 LIRPF"
              valueVariant="gold"
              sub="diferimiento por traspaso"
              subAsText
            />
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow k="Tributación" v="base ahorro" variant="txt" />
              <ModalAtlasPreviewRow k="Devengo IRPF" v="al reembolso" variant="txt" />
              <ModalAtlasPreviewRow k="Diferimiento" v="entre FI" variant="txt" />
            </ModalAtlasPreviewBlock>
            <ModalAtlasPreviewBanner>
              Los <strong>traspasos</strong> entre fondos NO generan
              tributación inmediata. Sólo al <strong>reembolso</strong> se
              calcula la plusvalía y se aplican los tramos base ahorro
              (19→28%).
            </ModalAtlasPreviewBanner>
            <ModalAtlasPreviewBanner variant="warn">
              <strong>Modelo de fondos como entidad</strong> · diferido a
              T13-bis. Esta alta usa el modelo simple actual.
            </ModalAtlasPreviewBanner>
          </ModalAtlasPreview>
        </ModalAtlasBody>
        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              MVP fondos simples · el régimen 94 se cableará en T13-bis.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Crear fondo'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default AltaFondoModal;
