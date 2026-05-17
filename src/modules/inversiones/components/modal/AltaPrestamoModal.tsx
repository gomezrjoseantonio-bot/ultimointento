// AltaPrestamoModal · alta préstamo P2P / a empresa · PR 3 T-INVERSIONES-V5
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §E.
// Preview · cálculo financiero · cobros netos previstos en vivo.

import React, { useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { PosicionInversion } from '../../../../types/inversiones';
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

type Modalidad = 'solo_intereses' | 'capital_e_intereses' | 'al_vencimiento';
type Frecuencia = 'mensual' | 'trimestral' | 'semestral' | 'anual';
type Subtipo = 'p2p' | 'empresa';

export interface AltaPrestamoModalProps {
  onSave: (data: Partial<PosicionInversion> & { importe_inicial?: number }) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const SUBTIPOS: { value: Subtipo; label: string; sub: string }[] = [
  { value: 'p2p', label: 'P2P', sub: 'plataformas (Mintos · SmartFlip…)' },
  { value: 'empresa', label: 'A empresa', sub: 'préstamo a tu propia SL u otra' },
];

const MODALIDADES: { value: Modalidad; label: string }[] = [
  { value: 'solo_intereses', label: 'Solo intereses periódicos · capital al vencimiento' },
  { value: 'capital_e_intereses', label: 'Cuota francesa · capital + intereses' },
  { value: 'al_vencimiento', label: 'Todo al vencimiento (bullet)' },
];

const FRECUENCIAS: { value: Frecuencia; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const AltaPrestamoModal: React.FC<AltaPrestamoModalProps> = ({ onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [subtipo, setSubtipo] = useState<Subtipo>('p2p');
  const [nombre, setNombre] = useState('');
  const [entidad, setEntidad] = useState('');
  const [capital, setCapital] = useState('');
  const [tin, setTin] = useState('');
  const [duracionMeses, setDuracionMeses] = useState('');
  const [modalidad, setModalidad] = useState<Modalidad>('solo_intereses');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual');
  const [retencion, setRetencion] = useState('19');
  const [fecha, setFecha] = useState(today());
  const [cuentaCargo, setCuentaCargo] = useState('');
  const [cuentaCobro, setCuentaCobro] = useState('');

  // ── Preview · cobros netos previstos ─────────────────────────────
  // capital_e_intereses · cuota francesa real (PMT) · convertida a la
  // frecuencia seleccionada. Fórmula: c × i / (1 − (1+i)^−n) con `i` la
  // tasa periódica y `n` el nº de periodos. Resto modalidades · solo
  // intereses devengados en el periodo o `neto` total al vencimiento.
  const calc = useMemo(() => {
    const c = parseFloat(capital) || 0;
    const t = parseFloat(tin) || 0;
    const d = parseFloat(duracionMeses) || 0;
    const r = (parseFloat(retencion) || 0) / 100;
    if (c <= 0 || t <= 0 || d <= 0) {
      return { interesBruto: 0, retencionImporte: 0, neto: 0, cuotaPeriodica: 0 };
    }
    const interesAnual = (c * t) / 100;
    const años = d / 12;
    const interesBruto = interesAnual * años;
    const retencionImporte = interesBruto * r;
    const neto = interesBruto - retencionImporte;

    const periodosAño =
      frecuencia === 'mensual' ? 12 : frecuencia === 'trimestral' ? 4 : frecuencia === 'semestral' ? 2 : 1;

    let cuotaPeriodica: number;
    if (modalidad === 'al_vencimiento') {
      cuotaPeriodica = neto;
    } else if (modalidad === 'capital_e_intereses') {
      // Cuota francesa · capital + intereses · periodicidad de la frecuencia.
      const nPeriodos = Math.round((d / 12) * periodosAño);
      const tasaPeriodo = t / 100 / periodosAño;
      cuotaPeriodica = nPeriodos > 0 && tasaPeriodo > 0
        ? (c * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -nPeriodos))
        : 0;
    } else {
      // solo_intereses · interés del periodo, sin amortizar principal.
      cuotaPeriodica = interesAnual / periodosAño;
    }
    return { interesBruto, retencionImporte, neto, cuotaPeriodica };
  }, [capital, tin, duracionMeses, retencion, frecuencia, modalidad]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cap = parseFloat(capital);
    const tinNum = parseFloat(tin);
    const duracion = parseFloat(duracionMeses);
    if (!nombre.trim() || !entidad.trim()) return;
    if (!Number.isFinite(cap) || cap <= 0) {
      showToastV5('El capital debe ser mayor que 0');
      return;
    }
    if (!Number.isFinite(tinNum) || tinNum <= 0) {
      showToastV5('El TIN debe ser mayor que 0');
      return;
    }
    if (!Number.isFinite(duracion) || duracion <= 0) {
      showToastV5('La duración debe ser mayor que 0 meses');
      return;
    }
    if (!cuentaCargo) {
      showToastV5('Selecciona la cuenta de cargo del capital');
      return;
    }
    setLoading(true);
    try {
      const esVencimiento = modalidad === 'al_vencimiento';
      const frecuenciaPago = esVencimiento ? 'anual' : frecuencia;
      const retencionNum = parseFloat(retencion) || 0;
      const rendimiento: RendimientoPeriodico = {
        tipo_rendimiento: 'interes_fijo',
        tasa_interes_anual: tinNum,
        frecuencia_pago: frecuenciaPago,
        reinvertir: esVencimiento,
        fecha_inicio_rendimiento: `${fecha}T12:00:00.000Z`,
        retencion_porcentaje: retencionNum,
        pagos_generados: [],
      };
      await onSave({
        nombre: nombre.trim(),
        tipo: 'prestamo_p2p',
        entidad: subtipo === 'empresa' ? entidad.trim() || 'propia' : entidad.trim(),
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
        cuenta_cobro_id: cuentaCobro ? Number(cuentaCobro) : undefined,
        duracion_meses: duracion,
        modalidad_devolucion: modalidad,
        frecuencia_cobro: esVencimiento ? 'al_vencimiento' : frecuencia,
        retencion_fiscal: retencionNum,
        rendimiento,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} ariaLabel="Alta préstamo">
      <ModalAtlasHeader
        icon={<Icons.Banknote size={18} strokeWidth={1.7} />}
        title="Nuevo préstamo"
        subtitle="P2P o a empresa · cobros netos previstos en vivo"
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Modalidad de préstamo</div>
              <div className={`${styles.selectorH} ${styles.cols2}`} role="radiogroup">
                {SUBTIPOS.map((s) => {
                  const active = subtipo === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`${styles.tab}${active ? ' ' + styles.active : ''}`}
                      onClick={() => setSubtipo(s.value)}
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
                    Nombre del préstamo<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. SmartFlip · 10% TIN"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {subtipo === 'p2p' ? 'Plataforma' : 'Empresa deudora'}
                    <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    placeholder={subtipo === 'p2p' ? 'Ej. SmartFlip, Mintos…' : 'Ej. propia, Unihouser…'}
                    required
                  />
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Condiciones financieras</div>
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
                    placeholder="10000"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    TIN<span className={styles.req}>%</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="10.00"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Duración<span className={styles.req}>meses</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className={`${styles.input} ${styles.mono}`}
                    value={duracionMeses}
                    onChange={(e) => setDuracionMeses(e.target.value)}
                    placeholder="60"
                  />
                </div>
              </div>
              <div className={`${styles.row} ${styles.cols3}`}>
                <div className={styles.field}>
                  <label className={styles.label}>Modalidad devolución</label>
                  <select
                    className={styles.select}
                    value={modalidad}
                    onChange={(e) => setModalidad(e.target.value as Modalidad)}
                  >
                    {MODALIDADES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Frecuencia cobro</label>
                  <select
                    className={styles.select}
                    value={frecuencia}
                    onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}
                  >
                    {FRECUENCIAS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha firma<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
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
                  label="Cuenta de cargo del capital"
                  value={cuentaCargo}
                  onChange={setCuentaCargo}
                  required
                />
                <CuentaSelect
                  label="Cuenta de cobro de los rendimientos"
                  value={cuentaCobro}
                  onChange={setCuentaCobro}
                />
              </div>
            </div>
          </ModalAtlasForm>
          <ModalAtlasPreview
            header="Cálculo financiero"
            headerIcon={<Icons.Banknote size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label="Cobros netos previstos"
              value={formatCurrency(calc.neto)}
              valueVariant="gold"
              sub={`bruto ${formatCurrency(calc.interesBruto)} · retención ${formatCurrency(calc.retencionImporte)}`}
              subAsText
            />
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow
                k={`Cuota ${frecuencia}`}
                v={formatCurrency(calc.cuotaPeriodica)}
              />
              <ModalAtlasPreviewRow k="Interés bruto" v={formatCurrency(calc.interesBruto)} />
              <ModalAtlasPreviewRow
                k="Retención IRPF"
                v={formatCurrency(calc.retencionImporte)}
                variant="neg"
              />
              <ModalAtlasPreviewRow k="Neto final" v={formatCurrency(calc.neto)} variant="pos" />
            </ModalAtlasPreviewBlock>
            <ModalAtlasPreviewBanner>
              Tributación · base ahorro como rendimiento del capital
              mobiliario. La retención (default 19%) la practica el pagador
              en cada cobro.
            </ModalAtlasPreviewBanner>
          </ModalAtlasPreview>
        </ModalAtlasBody>
        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              Los cobros mensuales se generan automáticamente tras crear.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Crear préstamo'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default AltaPrestamoModal;
