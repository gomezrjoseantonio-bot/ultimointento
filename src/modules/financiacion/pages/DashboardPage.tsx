import React, { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, MoneyValue, showToastV5 } from '../../../design-system/v5';
import type { FinanciacionOutletContext } from '../FinanciacionContext';
import {
  cuotaMensualAprox,
  effectiveTIN,
  formatPct,
  getBankPalette,
  upcomingCuotasFromPlanes,
} from '../helpers';
import styles from './DashboardPage.module.css';

const formatHaceDias = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'hace 1 d';
  return `hace ${days} d`;
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { rows, prestamos, planes } = useOutletContext<FinanciacionOutletContext>();

  const totalDeudaViva = rows.reduce((s, r) => s + r.capitalVivo, 0);
  const totalAmortizado = rows.reduce((s, r) => s + r.amortizado, 0);
  const principalTotal = rows.reduce((s, r) => s + r.principalInicial, 0);
  const ratioAmort = principalTotal > 0 ? (totalAmortizado / principalTotal) * 100 : 0;
  const cuotaTotalMes = rows.reduce((s, r) => s + r.cuotaMensual, 0);
  const interesesAnuales = rows.reduce(
    (s, r) => s + (r.capitalVivo * r.tin) / 100,
    0,
  );
  const interesesDeducibles = rows.reduce((s, r) => s + r.intDeducibles, 0);
  const tinPonderado =
    totalDeudaViva > 0
      ? rows.reduce((s, r) => s + r.tin * r.capitalVivo, 0) / totalDeudaViva
      : 0;

  const hipotecas = rows.filter((r) => r.kind === 'hipoteca');
  const personales = rows.filter((r) => r.kind === 'personal');
  const pignora = rows.filter((r) => r.kind === 'pignora');

  const sumKind = (g: typeof rows) => g.reduce((s, r) => s + r.capitalVivo, 0);
  const hipoVivo = sumKind(hipotecas);
  const persVivo = sumKind(personales);
  const pignVivo = sumKind(pignora);
  const pct = (n: number) => (totalDeudaViva > 0 ? (n / totalDeudaViva) * 100 : 0);

  const proximas = useMemo(() => {
    return upcomingCuotasFromPlanes(prestamos, planes).slice(0, 5);
  }, [prestamos, planes]);

  const ultUpdate = useMemo(() => {
    const dates = prestamos
      .map((p) => (p.updatedAt ? new Date(p.updatedAt).getTime() : 0))
      .filter((t) => t > 0);
    if (dates.length === 0) return '—';
    return formatHaceDias(new Date(Math.max(...dates)).toISOString());
  }, [prestamos]);

  const topDeducibles = [...rows]
    .filter((r) => r.intDeducibles > 0)
    .sort((a, b) => b.intDeducibles - a.intDeducibles)
    .slice(0, 3);

  const entidadesCount = useMemo(
    () => new Set(rows.map((r) => r.banco)).size,
    [rows],
  );

  if (rows.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.empty}>
            Aún no tienes préstamos registrados. Crea tu primer préstamo desde el botón
            <strong> Nuevo préstamo</strong> o <strong>Crear desde FEIN</strong>.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <div className={styles.heroDeuda}>
        <div>
          <div className={styles.lab}>Deuda viva total</div>
          <div className={styles.total}>
            <MoneyValue value={-totalDeudaViva} decimals={0} showSign tone="neg" />
          </div>
          <div className={styles.sub}>
            <strong>{rows.length} préstamos activos</strong>
            {hipotecas.length > 0 && (
              <>
                {' · '}
                {hipotecas.length} hipoteca{hipotecas.length === 1 ? '' : 's'}
              </>
            )}
            {personales.length > 0 && <> + {personales.length} personales</>}
            {pignora.length > 0 && <> + {pignora.length} pignoraticias</>}
            {' · repartidos en '}
            <strong>{entidadesCount}</strong> entidades
          </div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Capital amortizado</div>
          <div className={`${styles.val} ${styles.pos}`}>
            <MoneyValue value={totalAmortizado} decimals={0} showSign tone="pos" />
          </div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Ratio amortización</div>
          <div className={`${styles.val} ${styles.gold}`}>{formatPct(ratioAmort)}</div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Última act.</div>
          <div className={styles.val}>{ultUpdate}</div>
        </div>
      </div>

      <div className={styles.kpiStrip}>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Cuota total mes</div>
          <div className={`${styles.kpiVal} ${styles.neg}`}>
            <MoneyValue value={-cuotaTotalMes} decimals={0} showSign tone="neg" />
          </div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Intereses año en curso</div>
          <div className={`${styles.kpiVal} ${styles.neg}`}>
            <MoneyValue value={-interesesAnuales} decimals={0} showSign tone="neg" />
          </div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Intereses deducibles</div>
          <div className={`${styles.kpiVal} ${styles.pos}`}>
            <MoneyValue value={interesesDeducibles} decimals={0} showSign tone="pos" />
          </div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>TIN medio ponderado</div>
          <div className={styles.kpiVal}>{formatPct(tinPonderado, 2)}</div>
        </div>
      </div>

      <div className={styles.distCard}>
        <div className={styles.distHead}>
          <div>
            <div className={styles.distTitle}>Distribución de la deuda por tipo</div>
            <div className={styles.distSub}>por volumen de capital vivo</div>
          </div>
        </div>
        <div className={styles.distTrack}>
          {hipoVivo > 0 && (
            <div
              className={`${styles.distSeg} ${styles.hipotecas}`}
              style={{ width: `${pct(hipoVivo)}%` }}
              title={`Hipotecas · ${pct(hipoVivo).toFixed(0)}%`}
            />
          )}
          {persVivo > 0 && (
            <div
              className={`${styles.distSeg} ${styles.personales}`}
              style={{ width: `${pct(persVivo)}%` }}
              title={`Personales · ${pct(persVivo).toFixed(0)}%`}
            />
          )}
          {pignVivo > 0 && (
            <div
              className={`${styles.distSeg} ${styles.pignora}`}
              style={{ width: `${pct(pignVivo)}%` }}
              title={`Pignoraticias · ${pct(pignVivo).toFixed(0)}%`}
            />
          )}
        </div>
        <div className={styles.distLeg}>
          {hipoVivo > 0 && (
            <div className={styles.distLegItem}>
              <div className={`${styles.distLegDot} ${styles.hipotecas}`} />
              <span className={styles.distLegNom}>Hipotecas</span>
              <span className={styles.distLegVal}>
                <MoneyValue value={hipoVivo} decimals={0} tone="ink" />
              </span>
              <span className={styles.distLegPct}>{pct(hipoVivo).toFixed(0)}%</span>
            </div>
          )}
          {persVivo > 0 && (
            <div className={styles.distLegItem}>
              <div className={`${styles.distLegDot} ${styles.personales}`} />
              <span className={styles.distLegNom}>Personales</span>
              <span className={styles.distLegVal}>
                <MoneyValue value={persVivo} decimals={0} tone="ink" />
              </span>
              <span className={styles.distLegPct}>{pct(persVivo).toFixed(0)}%</span>
            </div>
          )}
          {pignVivo > 0 && (
            <div className={styles.distLegItem}>
              <div className={`${styles.distLegDot} ${styles.pignora}`} />
              <span className={styles.distLegNom}>Pignoraticias</span>
              <span className={styles.distLegVal}>
                <MoneyValue value={pignVivo} decimals={0} tone="ink" />
              </span>
              <span className={styles.distLegPct}>{pct(pignVivo).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.cols2}>
        <CardV5>
          <div className={styles.cardHd}>
            <div>
              <CardV5.Title>Próximas cuotas del mes</CardV5.Title>
              <CardV5.Subtitle>
                {proximas.length} cuotas previstas · total{' '}
                <MoneyValue
                  value={-proximas.reduce((s, c) => s + c.cuota, 0)}
                  decimals={0}
                  showSign
                  tone="neg"
                />
              </CardV5.Subtitle>
            </div>
            <span
              className={styles.cardAction}
              onClick={() => navigate('/financiacion/calendario')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate('/financiacion/calendario');
              }}
            >
              Ver todas →
            </span>
          </div>
          <CardV5.Body>
            {proximas.length === 0 ? (
              <div className={styles.empty}>No hay cuotas próximas en los próximos 30 días.</div>
            ) : (
              proximas.map((c) => {
                const palette = getBankPalette(c.banco);
                return (
                  <div
                    key={`${c.prestamoId}-${c.fechaISO}`}
                    className={styles.cuotaRow}
                    onClick={() => navigate(`/financiacion/${c.prestamoId}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/financiacion/${c.prestamoId}`);
                    }}
                  >
                    <div
                      className={styles.cuotaLogo}
                      style={{ background: palette.bg, color: palette.fg }}
                    >
                      {palette.abbr}
                    </div>
                    <div>
                      <div className={styles.cuotaNom}>{c.alias}</div>
                      <div className={styles.cuotaMeta}>
                        capital <MoneyValue value={c.capital} decimals={0} tone="muted" /> ·
                        intereses <MoneyValue value={c.interes} decimals={0} tone="muted" />
                      </div>
                    </div>
                    <span className={`${styles.cuotaFecha} ${c.urgente ? styles.urgente : ''}`}>
                      {new Date(c.fechaISO).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {c.diasHasta}d
                    </span>
                    <span className={styles.cuotaImp}>
                      <MoneyValue value={-c.cuota} decimals={0} showSign tone="neg" />
                    </span>
                  </div>
                );
              })
            )}
          </CardV5.Body>
        </CardV5>

        <CardV5>
          <div className={styles.cardHd}>
            <div>
              <CardV5.Title>Top impacto fiscal</CardV5.Title>
              <CardV5.Subtitle>
                intereses deducibles · año {new Date().getFullYear()}
              </CardV5.Subtitle>
            </div>
            <span
              className={styles.cardAction}
              onClick={() => showToastV5('Detalle fiscal · sub-tarea follow-up')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') showToastV5('Detalle fiscal · sub-tarea follow-up');
              }}
            >
              Detalle →
            </span>
          </div>
          <CardV5.Body>
            {topDeducibles.length === 0 ? (
              <div className={styles.empty}>
                No hay préstamos con intereses deducibles registrados aún.
              </div>
            ) : (
              topDeducibles.map((r) => (
                <div
                  key={r.id}
                  className={styles.deduRow}
                  onClick={() => navigate(`/financiacion/${r.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/financiacion/${r.id}`);
                  }}
                >
                  <div>
                    <div className={styles.deduNom}>{r.alias}</div>
                    <div className={styles.deduMeta}>
                      {formatPct(r.intDeduciblesPct, 1)} deducible
                      <span className={styles.chip}>
                        TIN {formatPct(effectiveTIN(r.raw), 2)}
                      </span>
                      <span className={styles.chip}>
                        cuota {Math.round(cuotaMensualAprox(r.raw)).toLocaleString('es-ES')} €/m
                      </span>
                    </div>
                  </div>
                  <div className={styles.deduVal}>
                    <div className={styles.deduValMain}>
                      <MoneyValue value={r.intDeducibles} decimals={0} showSign tone="pos" />
                    </div>
                    <div className={styles.deduValSub}>casilla 0105</div>
                  </div>
                </div>
              ))
            )}
          </CardV5.Body>
        </CardV5>
      </div>
    </>
  );
};

export default DashboardPage;
