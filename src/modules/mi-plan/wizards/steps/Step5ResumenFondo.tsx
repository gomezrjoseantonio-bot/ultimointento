import React from 'react';
import styles from '../WizardNuevoFondo.module.css';
import type { FondoDraft, CategoriaFondo } from '../typesFondo';
import { calcularMetaColchon, parseImporte, labelCategoria, buildFechaIso } from '../typesFondo';
import type { Account } from '../../../../services/db';
import type { Objetivo } from '../../../../types/miPlan';
import type { RitmoResult } from '../utils/calcularRitmo';

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

const fmtFecha = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d
    .toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    .replace('.', '');
};

const inicialesBanco = (account: Account): string => {
  const name = account.banco?.name ?? account.bank ?? account.alias ?? '';
  const clean = name.trim();
  if (!clean) return '??';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// Reutiliza la misma resolución que Step3Cuentas · solo tokens v5, no hex.
const BANK_TOKEN_BY_IBAN_CODE: Record<string, string> = {
  '0049': 'var(--atlas-v5-brand-santander)',
  '0081': 'var(--atlas-v5-brand-sabadell)',
  '2103': 'var(--atlas-v5-brand-unicaja)',
  '0182': 'var(--atlas-v5-brand-bbva)',
  '1465': 'var(--atlas-v5-brand-ing)',
  '2100': 'var(--atlas-v5-brand-caixabank)',
};
const colorBancoStyle = (account: Account): React.CSSProperties => {
  const c = account.banco?.brand?.color;
  if (c && c.startsWith('var(')) return { background: c };
  const code = account.banco?.code;
  if (code && BANK_TOKEN_BY_IBAN_CODE[code]) {
    return { background: BANK_TOKEN_BY_IBAN_CODE[code] };
  }
  return { background: 'var(--atlas-v5-ink-3)' };
};

const ibanShort = (account: Account): string => {
  const iban = account.iban ?? '';
  if (iban.length < 4) return iban;
  return `···· ${iban.slice(-4)}`;
};

const previewCardClassByCategoria: Record<CategoriaFondo, string> = {
  colchon: '',
  compra: styles.previewCardFondoPiso,
  reforma: styles.previewCardFondoReforma,
  impuestos: styles.previewCardFondoImpuestos,
};

const previewCatClassByCategoria: Record<CategoriaFondo, string> = {
  colchon: '',
  compra: styles.previewCatPiso,
  reforma: styles.previewCatReforma,
  impuestos: styles.previewCatImpuestos,
};

interface Props {
  draft: FondoDraft;
  cuentas: Account[];
  objetivos: Objetivo[];
  acumuladoEstimado: number;
  ritmo: RitmoResult;
}

const Step5ResumenFondo: React.FC<Props> = ({
  draft,
  cuentas,
  objetivos,
  acumuladoEstimado,
  ritmo,
}) => {
  const cat = draft.categoria;
  if (!cat) return null;

  const meta =
    cat === 'colchon' ? calcularMetaColchon(draft) : parseImporte(draft.metaImporte);
  const fechaIso = buildFechaIso(draft.fechaObjetivoMes, draft.fechaObjetivoAnio);
  const progresoPct = meta > 0 ? Math.min(100, (acumuladoEstimado / meta) * 100) : 0;

  const objetivoVinculado = draft.objetivoVinculadoId
    ? objetivos.find((o) => o.id === draft.objetivoVinculadoId)
    : undefined;

  const cardClass = `${styles.previewCardFondo} ${previewCardClassByCategoria[cat]}`;
  const catClass = `${styles.previewCat} ${previewCatClassByCategoria[cat]}`;

  // Sub texto bajo "Meta" según categoría
  const metaSubText = (() => {
    if (cat === 'colchon') {
      return `${draft.colchonMeses} meses · ${fmtFecha(fechaIso)}`;
    }
    return fmtFecha(fechaIso);
  })();

  // Sub texto bajo "Acumulado"
  const acumuladoSubText = (() => {
    if (cat === 'colchon' && parseImporte(draft.colchonGastoMensual) > 0) {
      const meses = Math.floor(
        acumuladoEstimado / parseImporte(draft.colchonGastoMensual),
      );
      return `cubre ${meses} meses de gastos`;
    }
    const cuentasIds = new Set(draft.cuentasAsignadas.map((c) => c.cuentaId));
    return `${cuentasIds.size} cuenta${cuentasIds.size === 1 ? '' : 's'} alimentando`;
  })();

  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>05</span> Confirma y crea
      </div>
      <div className={styles.stepSubText}>
        Así se va a ver tu fondo en el listado de Mi Plan · Fondos de ahorro. Si todo encaja
        pulsa <strong>Crear fondo</strong>.
      </div>

      <div className={cardClass}>
        <div className={catClass}>
          <span className={styles.previewCatDot} aria-hidden />
          {labelCategoria(cat)}
        </div>
        <div className={styles.previewNomFondo}>{draft.nombre || 'Sin nombre'}</div>
        <div className={styles.previewObjFondo}>
          objetivo {cat === 'colchon' ? 'meses' : cat === 'reforma' ? 'obra' : cat === 'impuestos' ? 'fiscal' : 'cartera'} ·{' '}
          <strong>{fmtEur(meta)}</strong>
        </div>

        <div className={styles.previewNumbersFondo} style={{ marginTop: 14 }}>
          <div>
            <div className={styles.previewNumLabFondo}>Acumulado</div>
            <div className={styles.previewNumValFondo}>{fmtEur(acumuladoEstimado)}</div>
            <div className={styles.previewNumSubFondo}>{acumuladoSubText}</div>
          </div>
          <div>
            <div className={styles.previewNumLabFondo}>Meta</div>
            <div className={`${styles.previewNumValFondo} ${styles.previewNumValFondoMeta}`}>
              {fmtEur(meta)}
            </div>
            <div className={styles.previewNumSubFondo}>{metaSubText}</div>
          </div>
        </div>

        <div className={styles.previewProgFondo}>
          <div className={styles.previewProgFondoTop}>
            <span>Progreso</span>
            <span className={styles.previewProgFondoPct}>{Math.round(progresoPct)}%</span>
          </div>
          <div className={styles.previewProgFondoBar}>
            <div
              className={styles.previewProgFondoFill}
              style={{ width: `${progresoPct}%` }}
            />
          </div>
        </div>

        {draft.cuentasAsignadas.length > 0 && (
          <div className={styles.previewOrigen}>
            <div className={styles.previewOrigenLab}>Cuentas que alimentan este fondo</div>
            <div className={styles.previewOrigenList}>
              {draft.cuentasAsignadas.map((a) => {
                const c = cuentas.find((x) => x.id === a.cuentaId);
                if (!c) return null;
                return (
                  <div key={a.cuentaId} className={styles.previewOrigenItem}>
                    <div className={styles.previewOrigenBanco}>
                      <div
                        className={styles.previewOrigenLogo}
                        style={colorBancoStyle(c)}
                        aria-hidden
                      >
                        {inicialesBanco(c)}
                      </div>
                      {c.banco?.name ?? c.bank ?? 'Cuenta'} ·{' '}
                      {c.alias ?? c.name ?? `cuenta ${c.id}`} {ibanShort(c)}
                    </div>
                    <span className={styles.previewOrigenVal}>
                      {fmtEur(a.importeAsignado)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={styles.resumenExtra}>
        <div className={styles.resumenExtraTit}>Detalles del fondo</div>
        <div className={styles.resumenExtraList}>
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>Categoría</span>
            <span className={styles.resumenExtraRowVal}>{labelCategoria(cat)}</span>
          </div>
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>Cuentas vinculadas</span>
            <span className={styles.resumenExtraRowVal}>
              {draft.cuentasAsignadas.length} ·{' '}
              {draft.cuentasAsignadas
                .map((a) => {
                  const c = cuentas.find((x) => x.id === a.cuentaId);
                  return c?.banco?.name ?? c?.alias ?? '';
                })
                .filter(Boolean)
                .join(' · ') || '—'}
            </span>
          </div>
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>Fecha objetivo</span>
            <span className={styles.resumenExtraRowVal}>{fmtFecha(fechaIso)}</span>
          </div>
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>Prioridad</span>
            <span className={styles.resumenExtraRowVal}>
              {draft.prioridad === 'alta' ? 'Alta' : 'Normal'}
            </span>
          </div>
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>Ritmo necesario</span>
            <span className={styles.resumenExtraRowVal}>
              {ritmo.ritmoNecesarioMensual > 0
                ? `+${fmtEur(ritmo.ritmoNecesarioMensual)}/mes`
                : '—'}
            </span>
          </div>
          <div className={styles.resumenExtraRow}>
            <span className={styles.resumenExtraRowLab}>Objetivo vinculado</span>
            {objetivoVinculado ? (
              <span className={styles.resumenExtraRowVal}>{objetivoVinculado.nombre}</span>
            ) : (
              <span
                className={`${styles.resumenExtraRowVal} ${styles.resumenExtraRowValEmpty}`}
              >
                no · puedes asociarlo después
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step5ResumenFondo;
