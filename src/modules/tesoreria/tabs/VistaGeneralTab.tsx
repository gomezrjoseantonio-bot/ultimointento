import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  CardV5,
  MoneyValue,
  EmptyState,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import {
  BankAccountCard,
  BankAccountAddCard,
} from '../components/BankAccountCard';
import CashflowChart, { MonthFlow } from '../components/CashflowChart';
import MonthGrid, { MonthCard } from '../components/MonthGrid';
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
  const { accounts, movements } = useOutletContext<TesoreriaContext>();

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
  // Para meses cerrados/en curso · saldoReal = saldoActual + acumulado de
  // movimientos reales hasta ese mes (lo que ya se ejecutó).
  // Para meses futuros · saldoPrevisto = saldoReal del último mes cerrado +
  // acumulado de proyección estructural (Mi Plan budget).
  const months: MonthFlow[] = useMemo(() => {
    const realMonths: number[] = [];
    let acumReal = 0;
    for (let i = 0; i <= currentMonthIdx; i++) {
      const flow = movByYearMonth.get(`${currentYear}-${i}`);
      const flujoMes = (flow?.entradas ?? 0) + (flow?.salidas ?? 0);
      acumReal += flujoMes;
      realMonths[i] = totalSaldo + acumReal - (movByYearMonth.get(`${currentYear}-${currentMonthIdx}`)?.entradas ?? 0) - (movByYearMonth.get(`${currentYear}-${currentMonthIdx}`)?.salidas ?? 0);
    }
    // Saldo de cierre del mes actual = totalSaldo (cuentas reales hoy).
    const saldoCierreActual = totalSaldo;

    let acumProyeccion = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const isPast = i < currentMonthIdx;
      const isCurrent = i === currentMonthIdx;

      let saldoReal: number | undefined;
      let saldoPrevisto: number;

      if (isPast || isCurrent) {
        // Acumulado de movimientos reales · derivado.
        const flow = movByYearMonth.get(`${currentYear}-${i}`);
        const flujoMes = (flow?.entradas ?? 0) + (flow?.salidas ?? 0);
        acumProyeccion += flujoMes;
        saldoReal = totalSaldo - (acumReal - acumProyeccion);
        saldoPrevisto = saldoReal;
      } else {
        // Mes futuro · usa proyección Mi Plan si está disponible.
        const flujoProyectado = budgetProjection?.months[i]?.flujoNeto ?? 0;
        acumProyeccion += flujoProyectado;
        saldoPrevisto = saldoCierreActual + (acumProyeccion - (acumReal));
      }

      return {
        month: i + 1,
        label: MONTH_LABELS[i],
        saldoReal,
        saldoPrevisto,
        isCurrent,
      };
    });
  }, [movByYearMonth, currentYear, currentMonthIdx, totalSaldo, budgetProjection]);

  const monthCards: MonthCard[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const realFlow = movByYearMonth.get(`${currentYear}-${i}`);
      const projectionFlow = budgetProjection?.months[i];
      const status: MonthCard['status'] =
        i < currentMonthIdx ? 'past' : i === currentMonthIdx ? 'current' : 'future';
      // Pasados/actuales · datos reales · futuros · proyección Mi Plan.
      const entradas =
        status === 'future'
          ? projectionFlow?.entradas ?? 0
          : realFlow?.entradas ?? 0;
      const salidas =
        status === 'future'
          ? projectionFlow?.salidas ?? 0
          : realFlow?.salidas ?? 0;
      return {
        key: `${currentYear}-${i}`,
        month: i + 1,
        name: MONTH_NAMES[i],
        status,
        saldo: months[i]?.saldoPrevisto ?? totalSaldo,
        entradas,
        salidas,
      };
    });
  }, [movByYearMonth, currentYear, currentMonthIdx, months, totalSaldo, budgetProjection]);

  const entradasAnuales = monthCards.reduce((sum, m) => sum + m.entradas, 0);
  // `salidas` se acumula como suma de `m.amount` cuando el importe es negativo
  // · ya viene con signo · `entradas + salidas` da el balance neto correcto.
  const salidasAnuales = monthCards.reduce((sum, m) => sum + m.salidas, 0);
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
            <MoneyValue value={totalSaldo} decimals={0} tone="ink" />
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
              <MoneyValue value={entradasMes} decimals={0} showSign tone="pos" />
            </div>
            <div className={styles.kpiHint}>
              {MONTH_NAMES[currentMonthIdx]} {currentYear}
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLab}>Salidas · este mes</div>
            <div className={`${styles.kpiVal} ${styles.neg}`}>
              <MoneyValue value={salidasMes} decimals={0} showSign tone="neg" />
            </div>
            <div className={styles.kpiHint}>
              {MONTH_NAMES[currentMonthIdx]} {currentYear}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cuentasHd}>
        <span>Mis cuentas · {accounts.length}</span>
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
          {accounts.map((acc) => (
            <BankAccountCard
              key={acc.id}
              account={acc}
              pendingCount={pendientesPorCuenta.get(acc.id ?? -1) ?? 0}
              delta30d={null}
              onClick={handleAccountClick}
              onEdit={(id) => showToastV5(`Editar cuenta · #${id}`)}
            />
          ))}
          <BankAccountAddCard
            onClick={() => showToastV5('Añadir cuenta · busca entre 180+ bancos')}
          />
        </div>
      )}

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

      <CardV5 className={styles.card}>
        <div className={styles.cardHd}>
          <div>
            <div className={styles.cardTitle}>Calendario anual · {currentYear}</div>
            <div className={styles.cardSub}>12 meses · clic para ver desglose</div>
          </div>
        </div>
        <MonthGrid
          months={monthCards}
          onClick={(m) =>
            showToastV5(`Abrir desglose · ${m.name} ${currentYear}`)
          }
        />
      </CardV5>
    </>
  );
};

export default VistaGeneralTab;
