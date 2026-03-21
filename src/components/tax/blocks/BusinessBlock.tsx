import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import { RootState } from '../../../store';
import { addActividad, updateActividad, removeActividad, n } from '../../../store/taxSlice';

interface Props {
  readOnly?: boolean;
}

const BusinessBlock: React.FC<Props> = ({ readOnly = false }) => {
  const dispatch = useDispatch();
  const actividades = useSelector((s: RootState) => s.tax.actividades);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="block-root">
      <div className="block-header-row">
        <h3 className="block-title">Actividades económicas (estimación directa simplificada)</h3>
        <button className="btn-add" onClick={() => !readOnly && dispatch(addActividad())} disabled={readOnly}>
          <Plus size={14}/> Añadir actividad
        </button>
      </div>

      {actividades.length === 0 && (
        <div className="block-empty">No hay actividades registradas.</div>
      )}

      {actividades.map((actividad) => (
        <div key={actividad.id} className="block-section business-card">
          <div className="business-card-header">
            <input
              className="field-input field-input--text inline-title"
              value={actividad.codigoActividad}
              placeholder="Código actividad (ej. A05)"
              onChange={readOnly ? undefined : (e) => dispatch(updateActividad({ id: actividad.id, data: { codigoActividad: e.target.value } }))}
              readOnly={readOnly}
            />
            <input
              className="field-input field-input--text inline-iae"
              value={actividad.epigafreIAE}
              placeholder="Epígrafe IAE (ej. 724)"
              onChange={readOnly ? undefined : (e) => dispatch(updateActividad({ id: actividad.id, data: { epigafreIAE: e.target.value } }))}
              readOnly={readOnly}
            />
            <button className="btn-icon-danger" onClick={() => !readOnly && dispatch(removeActividad(actividad.id))} disabled={readOnly}>
              <Trash2 size={14}/>
            </button>
          </div>

          {[
            { label: 'Ingresos de explotación', field: 'ingresosExplotacion' },
            { label: 'Seguridad Social del titular', field: 'seguridadSocialTitular' },
            { label: 'Servicios de profesionales independientes', field: 'serviciosProfesionales' },
            { label: 'Otros gastos deducibles', field: 'otrosGastos' },
            { label: 'Retención (pagos a cuenta 130)', field: 'retencion' },
          ].map(({ label, field }) => (
            <div key={field} className="field-row">
              <label className="field-label">{label}</label>
              <input
                className="field-input"
                type="number"
                step="0.01"
                value={(actividad as any)[field] === 0 ? '' : (actividad as any)[field]}
                placeholder="0,00"
                onChange={readOnly ? undefined : (e) => dispatch(updateActividad({
                  id: actividad.id,
                  data: { [field]: parseFloat(e.target.value.replace(',', '.')) || 0 },
                }))}
                readOnly={readOnly}
              />
              <span className="field-unit">€</span>
            </div>
          ))}

          <div className="block-results">
            <div className="calc-row">
              <span className="calc-label">Provisión deducible 5% (dif. justificación)</span>
              <span className="calc-value">{fmt(n(actividad.provisionSimplificada))} €</span>
            </div>
            <div className="calc-row calc-row--bold">
              <span className="calc-label">Rendimiento neto</span>
              <span className="calc-value">{fmt(n(actividad.rendimientoNeto))} €</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BusinessBlock;
