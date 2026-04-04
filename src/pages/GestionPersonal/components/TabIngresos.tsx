import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Building2, Heart, PlusCircle, Wallet } from 'lucide-react';
import SourceCard, { BadgeEmpty, BadgePareja } from './SourceCard';
import { autonomoService } from '../../../services/autonomoService';
import { otrosIngresosService } from '../../../services/otrosIngresosService';
import { pensionService } from '../../../services/pensionService';
import NominaForm from '../../../components/personal/nomina/NominaForm';

import type { GestionPersonalData } from '../GestionPersonalPage';
import type { Nomina } from '../../../types/personal';

const FONT = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

const fmtValue = (v: number | null | undefined): string =>
  v != null && v !== 0 ? `${fmt(v)} \u20AC` : '\u2014';

/* ── Action button ── */
const ActionBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '6px 14px',
      borderRadius: 8,
      border: '1.5px solid var(--grey-300, #C8D0DC)',
      background: 'var(--white, #FFFFFF)',
      color: 'var(--grey-700, #303A4C)',
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: FONT,
    }}
  >
    {label}
  </button>
);

/* ── Section separator for titular ── */
const TitularLabel: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '20px 0 12px',
    }}
  >
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--grey-500, #6C757D)',
        whiteSpace: 'nowrap',
        fontFamily: FONT,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </span>
    <div style={{ flex: 1, height: 1, background: 'var(--grey-200, #DDE3EC)' }} />
  </div>
);

interface Props {
  data: GestionPersonalData;
  onDataChange: () => void;
}

const TabIngresos: React.FC<Props> = ({ data, onDataChange }) => {
  const { perfil, nominas, autonomos, pensiones, otrosIngresos, nominaCalcs } = data;
  const navigate = useNavigate();

  const [editingNomina, setEditingNomina] = useState<Nomina | null>(null);
  const [showNominaForm, setShowNominaForm] = useState(false);

  const hasPareja =
    perfil.situacionPersonal === 'casado' || perfil.situacionPersonal === 'pareja-hecho';

  // Section visibility based on profile
  const showNomina = perfil.situacionLaboral.includes('asalariado');
  const showAutonomo = perfil.situacionLaboral.includes('autonomo');
  const showPension = perfil.situacionLaboral.includes('jubilado');
  // Pareja sections
  const showNominaPareja = hasPareja && perfil.situacionLaboralConyugue?.includes('asalariado');
  const showAutoPareja = hasPareja && perfil.situacionLaboralConyugue?.includes('autonomo');
  const showPensionPareja = hasPareja && perfil.situacionLaboralConyugue?.includes('jubilado');

  // Group data by titular
  const nomTitular = nominas.filter((n) => n.titular === 'yo');
  const nomPareja = nominas.filter((n) => n.titular === 'pareja');
  const otrosTitular = otrosIngresos.filter((o) => o.titularidad === 'yo' || o.titularidad === 'ambos');
  const otrosPareja = otrosIngresos.filter((o) => o.titularidad === 'pareja' || o.titularidad === 'ambos');

  const openNominaEdit = (nom: Nomina) => {
    setEditingNomina(nom);
    setShowNominaForm(true);
  };

  const openNominaNew = (titular: 'yo' | 'pareja') => {
    navigate(`/gestion/personal/nueva-nomina?titular=${titular}`);
  };

  const handleNominaSaved = (_nomina?: Nomina) => {
    setShowNominaForm(false);
    setEditingNomina(null);
    onDataChange();
  };

  // Nomina card builder
  const buildNominaCard = (nom: Nomina, isPareja: boolean) => {
    const calc = nom.id != null ? nominaCalcs.get(nom.id) : undefined;
    const isExtraPagas = nom.distribucion.tipo !== 'doce';
    return (
      <SourceCard
        key={nom.id}
        bandColor={isPareja ? 'navy' : 'teal'}
        icon={<Briefcase size={16} color="var(--grey-400, #9CA3AF)" />}
        name={nom.nombre}
        description={`${nom.distribucion.tipo === 'catorce' ? '14 pagas' : '12 pagas'} \u00B7 IRPF ${nom.retencion.irpfPorcentaje}%`}
        kpis={[
          { label: 'Bruto anual', value: calc ? fmtValue(calc.totalAnualBruto) : '\u2014' },
          { label: 'Neto anual', value: calc ? fmtValue(calc.totalAnualNeto) : '\u2014' },
          {
            label: isExtraPagas ? 'Neto mensual promedio' : 'Neto mensual',
            value: calc ? fmtValue(Math.round(calc.netoMensual)) : '\u2014',
            color: 'var(--teal-600, #1DA0BA)',
          },
        ]}
        badge={isPareja ? <BadgePareja /> : null}
        action={<ActionBtn label="Editar nómina" onClick={() => openNominaEdit(nom)} />}
      />
    );
  };

  // Autonomo card builder
  const buildAutoCard = (auto: typeof autonomos[number], isPareja: boolean) => {
    const est = autonomoService.calculateEstimatedAnnual(auto);
    return (
      <SourceCard
        key={auto.id}
        bandColor={isPareja ? 'navy' : 'teal'}
        icon={<Building2 size={16} color="var(--grey-400, #9CA3AF)" />}
        name={auto.nombre}
        description={`IAE ${auto.epigrafeIAE || '\u2014'} \u00B7 IRPF ${auto.irpfRetencionPorcentaje || 0}%`}
        kpis={[
          { label: 'Facturación bruta', value: fmtValue(est.facturacionBruta) },
          { label: 'Gastos', value: fmtValue(est.totalGastos) },
          {
            label: 'Rendimiento neto',
            value: fmtValue(est.rendimientoNeto),
            color: est.rendimientoNeto >= 0
              ? 'var(--navy-900, #042C5E)'
              : 'var(--grey-700, #303A4C)',
          },
        ]}
        badge={isPareja ? <BadgePareja /> : null}
        action={<ActionBtn label="Gestionar actividad" onClick={() => navigate('/personal/supervision')} />}
      />
    );
  };

  // Pension card builder
  const buildPensionCard = (pen: typeof pensiones[number], isPareja: boolean) => {
    const calc = pensionService.calculatePension(pen);
    const tipoPensionLabel: Record<string, string> = {
      jubilacion: 'Jubilaci\u00F3n',
      viudedad: 'Viudedad',
      incapacidad: 'Incapacidad',
      orfandad: 'Orfandad',
    };
    return (
      <SourceCard
        key={pen.id}
        bandColor={isPareja ? 'navy' : 'teal'}
        icon={<Heart size={16} color="var(--grey-400, #9CA3AF)" />}
        name={`Pensión ${tipoPensionLabel[pen.tipoPension] || pen.tipoPension}`}
        description={`${pen.numeroPagas} pagas \u00B7 IRPF ${pen.irpfPorcentaje}%`}
        kpis={[
          { label: 'Bruta anual', value: fmtValue(pen.pensionBrutaAnual) },
          { label: 'Retención', value: fmtValue(calc.retencionAnual) },
          {
            label: 'Neto mensual',
            value: fmtValue(Math.round(calc.netoMensual)),
            color: 'var(--teal-600, #1DA0BA)',
          },
        ]}
        badge={isPareja ? <BadgePareja /> : null}
        action={<ActionBtn label="Editar pensión" onClick={() => navigate('/personal/supervision')} />}
      />
    );
  };

  // Otros ingresos card
  const buildOtrosCard = (items: typeof otrosIngresos, isPareja: boolean) => {
    const activos = items.filter((o) => o.activo);
    const anual = otrosIngresosService.calculateAnnualIncome(activos);
    if (activos.length === 0) {
      return (
        <SourceCard
          bandColor="grey"
          icon={<PlusCircle size={16} color="var(--grey-400)" />}
          name="Otros ingresos"
          description="Sin ingresos adicionales configurados"
          kpis={[]}
          badge={<BadgeEmpty />}
          action={<ActionBtn label="+ Añadir" onClick={() => navigate(`/gestion/personal/otros-ingresos?titular=${isPareja ? 'pareja' : 'yo'}`)} />}
        />
      );
    }
    return (
      <SourceCard
        bandColor={isPareja ? 'navy' : 'teal'}
        icon={<Wallet size={16} color="var(--grey-400, #9CA3AF)" />}
        name="Otros ingresos"
        description={`${activos.length} fuente${activos.length > 1 ? 's' : ''} activa${activos.length > 1 ? 's' : ''}`}
        kpis={[
          { label: 'Total anual', value: fmtValue(anual) },
          {
            label: 'Mensual equiv.',
            value: fmtValue(Math.round(anual / 12)),
            color: 'var(--teal-600, #1DA0BA)',
          },
        ]}
        badge={isPareja ? <BadgePareja /> : null}
        action={<ActionBtn label="Gestionar" onClick={() => navigate(`/gestion/personal/otros-ingresos?titular=${isPareja ? 'pareja' : 'yo'}`)} />}
        detail={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activos.map((o) => (
              <div
                key={o.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--grey-700, #303A4C)',
                }}
              >
                <span>{o.nombre}</span>
                <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtValue(o.importe)}
                  <span style={{ color: 'var(--grey-400)', marginLeft: 4, fontSize: 11 }}>
                    /{o.frecuencia === 'mensual' ? 'mes' : o.frecuencia}
                  </span>
                </span>
              </div>
            ))}
          </div>
        }
      />
    );
  };

  // Empty nomina card for pareja
  const buildEmptyNominaPareja = () => (
    <SourceCard
      bandColor="grey"
      icon={<Briefcase size={16} color="var(--grey-400)" />}
      name="Nómina pareja"
      description="Sin configurar"
      kpis={[]}
      badge={<BadgeEmpty />}
      action={<ActionBtn label="Configurar nómina" onClick={() => openNominaNew('pareja')} />}
    />
  );

  return (
    <div style={{ fontFamily: FONT }}>
      {/* ── NominaForm modal (edit only) ── */}
      <NominaForm
        isOpen={showNominaForm}
        onClose={() => {
          setShowNominaForm(false);
          setEditingNomina(null);
        }}
        nomina={editingNomina}
        onSaved={() => handleNominaSaved()}
      />

      {/* ── Titular sections ── */}
      {hasPareja && (
        <TitularLabel label={`${perfil.nombre} ${perfil.apellidos} \u00B7 Titular`} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Nomina titular */}
        {showNomina &&
          (nomTitular.length > 0
            ? nomTitular.map((n) => buildNominaCard(n, false))
            : (
                <SourceCard
                  bandColor="grey"
                  icon={<Briefcase size={16} color="var(--grey-400)" />}
                  iconBg="var(--grey-100, #EEF1F5)"
                  name="Nómina"
                  description="Sin configurar"
                  kpis={[]}
                  badge={<BadgeEmpty />}
                  action={<ActionBtn label="Configurar nómina" onClick={() => openNominaNew('yo')} />}
                />
              ))}

        {/* Autonomo titular */}
        {showAutonomo &&
          ((() => {
            const autosTitular = autonomos.filter((a) => !a.titular || a.titular === perfil.nombre);
            return autosTitular.length > 0
              ? autosTitular.map((a) => buildAutoCard(a, false))
              : (
                <SourceCard
                  bandColor="grey"
                  icon={<Building2 size={16} color="var(--grey-400)" />}
                  name="Actividad autónoma"
                  description="Sin configurar"
                  kpis={[]}
                  badge={<BadgeEmpty />}
                  action={<ActionBtn label="Añadir actividad" onClick={() => navigate('/gestion/personal/nuevo-autonomo?titular=yo')} />}
                />
              );
          })())}

        {/* Pension titular */}
        {showPension &&
          pensiones
            .filter((p) => p.titular === 'yo')
            .map((p) => buildPensionCard(p, false))}

        {/* Otros ingresos titular — always visible */}
        {buildOtrosCard(otrosTitular, false)}
      </div>

      {/* ── Pareja sections ── */}
      {hasPareja && perfil.spouseName && (
        <>
          <TitularLabel label={`${perfil.spouseName} \u00B7 Pareja`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Nomina pareja */}
            {showNominaPareja &&
              (nomPareja.length > 0
                ? nomPareja.map((n) => buildNominaCard(n, true))
                : buildEmptyNominaPareja())}

            {/* Autonomo pareja */}
            {showAutoPareja &&
              ((() => {
                const autosPareja = autonomos.filter((a) => a.titular === perfil.spouseName);
                return autosPareja.length > 0
                  ? autosPareja.map((a) => buildAutoCard(a, true))
                  : (
                      <SourceCard
                        bandColor="grey"
                        icon={<Building2 size={16} color="var(--grey-400)" />}
                        name="Actividad autónoma pareja"
                        description="Sin configurar"
                        kpis={[]}
                        badge={<BadgeEmpty />}
                        action={<ActionBtn label="Añadir actividad" onClick={() => navigate('/gestion/personal/nuevo-autonomo?titular=pareja')} />}
                      />
                    );
              })())}

            {/* Pension pareja */}
            {showPensionPareja &&
              pensiones
                .filter((p) => p.titular === 'pareja')
                .map((p) => buildPensionCard(p, true))}

            {/* Otros ingresos pareja — always visible */}
            {buildOtrosCard(otrosPareja, true)}
          </div>
        </>
      )}
    </div>
  );
};

export default TabIngresos;
