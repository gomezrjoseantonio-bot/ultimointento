// Borrador IRPF · ruta `/fiscal/borrador/:anio`. Vista de presentación
// previa a la declaración · KPIs principales + casillas del Modelo 100
// con el cálculo de Atlas.
//
// Mockup oficial · `docs/audit-inputs/atlas-fiscal.html` · sección
// `page-irpf2025`. Consume `calculoAtlas` y `declaracionAeat` (si existe)
// del ejercicio.

import React, { useMemo } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CardV5, Icons, MoneyValue, showToastV5 } from '../../../design-system/v5';
import type { FiscalOutletContext } from '../FiscalContext';
import { cuotaResultado } from '../helpers';
import styles from './BorradorIRPFPage.module.css';

interface CasillaRow {
  casilla: string;
  concepto: string;
  importe: number;
  subtotal?: boolean;
}

const BorradorIRPFPage: React.FC = () => {
  const navigate = useNavigate();
  const { anio } = useParams<{ anio: string }>();
  const { ejercicios } = useOutletContext<FiscalOutletContext>();

  const ejercicio = useMemo(
    () => ejercicios.find((e) => String(e.ejercicio) === String(anio)),
    [ejercicios, anio],
  );

  if (!ejercicio) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.notFound}>
            Ejercicio {anio} no encontrado.{' '}
            <button
              type="button"
              style={{
                color: 'var(--atlas-v5-gold-ink)',
                cursor: 'pointer',
                fontWeight: 600,
                background: 'none',
                border: 0,
                padding: 0,
                font: 'inherit',
              }}
              onClick={() => navigate('/fiscal/ejercicios')}
            >
              Volver a ejercicios
            </button>
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  const fuente = (ejercicio.declaracionAeat ?? ejercicio.calculoAtlas) as
    | {
        rendimientosTrabajoNeto?: number;
        rendimientosCapitalInmobiliarioNeto?: number;
        rendimientosActividadesEconomicasNeto?: number;
        rendimientosCapitalMobiliarioNeto?: number;
        gananciasPerdidasNeto?: number;
        baseImponibleGeneral?: number;
        baseImponibleAhorro?: number;
        baseLiquidableGeneral?: number;
        baseLiquidableAhorro?: number;
        cuotaIntegraEstatal?: number;
        cuotaIntegraAutonomica?: number;
        cuotaIntegraTotal?: number;
        cuotaLiquidaTotal?: number;
        deduccionesGenerales?: number;
        retencionesIngresosCuenta?: number;
        cuotaResultadoAutoliquidacion?: number;
      }
    | undefined;

  const cuota = cuotaResultado(ejercicio);
  const cuotaTone = cuota > 0 ? 'pos' : cuota < 0 ? 'neg' : 'auto';

  const rendimientos: CasillaRow[] = [
    {
      casilla: '0019',
      concepto: 'Rendimiento neto del trabajo',
      importe: fuente?.rendimientosTrabajoNeto ?? 0,
    },
    {
      casilla: '0085',
      concepto: 'Rendimiento neto capital inmobiliario',
      importe: fuente?.rendimientosCapitalInmobiliarioNeto ?? 0,
    },
    {
      casilla: '0140',
      concepto: 'Rendimiento neto actividades económicas',
      importe: fuente?.rendimientosActividadesEconomicasNeto ?? 0,
    },
    {
      casilla: '0044',
      concepto: 'Rendimiento neto capital mobiliario',
      importe: fuente?.rendimientosCapitalMobiliarioNeto ?? 0,
    },
  ];

  const totalRendimientos = rendimientos.reduce((s, r) => s + r.importe, 0);

  const bases: CasillaRow[] = [
    {
      casilla: '0435',
      concepto: 'Base imponible general',
      importe: fuente?.baseImponibleGeneral ?? totalRendimientos,
    },
    {
      casilla: '0460',
      concepto: 'Base imponible del ahorro',
      importe: fuente?.baseImponibleAhorro ?? 0,
    },
    {
      casilla: '0500',
      concepto: 'Base liquidable general',
      importe: fuente?.baseLiquidableGeneral ?? 0,
    },
    {
      casilla: '0510',
      concepto: 'Base liquidable del ahorro',
      importe: fuente?.baseLiquidableAhorro ?? 0,
    },
  ];

  const cuotas: CasillaRow[] = [
    {
      casilla: '0545',
      concepto: 'Cuota íntegra estatal',
      importe: fuente?.cuotaIntegraEstatal ?? 0,
    },
    {
      casilla: '0546',
      concepto: 'Cuota íntegra autonómica',
      importe: fuente?.cuotaIntegraAutonomica ?? 0,
    },
    {
      casilla: '0595',
      concepto: 'Cuota íntegra total',
      importe: fuente?.cuotaIntegraTotal ?? 0,
      subtotal: true,
    },
    {
      casilla: '0610',
      concepto: 'Deducciones',
      importe: fuente?.deduccionesGenerales ?? 0,
    },
    {
      casilla: '0620',
      concepto: 'Cuota líquida',
      importe: fuente?.cuotaLiquidaTotal ?? 0,
      subtotal: true,
    },
    {
      casilla: '0630',
      concepto: 'Retenciones e ingresos a cuenta',
      importe: fuente?.retencionesIngresosCuenta ?? 0,
    },
    {
      casilla: '0670',
      concepto: 'Cuota resultado autoliquidación',
      importe: cuota,
      subtotal: true,
    },
  ];

  const renderTable = (rows: CasillaRow[], totalLabel?: string, total?: number) => (
    <table className={styles.casillasTable}>
      <thead>
        <tr>
          <th>Casilla</th>
          <th>Concepto</th>
          <th className={styles.right}>Importe</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.casilla} className={r.subtotal ? styles.totalRow : ''}>
            <td className={styles.casilla}>{r.casilla}</td>
            <td>{r.concepto}</td>
            <td className={styles.right}>
              <MoneyValue value={r.importe} decimals={2} tone="ink" />
            </td>
          </tr>
        ))}
        {totalLabel != null && total != null && (
          <tr className={styles.totalRow}>
            <td className={styles.casilla}>—</td>
            <td>{totalLabel}</td>
            <td className={styles.right}>
              <MoneyValue value={total} decimals={2} tone="ink" />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  return (
    <>
      <div className={styles.breadcrumb}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`)}
        >
          <Icons.ArrowLeft size={12} strokeWidth={2} />
          Volver
        </button>
        <button type="button" className={styles.crumbBtn} onClick={() => navigate('/fiscal')}>
          Fiscal
        </button>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        <button
          type="button"
          className={styles.crumbBtn}
          onClick={() => navigate(`/fiscal/ejercicio/${ejercicio.ejercicio}`)}
        >
          Ejercicio {ejercicio.ejercicio}
        </button>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        <span className={styles.current} aria-current="page">
          Borrador IRPF
        </span>
      </div>

      <div className={styles.heroRow}>
        <div>
          <div className={styles.title}>
            Borrador IRPF {ejercicio.ejercicio}
            <span className={styles.versionBadge}>
              {ejercicio.declaracionAeat ? 'Declarado' : 'Borrador'}
            </span>
          </div>
          <div className={styles.subText}>
            cálculo {ejercicio.calculoAtlas ? 'Atlas' : 'pendiente'} ·{' '}
            {ejercicio.casillasRaw && Object.keys(ejercicio.casillasRaw).length > 0
              ? `${Object.keys(ejercicio.casillasRaw).length} casillas registradas`
              : 'sin casillas registradas'}
          </div>
        </div>
        <div className={styles.tbActions}>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={() => navigate(`/fiscal/importar/${ejercicio.ejercicio}`)}
          >
            <Icons.Upload size={14} strokeWidth={1.8} />
            Importar
          </button>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={() => showToastV5('Exportar PDF del borrador · sub-tarea follow-up')}
          >
            <Icons.Download size={14} strokeWidth={1.8} />
            Exportar PDF
          </button>
          <button
            type="button"
            className={`${styles.tbBtn} ${styles.gold}`}
            onClick={() => showToastV5('Marcar como declarado · sub-tarea follow-up')}
          >
            <Icons.Check size={14} strokeWidth={1.8} />
            Marcar declarado
          </button>
        </div>
      </div>

      <div className={`${styles.heroResult} ${cuotaTone === 'pos' ? styles.pos : cuotaTone === 'neg' ? styles.neg : ''}`}>
        <div>
          <div className={styles.lab}>Resultado autoliquidación</div>
          <div className={styles.heroVal}>
            <MoneyValue value={cuota} decimals={2} showSign tone="auto" />
          </div>
          <div className={styles.heroSub}>
            {cuota > 0 ? 'a devolver' : cuota < 0 ? 'a pagar' : 'sin resultado'} · casilla 0670
          </div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Cuota líquida</div>
          <div className={styles.val}>
            <MoneyValue value={fuente?.cuotaLiquidaTotal ?? 0} decimals={2} tone="ink" />
          </div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Retenciones</div>
          <div className={styles.val}>
            <MoneyValue value={fuente?.retencionesIngresosCuenta ?? 0} decimals={2} tone="ink" />
          </div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Tipo efectivo</div>
          <div className={styles.val}>
            {(() => {
              const base = (fuente?.baseImponibleGeneral ?? 0) + (fuente?.baseImponibleAhorro ?? 0);
              const cl = fuente?.cuotaLiquidaTotal ?? 0;
              if (base <= 0) return '—';
              return `${((cl / base) * 100).toFixed(1).replace('.', ',')}%`;
            })()}
          </div>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHd}>
          <div>
            <div className={styles.sectionTitle}>Rendimientos netos</div>
            <div className={styles.sectionSub}>desglose por origen · base imponible</div>
          </div>
        </div>
        {renderTable(rendimientos, 'Total rendimientos netos', totalRendimientos)}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHd}>
          <div>
            <div className={styles.sectionTitle}>Bases imponibles y liquidables</div>
            <div className={styles.sectionSub}>tras reducciones aplicables</div>
          </div>
        </div>
        {renderTable(bases)}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHd}>
          <div>
            <div className={styles.sectionTitle}>Cuotas y resultado</div>
            <div className={styles.sectionSub}>cuota íntegra · deducciones · retenciones</div>
          </div>
        </div>
        {renderTable(cuotas)}
        <div className={styles.note}>
          <strong>Borrador.</strong> El cálculo está basado en los datos detectados por Atlas en
          movimientos · contratos · préstamos y otros módulos. Antes de presentar, valida que
          coincide con el borrador oficial de la AEAT y aplica las correcciones necesarias.
        </div>
      </section>
    </>
  );
};

export default BorradorIRPFPage;
