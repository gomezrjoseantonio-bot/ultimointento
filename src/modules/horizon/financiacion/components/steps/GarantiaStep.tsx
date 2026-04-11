import React, { useEffect, useState } from 'react';
import { Home, User, BarChart2 } from 'lucide-react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';
import { Garantia, DestinoCapital } from '../../../../../types/prestamos';
import { inmuebleService } from '../../../../../services/inmuebleService';

interface GarantiaStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

const GARANTIA_OPTIONS: { id: Garantia['tipo']; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'HIPOTECARIA',  label: 'Hipotecaria',  sub: 'Un inmueble responde como garantía',         icon: <Home size={18} strokeWidth={1.5} /> },
  { id: 'PERSONAL',     label: 'Personal',     sub: 'El titular responde con su patrimonio',       icon: <User size={18} strokeWidth={1.5} /> },
  { id: 'PIGNORATICIA', label: 'Pignoraticia', sub: 'Activo financiero pignorado (fondo, PP…)',    icon: <BarChart2 size={18} strokeWidth={1.5} /> },
];

/**
 * Deriva una única garantía sugerida a partir de los destinos del préstamo.
 * Si hay algún inmueble en destinos → hipotecaria sobre el primero.
 * Si no hay inmueble → personal.
 */
function sugerirGarantia(destinos: DestinoCapital[] | undefined): Garantia[] {
  if (!destinos?.length) return [{ tipo: 'PERSONAL' }];

  const primerInmueble = destinos.find((d) => d.inmuebleId)?.inmuebleId;
  if (!primerInmueble) return [{ tipo: 'PERSONAL' }];

  return [{ tipo: 'HIPOTECARIA', inmuebleId: primerInmueble }];
}

const GarantiaStep: React.FC<GarantiaStepProps> = ({ data, onChange, errors }) => {
  const [inmuebles, setInmuebles] = useState<any[]>([]);
  const [diferente, setDiferente] = useState(false);

  useEffect(() => {
    inmuebleService.getAll()
      .then((list) => setInmuebles(list.filter((i: any) => i.estado === 'ACTIVO')))
      .catch(() => {});
  }, []);

  // Inicializar garantía sugerida si no hay ninguna
  useEffect(() => {
    if (!data.garantias?.length && data.destinos) {
      onChange({ garantias: sugerirGarantia(data.destinos) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const garantias: Garantia[] = data.garantias ?? sugerirGarantia(data.destinos);

  const handleTipoChange = (tipo: Garantia['tipo']) => {
    onChange({
      garantias: [{
        tipo,
        inmuebleId: tipo === 'HIPOTECARIA' ? garantias[0]?.inmuebleId : undefined,
        inversionId: tipo === 'PIGNORATICIA' ? garantias[0]?.inversionId : undefined,
      }],
    });
  };

  const handleInmuebleChange = (inmuebleId: string) => {
    const current = garantias[0] ?? { tipo: 'HIPOTECARIA' as const };
    onChange({ garantias: [{ ...current, inmuebleId: inmuebleId || undefined }] });
  };

  const handleDescripcionChange = (descripcion: string) => {
    const current = garantias[0] ?? { tipo: 'PERSONAL' as const };
    onChange({ garantias: [{ ...current, descripcion: descripcion || undefined }] });
  };

  const tipoActual = garantias[0]?.tipo ?? 'PERSONAL';
  const inmuebleActual = garantias[0]?.inmuebleId ?? '';
  const descripcionActual = garantias[0]?.descripcion ?? '';

  // Detecta si la garantía difiere del destino (para mostrar el toggle activo)
  const destinosInmuebles = new Set(
    (data.destinos ?? []).filter((d) => d.inmuebleId).map((d) => d.inmuebleId!),
  );
  const hasDifference =
    (tipoActual === 'PERSONAL' && destinosInmuebles.size > 0) ||
    (tipoActual === 'HIPOTECARIA' && Boolean(inmuebleActual) && !destinosInmuebles.has(inmuebleActual)) ||
    tipoActual === 'PIGNORATICIA';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--atlas-navy-1)', marginBottom: 4 }}>
          Garantía del préstamo
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-gray)', marginBottom: 16 }}>
          La garantía es informativa y no afecta a ningún cálculo fiscal ni de imputación.
        </div>

        {/* Toggle "diferente al destino" */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 14px', borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb',
        }}>
          <input
            id="garantia-diferente"
            type="checkbox"
            checked={diferente || hasDifference}
            onChange={(e) => {
              setDiferente(e.target.checked);
              if (!e.target.checked) {
                // Restaurar sugerencia por defecto
                onChange({ garantias: sugerirGarantia(data.destinos) });
              }
            }}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--atlas-blue)' }}
          />
          <label htmlFor="garantia-diferente" style={{ fontSize: 13, color: 'var(--atlas-navy-1)', cursor: 'pointer' }}>
            La garantía es <strong>diferente</strong> al destino del capital
            <span style={{ fontSize: 11, color: 'var(--text-gray)', display: 'block' }}>
              Ej: préstamo para comprar T48, garantía sobre Buigas
            </span>
          </label>
        </div>
      </div>

      {/* Selector de tipo de garantía */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-gray)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Tipo de garantía
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {GARANTIA_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleTipoChange(opt.id)}
              style={{
                border: `2px solid ${tipoActual === opt.id ? 'var(--atlas-blue)' : '#ddd'}`,
                borderRadius: 8,
                padding: '12px 8px',
                cursor: 'pointer',
                backgroundColor: tipoActual === opt.id ? 'rgba(4,44,94,0.07)' : 'var(--bg)',
                color: tipoActual === opt.id ? 'var(--atlas-blue)' : 'var(--atlas-navy-1)',
                textAlign: 'left',
                transition: 'all 150ms ease',
              }}
            >
              <div style={{ marginBottom: 6 }}>{opt.icon}</div>
              <div style={{ fontSize: 13, fontWeight: tipoActual === opt.id ? 700 : 500 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-gray)', marginTop: 2 }}>{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Selector inmueble garante (solo HIPOTECARIA) */}
      {tipoActual === 'HIPOTECARIA' && (
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-gray)', marginBottom: 6 }}>
            Inmueble en garantía
          </label>
          <select
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid #ddd',
              borderRadius: 6, fontSize: 13, backgroundColor: 'var(--bg)', color: 'var(--atlas-navy-1)',
            }}
            value={inmuebleActual}
            onChange={(e) => handleInmuebleChange(e.target.value)}
          >
            <option value="">Selecciona un inmueble…</option>
            {inmuebles.map((inm: any) => (
              <option key={inm.id} value={inm.id}>
                {inm.alias || `${inm.direccion?.calle ?? ''}, ${inm.direccion?.municipio ?? ''}`.trim() || inm.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Descripción libre (para todos los tipos) */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-gray)', marginBottom: 6 }}>
          Descripción (opcional)
        </label>
        <input
          type="text"
          placeholder={
            tipoActual === 'HIPOTECARIA' ? 'Ej: Buigas 15, Sant Fruitós' :
            tipoActual === 'PIGNORATICIA' ? 'Ej: Plan Pensiones Orange' :
            'Ej: Aval personal de Jose'
          }
          value={descripcionActual}
          onChange={(e) => handleDescripcionChange(e.target.value)}
          style={{
            width: '100%', padding: '8px 10px', border: '1px solid #ddd',
            borderRadius: 6, fontSize: 13, backgroundColor: 'var(--bg)', color: 'var(--atlas-navy-1)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Recordatorio fiscal */}
      <div style={{
        padding: '10px 14px', borderRadius: 8,
        backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
        fontSize: 12, color: '#1e40af',
      }}>
        La garantía no afecta a la fiscalidad. Solo el <strong>destino del capital</strong> determina
        qué intereses son deducibles. Esta información es exclusivamente informativa.
      </div>

      {errors.garantias && (
        <div style={{ color: 'var(--error)', fontSize: 12 }}>{errors.garantias}</div>
      )}
    </div>
  );
};

export default GarantiaStep;
