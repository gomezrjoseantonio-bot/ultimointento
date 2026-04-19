// src/pages/GestionInmuebles/tabs/GastosRecurrentesTab.tsx
// Pantalla C · Plantillas recurrentes con KPIs de importes reales

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Account, OpexRule } from '../../../services/db';
import { initDB } from '../../../services/db';
import { getOpexRulesForProperty, deleteOpexRule, saveOpexRule } from '../../../services/opexService';
import { confirmDelete } from '../../../services/confirmationService';
import OpexRuleForm from '../../../components/inmuebles/OpexRuleForm';
import EjecucionesRecurrentesSection from './sections/EjecucionesRecurrentesSection';

const C = {
  navy900: 'var(--navy-900, #042C5E)',
  teal600: 'var(--teal-600, #00A7B5)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey300: 'var(--grey-300, #C8D0DC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
  white: '#FFFFFF',
};

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const CATEGORY_LABELS: Record<string, string> = {
  impuesto: 'Impuesto',
  suministro: 'Suministro',
  comunidad: 'Comunidad',
  seguro: 'Seguro',
  servicio: 'Servicio',
  gestion: 'Gestión',
  otro: 'Otros',
};

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  ' €';

const getAnnualAmount = (rule: OpexRule): number => {
  const importe = rule.importeEstimado || 0;
  switch (rule.frecuencia) {
    case 'mensual':
      return importe * 12;
    case 'bimestral':
      return importe * 6;
    case 'trimestral':
      return importe * 4;
    case 'semestral':
      return importe * 2;
    case 'semanal':
      return importe * 52;
    case 'meses_especificos':
      return rule.asymmetricPayments && rule.asymmetricPayments.length > 0
        ? rule.asymmetricPayments.reduce((s, p) => s + (p.importe || 0), 0)
        : importe * (rule.mesesCobro?.length ?? 1);
    case 'anual':
    default:
      return importe;
  }
};

const getFrequencyLabel = (rule: OpexRule): string => {
  switch (rule.frecuencia) {
    case 'mensual':
      return rule.diaCobro ? `Mensual · día ${rule.diaCobro}` : 'Mensual';
    case 'bimestral':
      return 'Bimestral';
    case 'trimestral':
      return 'Trimestral';
    case 'semestral':
      return 'Semestral';
    case 'semanal':
      return 'Semanal';
    case 'anual':
      return rule.mesInicio
        ? `Anual · ${MONTH_NAMES[rule.mesInicio - 1]}`
        : 'Anual';
    case 'meses_especificos':
      return rule.mesesCobro && rule.mesesCobro.length > 0
        ? rule.mesesCobro.map((m) => MONTH_NAMES[m - 1]).join(', ')
        : 'Meses específicos';
    default:
      return '—';
  }
};

interface NextChargeInfo {
  date: string;
  rule: OpexRule;
}

const getNextCharge = (rules: OpexRule[]): NextChargeInfo | null => {
  const today = new Date();
  let best: NextChargeInfo | null = null;
  for (const rule of rules) {
    if (!rule.activo) continue;
    const nextDate = computeNextChargeDate(rule, today);
    if (!nextDate) continue;
    if (!best || nextDate < best.date) {
      best = { date: nextDate, rule };
    }
  }
  return best;
};

const computeNextChargeDate = (rule: OpexRule, today: Date): string | null => {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  switch (rule.frecuencia) {
    case 'mensual': {
      const d = rule.diaCobro ?? 1;
      if (d >= day) {
        return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    case 'anual': {
      const mi = rule.mesInicio ?? 1;
      const d = rule.diaCobro ?? 1;
      if (mi > month || (mi === month && d >= day)) {
        return `${year}-${String(mi).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      return `${year + 1}-${String(mi).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    default:
      return null;
  }
};

const formatShortDate = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)}/${MONTH_NAMES[parseInt(m, 10) - 1].slice(0, 3)}`;
};

interface Props {
  propertyId: number;
}

const GastosRecurrentesTab: React.FC<Props> = ({ propertyId }) => {
  const [rules, setRules] = useState<OpexRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<OpexRule | null>(null);
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const [allRules, allAccounts] = await Promise.all([
        getOpexRulesForProperty(propertyId),
        db.getAll('accounts') as Promise<Account[]>,
      ]);
      setRules(allRules);
      setAccounts(allAccounts);
    } catch (err) {
      console.error('Error cargando plantillas:', err);
      toast.error('Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => {
      setEditingRule(null);
      setShowForm(true);
    };
    window.addEventListener('gestion-inmueble:new-plantilla', handler);
    return () => window.removeEventListener('gestion-inmueble:new-plantilla', handler);
  }, []);

  const activeRules = rules.filter((r) => r.activo);
  const annualEstimate = activeRules.reduce((s, r) => s + getAnnualAmount(r), 0);
  const nextCharge = useMemo(() => getNextCharge(activeRules), [activeRules]);
  const accountsLinked = new Set(rules.map((r) => r.accountId).filter((v) => v != null)).size;

  const getAccountLabel = (accountId?: number) => {
    if (accountId == null) return '—';
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return '—';
    const name = acc.name || acc.alias || (acc as any).nombre || 'Cuenta';
    const iban = (acc as any).iban || '';
    const last4 = iban ? iban.slice(-4) : '';
    return last4 ? `${name} ·${last4}` : name;
  };

  const handleDelete = async (rule: OpexRule) => {
    if (!rule.id) return;
    const ok = await confirmDelete(`"${rule.concepto}"`);
    if (!ok) return;
    try {
      await deleteOpexRule(rule.id);
      toast.success('Plantilla eliminada');
      void reload();
    } catch (err) {
      console.error('Error eliminando plantilla:', err);
      toast.error('Error al eliminar la plantilla');
    }
  };

  return (
    <div>
      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Kpi label="Plantillas activas" value={String(activeRules.length)} />
        <Kpi label="Coste anual estimado" value={fmtEuro(annualEstimate)} mono />
        <Kpi
          label="Próximo cargo"
          value={
            nextCharge
              ? `${formatShortDate(nextCharge.date)} · ${nextCharge.rule.concepto}`
              : '—'
          }
          meta={nextCharge ? fmtEuro(nextCharge.rule.importeEstimado) : undefined}
        />
        <Kpi label="Cuentas vinculadas" value={String(accountsLinked)} />
      </div>

      {/* Sección 1 · Plantillas configuradas */}
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.grey900, margin: 0 }}>
          Plantillas configuradas
        </h3>
        <p style={{ fontSize: 12, color: C.grey500, margin: '2px 0 12px 0' }}>
          Reglas recurrentes que generan previsiones automáticas de tesorería.
        </p>
      </div>
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.grey200}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.grey500 }}>Cargando...</div>
        ) : rules.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.grey500 }}>
            No hay plantillas. Usa &quot;Nueva plantilla&quot; para crear la primera.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.grey50, borderBottom: `1px solid ${C.grey200}` }}>
                <Th>Categoría</Th>
                <Th>Concepto</Th>
                <Th align="right">Importe</Th>
                <Th>Frecuencia</Th>
                <Th>Cuenta</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, idx) => (
                <tr
                  key={rule.id ?? idx}
                  style={{ borderBottom: `1px solid ${C.grey200}` }}
                >
                  <Td>{CATEGORY_LABELS[rule.categoria] ?? rule.categoria}</Td>
                  <Td bold>{rule.concepto}</Td>
                  <Td align="right" mono>
                    {fmtEuro(rule.importeEstimado)}
                  </Td>
                  <Td>{getFrequencyLabel(rule)}</Td>
                  <Td>{getAccountLabel(rule.accountId)}</Td>
                  <Td align="right">
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <IconButton
                        title="Editar"
                        onClick={() => {
                          setEditingRule(rule);
                          setShowForm(true);
                        }}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton title="Eliminar" onClick={() => void handleDelete(rule)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sección 2 · Ejecuciones del año (PR5.5) */}
      <EjecucionesRecurrentesSection propertyId={propertyId} />

      {showForm && (
        <OpexRuleForm
          rule={editingRule ?? undefined}
          propertyId={propertyId}
          onCancel={() => {
            setShowForm(false);
            setEditingRule(null);
          }}
          onSave={async (data) => {
            try {
              const now = new Date().toISOString();
              const saved: OpexRule = {
                ...data,
                createdAt: editingRule?.createdAt ?? now,
                updatedAt: now,
              } as OpexRule;
              await saveOpexRule(saved);
              toast.success(editingRule ? 'Plantilla actualizada' : 'Plantilla creada');
              setShowForm(false);
              setEditingRule(null);
              void reload();
            } catch (err) {
              console.error('Error guardando plantilla:', err);
              toast.error('Error al guardar la plantilla');
            }
          }}
        />
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; meta?: string; mono?: boolean }> = ({
  label,
  value,
  meta,
  mono,
}) => (
  <div
    style={{
      background: C.white,
      border: `1px solid ${C.grey200}`,
      borderRadius: 12,
      padding: 16,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: C.grey500,
        letterSpacing: '.06em',
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 17,
        fontWeight: 600,
        color: C.grey900,
        fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
      }}
    >
      {value}
    </div>
    {meta && (
      <div style={{ fontSize: 11, color: C.grey500, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
        {meta}
      </div>
    )}
  </div>
);

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({
  children,
  align = 'left',
}) => (
  <th
    style={{
      padding: '10px 16px',
      textAlign: align,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      color: C.grey500,
      letterSpacing: '.06em',
    }}
  >
    {children}
  </th>
);

const Td: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  bold?: boolean;
}> = ({ children, align = 'left', mono, bold }) => (
  <td
    style={{
      padding: '10px 16px',
      textAlign: align,
      fontSize: 13,
      color: C.grey900,
      fontWeight: bold ? 500 : 400,
      fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
    }}
  >
    {children}
  </td>
);

const IconButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      padding: 6,
      background: 'transparent',
      border: 'none',
      borderRadius: 4,
      cursor: 'pointer',
      color: C.grey500,
      display: 'inline-flex',
      alignItems: 'center',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = C.navy900;
      e.currentTarget.style.background = C.grey50;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = C.grey500;
      e.currentTarget.style.background = 'transparent';
    }}
  >
    {children}
  </button>
);

export default GastosRecurrentesTab;
