import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { PersonalExpense, CategoriaGasto } from '../../../types/personal';
import { personalExpensesService } from '../../../services/personalExpensesService';
import GastosManagerDrawer from './GastosManagerDrawer';

ChartJS.register(ArcElement, Tooltip);

// ─── Design tokens ──────────────────────────────────────────────────────────
const BLUE  = '#042C5E';
const N700  = '#303A4C';
const N300  = '#C8D0DC';
const S_NEG = '#B91C1C';

// Donut palette: c1→c2→c3→c4→c6 para categorías nombradas, c5 para "Otros"
const C: Record<string, string> = {
  c1: '#042C5E',
  c2: '#1A4A8C',
  c3: '#4A7EB5',
  c4: '#7BA3CC',
  c5: '#C8D0DC', // Otros
  c6: '#9DB5C8',
};
const NAMED_COLORS = [C.c1, C.c2, C.c3, C.c4, C.c6]; // orden sin c5
const OTROS_COLOR  = C.c5;
const MAX_NAMED    = 5; // top categorías que reciben color propio

// ─── Constantes de UI ───────────────────────────────────────────────────────
const CATEGORIA_LABEL: Record<CategoriaGasto, string> = {
  vivienda:     'Vivienda',
  alimentacion: 'Alimentación',
  transporte:   'Transporte',
  salud:        'Salud',
  ocio:         'Ocio',
  ropa:         'Ropa',
  educacion:    'Educación',
  otros:        'Otros',
};

const FRECUENCIA_LABEL: Record<string, string> = {
  mensual:     'Mensual',
  trimestral:  'Trimestral',
  semestral:   'Semestral',
  anual:       'Anual',
};

type ActiveTab = 'todas' | CategoriaGasto;

const ALL_TABS: { value: ActiveTab; label: string }[] = [
  { value: 'todas',        label: 'Todas' },
  { value: 'vivienda',     label: 'Vivienda' },
  { value: 'alimentacion', label: 'Alimentación' },
  { value: 'transporte',   label: 'Transporte' },
  { value: 'salud',        label: 'Salud' },
  { value: 'ocio',         label: 'Ocio' },
  { value: 'ropa',         label: 'Ropa' },
  { value: 'educacion',    label: 'Educación' },
  { value: 'otros',        label: 'Otros' },
];

const FONT = 'IBM Plex Sans, Inter, sans-serif';
const MONO = 'IBM Plex Mono, monospace';

// ─── Helpers ────────────────────────────────────────────────────────────────
function buildDonutData(gastos: PersonalExpense[]) {
  const sums: Record<string, number> = {};
  for (const g of gastos) {
    sums[g.categoria] = (sums[g.categoria] ?? 0) +
      personalExpensesService.calcularImporteMensual(g);
  }

  const sorted = Object.entries(sums).sort(([, a], [, b]) => b - a);
  const named  = sorted.slice(0, MAX_NAMED);
  const rest   = sorted.slice(MAX_NAMED);

  const labels: string[] = named.map(([cat]) =>
    CATEGORIA_LABEL[cat as CategoriaGasto] ?? cat,
  );
  const data:   number[] = named.map(([, v]) => v);
  const colors: string[] = named.map((_, i) => NAMED_COLORS[i]);

  const otrosSum = rest.reduce((a, [, v]) => a + v, 0);
  if (otrosSum > 0) {
    labels.push('Otros');
    data.push(otrosSum);
    colors.push(OTROS_COLOR);
  }

  return { labels, data, colors };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Modal de confirmación de borrado (reemplaza window.confirm) */
const DeleteModal: React.FC<{
  concepto: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ concepto, onConfirm, onCancel }) => (
  <div
    style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <div
      aria-hidden="true"
      onClick={onCancel}
      style={{
        position: 'absolute', inset: 0,
        backgroundColor: 'rgba(3, 20, 43, 0.45)',
      }}
    />
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirmar eliminación"
      style={{
        position: 'relative',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        width: 320,
        boxShadow: '0 8px 32px rgba(4,44,94,0.18)',
        fontFamily: FONT,
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: N700 }}>
        Eliminar gasto
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: N700, lineHeight: 1.5 }}>
        ¿Seguro que quieres eliminar{' '}
        <strong>"{concepto}"</strong>?{' '}
        Esta acción no se puede deshacer.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 6,
            border: `1px solid ${N300}`, background: 'transparent',
            color: N700, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 6,
            border: 'none', background: S_NEG,
            color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
);

/** Menú kebab por fila (MoreVertical → Editar | Eliminar) */
const KebabMenu: React.FC<{ onEdit: () => void; onDelete: () => void }> = ({
  onEdit,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Opciones"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 4, borderRadius: 4, border: 'none',
          background: 'transparent', cursor: 'pointer', color: N700,
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: 32, zIndex: 20,
            backgroundColor: '#fff',
            border: `1px solid ${N300}`,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(4,44,94,0.1)',
            width: 140,
            overflow: 'hidden',
          }}
        >
          <MenuItem
            icon={<Pencil size={14} />}
            label="Editar"
            color={N700}
            hoverBg="#f9fafb"
            onClick={() => { setOpen(false); onEdit(); }}
          />
          <MenuItem
            icon={<Trash2 size={14} />}
            label="Eliminar"
            color={S_NEG}
            hoverBg="#fef2f2"
            onClick={() => { setOpen(false); onDelete(); }}
          />
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
  hoverBg: string;
  onClick: () => void;
}> = ({ icon, label, color, hoverBg, onClick }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '9px 12px',
        border: 'none', background: hover ? hoverBg : '#fff',
        color, fontSize: 13, fontWeight: 400, cursor: 'pointer',
        fontFamily: FONT, textAlign: 'left',
      }}
    >
      {icon}
      {label}
    </button>
  );
};

// ─── GastosManager ──────────────────────────────────────────────────────────
const GastosManager: React.FC = () => {
  const [gastos,       setGastos]       = useState<PersonalExpense[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('todas');
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editingGasto, setEditingGasto] = useState<PersonalExpense | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PersonalExpense | null>(null);

  const loadGastos = useCallback(async () => {
    setLoading(true);
    try {
      setGastos(await personalExpensesService.getAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGastos(); }, [loadGastos]);

  const handleOpenNew = () => {
    setEditingGasto(undefined);
    setDrawerOpen(true);
  };

  const handleEdit = (g: PersonalExpense) => {
    setEditingGasto(g);
    setDrawerOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget?.id == null) return;
    await personalExpensesService.remove(deleteTarget.id);
    setDeleteTarget(null);
    loadGastos();
  };

  const filtered = activeTab === 'todas'
    ? gastos
    : gastos.filter(g => g.categoria === activeTab);

  const totalMensual = gastos.reduce(
    (sum, g) => sum + personalExpensesService.calcularImporteMensual(g),
    0,
  );

  const donut = buildDonutData(gastos);

  const chartData = {
    labels: donut.labels,
    datasets: [{
      data: donut.data,
      backgroundColor: donut.colors,
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const chartOptions = {
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            ` €${(ctx.parsed as number).toFixed(2)}/mes`,
        },
      },
    },
  } as const;

  return (
    <div style={{ fontFamily: FONT, maxWidth: 760, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: BLUE }}>
          Gastos Personales
        </h1>
        {/* Un único botón primary por vista */}
        <button
          onClick={handleOpenNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: BLUE, color: '#fff',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          <Plus size={16} />
          Nuevo gasto
        </button>
      </div>

      {/* ── Summary card (donut + leyenda) ── */}
      <div
        style={{
          display: 'flex', gap: 24, alignItems: 'center',
          border: `1px solid ${N300}`, borderRadius: 12,
          padding: '20px 24px', marginBottom: 20,
        }}
      >
        {/* Donut */}
        <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
          {gastos.length > 0 ? (
            <>
              <Doughnut data={chartData} options={chartOptions as any} />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <span style={{ fontSize: 10, color: N700, opacity: 0.7 }}>Total/mes</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: BLUE, fontFamily: MONO }}>
                  €{totalMensual.toFixed(0)}
                </span>
              </div>
            </>
          ) : (
            <div
              style={{
                width: '100%', height: '100%',
                borderRadius: '50%', border: `3px solid ${N300}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 11, color: N700 }}>Sin datos</span>
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {donut.labels.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: N700, opacity: 0.6 }}>
              Añade gastos para ver el desglose.
            </p>
          )}
          {donut.labels.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-block', width: 8, height: 8,
                    borderRadius: '50%', flexShrink: 0,
                    backgroundColor: donut.colors[i],
                  }}
                />
                <span style={{ fontSize: 12, color: N700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>
              <span style={{ fontSize: 12, color: N700, fontFamily: MONO, flexShrink: 0 }}>
                €{donut.data[i].toFixed(0)}/mes
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pill tabs (sin iconos) ── */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
        {ALL_TABS.map(tab => {
          const active = tab.value === activeTab;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                flexShrink: 0,
                padding: '5px 14px',
                borderRadius: 999,
                border: active ? 'none' : `1px solid ${N300}`,
                background: active ? BLUE : 'transparent',
                color: active ? '#fff' : N700,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Lista de gastos ── */}
      {loading ? (
        <p style={{ fontSize: 13, color: N700 }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div
          style={{
            border: `1.5px dashed ${N300}`, borderRadius: 12,
            padding: '40px 24px', textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: N700 }}>
            {activeTab === 'todas'
              ? 'Aún no hay gastos. Pulsa «Nuevo gasto» para empezar.'
              : 'No hay gastos en esta categoría.'}
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(g => {
            const mensual = personalExpensesService.calcularImporteMensual(g);
            return (
              <li
                key={g.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  border: `1px solid ${N300}`, borderRadius: 8,
                  padding: '12px 16px',
                }}
              >
                {/* Punto de categoría */}
                <span
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: BLUE, flexShrink: 0,
                  }}
                />

                {/* Concepto + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: N700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.concepto}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: N700, opacity: 0.55 }}>
                    {CATEGORIA_LABEL[g.categoria]} · {FRECUENCIA_LABEL[g.frecuencia]}
                  </p>
                </div>

                {/* Importes */}
                <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 4 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: BLUE, fontFamily: MONO }}>
                    €{g.importe.toFixed(2)}
                  </p>
                  {g.frecuencia !== 'mensual' && (
                    <p style={{ margin: 0, fontSize: 11, color: N700, opacity: 0.55, fontFamily: MONO }}>
                      €{mensual.toFixed(2)}/mes
                    </p>
                  )}
                </div>

                {/* Kebab → acción destructiva vía modal, nunca botón directo */}
                <KebabMenu
                  onEdit={() => handleEdit(g)}
                  onDelete={() => setDeleteTarget(g)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Drawer (slide-in 400px desde la derecha) ── */}
      <GastosManagerDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        gasto={editingGasto}
        onSuccess={loadGastos}
      />

      {/* ── Modal confirmación de borrado ── */}
      {deleteTarget && (
        <DeleteModal
          concepto={deleteTarget.concepto}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default GastosManager;
