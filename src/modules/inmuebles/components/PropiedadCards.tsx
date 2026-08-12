import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import type { TipoActivo } from '../../../types/tipoActivo';
import { intlOpts } from '../../../utils/intlNumber';
import styles from './PropiedadCards.module.css';

/**
 * View-model de un inmueble para las galerías de la cartera (foto e icono).
 * Se construye en ListadoPage a partir de datos reales; los componentes son
 * puros/presentacionales para poder testarlos sin servicios.
 */
export interface PropiedadVM {
  id: number;
  astId: string;
  alias: string;
  /** "Municipio · Provincia" (o lo que exista). */
  location: string;
  /** Municipio a secas, para la fila compacta de la vista icono. */
  municipio: string;
  tipoActivo: TipoActivo;
  tipoLabel: string;
  squareMeters?: number;
  bedrooms?: number;
  bathrooms?: number;
  foto?: string;
  tieneParking: boolean;
  tieneTrastero: boolean;
  /** Letra del certificado energético · undefined o 'NO' = no se muestra. */
  certificado?: string;
  /** Valor de mercado más reciente · null si no hay valoración. */
  valorHoy: number | null;
  /** Coste total de adquisición. */
  costeTotal: number;
  /** Precio de adquisición (sin gastos). */
  adquisicion: number;
  /** Mejoras acumuladas (CAPEX). */
  mejoras: number;
  /** Revalorización · % · null si no hay valor o base. */
  revalPct: number | null;
  /** Renta mensual (contratos activos). */
  rentaMensual: number;
  /** true si hay explotación (contratos activos). */
  enAlquiler: boolean;
  /** Rentabilidad neta · % · null si no calculable. */
  rentabNetaPct: number | null;
}

const eur0 = (value: number, sign = false): string =>
  new Intl.NumberFormat(
    'es-ES',
    intlOpts({
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      signDisplay: sign ? 'exceptZero' : 'auto',
      useGrouping: 'always',
    }),
  ).format(value);

const pctText = (value: number | null, sign = false, decimals = 0): string => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(value)} %`;
};

// ── Iconos inline (portados del mockup) ──────────────────────────────────────
const PinIcon: React.FC = () => (
  <svg className={styles.i} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

const BuildingGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 21h16M6 21V6l6-3 6 3v15M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h6" />
  </svg>
);

const ParkingGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
  </svg>
);

const BoxGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4M12 11v10" />
  </svg>
);

const BoltGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
  </svg>
);

const tipoGlyph = (tipo: TipoActivo): React.ReactNode => {
  if (tipo === 'parking') return <ParkingGlyph />;
  if (tipo === 'trastero') return <BoxGlyph />;
  return <BuildingGlyph />;
};

/** Placeholder (foto ausente) · caja/garaje según tipo, si-no un edificio. */
const PlaceholderGlyph: React.FC<{ tipo: TipoActivo }> = ({ tipo }) => (
  <div className={styles.placeholder}>
    {tipo === 'parking' ? (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 13l1.6-4.8A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.2L19 13M4 13h16v5H4zM7 18v2M17 18v2" />
        <circle cx="8" cy="15.5" r="1" />
        <circle cx="16" cy="15.5" r="1" />
      </svg>
    ) : (
      tipoGlyph(tipo)
    )}
  </div>
);

/** Skyline decorativo sobre la foto navy (pisos sin foto real). */
const SkylineArt: React.FC = () => (
  <svg className={styles.art} viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M40 150V70l40-22 40 22v80M60 96h.01M100 96h.01M60 120h.01M100 120h.01" />
    <path d="M150 150V54l55-30 55 30v96M180 78h50M180 104h50M180 130h50" />
    <path d="M300 150V86l38-20 38 20v64" />
  </svg>
);

const metaChips = (p: PropiedadVM): React.ReactNode => (
  <>
    <span className={`${styles.chip} ${styles.chipType}`}>{p.tipoLabel}</span>
    {p.squareMeters ? <span className={styles.chip}>{p.squareMeters} m²</span> : null}
    {p.tipoActivo === 'piso' && p.bedrooms ? (
      <span className={styles.chip}>{p.bedrooms} hab</span>
    ) : null}
    {p.bathrooms ? (
      <span className={styles.chip}>
        {p.bathrooms} {p.bathrooms === 1 ? 'baño' : 'baños'}
      </span>
    ) : null}
    {p.tieneParking ? (
      <span className={styles.amen}>
        <ParkingGlyph />
        Parking
      </span>
    ) : null}
    {p.tieneTrastero ? (
      <span className={styles.amen}>
        <BoxGlyph />
        Trastero
      </span>
    ) : null}
    {p.certificado && p.certificado !== 'NO' ? (
      <span className={styles.ecert}>
        <BoltGlyph />
        {p.certificado}
      </span>
    ) : null}
  </>
);

// ── Card FOTO ────────────────────────────────────────────────────────────────
interface CardProps {
  p: PropiedadVM;
  onOpen: (id: number) => void;
}

export const PropiedadFotoCard: React.FC<CardProps> = ({ p, onOpen }) => {
  const progPct =
    p.valorHoy && p.valorHoy > 0
      ? Math.max(0, Math.min(100, (p.costeTotal / p.valorHoy) * 100))
      : null;

  return (
    <article
      className={styles.pcard}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(p.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(p.id);
        }
      }}
    >
      <div className={styles.photo}>
        {p.foto ? (
          <img className={styles.fotoImg} src={p.foto} alt="" />
        ) : p.tipoActivo === 'piso' || p.tipoActivo === 'local' ? (
          <SkylineArt />
        ) : (
          <PlaceholderGlyph tipo={p.tipoActivo} />
        )}
        <span className={`${styles.tag} ${p.enAlquiler ? '' : styles.own}`}>
          <span className={styles.tagDot} />
          {p.enAlquiler ? `En alquiler · ${eur0(p.rentaMensual)}/m` : 'Uso propio'}
        </span>
        <span className={styles.ast}>{p.astId}</span>
        <div className={styles.val}>
          <div className={styles.valLab}>Valor hoy</div>
          <div className={styles.valNum}>{p.valorHoy !== null ? eur0(p.valorHoy) : '—'}</div>
        </div>
        <div className={styles.revpill}>
          <span className={styles.revpillP}>{pctText(p.revalPct, true)}</span>
          <span className={styles.revpillC}>revaloriz.</span>
        </div>
      </div>

      <div className={styles.pbody}>
        <div>
          <div className={styles.pname}>{p.alias}</div>
          <div className={styles.ploc}>
            <PinIcon />
            {p.location}
          </div>
        </div>
        <div className={styles.chips}>{metaChips(p)}</div>
        <div className={styles.kpiRow}>
          <div className={styles.kpi}>
            <div className={styles.kpiL}>Adquisición</div>
            <div className={styles.kpiV}>
              <MoneyValue value={p.adquisicion} decimals={0} tone="ink" />
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiL}>Coste total</div>
            <div className={styles.kpiV}>
              <MoneyValue value={p.costeTotal} decimals={0} tone="ink" />
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiL}>Mejoras</div>
            <div className={styles.kpiV}>
              <MoneyValue value={p.mejoras} decimals={0} showSign tone="ink" />
            </div>
          </div>
        </div>
        {progPct !== null && (
          <div>
            <div className={styles.prog}>
              <i style={{ width: `${progPct}%` }} />
            </div>
            <div className={styles.progLab}>
              <span>
                coste <MoneyValue value={p.costeTotal} decimals={0} tone="muted" />
              </span>
              <span>
                hoy ·{' '}
                <b>
                  <MoneyValue value={p.valorHoy ?? 0} decimals={0} tone="ink" />
                </b>
              </span>
            </div>
          </div>
        )}
        <div className={`${styles.rentline} ${p.enAlquiler ? '' : styles.own}`}>
          <span className={styles.rentDot} />
          {p.enAlquiler ? (
            <>
              <span className={styles.rentK}>Explotación</span>·{' '}
              <span className={styles.rentM}>
                <MoneyValue value={p.rentaMensual} decimals={0} tone="ink" />
                /mes
              </span>{' '}
              · rentab. neta {pctText(p.rentabNetaPct, false, 1)}
            </>
          ) : (
            <>
              <span className={styles.rentK}>Sin explotación</span>·{' '}
              <span className={styles.rentM}>uso propio</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
};

// ── Fila ICONO (tabla) ───────────────────────────────────────────────────────
export const PropiedadIconoRow: React.FC<CardProps> = ({ p, onOpen }) => {
  const metaBits: string[] = [p.tipoLabel];
  if (p.squareMeters) metaBits.push(`${p.squareMeters} m²`);
  if (p.tipoActivo === 'piso' && p.bedrooms) metaBits.push(`${p.bedrooms} hab`);
  if (p.bathrooms) metaBits.push(`${p.bathrooms} ${p.bathrooms === 1 ? 'baño' : 'baños'}`);

  return (
    <article
      className={styles.icard}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(p.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(p.id);
        }
      }}
    >
      <div className={styles.iconTile}>{tipoGlyph(p.tipoActivo)}</div>
      <div>
        <div className={styles.iname}>
          {p.alias}
          <span className={styles.astn}>{p.astId}</span>
        </div>
        <div className={styles.iloc}>
          <PinIcon />
          {p.municipio}
          <span className={styles.idot} />
          {metaBits.join(' · ')}
          {p.tieneParking ? (
            <span className={styles.iam} title="Parking">
              <ParkingGlyph />
            </span>
          ) : null}
          {p.tieneTrastero ? (
            <span className={styles.iam} title="Trastero">
              <BoxGlyph />
            </span>
          ) : null}
          {p.certificado && p.certificado !== 'NO' ? (
            <span className={styles.iecert}>{p.certificado}</span>
          ) : null}
          <span className={styles.idot} />
          <span className={`${styles.itg} ${p.enAlquiler ? '' : styles.own}`}>
            <span className={styles.tagDot} />
            {p.enAlquiler ? `En alquiler ${eur0(p.rentaMensual)}/m` : 'Uso propio'}
          </span>
        </div>
      </div>
      <div className={`${styles.icell} ${styles.hideS}`}>
        <MoneyValue value={p.costeTotal} decimals={0} tone="ink" />
      </div>
      <div className={`${styles.icell} ${styles.hideS}`}>
        <MoneyValue value={p.mejoras} decimals={0} showSign tone="ink" />
      </div>
      <div className={`${styles.icell} ${styles.icellVal}`}>
        {p.valorHoy !== null ? <MoneyValue value={p.valorHoy} decimals={0} tone="ink" /> : '—'}
      </div>
      <div className={styles.irev}>
        <span className={styles.revpillP}>{pctText(p.revalPct, true)}</span>
      </div>
    </article>
  );
};
