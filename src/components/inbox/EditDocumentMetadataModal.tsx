// D-CRUD-ALTA · sub-tarea 4 · UI editar metadata documento
// Modal con campos editables: tipo · fecha (issueDate) · proveedor · importe · descripción.
// Persiste con db.put('documents', updatedDoc) sin tocar el blob original.

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { initDB } from '../../services/db';
import toast from 'react-hot-toast';

interface EditDocumentMetadataModalProps {
  isOpen: boolean;
  document: any | null;
  onClose: () => void;
  onSaved: (updatedDoc: any) => void;
}

const TIPO_OPTIONS = [
  { value: '', label: '— Sin clasificar —' },
  { value: 'Factura', label: 'Factura' },
  { value: 'Contrato', label: 'Contrato' },
  { value: 'Mejora', label: 'Mejora' },
  { value: 'Extracto bancario', label: 'Extracto bancario' },
  { value: 'Otros', label: 'Otros' },
];

const EditDocumentMetadataModal: React.FC<EditDocumentMetadataModalProps> = ({
  isOpen,
  document: doc,
  onClose,
  onSaved,
}) => {
  const [tipo, setTipo] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !doc) return;
    setTipo(String(doc.metadata?.tipo ?? ''));
    setProveedor(String(doc.metadata?.proveedor ?? doc.metadata?.counterpartyName ?? doc.metadata?.contraparte ?? ''));
    setIssueDate(String(doc.metadata?.financialData?.issueDate ?? ''));
    const amt = doc.metadata?.financialData?.amount;
    setAmount(typeof amt === 'number' ? String(amt) : '');
    setDescription(String(doc.metadata?.description ?? doc.metadata?.notas ?? ''));
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const handleSave = async (): Promise<void> => {
    if (doc.id == null) {
      toast.error('Documento sin id · no se puede guardar');
      return;
    }
    setSaving(true);
    try {
      const db = await initDB();
      const parsedAmount = amount.trim() === '' ? undefined : Number(amount.replace(',', '.'));
      if (parsedAmount !== undefined && Number.isNaN(parsedAmount)) {
        toast.error('Importe no válido');
        setSaving(false);
        return;
      }
      const updated = {
        ...doc,
        metadata: {
          ...doc.metadata,
          tipo: tipo === '' ? undefined : (tipo as any),
          proveedor: proveedor.trim() || undefined,
          counterpartyName: proveedor.trim() || doc.metadata?.counterpartyName,
          description: description.trim() || undefined,
          financialData: {
            ...(doc.metadata?.financialData || {}),
            amount: parsedAmount,
            issueDate: issueDate || undefined,
          },
        },
      };
      await db.put('documents', updated);
      toast.success('Metadata actualizada');
      onSaved(updated);
      onClose();
    } catch (err) {
      console.error('Error saving document metadata', err);
      toast.error('Error al guardar metadata');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm" onClick={() => !saving && onClose()} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full" style={{ borderRadius: 'var(--r-md)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--n-200)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--n-900)' }}>Editar metadata documento</h3>
            <button type="button" onClick={() => !saving && onClose()} aria-label="Cerrar" className="p-1 rounded hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-700)' }}>Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: 'var(--n-200)' }}
              >
                {TIPO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-700)' }}>Fecha emisión</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: 'var(--n-200)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-700)' }}>Proveedor</label>
              <input
                type="text"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre proveedor / contraparte"
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: 'var(--n-200)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-700)' }}>Importe (€)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                style={{ borderColor: 'var(--n-200)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--n-700)' }}>Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border rounded px-3 py-2 text-sm resize-none"
                style={{ borderColor: 'var(--n-200)' }}
              />
            </div>
          </div>
          <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--n-200)', background: 'var(--n-50, #f9fafb)' }}>
            <button
              type="button"
              onClick={() => !saving && onClose()}
              disabled={saving}
              className="atlas-btn-secondary atlas-btn-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="atlas-btn-primary atlas-btn-sm"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditDocumentMetadataModal;
