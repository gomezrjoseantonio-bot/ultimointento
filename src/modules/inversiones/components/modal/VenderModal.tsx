// VenderModal · venta / rescate / reembolso · PR 4 T-INVERSIONES-V5
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §K (modal-vender).
// Preview · CÁLCULO FIFO · neto previsto tras retención.
//
// Llama `inversionesService.addAportacion(posicionId, { tipo: 'reembolso', ... })`
// que internamente calcula FIFO (vía `calcularGananciaPerdidaFIFO`).
// Para preview en vivo · usa el mismo helper sobre un Aportacion preview.

import React, { useEffect, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import { calcularGananciaPerdidaFIFO } from '../../../../services/inversionesFiscalService';
import { cuentasService } from '../../../../services/cuentasService';
import type { Account } from '../../../../services/db';
import type { Aportacion, PosicionInversion } from '../../../../types/inversiones';
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

export interface VenderModalProps {
  posicion: PosicionInversion;
  onSave: (aportacion: Omit<Aportacion, 'id'>) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];
const TIPOS_FUNGIBLES = new Set(['accion', 'etf', 'reit', 'crypto', 'fondo_inversion']);

const VenderModal: React.FC<VenderModalProps> = ({ posicion, onSave, onClose }) => {
  const [importe, setImporte] = useState('');
  const [unidadesVendidas, setUnidadesVendidas] = useState('');
  const [fecha, setFecha] = useState(today());
  const [retencionPct, setRetencionPct] = useState('19');
  const [cuentaCobroId, setCuentaCobroId] = useState('');
  const [cuentas, setCuentas] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const esFungible = TIPOS_FUNGIBLES.has(posicion.tipo);

  useEffect(() => {
    let cancelled = false;
    cuentasService.list()
      .then((list) => { if (!cancelled) setCuentas(list); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  const importeNum = parseFloat(importe) || 0;
  const unidadesNum = parseFloat(unidadesVendidas) || 0;
  const retencionNum = (parseFloat(retencionPct) || 0) / 100;

  // FIFO preview · usa el mismo helper que el service en producción.
  const fifo = useMemo(() => {
    if (importeNum <= 0) {
      return { costeAdquisicion: 0, gananciaOPerdida: 0 };
    }
    const preview: Aportacion = {
      id: -1,
      fecha: `${fecha}T12:00:00.000Z`,
      tipo: 'reembolso',
      importe: importeNum,
      unidades_vendidas: esFungible && unidadesNum > 0 ? unidadesNum : undefined,
    };
    return calcularGananciaPerdidaFIFO(posicion, preview);
  }, [importeNum, fecha, posicion, esFungible, unidadesNum]);

  const ganancia = fifo.gananciaOPerdida;
  const retencionImp = ganancia > 0 ? ganancia * retencionNum : 0;
  const neto = importeNum - retencionImp;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(importeNum) || importeNum <= 0) {
      showToastV5('El importe debe ser mayor que 0');
      return;
    }
    if (esFungible && (!Number.isFinite(unidadesNum) || unidadesNum <= 0)) {
      showToastV5('Indica las unidades vendidas');
      return;
    }
    if (!fecha) {
      showToastV5('La fecha es obligatoria');
      return;
    }
    setLoading(true);
    try {
      // Para tipo='reembolso', el campo `cuenta_cargo_id` del Aportacion se
      // reutiliza como cuenta de ABONO (donde se recibe el dinero). La
      // semántica cambia según el tipo · igual que en AportacionFormDialog
      // legacy y en treasurySyncServiceInversiones. Documentado.
      await onSave({
        fecha: `${fecha}T12:00:00.000Z`,
        tipo: 'reembolso',
        importe: importeNum,
        unidades_vendidas: esFungible ? unidadesNum : undefined,
        cuenta_cargo_id: cuentaCobroId ? Number(cuentaCobroId) : undefined,
        notas: undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} ariaLabel="Vender posición">
      <ModalAtlasHeader
        icon={<Icons.ArrowUpRight size={18} strokeWidth={1.7} />}
        title="Venta / rescate"
        subtitle={`${posicion.nombre} · ${posicion.entidad}`}
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Operación</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Importe bruto de la venta<span className={styles.req}>€</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    aria-label="Importe bruto de la venta"
                  />
                </div>
                {esFungible && (
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Unidades vendidas<span className={styles.req}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className={`${styles.input} ${styles.mono}`}
                      value={unidadesVendidas}
                      onChange={(e) => setUnidadesVendidas(e.target.value)}
                      aria-label="Unidades vendidas"
                    />
                  </div>
                )}
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha de venta<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Retención IRPF<span className={styles.opt}>%</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className={`${styles.input} ${styles.mono}`}
                    value={retencionPct}
                    onChange={(e) => setRetencionPct(e.target.value)}
                  />
                </div>
              </div>
              <div className={`${styles.row} ${styles.cols1}`}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Cuenta de abono<span className={styles.opt}>opcional</span>
                  </label>
                  <select
                    className={styles.select}
                    value={cuentaCobroId}
                    onChange={(e) => setCuentaCobroId(e.target.value)}
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
            </div>
          </ModalAtlasForm>

          <ModalAtlasPreview
            header="Cálculo FIFO"
            headerIcon={<Icons.Info size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label="Neto previsto"
              value={formatCurrency(neto)}
              valueVariant={ganancia >= 0 ? 'pos' : 'neg'}
              sub={`tras retención ${formatCurrency(retencionImp)}`}
              subAsText
            />
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow k="Importe bruto" v={formatCurrency(importeNum)} />
              <ModalAtlasPreviewRow
                k="Coste adquisición (FIFO)"
                v={formatCurrency(fifo.costeAdquisicion)}
              />
              <ModalAtlasPreviewRow
                k={ganancia >= 0 ? 'Ganancia patrimonial' : 'Pérdida patrimonial'}
                v={formatCurrency(ganancia)}
                variant={ganancia >= 0 ? 'pos' : 'neg'}
              />
              <ModalAtlasPreviewRow
                k="Retención IRPF"
                v={formatCurrency(retencionImp)}
                variant="neg"
              />
              <ModalAtlasPreviewRow k="Neto previsto" v={formatCurrency(neto)} variant="gold" />
            </ModalAtlasPreviewBlock>
            <ModalAtlasPreviewBanner>
              Tributa en <strong>base ahorro</strong> · tramos 19→28%.
              Las pérdidas pueden compensar con ganancias del año o de los 4
              ejercicios siguientes.
            </ModalAtlasPreviewBanner>
          </ModalAtlasPreview>
        </ModalAtlasBody>

        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              FIFO automático al guardar · usa el coste real por bloque.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Registrar venta'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default VenderModal;
