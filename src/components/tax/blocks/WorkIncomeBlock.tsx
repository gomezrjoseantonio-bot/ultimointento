import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { updateWorkIncome, updatePrevisionSocial, n } from '../../../store/taxSlice';

const WorkIncomeBlock: React.FC = () => {
  const dispatch = useDispatch();
  const work = useSelector((s: RootState) => s.tax.workIncome);
  const prev = useSelector((s: RootState) => s.tax.previsionSocial);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const setWork = (field: keyof typeof work, val: string) =>
    dispatch(updateWorkIncome({ [field]: parseFloat(val.replace(',', '.')) || 0 }));

  const setPrev = (field: keyof typeof prev, val: string) =>
    dispatch(updatePrevisionSocial({ [field]: parseFloat(val.replace(',', '.')) || 0 }));

  const especieNeta = n(work.especieValoracion);
  const totalIntegros = n(work.dinerarias) + especieNeta + n(work.contribucionEmpresarialPP);
  const rdtoNeto = totalIntegros - n(work.cotizacionSS) - n(work.otrosGastosDeducibles);

  return (
    <div className="block-root">
      <h3 className="block-title">Rendimientos del trabajo</h3>

      <div className="block-section">
        <h4 className="block-section-title">Retribuciones</h4>
        <Field label="Retribuciones dinerarias" value={work.dinerarias}
          onChange={v => setWork('dinerarias', v)} />
        <Field label="Valoración retribución en especie" value={work.especieValoracion}
          onChange={v => setWork('especieValoracion', v)} />
        <Field label="Ingreso a cuenta de la especie" value={work.especieIngresoACuenta}
          onChange={v => setWork('especieIngresoACuenta', v)} />
        <Field label="Contribuciones empresariales al plan de pensiones" value={work.contribucionEmpresarialPP}
          onChange={v => setWork('contribucionEmpresarialPP', v)} />
      </div>

      <div className="block-section">
        <h4 className="block-section-title">Gastos deducibles</h4>
        <Field label="Cotizaciones Seguridad Social" value={work.cotizacionSS}
          onChange={v => setWork('cotizacionSS', v)} />
        <Field label="Otros gastos deducibles (art. 19.2.f)" value={work.otrosGastosDeducibles}
          onChange={v => setWork('otrosGastosDeducibles', v)}
          hint="Fijo: 2.000 € para asalariados" />
        <Field label="Retención total (IRPF pagador)" value={work.retencion}
          onChange={v => setWork('retencion', v)} />
      </div>

      <div className="block-section">
        <h4 className="block-section-title">Previsión social (reducción base)</h4>
        <Field label="Aportación trabajador al PP" value={prev.aportacionTrabajador}
          onChange={v => setPrev('aportacionTrabajador', v)} />
        <Field label="Contribución empresarial al PP" value={prev.contribucionEmpresarial}
          onChange={v => setPrev('contribucionEmpresarial', v)} />
        <CalcField label="Total con derecho a reducción (máx. 10% rendimientos / 8.000€)"
          value={Math.min(
            n(prev.aportacionTrabajador) + n(prev.contribucionEmpresarial),
            Math.min(8000, totalIntegros * 0.10)
          )} fmt={fmt} />
      </div>

      <div className="block-results">
        <h4 className="block-section-title">Resultados</h4>
        <CalcField label="Total ingresos íntegros computables" value={totalIntegros} fmt={fmt} />
        <CalcField label="Rendimiento neto del trabajo" value={rdtoNeto} fmt={fmt} bold />
      </div>
    </div>
  );
};

// ─── Componentes internos reutilizables ──────────────────────────────
const Field: React.FC<{
  label: string; value: number; onChange: (v: string) => void; hint?: string;
}> = ({ label, value, onChange, hint }) => (
  <div className="field-row">
    <div className="field-label-wrap">
      <label className="field-label">{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
    <input
      className="field-input"
      type="number"
      step="0.01"
      value={value === 0 ? '' : value}
      placeholder="0,00"
      onChange={e => onChange(e.target.value)}
    />
    <span className="field-unit">€</span>
  </div>
);

const CalcField: React.FC<{ label: string; value: number; fmt: (v: number) => string; bold?: boolean }> = ({
  label, value, fmt, bold
}) => (
  <div className={`calc-row ${bold ? 'calc-row--bold' : ''}`}>
    <span className="calc-label">{label}</span>
    <span className="calc-value">{fmt(value)} €</span>
  </div>
);

export default WorkIncomeBlock;
