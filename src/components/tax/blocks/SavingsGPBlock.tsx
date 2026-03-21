import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import { RootState } from '../../../store';
import {
  updateCapitalMobiliario, addGanancia, updateGanancia, removeGanancia, n,
} from '../../../store/taxSlice';

interface Props {
  readOnly?: boolean;
}

const SavingsGPBlock: React.FC<Props> = ({ readOnly = false }) => {
  const dispatch = useDispatch();
  const cap = useSelector((s: RootState) => s.tax.capitalMobiliario);
  const ganancias = useSelector((s: RootState) => s.tax.ganancias);
  const saldos = useSelector((s: RootState) => s.tax.saldosNegativosBIA);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const setCapital = (field: string, val: string) => {
    if (readOnly) return;
    dispatch(updateCapitalMobiliario({ [field]: parseFloat(val.replace(',', '.')) || 0 }));
  };

  return (
    <div className="block-root">
      <h3 className="block-title">Capital mobiliario</h3>
      <div className="block-section">
        {[
          { label: 'Intereses de cuentas y depósitos', field: 'interesesCuentasDepositos', value: cap.interesesCuentasDepositos },
          { label: 'Otros rendimientos mobiliarios', field: 'otrosRendimientos', value: cap.otrosRendimientos },
          { label: 'Retención', field: 'retencion', value: cap.retencion },
        ].map(({ label, field, value }) => (
          <div key={field} className="field-row">
            <label className="field-label">{label}</label>
            <input
              className="field-input"
              type="number"
              step="0.01"
              value={value === 0 ? '' : value}
              placeholder="0,00"
              onChange={readOnly ? undefined : (e) => setCapital(field, e.target.value)}
              readOnly={readOnly}
            />
            <span className="field-unit">€</span>
          </div>
        ))}
      </div>

      <div className="block-header-row" style={{ marginTop: 32 }}>
        <h3 className="block-title">Ganancias y pérdidas patrimoniales</h3>
        <button className="btn-add" onClick={() => !readOnly && dispatch(addGanancia())} disabled={readOnly}>
          <Plus size={14}/> Añadir operación
        </button>
      </div>

      {ganancias.length === 0 && (
        <div className="block-empty">No hay operaciones registradas.</div>
      )}

      {ganancias.map((ganancia) => (
        <div key={ganancia.id} className="block-section gp-row">
          <div className="gp-row-header">
            <select
              className="field-input"
              value={ganancia.tipo}
              onChange={readOnly ? undefined : (e) => dispatch(updateGanancia({
                id: ganancia.id,
                data: {
                  tipo: e.target.value as any,
                  base: ['otra_bg'].includes(e.target.value) ? 'general' : 'ahorro',
                },
              }))}
              disabled={readOnly}
            >
              <option value="inmueble">Transmisión de inmueble (BIA)</option>
              <option value="fondos">Transmisión de fondos/acciones (BIA)</option>
              <option value="cripto">Criptomonedas (BIA)</option>
              <option value="otra_bg">Otras ganancias (base general)</option>
              <option value="otra_ba">Otras transmisiones (BIA)</option>
            </select>
            <input
              className="field-input field-input--text"
              value={ganancia.descripcion}
              placeholder="Descripción (ej. USDT, BTC...)"
              onChange={readOnly ? undefined : (e) => dispatch(updateGanancia({ id: ganancia.id, data: { descripcion: e.target.value } }))}
              readOnly={readOnly}
            />
            <button className="btn-icon-danger" onClick={() => !readOnly && dispatch(removeGanancia(ganancia.id))} disabled={readOnly}>
              <Trash2 size={14}/>
            </button>
          </div>
          <div className="gp-row-fields">
            <div className="field-row">
              <label className="field-label">Valor de transmisión</label>
              <input
                className="field-input"
                type="number"
                step="0.01"
                value={ganancia.valorTransmision === 0 ? '' : ganancia.valorTransmision}
                placeholder="0,00"
                onChange={readOnly ? undefined : (e) => dispatch(updateGanancia({ id: ganancia.id, data: { valorTransmision: parseFloat(e.target.value) || 0 } }))}
                readOnly={readOnly}
              />
              <span className="field-unit">€</span>
            </div>
            <div className="field-row">
              <label className="field-label">Valor de adquisición</label>
              <input
                className="field-input"
                type="number"
                step="0.01"
                value={ganancia.valorAdquisicion === 0 ? '' : ganancia.valorAdquisicion}
                placeholder="0,00"
                onChange={readOnly ? undefined : (e) => dispatch(updateGanancia({ id: ganancia.id, data: { valorAdquisicion: parseFloat(e.target.value) || 0 } }))}
                readOnly={readOnly}
              />
              <span className="field-unit">€</span>
            </div>
            <div className="calc-row calc-row--bold">
              <span className="calc-label">Resultado</span>
              <span className={`calc-value ${n(ganancia.resultado) >= 0 ? 'color-pos' : 'color-neg'}`}>
                {fmt(n(ganancia.resultado))} €
              </span>
            </div>
          </div>
        </div>
      ))}

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
              {saldos.map((saldo) => (
                <tr key={saldo.ejercicio}>
                  <td>{saldo.ejercicio}</td>
                  <td className="num">{fmt(saldo.pendienteInicio)} €</td>
                  <td className="num">{fmt(saldo.aplicado)} €</td>
                  <td className="num">{fmt(saldo.pendienteFuturo)} €</td>
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
