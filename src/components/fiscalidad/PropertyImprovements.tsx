import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, Save, Wrench, MoreHorizontal, Edit3 } from 'lucide-react';
import {
  addPropertyImprovement,
  getPropertyImprovements,
  deletePropertyImprovement,
  formatEsCurrency,
} from '../../services/aeatAmortizationService';
import { PropertyImprovement } from '../../services/db';
import { parseEuroInput } from '../../utils/formatUtils';
import MoneyInput from '../common/MoneyInput';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../services/confirmationService';
import FiscalChip from '../fiscal/ui/FiscalChip';

interface PropertyImprovementsProps {
  propertyId: number;
  onImprovementsChange?: () => void;
}

interface ImprovementFormData {
  year: string;
  amount: string;
  date: string;
  daysInYear: string;
  providerNIF: string;
  description: string;
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 16px',
  border: '1.5px solid var(--n-300)',
  borderRadius: 'var(--r-md)',
  transition: 'all 150ms ease',
};

const PropertyImprovements: React.FC<PropertyImprovementsProps> = ({ propertyId, onImprovementsChange }) => {
  const [improvements, setImprovements] = useState<PropertyImprovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ImprovementFormData>({
    year: new Date().getFullYear().toString(), amount: '', date: '', daysInYear: '', providerNIF: '', description: '',
  });

  const loadImprovements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPropertyImprovements(propertyId);
      setImprovements(data.sort((a, b) => b.year - a.year));
    } catch (error) {
      console.error('Error loading improvements:', error);
      toast.error('Error al cargar las mejoras');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { loadImprovements(); }, [loadImprovements]);

  const resetForm = () => {
    setFormData({ year: new Date().getFullYear().toString(), amount: '', date: '', daysInYear: '', providerNIF: '', description: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseEuroInput(formData.amount);
    if (!amount || amount <= 0) return toast.error('El importe debe ser mayor que 0');
    if (!formData.description.trim()) return toast.error('La descripción es obligatoria');

    try {
      setLoading(true);
      const improvement = {
        propertyId,
        year: parseInt(formData.year, 10),
        amount,
        date: formData.date || undefined,
        daysInYear: formData.daysInYear ? parseInt(formData.daysInYear, 10) : undefined,
        counterpartyNIF: formData.providerNIF.trim() || undefined,
        description: formData.description.trim(),
      };
      if (editingId) {
        toast.error('Edición no implementada aún');
        return;
      }
      await addPropertyImprovement(improvement);
      toast.success('Mejora añadida correctamente');
      await loadImprovements();
      onImprovementsChange?.();
      resetForm();
    } catch (error) {
      console.error('Error saving improvement:', error);
      if (editingId !== null) {
        toast.error('Error al actualizar la mejora');
      } else {
        toast.error('Error al guardar la mejora');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (improvement: PropertyImprovement) => {
    if (!improvement.id) {
      toast.error('No se pudo identificar la mejora');
      return;
    }

    setEditingId(improvement.id);
    setFormData({
      year: improvement.year.toString(),
      amount: improvement.amount.toString(),
      date: improvement.date ?? '',
      daysInYear: improvement.daysInYear?.toString() ?? '',
      providerNIF: improvement.counterpartyNIF ?? '',
      description: improvement.description,
    });
    setShowForm(true);
  };

  const handleDelete = async (improvementId: number) => {
    const confirmed = await confirmDelete('Está seguro de que desea eliminar esta mejora');
    if (!confirmed) return;
    try {
      setLoading(true);
      await deletePropertyImprovement(improvementId);
      await loadImprovements();
      onImprovementsChange?.();
      toast.success('Mejora eliminada correctamente');
    } catch (error) {
      console.error('Error deleting improvement:', error);
      toast.error('Error al eliminar la mejora');
    } finally {
      setLoading(false);
      setOpenMenuId(null);
    }
  };

  return (
    <div style={{ background: 'var(--white)', border: '1.5px solid var(--n-200)', borderRadius: 'var(--r-lg)', padding: 'var(--s5)', fontFamily: 'var(--font-ui)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s4)' }}>
        <div>
          <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
            <Wrench size={20} color="var(--blue)" />
            <h3 style={{ fontSize: 'var(--t-xl)', color: 'var(--n-900)', fontWeight: 600 }}>Mejoras del inmueble</h3>
          </div>
          <p style={{ fontSize: 'var(--t-base)', color: 'var(--n-500)' }}>Inmueble {propertyId}</p>
        </div>
        {editingId === null && (
          <button onClick={() => setShowForm(true)} disabled={loading || showForm} style={{ padding: 'var(--s2) var(--s3)', borderRadius: 'var(--r-md)', background: 'var(--blue)', color: 'var(--white)' }}>
            <Plus size={14} /> Nueva mejora
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--n-50)', border: '1.5px solid var(--blue)', borderRadius: 'var(--r-lg)', padding: 'var(--s5)', marginBottom: 'var(--s4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--s3)' }}>
            <span style={{ fontSize: 'var(--t-base)', fontWeight: 500, color: 'var(--n-900)' }}>{editingId ? 'Editar mejora' : 'Nueva mejora'}</span>
            {editingId ? <FiscalChip label="modo edición" variant="neu" /> : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
            <input type="number" min="2000" max={new Date().getFullYear()} value={formData.year} onChange={e => setFormData(prev => ({ ...prev, year: e.target.value }))} style={fieldStyle} />
            <MoneyInput value={formData.amount} onChange={value => setFormData(prev => ({ ...prev, amount: value }))} placeholder="15.000,00" aria-label="Importe de la mejora" />
            <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} style={fieldStyle} />
            <input type="number" min="1" max="366" value={formData.daysInYear} onChange={e => setFormData(prev => ({ ...prev, daysInYear: e.target.value }))} style={fieldStyle} placeholder="365" />
            <input type="text" value={formData.providerNIF} onChange={e => setFormData(prev => ({ ...prev, providerNIF: e.target.value }))} style={fieldStyle} placeholder="NIF proveedor" />
            <input type="text" value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} style={fieldStyle} placeholder="Descripción" required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s2)' }}>
            <button type="button" onClick={resetForm} style={{ padding: 'var(--s2) var(--s3)', borderRadius: 'var(--r-md)', border: '1.5px solid var(--n-300)', color: 'var(--n-700)' }}>Cancelar</button>
            <button type="submit" style={{ padding: 'var(--s2) var(--s3)', borderRadius: 'var(--r-md)', background: 'var(--blue)', color: 'var(--white)' }}>
              <Save size={14} /> {editingId ? 'Guardar cambios' : 'Guardar mejora'}
            </button>
          </div>
        </form>
      )}

      {loading && improvements.length === 0 ? <p style={{ color: 'var(--n-500)' }}>Cargando mejoras...</p> : null}

      {improvements.map(improvement => (
        <div
          key={improvement.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 'var(--s3)',
            padding: 'var(--s3) 0',
            borderBottom: '0.5px solid var(--n-200)',
            background: editingId === improvement.id ? 'var(--n-100)' : 'transparent',
            borderRadius: editingId === improvement.id ? 'var(--r-md)' : undefined,
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--t-base)', fontWeight: 500, color: 'var(--n-900)' }}>{improvement.description}</div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--n-500)' }}>{improvement.year} · {improvement.date ? new Date(improvement.date).toLocaleDateString('es-ES') : 'Sin fecha'}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-md)', color: 'var(--n-900)', textAlign: 'right' }}>{formatEsCurrency(improvement.amount)}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
            <button onClick={() => setEditingId(improvement.id ?? null)} style={{ padding: 'var(--s1) var(--s2)', color: 'var(--n-700)' }}>
              <Edit3 size={14} /> Editar
            </button>
            <button onClick={() => setOpenMenuId(openMenuId === improvement.id ? null : improvement.id ?? null)} style={{ padding: 'var(--s1)', borderRadius: 'var(--r-sm)', color: 'var(--n-700)' }}>
              <MoreHorizontal size={16} />
            </button>
            {openMenuId === improvement.id && (
              <div style={{ position: 'absolute', top: 'var(--s5)', right: 0, background: 'var(--white)', border: '1.5px solid var(--n-200)', borderRadius: 'var(--r-md)', padding: 'var(--s1)' }}>
                <button onClick={() => improvement.id && handleDelete(improvement.id)} style={{ padding: 'var(--s1) var(--s2)', color: 'var(--s-neg)' }}>
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 'var(--s3)', display: 'flex', gap: 'var(--s2)', color: 'var(--n-500)', fontSize: 'var(--t-xs)' }}>
        <Calendar size={14} color="var(--teal)" />
        <span>Las mejoras incrementan la base amortizable desde el año siguiente.</span>
      </div>
    </div>
  );
};

export default PropertyImprovements;
