import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { calcularDeclaracionIRPF, DeclaracionIRPF } from '../../../../services/irpfCalculationService';
import { generarEventosFiscales, EventoFiscal } from '../../../../services/fiscalPaymentsService';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const FiscalDashboard: React.FC = () => {
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [declaracion, setDeclaracion] = useState<DeclaracionIRPF | null>(null);
  const [eventos, setEventos] = useState<EventoFiscal[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const decl = await calcularDeclaracionIRPF(ejercicio);
      setDeclaracion(decl);
      const ev = await generarEventosFiscales(ejercicio, decl);
      setEventos(ev);
    } catch (e) {
      console.error('Error loading fiscal dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [ejercicio]);

  useEffect(() => { loadData(); }, [loadData]);

  const proximosEventos = eventos
    .filter(e => !e.pagado && new Date(e.fechaLimite) >= new Date())
    .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite))
    .slice(0, 3);

  return (
    <PageLayout
      title="Fiscalidad — Dashboard"
      subtitle="Resumen fiscal del ejercicio"
    >
      {/* Year selector */}
      <div className="flex justify-end mb-4">
        <select
          value={ejercicio}
          onChange={e => setEjercicio(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {loading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {!loading && declaracion && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">IRPF estimado</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(declaracion.liquidacion.cuotaLiquida)}</p>
              <p className="text-xs text-gray-500 mt-1">Tipo efectivo: {declaracion.tipoEfectivo.toFixed(1)}%</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Retenciones acumuladas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(declaracion.retenciones.total)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Trabajo: {fmt(declaracion.retenciones.trabajo)} · Capital: {fmt(declaracion.retenciones.capitalMobiliario)}
              </p>
            </div>

            <div className={`border rounded-lg p-5 shadow-sm ${declaracion.resultado >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-cyan-50 border-cyan-200'}`}>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Resultado provisional</p>
              <div className="flex items-center gap-2 mt-1">
                {declaracion.resultado >= 0
                  ? <TrendingUp className="w-5 h-5 text-blue-700" />
                  : <TrendingDown className="w-5 h-5 text-cyan-700" />}
                <p className={`text-2xl font-bold ${declaracion.resultado >= 0 ? 'text-blue-800' : 'text-cyan-800'}`}>
                  {fmt(Math.abs(declaracion.resultado))}
                </p>
              </div>
              <p className={`text-xs mt-1 font-medium ${declaracion.resultado >= 0 ? 'text-blue-700' : 'text-cyan-700'}`}>
                {declaracion.resultado >= 0 ? 'A pagar' : 'A devolver'}
              </p>
            </div>
          </div>

          {/* Base breakdown */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Desglose de rentas</h3>
            <div className="space-y-3">
              {declaracion.baseGeneral.rendimientosTrabajo && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Trabajo (nómina)</span>
                  <span className="text-sm font-medium">{fmt(declaracion.baseGeneral.rendimientosTrabajo.rendimientoNeto)}</span>
                </div>
              )}
              {declaracion.baseGeneral.rendimientosAutonomo && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Actividades económicas (autónomo)</span>
                  <span className="text-sm font-medium">{fmt(declaracion.baseGeneral.rendimientosAutonomo.rendimientoNeto)}</span>
                </div>
              )}
              {declaracion.baseGeneral.rendimientosInmuebles.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Rendimientos inmobiliarios</span>
                  <span className="text-sm font-medium">
                    {fmt(declaracion.baseGeneral.rendimientosInmuebles.reduce((s, i) => s + i.rendimientoNeto, 0))}
                  </span>
                </div>
              )}
              {declaracion.baseGeneral.imputacionRentas.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Imputación rentas inmuebles vacíos</span>
                  <span className="text-sm font-medium">
                    {fmt(declaracion.baseGeneral.imputacionRentas.reduce((s, i) => s + i.imputacion, 0))}
                  </span>
                </div>
              )}
              {declaracion.baseAhorro.total > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Base del ahorro</span>
                  <span className="text-sm font-medium">{fmt(declaracion.baseAhorro.total)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between items-center font-semibold">
                <span className="text-sm text-gray-900">Base imponible total</span>
                <span className="text-sm">
                  {fmt(declaracion.liquidacion.baseImponibleGeneral + declaracion.liquidacion.baseImponibleAhorro)}
                </span>
              </div>
            </div>
          </div>

          {/* Próximos pagos */}
          {proximosEventos.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Próximos pagos fiscales
              </h3>
              <div className="space-y-2">
                {proximosEventos.map((e, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.descripcion}</p>
                      <p className="text-xs text-gray-500">Límite: {new Date(e.fechaLimite).toLocaleDateString('es-ES')}</p>
                    </div>
                    <span className={`text-sm font-semibold ${e.importe >= 0 ? 'text-blue-700' : 'text-cyan-700'}`}>
                      {fmt(Math.abs(e.importe))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertas */}
          {declaracion.baseAhorro.gananciasYPerdidas.minusvaliasPendientes > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-atlas-teal flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-800">Minusvalías pendientes de compensar</p>
                <p className="text-xs text-gray-600 mt-1">
                  Tienes {fmt(declaracion.baseAhorro.gananciasYPerdidas.minusvaliasPendientes)} en minusvalías que puedes compensar en los próximos 4 años.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
};

export default FiscalDashboard;
