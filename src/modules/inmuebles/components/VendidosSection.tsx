import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoneyValue } from '../../../design-system/v5';
import styles from './VendidosSection.module.css';

export interface VendidoVM {
  id: number;
  alias: string;
  astId: string;
  tipoLabel: string;
  municipio: string;
  /** "vendido mar 2024" · ya formateado en es-ES. */
  saleDateLabel: string;
  /** Precio de venta · null si no hay dato. */
  venta: number | null;
  /** Plusvalía realizada · null si no hay dato. */
  plusvalia: number | null;
}

interface VendidosSectionProps {
  vendidos: VendidoVM[];
}

const BuildingGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 21h16M6 21V6l6-3 6 3v15M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h6" />
  </svg>
);

const VendidosSection: React.FC<VendidosSectionProps> = ({ vendidos }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // El outlet context solo trae activos · si no hay vendidos, la sección no existe.
  if (vendidos.length === 0) return null;

  const totalPlusvalia = vendidos.reduce((sum, v) => sum + (v.plusvalia ?? 0), 0);

  return (
    <div className={`${styles.soldSection} ${open ? styles.openState : ''}`}>
      <button
        type="button"
        className={styles.soldHd}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.soldIco}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 21h18M6 21V8l6-4 6 4v13M9 21v-5h6v5" />
            <path d="M4 9l16 8" strokeDasharray="2 2" />
          </svg>
        </span>
        <span className={styles.soldMeta}>
          <span className={styles.soldNm}>Vendidos</span>
          <span className={styles.soldSub}>
            {vendidos.length} {vendidos.length === 1 ? 'activo' : 'activos'} · fuera de tu patrimonio
            actual · solo histórico y fiscal
          </span>
        </span>
        <span className={styles.soldRt}>
          <span className={styles.soldTot}>
            <MoneyValue value={totalPlusvalia} decimals={0} showSign tone="gold" />
          </span>
          <span className={styles.soldRtL}>plusvalía realizada</span>
        </span>
        <span className={styles.soldChev}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className={styles.soldBody}>
          {vendidos.map((v) => (
            <div
              key={v.id}
              className={styles.soldRow}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              aria-label={`Abrir fiscalidad de ${v.alias}`}
              // Un vendido abre directamente en su pestaña de Fiscalidad (es lo
              // relevante de un activo ya fuera de patrimonio).
              onClick={() => navigate(`/inmuebles/${v.id}?tab=fiscalidad`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/inmuebles/${v.id}?tab=fiscalidad`);
                }
              }}
            >
              <span className={styles.sTile}>
                <BuildingGlyph />
              </span>
              <span className={styles.sInfo}>
                <span className={styles.sNm}>
                  {v.alias}
                  <span className={styles.sAst}>{v.astId}</span>
                </span>
                <span className={styles.sLoc}>
                  {v.municipio} · {v.tipoLabel} · {v.saleDateLabel}
                </span>
              </span>
              <span className={styles.sCell}>
                <span className={styles.sL}>Venta</span>
                <span className={styles.sV}>
                  {v.venta !== null ? <MoneyValue value={v.venta} decimals={0} tone="ink" /> : '—'}
                </span>
              </span>
              <span className={styles.sCell}>
                <span className={styles.sL}>Plusvalía</span>
                <span className={styles.sV}>
                  {v.plusvalia !== null ? (
                    <MoneyValue value={v.plusvalia} decimals={0} showSign tone="gold" />
                  ) : (
                    '—'
                  )}
                </span>
              </span>
            </div>
          ))}
          <div className={styles.soldNote}>
            Un inmueble vendido no cuenta en tu valor total ni en tu patrimonio neto. Se conserva su
            plusvalía realizada y su historial para la declaración y tu track record.
          </div>
        </div>
      )}
    </div>
  );
};

export default VendidosSection;
export { VendidosSection };
