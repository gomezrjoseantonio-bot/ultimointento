import React, { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import { calcularDeclaracionIRPF, DeclaracionIRPF } from '../../../../services/irpfCalculationService';
import { getOrCreateEjercicio } from '../../../../services/ejercicioFiscalService';
import { EjercicioFiscal } from '../../../../services/db';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const Row: React.FC<{ label: string; value: number; highlight?: boolean; indent?: boolean }> = ({
  label, value, highlight, indent
}) => (
  <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''} ${highlight ? 'border-t border-gray-300 font-semibold' : 'border-t border-gray-100'}`}>
    <span className={`text-sm ${highlight ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
    <span className={`text-sm ${highlight ? 'text-gray-900' : ''} ${value < 0 ? 'text-[var(--atlas-teal-700)]' : ''}`}>{fmt(value)}</span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border border-gray-200 p-5 shadow-sm">
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--atlas-navy-1)]">{title}</h3>
    {children}
  </div>
);

const formatDate = (date?: string) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES');
};

const DeclaracionPage: React.FC = () => {
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [declaracion, setDeclaracion] = useState<DeclaracionIRPF | null>(null);
  const [ejercicioFiscal, setEjercicioFiscal] = useState<EjercicioFiscal | null>(null);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [decl, ejercicioData] = await Promise.all([
        calcularDeclaracionIRPF(ejercicio),
        getOrCreateEjercicio(ejercicio),
      ]);
      setDeclaracion(decl);
      setEjercicioFiscal(ejercicioData);
    } catch (e) {
      console.error('Error loading declaracion:', e);
    } finally {
      setLoading(false);
    }
  }, [ejercicio]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = () => {
    if (!declaracion) return;
    const blob = new Blob([JSON.stringify(declaracion, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `declaracion_irpf_${ejercicio}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dataRealPct = declaracion ? (declaracion.retenciones.total > 0 ? 75 : 0) : 0;

  const title = ejercicioFiscal?.estado === 'declarado'
    ? `Declaración IRPF ${ejercicio}`
    : `Estimación IRPF ${ejercicio}`;

  return (
    <PageLayout
      title={title}
      subtitle="Desglose AEAT del ejercicio seleccionado"
    >
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          {ejercicioFiscal?.estado === 'declarado' ? (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[var(--atlas-info-100)] text-[var(--atlas-info-700)]">
              🔵 Declarado · Presentado {formatDate(ejercicioFiscal.fechaDeclaracion)}
            </span>
          ) : ejercicioFiscal?.estado === 'cerrado' ? (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[var(--atlas-warning-100)] text-[var(--atlas-warning-700)]">
              🟡 Cerrado el {formatDate(ejercicioFiscal.fechaCierre)}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-[var(--atlas-success-100)] text-[var(--atlas-success-700)]">
              🟢 Ejercicio en curso · {dataRealPct}% datos reales
            </span>
          )}
          {dataRealPct === 0 && (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-neutral-100 text-neutral-700">
              Estimación basada en proyecciones
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <select
            value={ejercicio}
            onChange={e => setEjercicio(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 text-sm"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 atlas-btn-primary text-sm"
          >
            <Download className="w-4 h-4" />
            Exportar JSON
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(item => (
            <div key={item} className="bg-white border border-gray-200 p-5 animate-pulse">
              <div className="h-4 w-48 bg-neutral-200 mb-4" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-neutral-100" />
                <div className="h-3 w-5/6 bg-neutral-100" />
                <div className="h-3 w-2/3 bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && declaracion && (
        <div className="space-y-4">
          <Section title="A · Rendimientos del trabajo">
            {declaracion.baseGeneral.rendimientosTrabajo ? (
              <>
                <Row label="Salario bruto anual" value={declaracion.baseGeneral.rendimientosTrabajo.salarioBrutoAnual} indent />
                {(declaracion.baseGeneral.rendimientosTrabajo.especieAnual ?? 0) > 0 && (
                  <Row label="Retribución en especie tributable" value={declaracion.baseGeneral.rendimientosTrabajo.especieAnual} indent />
                )}
                <Row label="Cotización a la SS" value={-declaracion.baseGeneral.rendimientosTrabajo.cotizacionSS} indent />
                <Row label="Otros gastos (art. 19)" value={-2000} indent />
                <Row label="Rendimiento neto del trabajo" value={declaracion.baseGeneral.rendimientosTrabajo.rendimientoNeto} highlight />
              </>
            ) : (
              <p className="text-sm text-gray-500">No hay nómina registrada. <Link className="underline" to="/personal">Ir a Personal → Nómina</Link>.</p>
            )}
          </Section>

          <Section title="C · Rendimientos inmobiliarios">
            {declaracion.baseGeneral.rendimientosInmuebles.length > 0 ? (
              declaracion.baseGeneral.rendimientosInmuebles.map(i => (
                <div key={i.inmuebleId} className="mb-3 last:mb-0">
                  <p className="text-xs font-semibold text-gray-700 mb-1">{i.alias}</p>
                  <Row label="Ingresos íntegros" value={i.ingresosIntegros} indent />
                  <Row label="Gastos deducibles" value={-i.gastosDeducibles} indent />
                  <Row label="Amortización" value={-i.amortizacion} indent />
                  {i.esHabitual && <Row label="Reducción vivienda habitual (60%)" value={-i.reduccionHabitual} indent />}
                  <Row label="Rendimiento neto" value={i.rendimientoNeto} highlight />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No hay datos de inmuebles para este ejercicio.</p>
            )}
          </Section>

          <Section title="Liquidación">
            <Row label="Base general" value={declaracion.baseGeneral.total} />
            <Row label="Reducción plan de pensiones" value={-declaracion.reducciones.planPensiones} indent />
            <Row label="Base imponible general" value={declaracion.liquidacion.baseImponibleGeneral} highlight />
            <Row label="Base imponible ahorro" value={declaracion.liquidacion.baseImponibleAhorro} highlight />
            <Row label="Cuota líquida" value={declaracion.liquidacion.cuotaLiquida} highlight />
            <Row label="Retenciones e ingresos a cuenta" value={-declaracion.retenciones.total} indent />
            <Row
              label={declaracion.resultado >= 0 ? '▶ RESULTADO — A PAGAR' : '▶ RESULTADO — A DEVOLVER'}
              value={declaracion.resultado}
              highlight
            />
          </Section>

          <div className="bg-[var(--atlas-info-100)] border border-[var(--atlas-info-300)] p-4">
            <p className="text-sm text-[var(--atlas-info-700)]">
              Tipo efectivo: <strong>{declaracion.tipoEfectivo.toFixed(2)}%</strong>
              {' '}sobre una base imponible total de{' '}
              <strong>{fmt(declaracion.liquidacion.baseImponibleGeneral + declaracion.liquidacion.baseImponibleAhorro)}</strong>
            </p>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default DeclaracionPage;
