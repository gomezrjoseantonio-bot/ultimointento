import React, { useState } from 'react';
import { Eye, Plus } from 'lucide-react';
import CarryForwardBadge from '../shared/CarryForwardBadge';
import TaxSectionCard from '../shared/TaxSectionCard';
import TaxFieldRow from '../shared/TaxFieldRow';
import { Inmueble } from '../../../store/taxSlice';

interface RealEstateBlockProps {
  inmuebles: Inmueble[];
  onUpdate: <K extends keyof Inmueble>(id: string, field: K, value: Inmueble[K]) => void;
  onAdd: () => void;
}

const RealEstateBlock: React.FC<RealEstateBlockProps> = ({ inmuebles, onUpdate, onAdd }) => {
  const [activeId, setActiveId] = useState<string | null>(inmuebles[0]?.id ?? null);
  const active = inmuebles.find((i) => i.id === activeId) ?? inmuebles[0];

  return (
    <div className="tax-stack">
      <TaxSectionCard title="Inmuebles" actions={<button className="btn-primary" onClick={onAdd}><Plus size={16} />Añadir inmueble</button>}>
        <div className="tax-table-wrap">
          <table className="tax-table">
            <thead><tr><th>Dirección</th><th>Tipo</th><th>Días arr.</th><th>Ingresos</th><th>Gastos</th><th>Rdto. neto</th><th>Reducción</th><th>Rdto. neto reducido</th><th /></tr></thead>
            <tbody>
              {inmuebles.map((i) => (
                <tr key={i.id}>
                  <td>{i.direccion}</td><td>{i.tipo}</td><td>{i.diasArrendados}</td><td className="mono">{i.ingresosIntegros.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                  <td className="mono">{(i.ingresosIntegros - i.rendimientoNeto).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                  <td className="mono">{i.rendimientoNeto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                  <td className="mono">{i.reduccionAplicada.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                  <td className="mono">{i.rendimientoNetoReducido.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                  <td><button className="btn-icon" onClick={() => setActiveId(i.id)}><Eye size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TaxSectionCard>
      {active && (
        <TaxSectionCard title="Detalle del inmueble">
          <div className="tax-grid tax-grid--2">
            <TaxFieldRow label="Referencia catastral" type="text" value={active.refCatastral} onChange={(v) => onUpdate(active.id, 'refCatastral', String(v))} />
            <TaxFieldRow label="Dirección" type="text" value={active.direccion} onChange={(v) => onUpdate(active.id, 'direccion', String(v))} />
            <TaxFieldRow label="Días arrendados" value={active.diasArrendados} onChange={(v) => onUpdate(active.id, 'diasArrendados', Number(v))} />
            <TaxFieldRow label="Días a disposición" value={active.diasDisposicion} onChange={(v) => onUpdate(active.id, 'diasDisposicion', Number(v))} />
            <TaxFieldRow label="Ingresos íntegros" value={active.ingresosIntegros} onChange={(v) => onUpdate(active.id, 'ingresosIntegros', Number(v))} />
            <TaxFieldRow label="Intereses financiación" value={active.interesesFinanciacion} onChange={(v) => onUpdate(active.id, 'interesesFinanciacion', Number(v))} />
            <TaxFieldRow label="Gastos reparación" value={active.gastosReparacionConservacion} onChange={(v) => onUpdate(active.id, 'gastosReparacionConservacion', Number(v))} />
            <TaxFieldRow label="Gastos de comunidad" value={active.gastosComunidad} onChange={(v) => onUpdate(active.id, 'gastosComunidad', Number(v))} />
            <TaxFieldRow label="Servicios profesionales" value={active.serviciosPersonales} onChange={(v) => onUpdate(active.id, 'serviciosPersonales', Number(v))} />
            <TaxFieldRow label="Suministros" value={active.serviciosSuministros} onChange={(v) => onUpdate(active.id, 'serviciosSuministros', Number(v))} />
            <TaxFieldRow label="Seguros" value={active.seguro} onChange={(v) => onUpdate(active.id, 'seguro', Number(v))} />
            <TaxFieldRow label="Tributos y tasas" value={active.tributosRecargos} onChange={(v) => onUpdate(active.id, 'tributosRecargos', Number(v))} />
          </div>
          {active.gastosReparacionNoDeducibles > 0 && <CarryForwardBadge warning text={`Exceso de intereses+reparación: ${active.gastosReparacionNoDeducibles.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €. Se deducirá en 2025, 2026, 2027 y 2028.`} />}
          <div className="tax-inline-row">
            <span className="mono">Base amortización: {active.baseAmortizacion.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
            <span className="mono">Amortización: {active.amortizacionInmueble.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
            <span className="mono">Renta imputada: {active.rentaImputada.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
            <span className="mono">Rdto neto reducido: {active.rendimientoNetoReducido.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
          </div>
        </TaxSectionCard>
      )}
    </div>
  );
};

export default RealEstateBlock;
