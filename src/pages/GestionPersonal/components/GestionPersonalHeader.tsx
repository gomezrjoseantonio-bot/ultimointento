import React from 'react';
import { Briefcase, Globe, Home, Shield, User, Users } from 'lucide-react';
import { autonomoService } from '../../../services/autonomoService';
import { otrosIngresosService } from '../../../services/otrosIngresosService';
import { patronGastosPersonalesService } from '../../../services/patronGastosPersonalesService';
import type { GestionPersonalData } from '../GestionPersonalPage';

/* ── Navy header tokens ── */
const NAVY_BG = '#042C5E';
const CLR_TITLE = '#ffffff';
const CLR_SECONDARY = 'rgba(255,255,255,0.75)';
const CLR_MUTED = 'rgba(255,255,255,0.38)';
const CLR_BORDER = 'rgba(255,255,255,0.08)';
const CLR_CHIP_BG = 'rgba(255,255,255,0.10)';
const CLR_CHIP_BORDER = 'rgba(255,255,255,0.12)';
const CLR_TAB_ACTIVE = '#ffffff';
const CLR_TAB_INACTIVE = 'rgba(255,255,255,0.45)';
const CLR_TAB_LINE = 'var(--teal-600, #1DA0BA)';
const CLR_DELTA_POS = '#4DBDD4';
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const FONT = "'IBM Plex Sans', system-ui, sans-serif";

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

const fmtValue = (v: number | null | undefined): string =>
  v != null && v !== 0 ? `${fmt(v)} \u20AC` : '\u2014';

/* ── Avatar ── */
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 44 }) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: CLR_TITLE,
        fontSize: size * 0.36,
        fontWeight: 600,
        fontFamily: FONT,
        flexShrink: 0,
        border: '2px solid rgba(255,255,255,0.25)',
      }}
    >
      {initials}
    </div>
  );
};

/* ── Chip ── */
const Chip: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({
  children,
  icon,
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 500,
      color: CLR_SECONDARY,
      background: CLR_CHIP_BG,
      border: `1px solid ${CLR_CHIP_BORDER}`,
      fontFamily: FONT,
      whiteSpace: 'nowrap',
    }}
  >
    {icon}
    {children}
  </span>
);

/* ── KPI card ── */
const KpiCard: React.FC<{
  label: string;
  value: string;
  sub: string;
  subColor?: string;
}> = ({ label, value, sub, subColor }) => (
  <div style={{ flex: 1, minWidth: 180 }}>
    <div style={{ fontSize: 12, color: CLR_MUTED, marginBottom: 4, fontFamily: FONT }}>
      {label}
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: CLR_TITLE,
        fontFamily: MONO,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.2,
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontSize: 11,
        color: subColor || CLR_SECONDARY,
        marginTop: 2,
        fontFamily: FONT,
      }}
    >
      {sub}
    </div>
  </div>
);

interface Props {
  data: GestionPersonalData;
  tab: 'ingresos' | 'gastos';
  onTabChange: (t: 'ingresos' | 'gastos') => void;
}

const GestionPersonalHeader: React.FC<Props> = ({ data, tab, onTabChange }) => {
  const { perfil, nominas, autonomos, pensiones, otrosIngresos, expenses, prestamosPersonales, nominaCalcs } = data;

  const hasPareja =
    perfil.situacionPersonal === 'casado' || perfil.situacionPersonal === 'pareja-hecho';
  const edad = perfil.fechaNacimiento ? calcEdad(perfil.fechaNacimiento) : null;

  /* ── Build name ── */
  const nombreCompleto = `${perfil.nombre} ${perfil.apellidos}`;
  const displayName = hasPareja && perfil.spouseName
    ? `${perfil.nombre} & ${perfil.spouseName}`
    : nombreCompleto;

  /* ── Build chips ── */
  const chips: Array<{ key: string; label: string; icon?: React.ReactNode }> = [];

  // Situación personal
  const spLabel: Record<string, string> = {
    soltero: 'Soltero',
    casado: 'Casado',
    'pareja-hecho': 'Pareja de hecho',
    divorciado: 'Divorciado',
  };
  const edadStr = edad != null ? ` \u00B7 ${edad} a\u00F1os` : '';
  const spIcon = (perfil.situacionPersonal === 'casado' || perfil.situacionPersonal === 'pareja-hecho')
    ? <Users size={12} />
    : <User size={12} />;
  chips.push({ key: 'sp', label: `${spLabel[perfil.situacionPersonal] || perfil.situacionPersonal}${edadStr}`, icon: spIcon });

  // Situación laboral
  const labLabels: Record<string, string> = {
    asalariado: 'Asalariado',
    autonomo: 'Aut\u00F3nomo',
    jubilado: 'Jubilado',
    desempleado: 'Desempleado',
  };
  const laboral = perfil.situacionLaboral.map((s) => labLabels[s] || s).join(' + ');
  if (laboral) {
    if (hasPareja) {
      const iniciales = perfil.nombre.split(' ').map(w => w[0]).join('').toUpperCase();
      chips.push({ key: 'lab', label: `${iniciales}: ${laboral}`, icon: <Briefcase size={12} /> });
    } else {
      chips.push({ key: 'lab', label: laboral, icon: <Briefcase size={12} /> });
    }
  }

  // Pareja laboral
  if (hasPareja && perfil.situacionLaboralConyugue?.length) {
    const spIni = perfil.spouseName
      ? perfil.spouseName.split(' ').map(w => w[0]).join('').toUpperCase()
      : 'P';
    const spLab = perfil.situacionLaboralConyugue.map((s) => labLabels[s] || s).join(' + ');
    chips.push({ key: 'splab', label: `${spIni}: ${spLab}`, icon: <Briefcase size={12} /> });
  }

  // Housing
  const housingLabels: Record<string, string> = {
    rent: 'Alquiler',
    ownership_with_mortgage: 'Con hipoteca',
    ownership_without_mortgage: 'Vivienda libre',
    living_with_parents: 'Con padres',
  };
  if (perfil.housingType) {
    const hLabel = housingLabels[perfil.housingType] || perfil.housingType;
    const ciudad = perfil.comunidadAutonoma ? ` \u00B7 ${perfil.comunidadAutonoma}` : '';
    chips.push({ key: 'housing', label: `${hLabel}${ciudad}`, icon: <Home size={12} /> });
  }

  // Tributación / Pareja marital
  if (perfil.tributacion) {
    const tribLabel = perfil.tributacion === 'conjunta' ? 'IRPF conjunta' : 'IRPF individual';
    if (hasPareja) {
      const parejaTipo = perfil.situacionPersonal === 'casado' ? 'Casados' : 'Pareja de hecho';
      chips.push({ key: 'trib', label: `${parejaTipo} \u00B7 ${tribLabel}`, icon: <Globe size={12} /> });
    } else if (perfil.comunidadAutonoma && !perfil.housingType) {
      chips.push({ key: 'trib', label: `${perfil.comunidadAutonoma} \u00B7 ${tribLabel}`, icon: <Globe size={12} /> });
    } else {
      chips.push({ key: 'trib', label: tribLabel, icon: <Globe size={12} /> });
    }
  }

  // Hijos (only if they exist)
  if (perfil.descendientes && perfil.descendientes.length > 0) {
    chips.push({
      key: 'hijos',
      label: `${perfil.descendientes.length} hijo${perfil.descendientes.length > 1 ? 's' : ''}`,
      icon: <Shield size={13} />,
    });
  }

  /* ── KPI calculations ── */
  // Nomina bruto
  const nominaTitular = nominas.filter((n) => n.titular === 'yo');
  const nominaPareja = nominas.filter((n) => n.titular === 'pareja');
  let brutNomTit = 0;
  let retNomTit = 0;
  for (const n of nominaTitular) {
    const c = n.id != null ? nominaCalcs.get(n.id) : undefined;
    if (c) {
      brutNomTit += c.totalAnualBruto;
      retNomTit += c.distribucionMensual.reduce((s, m) => s + m.ssTotal + m.irpfImporte, 0);
    }
  }
  let brutNomPar = 0;
  let retNomPar = 0;
  for (const n of nominaPareja) {
    const c = n.id != null ? nominaCalcs.get(n.id) : undefined;
    if (c) {
      brutNomPar += c.totalAnualBruto;
      retNomPar += c.distribucionMensual.reduce((s, m) => s + m.ssTotal + m.irpfImporte, 0);
    }
  }

  // Autonomo
  const autoEstimated = autonomos.length > 0
    ? autonomoService.calculateEstimatedAnnualForAutonomos(autonomos)
    : { facturacionBruta: 0, totalGastos: 0, rendimientoNeto: 0 };
  const autoIrpfRet = autonomos.reduce((sum, a) => {
    const est = autonomoService.calculateEstimatedAnnual(a);
    return sum + est.facturacionBruta * ((a.irpfRetencionPorcentaje || 0) / 100);
  }, 0);

  // Pension
  const pensionBruta = pensiones.reduce((s, p) => s + p.pensionBrutaAnual, 0);
  const pensionRet = pensiones.reduce((s, p) => s + p.pensionBrutaAnual * (p.irpfPorcentaje / 100), 0);

  // Otros ingresos
  const otrosActivos = otrosIngresos.filter((o) => o.activo);
  const otrosAnual = otrosIngresosService.calculateAnnualIncome(otrosActivos);

  // Total bruto
  const totalBruto = brutNomTit + brutNomPar + autoEstimated.facturacionBruta + pensionBruta + otrosAnual;
  const totalRetenciones = retNomTit + retNomPar + autoIrpfRet + pensionRet;
  const totalNeto = totalBruto - totalRetenciones;

  // Gastos de vida
  const gastosMensual = expenses
    .filter((e) => e.activo && e.importe > 0)
    .reduce((s, e) => s + patronGastosPersonalesService.calcularImporteMensual(e), 0);
  const gastosAnual = Math.round(gastosMensual * 12);

  // Financiacion personal
  // Simple estimation: we don't have getPaymentPlan readily, use a rough estimate
  // For now count the number of loans and estimate from their data
  const financiacionAnual = prestamosPersonales.reduce((s, p) => {
    // Rough: use cuotaMensual * 12 if available, otherwise 0
    const cuota = (p as any).cuotaMensual || (p as any).cuota || 0;
    return s + cuota * 12;
  }, 0);

  const excedente = totalNeto - gastosAnual - financiacionAnual;
  const tasaAhorro = totalNeto > 0 ? Math.round((excedente / totalNeto) * 100) : 0;

  const anoActual = new Date().getFullYear();

  // Individual net contributions (for matrimonio display)
  const netoTitular = brutNomTit - retNomTit;
  const netoPareja = brutNomPar - retNomPar;
  const iniTitular = perfil.nombre.split(' ').filter(Boolean).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const iniPareja = perfil.spouseName
    ? perfil.spouseName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'P';

  return (
    <div style={{ background: NAVY_BG, padding: '28px 32px 0', fontFamily: FONT }}>
      {/* ── Profile row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        {hasPareja && perfil.spouseName ? (
          <div style={{ display: 'flex', position: 'relative', width: 64 }}>
            <Avatar name={nombreCompleto} size={44} />
            <div style={{ position: 'absolute', left: 28 }}>
              <Avatar name={perfil.spouseName} size={44} />
            </div>
          </div>
        ) : (
          <Avatar name={nombreCompleto} />
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: CLR_TITLE,
                lineHeight: 1.3,
                fontFamily: FONT,
              }}
            >
              {displayName}
            </h1>
            {hasPareja && (
              <>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: FONT }}>{iniTitular}</span>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: netoTitular > 0 ? CLR_TITLE : 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                  {netoTitular > 0 ? `${fmt(netoTitular)} €` : 'Sin configurar'}
                </span>
                <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: FONT }}>{iniPareja}</span>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: netoPareja > 0 ? CLR_TITLE : 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                  {netoPareja > 0 ? `${fmt(netoPareja)} €` : 'Sin configurar'}
                </span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chips.map((c) => (
              <Chip key={c.key} icon={c.icon}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI banner ── */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '16px 0',
          borderTop: `1px solid ${CLR_BORDER}`,
          borderBottom: `1px solid ${CLR_BORDER}`,
          flexWrap: 'wrap',
        }}
      >
        <KpiCard
          label="Ingresos netos"
          value={fmtValue(totalNeto)}
          sub=""
        />
        <KpiCard
          label="Gastos estimados"
          value={fmtValue(gastosAnual + financiacionAnual)}
          sub=""
        />
        <KpiCard
          label="Ahorro estimado"
          value={fmtValue(totalNeto > 0 && excedente > 0 ? excedente : null)}
          sub={totalNeto > 0 ? `${tasaAhorro}% tasa de ahorro` : `Estimado ${anoActual}`}
          subColor={CLR_DELTA_POS}
        />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 32, paddingTop: 4 }}>
        {(['ingresos', 'gastos'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            style={{
              padding: '12px 0',
              fontSize: 14,
              fontWeight: tab === t ? 500 : 400,
              color: tab === t ? CLR_TAB_ACTIVE : CLR_TAB_INACTIVE,
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${CLR_TAB_LINE}` : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: FONT,
              textTransform: 'capitalize',
              transition: 'all 150ms ease',
            }}
          >
            {t === 'ingresos' ? 'Ingresos' : 'Gastos'}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── Helpers ── */

function calcEdad(fechaNac: string): number {
  const parts = fechaNac.includes('/') ? fechaNac.split('/') : null;
  const birth = parts
    ? new Date(+parts[2], +parts[1] - 1, +parts[0])
    : new Date(fechaNac);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}


export default GestionPersonalHeader;
