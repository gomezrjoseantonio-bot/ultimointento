import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Circle, Calendar } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { calcularDeclaracionIRPF } from '../../../../services/irpfCalculationService';
import {
  EventoFiscal,
  generarEventosFiscales,
  getConfiguracionFiscal,
  saveConfiguracionFiscal,
} from '../../../../services/fiscalPaymentsService';
import { ConfiguracionFiscal } from '../../../../services/db';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const PagosPage: React.FC = () => {
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [eventos, setEventos] = useState<EventoFiscal[]>([]);
  const [config, setConfig] = useState<ConfiguracionFiscal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [decl, cfg] = await Promise.all([
        calcularDeclaracionIRPF(ejercicio),
        getConfiguracionFiscal(),
      ]);
      setConfig(cfg);
      const ev = await generarEventosFiscales(ejercicio, decl);
      setEventos(ev);
    } catch (e) {
      console.error('Error loading pagos fiscales:', e);
    } finally {
      setLoading(false);
    }
  }, [ejercicio]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleFraccionar = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await saveConfiguracionFiscal({ fraccionarPago: !config.fraccionarPago });
      setConfig(updated);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarPagado = async (evento: EventoFiscal) => {
    if (!config || !evento.trimestre) return;
    setSaving(true);
    try {
      const field = evento.modelo === 'M130' ? 'modelo130_pagados' : 'modelo303_pagados';
      const pagados = [...(config[field] ?? [])];
      pagados.push({
        ejercicio: evento.ejercicio,
        trimestre: evento.trimestre,
        importe: evento.importe,
        fechaPago: new Date().toISOString().split('T')[0],
      });
      const updated = await saveConfiguracionFiscal({ [field]: pagados });
      setConfig(updated);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const pendientes = eventos.filter(e => !e.pagado);
  const totalPendiente = pendientes.reduce((s, e) => s + Math.max(0, e.importe), 0);
  const proximoEvento = pendientes
    .filter(e => new Date(e.fechaLimite) >= new Date())
    .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite))[0];

  return (
    <PageLayout
      title="Pagos fiscales"
      subtitle="Calendario de obligaciones fiscales: M130, M303 e IRPF anual"
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
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total pendiente</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{fmt(totalPendiente)}</p>
              <p className="text-xs text-gray-500 mt-1">{pendientes.length} pago(s) pendiente(s)</p>
            </div>
            {proximoEvento && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                <p className="text-xs text-amber-700 font-medium uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Próximo pago
                </p>
                <p className="text-lg font-bold text-amber-900 mt-1">{proximoEvento.descripcion}</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  {new Date(proximoEvento.fechaLimite).toLocaleDateString('es-ES')} — {fmt(proximoEvento.importe)}
                </p>
              </div>
            )}
          </div>

          {/* Configuración */}
          {config && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Configuración fiscal</h3>
              <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">Fraccionar pago IRPF</p>
                  <p className="text-xs text-gray-500 mt-0.5">60% en junio + 40% en noviembre</p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleFraccionar}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    config.fraccionarPago ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      config.fraccionarPago ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Tabla de pagos */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="grid grid-cols-5 text-xs font-semibold text-gray-600 uppercase tracking-wide bg-gray-50 px-4 py-3 border-b border-gray-200">
              <span className="col-span-2">Descripción</span>
              <span>Fecha límite</span>
              <span>Importe</span>
              <span>Estado</span>
            </div>
            {eventos.length === 0 ? (
              <p className="text-sm text-gray-500 px-4 py-6">No hay pagos fiscales para este ejercicio.</p>
            ) : (
              eventos.map((e, i) => (
                <div key={i} className="grid grid-cols-5 text-sm px-4 py-3 border-b border-gray-100 last:border-0 items-center">
                  <span className="col-span-2 text-gray-700">{e.descripcion}</span>
                  <span className="text-gray-600">{new Date(e.fechaLimite).toLocaleDateString('es-ES')}</span>
                  <span className={`font-medium ${e.importe < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {fmt(Math.abs(e.importe))}
                  </span>
                  <div className="flex items-center gap-2">
                    {e.pagado ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="w-4 h-4" /> Pagado
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-amber-600 text-xs">
                          <Circle className="w-4 h-4" /> Pendiente
                        </span>
                        {e.trimestre && (
                          <button
                            onClick={() => handleMarcarPagado(e)}
                            disabled={saving}
                            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                          >
                            Marcar pagado
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default PagosPage;
