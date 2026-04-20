import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB } from '../../../../../services/db';
import type { Account, Property, TreasuryEvent } from '../../../../../services/db';
import {
  confirmTreasuryEvent,
  updateConfirmedMovement,
} from '../../../../../services/treasuryConfirmationService';
import {
  computeDocFlags,
} from '../../../../../services/documentRequirementsService';
import CategoryIcon from './CategoryIcon';
import DocSlot from './DocSlot';
import type { SingleRow } from '../hooks/useMonthConciliacion';

interface EditMovementModalProps {
  row: SingleRow;
  accounts: Account[];
  properties: Property[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  onDelete: (row: SingleRow) => void;
}

const CATEGORY_OPTIONS = [
  // Ingresos
  'Alquiler',
  // Gastos inmueble
  'Reparación inmueble', 'Mejora inmueble', 'Mobiliario inmueble',
  'Comunidad', 'Seguro', 'Suministro', 'IBI', 'Basuras', 'Tributo',
  // Financiación
  'Financiación', 'Hipoteca',
  // Personal
  'Nómina', 'Gasto personal',
  // Otros
  'Traspaso interno', 'Otros',
];

const EditMovementModal: React.FC<EditMovementModalProps> = ({
  row,
  accounts,
  properties,
  onClose,
  onChanged,
  onDelete,
}) => {
  const [date, setDate] = useState(row.date);
  const [amount, setAmount] = useState(Math.abs(row.amount).toFixed(2).replace('.', ','));
  const [accountId, setAccountId] = useState<number | undefined>(row.accountId);
  const [concept, setConcept] = useState(row.concept);
  // PR5-HOTFIX v3 · proveedor estructurado. Mantenemos `counterparty` para
  // escribir también en el campo legado (compatibilidad).
  const [providerName, setProviderName] = useState(
    row._event.providerName ?? row.counterparty ?? '',
  );
  const [providerNif, setProviderNif] = useState(row._event.providerNif ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(row._event.invoiceNumber ?? '');
  const [notes, setNotes] = useState(row._event.notes ?? '');
  const [ambito, setAmbito] = useState<'PERSONAL' | 'INMUEBLE'>(row.ambito);
  const [inmuebleId, setInmuebleId] = useState<number | undefined>(row.inmuebleId);
  const [categoryLabel, setCategoryLabel] = useState(row.categoryLabel);
  const [fractionalEnabled, setFractionalEnabled] = useState(!!row.fractional);
  const [fractionalPaid, setFractionalPaid] = useState<string>(
    row.fractional ? String(row.fractional.paid) : '',
  );

  const [busy, setBusy] = useState(false);

  // Cuando cambia la categoría y no hay doc asociado, aplica defaults *NoAplica.
  // Persistimos el cambio para que la fila y los slots reflejen el nuevo estado.
  useEffect(() => {
    if (categoryLabel === row.categoryLabel) return;
    const flags = computeDocFlags(categoryLabel);
    (async () => {
      const db = await initDB();
      const event = (await db.get('treasuryEvents', row.eventId)) as TreasuryEvent | undefined;
      if (!event) return;
      const patch: Partial<TreasuryEvent> = { categoryLabel };
      if (!event.facturaId) patch.facturaNoAplica = flags.facturaNoAplica;
      if (!event.justificanteId) patch.justificanteNoAplica = flags.justificanteNoAplica;
      await db.put('treasuryEvents', {
        ...event,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
      await onChanged();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryLabel]);

  const handleSaveOnly = async () => {
    setBusy(true);
    try {
      const parsedAmount = parseFloat(amount.replace(',', '.'));
      const finalAmount = Number.isFinite(parsedAmount) ? parsedAmount : undefined;

      const trimmedName = providerName.trim();
      const trimmedNif = providerNif.trim();
      const trimmedInvoice = invoiceNumber.trim();

      if (row.state === 'confirmed') {
        // PR5.6 + PR5-HOTFIX v3 · Una sola llamada atómica que propaga a
        // event + movement + línea. `counterparty` se rellena con el nombre
        // (o con el NIF si el usuario dejó el nombre en blanco) para que los
        // lectores legacy sigan viendo la referencia.
        const legacyCounterparty = trimmedName || trimmedNif || undefined;
        await updateConfirmedMovement(row.eventId, {
          amount: finalAmount,
          date,
          accountId,
          description: concept,
          counterparty: legacyCounterparty,
          providerName: trimmedName || undefined,
          providerNif: trimmedNif || undefined,
          invoiceNumber: trimmedInvoice || undefined,
          notes: notes || undefined,
          categoryLabel: categoryLabel || undefined,
          ambito,
          inmuebleId,
        });
        toast.success('Movimiento actualizado');
      } else {
        const db = await initDB();
        const event = (await db.get('treasuryEvents', row.eventId)) as TreasuryEvent | undefined;
        if (!event) throw new Error('Evento no encontrado');
        const updated: TreasuryEvent = {
          ...event,
          predictedDate: date,
          amount: finalAmount != null ? Math.abs(finalAmount) : event.amount,
          accountId,
          description: concept,
          counterparty: trimmedName || trimmedNif || undefined,
          providerName: trimmedName || undefined,
          providerNif: trimmedNif || undefined,
          invoiceNumber: trimmedInvoice || undefined,
          notes: notes || undefined,
          ambito,
          inmuebleId,
          categoryLabel: categoryLabel || undefined,
          updatedAt: new Date().toISOString(),
        };
        await db.put('treasuryEvents', updated);
        toast.success('Previsión actualizada');
      }
      await onChanged();
      onClose();
    } catch (err) {
      console.error('[EditMovementModal] save failed', err);
      const msg = err instanceof Error ? err.message : 'No se pudo guardar';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const parsedAmount = parseFloat(amount.replace(',', '.'));
      const trimmedName = providerName.trim();
      const trimmedNif = providerNif.trim();
      const trimmedInvoice = invoiceNumber.trim();
      // Guardar cambios en el event y después puntear.
      const db = await initDB();
      const event = (await db.get('treasuryEvents', row.eventId)) as TreasuryEvent | undefined;
      if (!event) throw new Error('Evento no encontrado');
      // PR5-HOTFIX v3 · si el usuario deja el nombre vacío pero aporta NIF,
      // usamos el NIF como counterparty legacy para que lectores antiguos
      // sigan mostrando algo en vez de '—'.
      const legacyCounterparty = trimmedName || trimmedNif || undefined;
      await db.put('treasuryEvents', {
        ...event,
        description: concept,
        counterparty: legacyCounterparty,
        providerName: trimmedName || undefined,
        providerNif: trimmedNif || undefined,
        invoiceNumber: trimmedInvoice || undefined,
        notes: notes || undefined,
        ambito,
        inmuebleId,
        categoryLabel: categoryLabel || undefined,
        updatedAt: new Date().toISOString(),
      });

      if (fractionalEnabled) {
        const paid = parseFloat(fractionalPaid.replace(',', '.'));
        const total = Number.isFinite(parsedAmount) ? parsedAmount : event.amount;
        if (Number.isFinite(paid) && paid > 0 && paid < total) {
          await confirmTreasuryEvent(row.eventId, {
            amount: paid,
            date,
            accountId,
            description: concept,
            counterparty: legacyCounterparty,
            providerName: trimmedName || undefined,
            providerNif: trimmedNif || undefined,
            invoiceNumber: trimmedInvoice || undefined,
            notes: notes || undefined,
          });
          // Crea una nueva previsión con el remanente pendiente.
          const rem = Math.max(0, total - paid);
          if (rem > 0.005) {
            const nowIso = new Date().toISOString();
            const newEvent: Omit<TreasuryEvent, 'id'> = {
              ...event,
              amount: rem,
              status: 'predicted',
              executedMovementId: undefined,
              executedAt: undefined,
              movementId: undefined,
              actualAmount: undefined,
              actualDate: undefined,
              description: `${concept} (pendiente)`,
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            await (db as any).add('treasuryEvents', newEvent);
          }
          toast.success('Pago parcial confirmado');
        } else {
          toast.error('Importe parcial no válido');
          return;
        }
      } else {
        await confirmTreasuryEvent(row.eventId, {
          amount: Number.isFinite(parsedAmount) ? parsedAmount : undefined,
          date,
          accountId,
          description: concept,
          counterparty: legacyCounterparty,
          providerName: trimmedName || undefined,
          providerNif: trimmedNif || undefined,
          invoiceNumber: trimmedInvoice || undefined,
          notes: notes || undefined,
        });
        toast.success('Movimiento confirmado');
      }

      await onChanged();
      onClose();
    } catch (err) {
      console.error('[EditMovementModal] confirm failed', err);
      const msg = err instanceof Error ? err.message : 'No se pudo confirmar';
      toast.error(msg);
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
              <CategoryIcon category={categoryLabel} size={15} />
              {concept || 'Movimiento'}
            </h2>
            <div className="cv2-modal-subtitle">
              {row.state === 'confirmed' ? 'Confirmado' : 'Previsión'}
              {' · '}
              {date}
              {' · '}
              {Math.abs(row.amount).toFixed(2).replace('.', ',')} €
            </div>
          </div>
          <button type="button" className="cv2-btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="cv2-modal-body">
          {/* Básicos */}
          <div className="cv2-form-section">
            <h3>Básicos</h3>
            <div className="cv2-grid-4">
              <div className="cv2-field">
                <label>Fecha</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="cv2-field">
                <label>Importe</label>
                <input
                  type="text"
                  className="cv2-mono"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="cv2-field cv2-field--col-2">
                <label>Cuenta</label>
                <select
                  value={accountId ?? ''}
                  onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.alias ?? a.banco?.name ?? a.bank ?? `Cuenta ${a.id}`}
                      {a.iban ? ` ·${a.iban.slice(-4)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="cv2-form-section">
            <h3>Descripción</h3>
            <div className="cv2-grid-2">
              <div className="cv2-field">
                <label>Concepto</label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                />
              </div>
              <div className="cv2-field">
                <label>Nº factura <span className="cv2-optional-mark">(opcional)</span></label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ej: 2026-0412"
                />
              </div>
            </div>
          </div>

          {/* PR5-HOTFIX v3 · Proveedor estructurado en 2 campos (Nombre + NIF). */}
          <div className="cv2-form-section">
            <h3>Proveedor</h3>
            <div className="cv2-grid-2">
              <div className="cv2-field">
                <label>Nombre</label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="Ej: Iberdrola"
                />
              </div>
              <div className="cv2-field">
                <label>NIF <span className="cv2-optional-mark">(opcional)</span></label>
                <input
                  type="text"
                  value={providerNif}
                  onChange={(e) => setProviderNif(e.target.value)}
                  placeholder="Ej: B83275893"
                />
              </div>
            </div>
            <div className="cv2-field" style={{ marginTop: 10 }}>
              <label>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Clasificación */}
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
                  <option value="">—</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Fraccionamiento */}
          <div className="cv2-form-section">
            <h3>Fraccionamiento</h3>
            <label className="cv2-na-check">
              <input
                type="checkbox"
                checked={fractionalEnabled}
                onChange={(e) => setFractionalEnabled(e.target.checked)}
                disabled={row.state === 'confirmed'}
              />
              Confirmar como pago parcial
            </label>
            {fractionalEnabled && (
              <div className="cv2-grid-2" style={{ marginTop: 10 }}>
                <div className="cv2-field">
                  <label>Importe pagado ahora</label>
                  <input
                    type="text"
                    className="cv2-mono"
                    value={fractionalPaid}
                    onChange={(e) => setFractionalPaid(e.target.value)}
                  />
                </div>
                <div className="cv2-field">
                  <label>Se creará previsión por el resto</label>
                  <input
                    type="text"
                    readOnly
                    value={(() => {
                      const total = parseFloat(amount.replace(',', '.'));
                      const paid = parseFloat(fractionalPaid.replace(',', '.'));
                      if (!Number.isFinite(total) || !Number.isFinite(paid)) return '—';
                      const rem = Math.max(0, total - paid);
                      return rem.toFixed(2).replace('.', ',') + ' €';
                    })()}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Documentación */}
          <div className="cv2-form-section">
            <h3>Documentación</h3>
            <DocSlot
              slot="factura"
              eventId={row.eventId}
              state={row.factura}
              onChanged={onChanged}
            />
            <DocSlot
              slot="justificante"
              eventId={row.eventId}
              state={row.justificante}
              facturaDocumentId={row.factura.documentId}
              onChanged={onChanged}
            />
          </div>
        </div>

        <div className="cv2-modal-footer">
          <div className="cv2-modal-footer-left">
            <button
              type="button"
              className="cv2-btn cv2-btn-danger"
              onClick={() => onDelete(row)}
              disabled={busy}
            >
              Eliminar
            </button>
          </div>
          <div className="cv2-modal-footer-right">
            <button
              type="button"
              className="cv2-btn cv2-btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            {row.state === 'confirmed' ? (
              <button
                type="button"
                className="cv2-btn cv2-btn-primary"
                onClick={handleSaveOnly}
                disabled={busy}
              >
                Guardar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="cv2-btn cv2-btn-secondary"
                  onClick={handleSaveOnly}
                  disabled={busy}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="cv2-btn cv2-btn-primary"
                  onClick={handleConfirm}
                  disabled={busy}
                >
                  <Check size={14} />
                  Guardar y confirmar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMovementModal;
