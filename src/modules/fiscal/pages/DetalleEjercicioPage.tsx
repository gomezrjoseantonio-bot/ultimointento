import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CardV5, Icons, MoneyValue, showToastV5 } from '../../../design-system/v5';
import type { FiscalOutletContext } from '../FiscalContext';
import {
  cuotaResultado,
  ESTADOS_VIVOS,
  formatDateLong,
  labelEstado,
} from '../helpers';
import styles from './DetalleEjercicioPage.module.css';

type Tab = 'modelo100' | 'versiones' | 'deudas' | 'documentos';

const estadoChipClass = (estado: string): string => {
  if (estado === 'declarado') return styles.declarado;
  if (estado === 'cerrado') return styles.cerrado;
  if (estado === 'prescrito') return styles.prescrito;
  if (ESTADOS_VIVOS.includes(estado as never)) return styles.curso;
  return styles.pendiente;
};

const DetalleEjercicioPage: React.FC = () => {
  const navigate = useNavigate();
  const { anio } = useParams<{ anio: string }>();
  const { ejercicios } = useOutletContext<FiscalOutletContext>();
  const [tab, setTab] = useState<Tab>('modelo100');

  const ej = useMemo(
    () => ejercicios.find((e) => String(e.ejercicio) === String(anio)),
    [ejercicios, anio],
  );

  if (!ej) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.notFound}>
            Ejercicio {anio} no encontrado.{' '}
            <span
              role="button"
              tabIndex={0}
              style={{ color: 'var(--atlas-v5-gold-ink)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => navigate('/fiscal/ejercicios')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate('/fiscal/ejercicios');
              }}
            >
              Volver a ejercicios
            </span>
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  const cuota = cuotaResultado(ej);
  const aeat = ej.declaracionAeat as
    | {
        rendimientosTrabajoNeto?: number;
        rendimientosCapitalInmobiliarioNeto?: number;
        rendimientosActividadesEconomicasNeto?: number;
        baseLiquidableGeneral?: number;
        baseLiquidableAhorro?: number;
        cuotaLiquidaTotal?: number;
        retencionesIngresosCuenta?: number;
      }
    | undefined;
  const atlas = ej.calculoAtlas as typeof aeat;

  const fuente = aeat ?? atlas ?? {};

  return (
    <>
      <div className={styles.breadcrumb}>
        <span
          className={styles.backBtn}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/fiscal/ejercicios')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate('/fiscal/ejercicios');
          }}
        >
          <Icons.ArrowLeft size={12} strokeWidth={2} />
          Volver
        </span>
        <span
          role="link"
          tabIndex={0}
          onClick={() => navigate('/fiscal')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate('/fiscal');
          }}
        >
          Fiscal
        </span>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        <span
          role="link"
          tabIndex={0}
          onClick={() => navigate('/fiscal/ejercicios')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate('/fiscal/ejercicios');
          }}
        >
          Ejercicios
        </span>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        <span className={styles.current}>Ejercicio {ej.ejercicio}</span>
      </div>

      <div className={styles.heroRow}>
        <div>
          <div className={styles.title}>
            Ejercicio {ej.ejercicio}
            <span className={`${styles.estadoChip} ${estadoChipClass(ej.estado)}`}>
              {labelEstado(ej.estado)}
            </span>
          </div>
          <div className={styles.subText}>
            actualizado {formatDateLong(ej.updatedAt)}
            {ej.declaradoAt && (
              <>
                {' · '}declarado <strong>{formatDateLong(ej.declaradoAt)}</strong>
              </>
            )}
          </div>
        </div>
        <div className={styles.tbActions}>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={() => showToastV5('Aplicar paralela AEAT · sub-tarea 3f-B (próximo PR)')}
          >
            <Icons.Refresh size={14} strokeWidth={1.8} />
            Aplicar paralela
          </button>
          <button
            type="button"
            className={`${styles.tbBtn} ${styles.gold}`}
            onClick={() => showToastV5('Cerrar/declarar ejercicio · sub-tarea follow-up')}
          >
            <Icons.Check size={14} strokeWidth={1.8} />
            Cerrar ejercicio
          </button>
        </div>
      </div>

      <div className={styles.kpiStrip}>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Resultado IRPF</div>
          <div className={`${styles.kpiVal} ${cuota > 0 ? styles.pos : cuota < 0 ? styles.neg : ''}`}>
            <MoneyValue value={cuota} decimals={2} showSign tone="auto" />
          </div>
          <div className={styles.kpiSub}>
            {cuota > 0 ? 'a devolver' : cuota < 0 ? 'a pagar' : 'sin resultado'}
          </div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Cuota líquida</div>
          <div className={styles.kpiVal}>
            <MoneyValue value={fuente.cuotaLiquidaTotal ?? 0} decimals={2} tone="ink" />
          </div>
          <div className={styles.kpiSub}>antes de retenciones</div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Retenciones</div>
          <div className={styles.kpiVal}>
            <MoneyValue value={fuente.retencionesIngresosCuenta ?? 0} decimals={2} tone="ink" />
          </div>
          <div className={styles.kpiSub}>aplicadas</div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Prescribe</div>
          <div className={styles.kpiVal}>
            {ej.declaradoAt
              ? new Date(ej.declaradoAt).getFullYear() + 4
              : ej.cerradoAt
                ? new Date(ej.cerradoAt).getFullYear() + 4
                : '—'}
          </div>
          <div className={styles.kpiSub}>4 años desde declaración</div>
        </div>
      </div>

      <div className={styles.tabs} role="group" aria-label="Tabs detalle ejercicio">
        {(
          [
            { key: 'modelo100', label: 'Modelo 100', count: aeat ? 'casillas' : 'sin datos' },
            { key: 'versiones', label: 'Versiones', count: 'v1' },
            { key: 'deudas', label: 'Deudas y pagos', count: '0' },
            { key: 'documentos', label: 'Documentos', count: '0' },
          ] as { key: Tab; label: string; count?: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? styles.active : ''}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count && <span className={styles.tabBadge}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'modelo100' && (
        <>
          <div className={styles.section}>
            <div className={styles.sectionHd}>
              <div>
                <div className={styles.sectionTitle}>Rendimientos netos</div>
                <div className={styles.sectionSub}>desglose por origen · base imponible</div>
              </div>
            </div>
            <table className={styles.detailTable}>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th className={styles.right}>Importe</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rendimiento neto del trabajo</td>
                  <td className={styles.right}>
                    <MoneyValue
                      value={fuente.rendimientosTrabajoNeto ?? 0}
                      decimals={2}
                      tone="ink"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Rendimiento capital inmobiliario neto</td>
                  <td className={styles.right}>
                    <MoneyValue
                      value={fuente.rendimientosCapitalInmobiliarioNeto ?? 0}
                      decimals={2}
                      tone="ink"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Rendimiento actividades económicas neto</td>
                  <td className={styles.right}>
                    <MoneyValue
                      value={fuente.rendimientosActividadesEconomicasNeto ?? 0}
                      decimals={2}
                      tone="ink"
                    />
                  </td>
                </tr>
                <tr className={styles.totalRow}>
                  <td>Total rendimientos netos</td>
                  <td className={styles.right}>
                    <MoneyValue
                      value={
                        (fuente.rendimientosTrabajoNeto ?? 0) +
                        (fuente.rendimientosCapitalInmobiliarioNeto ?? 0) +
                        (fuente.rendimientosActividadesEconomicasNeto ?? 0)
                      }
                      decimals={2}
                      tone="ink"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHd}>
              <div>
                <div className={styles.sectionTitle}>Bases liquidables</div>
                <div className={styles.sectionSub}>tras reducciones</div>
              </div>
            </div>
            <table className={styles.detailTable}>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th className={styles.right}>Importe</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Base liquidable general</td>
                  <td className={styles.right}>
                    <MoneyValue
                      value={fuente.baseLiquidableGeneral ?? 0}
                      decimals={2}
                      tone="ink"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Base liquidable del ahorro</td>
                  <td className={styles.right}>
                    <MoneyValue
                      value={fuente.baseLiquidableAhorro ?? 0}
                      decimals={2}
                      tone="ink"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'versiones' && (
        <CardV5>
          <CardV5.Body>
            <div className={styles.empty}>
              Versiones · v1 actual · sin paralelas aplicadas. El wizard de aplicación de paralelas
              AEAT llega en sub-tarea 3f-B (siguiente PR).
            </div>
          </CardV5.Body>
        </CardV5>
      )}

      {tab === 'deudas' && (
        <CardV5>
          <CardV5.Body>
            <div className={styles.empty}>
              Sin deudas pendientes para este ejercicio.
            </div>
          </CardV5.Body>
        </CardV5>
      )}

      {tab === 'documentos' && (
        <CardV5>
          <CardV5.Body>
            <div className={styles.empty}>
              Documentos asociados · pendiente de integración con bandeja Inbox · sub-tarea
              follow-up.
            </div>
          </CardV5.Body>
        </CardV5>
      )}
    </>
  );
};

export default DetalleEjercicioPage;
