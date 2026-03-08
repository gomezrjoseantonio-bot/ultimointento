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
          className="atlas-field max-w-40"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--blue)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg p-5 shadow-sm" style={{ borderColor: "var(--n-300)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--n-500)]">Total pendiente</p>
              <p className="text-2xl font-bold mt-1 text-[var(--blue)]">{fmt(totalPendiente)}</p>
              <p className="text-xs mt-1 text-[var(--n-500)]">{pendientes.length} pago(s) pendiente(s)</p>
            </div>
            {proximoEvento && (
              <div className="bg-[var(--n-100)] border rounded-lg p-5" style={{ borderColor: "var(--n-300)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1 text-[var(--n-700)]">
                  <Calendar className="w-3 h-3" /> Próximo pago
                </p>
                <p className="text-lg font-bold mt-1 text-[var(--n-700)]">{proximoEvento.descripcion}</p>
                <p className="text-sm mt-0.5 text-[var(--n-700)]">
                  {new Date(proximoEvento.fechaLimite).toLocaleDateString('es-ES')} — {fmt(proximoEvento.importe)}
                </p>
              </div>
            )}
          </div>

          {/* Configuración */}
          {config && (
            <div className="bg-white border rounded-lg p-5 shadow-sm" style={{ borderColor: "var(--n-300)" }}>
              <h3 className="text-sm font-semibold mb-3 text-[var(--n-700)]">Configuración fiscal</h3>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[var(--n-700)]">Fraccionar pago IRPF</p>
                  <p className="text-xs mt-0.5 text-[var(--n-500)]">60% en junio + 40% en noviembre</p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleFraccionar}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    config.fraccionarPago ? 'bg-[var(--blue)]' : 'bg-[var(--n-300)]'
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
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden" style={{ borderColor: "var(--n-300)" }}>
            <div className="grid grid-cols-5 text-xs font-semibold uppercase tracking-wide bg-[var(--n-100)] px-4 py-3 border-b">
              <span className="col-span-2">Descripción</span>
              <span>Fecha límite</span>
              <span>Importe</span>
              <span>Estado</span>
            </div>
            {eventos.length === 0 ? (
              <p className="text-sm text-[var(--n-500)] px-4 py-6">No hay pagos fiscales para este ejercicio.</p>
            ) : (
              eventos.map((e, i) => (
                <div key={i} className="grid grid-cols-5 text-sm px-4 py-3 border-b last:border-0 items-center" style={{ borderColor: "var(--n-100)" }}>
                  <span className="col-span-2 text-[var(--n-700)]">{e.descripcion}</span>
                  <span className="text-[var(--n-500)]">{new Date(e.fechaLimite).toLocaleDateString('es-ES')}</span>
                  <span className={`font-medium ${e.importe < 0 ? 'text-[var(--s-positive)]' : 'text-[var(--blue)]'}`}>
                    {fmt(Math.abs(e.importe))}
                  </span>
                  <div className="flex items-center gap-2">
                    {e.pagado ? (
                      <span className="flex items-center gap-1 text-[var(--s-positive)] text-xs font-medium">
                        <CheckCircle className="w-4 h-4" /> Pagado
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[var(--n-500)] text-xs">
                          <Circle className="w-4 h-4" /> Pendiente
                        </span>
                        {e.trimestre && (
                          <button
                            onClick={() => handleMarcarPagado(e)}
                            disabled={saving}
                            className="text-xs text-[var(--blue)] hover:underline disabled:opacity-50"
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
