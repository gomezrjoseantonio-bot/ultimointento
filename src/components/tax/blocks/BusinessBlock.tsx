import React from 'react';
import TaxSectionCard from '../shared/TaxSectionCard';
import TaxFieldRow from '../shared/TaxFieldRow';
import { ActividadEconomica } from '../../../store/taxSlice';

interface BusinessBlockProps {
  actividad: ActividadEconomica;
  onChange: <K extends keyof ActividadEconomica>(field: K, value: ActividadEconomica[K]) => void;
}

const BusinessBlock: React.FC<BusinessBlockProps> = ({ actividad, onChange }) => {
  const gastos = actividad.seguridadSocialTitular + actividad.serviciosProfesionales + actividad.otrosGastos;
  const diferencia = actividad.ingresosExplotacion - gastos;
  return (
    <TaxSectionCard title="Actividades económicas (ED simplificada)">
      <div className="tax-grid tax-grid--2">
        <TaxFieldRow label="Código de actividad" type="text" value={actividad.codigoActividad} onChange={(v) => onChange('codigoActividad', String(v))} />
        <TaxFieldRow label="Epígrafe IAE" type="text" value={actividad.epigafreIAE} onChange={(v) => onChange('epigafreIAE', String(v))} />
        <TaxFieldRow label="Ingresos de explotación" value={actividad.ingresosExplotacion} onChange={(v) => onChange('ingresosExplotacion', Number(v))} />
        <TaxFieldRow label="Seguridad Social del titular" value={actividad.seguridadSocialTitular} onChange={(v) => onChange('seguridadSocialTitular', Number(v))} />
        <TaxFieldRow label="Servicios de profesionales" value={actividad.serviciosProfesionales} onChange={(v) => onChange('serviciosProfesionales', Number(v))} />
        <TaxFieldRow label="Otros gastos deducibles" value={actividad.otrosGastos} onChange={(v) => onChange('otrosGastos', Number(v))} />
        <TaxFieldRow label="Retención" value={actividad.retencion} onChange={(v) => onChange('retencion', Number(v))} />
      </div>
      <div className="tax-calculated-row">
        <span>Gastos deducibles: {gastos.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
        <span>Diferencia: {diferencia.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
        <span>Provisión 5%: {actividad.provisionSimplificada.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
        <span>Rendimiento neto: {actividad.rendimientoNeto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
      </div>
    </TaxSectionCard>
  );
};

export default BusinessBlock;
