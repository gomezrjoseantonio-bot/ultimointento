import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import TaxSectionCard from '../shared/TaxSectionCard';
import { GananciaPatrimonial, SaldoNegativoBIA } from '../../../store/taxSlice';

interface PatrimGainsBlockProps {
  ganancias: GananciaPatrimonial[];
  saldos: SaldoNegativoBIA[];
  onUpdateGanancia: <K extends keyof GananciaPatrimonial>(id: string, field: K, value: GananciaPatrimonial[K]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

const PatrimGainsBlock: React.FC<PatrimGainsBlockProps> = ({ ganancias, saldos, onUpdateGanancia, onAdd, onRemove }) => (
  <TaxSectionCard title="Ganancias y pérdidas patrimoniales" actions={<button className="btn-primary" onClick={onAdd}><Plus size={16} />Añadir operación</button>}>
    <div className="tax-table-wrap">
      <table className="tax-table">
        <thead><tr><th>Tipo</th><th>Descripción</th><th>Valor transmisión</th><th>Valor adquisición</th><th>Resultado</th><th /></tr></thead>
        <tbody>
          {ganancias.map((g) => (
            <tr key={g.id}>
              <td><select value={g.tipo} onChange={(e) => onUpdateGanancia(g.id, 'tipo', e.target.value as GananciaPatrimonial['tipo'])}><option value="inmueble">Transmisión de inmueble (BIA)</option><option value="fondos">Transmisión de fondos/acciones (BIA)</option><option value="cripto">Criptomonedas (BIA)</option><option value="otra_bg">Otras ganancias no derivadas de transmisión (BIG)</option><option value="otra_ba">Otras transmisiones (BIG)</option></select></td>
              <td><input value={g.descripcion} onChange={(e) => onUpdateGanancia(g.id, 'descripcion', e.target.value)} /></td>
              <td><input type="number" value={g.valorTransmision} onChange={(e) => onUpdateGanancia(g.id, 'valorTransmision', Number(e.target.value))} /></td>
              <td><input type="number" value={g.valorAdquisicion} onChange={(e) => onUpdateGanancia(g.id, 'valorAdquisicion', Number(e.target.value))} /></td>
              <td className="mono">{g.resultado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
              <td><button className="btn-icon" onClick={() => onRemove(g.id)}><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="tax-subcard">
      <h4>Saldos negativos de años anteriores (BIA)</h4>
      {saldos.map((s) => (
        <div key={s.ejercicio} className="tax-inline-row">
          <span>Ejercicio {s.ejercicio}</span><span className="mono">Pendiente inicio: {s.pendienteInicio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span><span className="mono">Aplicado: {s.aplicado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span><span className="mono">Pendiente futuro: {s.pendienteFuturo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
        </div>
      ))}
    </div>
  </TaxSectionCard>
);

export default PatrimGainsBlock;
