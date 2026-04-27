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
import styles from './LandingPage.module.css';

interface LanCard {
  key: 'proyeccion' | 'libertad' | 'objetivos' | 'fondos' | 'retos';
  title: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  value: React.ReactNode;
  valueTone?: 'ink' | 'pos' | 'gold';
  sub: React.ReactNode;
  footLab: React.ReactNode;
  footPill: React.ReactNode;
  footPillTone?: 'pos' | 'brand' | 'gold';
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { objetivos, fondos, retoActivo } = useOutletContext<MiPlanOutletContext>();

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
      value: '—',
      valueTone: 'gold',
      sub: 'punto de cruce · pendiente conectar con simulador escenarios',
      footLab: 'Próxima fecha',
      footPill: '2040 · simulación',
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
    {
      key: 'retos',
      title: 'Retos',
      icon: Icons.Retos,
      value: retoActivo ? (
        <span style={{ fontSize: 17, lineHeight: 1.2 }}>{retoActivo.titulo}</span>
      ) : (
        <span style={{ fontSize: 28, color: 'var(--atlas-v5-ink-4)' }}>—</span>
      ),
      valueTone: 'gold',
      sub: retoActivo
        ? `tipo · ${retoActivo.tipo} · estado · ${retoActivo.estado}`
        : 'sin reto activo este mes',
      footLab: 'Mes',
      footPill: retoActivo?.mes ?? '—',
      footPillTone: 'gold',
    },
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
    </>
  );
};

export default LandingPage;
