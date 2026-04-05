import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nominaService } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { Nomina, CalculoNominaResult } from '../../../types/personal';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';

const NominaManager: React.FC = () => {
  const navigate = useNavigate();
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [calculos, setCalculos] = useState<Map<number, CalculoNominaResult>>(new Map());
  const [loading, setLoading] = useState(true);

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
      toast.error('Error al cargar las nóminas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNomina = () => { navigate('/gestion/personal/nueva-nomina'); };
  const handleEditNomina   = (_nomina: Nomina) => { navigate('/gestion/personal/nueva-nomina'); };

  const handleDeleteNomina = async (id: number) => {
    const confirmed = await confirmDelete('esta nómina');
    if (!confirmed) return;
    try {
      await nominaService.deleteNomina(id);
      toast.success('Nómina eliminada correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar la nómina');
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
        <span className="ml-2 text-neutral-600">Cargando nóminas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--gray-900)' }}>Gestión de Nóminas</h3>
          <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
            Configura y gestiona tus nóminas con distribución, variables y bonus
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
          Nueva Nómina
        </button>
      </div>

      {/* Empty state */}
      {nominas.length === 0 && (
        <div className="bg-white border p-12 text-center" style={{ borderColor: 'var(--gray-200)' }}>
          <DollarSign className="mx-auto h-12 w-12" style={{ color: 'var(--gray-300)' }} />
          <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--gray-900)' }}>No hay nóminas configuradas</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--gray-500)' }}>
            Crea tu primera nómina para empezar a gestionar tus ingresos salariales.
          </p>
          <div className="mt-6">
            <button
              onClick={handleCreateNomina}
              className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-md"
              style={{ backgroundColor: 'var(--blue-800)' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera Nómina
            </button>
          </div>
        </div>
      )}

      {/* Nóminas list */}
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
                  {/* pagas — gris neutro */}
                  <span className="px-2 py-0.5 text-xs rounded"
                        style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                    {pagasCount} pagas
                  </span>
                  {/* activa — turquesa si activa, gris si no */}
                  <span className="px-2 py-0.5 text-xs rounded"
                        style={nomina.activa
                          ? { background: 'var(--s-pos-bg)', color: 'var(--s-pos)', border: '1px solid color-mix(in srgb, var(--s-pos) 25%, var(--white))' }
                          : { background: 'var(--gray-100)', color: 'var(--gray-400)' }}>
                    {nomina.activa ? 'Activa' : 'Inactiva'}
                  </span>
                  {/* titular — azul */}
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
                  {/* Neto anual — color de dato base (azul) */}
                  <div className="bg-white border p-4" style={{ borderColor: 'var(--gray-200)' }}>
                    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--gray-500)' }}>Neto Anual</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--blue)' }}>
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
                      <p className="text-xs" style={{ color: 'var(--gray-400)' }}>% Retención Efectiva</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--gray-900)' }}>
                        {calculo.totalAnualBruto > 0
                          ? ((1 - calculo.totalAnualNeto / calculo.totalAnualBruto) * 100).toFixed(1)
                          : '0.0'}%
                      </p>
                    </div>
                  </div>
                )}

                {/* Gráfico barras apiladas — 4 conceptos de nómina según Design Bible */}
                {calculo && calculo.distribucionMensual.length > 0 && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--gray-100)' }}>
                    <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--gray-500)' }}>
                      Distribución mensual neto
                    </p>
                    <div className="flex items-end justify-between gap-1" style={{ height: '170px' }}>
                      {(() => {
                        const maxNeto = Math.max(...calculo.distribucionMensual.map(m => Math.max(m.netoTotal, 0)));
                        return calculo.distribucionMensual.map((m) => {
                          const netoTotalMes = Math.max(m.netoTotal, 0);
                          const netoRatio = m.totalDevengado > 0 ? netoTotalMes / m.totalDevengado : 0;

                          const salarioBaseNeto = m.salarioBase * netoRatio;
                          const pagaExtraNeta = m.pagaExtra * netoRatio;
                          const variablesNetas = m.variables * netoRatio;
                          const bonusNeto = m.bonus * netoRatio;

                          const totalHeight = maxNeto > 0 ? (netoTotalMes / maxNeto) * 124 : 0;
                          const basePct = netoTotalMes > 0 ? salarioBaseNeto / netoTotalMes : 0;
                          const extrasPct = netoTotalMes > 0 ? pagaExtraNeta / netoTotalMes : 0;
                          const variablesPct = netoTotalMes > 0 ? variablesNetas / netoTotalMes : 0;
                          const bonusPct = netoTotalMes > 0 ? bonusNeto / netoTotalMes : 0;

                          return (
                            <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end">
                              <span className="mb-0.5 w-full truncate text-center text-[10px] leading-none" style={{ color: 'var(--gray-500)' }}>
                                {netoTotalMes.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                              </span>
                              <div
                                className="flex w-full flex-col overflow-hidden rounded-t"
                                style={{ height: `${totalHeight}px`, minHeight: '2px' }}
                                title={formatCurrency(netoTotalMes)}
                              >
                                <div style={{ height: `${basePct * 100}%`, backgroundColor: 'var(--c1)' }} />
                                <div style={{ height: `${extrasPct * 100}%`, backgroundColor: 'var(--c2)' }} />
                                <div style={{ height: `${variablesPct * 100}%`, backgroundColor: 'var(--c3)' }} />
                                <div style={{ height: `${bonusPct * 100}%`, backgroundColor: 'var(--c4)' }} />
                              </div>
                              <span className="mt-1 text-xs" style={{ color: 'var(--gray-400)' }}>
                                {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m.mes - 1]}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    {/* Leyenda 4 colores: base, pagas extra, variables y bonus */}
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--gray-500)' }}>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--c1)' }} />Salario base</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--c2)' }} />Pagas extra</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--c3)' }} />Variables</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--c4)' }} />Bonus</span>
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
