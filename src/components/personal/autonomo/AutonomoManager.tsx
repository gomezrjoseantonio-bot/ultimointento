import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { autonomoService } from '../../../services/autonomoService';
import { personalDataService } from '../../../services/personalDataService';
import { Autonomo, FuenteIngreso, GastoRecurrenteActividad } from '../../../types/personal';
import { Plus, Edit2, Trash2, Euro, TrendingUp, TrendingDown, BarChart2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';

const MESES_NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TODOS_LOS_MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface MonthSelectorProps {
  selected: number[];
  onChange: (meses: number[]) => void;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({ selected, onChange }) => {
  const toggleMes = (mes: number) => {
    onChange(selected.includes(mes)
      ? selected.filter(m => m !== mes)
      : [...selected, mes].sort((a, b) => a - b));
  };
  const allSelected = selected.length === 12;
  return (
    <div>
      <button
        type="button"
        onClick={() => onChange(allSelected ? [] : TODOS_LOS_MESES)}
        className="text-xs px-2 py-1 border mb-2 rounded"
        style={allSelected
          ? { background: 'var(--blue-800)', color: 'white', borderColor: 'var(--blue-800)' }
          : { background: 'white', color: 'var(--gray-700)', borderColor: 'var(--gray-300)' }}
      >
        {allSelected ? 'Quitar todos' : 'Todos los meses'}
      </button>
      <div className="grid grid-cols-6 gap-1">
        {MESES_NOMBRES.map((nombre, i) => {
          const mes = i + 1;
          const active = selected.includes(mes);
          return (
            <button
              key={mes}
              type="button"
              onClick={() => toggleMes(mes)}
              className="text-xs py-1 border rounded transition-colors"
              style={active
                ? { background: 'var(--blue-800)', color: 'white', borderColor: 'var(--blue-800)' }
                : { background: 'white', color: 'var(--gray-700)', borderColor: 'var(--gray-300)' }}
            >
              {nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AutonomoManager: React.FC = () => {
  const navigate = useNavigate();
  const [autonomos, setAutonomos] = useState<Autonomo[]>([]);
  const [selectedAutonomoId, setSelectedAutonomoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [showFuenteForm, setShowFuenteForm] = useState(false);
  const [editingFuenteId, setEditingFuenteId] = useState<string | null>(null);
  const [fuenteFormData, setFuenteFormData] = useState({ nombre: '', importeEstimado: '', meses: TODOS_LOS_MESES as number[], diaCobro: '1', aplIrpf: false, aplIva: false });

  const [showGastoActividadForm, setShowGastoActividadForm] = useState(false);
  const [editingGastoId, setEditingGastoId] = useState<string | null>(null);
  const [gastoActividadFormData, setGastoActividadFormData] = useState({
    descripcion: '', importe: '', categoria: 'asesoria', meses: TODOS_LOS_MESES as number[], diaPago: '1'
  });

  const selectedAutonomo = autonomos.find(a => a.id === selectedAutonomoId) || null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        const autonomosData = await autonomoService.getAutonomos(personalData.id);
        setAutonomos(autonomosData);
        setSelectedAutonomoId(prev => {
          if (prev && autonomosData.some(a => a.id === prev)) return prev;
          return autonomosData[0]?.id ?? null;
        });
      }
    } catch (error) {
      toast.error('Error al cargar las actividades económicas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateAutonomo = () => { navigate('/gestion/personal/nueva-actividad'); };
  const handleEditAutonomo   = (_autonomo: Autonomo) => { navigate('/gestion/personal/nueva-actividad'); };

  const handleDeleteAutonomo = async (id: number) => {
    const confirmed = await confirmDelete('esta configuración de autónomo');
    if (!confirmed) return;
    try {
      await autonomoService.deleteAutonomo(id);
      toast.success('Actividad eliminada');
      loadData();
    } catch { toast.error('Error al eliminar la configuración'); }
  };

  const handleEditFuenteIngreso = (fuente: FuenteIngreso) => {
    setFuenteFormData({ nombre: fuente.nombre, importeEstimado: fuente.importeEstimado.toString(), meses: fuente.meses?.length ? fuente.meses : TODOS_LOS_MESES, diaCobro: (fuente.diaCobro ?? 1).toString(), aplIrpf: fuente.aplIrpf ?? false, aplIva: fuente.aplIva ?? false });
    setEditingFuenteId(fuente.id!);
    setShowFuenteForm(true);
  };

  const handleAddFuenteIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAutonomo) return;
    const importe = parseFloat(fuenteFormData.importeEstimado);
    if (!fuenteFormData.nombre || isNaN(importe) || importe <= 0) { toast.error('Completa todos los campos'); return; }
    if (!fuenteFormData.meses.length) { toast.error('Selecciona al menos un mes'); return; }
    try {
      const diaCobro = parseInt(fuenteFormData.diaCobro, 10);
      if (isNaN(diaCobro) || diaCobro < 1 || diaCobro > 31) { toast.error('Indica un día de cobro válido (1-31)'); return; }
      const fuente: Omit<FuenteIngreso, 'id'> = { nombre: fuenteFormData.nombre, importeEstimado: importe, meses: fuenteFormData.meses, diaCobro, aplIrpf: fuenteFormData.aplIrpf, aplIva: fuenteFormData.aplIva };
      if (editingFuenteId) { await autonomoService.updateFuenteIngreso(selectedAutonomo.id!, editingFuenteId, fuente); toast.success('Concepto actualizado'); }
      else { await autonomoService.addFuenteIngreso(selectedAutonomo.id!, fuente); toast.success('Concepto añadido'); }
      setFuenteFormData({ nombre: '', importeEstimado: '', meses: TODOS_LOS_MESES, diaCobro: '1', aplIrpf: false, aplIva: false });
      setEditingFuenteId(null); setShowFuenteForm(false); loadData();
    } catch { toast.error('Error al guardar concepto de ingreso'); }
  };

  const handleRemoveFuenteIngreso = async (fuenteId: string) => {
    if (!selectedAutonomo) return;
    if (!(await confirmDelete('este concepto de ingreso'))) return;
    try { await autonomoService.removeFuenteIngreso(selectedAutonomo.id!, fuenteId); toast.success('Concepto eliminado'); loadData(); }
    catch { toast.error('Error al eliminar'); }
  };

  const handleCancelFuenteForm = () => { setShowFuenteForm(false); setEditingFuenteId(null); setFuenteFormData({ nombre: '', importeEstimado: '', meses: TODOS_LOS_MESES, diaCobro: '1', aplIrpf: false, aplIva: false }); };

  const handleEditGastoRecurrente = (gasto: GastoRecurrenteActividad) => {
    setGastoActividadFormData({ descripcion: gasto.descripcion, importe: gasto.importe.toString(), categoria: gasto.categoria, meses: gasto.meses?.length ? gasto.meses : TODOS_LOS_MESES, diaPago: (gasto.diaPago ?? 1).toString() });
    setEditingGastoId(gasto.id!); setShowGastoActividadForm(true);
  };

  const handleAddGastoRecurrente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAutonomo) return;
    const importe = parseFloat(gastoActividadFormData.importe);
    if (!gastoActividadFormData.descripcion || isNaN(importe) || importe <= 0) { toast.error('Completa todos los campos'); return; }
    if (!gastoActividadFormData.meses.length) { toast.error('Selecciona al menos un mes'); return; }
    try {
      const diaPago = parseInt(gastoActividadFormData.diaPago, 10);
      if (isNaN(diaPago) || diaPago < 1 || diaPago > 31) { toast.error('Indica un día de pago válido (1-31)'); return; }
      const gasto: Omit<GastoRecurrenteActividad, 'id'> = { descripcion: gastoActividadFormData.descripcion, importe, categoria: gastoActividadFormData.categoria, meses: gastoActividadFormData.meses, diaPago };
      if (editingGastoId) { await autonomoService.updateGastoRecurrenteActividad(selectedAutonomo.id!, editingGastoId, gasto); toast.success('Concepto actualizado'); }
      else { await autonomoService.addGastoRecurrenteActividad(selectedAutonomo.id!, gasto); toast.success('Concepto añadido'); }
      setGastoActividadFormData({ descripcion: '', importe: '', categoria: 'asesoria', meses: TODOS_LOS_MESES, diaPago: '1' });
      setEditingGastoId(null); setShowGastoActividadForm(false); loadData();
    } catch { toast.error('Error al guardar concepto de gasto'); }
  };

  const handleRemoveGastoRecurrente = async (gastoId: string) => {
    if (!selectedAutonomo) return;
    if (!(await confirmDelete('este concepto de gasto'))) return;
    try { await autonomoService.removeGastoRecurrenteActividad(selectedAutonomo.id!, gastoId); toast.success('Concepto eliminado'); loadData(); }
    catch { toast.error('Error al eliminar'); }
  };

  const handleCancelGastoForm = () => { setShowGastoActividadForm(false); setEditingGastoId(null); setGastoActividadFormData({ descripcion: '', importe: '', categoria: 'asesoria', meses: TODOS_LOS_MESES, diaPago: '1' }); };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatNetoShort = (neto: number) => {
    const sign = neto >= 0 ? '+ ' : '- ';
    return `${sign}${Math.abs(Math.round(neto)).toLocaleString('es-ES')}`;
  };

  const renderMesesBadges = (meses: number[]) => {
    if (meses.length === 12) return <span className="text-xs" style={{ color: 'var(--gray-400)' }}>Todos los meses</span>;
    return <span className="text-xs" style={{ color: 'var(--gray-400)' }}>{meses.map(m => MESES_NOMBRES[m - 1]).join(', ')}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-t-transparent rounded-full"
             style={{ borderColor: 'var(--blue-800)', borderTopColor: 'transparent' }} />
        <span className="ml-2" style={{ color: 'var(--gray-500)' }}>Cargando datos de autónomo...</span>
      </div>
    );
  }

  const estimated   = selectedAutonomo ? autonomoService.calculateEstimatedAnnual(selectedAutonomo) : null;
  const monthlyDist = selectedAutonomo ? autonomoService.getMonthlyDistribution(selectedAutonomo) : null;

  // Estilos reutilizables
  const cardStyle  = { background: 'white', border: '1px solid var(--gray-200)' };
  const inputStyle = { borderColor: 'var(--gray-200)', fontSize: '0.875rem' };
  const btnPrimary = { background: 'var(--blue-800)', color: 'white' };
  const btnOutline = { background: 'white', color: 'var(--gray-700)', border: '1px solid var(--gray-300)' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium" style={{ color: 'var(--gray-900)' }}>Actividades económicas (IAE)</h3>
          <p className="text-sm" style={{ color: 'var(--gray-500)' }}>Registra varias actividades activas, con su epígrafe IAE y una única cuota SS compartida</p>
        </div>
        <button onClick={handleCreateAutonomo}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded"
                style={btnPrimary}>
          <Plus className="w-4 h-4 mr-2" /> Añadir actividad
        </button>
      </div>

      {/* Empty state */}
      {autonomos.length === 0 && (
        <div className="bg-white border p-12 text-center rounded" style={{ borderColor: 'var(--gray-200)' }}>
          <Euro className="mx-auto h-12 w-12" style={{ color: 'var(--gray-300)' }} />
          <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--gray-900)' }}>No hay actividades económicas registradas</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--gray-500)' }}>Añade tu primera actividad para empezar a proyectar ingresos y gastos.</p>
          <div className="mt-6">
            <button onClick={handleCreateAutonomo} className="inline-flex items-center px-4 py-2 text-sm font-medium rounded" style={btnPrimary}>
              <Plus className="w-4 h-4 mr-2" /> Crear primera actividad
            </button>
          </div>
        </div>
      )}

      {/* Selector de perfil */}
      {autonomos.length > 0 && (
        <div className="bg-white border px-6 py-4 flex items-center justify-between rounded shadow-sm" style={{ borderColor: 'var(--gray-200)' }}>
          <div className="flex items-center space-x-3">
            {autonomos.length === 1
              ? <span className="font-medium" style={{ color: 'var(--gray-900)' }}>{selectedAutonomo?.descripcionActividad || selectedAutonomo?.nombre}</span>
              : (
                <div className="relative inline-flex items-center">
                  <select value={selectedAutonomoId ?? ''} onChange={(e) => setSelectedAutonomoId(parseInt(e.target.value, 10))}
                          className="appearance-none pl-3 pr-8 py-2 border text-sm font-medium bg-white focus:outline-none"
                          style={{ borderColor: 'var(--gray-200)', color: 'var(--gray-900)' }}>
                    {autonomos.map(a => <option key={a.id} value={a.id}>{`${a.descripcionActividad || a.nombre}${a.epigrafeIAE ? ` · IAE ${a.epigrafeIAE}` : ''}`}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 w-4 h-4" style={{ color: 'var(--gray-400)' }} />
                </div>
              )}
            {selectedAutonomo?.tipoActividad && (
              <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                {selectedAutonomo.tipoActividad} · IAE {selectedAutonomo.epigrafeIAE || 'sin epígrafe'}
              </span>
            )}
            {selectedAutonomo?.cuotaAutonomosCompartida && (
              <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--blue-50, #eff6ff)', color: 'var(--blue-800)' }}>
                Cuota SS compartida: {formatCurrency(selectedAutonomo.cuotaAutonomos)}/mes
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {selectedAutonomo && (
              <>
                <button onClick={() => handleEditAutonomo(selectedAutonomo)} className="p-2 transition-colors" style={{ color: 'var(--gray-400)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--gray-700)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray-400)')}>
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteAutonomo(selectedAutonomo.id!)} className="p-2 transition-colors" style={{ color: 'var(--gray-400)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--alert)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray-400)')}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Resumen anual */}
      {selectedAutonomo && estimated && (
        <div className="bg-white border p-6 rounded shadow-sm" style={{ borderColor: 'var(--gray-200)' }}>
          <h4 className="text-sm font-semibold flex items-center mb-4" style={{ color: 'var(--gray-900)' }}>
            <Euro className="w-4 h-4 mr-2" style={{ color: 'var(--gray-500)' }} /> Resumen Anual Estimado
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border p-4 rounded" style={cardStyle}>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--gray-500)' }}>Ingresos Previstos Anuales</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--gray-900)' }}>{formatCurrency(estimated.facturacionBruta)}</p>
            </div>
            <div className="border p-4 rounded" style={cardStyle}>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--gray-500)' }}>Gastos Previstos Anuales</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--gray-900)' }}>{formatCurrency(estimated.totalGastos)}</p>
            </div>
            <div className="border p-4 rounded" style={cardStyle}>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--gray-500)' }}>Rendimiento Neto Estimado</p>
              {/* Neto estimado: semántico positivo/negativo */}
              <p className="text-2xl font-bold" style={{ color: estimated.rendimientoNeto >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                {formatCurrency(estimated.rendimientoNeto)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico mensual */}
      {selectedAutonomo && monthlyDist && (
        <div className="bg-white border p-6 rounded shadow-sm" style={{ borderColor: 'var(--gray-200)' }}>
          <h4 className="text-sm font-semibold flex items-center mb-4" style={{ color: 'var(--gray-900)' }}>
            <BarChart2 className="w-4 h-4 mr-2" style={{ color: 'var(--gray-500)' }} /> Distribución Mensual Prevista
          </h4>
          <div className="grid grid-cols-12 gap-1 text-center">
            {(() => {
              const maxIngresos = Math.max(...monthlyDist.map(d => d.ingresos)) || 1;
              const maxGastos   = Math.max(...monthlyDist.map(d => d.gastos))   || 1;
              return monthlyDist.map(({ mes, ingresos, gastos, neto }) => (
                <div key={mes} className="flex flex-col items-center">
                  <span className="text-xs mb-1" style={{ color: 'var(--gray-400)' }}>{MESES_NOMBRES[mes - 1]}</span>
                  <div className="w-full space-y-0.5">
                    {ingresos > 0 && (
                      <div className="w-full rounded-sm"
                           style={{ height: `${Math.max(4, Math.round(ingresos / maxIngresos * 40))}px`, backgroundColor: 'var(--blue-800)' }}
                           title={`Ingresos: ${formatCurrency(ingresos)}`} />
                    )}
                    {gastos > 0 && (
                      <div className="w-full rounded-sm"
                           style={{ height: `${Math.max(4, Math.round(gastos / maxGastos * 20))}px`, backgroundColor: 'var(--gray-300)' }}
                           title={`Gastos: ${formatCurrency(gastos)}`} />
                    )}
                  </div>
                  {/* neto: semántico positivo/negativo */}
                  <span className="text-[10px] mt-1 font-medium leading-tight"
                        style={{ color: neto >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                    {formatNetoShort(neto)}
                  </span>
                </div>
              ));
            })()}
          </div>
          <div className="flex items-center space-x-4 mt-3 text-xs" style={{ color: 'var(--gray-500)' }}>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--blue-800)' }} />Ingresos</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--gray-300)' }} />Gastos</span>
          </div>
        </div>
      )}

      {/* Conceptos de Ingreso */}
      {selectedAutonomo && (
        <div className="bg-white border p-6 rounded shadow-sm" style={{ borderColor: 'var(--gray-200)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center" style={{ color: 'var(--gray-900)' }}>
              <TrendingUp className="w-4 h-4 mr-2" style={{ color: 'var(--gray-500)' }} /> Conceptos de Ingreso Previstos
            </h4>
            <button onClick={() => { handleCancelFuenteForm(); setShowFuenteForm(!showFuenteForm); }}
                    className="inline-flex items-center px-3 py-1.5 text-sm rounded" style={btnOutline}>
              <Plus className="w-4 h-4 mr-1" /> Añadir concepto
            </button>
          </div>

          {showFuenteForm && (
            <form onSubmit={handleAddFuenteIngreso} className="mb-4 p-4 border rounded space-y-3"
                  style={{ borderColor: 'var(--gray-200)', background: 'var(--gray-050)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--gray-700)' }}>{editingFuenteId ? 'Editar concepto' : 'Nuevo concepto de ingreso'}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--gray-700)' }}>Concepto *</label>
                  <input type="text" value={fuenteFormData.nombre} onChange={e => setFuenteFormData(p => ({ ...p, nombre: e.target.value }))}
                         className="w-full px-3 py-2 border rounded text-sm focus:outline-none" style={inputStyle} placeholder="Ej: Facturación Cliente A" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--gray-700)' }}>Importe (€) *</label>
                  <input type="number" step="0.01" value={fuenteFormData.importeEstimado} onChange={e => setFuenteFormData(p => ({ ...p, importeEstimado: e.target.value }))}
                         className="w-full px-3 py-2 border rounded text-sm focus:outline-none" style={inputStyle} placeholder="5000.00" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--gray-700)' }}>Día de cobro *</label>
                  <input type="number" min="1" max="31" value={fuenteFormData.diaCobro} onChange={e => setFuenteFormData(p => ({ ...p, diaCobro: e.target.value }))}
                         className="w-full px-3 py-2 border rounded text-sm focus:outline-none" style={inputStyle} placeholder="5" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--gray-700)' }}>Meses de Impacto *</label>
                <MonthSelector selected={fuenteFormData.meses} onChange={meses => setFuenteFormData(p => ({ ...p, meses }))} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={fuenteFormData.aplIrpf} onChange={e => setFuenteFormData(p => ({ ...p, aplIrpf: e.target.checked }))} className="h-4 w-4 rounded" />
                  <span className="text-xs" style={{ color: 'var(--gray-700)' }}>Aplica IRPF</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={fuenteFormData.aplIva} onChange={e => setFuenteFormData(p => ({ ...p, aplIva: e.target.checked }))} className="h-4 w-4 rounded" />
                  <span className="text-xs" style={{ color: 'var(--gray-700)' }}>Aplica IVA</span>
                </label>
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={handleCancelFuenteForm} className="px-3 py-1.5 text-sm rounded" style={btnOutline}>Cancelar</button>
                <button type="submit" className="px-3 py-1.5 text-sm rounded" style={btnPrimary}>{editingFuenteId ? 'Actualizar' : 'Guardar'}</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {(selectedAutonomo.fuentesIngreso || []).map(fuente => {
              const meses = fuente.meses?.length ? fuente.meses : TODOS_LOS_MESES;
              return (
                <div key={fuente.id} className="flex items-center justify-between p-3 border rounded" style={{ borderColor: 'var(--gray-200)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: 'var(--gray-900)' }}>{fuente.nombre}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-sm" style={{ color: 'var(--gray-600)' }}>{formatCurrency(fuente.importeEstimado)}/vez</span>
                      <span style={{ color: 'var(--gray-300)' }}>·</span>
                      {renderMesesBadges(meses)}
                      <span style={{ color: 'var(--gray-300)' }}>·</span>
                      <span className="text-xs" style={{ color: 'var(--gray-500)' }}>Día {fuente.diaCobro ?? 1}</span>
                      <span style={{ color: 'var(--gray-300)' }}>·</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--gray-700)' }}>Anual: {formatCurrency(fuente.importeEstimado * meses.length)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-3">
                    <button onClick={() => handleEditFuenteIngreso(fuente)} className="p-1" style={{ color: 'var(--gray-400)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--gray-700)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray-400)')}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRemoveFuenteIngreso(fuente.id!)} className="p-1" style={{ color: 'var(--gray-400)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--alert)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray-400)')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {!(selectedAutonomo.fuentesIngreso || []).length && (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--gray-400)' }}>No hay conceptos de ingreso registrados</p>
            )}
          </div>
        </div>
      )}

      {/* Conceptos de Gasto */}
      {selectedAutonomo && (
        <div className="bg-white border p-6 rounded shadow-sm" style={{ borderColor: 'var(--gray-200)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center" style={{ color: 'var(--gray-900)' }}>
              <TrendingDown className="w-4 h-4 mr-2" style={{ color: 'var(--gray-500)' }} /> Conceptos de Gasto de la Actividad
            </h4>
            <button onClick={() => { handleCancelGastoForm(); setShowGastoActividadForm(!showGastoActividadForm); }}
                    className="inline-flex items-center px-3 py-1.5 text-sm rounded" style={btnOutline}>
              <Plus className="w-4 h-4 mr-1" /> Añadir concepto
            </button>
          </div>

          {/* Cuota fija SS */}
          <div className="flex items-center justify-between p-3 border rounded mb-2" style={{ borderColor: 'var(--gray-200)' }}>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm" style={{ color: 'var(--gray-900)' }}>Cuota de Autónomos (SS)</p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-sm" style={{ color: 'var(--gray-600)' }}>{formatCurrency(selectedAutonomo.cuotaAutonomos)}/mes</span>
                <span style={{ color: 'var(--gray-300)' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--gray-400)' }}>Todos los meses</span>
                <span style={{ color: 'var(--gray-300)' }}>·</span>
                <span className="text-xs font-medium" style={{ color: 'var(--gray-700)' }}>Anual: {formatCurrency(selectedAutonomo.cuotaAutonomos * 12)}</span>
              </div>
            </div>
          </div>

          {showGastoActividadForm && (
            <form onSubmit={handleAddGastoRecurrente} className="mb-4 p-4 border rounded space-y-3"
                  style={{ borderColor: 'var(--gray-200)', background: 'var(--gray-050)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--gray-700)' }}>{editingGastoId ? 'Editar concepto' : 'Nuevo concepto de gasto'}</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--gray-700)' }}>Descripción *</label>
                  <input type="text" value={gastoActividadFormData.descripcion} onChange={e => setGastoActividadFormData(p => ({ ...p, descripcion: e.target.value }))}
                         className="w-full px-3 py-2 border rounded text-sm focus:outline-none" style={inputStyle} placeholder="Ej: Licencia Software" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--gray-700)' }}>Importe (€) *</label>
                  <input type="number" step="0.01" value={gastoActividadFormData.importe} onChange={e => setGastoActividadFormData(p => ({ ...p, importe: e.target.value }))}
                         className="w-full px-3 py-2 border rounded text-sm focus:outline-none" style={inputStyle} placeholder="300.00" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--gray-700)' }}>Categoría</label>
                  <select value={gastoActividadFormData.categoria} onChange={e => setGastoActividadFormData(p => ({ ...p, categoria: e.target.value }))}
                          className="w-full px-3 py-2 border rounded text-sm focus:outline-none" style={inputStyle}>
                    <option value="asesoria">Gestoría / Asesoría</option>
                    <option value="seguros">Seguros RC</option>
                    <option value="software">Software / Licencias</option>
                    <option value="telefono-internet">Teléfono e Internet</option>
                    <option value="alquiler">Alquiler de local</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--gray-700)' }}>Día de pago *</label>
                  <input type="number" min="1" max="31" value={gastoActividadFormData.diaPago} onChange={e => setGastoActividadFormData(p => ({ ...p, diaPago: e.target.value }))}
                         className="w-full px-3 py-2 border rounded text-sm focus:outline-none" style={inputStyle} placeholder="5" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--gray-700)' }}>Meses de Impacto *</label>
                <MonthSelector selected={gastoActividadFormData.meses} onChange={meses => setGastoActividadFormData(p => ({ ...p, meses }))} />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={handleCancelGastoForm} className="px-3 py-1.5 text-sm rounded" style={btnOutline}>Cancelar</button>
                <button type="submit" className="px-3 py-1.5 text-sm rounded" style={btnPrimary}>{editingGastoId ? 'Actualizar' : 'Guardar'}</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {(selectedAutonomo.gastosRecurrentesActividad || []).map(gasto => {
              const meses = gasto.meses?.length ? gasto.meses : TODOS_LOS_MESES;
              return (
                <div key={gasto.id} className="flex items-center justify-between p-3 border rounded" style={{ borderColor: 'var(--gray-200)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: 'var(--gray-900)' }}>{gasto.descripcion}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-sm" style={{ color: 'var(--gray-600)' }}>{formatCurrency(gasto.importe)}/vez</span>
                      <span style={{ color: 'var(--gray-300)' }}>·</span>
                      {renderMesesBadges(meses)}
                      <span style={{ color: 'var(--gray-300)' }}>·</span>
                      <span className="text-xs" style={{ color: 'var(--gray-500)' }}>Día {gasto.diaPago ?? 1}</span>
                      <span style={{ color: 'var(--gray-300)' }}>·</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--gray-700)' }}>Anual: {formatCurrency(gasto.importe * meses.length)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-3">
                    <button onClick={() => handleEditGastoRecurrente(gasto)} className="p-1" style={{ color: 'var(--gray-400)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--gray-700)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray-400)')}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRemoveGastoRecurrente(gasto.id!)} className="p-1" style={{ color: 'var(--gray-400)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--alert)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray-400)')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {!(selectedAutonomo.gastosRecurrentesActividad || []).length && (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--gray-400)' }}>No hay conceptos de gasto registrados</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AutonomoManager;
