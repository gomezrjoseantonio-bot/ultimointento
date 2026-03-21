import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { RootState } from '../../../store';
import { addInmueble, updateInmueble, removeInmueble, Inmueble, n } from '../../../store/taxSlice';

const RealEstateBlock: React.FC = () => {
  const dispatch = useDispatch();
  const inmuebles = useSelector((s: RootState) => s.tax.inmuebles);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="block-root">
      <div className="block-header-row">
        <h3 className="block-title">Inmuebles arrendados</h3>
        <button className="btn-add" onClick={() => dispatch(addInmueble())}>
          <Plus size={14} /> Añadir inmueble
        </button>
      </div>

      {inmuebles.length === 0 && (
        <div className="block-empty">
          No hay inmuebles. Pulsa "Añadir inmueble" para empezar.
        </div>
      )}

      {/* Tabla resumen */}
      {inmuebles.length > 0 && (
        <div className="re-table-wrap">
          <table className="re-table">
            <thead>
              <tr>
                <th>Inmueble</th>
                <th className="num">Ingresos</th>
                <th className="num">Gastos</th>
                <th className="num">Rdto. neto</th>
                <th className="num">Rdto. reducido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {inmuebles.map(i => {
                const gastos = n(i.limiteInteresesReparacion)
                  + n(i.gastosComunidad) + n(i.serviciosPersonales)
                  + n(i.suministros) + n(i.seguro) + n(i.tributosRecargos)
                  + n(i.amortizacionInmueble) + n(i.amortizacionMuebles);
                return (
                  <tr key={i.id} className="re-table-row">
                    <td>
                      <button className="re-expand-btn" onClick={() =>
                        setExpanded(expanded === i.id ? null : i.id)
                      }>
                        {expanded === i.id ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        {i.direccion || 'Sin dirección'}
                      </button>
                    </td>
                    <td className="num">{fmt(n(i.ingresosIntegros))} €</td>
                    <td className="num">{fmt(gastos)} €</td>
                    <td className="num" style={{ color: n(i.rendimientoNeto) < 0 ? 'var(--s-neg)' : 'var(--n-700)' }}>
                      {fmt(n(i.rendimientoNeto))} €
                    </td>
                    <td className="num">{fmt(n(i.rendimientoNetoReducido))} €</td>
                    <td>
                      <button className="btn-icon-danger" onClick={() => dispatch(removeInmueble(i.id))}>
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel de detalle */}
      {inmuebles.map(i => expanded === i.id && (
        <InmuebleDetail key={i.id} inmueble={i} fmt={fmt}
          onChange={(data) => dispatch(updateInmueble({ id: i.id, data }))}
        />
      ))}
    </div>
  );
};

const InmuebleDetail: React.FC<{
  inmueble: Inmueble;
  fmt: (v: number) => string;
  onChange: (data: Partial<Inmueble>) => void;
}> = ({ inmueble: i, fmt, onChange }) => {
  const F = ({ label, field, hint }: { label: string; field: keyof Inmueble; hint?: string }) => (
    <div className="field-row">
      <div className="field-label-wrap">
        <label className="field-label">{label}</label>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      <input className="field-input" type="number" step="0.01"
        value={(i[field] as number) === 0 ? '' : i[field] as number}
        placeholder="0,00"
        onChange={e => onChange({ [field]: parseFloat(e.target.value.replace(',', '.')) || 0 })}
      />
      <span className="field-unit">€</span>
    </div>
  );

  const Calc = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
    <div className={`calc-row ${bold ? 'calc-row--bold' : ''}`}>
      <span className="calc-label">{label}</span>
      <span className="calc-value">{fmt(value)} €</span>
    </div>
  );

  return (
    <div className="re-detail">
      {/* Identificación */}
      <div className="block-section">
        <h4 className="block-section-title">Identificación</h4>
        <div className="field-row">
          <label className="field-label">Dirección</label>
          <input className="field-input field-input--text" type="text"
            value={i.direccion}
            onChange={e => onChange({ direccion: e.target.value })}
            placeholder="CL EJEMPLO 001, OVIEDO"
          />
        </div>
        <div className="field-row">
          <label className="field-label">Referencia catastral</label>
          <input className="field-input field-input--text" type="text"
            value={i.refCatastral}
            onChange={e => onChange({ refCatastral: e.target.value })}
          />
        </div>
        <div className="field-row">
          <label className="field-label">Tipo de uso</label>
          <select className="field-input" value={i.tipo}
            onChange={e => onChange({ tipo: e.target.value as Inmueble['tipo'] })}>
            <option value="arrendado">Arrendado todo el año</option>
            <option value="mixto">Mixto (parte arrendado, parte a disposición)</option>
            <option value="disposicion">A disposición del titular</option>
          </select>
        </div>
      </div>

      {/* Días */}
      <div className="block-section">
        <h4 className="block-section-title">Uso y días</h4>
        <div className="field-row">
          <label className="field-label">Días arrendados</label>
          <input className="field-input" type="number"
            value={i.diasArrendados || ''}
            onChange={e => onChange({ diasArrendados: parseInt(e.target.value) || 0 })}
          />
        </div>
        {i.tipo !== 'arrendado' && (
          <>
            <div className="field-row">
              <label className="field-label">Días a disposición del titular</label>
              <input className="field-input" type="number"
                value={i.diasDisposicion || ''}
                onChange={e => onChange({ diasDisposicion: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="field-row">
              <label className="field-label">Valor catastral revisado</label>
              <select className="field-input" value={i.valorCatastralRevisado ? 'si' : 'no'}
                onChange={e => onChange({ valorCatastralRevisado: e.target.value === 'si' })}>
                <option value="si">Sí (1,1%)</option>
                <option value="no">No (2%)</option>
              </select>
            </div>
            <Calc label="Renta imputada por días a disposición" value={n(i.rentaImputada)} />
          </>
        )}
      </div>

      {/* Ingresos */}
      <div className="block-section">
        <h4 className="block-section-title">Ingresos</h4>
        <F label="Ingresos íntegros computables" field="ingresosIntegros" />
      </div>

      {/* Gastos */}
      <div className="block-section">
        <h4 className="block-section-title">Gastos del ejercicio</h4>
        <F label="Intereses y gastos de financiación" field="interesesFinanciacion" />
        <F label="Gastos de reparación y conservación" field="gastosReparacion" />
        {n(i.excesoReparacion) > 0 && (
          <div className="warn-banner">
            Exceso intereses+reparación: {fmt(n(i.excesoReparacion))} € → se deducirá en los 4 ejercicios siguientes
          </div>
        )}
        <Calc label="Límite conjunto intereses + reparación (no supera ingresos)"
          value={n(i.limiteInteresesReparacion)} />
        <F label="Gastos de comunidad" field="gastosComunidad" />
        <F label="Servicios de profesionales independientes" field="serviciosPersonales" />
        <F label="Suministros" field="suministros" />
        <F label="Seguro" field="seguro" />
        <F label="Tributos y recargos" field="tributosRecargos" />
        <F label="Amortización bienes muebles" field="amortizacionMuebles" />
      </div>

      {/* Amortización inmueble */}
      <div className="block-section">
        <h4 className="block-section-title">Amortización del inmueble</h4>
        <div className="field-row">
          <label className="field-label">Fecha de adquisición</label>
          <input className="field-input field-input--text" type="date"
            value={i.fechaAdquisicion}
            onChange={e => onChange({ fechaAdquisicion: e.target.value })}
          />
        </div>
        <F label="Importe de adquisición" field="importeAdquisicion" />
        <F label="Gastos y tributos de adquisición" field="gastosTributos" />
        <F label="Mejoras realizadas en el ejercicio" field="mejoras" />
        <F label="Valor catastral" field="valorCatastral" />
        <F label="Valor catastral de la construcción" field="valorCatastralConstruccion" />
        <Calc label="% construcción / catastral" value={n(i.pctConstruccion)} />
        <Calc label="Base de amortización (3%)" value={n(i.baseAmortizacion)} />
        <Calc label="Amortización del ejercicio" value={n(i.amortizacionInmueble)} />
      </div>

      {/* Reducción */}
      <div className="block-section">
        <h4 className="block-section-title">Reducción por arrendamiento de vivienda</h4>
        <div className="field-row">
          <label className="field-label">¿Tiene derecho a reducción?</label>
          <select className="field-input" value={i.tieneReduccion ? 'si' : 'no'}
            onChange={e => onChange({ tieneReduccion: e.target.value === 'si' })}>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </div>
        {i.tieneReduccion && (
          <div className="field-row">
            <label className="field-label">Porcentaje de reducción</label>
            <select className="field-input" value={i.pctReduccion}
              onChange={e => onChange({ pctReduccion: Number(e.target.value) })}>
              <option value={50}>50% — General (contratos 2024+)</option>
              <option value={60}>60% — Zona de mercado tensionado</option>
              <option value={70}>70% — Joven o gran rehabilitación</option>
              <option value={90}>90% — Zona tensionada + reducción renta</option>
            </select>
          </div>
        )}
      </div>

      {/* Resultados */}
      <div className="block-results">
        <Calc label="Rendimiento neto" value={n(i.rendimientoNeto)} bold />
        {n(i.tieneReduccion ? i.rendimientoNeto - i.rendimientoNetoReducido : 0) > 0 && (
          <Calc
            label={`Reducción ${n(i.pctReduccion)}%`}
            value={-Math.abs(n(i.rendimientoNeto) - n(i.rendimientoNetoReducido))}
          />
        )}
        <Calc label="Rendimiento neto reducido" value={n(i.rendimientoNetoReducido)} bold />
      </div>
    </div>
  );
};

export default RealEstateBlock;
