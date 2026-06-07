/**
 * Pantalla 10 · Reveal · tu año previsto (FUTURO · previsión operativa).
 * Dispara el bootstrap (idempotente · forward-only) y compone la banda navy,
 * el SVG de caja mes a mes y la caja de honestidad. IRPF desde la estimación
 * en curso · si falta nómina muestra "—" (nunca inventa cifra).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../design-system/v5';
import OnboardingTopbar from './OnboardingTopbar';
import { useOnboarding } from './OnboardingContext';
import { BLOQUES_META } from './bloquesConfig';
import { setRevealVisto } from '../../../services/onboardingProgressService';
import { cargarRevealData, puntosSVG, ejeMax, type RevealData } from '../../../services/onboardingRevealService';
import styles from './empezar.module.css';

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const eur0 = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`;

const RevealScreen: React.FC = () => {
  const navigate = useNavigate();
  const { progress, refresh } = useOnboarding();
  const [data, setData] = useState<RevealData | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const d = await cargarRevealData();
      if (!alive) return;
      setData(d);
      await setRevealVisto(true);
      void refresh();
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const maxMensual = useMemo(() => (data ? ejeMax(data.mensualIngreso, data.mensualGasto) : 1), [data]);

  const pendientes = progress.pendientes.map((id) => BLOQUES_META[id]);

  return (
    <>
      <OnboardingTopbar exit="volver" />
      <div className={styles.main}>
        <div className={styles.kick}>Tu foto está viva</div>
        <h1 className={styles.h1}>Este es tu año por adelantado</h1>
        <p className={styles.sub}>
          Generado con tu foto actual. Cada mes que vivas · lo previsto se convertirá en real y todo esto se irá
          afinando solo.
        </p>

        <div className={styles.revealHero}>
          <div className={styles.revealHeroKick}>Previsión {new Date().getFullYear()} · con lo que Atlas sabe hoy</div>
          <h2 className={styles.revealHeroTitle}>
            {data ? `${eur0(data.rentasAnio / 12)} de rentas al mes` : 'Calculando tu previsión…'}
          </h2>
          <div className={styles.revealStats}>
            <div className={styles.rstat}>
              <div className={styles.rstatLabel}>Rentas previstas</div>
              <div className={styles.rstatVal}>{data ? eur0(data.rentasAnio) : '—'}</div>
              <div className={styles.rstatSub}>año completo</div>
            </div>
            <div className={styles.rstat}>
              <div className={styles.rstatLabel}>Gastos previstos</div>
              <div className={styles.rstatVal}>{data ? eur0(data.gastosAnio) : '—'}</div>
              <div className={styles.rstatSub}>cuotas · recurrentes confirmados</div>
            </div>
            <div className={styles.rstat}>
              <div className={styles.rstatLabel}>Ocupación</div>
              <div className={styles.rstatVal}>{data ? data.ocupacion : '—'}</div>
              <div className={styles.rstatSub}>unidades</div>
            </div>
            <div className={styles.rstat}>
              <div className={styles.rstatLabel}>IRPF estimado</div>
              <div className={styles.rstatVal}>{data && data.irpf != null ? eur0(data.irpf) : '—'}</div>
              <div className={styles.rstatSub}>{data && data.irpf != null ? 'resultado estimado' : 'se mostrará al completar nómina'}</div>
            </div>
          </div>
        </div>

        <div className={styles.revealGrid}>
          <div className={styles.revealCard}>
            <div className={styles.revealCardTitle}>Caja prevista · mes a mes</div>
            <div className={styles.chartWrap}>
              <svg viewBox="0 0 600 240" style={{ minWidth: 520, width: '100%' }} xmlns="http://www.w3.org/2000/svg">
                <line x1="40" y1="220" x2="585" y2="220" stroke="var(--atlas-v5-line)" strokeWidth="1" />
                <line x1="40" y1="20" x2="40" y2="220" stroke="var(--atlas-v5-line)" strokeWidth="1" />
                <text x="36" y="24" fontSize="10" fill="var(--atlas-v5-ink-4)" textAnchor="end" fontFamily="JetBrains Mono">
                  {eur0(maxMensual)}
                </text>
                <text x="36" y="122" fontSize="10" fill="var(--atlas-v5-ink-4)" textAnchor="end" fontFamily="JetBrains Mono">
                  {eur0(maxMensual / 2)}
                </text>
                <text x="36" y="222" fontSize="10" fill="var(--atlas-v5-ink-4)" textAnchor="end" fontFamily="JetBrains Mono">
                  0
                </text>
                {data && (
                  <>
                    <polyline points={puntosSVG(data.mensualIngreso, maxMensual)} fill="none" stroke="var(--atlas-v5-gold)" strokeWidth="2.5" />
                    <polyline points={puntosSVG(data.mensualGasto, maxMensual)} fill="none" stroke="var(--atlas-v5-ink-5)" strokeWidth="2" />
                  </>
                )}
                <text x="60" y="234" fontSize="9.5" fill="var(--atlas-v5-ink-4)" fontFamily="JetBrains Mono" textAnchor="middle">{MESES[0]}</text>
                <text x="307" y="234" fontSize="9.5" fill="var(--atlas-v5-ink-4)" fontFamily="JetBrains Mono" textAnchor="middle">{MESES[5]}</text>
                <text x="555" y="234" fontSize="9.5" fill="var(--atlas-v5-ink-4)" fontFamily="JetBrains Mono" textAnchor="middle">{MESES[11]}</text>
              </svg>
            </div>
          </div>
          <div className={styles.revealCard}>
            <div className={styles.revealCardTitle}>Para afinar tu foto</div>
            <div className={styles.honesty}>
              <strong>Tu estimación está al {progress.pct}%</strong>
              <ul className={styles.honestyList}>
                {pendientes.length === 0 ? (
                  <li>
                    <Icons.Success size={12} strokeWidth={2.5} /> Tu foto está completa · nada pendiente
                  </li>
                ) : (
                  pendientes.map((meta) => (
                    <li key={meta.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/empezar/${meta.id}`)}>
                      <Icons.ChevronRight size={12} strokeWidth={2.5} /> Completa {meta.titulo.toLowerCase()}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.revealCta}>
          <button
            type="button"
            className={`${styles.btnGold} ${styles.btnBig}`}
            onClick={() => {
              showToastV5('Bienvenido a Atlas', 'success');
              navigate('/panel');
            }}
          >
            Entrar a Atlas
            <Icons.ChevronRight size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </>
  );
};

export default RevealScreen;
