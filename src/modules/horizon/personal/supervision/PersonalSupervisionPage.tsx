import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings } from 'lucide-react';
import PageHeader, { HeaderSecondaryButton } from '../../../../components/shared/PageHeader';
import EmptyState from '../../../../components/common/EmptyState';
import KpiExcedente from './components/KpiExcedente';
import LateralDesglose from './components/LateralDesglose';
import GraficaHistorica, { type DatoAnual } from './components/GraficaHistorica';
import TablaHistorial, { type FilaHistorial } from './components/TablaHistorial';
import DrilldownMensual, { type DatoMensual } from './components/DrilldownMensual';
import { personalDataService } from '../../../../services/personalDataService';
import { personalResumenService } from '../../../../services/personalResumenService';
import { autonomoService } from '../../../../services/autonomoService';
import { personalExpensesService } from '../../../../services/personalExpensesService';
import { ejercicioFiscalService } from '../../../../services/ejercicioFiscalService';
import { prestamosService } from '../../../../services/prestamosService';
import type { PersonalData, PersonalModuleConfig } from '../../../../types/personal';
import type { EjercicioFiscal } from '../../../../types/fiscal';

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const AÑO_ACTUAL = new Date().getFullYear();

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

// ── Computation helpers ──

const calcBruto = (nomina: number, autonom: number, conyuge: number) =>
  nomina + autonom + conyuge;

const calcNeto = (bruto: number, retenciones: number) =>
  bruto - retenciones;

const calcExcedente = (neto: number, gastoVida: number, financiacion: number) =>
  neto - gastoVida - financiacion;

const calcTasaAhorro = (excedente: number, neto: number) =>
  neto > 0 ? Math.round((excedente / neto) * 100) : 0;

// ── Types ──

interface AñoData {
  año: number;
  nomina: number;
  retenciones: number;
  autonom: number;
  conyuge: number;
  gastoVida: number;
  financiacion: number;
  fuente: 'AEAT' | 'ATLAS' | null;
  gastoVidaEstimado: boolean;
}

type Vista = { tipo: 'anual' } | { tipo: 'mensual'; año: number };

// ── Main Component ──

const PersonalSupervisionPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [config, setConfig] = useState<PersonalModuleConfig | null>(null);
  const [datosAnuales, setDatosAnuales] = useState<AñoData[]>([]);
  const [vista, setVista] = useState<Vista>({ tipo: 'anual' });
  const [gastoVidaAnual, setGastoVidaAnual] = useState<number>(0);
  const [gastoVidaConfigurado, setGastoVidaConfigurado] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, moduleConfig] = await Promise.all([
        personalDataService.getPersonalData(),
        personalDataService.getModuleConfiguration(),
      ]);
      setPersonalData(profile);
      setConfig(moduleConfig);

      if (!profile || !moduleConfig) {
        setLoading(false);
        return;
      }

      // Get all fiscal exercises to know which years have data
      let ejercicios: EjercicioFiscal[] = [];
      try {
        ejercicios = await ejercicioFiscalService.getAllEjercicios();
      } catch {
        // No fiscal data yet
      }

      // Get personal expenses (monthly total × 12 = annual)
      let gastoMensual = 0;
      try {
        gastoMensual = await personalExpensesService.calcularTotalMensual(moduleConfig.personalDataId);
      } catch {
        // No expense data
      }
      const gastoAnual = Math.round(gastoMensual * 12);
      setGastoVidaAnual(gastoAnual);
      setGastoVidaConfigurado(gastoAnual > 0);

      // Get personal loans
      let financiacionAnual = 0;
      try {
        const allPrestamos = await prestamosService.getAllPrestamos();
        const personales = allPrestamos.filter(
          (p) => (p.ambito === 'PERSONAL' || p.finalidad === 'PERSONAL') && p.activo !== false
        );
        // Estimate annual payments from payment plan periods
        for (const p of personales) {
          try {
            const plan = await prestamosService.getPaymentPlan(p.id);
            const periodos = plan?.periodos;
            const cuotas = Array.isArray(periodos)
              ? periodos
                  .map((periodo) => Number(periodo?.cuota ?? 0))
                  .filter((cuota) => Number.isFinite(cuota) && cuota > 0)
              : [];
            if (cuotas.length > 0) {
              const cuotaMensualMedia =
                cuotas.reduce((total, cuota) => total + cuota, 0) / cuotas.length;
              financiacionAnual += Math.round(cuotaMensualMedia * 12);
            }
          } catch {
            // Fallback: no plan available
          }
        }
      } catch {
        // No loan data
      }

      // Get autónomo annual income
      let autonomoAnual = 0;
      try {
        const autonomos = await autonomoService.getAutonomosActivos(moduleConfig.personalDataId);
        if (autonomos.length > 0) {
          const est = autonomoService.calculateEstimatedAnnualForAutonomos(autonomos);
          autonomoAnual = est.rendimientoNeto;
        }
      } catch {
        // No autonomo data
      }

      // Get resumen for current year (monthly data)
      let nominaAnual = 0;
      let retencionesAnual = 0;
      try {
        const resumenAnual = await personalResumenService.getResumenAnual(
          moduleConfig.personalDataId,
          AÑO_ACTUAL
        );
        nominaAnual = resumenAnual.reduce((s, r) => s + r.ingresos.nomina, 0);
        retencionesAnual = 0; // Retenciones come from fiscal data, not resumen
      } catch {
        // No resumen data
      }

      // Build per-year data from fiscal exercises
      const añosData: AñoData[] = [];

      // Add current year from live data
      const currentYearData: AñoData = {
        año: AÑO_ACTUAL,
        nomina: nominaAnual,
        retenciones: 0,
        autonom: autonomoAnual,
        conyuge: 0,
        gastoVida: gastoAnual,
        financiacion: financiacionAnual,
        fuente: 'ATLAS',
        gastoVidaEstimado: true,
      };
      añosData.push(currentYearData);

      // Add historical years from fiscal exercises
      for (const ej of ejercicios) {
        if (ej.ejercicio === AÑO_ACTUAL) {
          // Update current year with AEAT data if available
          const decl = ej.declaracionAeat || ej.calculoAtlas;
          if (decl) {
            currentYearData.nomina = decl.trabajo?.retribucionesDinerarias || currentYearData.nomina;
            currentYearData.retenciones = decl.trabajo?.retencionesTrabajoTotal || 0;
            currentYearData.autonom = decl.actividades?.reduce(
              (s, a) => s + (a.rendimientoNeto || 0), 0
            ) || currentYearData.autonom;
            currentYearData.fuente = ej.declaracionAeat ? 'AEAT' : 'ATLAS';
          }
          continue;
        }

        const decl = ej.declaracionAeat || ej.calculoAtlas;
        if (!decl) continue;

        añosData.push({
          año: ej.ejercicio,
          nomina: decl.trabajo?.retribucionesDinerarias || 0,
          retenciones: decl.trabajo?.retencionesTrabajoTotal || 0,
          autonom: decl.actividades?.reduce((s, a) => s + (a.rendimientoNeto || 0), 0) || 0,
          conyuge: 0,
          gastoVida: gastoAnual, // Same estimate for all years (no historical data)
          financiacion: financiacionAnual, // Same estimate
          fuente: ej.declaracionAeat ? 'AEAT' : 'ATLAS',
          gastoVidaEstimado: true,
        });
      }

      // Sort by year descending
      añosData.sort((a, b) => b.año - a.año);
      setDatosAnuales(añosData);
    } catch (error) {
      console.error('[PersonalSupervision] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived data ──

  const refData = datosAnuales.find((d) => d.año === AÑO_ACTUAL);
  const prevData = datosAnuales.find((d) => d.año === AÑO_ACTUAL - 1);

  const refBruto = refData ? calcBruto(refData.nomina, refData.autonom, refData.conyuge) : null;
  const refNeto = refData && refBruto !== null ? calcNeto(refBruto, refData.retenciones) : null;
  const refExcedente = refData && refNeto !== null
    ? calcExcedente(refNeto, refData.gastoVida, refData.financiacion) : null;
  const refTasa = refExcedente !== null && refNeto !== null
    ? calcTasaAhorro(refExcedente, refNeto) : null;

  const prevBruto = prevData ? calcBruto(prevData.nomina, prevData.autonom, prevData.conyuge) : null;
  const prevNeto = prevData && prevBruto !== null ? calcNeto(prevBruto, prevData.retenciones) : null;
  const prevExcedente = prevData && prevNeto !== null
    ? calcExcedente(prevNeto, prevData.gastoVida, prevData.financiacion) : null;

  const delta = refExcedente !== null && prevExcedente !== null
    ? refExcedente - prevExcedente : null;
  const deltaPct = delta !== null && prevExcedente !== null && prevExcedente !== 0
    ? Math.round((delta / Math.abs(prevExcedente)) * 100) : null;

  // Chart data
  const graficaData: DatoAnual[] = [...datosAnuales]
    .sort((a, b) => a.año - b.año)
    .map((d) => {
      const bruto = calcBruto(d.nomina, d.autonom, d.conyuge);
      const neto = calcNeto(bruto, d.retenciones);
      return {
        año: d.año,
        gastoVida: d.gastoVida,
        financiacion: d.financiacion,
        excedente: calcExcedente(neto, d.gastoVida, d.financiacion),
      };
    });

  // Table rows
  const filasHistorial: FilaHistorial[] = datosAnuales.map((d) => {
    const bruto = calcBruto(d.nomina, d.autonom, d.conyuge);
    const neto = calcNeto(bruto, d.retenciones);
    const excedente = calcExcedente(neto, d.gastoVida, d.financiacion);
    const tasa = calcTasaAhorro(excedente, neto);

    const tieneNeto = neto !== null && neto !== undefined;

    return {
      año: d.año,
      bruto: bruto ?? null,
      retenciones: d.retenciones ?? null,
      neto: neto ?? null,
      gastoVida: d.gastoVida ?? null,
      financiacion: d.financiacion ?? null,
      excedente: tieneNeto ? excedente : null,
      tasaAhorro: tieneNeto ? tasa : null,
      fuente: d.fuente,
      gastoVidaEstimado: d.gastoVidaEstimado,
    };
  });

  const totalXmls = datosAnuales.filter((d) => d.fuente === 'AEAT').length;

  // Lateral fuentes
  const nominaTotal = refData?.nomina || 0;
  const autonomTotal = refData?.autonom || 0;
  const totalIngresos = nominaTotal + autonomTotal;

  // ── Handlers ──

  const handleDrilldown = (año: number) => {
    setVista({ tipo: 'mensual', año });
  };

  const handleBackAnual = () => {
    setVista({ tipo: 'anual' });
  };

  // ── Monthly drill-down data ──

  const buildDatosMensuales = (año: number): DatoMensual[] => {
    const yearData = datosAnuales.find((d) => d.año === año);
    if (!yearData) return [];

    const bruto = calcBruto(yearData.nomina, yearData.autonom, yearData.conyuge);
    const netoAnual = calcNeto(bruto, yearData.retenciones);
    const netoMes = Math.round(netoAnual / 12);
    const gastoMes = Math.round(yearData.gastoVida / 12);
    const finMes = Math.round(yearData.financiacion / 12);
    const nominaMes = Math.round(yearData.nomina / 12);
    const autoMes = Math.round(yearData.autonom / 12);

    return MESES_LABEL.map((label, i) => ({
      mes: i + 1,
      label,
      neto: netoMes,
      gastoVida: gastoMes,
      financiacion: finMes,
      excedente: netoMes - gastoMes - finMes,
      nomina: nominaMes,
      autonomo: autoMes,
    }));
  };

  // ── Render ──

  if (loading) {
    return (
      <div>
        <PageHeader
          icon={User}
          title="Personal"
          subtitle="Ingresos laborales y coste de vida"
        />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
        }}>
          <div
            className="animate-spin h-8 w-8 border-2 border-t-transparent rounded-full"
            style={{ borderColor: 'var(--navy-900)', borderTopColor: 'transparent' }}
          />
          <span style={{ marginLeft: 8, color: 'var(--grey-500)' }}>Cargando...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!personalData || datosAnuales.length === 0) {
    return (
      <div>
        <PageHeader
          icon={User}
          title="Personal"
          subtitle="Ingresos laborales y coste de vida"
          actions={
            <HeaderSecondaryButton
              icon={Settings}
              label="Configurar"
              onClick={() => navigate('/cuenta/perfil')}
            />
          }
        />
        <div className="p-6">
          <EmptyState
            lucideIcon={User}
            title="Sin datos de ingresos"
            description="Importa tus declaraciones de la renta para ver tu historial laboral."
            action={{
              label: 'Importar declaración',
              onClick: () => navigate('/fiscalidad/historial'),
            }}
          />
        </div>
      </div>
    );
  }

  // Monthly drill-down view
  if (vista.tipo === 'mensual') {
    const datosMes = buildDatosMensuales(vista.año);
    return (
      <div>
        <PageHeader
          icon={User}
          title="Personal"
          subtitle="Ingresos laborales y coste de vida"
          actions={
            <HeaderSecondaryButton
              icon={Settings}
              label="Configurar"
              onClick={() => navigate('/cuenta/perfil')}
            />
          }
        />
        <div className="p-6">
          <DrilldownMensual
            año={vista.año}
            datos={datosMes}
            onBack={handleBackAnual}
          />
        </div>
      </div>
    );
  }

  // ── Annual view ──

  return (
    <div>
      <PageHeader
        icon={User}
        title="Personal"
        subtitle="Ingresos laborales y coste de vida"
        actions={
          <HeaderSecondaryButton
            icon={Settings}
            label="Configurar"
            onClick={() => navigate('/cuenta/perfil')}
          />
        }
      />

      <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* KPIs - 4 columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}>
          {/* KPI 1 — Ingresos netos */}
          <KpiStandard
            barColor="var(--navy-900, #042C5E)"
            label={`INGRESOS NETOS ${AÑO_ACTUAL}`}
            value={refNeto}
            valueColor="var(--navy-900, #042C5E)"
            sub="Todas las fuentes · año"
            badgeLabel={totalIngresos > 0 ? 'Nómina + Consultoría' : undefined}
            badgeBg="var(--navy-100, #E8EFF7)"
            badgeColor="var(--navy-900, #042C5E)"
          />

          {/* KPI 2 — Gasto de vida */}
          <KpiStandard
            barColor="var(--grey-300, #C8D0DC)"
            label={`GASTO DE VIDA ${AÑO_ACTUAL}`}
            value={gastoVidaAnual || null}
            prefix="~"
            valueColor="var(--grey-900, #1A2332)"
            sub="Gastos personales · año"
            badgeLabel={gastoVidaConfigurado ? 'Estimación anual' : 'Sin configurar'}
            badgeBg="var(--grey-100, #EEF1F5)"
            badgeColor="var(--grey-400, #9CA3AF)"
            badgeItalic
          />

          {/* KPI 3 — Financiación personal */}
          <KpiStandard
            barColor="var(--teal-600, #1DA0BA)"
            label={`FINANCIACIÓN ${AÑO_ACTUAL}`}
            value={refData?.financiacion || null}
            prefix="−"
            valueColor="var(--teal-600, #1DA0BA)"
            sub="Cuotas préstamos · año"
            badgeLabel={refData && refData.financiacion > 0 ? 'Dato real' : undefined}
            badgeBg="var(--teal-100, #E6F7FA)"
            badgeColor="var(--teal-600, #1DA0BA)"
          />

          {/* KPI 4 — Excedente (KPI-D) */}
          <KpiExcedente
            año={AÑO_ACTUAL}
            excedente={refExcedente}
            tasaAhorro={refTasa}
            delta={delta}
            deltaPct={deltaPct}
            añoAnterior={AÑO_ACTUAL - 1}
          />
        </div>

        {/* Grid principal: chart + lateral */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 16,
        }}>
          {/* Left — Gráfica histórica */}
          <GraficaHistorica datos={graficaData} añoActual={AÑO_ACTUAL} />

          {/* Right — Lateral desglose */}
          <LateralDesglose
            año={AÑO_ACTUAL}
            fuentes={[
              {
                nombre: 'Nómina',
                meta: personalData?.dni || undefined,
                importe: nominaTotal > 0 ? nominaTotal : null,
                porcentaje: totalIngresos > 0 ? Math.round((nominaTotal / totalIngresos) * 100) : 0,
                iconKey: 'nomina',
              },
              {
                nombre: 'Autónomo · Consultoría',
                importe: autonomTotal > 0 ? autonomTotal : null,
                porcentaje: totalIngresos > 0 ? Math.round((autonomTotal / totalIngresos) * 100) : 0,
                iconKey: 'autonomo',
              },
              {
                nombre: 'Cónyuge / pareja',
                meta: 'Sin datos · Configurar',
                importe: null,
                iconKey: 'conyuge',
                vacio: true,
              },
            ]}
            costesVida={[
              {
                nombre: 'Alquiler',
                meta: personalData?.comunidadAutonoma || undefined,
                importe: gastoVidaAnual > 0 ? Math.round(gastoVidaAnual * 0.45) : null,
                iconKey: 'alquiler',
              },
              {
                nombre: 'Alimentación',
                importe: gastoVidaAnual > 0 ? Math.round(gastoVidaAnual * 0.30) : null,
                iconKey: 'alimentacion',
              },
              {
                nombre: 'Seguros + suministros',
                importe: gastoVidaAnual > 0 ? Math.round(gastoVidaAnual * 0.25) : null,
                iconKey: 'seguros',
              },
            ]}
            financiacion={refData?.financiacion || null}
            financiacionPct={
              refNeto && refData?.financiacion
                ? Math.round((refData.financiacion / refNeto) * 100)
                : undefined
            }
            gastoVidaEstimado={gastoVidaConfigurado}
            onConfigurarConyuge={() => navigate('/cuenta/perfil')}
          />
        </div>

        {/* Tabla historial */}
        <TablaHistorial
          filas={filasHistorial}
          añoActual={AÑO_ACTUAL}
          totalXmls={totalXmls}
          onClickFila={handleDrilldown}
        />
      </div>
    </div>
  );
};

// ── Standard KPI Card ──

const KpiStandard: React.FC<{
  barColor: string;
  label: string;
  value: number | null;
  prefix?: string;
  valueColor: string;
  sub: string;
  badgeLabel?: string;
  badgeBg?: string;
  badgeColor?: string;
  badgeItalic?: boolean;
}> = ({ barColor, label, value, prefix = '', valueColor, sub, badgeLabel, badgeBg, badgeColor, badgeItalic }) => (
  <div style={{
    background: 'var(--white, #FFFFFF)',
    border: '1px solid var(--grey-200, #DDE3EC)',
    borderRadius: 'var(--r-lg, 12px)',
    overflow: 'hidden',
  }}>
    <div style={{ height: 3, background: barColor }} />
    <div style={{ padding: '18px 16px 14px' }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--grey-500, #6C757D)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 10,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: valueColor,
        fontFamily: "'IBM Plex Mono', monospace",
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.2,
      }}>
        {value !== null ? `${prefix}${fmt(value)} €` : '—'}
      </div>
      <div style={{
        fontSize: 11,
        color: 'var(--grey-500, #6C757D)',
        marginTop: 4,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}>
        {sub}
      </div>
      {badgeLabel && (
        <span style={{
          display: 'inline-block',
          fontSize: 10,
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: 10,
          background: badgeBg || 'var(--grey-100)',
          color: badgeColor || 'var(--grey-400)',
          fontStyle: badgeItalic ? 'italic' : 'normal',
          marginTop: 8,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          {badgeLabel}
        </span>
      )}
    </div>
  </div>
);

export default PersonalSupervisionPage;
