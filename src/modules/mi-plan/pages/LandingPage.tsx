import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  HeroBanner,
  MoneyValue,
  Icons,
} from '../../../design-system/v5';
import type { MiPlanOutletContext } from '../MiPlanContext';
import {
  computeBudgetProjection12mAsync,
  type BudgetProjection,
} from '../services/budgetProjection';
import { SHOW_RETOS } from '../featureFlags';
import { useProyeccionLibertad } from '../../../hooks/useProyeccionLibertad';
import styles from './LandingPage.module.css';

interface LanCard {
  key: 'proyeccion' | 'libertad' | 'objetivos' | 'fondos';
  title: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  value: React.ReactNode;
  valueTone?: 'ink' | 'pos' | 'gold';
  sub: React.ReactNode;
  footLab: React.ReactNode;
  footPill: React.ReactNode;
  footPillTone?: 'pos' | 'brand' | 'gold';
}

const formatMesReto = (mes: string): string => {
  const [y, m] = mes.split('-').map(Number);
  if (!y || !m) return mes;
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  );
};

/** Formatea un isoYM ('2031-09') como "septiembre 2031" */
const formatMesAnio = (isoYM: string): string => {
  const [y, m] = isoYM.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  // T27.2-skip · `retoActivo` se consume solo si `SHOW_RETOS` está activo
  // (ver `../featureFlags`). El context lo sigue exponiendo · ver
  // MiPlanContext.
  const ctx = useOutletContext<MiPlanOutletContext>();
  const { objetivos, fondos } = ctx;
  const retoActivo = SHOW_RETOS ? ctx.retoActivo : null;

  // T27.4.2 · proyección libertad financiera
  const { data: libertad, loading: libertadLoading, error: libertadError } = useProyeccionLibertad();

  // Proyección · usa el helper compartido (cierra TODO-T20-01).
  const [projection, setProjection] = useState<BudgetProjection | null>(null);
  useEffect(() => {
    let cancelled = false;
    computeBudgetProjection12mAsync(new Date().getFullYear()).then((p) => {
      if (!cancelled) setProjection(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const balanceAnual = projection
    ? projection.entradasAnuales + projection.salidasAnuales
    : 0;
  const todayMonthIdx = new Date().getMonth();
  const flujoMesActual = projection?.months[todayMonthIdx]?.flujoNeto ?? 0;
  const mesesPositivos = projection
    ? projection.months.filter((m) => m.flujoNeto > 0).length
    : 0;
  const mesesNegativos = projection
    ? projection.months.filter((m) => m.flujoNeto < 0).length
    : 0;

  const objetivosEnProgreso = objetivos.filter((o) => o.estado === 'en-progreso').length;
  const objetivosEnRiesgo = objetivos.filter((o) => o.estado === 'en-riesgo').length;
  const objetivoMasProximo = objetivos
    .filter((o) => o.estado === 'en-progreso' || o.estado === 'en-riesgo')
    .sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre))[0];

  const totalFondos = fondos.length;
  const fondosColchon = fondos.filter((f) => f.tipo === 'colchon').length;

  const cards: LanCard[] = [
    {
      key: 'proyeccion',
      title: 'Proyección',
      icon: Icons.Proyeccion,
      value: <MoneyValue value={balanceAnual} decimals={0} showSign tone="auto" />,
      valueTone: balanceAnual >= 0 ? 'pos' : 'ink',
      sub: (
        <>
          resultado caja proyectado · {mesesPositivos} meses positivos ·{' '}
          {mesesNegativos} {mesesNegativos === 1 ? 'mes en pérdida' : 'meses en pérdida'}
        </>
      ),
      footLab: 'Mes actual',
      footPill: (
        <>
          <MoneyValue value={flujoMesActual} decimals={0} showSign tone="auto" /> · {projection?.months[todayMonthIdx]?.label ?? '—'}
        </>
      ),
      footPillTone: flujoMesActual >= 0 ? 'pos' : 'brand',
    },
    {
      key: 'libertad',
      title: 'Libertad financiera',
      icon: Icons.Libertad,
      value: libertadLoading ? (
        <span style={{ fontSize: 22, color: 'var(--atlas-v5-ink-4)' }}>…</span>
      ) : libertadError ? (
        <span style={{ fontSize: 22, color: 'var(--atlas-v5-ink-4)' }}>—</span>
      ) : libertad?.cruceLibertad ? (
        <span style={{ fontSize: 16, lineHeight: 1.2 }}>
          {formatMesAnio(libertad.cruceLibertad.isoYM)}
        </span>
      ) : (
        <span style={{ fontSize: 22, color: 'var(--atlas-v5-ink-4)' }}>no se cruza</span>
      ),
      valueTone: 'gold',
      sub: libertadLoading
        ? 'calculando…'
        : libertadError
          ? 'no podemos calcular tu libertad financiera ahora'
          : libertad
            ? `cubres el ${Math.round(libertad.pctCoberturaActual)}% de tus gastos con renta pasiva`
            : 'configura tus gastos de vida en Ajustes',
      footLab: 'Tiempo estimado',
      footPill: libertadLoading
        ? '…'
        : libertad?.faltanTexto ?? 'no se cruza',
      footPillTone: 'gold',
    },
    {
      key: 'objetivos',
      title: 'Objetivos',
      icon: Icons.Objetivos,
      value: <span style={{ fontSize: 28 }}>{objetivosEnProgreso}</span>,
      valueTone: 'ink',
      sub: (
        <>
          {objetivosEnProgreso} en progreso ·{' '}
          {objetivosEnRiesgo > 0 ? `${objetivosEnRiesgo} en riesgo · ` : ''}
          {objetivos.length} totales
        </>
      ),
      footLab: 'Próximo cierre',
      footPill: objetivoMasProximo
        ? new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(
            new Date(objetivoMasProximo.fechaCierre),
          )
        : '—',
      footPillTone: 'gold',
    },
    {
      key: 'fondos',
      title: 'Fondos de ahorro',
      icon: Icons.Fondos,
      value: <span style={{ fontSize: 28 }}>{totalFondos}</span>,
      valueTone: 'ink',
      sub: (
        <>
          {totalFondos} fondos activos · {fondosColchon} colchón emergencia
        </>
      ),
      footLab: 'Cuentas vinculadas',
      footPill: `${fondos.reduce((sum, f) => sum + f.cuentasAsignadas.length, 0)}`,
      footPillTone: 'brand',
    },
    // T-MIPLAN · grid landing v2 · 4 submods (sin retos · sin presupuesto).
    // El reto activo se destaca debajo del grid como reto-card propia
    // (mockup atlas-mi-plan-v2). Card "Mi presupuesto" diferida a T19.
  ];

  return (
    <>
      <div className={styles.heroNarrative}>
        <HeroBanner
          variant="compact"
          tag={`Estimada · al cierre de ${projection?.months[todayMonthIdx]?.label ?? ''}`}
          title={
            balanceAnual >= 0 ? (
              <>
                Tu hogar genera <strong>{Math.round(balanceAnual / 1000)}k €</strong> de
                ahorro proyectado este año
              </>
            ) : (
              <>
                Tu hogar prevé un déficit de{' '}
                <strong>{Math.round(Math.abs(balanceAnual) / 1000)}k €</strong> este año
              </>
            )
          }
          sub={
            <>
              {projection && projection.entradasAnuales > 0 ? (
                <>
                  ingresos {Math.round(projection.entradasAnuales / 1000)}k € ·{' '}
                  gastos {Math.round(Math.abs(projection.salidasAnuales) / 1000)}k €
                </>
              ) : (
                'añade nóminas o autónomos para activar la proyección'
              )}
            </>
          }
          stats={[
            { label: 'Meses positivos', value: `${mesesPositivos} / 12` },
            { label: 'Meses en pérdida', value: `${mesesNegativos}` },
            { label: 'Objetivos activos', value: `${objetivosEnProgreso}` },
            { label: 'Fondos activos', value: `${totalFondos}` },
          ]}
          ctaLabel={<>Abrir Proyección <Icons.ArrowRight size={14} strokeWidth={2} /></>}
          onCta={() => navigate('/mi-plan/proyeccion')}
        />
      </div>

      <h2 className={styles.sectionTitle}>Áreas de tu plan</h2>
      <div className={styles.cardsGrid}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              className={`${styles.lanCard} ${styles[c.key]}`}
              onClick={() => navigate(`/mi-plan/${c.key}`)}
              aria-label={c.title}
            >
              <div className={styles.lanHd}>
                <span className={styles.lanIcon}>
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className={styles.lanArrow}>
                  <Icons.ChevronRight size={11} strokeWidth={2.5} />
                </span>
              </div>
              <div className={styles.lanTit}>{c.title}</div>
              <div className={`${styles.lanVal} ${c.valueTone === 'pos' ? styles.pos : c.valueTone === 'gold' ? styles.gold : ''}`}>
                {c.value}
              </div>
              <div className={styles.lanSub}>{c.sub}</div>
              <div className={styles.lanFoot}>
                <span className={styles.lanFootLab}>{c.footLab}</span>
                <span
                  className={`${styles.lanFootPill} ${c.footPillTone === 'pos' ? styles.pos : c.footPillTone === 'brand' ? styles.brand : ''}`}
                >
                  {c.footPill}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {SHOW_RETOS && retoActivo ? (
        <section className={styles.retoCard} aria-label="Reto destacado del mes">
          <div className={styles.retoHead}>
            <div className={styles.retoIcon} aria-hidden="true">
              <Icons.Retos size={24} strokeWidth={1.8} />
            </div>
            <div className={styles.retoBody}>
              <div className={styles.retoLab}>Reto de {formatMesReto(retoActivo.mes)}</div>
              <div className={styles.retoTitulo}>{retoActivo.titulo}</div>
              {retoActivo.descripcion ? (
                <div className={styles.retoDesc}>{retoActivo.descripcion}</div>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.retoAction}
              onClick={() => navigate('/mi-plan/retos')}
            >
              Ver detalle <Icons.ArrowRight size={12} strokeWidth={2} />
            </button>
          </div>
          <div className={styles.retoMeta}>
            <span className={styles.retoMetaItem}>
              <span className={styles.retoMetaLab}>Tipo</span>
              <span className={styles.retoMetaVal}>{retoActivo.tipo}</span>
            </span>
            <span className={styles.retoMetaItem}>
              <span className={styles.retoMetaLab}>Estado</span>
              <span className={styles.retoMetaVal}>{retoActivo.estado}</span>
            </span>
            {retoActivo.metaCantidad != null ? (
              <span className={styles.retoMetaItem}>
                <span className={styles.retoMetaLab}>Meta</span>
                <span className={styles.retoMetaVal}>
                  <MoneyValue value={retoActivo.metaCantidad} decimals={0} tone="ink" />
                </span>
              </span>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
};

export default LandingPage;
