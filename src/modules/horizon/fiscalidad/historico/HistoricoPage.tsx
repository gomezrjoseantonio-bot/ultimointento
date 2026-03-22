import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CircleDollarSign, Download, FileText, HandCoins, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../../../components/common/PageLayout';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downloadBlob, getDocumentBlob, initDB } from '../../../../services/db';
import { AnioHistoricoFiscal, cargarHistoricoFiscal, eliminarDeclaracionImportada } from '../../../../services/fiscalHistoryService';
import ImportarDeclaracionWizard from './ImportarDeclaracionWizard';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const CURRENT_YEAR = new Date().getFullYear();
const MIN_HISTORIC_YEAR = 2020;
const HISTORIC_YEARS = Array.from(
  { length: Math.max(0, CURRENT_YEAR - MIN_HISTORIC_YEAR + 1) },
  (_, index) => CURRENT_YEAR - index,
);

const HistoricoPage: React.FC = () => {
  const [historico, setHistorico] = useState<AnioHistoricoFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportWizard, setShowImportWizard] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await cargarHistoricoFiscal(HISTORIC_YEARS);
      setHistorico(results);
    } catch (e) {
      console.error('Error loading historico:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDownloadPDF = useCallback(async (ejercicio: number) => {
    try {
      const db = await initDB();
      const docs = await db.getAll('documents');
      const doc = (docs as Array<{ id?: number; type?: string; filename?: string; metadata?: { ejercicio?: number } }>)
        .find((documento) => documento.type === 'declaracion_irpf' && documento.metadata?.ejercicio === ejercicio);

      if (!doc?.id) {
        toast.error('PDF no encontrado');
        return;
      }

      const blob = await getDocumentBlob(doc.id);
      if (!blob) {
        toast.error('PDF no encontrado');
        return;
      }

      downloadBlob(blob, doc.filename || `Declaracion_IRPF_${ejercicio}.pdf`);
    } catch (error) {
      console.error('Error descargando PDF:', error);
      toast.error('Error al descargar la declaración');
    }
  }, []);

  const handleDeleteImport = useCallback(async (ejercicio: number) => {
    const confirmado = window.confirm(
      `¿Eliminar la declaración importada de ${ejercicio}?\n\nSe borrarán los datos fiscales y el PDF archivado. Esta acción no se puede deshacer.`,
    );
    if (!confirmado) return;

    try {
      await eliminarDeclaracionImportada(ejercicio);
      toast.success(`Importación de ${ejercicio} eliminada`);
      await loadData();
    } catch (error) {
      console.error('Error eliminando importación:', error);
      toast.error('Error al eliminar la importación');
    }
  }, [loadData]);

  return (
    <PageLayout
      title="Histórico IRPF"
      subtitle="Evolución anual de cuotas, retenciones y resultado de la declaración"
      primaryAction={{
        label: '+ Importar declaración',
        onClick: () => setShowImportWizard(true),
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div
            className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
            style={{ borderColor: 'var(--hz-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tabla histórico */}
          <div className="bg-[var(--hz-card-bg)] border border-[color:var(--hz-neutral-300)] rounded-lg shadow-sm overflow-hidden">
            <div className="grid grid-cols-6 text-xs font-semibold text-[var(--hz-neutral-700)] uppercase tracking-wide bg-[var(--hz-neutral-100)] px-4 py-3 border-b border-[color:var(--hz-neutral-300)]">
              <span>Ejercicio</span>
              <span>Cuota líquida</span>
              <span>Retenciones</span>
              <span>Resultado</span>
              <span>Tipo efectivo</span>
              <span>Acciones</span>
            </div>
            {historico.map(row => (
              <div key={row.ejercicio} className="grid grid-cols-6 text-sm px-4 py-3 border-b border-[color:var(--hz-neutral-100)] last:border-0 items-center">
                <span className="font-semibold text-[var(--hz-neutral-900)] flex items-center gap-2">
                  {row.ejercicio}
                  {row.fuente !== 'sin_datos' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-[var(--hz-neutral-200)] text-[var(--hz-neutral-700)]">
                      {row.fuente}
                    </span>
                  )}
                  {row.tienePDF && (
                    <span title="PDF archivado">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                    </span>
                  )}
                </span>
                <span>{fmt(row.cuotaLiquida)}</span>
                <span style={{ color: 'var(--ok)' }}>{fmt(row.retenciones)}</span>
                <span
                  className="font-medium"
                  style={{
                    color: row.resultado > 0
                      ? 'var(--error)'
                      : row.resultado < 0
                        ? 'var(--ok)'
                        : 'var(--hz-neutral-500)'
                  }}
                >
                  {row.resultado > 0 ? `A pagar: ${fmt(row.resultado)}` : row.resultado < 0 ? `A devolver: ${fmt(Math.abs(row.resultado))}` : '—'}
                </span>
                <span className="text-[var(--hz-neutral-700)]">{row.tipoEfectivo.toFixed(1)}%</span>
                <span>
                  {row.fuente === 'declarado' && row.origen === 'importado' && (
                    <div className="flex items-center gap-2">
                      {row.tienePDF && (
                        <button
                          onClick={() => handleDownloadPDF(row.ejercicio)}
                          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                          title="Descargar declaración"
                        >
                          <Download className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteImport(row.ejercicio)}
                        className="p-1.5 rounded hover:bg-red-50 transition-colors"
                        title="Eliminar importación"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Evolución visual */}
          <div className="bg-[var(--hz-card-bg)] border border-[color:var(--hz-neutral-300)] rounded-lg p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--hz-neutral-900)] mb-4">Evolución cuota líquida vs retenciones</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...historico].sort((a, b) => a.ejercicio - b.ejercicio)} margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(20, 44, 80, 0.12)" />
                  <XAxis dataKey="ejercicio" tick={{ fill: 'var(--hz-neutral-700)', fontSize: 12 }} axisLine={{ stroke: 'var(--hz-neutral-300)' }} tickLine={{ stroke: 'var(--hz-neutral-300)' }} />
                  <YAxis
                    tickFormatter={(value: number) => `${Math.round(value / 1000)}k€`}
                    tick={{ fill: 'var(--hz-neutral-700)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--hz-neutral-300)' }}
                    tickLine={{ stroke: 'var(--hz-neutral-300)' }}
                  />
                  <Tooltip
                    formatter={(value: number) => fmt(value)}
                    labelFormatter={(label) => `Ejercicio ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="cuotaLiquida" name="Cuota líquida" radius={[6, 6, 0, 0]} fill="var(--error)" />
                  <Bar dataKey="retenciones" name="Retenciones" radius={[6, 6, 0, 0]} fill="var(--ok)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-[var(--hz-neutral-700)]">
                <CircleDollarSign className="w-3.5 h-3.5" style={{ color: 'var(--error)' }} />
                Cuota líquida
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--hz-neutral-700)]">
                <HandCoins className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} />
                Retenciones
              </div>
            </div>
          </div>

          {/* Note about pending data */}
          <div className="rounded-lg p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(4, 44, 94, 0.08)', border: '1px solid rgba(4, 44, 94, 0.25)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--atlas-blue)' }} />
            <p className="text-sm" style={{ color: 'var(--atlas-blue)' }}>
              Este histórico usa solo fuentes persistidas por ejercicio: año en curso = vivo, años cerrados = snapshot de cierre, años declarados/importados = snapshot declarado. No se recalculan ejercicios pasados automáticamente.
            </p>
          </div>
        </div>
      )}
      {showImportWizard && (
        <ImportarDeclaracionWizard
          onClose={() => setShowImportWizard(false)}
          onImported={loadData}
        />
      )}
    </PageLayout>
  );
};

export default HistoricoPage;
