// Panel · home v5. Sustituye `HorizonPanel` legacy con vista alineada al
// mockup `docs/audit-inputs/atlas-panel.html` ·
//   - Saludo + fecha + número de cosas pidiendo atención.
//   - Hero patrimonial · valor neto + activos + deuda + composición.
//   - Grid 4 activos · Inmuebles · Inversiones · Tesorería · Financiación.
//
// Lee de · properties · inversiones · accounts · prestamos. NO toca
// services internos.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead, Icons, MoneyValue } from '../../design-system/v5';
import { initDB } from '../../services/db';
import type { Property, Account } from '../../services/db';
import type { PosicionInversion } from '../../types/inversiones';
import type { Prestamo } from '../../types/prestamos';
import { effectiveTIN } from '../financiacion/helpers';
import styles from './PanelPage.module.css';

const saludo = (d: Date): string => {
  const h = d.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
};

const PanelPage: React.FC = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionInversion[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const [props, inv, accs, prest] = await Promise.all([
          db.getAll('properties') as Promise<Property[]>,
          db.getAll('inversiones') as Promise<PosicionInversion[]>,
          db.getAll('accounts') as Promise<Account[]>,
          db.getAll('prestamos') as Promise<Prestamo[]>,
        ]);
        if (cancelled) return;
        setProperties(props);
        setPosiciones(inv);
        setAccounts(accs);
        setPrestamos(prest.filter((p) => p.activo !== false && p.estado !== 'cancelado'));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[panel] error cargando datos', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(() => new Date(), []);

  const valorInmuebles = useMemo(() => {
    return properties.reduce((s, p) => {
      const vAny = p as Property & { precioCompra?: number };
      return s + (vAny.precioCompra ?? 0);
    }, 0);
  }, [properties]);

  const valorInversiones = useMemo(
    () => posiciones.reduce((s, p) => s + (p.valor_actual ?? 0), 0),
    [posiciones],
  );

  const saldoTesoreria = useMemo(
    () => accounts.reduce((s, a) => s + ((a as Account).balance ?? a.openingBalance ?? 0), 0),
    [accounts],
  );

  const deudaViva = useMemo(
    () => prestamos.reduce((s, p) => s + (p.principalVivo ?? 0), 0),
    [prestamos],
  );

  const cuotaMensualPrestamos = useMemo(() => {
    return prestamos.reduce((s, p) => {
      const i = effectiveTIN(p) / 100 / 12;
      const n = Math.max(1, p.plazoMesesTotal - p.cuotasPagadas);
      const C = p.principalVivo;
      if (i === 0) return s + C / n;
      return s + (C * i) / (1 - Math.pow(1 + i, -n));
    }, 0);
  }, [prestamos]);

  const activosTotales = valorInmuebles + valorInversiones + saldoTesoreria;
  const patrimonioNeto = activosTotales - deudaViva;

  const compTotal = activosTotales > 0 ? activosTotales : 1;
  const pctInmuebles = (valorInmuebles / compTotal) * 100;
  const pctInversiones = (valorInversiones / compTotal) * 100;
  const pctTesoreria = (saldoTesoreria / compTotal) * 100;

  const cosasAtencion = useMemo(() => {
    let n = 0;
    // Documentos sin clasificar (estimación · si hay store documents).
    if (prestamos.some((p) => p.cuotasPagadas === 0 && p.estado !== 'pendiente_completar')) n += 1;
    return n;
  }, [prestamos]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>Cargando panel…</div>
      </div>
    );
  }

  const fechaLabel = today.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const empty = activosTotales === 0 && deudaViva === 0;

  return (
    <div className={styles.page}>
      <PageHead
        title={`${saludo(today)}, Atlas`}
        sub={
          <>
            hoy es <strong>{fechaLabel}</strong>
            {cosasAtencion > 0 && (
              <>
                <span style={{ color: 'var(--atlas-v5-ink-5)', margin: '0 8px' }}>·</span>
                {cosasAtencion} cosa{cosasAtencion === 1 ? '' : 's'} pide{cosasAtencion === 1 ? '' : 'n'} tu
                atención
              </>
            )}
          </>
        }
        actions={[
          {
            label: 'Últimos 30 días',
            variant: 'ghost',
            icon: <Icons.Clock size={14} strokeWidth={1.8} />,
            onClick: () => undefined,
          },
        ]}
      />

      {empty ? (
        <div
          style={{
            background: 'var(--atlas-v5-card)',
            border: '1px solid var(--atlas-v5-line)',
            borderRadius: 14,
            padding: 36,
            textAlign: 'center',
            color: 'var(--atlas-v5-ink-3)',
          }}
        >
          <h2 style={{ marginBottom: 12, fontSize: 18, color: 'var(--atlas-v5-ink)' }}>
            Bienvenido a Atlas
          </h2>
          <p style={{ marginBottom: 18, fontSize: 13.5 }}>
            Empieza añadiendo tus inmuebles, cuentas o préstamos para ver tu patrimonio
            consolidado aquí.
          </p>
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            style={{
              padding: '10px 20px',
              background: 'var(--atlas-v5-gold)',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Empezar onboarding
          </button>
        </div>
      ) : (
        <>
          <div className={styles.hero}>
            <div className={styles.heroHead}>
              <div>
                <div className={styles.heroLab}>Patrimonio neto</div>
                <div className={styles.heroValor}>
                  <MoneyValue value={patrimonioNeto} decimals={0} tone="ink" />
                </div>
                <div className={`${styles.heroDelta} ${patrimonioNeto >= 0 ? styles.pos : styles.neg}`}>
                  <Icons.Inversiones size={12} strokeWidth={2.5} />
                  activos − deuda
                  <span className={styles.heroDeltaMeta}>· consolidado</span>
                </div>
              </div>
              <div className={styles.heroMetaRight}>
                <div className={styles.heroMetaLab}>Activos totales</div>
                <div className={styles.heroMetaVal}>
                  <MoneyValue value={activosTotales} decimals={0} tone="ink" />
                </div>
                <div className={styles.heroMetaLab} style={{ marginTop: 10 }}>
                  Deuda viva
                </div>
                <div className={`${styles.heroMetaVal} ${styles.neg}`}>
                  <MoneyValue value={-deudaViva} decimals={0} showSign tone="neg" />
                </div>
              </div>
            </div>

            <div className={styles.compHead}>
              <div className={styles.compTitle}>Composición del patrimonio</div>
            </div>
            <div className={styles.compTrack} role="img" aria-label="Composición patrimonio">
              {valorInmuebles > 0 && (
                <div
                  className={`${styles.compSeg} ${styles.inmuebles}`}
                  style={{ width: `${pctInmuebles}%` }}
                  title={`Inmuebles · ${pctInmuebles.toFixed(1)}%`}
                />
              )}
              {valorInversiones > 0 && (
                <div
                  className={`${styles.compSeg} ${styles.inversiones}`}
                  style={{ width: `${pctInversiones}%` }}
                  title={`Inversiones · ${pctInversiones.toFixed(1)}%`}
                />
              )}
              {saldoTesoreria > 0 && (
                <div
                  className={`${styles.compSeg} ${styles.tesoreria}`}
                  style={{ width: `${pctTesoreria}%` }}
                  title={`Tesorería · ${pctTesoreria.toFixed(1)}%`}
                />
              )}
            </div>
            <div className={styles.compLeg}>
              <div className={styles.compLegItem}>
                <div className={`${styles.compLegDot} ${styles.inmuebles}`} />
                <span className={styles.compLegNom}>Inmuebles</span>
                <span className={styles.compLegVal}>
                  <MoneyValue value={valorInmuebles} decimals={0} tone="ink" />
                  <span className={styles.compLegPct}>{pctInmuebles.toFixed(1)}%</span>
                </span>
              </div>
              <div className={styles.compLegItem}>
                <div className={`${styles.compLegDot} ${styles.inversiones}`} />
                <span className={styles.compLegNom}>Inversiones</span>
                <span className={styles.compLegVal}>
                  <MoneyValue value={valorInversiones} decimals={0} tone="ink" />
                  <span className={styles.compLegPct}>{pctInversiones.toFixed(1)}%</span>
                </span>
              </div>
              <div className={styles.compLegItem}>
                <div className={`${styles.compLegDot} ${styles.tesoreria}`} />
                <span className={styles.compLegNom}>Tesorería</span>
                <span className={styles.compLegVal}>
                  <MoneyValue value={saldoTesoreria} decimals={0} tone="ink" />
                  <span className={styles.compLegPct}>{pctTesoreria.toFixed(1)}%</span>
                </span>
              </div>
              <div className={styles.compLegItem}>
                <div className={`${styles.compLegDot} ${styles.financiacion}`} />
                <span className={styles.compLegNom}>Financiación</span>
                <span className={styles.compLegVal}>
                  <MoneyValue value={-deudaViva} decimals={0} showSign tone="neg" />
                </span>
              </div>
            </div>
          </div>

          <div className={styles.secTitle}>Pulso de los 4 activos</div>
          <div className={styles.activosGrid}>
            <button
              type="button"
              className={styles.activoCard}
              onClick={() => navigate('/inmuebles')}
            >
              <div className={styles.activoHead}>
                <div className={styles.activoNom}>Inmuebles</div>
                <span className={styles.activoIcon}>
                  <Icons.Inmuebles size={16} strokeWidth={1.8} />
                </span>
              </div>
              <div className={styles.activoVal}>
                <MoneyValue value={valorInmuebles} decimals={0} tone="ink" />
              </div>
              <div className={styles.activoExtra}>
                <span className={styles.activoExtraLab}>activos</span>
                <span className={styles.activoExtraVal}>{properties.length}</span>
              </div>
              <span className={styles.activoCta}>Ver detalle →</span>
            </button>

            <button
              type="button"
              className={styles.activoCard}
              onClick={() => navigate('/inversiones')}
            >
              <div className={styles.activoHead}>
                <div className={styles.activoNom}>Inversiones</div>
                <span className={styles.activoIcon}>
                  <Icons.Inversiones size={16} strokeWidth={1.8} />
                </span>
              </div>
              <div className={styles.activoVal}>
                <MoneyValue value={valorInversiones} decimals={0} tone="ink" />
              </div>
              <div className={styles.activoExtra}>
                <span className={styles.activoExtraLab}>posiciones</span>
                <span className={styles.activoExtraVal}>{posiciones.length}</span>
              </div>
              <span className={styles.activoCta}>Ver detalle →</span>
            </button>

            <button
              type="button"
              className={styles.activoCard}
              onClick={() => navigate('/tesoreria')}
            >
              <div className={styles.activoHead}>
                <div className={styles.activoNom}>Tesorería</div>
                <span className={styles.activoIcon}>
                  <Icons.Tesoreria size={16} strokeWidth={1.8} />
                </span>
              </div>
              <div className={styles.activoVal}>
                <MoneyValue value={saldoTesoreria} decimals={0} tone="ink" />
              </div>
              <div className={styles.activoExtra}>
                <span className={styles.activoExtraLab}>cuentas</span>
                <span className={styles.activoExtraVal}>{accounts.length}</span>
              </div>
              <span className={styles.activoCta}>Ver detalle →</span>
            </button>

            <button
              type="button"
              className={styles.activoCard}
              onClick={() => navigate('/financiacion')}
            >
              <div className={styles.activoHead}>
                <div className={styles.activoNom}>Financiación</div>
                <span className={styles.activoIcon}>
                  <Icons.Financiacion size={16} strokeWidth={1.8} />
                </span>
              </div>
              <div className={`${styles.activoVal} ${styles.neg}`}>
                <MoneyValue value={-deudaViva} decimals={0} showSign tone="neg" />
              </div>
              <div className={styles.activoExtra}>
                <span className={styles.activoExtraLab}>cuota mes</span>
                <span className={`${styles.activoExtraVal} ${styles.neg}`}>
                  <MoneyValue value={-cuotaMensualPrestamos} decimals={0} showSign tone="neg" />
                </span>
              </div>
              <span className={styles.activoCta}>Ver detalle →</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PanelPage;
