// AltaDepositoModal · alta depósito a plazo / cuenta remunerada · PR 3 T-INVERSIONES-V5
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §F.
// Preview · vista previa · liquidación + FGD en vivo.

import React, { useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { PosicionInversion, TipoPosicion } from '../../../../types/inversiones';
import type { RendimientoPeriodico } from '../../../../types/inversiones-extended';
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

type Subtipo = Extract<TipoPosicion, 'deposito_plazo' | 'cuenta_remunerada'>;

const SUBTIPOS: { value: Subtipo; label: string; sub: string }[] = [
  { value: 'deposito_plazo', label: 'Depósito a plazo', sub: 'capital bloqueado N meses' },
  { value: 'cuenta_remunerada', label: 'Cuenta remunerada', sub: 'liquidez disponible' },
];

const LIMITE_FGD = 100_000;

export interface AltaDepositoModalProps {
  onSave: (data: Partial<PosicionInversion> & { importe_inicial?: number }) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const AltaDepositoModal: React.FC<AltaDepositoModalProps> = ({ onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<Subtipo>('deposito_plazo');
  const [nombre, setNombre] = useState('');
  const [entidad, setEntidad] = useState('');
  const [capital, setCapital] = useState('');
  const [tae, setTae] = useState('');
  const [plazoMeses, setPlazoMeses] = useState('');
  const [retencion, setRetencion] = useState('19');
  const [fecha, setFecha] = useState(today());
  const [cuentaCargo, setCuentaCargo] = useState('');

  const calc = useMemo(() => {
    const c = parseFloat(capital) || 0;
    const t = parseFloat(tae) || 0;
    const m = parseFloat(plazoMeses) || 0;
    const r = (parseFloat(retencion) || 0) / 100;
    if (c <= 0 || t <= 0) return { interesBruto: 0, retencionImp: 0, neto: c, totalVenc: c };
    const años = m > 0 ? m / 12 : 1;
    const interesBruto = c * Math.pow(1 + t / 100, años) - c;
    const retencionImp = interesBruto * r;
    const neto = interesBruto - retencionImp;
    const totalVenc = c + neto;
    return { interesBruto, retencionImp, neto, totalVenc };
  }, [capital, tae, plazoMeses, retencion]);

  const cubrirFGD = (parseFloat(capital) || 0) <= LIMITE_FGD;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cap = parseFloat(capital);
    const taeNum = parseFloat(tae);
    const plazo = parseFloat(plazoMeses);
    if (!nombre.trim() || !entidad.trim()) return;
    if (!Number.isFinite(cap) || cap <= 0) {
      showToastV5('El capital debe ser mayor que 0');
      return;
    }
    if (!Number.isFinite(taeNum) || taeNum <= 0) {
      showToastV5('La TAE debe ser mayor que 0');
      return;
    }
    if (tipo === 'deposito_plazo' && (!Number.isFinite(plazo) || plazo <= 0)) {
      showToastV5('El plazo del depósito debe ser mayor que 0 meses');
      return;
    }
    if (!cuentaCargo) {
      showToastV5('Selecciona la cuenta de cargo del capital');
      return;
    }
    setLoading(true);
    try {
      const retencionNum = parseFloat(retencion) || 0;
      const rendimiento: RendimientoPeriodico = {
        tipo_rendimiento: 'interes_fijo',
        tasa_interes_anual: taeNum,
        frecuencia_pago: 'anual',
        reinvertir: true,
        fecha_inicio_rendimiento: `${fecha}T12:00:00.000Z`,
        retencion_porcentaje: retencionNum,
        pagos_generados: [],
      };
      await onSave({
        nombre: nombre.trim(),
        tipo,
        entidad: entidad.trim(),
        fecha_compra: `${fecha}T12:00:00.000Z`,
        fecha_valoracion: `${fecha}T12:00:00.000Z`,
        valor_actual: cap,
        importe_inicial: cap,
        total_aportado: cap,
        rentabilidad_euros: 0,
        rentabilidad_porcentaje: 0,
        aportaciones: [],
        activo: true,
        cuenta_cargo_id: Number(cuentaCargo),
        duracion_meses: tipo === 'deposito_plazo' ? plazo : undefined,
        liquidacion_intereses: 'al_vencimiento',
        retencion_fiscal: retencionNum,
        rendimiento,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} ariaLabel="Alta depósito o cuenta">
      <ModalAtlasHeader
        icon={<Icons.Tesoreria size={18} strokeWidth={1.7} />}
        title="Nuevo depósito o cuenta"
        subtitle="capital + TAE · cobertura FGD hasta 100k €"
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Tipo de producto</div>
              <div className={`${styles.selectorH} ${styles.cols2}`} role="radiogroup">
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
                    placeholder={
                      tipo === 'deposito_plazo' ? 'Ej. Depósito 24M · BBVA' : 'Ej. Cuenta Welcome · Openbank'
                    }
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Banco<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    placeholder="Ej. BBVA, Openbank, EBN…"
                    required
                  />
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Condiciones</div>
              <div className={`${styles.row} ${styles.cols3}`}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Capital<span className={styles.req}>€</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    placeholder="20000"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    TAE<span className={styles.req}>%</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={tae}
                    onChange={(e) => setTae(e.target.value)}
                    placeholder="3.20"
                  />
                </div>
                {tipo === 'deposito_plazo' ? (
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Plazo<span className={styles.req}>meses</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className={`${styles.input} ${styles.mono}`}
                      value={plazoMeses}
                      onChange={(e) => setPlazoMeses(e.target.value)}
                      placeholder="24"
                    />
                  </div>
                ) : (
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Retención<span className={styles.opt}>%</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className={`${styles.input} ${styles.mono}`}
                      value={retencion}
                      onChange={(e) => setRetencion(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha contratación<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                {tipo === 'deposito_plazo' && (
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Retención<span className={styles.opt}>%</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className={`${styles.input} ${styles.mono}`}
                      value={retencion}
                      onChange={(e) => setRetencion(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Cuenta</div>
              <div className={`${styles.row} ${styles.cols1}`}>
                <CuentaSelect
                  label="Cuenta de cargo del capital"
                  value={cuentaCargo}
                  onChange={setCuentaCargo}
                  required
                />
              </div>
            </div>
          </ModalAtlasForm>
          <ModalAtlasPreview
            header="Vista previa · liquidación"
            headerIcon={<Icons.Tesoreria size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label={tipo === 'deposito_plazo' ? 'Importe al vencimiento' : 'Interés neto anual'}
              value={formatCurrency(tipo === 'deposito_plazo' ? calc.totalVenc : calc.neto)}
              valueVariant="gold"
              sub={`neto ${formatCurrency(calc.neto)} · retención ${formatCurrency(calc.retencionImp)}`}
              subAsText
            />
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow k="Interés bruto" v={formatCurrency(calc.interesBruto)} />
              <ModalAtlasPreviewRow
                k="Retención IRPF"
                v={formatCurrency(calc.retencionImp)}
                variant="neg"
              />
              <ModalAtlasPreviewRow k="Neto" v={formatCurrency(calc.neto)} variant="pos" />
            </ModalAtlasPreviewBlock>
            <ModalAtlasPreviewBanner variant={cubrirFGD ? 'pos' : 'warn'}>
              <strong>FGD</strong> · cobertura hasta 100.000 € por
              titular y entidad.{' '}
              {cubrirFGD
                ? 'Tu capital está cubierto.'
                : 'Tu capital excede el límite FGD.'}
            </ModalAtlasPreviewBanner>
          </ModalAtlasPreview>
        </ModalAtlasBody>
        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              Tributa como rendimiento del capital mobiliario · base ahorro.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Crear'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default AltaDepositoModal;
