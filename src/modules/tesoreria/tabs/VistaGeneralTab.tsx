import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  CardV5,
  EmptyState,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import {
  BankAccountCard,
  BankAccountAddCard,
} from '../components/BankAccountCard';
import CashflowChart, { MonthFlow } from '../components/CashflowChart';
import CalendarioMes12 from '../../../components/treasury/CalendarioMes12';
import MesDetalleDrawer from '../../../components/treasury/MesDetalleDrawer';
import MovimientoDrawer, {
  type MovimientoDrawerData,
} from '../../../components/treasury/MovimientoDrawer';
import PendientesDelDia from '../../../components/treasury/PendientesDelDia';
import { invalidateCachedStores } from '../../../services/indexedDbCacheService';
import type { TesoreriaContext } from '../TesoreriaPage';
import {
  computeBudgetProjection12mAsync,
  type BudgetProjection,
} from '../../mi-plan/services/budgetProjection';
import styles from './VistaGeneralTab.module.css';

const MONTH_LABELS = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const VistaGeneralTab: React.FC = () => {
  const navigate = useNavigate();
  const { accounts, movements, treasuryEvents } = useOutletContext<TesoreriaContext>();

  // T31 · drawer detalle mes (clic en mes-card del calendario)
  const [drawerMes, setDrawerMes] = useState<{ year: number; monthIndex0: number } | null>(null);
  // T31 · drawer detalle movimiento (clic en pend-card o evento del mes)
  const [drawerMovId, setDrawerMovId] = useState<number | string | null>(null);
  // T31 · paginación carrusel cuentas (5 visibles · mockup v8)
  const [cuentasPage, setCuentasPage] = useState(0);

  const totalSaldo = useMemo(
    () =>
      accounts.reduce(
        (sum, a) => sum + (a.balance ?? a.openingBalance ?? 0),
        0,
      ),
    [accounts],
  );

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth();

  const movByYearMonth = useMemo(() => {
    const map = new Map<string, { entradas: number; salidas: number }>();
    movements.forEach((m) => {
      const date = m.date ? new Date(m.date) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      if (date.getFullYear() !== currentYear) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const cur = map.get(key) ?? { entradas: 0, salidas: 0 };
      if (m.amount > 0) cur.entradas += m.amount;
      else cur.salidas += m.amount;
      map.set(key, cur);
    });
    return map;
  }, [movements, currentYear]);

  const entradasMes = movByYearMonth.get(`${currentYear}-${currentMonthIdx}`)?.entradas ?? 0;
  const salidasMes = movByYearMonth.get(`${currentYear}-${currentMonthIdx}`)?.salidas ?? 0;

  // T20-01 · Proyección presupuesto desde Mi Plan (cierra TODO formal).
  // Combina nominas + autonomos + compromisosRecurrentes + contracts para
  // proyección estructural · sustituye proyección lineal simple.
  const [budgetProjection, setBudgetProjection] = useState<BudgetProjection | null>(null);
  useEffect(() => {
    let cancelled = false;
    computeBudgetProjection12mAsync(currentYear).then((p) => {
      if (!cancelled) setBudgetProjection(p);
    });
    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  // Construye la serie 12 meses con saldo proyectado.
  // Estrategia · `totalSaldo` es el saldo CIERRE del mes actual (cuentas hoy).
  //   - Meses pasados · saldoReal = totalSaldo − flujo_real(actual..i+1).
  //     Recorremos hacia atrás restando los flujos de los meses posteriores.
  //   - Mes actual · saldoReal = totalSaldo (cierre del mes actual).
  //   - Meses futuros · saldoPrevisto = totalSaldo + acumulado(proyección Mi Plan).
  const months: MonthFlow[] = useMemo(() => {
    // 1 · Calcular saldo de cada mes pasado restando flujos posteriores.
    const saldoReales: number[] = new Array(12);
    let saldoIter = totalSaldo;
    saldoReales[currentMonthIdx] = saldoIter;
    for (let i = currentMonthIdx - 1; i >= 0; i--) {
      // El saldo a fin del mes i es el saldo a fin de mes (i+1) menos el
      // flujo real de (i+1).
      const flowIPlus1 = movByYearMonth.get(`${currentYear}-${i + 1}`);
      const flujoIPlus1 = (flowIPlus1?.entradas ?? 0) + (flowIPlus1?.salidas ?? 0);
      saldoIter = saldoIter - flujoIPlus1;
      saldoReales[i] = saldoIter;
    }

    // 2 · Para meses futuros · saldo = totalSaldo + acumulado proyección.
    let acumProyeccion = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const isPast = i < currentMonthIdx;
      const isCurrent = i === currentMonthIdx;

      if (isPast || isCurrent) {
        const saldoReal = saldoReales[i];
        return {
          month: i + 1,
          label: MONTH_LABELS[i],
          saldoReal,
          saldoPrevisto: saldoReal,
          isCurrent,
        };
      }

      // Mes futuro · usa proyección Mi Plan si está disponible.
      const flujoProyectado = budgetProjection?.months[i]?.flujoNeto ?? 0;
      acumProyeccion += flujoProyectado;
      return {
        month: i + 1,
        label: MONTH_LABELS[i],
        saldoReal: undefined,
        saldoPrevisto: totalSaldo + acumProyeccion,
        isCurrent,
      };
    });
  }, [movByYearMonth, currentYear, currentMonthIdx, totalSaldo, budgetProjection]);

  // Totales anuales del chart de cashflow · meses pasados/actual = real
  // (movements) · meses futuros = proyección Mi Plan (budgetProjection). Esto
  // mantiene "Entradas previstas" / "Salidas previstas" coherentes con la
  // curva proyectada del chart.
  const { entradasAnuales, salidasAnuales } = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    for (let i = 0; i < 12; i++) {
      const isFuture = i > currentMonthIdx;
      if (isFuture) {
        const proj = budgetProjection?.months[i];
        entradas += proj?.entradas ?? 0;
        salidas += proj?.salidas ?? 0;
      } else {
        const real = movByYearMonth.get(`${currentYear}-${i}`);
        entradas += real?.entradas ?? 0;
        salidas += real?.salidas ?? 0;
      }
    }
    return { entradasAnuales: entradas, salidasAnuales: salidas };
  }, [movByYearMonth, budgetProjection, currentMonthIdx, currentYear]);
  const saldoInicio = totalSaldo - (entradasAnuales + salidasAnuales);

  const pendientesPorCuenta = useMemo(() => {
    const map = new Map<number, number>();
    movements.forEach((m) => {
      if (
        m.estado_conciliacion === 'sin_conciliar' ||
        m.unifiedStatus === 'no_planificado'
      ) {
        const cur = map.get(m.accountId) ?? 0;
        map.set(m.accountId, cur + 1);
      }
    });
    return map;
  }, [movements]);

  const handleAccountClick = (id: number) => {
    navigate(`/tesoreria/movimientos?cuenta=${id}`);
  };

  return (
    <>
      <div className={styles.heroRow}>
        <div className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroTopLeft}>
              <span className={styles.scLabel}>Saldo consolidado</span>
              {totalSaldo > 0 && (
                <span className={`${styles.delta} ${styles.pos}`}>
                  ▲ saldo agregado
                </span>
              )}
            </div>
          </div>
          <div className={styles.heroBig}>
            {/* Render directo · NO usar MoneyValue aquí · su size="inline"
                default forzaba 13px sobre el wrapper de 50px (mockup v8). */}
            {totalSaldo.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
          </div>
          <div className={styles.heroSub}>
            <strong>{accounts.length}</strong> cuentas activas ·{' '}
            <strong>
              {pendientesPorCuenta.size > 0
                ? `${Array.from(pendientesPorCuenta.values()).reduce((a, b) => a + b, 0)}`
                : '0'}
            </strong>{' '}
            movimientos pendientes de conciliar
          </div>
        </div>
        <div className={styles.kpiStack}>
          <div className={styles.kpi}>
            <div className={styles.kpiLab}>Entradas · este mes</div>
            <div className={`${styles.kpiVal} ${styles.pos}`}>
              {entradasMes >= 0 ? '+' : ''}
              {entradasMes.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
            </div>
            <div className={styles.kpiHint}>
              {MONTH_NAMES[currentMonthIdx]} {currentYear}
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLab}>Salidas · este mes</div>
            <div className={`${styles.kpiVal} ${styles.neg}`}>
              {salidasMes <= 0 ? '−' : '+'}
              {Math.abs(salidasMes).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
            </div>
            <div className={styles.kpiHint}>
              {MONTH_NAMES[currentMonthIdx]} {currentYear}
            </div>
          </div>
        </div>
      </div>

      {/* Carrusel cuentas · 5 visibles por página + flechas (mockup v8) */}
      {(() => {
        const PAGE_SIZE = 5;
        const totalPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
        const safePage = Math.min(cuentasPage, totalPages - 1);
        const startIdx = safePage * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, accounts.length);
        const pageAccounts = accounts.slice(startIdx, endIdx);
        const isLastPage = safePage >= totalPages - 1;
        // Reservamos slots vacíos para mantener 5 columnas exactas
        const emptySlots = Math.max(
          0,
          PAGE_SIZE - pageAccounts.length - (isLastPage ? 1 : 0),
        );
        return (
          <>
            <div className={styles.cuentasHd}>
              <span>
                Mis cuentas · {accounts.length === 0
                  ? 0
                  : `${startIdx + 1}-${endIdx} de ${accounts.length}`}
              </span>
              {accounts.length > 0 && (
                <div className={styles.cuentasArrows}>
                  <button
                    type="button"
                    className={styles.cuentasArr}
                    onClick={() => setCuentasPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    aria-label="Cuentas anteriores"
                  >
                    <Icons.ChevronLeft size={14} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    className={styles.cuentasArr}
                    onClick={() =>
                      setCuentasPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={safePage >= totalPages - 1}
                    aria-label="Cuentas siguientes"
                  >
                    <Icons.ChevronRight size={14} strokeWidth={1.8} />
                  </button>
                </div>
              )}
            </div>
            {accounts.length === 0 ? (
              <EmptyState
                icon={<Icons.Tesoreria size={20} />}
                title="No hay cuentas registradas"
                sub="Añade tu primera cuenta para empezar a ver el flujo de tesorería."
                ctaLabel="+ añadir cuenta"
                onCtaClick={() => navigate('/tesoreria/importar')}
              />
            ) : (
              <div className={styles.cuentasGrid}>
                {pageAccounts.map((acc) => (
                  <BankAccountCard
                    key={acc.id}
                    account={acc}
                    pendingCount={pendientesPorCuenta.get(acc.id ?? -1) ?? 0}
                    delta30d={null}
                    onClick={handleAccountClick}
                    onEdit={(id) => showToastV5(`Editar cuenta · #${id}`)}
                  />
                ))}
                {isLastPage && (
                  <BankAccountAddCard
                    onClick={() =>
                      showToastV5('Añadir cuenta · busca entre 180+ bancos')
                    }
                  />
                )}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`} className={styles.cuentaEmptySlot} />
                ))}
              </div>
            )}
          </>
        );
      })()}

      <CardV5 className={styles.card}>
        <div className={styles.cardHd}>
          <div>
            <div className={styles.cardTitle}>Flujo de caja anual · {currentYear}</div>
            <div className={styles.cardSub}>
              proyección 12 meses · línea sólida = real · discontinua = previsto
            </div>
          </div>
        </div>
        <CashflowChart
          year={currentYear}
          months={months}
          saldoInicio={saldoInicio}
          entradasAnuales={entradasAnuales}
          salidasAnuales={salidasAnuales}
          colchonEmergencia={null}
        />
      </CardV5>

      {/* Layout 2 columnas · calendario 4×3 + pendientes del día (mockup v8) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: 14,
          marginTop: 14,
        }}
        className={styles.calendarRow}
      >
        <CardV5 className={styles.card}>
          <CalendarioMes12
            events={treasuryEvents}
            movements={movements as unknown as { date: string; amount: number }[]}
            onMonthClick={(year, monthIndex0) => setDrawerMes({ year, monthIndex0 })}
          />
        </CardV5>

        <CardV5 className={styles.card}>
          <PendientesDelDia
            events={treasuryEvents.map((e: any) => ({
              id: e.id,
              predictedDate: e.predictedDate,
              type: e.type,
              amount: e.amount,
              description: e.description,
              status: e.status,
              accountId: e.accountId,
            }))}
            accounts={accounts}
            onPuntear={async (id) => {
              try {
                const dbId = typeof id === 'number' ? id : Number(id);
                if (Number.isFinite(dbId)) {
                  const { confirmTreasuryEvent } = await import(
                    '../../../services/treasuryConfirmationService'
                  );
                  await confirmTreasuryEvent(dbId);
                  invalidateCachedStores(['treasuryEvents', 'movements']);
                  showToastV5('Movimiento confirmado', 'success');
                }
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[Pendientes] confirmar falló', err);
                showToastV5('No se pudo confirmar · ver consola', 'error');
              }
            }}
            onClick={(id) => setDrawerMovId(id)}
            onIrAConciliacion={() => navigate('/tesoreria/movimientos')}
          />
        </CardV5>
      </div>

      <MesDetalleDrawer
        open={drawerMes !== null}
        year={drawerMes?.year ?? null}
        monthIndex0={drawerMes?.monthIndex0 ?? null}
        events={treasuryEvents}
        accounts={accounts}
        onClose={() => setDrawerMes(null)}
      />

      <MovimientoDrawer
        open={drawerMovId !== null}
        data={(() => {
          if (drawerMovId == null) return null;
          const ev = treasuryEvents.find(
            (e: any) => String(e.id) === String(drawerMovId),
          );
          if (!ev) return null;
          const acc = accounts.find((a) => a.id === (ev as any).accountId);
          const accountAlias = acc?.alias || acc?.banco?.name || acc?.name;
          const drawerData: MovimientoDrawerData = {
            id: ev.id,
            description: (ev as any).description,
            predictedDate: (ev as any).predictedDate,
            type: (ev as any).type,
            amount: (ev as any).amount,
            status: (ev as any).status,
            accountAlias,
            inmuebleAlias: (ev as any).inmuebleAlias,
            contratoAlias: (ev as any).contratoAlias,
            categoryLabel: (ev as any).categoryLabel,
            origenTexto:
              (ev as any).sourceType === 'contrato'
                ? 'Generado automáticamente desde el contrato activo · regla recurrente.'
                : (ev as any).sourceType === 'nomina'
                  ? 'Generado automáticamente desde la nómina activa.'
                  : (ev as any).sourceType === 'hipoteca' ||
                      (ev as any).sourceType === 'prestamo'
                    ? 'Generado desde el cuadro de amortización del préstamo.'
                    : (ev as any).sourceType === 'gasto_recurrente' ||
                        (ev as any).sourceType === 'opex_rule'
                      ? 'Generado desde un compromiso recurrente.'
                      : (ev as any).sourceType === 'manual'
                        ? 'Movimiento previsto creado manualmente.'
                        : undefined,
            sourceType: (ev as any).sourceType,
          };
          return drawerData;
        })()}
        onClose={() => setDrawerMovId(null)}
        onConfirmar={async (id) => {
          try {
            const dbId = typeof id === 'number' ? id : Number(id);
            if (Number.isFinite(dbId)) {
              const { confirmTreasuryEvent } = await import(
                '../../../services/treasuryConfirmationService'
              );
              await confirmTreasuryEvent(dbId);
              invalidateCachedStores(['treasuryEvents', 'movements']);
              showToastV5('Pago confirmado', 'success');
            }
            setDrawerMovId(null);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[Movimiento] confirmar falló', err);
            showToastV5('No se pudo confirmar · ver consola', 'error');
          }
        }}
        onEditar={() => {
          showToastV5('Edición de previsiones · próximamente', 'info');
        }}
      />
    </>
  );
};

export default VistaGeneralTab;
