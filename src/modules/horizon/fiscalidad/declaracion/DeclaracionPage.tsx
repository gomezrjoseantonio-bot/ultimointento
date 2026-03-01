import React, { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { calcularDeclaracionIRPF, DeclaracionIRPF } from '../../../../services/irpfCalculationService';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const Row: React.FC<{ label: string; value: number; highlight?: boolean; indent?: boolean }> = ({
  label, value, highlight, indent
}) => (
  <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''} ${highlight ? 'border-t border-gray-300 font-semibold' : 'border-t border-gray-100'}`}>
    <span className={`text-sm ${highlight ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
    <span className={`text-sm ${highlight ? 'text-gray-900' : ''} ${value < 0 ? 'text-cyan-700' : ''}`}>{fmt(value)}</span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border border-gray-200 p-5 shadow-sm">
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-700">{title}</h3>
    {children}
  </div>
);

const DeclaracionPage: React.FC = () => {
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [declaracion, setDeclaracion] = useState<DeclaracionIRPF | null>(null);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const decl = await calcularDeclaracionIRPF(ejercicio);
      setDeclaracion(decl);
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

  return (
    <PageLayout
      title={`Declaración IRPF ${ejercicio}`}
      subtitle="Desglose completo de bases, liquidación y resultado"
    >
      {/* Controls */}
      <div className="flex justify-end gap-2 mb-4">
        <select
          value={ejercicio}
          onChange={e => setEjercicio(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>
      {loading && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
        </div>
      )}

      {!loading && declaracion && (
        <div className="space-y-4">
          {/* BASE GENERAL */}
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
              <p className="text-sm text-gray-500">No se han declarado rendimientos del trabajo.</p>
            )}
          </Section>

          <Section title="B · Actividades económicas (autónomo)">
            {declaracion.baseGeneral.rendimientosAutonomo ? (
              <>
                <Row label="Ingresos" value={declaracion.baseGeneral.rendimientosAutonomo.ingresos} indent />
                <Row label="Gastos deducibles" value={-declaracion.baseGeneral.rendimientosAutonomo.gastos} indent />
                <Row label="Cuota Seguridad Social" value={-declaracion.baseGeneral.rendimientosAutonomo.cuotaSS} indent />
                <Row label="Rendimiento neto" value={declaracion.baseGeneral.rendimientosAutonomo.rendimientoNeto} highlight />
              </>
            ) : (
              <p className="text-sm text-gray-500">No se han declarado actividades económicas.</p>
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
              <p className="text-sm text-gray-500">No se han declarado rendimientos inmobiliarios.</p>
            )}
          </Section>

          {declaracion.baseGeneral.imputacionRentas.length > 0 && (
            <Section title="D · Imputación de rentas (inmuebles vacíos)">
              {declaracion.baseGeneral.imputacionRentas.map(i => (
                <div key={i.inmuebleId} className="mb-2">
                  <Row
                    label={`${i.alias} (${(i.porcentajeImputacion * 100).toFixed(1)}% × VC ${fmt(i.valorCatastral)})`}
                    value={i.imputacion}
                  />
                </div>
              ))}
              <Row
                label="Total imputación rentas"
                value={declaracion.baseGeneral.imputacionRentas.reduce((s, i) => s + i.imputacion, 0)}
                highlight
              />
            </Section>
          )}

          <Section title="E · Rendimientos del capital mobiliario (base ahorro)">
            <Row label="Intereses" value={declaracion.baseAhorro.capitalMobiliario.intereses} indent />
            <Row label="Dividendos" value={declaracion.baseAhorro.capitalMobiliario.dividendos} indent />
            <Row label="Total RCM" value={declaracion.baseAhorro.capitalMobiliario.total} highlight />
          </Section>

          <Section title="F · Ganancias y pérdidas patrimoniales (base ahorro)">
            <Row label="Plusvalías realizadas" value={declaracion.baseAhorro.gananciasYPerdidas.plusvalias} indent />
            <Row label="Minusvalías realizadas" value={-declaracion.baseAhorro.gananciasYPerdidas.minusvalias} indent />
            <Row label="Resultado compensado" value={declaracion.baseAhorro.gananciasYPerdidas.compensado} highlight />
          </Section>

          {/* LIQUIDACIÓN */}
          <Section title="Liquidación">
            <Row label="Base general" value={declaracion.baseGeneral.total} />
            <Row label="Reducción plan de pensiones" value={-declaracion.reducciones.planPensiones} indent />
            {(declaracion.reducciones.ppEmpleado ?? 0) > 0 && (
              <Row label="· PP empleado" value={-declaracion.reducciones.ppEmpleado} indent />
            )}
            {(declaracion.reducciones.ppEmpresa ?? 0) > 0 && (
              <Row label="· PP empresa" value={-declaracion.reducciones.ppEmpresa} indent />
            )}
            {(declaracion.reducciones.ppIndividual ?? 0) > 0 && (
              <Row label="· PP individual" value={-declaracion.reducciones.ppIndividual} indent />
            )}
            <Row label="Base imponible general" value={declaracion.liquidacion.baseImponibleGeneral} highlight />
            <Row label="Base imponible ahorro" value={declaracion.liquidacion.baseImponibleAhorro} highlight />
            <Row label="Cuota íntegra BG (tramos progresivos)" value={declaracion.liquidacion.cuotaBaseGeneral} indent />
            <Row label="Cuota íntegra BA" value={declaracion.liquidacion.cuotaBaseAhorro} indent />
            <Row label="Reducción por mínimos personales" value={-declaracion.liquidacion.cuotaMinimosBaseGeneral} indent />
            <Row label="Mínimo personal" value={declaracion.minimoPersonal.total} indent />
            <Row label="Cuota íntegra total" value={declaracion.liquidacion.cuotaIntegra} highlight />
            <Row label="Deducciones (doble imposición internacional)" value={-declaracion.liquidacion.deduccionesDobleImposicion} indent />
            <Row label="Cuota líquida" value={declaracion.liquidacion.cuotaLiquida} highlight />
            <Row label="Retenciones e ingresos a cuenta" value={-declaracion.retenciones.total} indent />
            <Row
              label={declaracion.resultado >= 0 ? '▶ RESULTADO — A PAGAR' : '▶ RESULTADO — A DEVOLVER'}
              value={declaracion.resultado}
              highlight
            />
          </Section>

          {/* TIPO EFECTIVO */}
          <div className="bg-primary-50 border border-primary-200 p-4">
            <p className="text-sm text-primary-800">
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
