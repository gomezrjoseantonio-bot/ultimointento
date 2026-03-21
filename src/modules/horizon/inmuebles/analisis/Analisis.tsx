import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, Building2, Wallet, PiggyBank, Euro, BarChart3, Landmark, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageLayout from '../../../../components/common/PageLayout';
import EmptyState from '../../../../components/common/EmptyState';
import { Property } from '../../../../services/db';
import type { Contract, Ingreso } from '../../../../services/db';
import type { Prestamo } from '../../../../types/prestamos';
import type { ValoracionHistorica } from '../../../../types/valoraciones';
import { getAnnualOpexForProperty } from '../../../../services/propertyExpenses';
import { buildPropertyAnalysisInputs } from '../../../../utils/propertyAnalysisUtils';
import { getCachedStoreRecords } from '../../../../services/indexedDbCacheService';

interface DashboardKpi {
  totalCost: number;
  currentValue: number;
  annualIncome: number;
  annualOpex: number;
  annualDebtService: number;
  annualNetCashflow: number;
  monthlyNetCashflow: number;
  pendingDebt: number;
  latentGain: number;
  totalEquity: number;
  annualGrossYield: number;
  annualNetYieldOverCost: number;
  annualNetYieldOverEquity: number;
  accumulatedCashflow: number;
  annualRevaluationRate: number;
  purchaseStartDate: string;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);

const formatPercent = (value: number): string =>
  `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;

const chartPalette = {
  grid: 'var(--hz-neutral-200, #D1D5DB)',
  axis: 'var(--hz-neutral-700, #374151)',
  portfolioValue: 'var(--hz-primary, #1D4ED8)',
  equityValue: 'var(--hz-success, #059669)',
};

const calculateYearsSince = (isoDate: string): number => {
  const from = new Date(isoDate);
  const now = new Date();
  const years = (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365);
  return Math.max(0.1, years);
};

const estimateRemainingYears = (loan: Prestamo): number => {
  if (!loan.fechaFirma || !loan.plazoMesesTotal) return 0;
  const signedAt = new Date(loan.fechaFirma);
  const elapsedMonths = Math.max(
    0,
    (new Date().getFullYear() - signedAt.getFullYear()) * 12 + (new Date().getMonth() - signedAt.getMonth())
  );
  return Math.max(0, (loan.plazoMesesTotal - elapsedMonths) / 12);
};

const Analisis: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [valoraciones, setValoraciones] = useState<ValoracionHistorica[]>([]);
  const [annualOpexMap, setAnnualOpexMap] = useState<Record<number, number>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allProperties, contractsData, ingresosData, prestamosData, valoracionesData] = await Promise.all([
        getCachedStoreRecords<Property>('properties'),
        getCachedStoreRecords<Contract>('contracts'),
        getCachedStoreRecords<Ingreso>('ingresos'),
        getCachedStoreRecords<Prestamo>('prestamos'),
        getCachedStoreRecords<ValoracionHistorica>('valoraciones_historicas'),
      ]);

      const activeProperties = allProperties.filter((p) => p.state === 'activo');
      setProperties(activeProperties);
      setContracts(contractsData);
      setIngresos(ingresosData);
      setPrestamos(prestamosData);
      setValoraciones(valoracionesData);

      const opexEntries = await Promise.all(
        activeProperties.map(async (property) => {
          if (!property.id) return [0, 0] as const;
          const annual = await getAnnualOpexForProperty(property.id);
          return [property.id, annual] as const;
        })
      );

      setAnnualOpexMap(
        opexEntries.reduce<Record<number, number>>((acc, [propertyId, annual]) => {
          if (propertyId > 0) acc[propertyId] = annual;
          return acc;
        }, {})
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const metrics = useMemo<DashboardKpi | null>(() => {
    if (!properties.length) return null;

    let totalCost = 0;
    let currentValue = 0;
    let annualIncome = 0;
    let annualOpex = 0;
    let annualDebtService = 0;
    let pendingDebt = 0;
    let weightedAnnualRevaluation = 0;
    let weightedCostForRevaluation = 0;
    let accumulatedCashflow = 0;
    let oldestPurchaseDate = properties[0].purchaseDate;

    for (const property of properties) {
      const propertyId = property.id;
      if (!propertyId) continue;

      const annualPropertyOpex = annualOpexMap[propertyId] || 0;
      const { inputs } = buildPropertyAnalysisInputs({
        property,
        contracts,
        ingresos,
        gastosOperativosOverride: annualPropertyOpex / 12,
        prestamos,
        valoraciones,
      });

      totalCost += inputs.precioTotalCompra;
      currentValue += inputs.valorActualActivo;
      annualIncome += inputs.ingresosMensuales * 12;
      annualOpex += annualPropertyOpex;
      annualDebtService += inputs.cuotaHipoteca * 12;
      pendingDebt += inputs.deudaPendiente;

      const years = calculateYearsSince(property.purchaseDate);
      const appreciationRate = inputs.precioTotalCompra > 0 && inputs.valorActualActivo > 0
        ? (Math.pow(inputs.valorActualActivo / inputs.precioTotalCompra, 1 / years) - 1)
        : 0;

      if (inputs.precioTotalCompra > 0 && Number.isFinite(appreciationRate)) {
        weightedAnnualRevaluation += appreciationRate * inputs.precioTotalCompra;
        weightedCostForRevaluation += inputs.precioTotalCompra;
      }

      accumulatedCashflow += (inputs.ingresosMensuales - inputs.gastosOperativos - inputs.cuotaHipoteca) * years * 12;
      if (new Date(property.purchaseDate).getTime() < new Date(oldestPurchaseDate).getTime()) {
        oldestPurchaseDate = property.purchaseDate;
      }
    }

    const annualNetCashflow = annualIncome - annualOpex - annualDebtService;
    const totalEquity = currentValue - pendingDebt;
    const annualRevaluationRate = weightedCostForRevaluation > 0 ? weightedAnnualRevaluation / weightedCostForRevaluation : 0.03;

    return {
      totalCost,
      currentValue,
      annualIncome,
      annualOpex,
      annualDebtService,
      annualNetCashflow,
      monthlyNetCashflow: annualNetCashflow / 12,
      pendingDebt,
      latentGain: currentValue - totalCost,
      totalEquity,
      annualGrossYield: totalCost > 0 ? (annualIncome / totalCost) * 100 : 0,
      annualNetYieldOverCost: totalCost > 0 ? (annualNetCashflow / totalCost) * 100 : 0,
      annualNetYieldOverEquity: totalEquity > 0 ? (annualNetCashflow / totalEquity) * 100 : 0,
      accumulatedCashflow,
      annualRevaluationRate,
      purchaseStartDate: oldestPurchaseDate,
    };
  }, [properties, contracts, ingresos, prestamos, valoraciones, annualOpexMap]);

  const chartData = useMemo(() => {
    if (!metrics) return [];

    const currentYear = new Date().getFullYear();
    const portfolioLoans = prestamos.filter((loan) => loan.ambito === 'INMUEBLE' && loan.activo);

    return Array.from({ length: 10 }, (_, index) => {
      const yearsAhead = index + 1;
      const year = currentYear + yearsAhead;

      const projectedValue = metrics.currentValue * Math.pow(1 + metrics.annualRevaluationRate, yearsAhead);
      const projectedDebt = portfolioLoans.reduce((sum, loan) => {
        const remainingYears = estimateRemainingYears(loan);
        if (remainingYears <= 0) return sum;
        const projectedOutstanding = Math.max(0, (loan.principalVivo || 0) * (1 - yearsAhead / remainingYears));
        return sum + projectedOutstanding;
      }, 0);

      const projectedEquity = projectedValue - projectedDebt;
      return {
        year: String(year),
        valor: projectedValue,
        equity: projectedEquity,
      };
    });
  }, [metrics, prestamos]);

  if (loading) {
    return (
      <PageLayout title="Evolución" subtitle="Visión agregada de la evolución de todos tus inmuebles desde la compra.">
        <div className="flex items-center justify-center min-h-96 text-neutral-600">Cargando evolución de cartera…</div>
      </PageLayout>
    );
  }

  if (!metrics || properties.length === 0) {
    return (
      <PageLayout title="Evolución" subtitle="Visión agregada de la evolución de todos tus inmuebles desde la compra.">
        <EmptyState
          icon={<BarChart3 className="h-12 w-12 text-gray-400" />}
          title="Sin inmuebles activos"
          description="Añade inmuebles en cartera para activar el dashboard de evolución."
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Evolución" subtitle="Dashboard visual con la evolución global de la cartera inmobiliaria.">
      <div className="space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Coste total', value: formatCurrency(metrics.totalCost), icon: Landmark },
            { label: 'Valor actual', value: formatCurrency(metrics.currentValue), icon: Building2 },
            { label: 'Cashflow neto / mes', value: formatCurrency(metrics.monthlyNetCashflow), icon: Wallet },
            { label: 'Plusvalía latente', value: formatCurrency(metrics.latentGain), icon: TrendingUp },
          ].map((item) => (
            <article key={item.label} className="rounded-xl border p-5 bg-white shadow-sm" style={{ borderColor: 'var(--hz-neutral-200)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm" style={{ color: 'var(--hz-neutral-700)' }}>{item.label}</p>
                <item.icon size={18} style={{ color: 'var(--hz-primary)' }} />
              </div>
              <p className="text-3xl font-semibold" style={{ color: 'var(--hz-primary)' }}>{item.value}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <article className="rounded-xl border p-5 bg-white" style={{ borderColor: 'var(--hz-neutral-200)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--hz-neutral-700)' }}>Rentabilidad bruta</p>
            <p className="text-4xl font-semibold text-atlas-blue">{formatPercent(metrics.annualGrossYield)} / año</p>
            <p className="text-sm mt-2" style={{ color: 'var(--hz-neutral-600)' }}>Ingresos anuales / Coste total</p>
          </article>

          <article className="rounded-xl border p-5 bg-white" style={{ borderColor: 'var(--hz-neutral-200)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--hz-neutral-700)' }}>Rentabilidad neta sobre activo</p>
            <p className="text-4xl font-semibold text-atlas-blue">{formatPercent(metrics.annualNetYieldOverCost)} / año</p>
            <p className="text-sm mt-2" style={{ color: 'var(--hz-neutral-600)' }}>Cashflow neto anual / Coste total</p>
          </article>

          <article className="rounded-xl border p-5 bg-white" style={{ borderColor: 'var(--hz-neutral-200)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--hz-neutral-700)' }}>Rentabilidad neta sobre equity</p>
            <p className="text-4xl font-semibold text-atlas-blue">{formatPercent(metrics.annualNetYieldOverEquity)} / año</p>
            <p className="text-sm mt-2" style={{ color: 'var(--hz-neutral-600)' }}>Cashflow neto anual / Capital propio</p>
          </article>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <article className="rounded-xl border p-5 bg-white" style={{ borderColor: 'var(--hz-neutral-200)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold" style={{ color: 'var(--hz-neutral-900)' }}>Proyección de cartera</h3>
              <PiggyBank size={18} style={{ color: 'var(--hz-primary)' }} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                  <XAxis dataKey="year" tick={{ fill: chartPalette.axis, fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fill: chartPalette.axis, fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="valor" stroke={chartPalette.portfolioValue} strokeWidth={3} dot={{ r: 4 }} name="Valor cartera" />
                  <Line type="monotone" dataKey="equity" stroke={chartPalette.equityValue} strokeWidth={3} dot={{ r: 4 }} name="Equity estimado" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm mt-3" style={{ color: 'var(--hz-neutral-600)' }}>
              Tasa media anual de revalorización: <strong>{formatPercent(metrics.annualRevaluationRate * 100)}</strong>
            </p>
          </article>

          <article className="rounded-xl border p-5 bg-white" style={{ borderColor: 'var(--hz-neutral-200)' }}>
            <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--hz-neutral-900)' }}>Resultado global y equity</h3>
            <div className="space-y-3 text-base">
              <div className="flex justify-between"><span style={{ color: 'var(--hz-neutral-700)' }}>Cashflow neto acumulado</span><strong>{formatCurrency(metrics.accumulatedCashflow)}</strong></div>
              <div className="flex justify-between"><span style={{ color: 'var(--hz-neutral-700)' }}>Beneficio total si vendes hoy</span><strong>{formatCurrency(metrics.accumulatedCashflow + metrics.latentGain)}</strong></div>
              <div className="flex justify-between"><span style={{ color: 'var(--hz-neutral-700)' }}>Múltiplo sobre capital</span><strong>x{(metrics.totalCost > 0 ? (metrics.currentValue + metrics.accumulatedCashflow) / metrics.totalCost : 0).toFixed(2)}</strong></div>
              <div className="flex justify-between"><span style={{ color: 'var(--hz-neutral-700)' }}>Rentabilidad anualizada</span><strong>{formatPercent(metrics.annualNetYieldOverCost + metrics.annualRevaluationRate * 100)}</strong></div>
            </div>
            <div className="border-t mt-4 pt-4" style={{ borderColor: 'var(--hz-neutral-200)' }}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2" style={{ color: 'var(--hz-neutral-700)' }}><ArrowDownRight size={16} /> Deuda pendiente</span>
                <strong>{formatCurrency(metrics.pendingDebt)}</strong>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="inline-flex items-center gap-2" style={{ color: 'var(--hz-neutral-700)' }}><ArrowUpRight size={16} /> Equity actual</span>
                <strong style={{ color: 'var(--hz-primary)' }}>{formatCurrency(metrics.totalEquity)}</strong>
              </div>
            </div>
            <p className="text-xs mt-4" style={{ color: 'var(--hz-neutral-600)' }}>
              Histórico agregado desde la primera compra: {new Date(metrics.purchaseStartDate).toLocaleDateString('es-ES')}.
            </p>
          </article>
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--hz-neutral-900)' }}>Datos base agregados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {[
              { label: 'Ingresos anuales', value: formatCurrency(metrics.annualIncome), icon: Euro },
              { label: 'Gastos anuales', value: formatCurrency(metrics.annualOpex), icon: Wallet },
              { label: 'Cuotas deuda anuales', value: formatCurrency(metrics.annualDebtService), icon: Landmark },
              { label: 'Cashflow neto anual', value: formatCurrency(metrics.annualNetCashflow), icon: TrendingUp },
              { label: 'Inmuebles activos', value: `${properties.length}`, icon: Building2 },
            ].map((item) => (
              <article key={item.label} className="rounded-xl border p-4 bg-white" style={{ borderColor: 'var(--hz-neutral-200)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <item.icon size={14} style={{ color: 'var(--hz-primary)' }} />
                  <p className="text-xs" style={{ color: 'var(--hz-neutral-700)' }}>{item.label}</p>
                </div>
                <p className="text-2xl font-semibold" style={{ color: 'var(--hz-neutral-900)' }}>{item.value}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default Analisis;
