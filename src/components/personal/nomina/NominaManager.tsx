import React, { useState, useEffect } from 'react';
import { nominaService } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { Nomina, CalculoNominaResult } from '../../../types/personal';
import NominaForm from './NominaForm';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';

const NominaManager: React.FC = () => {
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [calculos, setCalculos] = useState<Map<number, CalculoNominaResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNomina, setEditingNomina] = useState<Nomina | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        const nominasData = await nominaService.getNominas(personalData.id);
        setNominas(nominasData);
        const calculosMap = new Map<number, CalculoNominaResult>();
        nominasData.forEach(nomina => {
          if (nomina.id) calculosMap.set(nomina.id, nominaService.calculateSalary(nomina));
        });
        setCalculos(calculosMap);
      }
    } catch (error) {
      console.error('Error loading nominas:', error);
      toast.error('Error al cargar las nÃ³minas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNomina = () => { setEditingNomina(null); setShowForm(true); };
  const handleEditNomina   = (nomina: Nomina) => { setEditingNomina(nomina); setShowForm(true); };
  const handleNominaSaved  = () => { setShowForm(false); setEditingNomina(null); loadData(); };

  const handleDeleteNomina = async (id: number) => {
    const confirmed = await confirmDelete('esta nÃ³mina');
    if (!confirmed) return;
    try {
      await nominaService.deleteNomina(id);
      toast.success('NÃ³mina eliminada correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar la nÃ³mina');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const getPagasCount = (nomina: Nomina): number => {
    if (nomina.distribucion.tipo === 'doce')   return 12;
    if (nomina.distribucion.tipo === 'catorce') return 14;
    return nomina.distribucion.meses;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-t-transparent rounded-full"
             style={{ borderColor: 'var(--blue-800)', borderTopColor: 'transparent' }} />
        <span className="ml-2 text-neutral-600">Cargando nÃ³minas...</span>
      </div>
    );
  }

  if (showForm) {
    return (
      <NominaForm
        isOpen={true}
        onClose={() => { setShowForm(false); setEditingNomina(null); }}
        nomina={editingNomina}
        onSaved={handleNominaSaved}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--gray-900)' }}>GestiÃ³n de NÃ³minas</h3>
          <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
            Configura y gestiona tus nÃ³minas con distribuciÃ³n, variables y bonus
          </p>
        </div>
        <button
          onClick={handleCreateNomina}
          className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-md transition-colors"
          style={{ backgroundColor: 'var(--blue-800)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--blue-700)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--blue-800)')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva NÃ³mina
        </button>
      </div>

      {/* Empty state */}
      {nominas.length === 0 && (
        <div className="bg-white border p-12 text-center" style={{ borderColor: 'var(--gray-200)' }}>
          <DollarSign className="mx-auto h-12 w-12" style={{ color: 'var(--gray-300)' }} />
          <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--gray-900)' }}>No hay nÃ³minas configuradas</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--gray-500)' }}>
            Crea tu primera nÃ³mina para empezar a gestionar tus ingresos salariales.
          </p>
          <div className="mt-6">
            <button
              onClick={handleCreateNomina}
              className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-md"
              style={{ backgroundColor: 'var(--blue-800)' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera NÃ³mina
            </button>
          </div>
        </div>
      )}

      {/* NÃ³minas list */}
      <div className="space-y-3">
        {nominas.map((nomina) => {
          const calculo = nomina.id ? calculos.get(nomina.id) : null;
          const pagasCount = getPagasCount(nomina);

          return (
            <div key={nomina.id}>
              {/* Header bar */}
              <div className="bg-white border rounded-t-lg px-5 py-3 flex items-center justify-between"
                   style={{ borderColor: 'var(--gray-200)' }}>
                <div className="flex items-center space-x-3">
                  <span className="font-semibold tracking-wide uppercase" style={{ color: 'var(--gray-900)' }}>
                    {nomina.nombre}
                  </span>
                  {/* pagas â€” gris neutro */}
                  <span className="px-2 py-0.5 text-xs rounded"
                        style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                    {pagasCount} pagas
                  </span>
                  {/* activa â€” turquesa si activa, gris si no */}
                  <span className="px-2 py-0.5 text-xs rounded"
                        style={nomina.activa
                          ? { background: 'var(--teal-050)', color: 'var(--teal-600)', border: '1px solid var(--teal-200)' }
                          : { background: 'var(--gray-100)', color: 'var(--gray-400)' }}>
                    {nomina.activa ? 'Activa' : 'Inactiva'}
                  </span>
                  {/* titular â€” azul */}
                  <span className="px-2 py-0.5 text-xs rounded"
                        style={{ background: 'var(--blue-050)', color: 'var(--blue-800)', border: '1px solid var(--blue-200)' }}>
                    {nomina.titular === 'yo' ? 'Titular' : 'Pareja'}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button onClick={() => handleEditNomina(nomina)}
                          className="p-2 transition-colors"
                          style={{ color: 'var(--gray-400)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--gray-700)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray-400)')}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteNomina(nomina.id!)}
                          className="p-2 transition-colors"
                          style={{ color: 'var(--gray-400)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--alert)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--gray-400)')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary card */}
              <div className="bg-white border border-t-0 rounded-b-lg p-5"
                   style={{ borderColor: 'var(--gray-200)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Bruto */}
                  <div className="bg-white border p-4" style={{ borderColor: 'var(--gray-200)' }}>
                    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--gray-500)' }}>Bruto Anual</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--gray-900)' }}>
                      {calculo ? formatCurrency(calculo.totalAnualBruto) : formatCurrency(nomina.salarioBrutoAnual)}
                    </p>
                  </div>
                  {/* Neto mensual */}
                  <div className="bg-white border p-4" style={{ borderColor: 'var(--gray-200)' }}>
                    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--gray-500)' }}>Neto Mensual Promedio</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--gray-900)' }}>
                      {calculo ? formatCurrency(calculo.netoMensual) : '-'}
                    </p>
                  </div>
                  {/* Neto anual â€” turquesa (positivo) */}
                  <div className="bg-white border p-4" style={{ borderColor: 'var(--gray-200)' }}>
                    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--gray-500)' }}>Neto Anual</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--teal-500)' }}>
                      {calculo ? formatCurrency(calculo.totalAnualNeto) : '-'}
                    </p>
                  </div>
                </div>

                {/* Retenciones */}
                {calculo && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3"
                       style={{ borderTop: '1px solid var(--gray-100)' }}>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--gray-400)' }}>SS Anual</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {formatCurrency(calculo.distribucionMensual.reduce((s, m) => s + m.ssTotal, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--gray-400)' }}>IRPF Anual</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {formatCurrency(calculo.distribucionMensual.reduce((s, m) => s + m.irpfImporte, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--gray-400)' }}>PP Anual</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {formatCurrency(calculo.totalAnualPP)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--gray-400)' }}>% RetenciÃ³n Efectiva</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {calculo.totalAnualBruto > 0
                          ? ((1 - calculo.totalAnualNeto / calculo.totalAnualBruto) * 100).toFixed(1)
                          : '0.0'}%
                      </p>
                    </div>
                  </div>
                )}

                {/* GrÃ¡fico barras â€” azul base, turquesa en meses con bonus/paga extra */}
                {calculo && calculo.distribucionMensual.length > 0 && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--gray-100)' }}>
                    <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--gray-500)' }}>
                      DistribuciÃ³n Mensual Neto
                    </p>
                    <div className="flex items-end justify-between gap-1" style={{ height: '160px' }}>
                      {(() => {
                        const maxNeto = Math.max(...calculo.distribucionMensual.map(m => m.netoTotal));
                        return calculo.distribucionMensual.map((m) => {
                          const barHeight = maxNeto > 0 ? (m.netoTotal / maxNeto) * 120 : 0;
                          const hasPagaExtra = m.pagaExtra > 0;
                          return (
                            <div key={m.mes} className="flex-1 flex flex-col items-center justify-end h-full">
                              <span className="text-[10px] leading-none text-center w-full truncate mb-0.5"
                                    style={{ color: 'var(--gray-500)' }}>
                                {m.netoTotal.toLocaleString('es-ES', { maximumFractionDigits: 0 })} â‚¬
                              </span>
                              <div
                                className="w-full rounded-t"
                                style={{
                                  height: `${barHeight}px`,
                                  minHeight: '2px',
                                  // turquesa = meses con paga extra / bonus; azul = base
                                  backgroundColor: hasPagaExtra ? 'var(--teal-500)' : 'var(--blue-800)'
                                }}
                                title={formatCurrency(m.netoTotal)}
                              />
                              <span className="text-xs mt-1" style={{ color: 'var(--gray-400)' }}>
                                {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m.mes - 1]}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    {/* Leyenda */}
                    <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--gray-500)' }}>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--blue-800)' }} />
                        Neto base
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--teal-500)' }} />
                        Con bonus / paga extra
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NominaManager;
