import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import { RootState } from '../../../store';
import {
  updateCapitalMobiliario, addGanancia, updateGanancia, removeGanancia, n
} from '../../../store/taxSlice';

const SavingsGPBlock: React.FC = () => {
  const dispatch = useDispatch();
  const cap = useSelector((s: RootState) => s.tax.capitalMobiliario);
  const ganancias = useSelector((s: RootState) => s.tax.ganancias);
  const saldos = useSelector((s: RootState) => s.tax.saldosNegativosBIA);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const setCapital = (field: string, val: string) =>
    dispatch(updateCapitalMobiliario({ [field]: parseFloat(val.replace(',', '.')) || 0 }));

  return (
    <div className="block-root">
      {/* Capital mobiliario */}
      <h3 className="block-title">Capital mobiliario</h3>
      <div className="block-section">
        {[
          { label: 'Intereses de cuentas y depósitos', field: 'interesesCuentasDepositos', value: cap.interesesCuentasDepositos },
          { label: 'Otros rendimientos mobiliarios', field: 'otrosRendimientos', value: cap.otrosRendimientos },
          { label: 'Retención', field: 'retencion', value: cap.retencion },
        ].map(({ label, field, value }) => (
          <div key={field} className="field-row">
            <label className="field-label">{label}</label>
            <input className="field-input" type="number" step="0.01"
              value={value === 0 ? '' : value} placeholder="0,00"
              onChange={e => setCapital(field, e.target.value)}
            />
            <span className="field-unit">€</span>
          </div>
        ))}
      </div>

      {/* Ganancias y pérdidas */}
      <div className="block-header-row" style={{ marginTop: 32 }}>
        <h3 className="block-title">Ganancias y pérdidas patrimoniales</h3>
        <button className="btn-add" onClick={() => dispatch(addGanancia())}>
          <Plus size={14}/> Añadir operación
        </button>
      </div>

      {ganancias.length === 0 && (
        <div className="block-empty">No hay operaciones registradas.</div>
      )}

      {ganancias.map(g => (
        <div key={g.id} className="block-section gp-row">
          <div className="gp-row-header">
            <select className="field-input" value={g.tipo}
              onChange={e => dispatch(updateGanancia({ id: g.id, data: { tipo: e.target.value as any, base: ['otra_bg'].includes(e.target.value) ? 'general' : 'ahorro' }}))}>
              <option value="inmueble">Transmisión de inmueble (BIA)</option>
              <option value="fondos">Transmisión de fondos/acciones (BIA)</option>
              <option value="cripto">Criptomonedas (BIA)</option>
              <option value="otra_bg">Otras ganancias (base general)</option>
              <option value="otra_ba">Otras transmisiones (BIA)</option>
            </select>
            <input className="field-input field-input--text"
              value={g.descripcion} placeholder="Descripción (ej. USDT, BTC...)"
              onChange={e => dispatch(updateGanancia({ id: g.id, data: { descripcion: e.target.value }}))}
            />
            <button className="btn-icon-danger" onClick={() => dispatch(removeGanancia(g.id))}>
              <Trash2 size={14}/>
            </button>
          </div>
          <div className="gp-row-fields">
            <div className="field-row">
              <label className="field-label">Valor de transmisión</label>
              <input className="field-input" type="number" step="0.01"
                value={g.valorTransmision === 0 ? '' : g.valorTransmision} placeholder="0,00"
                onChange={e => dispatch(updateGanancia({ id: g.id, data: { valorTransmision: parseFloat(e.target.value) || 0 }}))}
              />
              <span className="field-unit">€</span>
            </div>
            <div className="field-row">
              <label className="field-label">Valor de adquisición</label>
              <input className="field-input" type="number" step="0.01"
                value={g.valorAdquisicion === 0 ? '' : g.valorAdquisicion} placeholder="0,00"
                onChange={e => dispatch(updateGanancia({ id: g.id, data: { valorAdquisicion: parseFloat(e.target.value) || 0 }}))}
              />
              <span className="field-unit">€</span>
            </div>
            <div className="calc-row calc-row--bold">
              <span className="calc-label">Resultado</span>
              <span className={`calc-value ${n(g.resultado) >= 0 ? 'color-pos' : 'color-neg'}`}>
                {fmt(n(g.resultado))} €
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Saldos negativos BIA de años anteriores */}
      {saldos.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h4 className="block-section-title">Saldos negativos BIA pendientes de compensar</h4>
          <table className="re-table">
            <thead>
              <tr>
                <th>Ejercicio</th>
                <th className="num">Pendiente inicio</th>
                <th className="num">Aplicado este año</th>
                <th className="num">Pendiente futuro</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map(s => (
                <tr key={s.ejercicio}>
                  <td>{s.ejercicio}</td>
                  <td className="num">{fmt(s.pendienteInicio)} €</td>
                  <td className="num">{fmt(s.aplicado)} €</td>
                  <td className="num">{fmt(s.pendienteFuturo)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SavingsGPBlock;
