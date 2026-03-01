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

          <Section title="B · Rendimientos de actividades económicas">
            {declaracion.baseGeneral.rendimientosAutonomo ? (
              <>
                <Row label="Ingresos íntegros" value={declaracion.baseGeneral.rendimientosAutonomo.ingresos} indent />
                <Row label="Gastos deducibles" value={-declaracion.baseGeneral.rendimientosAutonomo.gastos} indent />
                <Row label="Cuota autónomos (SS)" value={-declaracion.baseGeneral.rendimientosAutonomo.cuotaSS} indent />
                <Row label="Rendimiento neto" value={declaracion.baseGeneral.rendimientosAutonomo.rendimientoNeto} highlight />
                <Row label="Pagos fraccionados modelo 130" value={-declaracion.baseGeneral.rendimientosAutonomo.pagosFraccionadosM130} indent />
              </>
            ) : (
              <p className="text-sm text-gray-500">No hay actividad económica registrada para este ejercicio.</p>
            )}
          </Section>

          <Section title="C · Rendimientos de capital inmobiliario">
            {declaracion.baseGeneral.rendimientosInmuebles.length > 0 ? (
              declaracion.baseGeneral.rendimientosInmuebles.map(i => (
                <div key={i.inmuebleId} className="mb-4 pb-4 border-b border-gray-100 last:mb-0 last:pb-0 last:border-b-0">
                  <p className="text-xs font-semibold text-gray-700 mb-1">{i.alias}</p>
                  <Row label="Ingresos íntegros" value={i.ingresosIntegros} indent />
                  <Row label="Gastos deducibles" value={-i.gastosDeducibles} indent />
                  <Row label="Amortización" value={-i.amortizacion} indent />
                  {i.gastosFinanciacionYReparacion !== undefined && (
                    <Row label="Intereses + reparación/conservación" value={-i.gastosFinanciacionYReparacion} indent />
                  )}
                  {i.arrastresAplicados !== undefined && i.arrastresAplicados > 0 && (
                    <Row label="Arrastres aplicados ejercicios previos" value={-i.arrastresAplicados} indent />
                  )}
                  {i.excesoArrastrable !== undefined && i.excesoArrastrable > 0 && (
                    <Row label="Exceso a compensar en próximos ejercicios" value={-i.excesoArrastrable} indent />
                  )}
                  {i.esHabitual && <Row label="Reducción vivienda habitual (60%)" value={-i.reduccionHabitual} indent />}
                  <Row label={`Imputación renta (${i.diasVacio} días no alquilado)`} value={i.imputacionRenta} indent />
                  {i.accesoriosIncluidos && i.accesoriosIncluidos.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2 pl-4">Incluye {i.accesoriosIncluidos.length} inmueble(s) accesorio(s).</p>
                  )}
                  <Row label="Rendimiento neto total del inmueble" value={i.rendimientoNeto} highlight />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No hay datos de inmuebles para este ejercicio.</p>
            )}
          </Section>

          <Section title="D · Imputación de rentas inmobiliarias">
            {declaracion.baseGeneral.imputacionRentas.length > 0 ? (
              declaracion.baseGeneral.imputacionRentas.map(i => (
                <div key={i.inmuebleId} className="mb-3 last:mb-0">
                  <p className="text-xs font-semibold text-gray-700 mb-1">{i.alias}</p>
                  <Row label="Valor catastral" value={i.valorCatastral} indent />
                  <Row label={`Imputación (${(i.porcentajeImputacion * 100).toFixed(1)}%)`} value={i.imputacion} highlight />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No hay imputaciones de rentas para este ejercicio.</p>
            )}
          </Section>

          <Section title="E · Base del ahorro">
            <Row label="Intereses" value={declaracion.baseAhorro.capitalMobiliario.intereses} indent />
            <Row label="Dividendos" value={declaracion.baseAhorro.capitalMobiliario.dividendos} indent />
            <Row label="Rendimientos del capital mobiliario" value={declaracion.baseAhorro.capitalMobiliario.total} highlight />
            <Row label="Plusvalías" value={declaracion.baseAhorro.gananciasYPerdidas.plusvalias} indent />
            <Row label="Minusvalías" value={-declaracion.baseAhorro.gananciasYPerdidas.minusvalias} indent />
            {declaracion.baseAhorro.gananciasYPerdidas.minusvaliasPendientes > 0 && (
              <Row label="Minusvalías pendientes compensación" value={-declaracion.baseAhorro.gananciasYPerdidas.minusvaliasPendientes} indent />
            )}
            <Row label="Saldo ganancias/pérdidas" value={declaracion.baseAhorro.gananciasYPerdidas.compensado} highlight />
            <Row label="Base imponible del ahorro" value={declaracion.liquidacion.baseImponibleAhorro} highlight />
          </Section>

          <Section title="F · Reducciones y mínimos personales/familiares">
            <Row label="Aportación PP empleado" value={-declaracion.reducciones.ppEmpleado} indent />
            <Row label="Aportación PP empresa" value={-declaracion.reducciones.ppEmpresa} indent />
            <Row label="Aportación PP individual" value={-declaracion.reducciones.ppIndividual} indent />
            <Row label="Reducción total plan de pensiones" value={-declaracion.reducciones.total} highlight />
            <Row label="Mínimo contribuyente" value={-declaracion.minimoPersonal.contribuyente} indent />
            <Row label="Mínimo descendientes" value={-declaracion.minimoPersonal.descendientes} indent />
            <Row label="Mínimo ascendientes" value={-declaracion.minimoPersonal.ascendientes} indent />
            <Row label="Mínimo discapacidad" value={-declaracion.minimoPersonal.discapacidad} indent />
            <Row label="Mínimo personal y familiar total" value={-declaracion.minimoPersonal.total} highlight />
          </Section>

          <Section title="G · Base liquidable y cuotas">
            <Row label="Base general" value={declaracion.baseGeneral.total} />
            <Row label="Base imponible general" value={declaracion.liquidacion.baseImponibleGeneral} highlight />
            <Row label="Cuota base general" value={declaracion.liquidacion.cuotaBaseGeneral} indent />
            <Row label="Cuota por mínimos personales" value={-declaracion.liquidacion.cuotaMinimosBaseGeneral} indent />
            <Row label="Cuota base ahorro" value={declaracion.liquidacion.cuotaBaseAhorro} indent />
            <Row label="Cuota íntegra" value={declaracion.liquidacion.cuotaIntegra} highlight />
            <Row label="Deducciones por doble imposición" value={-declaracion.liquidacion.deduccionesDobleImposicion} indent />
            <Row label="Cuota líquida" value={declaracion.liquidacion.cuotaLiquida} highlight />
          </Section>

          <Section title="H · Retenciones, pagos a cuenta y resultado">
            <Row label="Retenciones trabajo" value={-declaracion.retenciones.trabajo} indent />
            <Row label="Pagos fraccionados actividades (M130)" value={-declaracion.retenciones.autonomoM130} indent />
            <Row label="Retenciones capital mobiliario" value={-declaracion.retenciones.capitalMobiliario} indent />
            <Row label="Total pagos a cuenta" value={-declaracion.retenciones.total} highlight />
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
