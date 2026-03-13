import React from 'react';
import TaxSectionCard from '../shared/TaxSectionCard';
import TaxFieldRow from '../shared/TaxFieldRow';
import { WorkIncome, calcRendimientoTrabajo } from '../../../store/taxSlice';

interface WorkIncomeBlockProps {
  data: WorkIncome;
  onChange: <K extends keyof WorkIncome>(field: K, value: WorkIncome[K]) => void;
}

const WorkIncomeBlock: React.FC<WorkIncomeBlockProps> = ({ data, onChange }) => {
  const especieNeta = data.especieValoracion;
  const totalIntegros = data.dinerarias + especieNeta + data.contribucionEmpresarialPP;
  const netoPrevio = totalIntegros - data.cotizacionSS;
  const rendimientoNeto = calcRendimientoTrabajo(data);

  return (
    <TaxSectionCard title="Rendimientos del trabajo">
      <div className="tax-grid tax-grid--2">
        <TaxFieldRow label="Retribuciones dinerarias" value={data.dinerarias} onChange={(v) => onChange('dinerarias', Number(v))} />
        <TaxFieldRow label="Valoración retribución en especie" value={data.especieValoracion} onChange={(v) => onChange('especieValoracion', Number(v))} />
        <TaxFieldRow label="Ingreso a cuenta de la especie" value={data.especieIngresoACuenta} onChange={(v) => onChange('especieIngresoACuenta', Number(v))} />
        <TaxFieldRow label="Contribuciones empresariales al PP" value={data.contribucionEmpresarialPP} onChange={(v) => onChange('contribucionEmpresarialPP', Number(v))} />
        <TaxFieldRow label="Cotizaciones Seguridad Social" value={data.cotizacionSS} onChange={(v) => onChange('cotizacionSS', Number(v))} />
        <TaxFieldRow label="Otros gastos deducibles" value={data.otrosGastosDeducibles} onChange={(v) => onChange('otrosGastosDeducibles', Number(v))} />
        <TaxFieldRow label="Retención total pagador" value={data.retencion} onChange={(v) => onChange('retencion', Number(v))} />
      </div>
      <div className="tax-calculated-row">
        <span>Retribución especie neta: {especieNeta.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
        <span>Total íntegros: {totalIntegros.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
        <span>Neto previo: {netoPrevio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
        <span>Rendimiento neto: {rendimientoNeto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
      </div>
    </TaxSectionCard>
  );
};

export default WorkIncomeBlock;
