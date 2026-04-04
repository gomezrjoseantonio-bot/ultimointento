import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { LayoutTemplate, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PersonalData,
  PersonalExpense,
  PersonalExpenseCategory,
  PersonalExpenseFrequency,
} from '../../../types/personal';
import { personalExpensesService } from '../../../services/personalExpensesService';
import { personalDataService } from '../../../services/personalDataService';
import GastosManagerDrawer from './GastosManagerDrawer';

ChartJS.register(ArcElement, Tooltip);

const BLUE = '#042C5E';
const N700 = '#303A4C';
const N500 = '#6B7483';
const N300 = '#C8D0DC';
const SURFACE = '#F8FAFC';
const S_NEG = '#303A4C';
const FONT = 'IBM Plex Sans, Inter, sans-serif';
const MONO = 'IBM Plex Mono, monospace';

const NAMED_COLORS = ['#042C5E', '#2F6DB0', '#5C8FC6', '#7DB1D6', '#A3C4DD'];

const CATEGORIA_LABEL: Record<PersonalExpenseCategory, string> = {
  vivienda: 'Vivienda',
  alimentacion: 'Alimentación',
  transporte: 'Transporte',
  ocio: 'Ocio',
  salud: 'Salud',
  seguros: 'Seguros',
  educacion: 'Educación',
  otros: 'Otros',
};

const FRECUENCIA_LABEL: Record<PersonalExpenseFrequency, string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  meses_especificos: 'Meses específicos',
};

type ActiveTab = 'todas' | PersonalExpenseCategory;
const ALL_TABS: { value: ActiveTab; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'alimentacion', label: 'Alimentación' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'ocio', label: 'Ocio' },
  { value: 'salud', label: 'Salud' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'educacion', label: 'Educación' },
  { value: 'otros', label: 'Otros' },
];

const DeleteModal: React.FC<{ concepto: string; onConfirm: () => void; onCancel: () => void }> = ({
  concepto,
  onConfirm,
  onCancel,
}) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div aria-hidden="true" onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.45)' }} />
    <div style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: 20, width: 320, border: `1px solid ${N300}` }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, color: N700 }}>Eliminar gasto</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: N500 }}>¿Seguro que quieres eliminar "{concepto}"?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, border: `1px solid ${N300}`, background: '#fff', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={onConfirm} style={{ flex: 1, border: 'none', background: S_NEG, color: '#fff', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>Eliminar</button>
      </div>
    </div>
  </div>
);

const KebabMenu: React.FC<{ onEdit: () => void; onDelete: () => void }> = ({ onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: N500 }}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 28, border: `1px solid ${N300}`, borderRadius: 10, background: '#fff', width: 130, overflow: 'hidden', boxShadow: '0 8px 18px rgba(0,0,0,0.08)' }}>
          <button onClick={() => { setOpen(false); onEdit(); }} style={{ width: '100%', border: 'none', background: '#fff', padding: 10, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}><Pencil size={14} />Editar</button>
          <button onClick={() => { setOpen(false); onDelete(); }} style={{ width: '100%', border: 'none', background: '#fff', padding: 10, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', color: S_NEG }}><Trash2 size={14} />Eliminar</button>
        </div>
      )}
    </div>
  );
};

const GastosManager: React.FC = () => {
  const [gastos, setGastos] = useState<PersonalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('todas');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<PersonalExpense | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PersonalExpense | null>(null);

  useEffect(() => {
    personalDataService.getPersonalData().then((data) => {
      if (data?.id) setPersonalDataId(data.id);
      setPersonalData(data);
    }).catch(() => undefined);
  }, []);

  const loadGastos = useCallback(async () => {
    if (!personalDataId) return;
    setLoading(true);
    try {
      const data = await personalExpensesService.getExpenses(personalDataId);
      data.sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));
      setGastos(data);
    } catch {
      toast.error('Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  }, [personalDataId]);

  useEffect(() => {
    if (personalDataId !== null) loadGastos();
  }, [loadGastos, personalDataId]);

  const filtered = useMemo(() => activeTab === 'todas' ? gastos : gastos.filter((g) => g.categoria === activeTab), [gastos, activeTab]);
  const gastosActivos = useMemo(() => gastos.filter((g) => g.activo), [gastos]);
  // Only count expenses with importe > 0 in totals
  const gastosConImporte = useMemo(() => gastosActivos.filter((g) => g.importe > 0), [gastosActivos]);
  const totalMensual = useMemo(() => gastosConImporte.reduce((sum, g) => sum + personalExpensesService.calcularImporteMensual(g), 0), [gastosConImporte]);

  const byCategory = useMemo(() => {
    const sums = new Map<PersonalExpenseCategory, number>();
    // Only count expenses with importe > 0 in category breakdown
    for (const g of gastosConImporte) {
      const prev = sums.get(g.categoria) ?? 0;
      sums.set(g.categoria, prev + personalExpensesService.calcularImporteMensual(g));
    }
    return Array.from(sums.entries())
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [gastosConImporte]);

  const majorCategory = byCategory[0];

  const chartData = {
    labels: byCategory.map(([cat]) => CATEGORIA_LABEL[cat]),
    datasets: [{ data: byCategory.map(([, amount]) => amount), backgroundColor: byCategory.map((_, i) => NAMED_COLORS[i % NAMED_COLORS.length]), borderWidth: 0 }],
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    try {
      await personalExpensesService.deleteExpense(deleteTarget.id);
      toast.success('Gasto eliminado');
      setDeleteTarget(null);
      loadGastos();
    } catch {
      toast.error('Error al eliminar el gasto');
    }
  };

  const handleLoadTemplate = async () => {
    if (!personalDataId) return;
    try {
      await personalExpensesService.smartMergeTemplateExpenses(personalDataId, personalData);
      toast.success('Plantilla cargada correctamente');
      loadGastos();
    } catch {
      toast.error('Error al cargar la plantilla');
    }
  };

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 16 }}>
        <div style={{ border: `1px solid ${N300}`, borderRadius: 14, padding: 16, background: '#fff' }}>
          <p style={{ margin: 0, fontSize: 13, color: N500, fontWeight: 600, letterSpacing: 1 }}>GASTO MENSUAL ESTIMADO</p>
          <p style={{ margin: '6px 0 0', fontSize: 18, color: N700, fontWeight: 700, fontFamily: MONO }}>{totalMensual > 0 ? `${totalMensual.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}</p>
          <p style={{ margin: '6px 0 0', color: N500 }}>{gastosConImporte.length} gastos con importe</p>
        </div>
        <div style={{ border: `1px solid ${N300}`, borderRadius: 14, padding: 16, background: '#fff' }}>
          <p style={{ margin: 0, fontSize: 13, color: N500, fontWeight: 600, letterSpacing: 1 }}>GASTO ANUAL ESTIMADO</p>
          <p style={{ margin: '6px 0 0', fontSize: 18, color: N700, fontWeight: 700, fontFamily: MONO }}>{totalMensual > 0 ? `${(totalMensual * 12).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}</p>
          <p style={{ margin: '6px 0 0', color: N500 }}>Proyección 12 meses</p>
        </div>
        <div style={{ border: `1px solid ${N300}`, borderRadius: 14, padding: 16, background: '#fff' }}>
          <p style={{ margin: 0, fontSize: 13, color: N500, fontWeight: 600, letterSpacing: 1 }}>MAYOR CATEGORÍA</p>
          <p style={{ margin: '6px 0 0', fontSize: 18, color: N700, fontWeight: 700, fontFamily: MONO }}>{majorCategory && majorCategory[1] > 0 ? `${majorCategory[1].toLocaleString('es-ES', { maximumFractionDigits: 0 })} €` : '—'}</p>
          <p style={{ margin: '6px 0 0', color: N500 }}>{majorCategory && majorCategory[1] > 0 ? CATEGORIA_LABEL[majorCategory[0]] : 'Sin datos'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: byCategory.length > 0 ? '280px minmax(0, 1fr)' : '1fr', gap: 16 }}>
        {byCategory.length > 0 && (
        <section style={{ border: `1px solid ${N300}`, borderRadius: 14, background: '#fff', padding: 14 }}>
          <h3 style={{ margin: '4px 0 12px', color: '#1E2B42' }}>Distribución</h3>
          <div style={{ width: 180, margin: '0 auto', position: 'relative' }}>
            <Doughnut data={chartData} options={{ cutout: '68%', plugins: { legend: { display: false } } } as any} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
              <div><div style={{ fontSize: 12, color: N500 }}>Total</div><strong style={{ color: BLUE }}>{Math.round(totalMensual)} €</strong><div style={{ fontSize: 12, color: N500 }}>/mes</div></div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byCategory.map(([cat, amount], i) => {
              const pct = totalMensual ? (amount / totalMensual) * 100 : 0;
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: N700 }}><span>{CATEGORIA_LABEL[cat]}</span><strong>{pct.toFixed(1)}%</strong></div>
                  <div style={{ height: 4, borderRadius: 999, background: '#E5EAF1', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: NAMED_COLORS[i % NAMED_COLORS.length] }} /></div>
                </div>
              );
            })}
          </div>
        </section>
        )}

        <section style={{ border: `1px solid ${N300}`, borderRadius: 14, background: '#fff' }}>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${N300}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{filtered.length} gastos · <span style={{ color: N700, fontFamily: MONO }}>{totalMensual > 0 ? `${totalMensual.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/mes` : '—'}</span></h3>
          </div>

          <div style={{ padding: 14, display: 'flex', gap: 8, overflowX: 'auto' }}>
            {ALL_TABS.map((tab) => {
              const active = tab.value === activeTab;
              return <button key={tab.value} onClick={() => setActiveTab(tab.value)} style={{ borderRadius: 999, border: `1px solid ${active ? BLUE : N300}`, background: active ? BLUE : '#fff', color: active ? '#fff' : N700, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{tab.label}</button>;
            })}
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 360, background: SURFACE, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
            {!loading && gastos.length === 0 && (
              <div style={{ border: `1.5px dashed ${N300}`, borderRadius: 12, padding: 28, textAlign: 'center', background: '#fff' }}>
                <LayoutTemplate size={32} style={{ color: N300 }} />
                <p style={{ color: N700, fontWeight: 500 }}>Sin gastos configurados</p>
                <p style={{ color: N500, fontSize: 13, marginBottom: 12 }}>Añade tus gastos recurrentes para hacer seguimiento</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => { setEditingGasto(undefined); setDrawerOpen(true); }} style={{ border: 'none', borderRadius: 10, background: BLUE, color: '#fff', padding: '10px 14px', cursor: 'pointer' }}>Añadir gasto</button>
                  <button onClick={handleLoadTemplate} style={{ border: `1px solid ${N300}`, borderRadius: 10, background: '#fff', color: N700, padding: '10px 14px', cursor: 'pointer' }}>Cargar plantilla</button>
                </div>
              </div>
            )}
            {!loading && gastos.length > 0 && filtered.length === 0 && (
              <div style={{ border: `1.5px dashed ${N300}`, borderRadius: 12, padding: 28, textAlign: 'center', background: '#fff' }}>
                <p style={{ color: N500 }}>No hay gastos en esta categoría</p>
              </div>
            )}
            {loading && <p style={{ color: N500 }}>Cargando...</p>}
            {!loading && filtered.map((g) => {
              const mensual = personalExpensesService.calcularImporteMensual(g);
              return (
                <article key={g.id} style={{ border: `1px solid ${N300}`, borderRadius: 12, background: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: g.activo ? 1 : 0.55 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: BLUE }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, color: N700, fontWeight: 500 }}>{g.concepto}</div>
                    <div style={{ fontSize: 12, color: N500 }}>{CATEGORIA_LABEL[g.categoria]} · {FRECUENCIA_LABEL[g.frecuencia]}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: BLUE, fontFamily: MONO, fontSize: 18 }}>{g.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong>
                    {g.frecuencia !== 'mensual' && <div style={{ fontSize: 11, color: N500, fontFamily: MONO }}>{mensual.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/mes</div>}
                  </div>
                  <KebabMenu onEdit={() => { setEditingGasto(g); setDrawerOpen(true); }} onDelete={() => setDeleteTarget(g)} />
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {personalDataId !== null && (
        <GastosManagerDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          personalDataId={personalDataId}
          gasto={editingGasto}
          onSuccess={loadGastos}
        />
      )}

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
