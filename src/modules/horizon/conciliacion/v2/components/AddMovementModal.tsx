import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB } from '../../../../../services/db';
import type { Account, Property, TreasuryEvent } from '../../../../../services/db';
import { computeDocFlags } from '../../../../../services/documentRequirementsService';

interface AddMovementModalProps {
  accounts: Account[];
  properties: Property[];
  defaultYear: number;
  defaultMonth0: number;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

const CATEGORY_OPTIONS = [
  'Alquiler',
  'Reparación inmueble', 'Mejora inmueble', 'Mobiliario inmueble',
  'Comunidad', 'Seguro', 'Suministro', 'IBI', 'Basuras', 'Tributo',
  'Financiación', 'Hipoteca',
  'Nómina', 'Gasto personal',
  'Traspaso interno', 'Otros',
];

const AddMovementModal: React.FC<AddMovementModalProps> = ({
  accounts,
  properties,
  defaultYear,
  defaultMonth0,
  onClose,
  onCreated,
}) => {
  const defaultDate = new Date(defaultYear, defaultMonth0, 1).toISOString().slice(0, 10);

  const [date, setDate] = useState(defaultDate);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'financing'>('expense');
  const [accountId, setAccountId] = useState<number | undefined>(
    accounts.length > 0 ? accounts[0].id : undefined,
  );
  const [concept, setConcept] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [ambito, setAmbito] = useState<'PERSONAL' | 'INMUEBLE'>('PERSONAL');
  const [inmuebleId, setInmuebleId] = useState<number | undefined>(undefined);
  const [categoryLabel, setCategoryLabel] = useState('Otros');
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Importe no válido');
      return;
    }
    if (!concept.trim()) {
      toast.error('Añade un concepto');
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const flags = computeDocFlags(categoryLabel);
      const event: Omit<TreasuryEvent, 'id'> = {
        type,
        amount: parsed,
        predictedDate: date,
        description: concept.trim(),
        sourceType: 'manual',
        accountId,
        status: 'predicted',
        ambito,
        inmuebleId: ambito === 'INMUEBLE' ? inmuebleId : undefined,
        categoryLabel,
        counterparty: counterparty.trim() || undefined,
        facturaNoAplica: flags.facturaNoAplica,
        justificanteNoAplica: flags.justificanteNoAplica,
        createdAt: now,
        updatedAt: now,
      };
      const db = await initDB();
      await (db as any).add('treasuryEvents', event);
      toast.success('Previsión creada');
      await onCreated();
      onClose();
    } catch (err) {
      console.error('[AddMovementModal] create failed', err);
      toast.error('No se pudo crear la previsión');
    } finally {
      setBusy(false);
    }
  };

  const inmueblesList = properties.filter((p) => p.state !== 'baja');

  return (
    <div className="cv2-modal-backdrop cv2-scope" onClick={onClose}>
      <div className="cv2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cv2-modal-header">
          <div>
            <h2>
              <Plus size={15} style={{ marginRight: 6, color: 'var(--cv2-grey-500)' }} />
              Añadir movimiento
            </h2>
            <div className="cv2-modal-subtitle">Nueva previsión manual</div>
          </div>
          <button type="button" className="cv2-btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="cv2-modal-body">
          <div className="cv2-form-section">
            <h3>Básicos</h3>
            <div className="cv2-grid-4">
              <div className="cv2-field">
                <label>Fecha</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="cv2-field">
                <label>Tipo</label>
                <select value={type} onChange={(e) => setType(e.target.value as any)}>
                  <option value="income">Ingreso</option>
                  <option value="expense">Gasto</option>
                  <option value="financing">Financiación</option>
                </select>
              </div>
              <div className="cv2-field">
                <label>Importe</label>
                <input
                  type="text"
                  className="cv2-mono"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="cv2-field">
                <label>Cuenta</label>
                <select
                  value={accountId ?? ''}
                  onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.alias ?? a.banco?.name ?? a.bank ?? `Cuenta ${a.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="cv2-form-section">
            <h3>Descripción</h3>
            <div className="cv2-grid-2">
              <div className="cv2-field">
                <label>Concepto</label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Luz abril"
                />
              </div>
              <div className="cv2-field">
                <label>Contraparte</label>
                <input
                  type="text"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder="Ej: Iberdrola"
                />
              </div>
            </div>
          </div>

          <div className="cv2-form-section">
            <h3>Clasificación</h3>
            <div className="cv2-grid-4">
              <div className="cv2-field">
                <label>Ámbito</label>
                <select
                  value={ambito}
                  onChange={(e) => setAmbito(e.target.value as 'PERSONAL' | 'INMUEBLE')}
                >
                  <option value="PERSONAL">Personal</option>
                  <option value="INMUEBLE">Inmueble</option>
                </select>
              </div>
              <div className="cv2-field">
                <label>Inmueble</label>
                <select
                  value={inmuebleId ?? ''}
                  onChange={(e) =>
                    setInmuebleId(e.target.value ? Number(e.target.value) : undefined)
                  }
                  disabled={ambito !== 'INMUEBLE'}
                >
                  <option value="">—</option>
                  {inmueblesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.alias}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cv2-field cv2-field--col-2">
                <label>Categoría</label>
                <select
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="cv2-modal-footer">
          <div className="cv2-modal-footer-left" />
          <div className="cv2-modal-footer-right">
            <button
              type="button"
              className="cv2-btn cv2-btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="cv2-btn cv2-btn-primary"
              onClick={handleSave}
              disabled={busy}
            >
              <Plus size={14} />
              Crear previsión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMovementModal;
