// AltaAccionModal · alta acción / ETF / REIT · PR 3 T-INVERSIONES-V5
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §D.
// Preview · informativo "Tramos base ahorro 19→28%".

import React, { useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { PosicionInversion, TipoPosicion } from '../../../../types/inversiones';
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
import { formatCurrency } from '../../helpers';
import styles from '../../styles/atlas-inversiones.module.css';

type SubtipoEquity = Extract<TipoPosicion, 'accion' | 'etf' | 'reit'>;

const SUBTIPOS: { value: SubtipoEquity; label: string; sub: string }[] = [
  { value: 'accion', label: 'Acción', sub: 'valor cotizado individual' },
  { value: 'etf', label: 'ETF', sub: 'fondo cotizado' },
  { value: 'reit', label: 'REIT', sub: 'SOCIMI · inmobiliario' },
];

export interface AltaAccionModalProps {
  onSave: (data: Partial<PosicionInversion> & { importe_inicial?: number }) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const AltaAccionModal: React.FC<AltaAccionModalProps> = ({ onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<SubtipoEquity>('accion');
  const [nombre, setNombre] = useState('');
  const [entidad, setEntidad] = useState('');
  const [ticker, setTicker] = useState('');
  const [isin, setIsin] = useState('');
  const [unidades, setUnidades] = useState('');
  const [precioMedio, setPrecioMedio] = useState('');
  const [precioActual, setPrecioActual] = useState('');
  const [fechaCompra, setFechaCompra] = useState(today());
  const [cuentaCargo, setCuentaCargo] = useState('');
  const [cuentaCobro, setCuentaCobro] = useState('');

  const aportadoCalc = useMemo(() => {
    const n = parseFloat(unidades) || 0;
    const p = parseFloat(precioMedio) || 0;
    return n * p;
  }, [unidades, precioMedio]);

  const valorCalc = useMemo(() => {
    const n = parseFloat(unidades) || 0;
    const p = parseFloat(precioActual) || parseFloat(precioMedio) || 0;
    return n * p;
  }, [unidades, precioActual, precioMedio]);

  const plusvaliaCalc = valorCalc - aportadoCalc;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const unidadesNum = parseFloat(unidades);
    const precioNum = parseFloat(precioMedio);
    if (!nombre.trim() || !entidad.trim()) return;
    if (!Number.isFinite(unidadesNum) || unidadesNum <= 0) {
      showToastV5('Las unidades deben ser mayor que 0');
      return;
    }
    if (!Number.isFinite(precioNum) || precioNum <= 0) {
      showToastV5('El precio medio de compra debe ser mayor que 0');
      return;
    }
    if (!cuentaCargo) {
      showToastV5('Selecciona la cuenta de cargo de la compra');
      return;
    }
    setLoading(true);
    try {
      await onSave({
        nombre: nombre.trim(),
        tipo,
        entidad: entidad.trim(),
        ticker: ticker.trim() || undefined,
        isin: isin.trim() || undefined,
        numero_participaciones: unidadesNum,
        precio_medio_compra: precioNum,
        fecha_compra: `${fechaCompra}T12:00:00.000Z`,
        fecha_valoracion: `${fechaCompra}T12:00:00.000Z`,
        valor_actual: valorCalc,
        importe_inicial: aportadoCalc,
        total_aportado: aportadoCalc,
        rentabilidad_euros: plusvaliaCalc,
        rentabilidad_porcentaje: aportadoCalc > 0 ? (plusvaliaCalc / aportadoCalc) * 100 : 0,
        aportaciones: [],
        activo: true,
        cuenta_cargo_id: Number(cuentaCargo),
        cuenta_cobro_id: cuentaCobro ? Number(cuentaCobro) : undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} ariaLabel="Alta acción ETF o REIT">
      <ModalAtlasHeader
        icon={<Icons.ArrowUpRight size={18} strokeWidth={1.7} />}
        title="Nueva acción / ETF / REIT"
        subtitle="valores cotizados · tributan en base ahorro"
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Tipo de valor</div>
              <div className={`${styles.selectorH} ${styles.cols3}`} role="radiogroup">
                {SUBTIPOS.map((s) => {
                  const active = tipo === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`${styles.tab}${active ? ' ' + styles.active : ''}`}
                      onClick={() => setTipo(s.value)}
                      data-subtipo={s.value}
                    >
                      <span className={styles.tabLabel}>{s.label}</span>
                      <span className={styles.tabSub}>{s.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Identificación</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Nombre<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Apple · Inditex · iShares Core S&P"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Broker<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    placeholder="Ej. DEGIRO, Interactive Brokers…"
                    required
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Ticker<span className={styles.opt}>opcional</span>
                  </label>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.mono}`}
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    maxLength={8}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    ISIN<span className={styles.opt}>opcional</span>
                  </label>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.mono}`}
                    value={isin}
                    onChange={(e) => setIsin(e.target.value)}
                    placeholder="US0378331005"
                    maxLength={12}
                  />
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Posición</div>
              <div className={`${styles.row} ${styles.cols3}`}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Unidades<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={unidades}
                    onChange={(e) => setUnidades(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Precio medio compra<span className={styles.opt}>€</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={precioMedio}
                    onChange={(e) => setPrecioMedio(e.target.value)}
                    placeholder="150.00"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Precio actual<span className={styles.opt}>€</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={precioActual}
                    onChange={(e) => setPrecioActual(e.target.value)}
                    placeholder="175.00"
                  />
                </div>
              </div>
              <div className={styles.row}>
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
                <div />
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Cuentas</div>
              <div className={styles.row}>
                <CuentaSelect
                  label="Cuenta de cargo"
                  value={cuentaCargo}
                  onChange={setCuentaCargo}
                  required
                />
                <CuentaSelect
                  label="Cuenta de cobro de dividendos"
                  value={cuentaCobro}
                  onChange={setCuentaCobro}
                />
              </div>
            </div>
          </ModalAtlasForm>
          <ModalAtlasPreview
            header="Tramos base ahorro"
            headerIcon={<Icons.Info size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label="Valor actual"
              value={formatCurrency(valorCalc)}
              valueVariant={plusvaliaCalc >= 0 ? 'pos' : 'neg'}
              sub={
                aportadoCalc > 0
                  ? `coste ${formatCurrency(aportadoCalc)} · ${
                      plusvaliaCalc >= 0 ? '+' : ''
                    }${formatCurrency(plusvaliaCalc)}`
                  : 'sin coste registrado'
              }
              subAsText
            />
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow k="0 – 6.000 €" v="19%" />
              <ModalAtlasPreviewRow k="6.000 – 50.000 €" v="21%" />
              <ModalAtlasPreviewRow k="50.000 – 200.000 €" v="23%" />
              <ModalAtlasPreviewRow k="200.000 – 300.000 €" v="27%" />
              <ModalAtlasPreviewRow k="> 300.000 €" v="28%" variant="gold" />
            </ModalAtlasPreviewBlock>
            <ModalAtlasPreviewBanner>
              Las plusvalías sólo tributan al <strong>vender</strong>. Los
              dividendos cobrados también van a base ahorro · con retención
              previa del 19%.
            </ModalAtlasPreviewBanner>
          </ModalAtlasPreview>
        </ModalAtlasBody>
        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              FIFO automático al vender · veremos el coste de adquisición.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Crear posición'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default AltaAccionModal;
