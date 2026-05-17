// AltaCryptoModal · alta crypto u otro · PR 3 T-INVERSIONES-V5
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §G.
// Preview · obligaciones fiscales · Modelo 721 umbral 50.000 € (informativo).

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

type Subtipo = Extract<TipoPosicion, 'crypto' | 'otro'>;

const SUBTIPOS: { value: Subtipo; label: string; sub: string }[] = [
  { value: 'crypto', label: 'Crypto', sub: 'BTC · ETH · stablecoins · etc.' },
  { value: 'otro', label: 'Otro', sub: 'oro físico · arte · colección…' },
];

const UMBRAL_721 = 50_000;

export interface AltaCryptoModalProps {
  onSave: (data: Partial<PosicionInversion> & { importe_inicial?: number }) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const AltaCryptoModal: React.FC<AltaCryptoModalProps> = ({ onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<Subtipo>('crypto');
  const [nombre, setNombre] = useState('');
  const [entidad, setEntidad] = useState('');
  const [unidades, setUnidades] = useState('');
  const [precioMedio, setPrecioMedio] = useState('');
  const [precioActual, setPrecioActual] = useState('');
  const [fecha, setFecha] = useState(today());
  const [cuentaCargo, setCuentaCargo] = useState('');

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

  const requiere721 = tipo === 'crypto' && valorCalc > UMBRAL_721;

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
        fecha_compra: `${fecha}T12:00:00.000Z`,
        fecha_valoracion: `${fecha}T12:00:00.000Z`,
        valor_actual: valorCalc,
        importe_inicial: aportadoCalc,
        total_aportado: aportadoCalc,
        rentabilidad_euros: valorCalc - aportadoCalc,
        rentabilidad_porcentaje:
          aportadoCalc > 0 ? ((valorCalc - aportadoCalc) / aportadoCalc) * 100 : 0,
        numero_participaciones: unidadesNum,
        precio_medio_compra: precioNum,
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
    <ModalAtlas onClose={onClose} ariaLabel="Alta crypto u otro activo">
      <ModalAtlasHeader
        icon={<Icons.Bitcoin size={18} strokeWidth={1.7} />}
        title="Nueva posición · crypto u otros"
        subtitle="exchanges · carteras frías · oro físico · arte"
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Tipo de activo</div>
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
                    placeholder={tipo === 'crypto' ? 'Ej. Bitcoin' : 'Ej. Lingote oro 1oz'}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {tipo === 'crypto' ? 'Exchange / wallet' : 'Custodio / ubicación'}
                    <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    placeholder={tipo === 'crypto' ? 'Ej. Kraken, cold wallet…' : 'Ej. caja fuerte casa'}
                    required
                  />
                </div>
              </div>
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Posición</div>
              <div className={`${styles.row} ${styles.cols3}`}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {tipo === 'crypto' ? 'Unidades' : 'Cantidad'}
                    <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    min="0"
                    className={`${styles.input} ${styles.mono}`}
                    value={unidades}
                    onChange={(e) => setUnidades(e.target.value)}
                    placeholder="0.5"
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
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Fecha adquisición<span className={styles.req}>*</span>
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
            header="Obligaciones fiscales"
            headerIcon={<Icons.Info size={12} strokeWidth={2} />}
          >
            <ModalAtlasPreviewCardDark
              label="Valor declarable"
              value={formatCurrency(valorCalc)}
              valueVariant={requiere721 ? 'neg' : 'gold'}
              sub={
                requiere721
                  ? `supera el umbral Modelo 721 (${formatCurrency(UMBRAL_721)})`
                  : `bajo umbral Modelo 721 (${formatCurrency(UMBRAL_721)})`
              }
              subAsText
            />
            <ModalAtlasPreviewBlock>
              <ModalAtlasPreviewRow
                k="Tributación al vender"
                v="base ahorro"
                variant="txt"
              />
              <ModalAtlasPreviewRow
                k="Tramos"
                v="19% → 28%"
                variant="txt"
              />
              <ModalAtlasPreviewRow
                k="Devengo"
                v="al transmitir"
                variant="txt"
              />
            </ModalAtlasPreviewBlock>
            {tipo === 'crypto' && (
              <ModalAtlasPreviewBanner variant={requiere721 ? 'warn' : undefined}>
                <strong>Modelo 721</strong> · si tus criptos en exchanges
                extranjeros superan 50.000 € a 31-dic, declaración
                informativa obligatoria entre enero y marzo del año
                siguiente.
              </ModalAtlasPreviewBanner>
            )}
            {tipo === 'otro' && (
              <ModalAtlasPreviewBanner>
                Activos no financieros · ganancia/pérdida patrimonial al
                vender. Sin retención automática · declarar al ejercicio.
              </ModalAtlasPreviewBanner>
            )}
          </ModalAtlasPreview>
        </ModalAtlasBody>
        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              Modelo 721 cálculo real · diferido (preview informativo).
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

export default AltaCryptoModal;
