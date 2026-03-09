import React, { useState, useEffect } from 'react';
import { PersonalExpense, CategoriaGasto, Frecuencia } from '../../../types/personal';
import { personalExpensesService } from '../../../services/personalExpensesService';

export interface PersonalExpenseFormProps {
  gasto?: PersonalExpense;
  onSuccess: () => void;
  onCancel: () => void;
}

const CATEGORIAS: { value: CategoriaGasto; label: string }[] = [
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'alimentacion', label: 'Alimentación' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'salud', label: 'Salud' },
  { value: 'ocio', label: 'Ocio' },
  { value: 'ropa', label: 'Ropa' },
  { value: 'educacion', label: 'Educación' },
  { value: 'otros', label: 'Otros' },
];

const FRECUENCIAS: { value: Frecuencia; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

// ─── Design tokens ─────────────────────────────────────────────────────────
const BLUE = '#042C5E';
const N700 = '#303A4C';
const N300 = '#C8D0DC';
const S_NEG = '#B91C1C';

const inputBase: React.CSSProperties = {
  width: '100%',
  borderRadius: 6,
  border: `1px solid ${N300}`,
  padding: '8px 12px',
  fontSize: 14,
  color: N700,
  outline: 'none',
  fontFamily: 'IBM Plex Sans, Inter, sans-serif',
  backgroundColor: '#fff',
};

const inputError: React.CSSProperties = {
  ...inputBase,
  borderColor: S_NEG,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 4,
  color: N700,
  fontFamily: 'IBM Plex Sans, Inter, sans-serif',
};

// ───────────────────────────────────────────────────────────────────────────

const PersonalExpenseForm: React.FC<PersonalExpenseFormProps> = ({
  gasto,
  onSuccess,
  onCancel,
}) => {
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('otros');
  const [importe, setImporte] = useState('');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual');
  const [dia, setDia] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (gasto) {
      setConcepto(gasto.concepto);
      setCategoria(gasto.categoria);
      setImporte(String(gasto.importe));
      setFrecuencia(gasto.frecuencia);
      setDia(gasto.dia != null ? String(gasto.dia) : '');
      setNotas(gasto.notas ?? '');
    }
  }, [gasto]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!concepto.trim()) errs.concepto = 'El concepto es obligatorio';
    if (!importe || isNaN(Number(importe)) || Number(importe) <= 0)
      errs.importe = 'Introduce un importe válido';
    if (dia && (isNaN(Number(dia)) || Number(dia) < 1 || Number(dia) > 31))
      errs.dia = 'El día debe estar entre 1 y 31';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        concepto: concepto.trim(),
        categoria,
        importe: Number(importe),
        frecuencia,
        ...(dia ? { dia: Number(dia) } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
        createdAt: gasto?.createdAt ?? new Date().toISOString(),
      };

      if (gasto?.id !== undefined) {
        await personalExpensesService.update({ ...payload, id: gasto.id });
      } else {
        await personalExpensesService.create(payload);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const muted: React.CSSProperties = { fontWeight: 400, fontSize: 11, color: N300 };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Concepto */}
      <div>
        <label style={labelStyle}>Concepto</label>
        <input
          type="text"
          value={concepto}
          onChange={e => setConcepto(e.target.value)}
          placeholder="Ej. Alquiler piso"
          style={errors.concepto ? inputError : inputBase}
        />
        {errors.concepto && (
          <p style={{ marginTop: 4, fontSize: 11, color: S_NEG }}>{errors.concepto}</p>
        )}
      </div>

      {/* Categoría */}
      <div>
        <label style={labelStyle}>Categoría</label>
        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value as CategoriaGasto)}
          style={inputBase}
        >
          {CATEGORIAS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Importe + Frecuencia */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Importe (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={importe}
            onChange={e => setImporte(e.target.value)}
            placeholder="0.00"
            style={{
              ...(errors.importe ? inputError : inputBase),
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          />
          {errors.importe && (
            <p style={{ marginTop: 4, fontSize: 11, color: S_NEG }}>{errors.importe}</p>
          )}
        </div>
        <div>
          <label style={labelStyle}>Frecuencia</label>
          <select
            value={frecuencia}
            onChange={e => setFrecuencia(e.target.value as Frecuencia)}
            style={inputBase}
          >
            {FRECUENCIAS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Día del mes */}
      <div>
        <label style={labelStyle}>
          Día de cargo{' '}
          <span style={muted}>(opcional, 1–31)</span>
        </label>
        <input
          type="number"
          min="1"
          max="31"
          value={dia}
          onChange={e => setDia(e.target.value)}
          placeholder="—"
          style={{
            ...(errors.dia ? inputError : inputBase),
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        />
        {errors.dia && (
          <p style={{ marginTop: 4, fontSize: 11, color: S_NEG }}>{errors.dia}</p>
        )}
      </div>

      {/* Notas */}
      <div>
        <label style={labelStyle}>
          Notas <span style={muted}>(opcional)</span>
        </label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={3}
          placeholder="Notas adicionales..."
          style={{ ...inputBase, resize: 'none' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 6,
            border: `1px solid ${N300}`,
            background: 'transparent',
            color: N700,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'IBM Plex Sans, Inter, sans-serif',
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 6,
            border: 'none',
            background: BLUE,
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontFamily: 'IBM Plex Sans, Inter, sans-serif',
          }}
        >
          {loading ? 'Guardando...' : gasto ? 'Actualizar' : 'Guardar gasto'}
        </button>
      </div>
    </form>
  );
};

export default PersonalExpenseForm;
