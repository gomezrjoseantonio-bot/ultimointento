import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Banknote, Briefcase, PiggyBank, Coins, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { personalDataService } from '../../../services/personalDataService';
import { nominaService } from '../../../services/nominaService';
import { autonomoService } from '../../../services/autonomoService';
import { pensionService } from '../../../services/pensionService';
import { otrosIngresosService } from '../../../services/otrosIngresosService';
import {
  PersonalData,
  Nomina,
  Autonomo,
  PensionIngreso,
  OtrosIngresos,
  CalculoNominaResult,
  CalculoPensionResult,
} from '../../../types/personal';
import NominaManager from '../nomina/NominaManager';
import AutonomoView from '../../../modules/personal/components/AutonomoView';
import PensionTab from '../PensionTab';
import OtrosIngresosManager from '../otros/OtrosIngresosManager';

const fmt = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

type IncomeType = 'todos' | 'nomina' | 'autonomo' | 'pension' | 'otros';
type DetailView = { type: 'nomina'; data?: Nomina } | { type: 'autonomo' } | { type: 'pension' } | { type: 'otros' } | null;

interface UnifiedIncomeItem {
  id: string;
  type: 'nomina' | 'autonomo' | 'pension' | 'otros';
  name: string;
  typeLabel: string;
  titular: string;
  frequency: string;
  monthlyAmount: number;
  active: boolean;
  icon: React.ElementType;
  raw: Nomina | Autonomo | PensionIngreso | OtrosIngresos;
}

const TYPE_LABELS: Record<IncomeType, string> = {
  todos: 'Todos',
  nomina: 'Nómina',
  autonomo: 'Autónomo',
  pension: 'Pensión',
  otros: 'Otros',
};

const PENSION_TYPE_LABELS: Record<string, string> = {
  jubilacion: 'Jubilación',
  viudedad: 'Viudedad',
  incapacidad: 'Incapacidad',
  orfandad: 'Orfandad',
};

const FRECUENCIA_LABELS: Record<string, string> = {
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  unico: 'Único',
};

const getFrequencyFactor = (freq: string): number => {
  switch (freq) {
    case 'mensual': return 1;
    case 'trimestral': return 1 / 3;
    case 'semestral': return 1 / 6;
    case 'anual': return 1 / 12;
    case 'unico': return 0;
    default: return 1;
  }
};

const IngresosUnifiedManager: React.FC = () => {
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [nominaCalculos, setNominaCalculos] = useState<Map<number, CalculoNominaResult>>(new Map());
  const [autonomos, setAutonomos] = useState<Autonomo[]>([]);
  const [pensiones, setPensiones] = useState<PensionIngreso[]>([]);
  const [pensionCalculos, setPensionCalculos] = useState<Map<number, CalculoPensionResult>>(new Map());
  const [otrosIngresos, setOtrosIngresos] = useState<OtrosIngresos[]>([]);
  const [filter, setFilter] = useState<IncomeType>('todos');
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pData = await personalDataService.getPersonalData();
      setPersonalData(pData);
      if (!pData?.id) { setLoading(false); return; }
      const pid = pData.id;

      const [nominasData, autonomosData, pensionesData, otrosData] = await Promise.all([
        nominaService.getNominas(pid),
        autonomoService.getAutonomos(pid),
        pensionService.getPensiones(pid),
        otrosIngresosService.getOtrosIngresos(pid),
      ]);

      setNominas(nominasData);
      const calcMap = new Map<number, CalculoNominaResult>();
      nominasData.forEach(n => { if (n.id) calcMap.set(n.id, nominaService.calculateSalary(n)); });
      setNominaCalculos(calcMap);

      setAutonomos(autonomosData);

      setPensiones(pensionesData);
      const pCalcMap = new Map<number, CalculoPensionResult>();
      pensionesData.forEach(p => { if (p.id) pCalcMap.set(p.id, pensionService.calculatePension(p)); });
      setPensionCalculos(pCalcMap);

      setOtrosIngresos(otrosData);
    } catch (err) {
      console.error('Error loading income data:', err);
      toast.error('Error al cargar los ingresos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getTitularLabel = useCallback((titular: string) => {
    if (titular === 'yo') return personalData?.nombre || 'Yo';
    if (titular === 'pareja') return personalData?.spouseName || 'Pareja';
    if (titular === 'ambos') return 'Ambos';
    return titular || 'Yo';
  }, [personalData]);

  const unifiedItems: UnifiedIncomeItem[] = useMemo(() => {
    const items: UnifiedIncomeItem[] = [];

    for (const n of nominas) {
      const calc = n.id ? nominaCalculos.get(n.id) : null;
      const pagas = n.distribucion.tipo === 'doce' ? 12 : n.distribucion.tipo === 'catorce' ? 14 : n.distribucion.meses;
      items.push({
        id: `nomina-${n.id}`,
        type: 'nomina',
        name: n.nombre,
        typeLabel: 'Nómina',
        titular: getTitularLabel(n.titular),
        frequency: `Mensual (${pagas} pagas)`,
        monthlyAmount: calc?.netoMensual ?? 0,
        active: n.activa,
        icon: Banknote,
        raw: n,
      });
    }

    for (const a of autonomos) {
      const annual = autonomoService.calculateEstimatedAnnual(a);
      items.push({
        id: `autonomo-${a.id}`,
        type: 'autonomo',
        name: a.nombre,
        typeLabel: 'Autónomo',
        titular: getTitularLabel(a.titular ?? 'yo'),
        frequency: '—',
        monthlyAmount: annual.rendimientoNeto / 12,
        active: a.activo,
        icon: Briefcase,
        raw: a,
      });
    }

    for (const p of pensiones) {
      const calc = p.id ? pensionCalculos.get(p.id) : null;
      items.push({
        id: `pension-${p.id}`,
        type: 'pension',
        name: `Pensión de ${PENSION_TYPE_LABELS[p.tipoPension] ?? p.tipoPension}`,
        typeLabel: 'Pensión',
        titular: getTitularLabel(p.titular),
        frequency: `${p.numeroPagas} pagas`,
        monthlyAmount: calc?.netoMensual ?? 0,
        active: p.activa,
        icon: PiggyBank,
        raw: p,
      });
    }

    for (const o of otrosIngresos) {
      items.push({
        id: `otros-${o.id}`,
        type: 'otros',
        name: o.nombre,
        typeLabel: 'Otros',
        titular: getTitularLabel(o.titularidad),
        frequency: FRECUENCIA_LABELS[o.frecuencia] ?? o.frecuencia,
        monthlyAmount: o.importe * getFrequencyFactor(o.frecuencia),
        active: o.activo,
        icon: Coins,
        raw: o,
      });
    }

    return items;
  }, [nominas, nominaCalculos, autonomos, pensiones, pensionCalculos, otrosIngresos, getTitularLabel]);

  const filteredItems = useMemo(
    () => filter === 'todos' ? unifiedItems : unifiedItems.filter(i => i.type === filter),
    [unifiedItems, filter],
  );

  const activeItems = useMemo(() => unifiedItems.filter(i => i.active), [unifiedItems]);
  const totalMonthly = useMemo(() => activeItems.reduce((s, i) => s + i.monthlyAmount, 0), [activeItems]);
  const totalAnnual = totalMonthly * 12;

  const handleItemClick = (item: UnifiedIncomeItem) => {
    switch (item.type) {
      case 'nomina': setDetailView({ type: 'nomina', data: item.raw as Nomina }); break;
      case 'autonomo': setDetailView({ type: 'autonomo' }); break;
      case 'pension': setDetailView({ type: 'pension' }); break;
      case 'otros': setDetailView({ type: 'otros' }); break;
    }
  };

  const handleAddSource = (type: 'nomina' | 'autonomo' | 'pension' | 'otros') => {
    setShowAddModal(false);
    switch (type) {
      case 'nomina': setDetailView({ type: 'nomina' }); break;
      case 'autonomo': setDetailView({ type: 'autonomo' }); break;
      case 'pension': setDetailView({ type: 'pension' }); break;
      case 'otros': setDetailView({ type: 'otros' }); break;
    }
  };

  const handleDetailClose = () => {
    setDetailView(null);
    loadData();
  };

  // Render detail views (full existing managers)
  if (detailView) {
    return (
      <div>
        <button
          onClick={handleDetailClose}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <X size={14} /> Volver a Ingresos
        </button>
        {detailView.type === 'nomina' && <NominaManager />}
        {detailView.type === 'autonomo' && <AutonomoView />}
        {detailView.type === 'pension' && <PensionTab />}
        {detailView.type === 'otros' && <OtrosIngresosManager />}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-blue-900 border-t-transparent rounded-full" />
        <span className="ml-2 text-gray-500">Cargando ingresos...</span>
      </div>
    );
  }

  // Empty state
  if (unifiedItems.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-gray-200 rounded-2xl">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Banknote className="w-7 h-7 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">Sin fuentes de ingreso</h3>
          <p className="text-sm text-gray-500 text-center max-w-md mb-5">
            Añade tu nómina, actividad autónoma u otras fuentes de ingreso
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors"
          >
            <Plus size={16} /> Añadir fuente de ingreso
          </button>
        </div>
        {showAddModal && <AddSourceModal onSelect={handleAddSource} onClose={() => setShowAddModal(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 border-t-4 border-t-blue-900 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Ingreso neto / mes</p>
          <p className="text-2xl font-bold text-blue-900">{totalMonthly > 0 ? fmt(totalMonthly) : '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Bruto anual estimado</p>
          <p className="text-2xl font-bold text-gray-900">{totalAnnual > 0 ? fmt(totalAnnual) : '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Fuentes activas</p>
          <p className="text-2xl font-bold text-gray-900">{activeItems.length}</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(TYPE_LABELS) as IncomeType[]).map(key => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
                active
                  ? 'bg-blue-900 text-white border-blue-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {TYPE_LABELS[key]}
            </button>
          );
        })}
      </div>

      {/* Income list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {filteredItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              className={`w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                idx > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-blue-900" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 truncate">{item.name}</span>
                  <span className="px-2 py-0.5 text-[11px] rounded bg-gray-100 text-gray-500 flex-shrink-0">
                    {item.typeLabel}
                  </span>
                  <span className={`px-2 py-0.5 text-[11px] rounded flex-shrink-0 ${
                    item.active
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {item.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.titular} · {item.frequency}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-gray-900 tabular-nums">
                  {item.monthlyAmount > 0 ? fmt(item.monthlyAmount) : '—'}
                </p>
                <p className="text-[11px] text-gray-400">/mes neto</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors"
      >
        <Plus size={16} /> Añadir fuente de ingreso
      </button>

      {showAddModal && <AddSourceModal onSelect={handleAddSource} onClose={() => setShowAddModal(false)} />}
    </div>
  );
};

// ─── Add Source Modal ────────────────────────────────────────────────────────

interface AddSourceModalProps {
  onSelect: (type: 'nomina' | 'autonomo' | 'pension' | 'otros') => void;
  onClose: () => void;
}

const ADD_OPTIONS: { type: 'nomina' | 'autonomo' | 'pension' | 'otros'; label: string; desc: string; icon: React.ElementType }[] = [
  { type: 'nomina', label: 'Nómina', desc: 'Ingreso salarial por cuenta ajena', icon: Banknote },
  { type: 'autonomo', label: 'Actividad autónoma', desc: 'Ingresos por cuenta propia', icon: Briefcase },
  { type: 'pension', label: 'Pensión', desc: 'Jubilación, viudedad u otras', icon: PiggyBank },
  { type: 'otros', label: 'Otros ingresos', desc: 'Prestaciones, subsidios, etc.', icon: Coins },
];

const AddSourceModal: React.FC<AddSourceModalProps> = ({ onSelect, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">Añadir fuente de ingreso</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>
      <div className="space-y-2">
        {ADD_OPTIONS.map(opt => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.type}
              onClick={() => onSelect(opt.type)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-200 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Icon size={16} className="text-blue-900" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default IngresosUnifiedManager;
