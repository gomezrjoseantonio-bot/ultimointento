// Panel · home v5. Sustituye `HorizonPanel` legacy con vista alineada al
// mockup `docs/audit-inputs/atlas-panel.html` ·
//   - Saludo personalizado + fecha + campaña IRPF + número de cosas pidiendo atención (22.2)
//   - Hero patrimonial · valor neto + activos + deuda + composición γ (22.2)
//   - Grid 4 activos · Inmuebles · Inversiones · Tesorería · Financiación (22.3)
//   - Pulso del mes · ingresos · gastos · cashflow · saldo fin (22.4)
//   - Piden tu atención · AttentionList · MAX 5 alertas por urgencia (22.5)
//
// Lee de · properties · inversiones · accounts · prestamos · treasuryEvents · contracts.
// NO toca services internos.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead, Icons, MoneyValue, CompositionBar } from '../../design-system/v5';
import { initDB } from '../../services/db';
import type { Property, Account, TreasuryEvent, Contract } from '../../services/db';
import type { PosicionInversion } from '../../types/inversiones';
import type { Prestamo } from '../../types/prestamos';
import type { Escenario } from '../../types/miPlan';
import { effectiveTIN } from '../financiacion/helpers';
import { getFiscalContextSafe } from '../../services/fiscalContextService';
import PulseAssetCard from './components/PulseAssetCard';
import PulsoDelMes from './components/PulsoDelMes';
import AttentionList from './components/AttentionList';
import MiPlanCompass from './components/MiPlanCompass';
import type { AlertaItem } from './components/AttentionList';
import styles from './PanelPage.module.css';

/**
 * Formatea un importe monetario como string resumido para las extra-métricas
 * de las cards de activos. Ej: 1234 → "1.234 €"
 */
const fmtImporte = (n: number): string =>
  `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n)} €`;

/**
 * Saludo según hora del día · § Z.6 spec T22.2
 * 00-12 → Buenos días · 12-20 → Buenas tardes · 20-24 → Buenas noches
 */
const saludo = (d: Date): string => {
  const h = d.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

/**
 * Campaña IRPF · activa entre 1 abril y 30 junio inclusive · § T22.2
 * Devuelve "campaña IRPF {ejercicio} activa" o null si no es temporada.
 */
const campañaIRPF = (d: Date): string | null => {
  const mes = d.getMonth() + 1; // 1-based
  const dia = d.getDate();
  const año = d.getFullYear();
  // Abril (mes 4), Mayo (mes 5) y hasta el 30 de Junio (mes 6)
  const enCampana =
    mes === 4 ||
    mes === 5 ||
    (mes === 6 && dia <= 30);
  if (enCampana) {
    // El ejercicio IRPF es el año anterior
    return `campaña IRPF ${año - 1} activa`;
  }
  return null;
};

const PanelPage: React.FC = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionInversion[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [treasuryEvents, setTreasuryEvents] = useState<TreasuryEvent[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [escenario, setEscenario] = useState<Escenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState<string>('usuario');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [db, ctx] = await Promise.all([
          initDB(),
          getFiscalContextSafe(),
        ]);
        const [props, inv, accs, prest, tevents, conts] = await Promise.all([
          db.getAll('properties') as Promise<Property[]>,
          db.getAll('inversiones') as Promise<PosicionInversion[]>,
          db.getAll('accounts') as Promise<Account[]>,
          db.getAll('prestamos') as Promise<Prestamo[]>,
          db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          db.getAll('contracts') as Promise<Contract[]>,
        ]);
        if (cancelled) return;
        setProperties(props);
        setPosiciones(inv);
        setAccounts(accs);
        setPrestamos(prest.filter((p) => p.activo !== false && p.estado !== 'cancelado'));
        setTreasuryEvents(tevents);
        setContracts(conts);
        if (ctx?.nombre) setNombreUsuario(ctx.nombre);
        // T22.6 · Cargar escenario Mi Plan para datos brújula
        const escenarios = await db.getAll('escenarios') as Escenario[];
        if (!cancelled) setEscenario(escenarios[0] ?? null);
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
      const propertyValue = p as Property & {
        currentValue?: number;
        acquisitionCosts?: { price?: number };
      };
      return s + (propertyValue.currentValue ?? propertyValue.acquisitionCosts?.price ?? 0);
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

  const cosasAtencion = useMemo(() => {
    let n = 0;
    // Préstamos que parecen requerir atención inicial · sin cuotas pagadas
    // y no marcados como "pendiente completar" (datos faltantes esperados).
    if (prestamos.some((p) => p.cuotasPagadas === 0 && p.estado !== 'pendiente_completar')) n += 1;
    return n;
  }, [prestamos]);

  /**
   * Pulso del mes · § Z.10 · T22.4
   * ingresos  = sum treasuryEvents con amount > 0 del mes en curso
   * gastos    = sum |treasuryEvents con amount < 0| del mes en curso
   * cashflow  = ingresos - gastos
   * saldo fin = saldoTesoreria + cashflow (proyección sobre saldo actual)
   *             TODO: conectar con servicio de proyección cuando esté disponible
   */
  const pulsoMes = useMemo(() => {
    const mesActual = today.getMonth() + 1; // 1-based
    const añoActual = today.getFullYear();
    const eventosMes = treasuryEvents.filter((ev) => {
      const dateStr = ev.actualDate ?? ev.predictedDate;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === añoActual && d.getMonth() + 1 === mesActual;
    });
    const ingresos = eventosMes
      .filter((ev) => ev.amount > 0)
      .reduce((s, ev) => s + ev.amount, 0);
    const gastos = eventosMes
      .filter((ev) => ev.amount < 0)
      .reduce((s, ev) => s + Math.abs(ev.amount), 0);
    const cashflow = ingresos - gastos;
    // TODO: conectar con servicio de proyección para obtener saldo fin de mes real
    const saldoFin = saldoTesoreria + cashflow;
    return { ingresos, gastos, cashflow, saldoFin };
  }, [treasuryEvents, today, saldoTesoreria]);

  /**
   * Alertas "Piden tu atención" · § Z.11 · T22.5
   * MAX 5 · prioridad:
   *   1. Deudas ejecutiva/apremio            → TODO servicio alertas
   *   2. Borradores fiscales listos          → TODO servicio alertas
   *   3. Obligaciones fiscales próximas 30d  → TODO servicio alertas
   *   4. Contratos vencer en 60d             → derivado de contracts store
   *   5. Pagos vencidos sin conciliar        → derivado de treasuryEvents store
   */
  const alertas = useMemo((): AlertaItem[] => {
    const lista: AlertaItem[] = [];
    const hoy = today;

    // 1. TODO: conectar con servicio de alertas para deudas ejecutiva/apremio
    //    cuando esté disponible · actualmente no hay campo en Prestamo

    // 2. TODO: conectar con servicio de alertas para borradores fiscales listos
    //    cuando esté disponible · requiere store declaraciones/snapshotsDeclaracion

    // 3. TODO: conectar con servicio de alertas para obligaciones fiscales próximas
    //    cuando esté disponible · requiere store obligaciones fiscales

    // 4. Contratos activos que vencen en los próximos 60 días · § AA.6 Calendar · warn
    const en60dias = new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000);
    const contratosVencen = contracts.filter((c) => {
      if (c.estadoContrato !== 'activo') return false;
      // fechaFin es el campo canónico · endDate es el campo legacy (db.ts Contract)
      const fechaFin = c.fechaFin ?? c.endDate;
      if (!fechaFin) return false;
      const d = new Date(fechaFin);
      return d >= hoy && d <= en60dias;
    });
    if (contratosVencen.length > 0) {
      const rentaTotal = contratosVencen.reduce((s, c) => s + (c.rentaMensual ?? 0), 0);
      lista.push({
        id: 'contratos-vencer',
        severity: 'warn',
        valueSeverity: 'warn',
        iconType: 'calendar',
        title: `${contratosVencen.length} contrato${contratosVencen.length === 1 ? '' : 's'} vence${contratosVencen.length === 1 ? '' : 'n'} pronto`,
        meta: `Vencimiento en los próximos 60 días`,
        value: rentaTotal,
        timeWindow: '60 días',
        href: '/contratos',
      });
    }

    // 5. Pagos vencidos (amount < 0, fecha pasada) sin conciliar con movimiento real · neg
    const pagosVencidos = treasuryEvents.filter((ev) => {
      if (ev.amount >= 0) return false;
      if (ev.status === 'executed' || ev.movementId !== undefined) return false;
      const fecha = new Date(ev.actualDate ?? ev.predictedDate);
      return fecha < hoy;
    });
    if (pagosVencidos.length > 0) {
      const totalVencido = pagosVencidos.reduce((s, ev) => s + Math.abs(ev.amount), 0);
      lista.push({
        id: 'pagos-vencidos',
        severity: 'neg',
        valueSeverity: 'neg',
        iconType: 'filetext',
        title: `${pagosVencidos.length} pago${pagosVencidos.length === 1 ? '' : 's'} vencido${pagosVencidos.length === 1 ? '' : 's'} sin conciliar`,
        meta: `Movimientos pasados pendientes de conciliación`,
        value: totalVencido,
        timeWindow: 'pendiente',
        href: '/tesoreria',
      });
    }

    // Limite MAX 5 · ordenado ya por prioridad de inserción
    return lista.slice(0, 5);
  }, [contracts, treasuryEvents, today]);

  /**
   * Mi Plan · brújula · § Z.11 · T22.6
   *
   * rentaPasiva  = sum rentaMensual de contratos arrendamiento activos
   * gastoVida    = escenario.gastosVidaLibertadMensual si > 0
   *               · si no · derivado de gastos del mes en curso (pulsoMes.gastos)
   *               · TODO conectar con proyección de gastos reales cuando esté disponible
   * mesesColchon = floor(saldo / gastoVida) · null si gastoVida = 0
   * pctCobertura = (rentaPasiva / gastoVida) * 100 · 0 si gastoVida = 0
   * añoLibertad  = TODO conectar simulador Mi Plan · "—" mientras no disponible
   * metaInmuebles = TODO conectar simulador Mi Plan · null mientras no disponible
   */
  const planMetrics = useMemo(() => {
    // Renta pasiva = sum rentaMensual de contratos activos (arrendamiento)
    const rentaPasiva = contracts
      .filter((c) => c.estadoContrato === 'activo')
      .reduce((s, c) => s + (c.rentaMensual ?? 0), 0);

    // Gasto vida = escenario o gastos del mes actual como fallback
    const gastoVida =
      (escenario?.gastosVidaLibertadMensual ?? 0) > 0
        ? (escenario?.gastosVidaLibertadMensual as number)
        : pulsoMes.gastos;

    const pctCobertura = gastoVida > 0 ? (rentaPasiva / gastoVida) * 100 : 0;

    const mesesColchon =
      gastoVida > 0 ? Math.floor(saldoTesoreria / gastoVida) : null;

    // TODO: calcular añoLibertad desde simulador Mi Plan cuando esté disponible
    const añoLibertad = '—';

    // TODO: obtener metaInmuebles desde escenario/simulador Mi Plan
    const metaInmuebles: number | null = null;

    return {
      rentaPasiva,
      gastoVida,
      pctCobertura,
      mesesColchon,
      añoLibertad,
      metaInmuebles,
      inmueblesActivos: properties.length,
    };
  }, [contracts, escenario, pulsoMes.gastos, saldoTesoreria, properties]);

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

  const mesNombre = today.toLocaleDateString('es-ES', { month: 'long' });
  const añoActual = today.getFullYear();

  const campañaLabel = campañaIRPF(today);
  const empty = activosTotales === 0 && deudaViva === 0;

  return (
    <div className={styles.page}>
      <PageHead
        title={`${saludo(today)}, ${nombreUsuario}`}
        sub={
          <>
            hoy es <strong>{fechaLabel}</strong>
            {campañaLabel && (
              <>
                <span style={{ color: 'var(--atlas-v5-ink-5)', margin: '0 8px' }}>·</span>
                {campañaLabel}
              </>
            )}
            {cosasAtencion > 0 && (
              <>
                <span style={{ color: 'var(--atlas-v5-ink-5)', margin: '0 8px' }}>·</span>
                <strong>
                  {cosasAtencion} cosa{cosasAtencion === 1 ? '' : 's'} pide{cosasAtencion === 1 ? '' : 'n'} tu
                  atención
                </strong>
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
              color: 'var(--atlas-v5-white)',
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
                  {patrimonioNeto >= 0
                    ? <Icons.ArrowUpRight size={14} strokeWidth={2} />
                    : <Icons.ArrowDownRight size={14} strokeWidth={2} />
                  }
                  activos brutos · sin deuda
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

            {/* Composición γ · 3 segmentos activos · NO Financiación · § Z.8 T22.2 */}
            <CompositionBar
              segments={[
                {
                  key: 'inmuebles',
                  label: 'Inmuebles',
                  value: valorInmuebles,
                  color: 'brand',
                  onClick: () => navigate('/inmuebles'),
                },
                {
                  key: 'inversiones',
                  label: 'Inversiones',
                  value: valorInversiones,
                  color: 'gold',
                  onClick: () => navigate('/inversiones'),
                },
                {
                  key: 'tesoreria',
                  label: 'Tesorería',
                  value: saldoTesoreria,
                  color: 'pos',
                  onClick: () => navigate('/tesoreria'),
                },
              ]}
            />
          </div>

          {/* Pulso 4 activos · § Z.9 · § AA.4 · T22.3 */}
          <div className={styles.secTitle}>Pulso de los 4 activos</div>
          <div className={styles.activosGrid}>
            {/* Inmuebles · § AA.4 Building2 */}
            <PulseAssetCard
              variant="inmuebles"
              label="Inmuebles"
              value={valorInmuebles}
              delta={null}
              extraLabel="Rdto neto mes"
              extraValue={null}
              // TODO: conectar con servicio inmuebles para mostrar rdto neto mensual real
              onClick={() => navigate('/inmuebles')}
            />

            {/* Inversiones · § AA.4 TrendingUp */}
            <PulseAssetCard
              variant="inversiones"
              label="Inversiones"
              value={valorInversiones}
              delta={null}
              extraLabel="Rentab. YTD"
              extraValue={null}
              // TODO: conectar con servicio inversiones para mostrar rentabilidad YTD real
              onClick={() => navigate('/inversiones')}
            />

            {/* Tesorería · § AA.4 Wallet */}
            <PulseAssetCard
              variant="tesoreria"
              label="Tesorería"
              value={saldoTesoreria}
              delta={null}
              extraLabel="Meses colchón"
              extraValue={null}
              // TODO: conectar con tesorería/gastoMedio para mostrar meses colchón reales
              onClick={() => navigate('/tesoreria')}
            />

            {/* Financiación · § AA.4 Landmark */}
            <PulseAssetCard
              variant="financiacion"
              label="Financiación"
              value={-deudaViva}
              valueNeg
              valueShowSign
              delta={null}
              extraLabel="Cuota mes"
              extraValue={cuotaMensualPrestamos > 0 ? `−${fmtImporte(cuotaMensualPrestamos)}` : null}
              extraNeg={cuotaMensualPrestamos > 0}
              onClick={() => navigate('/financiacion')}
            />
          </div>

          {/* Pulso del mes · § Z.10 · T22.4 */}
          <PulsoDelMes
            ingresos={pulsoMes.ingresos}
            gastos={pulsoMes.gastos}
            cashflow={pulsoMes.cashflow}
            saldoFin={pulsoMes.saldoFin}
            mesNombre={mesNombre}
            año={añoActual}
          />

          {/* Two-cols · Piden tu atención + Mi Plan brújula · § Z.11 · T22.5/T22.6 */}
          <div className={styles.twoColsGrid}>
            {/* Piden tu atención · § Z.11 · § AA.6 · T22.5 */}
            <AttentionList
              alertas={alertas}
              onVerTodas={() => navigate('/tesoreria')}
              onAlertaClick={(a) => navigate(a.href)}
            />

            {/* Mi Plan brújula · § Z.11 · T22.6 */}
            <MiPlanCompass
              pctCobertura={planMetrics.pctCobertura}
              añoLibertad={planMetrics.añoLibertad}
              mesesColchon={planMetrics.mesesColchon}
              rentaPasiva={planMetrics.rentaPasiva}
              gastoVida={planMetrics.gastoVida}
              inmueblesActivos={planMetrics.inmueblesActivos}
              metaInmuebles={planMetrics.metaInmuebles}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PanelPage;
