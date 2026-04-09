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
import { otrosIngresosService } from '../../../../services/otrosIngresosService';
import { patronGastosPersonalesService } from '../../../../services/patronGastosPersonalesService';
import { prestamosService } from '../../../../services/prestamosService';
import { treasuryOverviewService } from '../../../../services/treasuryOverviewService';
import type { TreasuryYearSummary } from '../../../../services/treasuryOverviewService';
import type { PersonalData, PersonalModuleConfig } from '../../../../types/personal';

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const AÑO_ACTUAL = new Date().getFullYear();

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

// ── Types ──

/**
 * All values pre-computed for display.
 * bruto / neto: gross and net income.
 * gastoVida: living expenses (residuo from treasury, clamped ≥ 0; wizard estimate for current year).
 * financiacion: net loan payment OUTFLOW as positive number (max(0, -subtotalFinanciacion)).
 * subtotalFinanciacion: raw treasury value (negative = net outflow), used to derive `financiacion`.
 */
interface AñoData {
  año: number;
  bruto: number;
  neto: number;
  nominaNeta: number;
  autonomoNeto: number;
  gastoVida: number;
  financiacion: number;
  subtotalFinanciacion: number;
  fuente: 'AEAT' | 'ATLAS' | null;
  gastoVidaEstimado: boolean;
}

type Vista = { tipo: 'anual' } | { tipo: 'mensual'; año: number };

// ── Calculation helpers ──

/** excedente = neto - gastoVida - financiacion (financing already sign-corrected) */
const calcExcedente = (d: AñoData) => d.neto - d.gastoVida - d.financiacion;

const calcTasaAhorro = (excedente: number, neto: number) =>
  neto > 0 ? Math.round((excedente / neto) * 100) : 0;

/** Build AñoData from a treasury summary for XML years. */
function fromTreasury(t: TreasuryYearSummary): AñoData {
  const neto = t.nominaNeta + t.autonomoNeto;
  const bruto = t.nominaBruta + t.autonomoBruto;
  // Financing outflow = net cash leaving via loan block (positive when paying out more than receiving).
  const financiacion = Math.max(0, -t.subtotalFinanciacion);
  // Living expense residuo. Clamp to 0 — a negative residuo means investment cash covered personal.
  const gastoVida = Math.max(0, t.gastosPersonales);
  return {
    año: t.año,
    bruto,
    neto,
    nominaNeta: t.nominaNeta,
    autonomoNeto: t.autonomoNeto,
    gastoVida,
    financiacion,
    subtotalFinanciacion: t.subtotalFinanciacion,
    fuente: t.fuente === 'xml_aeat' ? 'AEAT' : t.fuente === 'atlas_nativo' ? 'ATLAS' : null,
    gastoVidaEstimado: t.fuente !== 'xml_aeat',
  };
}

// ── Main Component ──

const PersonalSupervisionPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [, setConfig] = useState<PersonalModuleConfig | null>(null);
  const [datosAnuales, setDatosAnuales] = useState<AñoData[]>([]);
  const [vista, setVista] = useState<Vista>({ tipo: 'anual' });
  // Wizard-derived values for current year (used in LateralDesglose and when no XML for current year)
  const [wizardNominaNeta, setWizardNominaNeta] = useState(0);
  const [wizardAutonomoNeto, setWizardAutonomoNeto] = useState(0);
  const [wizardOtros, setWizardOtros] = useState(0);
  const [gastoVidaAnual, setGastoVidaAnual] = useState(0);
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

      // ── 1. Treasury overview — primary data source for ALL historical years ──
      let treasuryData: TreasuryYearSummary[] = [];
      try {
        treasuryData = await treasuryOverviewService.getTreasuryOverview();
      } catch {
        // No treasury data yet
      }

      // Build AñoData for XML years (< AÑO_ACTUAL or any year with AEAT data).
      const historicalFromTreasury: AñoData[] = treasuryData
        .filter((t) => t.fuente === 'xml_aeat')
        .map(fromTreasury);

      const xmlAños = new Set(historicalFromTreasury.map((d) => d.año));

      // ── 2. Wizard data for current year and LateralDesglose ──
      let gastoMensual = 0;
      try {
        gastoMensual = await patronGastosPersonalesService.calcularTotalMensual(moduleConfig.personalDataId);
      } catch { /* no expense data */ }
      const gastoAnual = Math.round(gastoMensual * 12);
      setGastoVidaAnual(gastoAnual);
      setGastoVidaConfigurado(gastoAnual > 0);

      let financiacionAnual = 0;
      try {
        const allPrestamos = await prestamosService.getAllPrestamos();
        const personales = allPrestamos.filter(
          (p) => (p.ambito === 'PERSONAL' || p.finalidad === 'PERSONAL') && p.activo !== false
        );
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
              const media = cuotas.reduce((t, c) => t + c, 0) / cuotas.length;
              financiacionAnual += Math.round(media * 12);
            }
          } catch { /* no plan */ }
        }
      } catch { /* no loan data */ }

      let autonomoAnual = 0;
      try {
        const autonomos = await autonomoService.getAutonomosActivos(moduleConfig.personalDataId);
        if (autonomos.length > 0) {
          const est = autonomoService.calculateEstimatedAnnualForAutonomos(autonomos);
          autonomoAnual = est.rendimientoNeto;
        }
      } catch { /* no autonomo data */ }
      setWizardAutonomoNeto(autonomoAnual);

      let otrosAnual = 0;
      try {
        const otrosIngresos = await otrosIngresosService.getOtrosIngresos(moduleConfig.personalDataId);
        const activos = otrosIngresos.filter((o) => o.activo);
        otrosAnual = otrosIngresosService.calculateAnnualIncome(activos);
      } catch { /* no otros ingresos */ }
      setWizardOtros(otrosAnual);

      let nominaAnual = 0;
      try {
        const resumenAnual = await personalResumenService.getResumenAnual(
          moduleConfig.personalDataId,
          AÑO_ACTUAL
        );
        nominaAnual = resumenAnual.reduce((s, r) => s + r.ingresos.nomina, 0);
      } catch { /* no resumen data */ }
      setWizardNominaNeta(nominaAnual);

      // Current year entry: use treasury XML if available, else wizard estimate.
      const currentTreasury = treasuryData.find((t) => t.año === AÑO_ACTUAL && t.fuente === 'xml_aeat');
      let currentYearData: AñoData;

      if (currentTreasury) {
        currentYearData = fromTreasury(currentTreasury);
      } else {
        const neto = nominaAnual + autonomoAnual + otrosAnual;
        currentYearData = {
          año: AÑO_ACTUAL,
          bruto: neto, // wizard doesn't split gross/net — bruto ≈ neto for display
          neto,
          nominaNeta: nominaAnual,
          autonomoNeto: autonomoAnual,
          gastoVida: gastoAnual,
          financiacion: financiacionAnual,
          subtotalFinanciacion: -financiacionAnual,
          fuente: 'ATLAS',
          gastoVidaEstimado: true,
        };
      }

      // Merge: historical XML years + current year (if not already in historical set).
      const añosData: AñoData[] = [
        ...historicalFromTreasury.filter((d) => d.año !== AÑO_ACTUAL),
        // Only add wizard current year if it wasn't already in XML set
        ...(xmlAños.has(AÑO_ACTUAL) ? [] : [currentYearData]),
        // If current year IS from XML, it's already in historicalFromTreasury
        ...(xmlAños.has(AÑO_ACTUAL) ? historicalFromTreasury.filter((d) => d.año === AÑO_ACTUAL) : []),
      ];

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

  const refExcedente = refData ? calcExcedente(refData) : null;
  const refTasa = refExcedente !== null && refData ? calcTasaAhorro(refExcedente, refData.neto) : null;
  const prevExcedente = prevData ? calcExcedente(prevData) : null;

  const delta = refExcedente !== null && prevExcedente !== null ? refExcedente - prevExcedente : null;
  const deltaPct = delta !== null && prevExcedente !== null && prevExcedente !== 0
    ? Math.round((delta / Math.abs(prevExcedente)) * 100) : null;

  // Chart data (sorted ascending)
  const graficaData: DatoAnual[] = [...datosAnuales]
    .sort((a, b) => a.año - b.año)
    .map((d) => ({
      año: d.año,
      gastoVida: Math.max(0, d.gastoVida),
      financiacion: Math.max(0, d.financiacion),
      excedente: calcExcedente(d),
    }));

  // Table rows
  const filasHistorial: FilaHistorial[] = datosAnuales.map((d) => {
    const excedente = calcExcedente(d);
    const tasa = calcTasaAhorro(excedente, d.neto);
    const hasData = d.neto > 0 || d.bruto > 0;
    return {
      año: d.año,
      bruto: d.bruto > 0 ? d.bruto : null,
      retenciones: d.bruto > d.neto ? d.bruto - d.neto : null,
      neto: d.neto > 0 ? d.neto : null,
      gastoVida: d.gastoVida > 0 ? d.gastoVida : null,
      financiacion: d.financiacion > 0 ? d.financiacion : null,
      excedente: hasData ? excedente : null,
      tasaAhorro: hasData && d.neto > 0 ? tasa : null,
      fuente: d.fuente,
      gastoVidaEstimado: d.gastoVidaEstimado,
    };
  });

  const totalXmls = datosAnuales.filter((d) => d.fuente === 'AEAT').length;

  // LateralDesglose — always shows wizard values for current-year breakdown.
  const totalIngresosWizard = wizardNominaNeta + wizardAutonomoNeto + wizardOtros;

  // ── Handlers ──

  const handleDrilldown = (año: number) => setVista({ tipo: 'mensual', año });
  const handleBackAnual = () => setVista({ tipo: 'anual' });

  // ── Monthly drill-down ──

  const buildDatosMensuales = (año: number): DatoMensual[] => {
    const d = datosAnuales.find((x) => x.año === año);
    if (!d) return [];

    const netoMes = Math.round(d.neto / 12);
    const gastoMes = Math.round(d.gastoVida / 12);
    const finMes = Math.round(d.financiacion / 12);
    const nominaMes = Math.round(d.nominaNeta / 12);
    const autoMes = Math.round(d.autonomoNeto / 12);

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
        <PageHeader icon={User} title="Personal" subtitle="Ingresos laborales y coste de vida" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div
            className="animate-spin h-8 w-8 border-2 border-t-transparent rounded-full"
            style={{ borderColor: 'var(--navy-900)', borderTopColor: 'transparent' }}
          />
          <span style={{ marginLeft: 8, color: 'var(--grey-500)' }}>Cargando...</span>
        </div>
      </div>
    );
  }

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
            action={{ label: 'Importar declaración', onClick: () => navigate('/fiscalidad/historial') }}
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
          <DrilldownMensual año={vista.año} datos={datosMes} onBack={handleBackAnual} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {/* KPI 1 — Ingresos netos */}
          <KpiStandard
            barColor="var(--navy-900, #042C5E)"
            label={`INGRESOS NETOS ${AÑO_ACTUAL}`}
            value={refData ? refData.neto || null : null}
            valueColor="var(--navy-900, #042C5E)"
            sub="Todas las fuentes · año"
            badgeLabel={refData && refData.neto > 0 ? 'Nómina + Consultoría' : undefined}
            badgeBg="var(--navy-100, #E8EFF7)"
            badgeColor="var(--navy-900, #042C5E)"
          />

          {/* KPI 2 — Gasto de vida */}
          <KpiStandard
            barColor="var(--grey-300, #C8D0DC)"
            label={`GASTO DE VIDA ${AÑO_ACTUAL}`}
            value={refData ? (refData.gastoVida || null) : (gastoVidaAnual || null)}
            valueColor="var(--grey-900, #1A2332)"
            sub="Gastos personales · año"
            badgeLabel={
              refData?.fuente === 'AEAT' ? 'Dato real' :
              gastoVidaConfigurado ? 'Estimación anual' : 'Sin configurar'
            }
            badgeBg="var(--grey-100, #EEF1F5)"
            badgeColor="var(--grey-400, #9CA3AF)"
            badgeItalic={refData?.fuente !== 'AEAT'}
          />

          {/* KPI 3 — Financiación */}
          <KpiStandard
            barColor="var(--teal-600, #1DA0BA)"
            label={`FINANCIACIÓN ${AÑO_ACTUAL}`}
            value={refData ? (refData.financiacion || null) : null}
            prefix="−"
            valueColor="var(--teal-600, #1DA0BA)"
            sub="Cuotas préstamos · año"
            badgeLabel={refData && refData.financiacion > 0 ? 'Dato real' : undefined}
            badgeBg="var(--teal-100, #E6F7FA)"
            badgeColor="var(--teal-600, #1DA0BA)"
          />

          {/* KPI 4 — Excedente */}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          {/* Left — Gráfica histórica (todos los años) */}
          <GraficaHistorica datos={graficaData} añoActual={AÑO_ACTUAL} />

          {/* Right — Lateral desglose (wizard values for income sources) */}
          <LateralDesglose
            año={AÑO_ACTUAL}
            fuentes={[
              {
                nombre: 'Nómina',
                meta: personalData?.dni || undefined,
                importe: wizardNominaNeta > 0 ? wizardNominaNeta : null,
                porcentaje: totalIngresosWizard > 0 ? Math.round((wizardNominaNeta / totalIngresosWizard) * 100) : 0,
                iconKey: 'nomina',
              },
              {
                nombre: 'Autónomo · Consultoría',
                importe: wizardAutonomoNeto > 0 ? wizardAutonomoNeto : null,
                porcentaje: totalIngresosWizard > 0 ? Math.round((wizardAutonomoNeto / totalIngresosWizard) * 100) : 0,
                iconKey: 'autonomo',
              },
              ...(wizardOtros > 0 ? [{
                nombre: 'Otros ingresos',
                importe: wizardOtros,
                porcentaje: totalIngresosWizard > 0 ? Math.round((wizardOtros / totalIngresosWizard) * 100) : 0,
                iconKey: 'nomina' as const,
              }] : []),
              ...(personalData?.spouseName ? [{
                nombre: 'Cónyuge / pareja',
                meta: personalData.spouseName,
                importe: null as null,
                iconKey: 'conyuge' as const,
                vacio: true,
              }] : []),
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
              refData && refData.neto > 0 && refData.financiacion > 0
                ? Math.round((refData.financiacion / refData.neto) * 100)
                : undefined
            }
            gastoVidaEstimado={refData ? Boolean(refData?.gastoVidaEstimado) : gastoVidaConfigurado}
            onConfigurarConyuge={() => navigate('/cuenta/perfil')}
          />
        </div>

        {/* Tabla historial — todos los años */}
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
