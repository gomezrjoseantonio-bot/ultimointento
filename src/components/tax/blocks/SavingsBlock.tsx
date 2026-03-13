import React from 'react';
import TaxSectionCard from '../shared/TaxSectionCard';
import TaxFieldRow from '../shared/TaxFieldRow';
import { CapitalMobiliario } from '../../../store/taxSlice';

interface SavingsBlockProps {
  data: CapitalMobiliario;
  onChange: <K extends keyof CapitalMobiliario>(field: K, value: CapitalMobiliario[K]) => void;
}

const SavingsBlock: React.FC<SavingsBlockProps> = ({ data, onChange }) => (
  <TaxSectionCard title="Capital mobiliario">
    <div className="tax-grid tax-grid--2">
      <TaxFieldRow label="Intereses cuentas y depósitos" value={data.interesesCuentasDepositos} onChange={(v) => onChange('interesesCuentasDepositos', Number(v))} />
      <TaxFieldRow label="Otros rendimientos mobiliarios" value={data.otrosRendimientos} onChange={(v) => onChange('otrosRendimientos', Number(v))} />
      <TaxFieldRow label="Retención" value={data.retencion} onChange={(v) => onChange('retencion', Number(v))} />
    </div>
  </TaxSectionCard>
);

export default SavingsBlock;
