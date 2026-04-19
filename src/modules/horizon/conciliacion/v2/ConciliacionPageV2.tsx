import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { initDB } from '../../../../services/db';
import {
  confirmTreasuryEvent,
  revertTreasuryConfirmation,
} from '../../../../services/treasuryConfirmationService';
import { regenerateMonthForecast } from '../../../../services/treasuryForecastService';

import ConciliacionHeader from './components/ConciliacionHeader';
import KpiRow from './components/KpiRow';
import FiltersBar from './components/FiltersBar';
import DayGroup from './components/DayGroup';
import DocumentPickerPopover from './components/DocumentPickerPopover';
import EditMovementModal from './components/EditMovementModal';
import DeleteConfirmDialog from './components/DeleteConfirmDialog';
import AddMovementModal from './components/AddMovementModal';
import type { DocIconType } from './components/DocIcon';
import {
  useMonthConciliacion,
  type Filters,
  type SingleRow,
} from './hooks/useMonthConciliacion';

import './conciliacion-v2.css';

interface PopoverState {
  row: SingleRow;
  slot: DocIconType;
  anchor: HTMLElement;
}

const ConciliacionPageV2: React.FC = () => {
  const now = useMemo(() => new Date(), []);
  const [filters, setFilters] = useState<Filters>({
    year: now.getFullYear(),
    month0: now.getMonth(),
    accountId: 'all',
    ambito: 'all',
    stateFilter: 'all',
    search: '',
  });

  const { loading, days, kpis, accounts, properties, reload } = useMonthConciliacion(filters);

  const [editingRow, setEditingRow] = useState<SingleRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<SingleRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = useCallback(async () => {
    try {
      setRegenerating(true);
      const result = await regenerateMonthForecast({
        year: filters.year,
        month: filters.month0,
      });
      const total = result.rentalsCreated + result.opexCreated + result.loansCreated;
      if (total === 0) {
        toast('Sin cambios — las previsiones ya estaban al día', { icon: 'ℹ️' });
      } else {
        toast.success(`${total} previsiones generadas`);
      }
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron regenerar las previsiones';
      console.error('[ConciliacionPageV2] regenerate failed', err);
      toast.error(msg);
    } finally {
      setRegenerating(false);
    }
  }, [filters.year, filters.month0, reload]);

  // Re-sync editingRow/popover.row con datos frescos tras cada reload (así el
  // modal o popover refleja cambios aplicados sin cerrarse).
  useEffect(() => {
    const flat = days
      .flatMap((d) => d.items)
      .flatMap((item) => (item.type === 'rent_group' ? item.children : [item]));

    if (editingRow) {
      const fresh = flat.find((r) => r.eventId === editingRow.eventId);
      if (fresh && fresh !== editingRow) setEditingRow(fresh);
    }
    if (popover) {
      const fresh = flat.find((r) => r.eventId === popover.row.eventId);
      if (fresh && fresh !== popover.row) {
        setPopover({ ...popover, row: fresh });
      }
    }
  }, [days, editingRow, popover]);

  const handleFilterChange = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleQuickConfirm = useCallback(
    async (row: SingleRow) => {
      if (row.state === 'confirmed') return;
      if (row.accountId == null) {
        // Abrir modal para que el usuario asigne cuenta antes de confirmar.
        toast('Asigna una cuenta antes de puntear', { icon: 'ℹ️' });
        setEditingRow(row);
        return;
      }
      try {
        await confirmTreasuryEvent(row.eventId);
        toast.success('Movimiento confirmado');
        await reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo confirmar';
        toast.error(msg);
      }
    },
    [reload],
  );

  const handleQuickRevert = useCallback(
    async (row: SingleRow) => {
      if (!row.movementId) return;
      try {
        await revertTreasuryConfirmation(row.movementId);
        toast.success('Movimiento desconciliado');
        await reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo desconciliar';
        toast.error(msg);
      }
    },
    [reload],
  );

  const handleBulkConfirm = useCallback(
    async (children: SingleRow[]) => {
      let ok = 0;
      let fail = 0;
      for (const child of children) {
        try {
          if (child.accountId == null) {
            fail++;
            continue;
          }
          await confirmTreasuryEvent(child.eventId);
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) toast.success(`${ok} rentas confirmadas`);
      if (fail > 0) toast.error(`${fail} rentas necesitan cuenta`);
      await reload();
    },
    [reload],
  );

  const handleDelete = useCallback(
    async (row: SingleRow) => {
      try {
        const db = await initDB();
        // Si está punteada, primero desconciliar (borra movement + líneas)
        if (row.movementId) {
          await revertTreasuryConfirmation(row.movementId);
        }
        // Borra la previsión
        await db.delete('treasuryEvents', row.eventId);
        toast.success('Movimiento eliminado');
        setDeletingRow(null);
        await reload();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo eliminar';
        toast.error(msg);
      }
    },
    [reload],
  );

  const handleOpenDocPopover = useCallback(
    (row: SingleRow, slot: DocIconType, anchor: HTMLElement) => {
      setPopover({ row, slot, anchor });
    },
    [],
  );

  const currentPopoverSlotState = popover
    ? popover.slot === 'factura'
      ? popover.row.factura
      : popover.row.justificante
    : null;

  return (
    <div className="cv2-scope">
      <div className="cv2-container">
        <ConciliacionHeader
          onAddMovement={() => setShowAddModal(true)}
          onRegeneratePredictions={handleRegenerate}
          regenerating={regenerating}
        />

        <KpiRow kpis={kpis} year={filters.year} month0={filters.month0} />

        <FiltersBar filters={filters} accounts={accounts} onChange={handleFilterChange} />

        {loading ? (
          <div className="cv2-empty">Cargando…</div>
        ) : days.length === 0 ? (
          <div className="cv2-empty">
            No hay movimientos previstos ni confirmados en este mes.
          </div>
        ) : (
          days.map((bucket) => (
            <DayGroup
              key={bucket.date}
              bucket={bucket}
              onQuickConfirm={handleQuickConfirm}
              onQuickRevert={handleQuickRevert}
              onOpenModal={(row) => setEditingRow(row)}
              onDelete={(row) => setDeletingRow(row)}
              onOpenDocPopover={handleOpenDocPopover}
              onBulkConfirm={handleBulkConfirm}
            />
          ))
        )}
      </div>

      {popover && currentPopoverSlotState && (
        <DocumentPickerPopover
          slot={popover.slot}
          eventId={popover.row.eventId}
          anchorElement={popover.anchor}
          currentDocumentId={currentPopoverSlotState.documentId}
          currentDocName={currentPopoverSlotState.docName}
          currentDocSize={currentPopoverSlotState.docSize}
          currentDocUploadedAt={currentPopoverSlotState.docUploadedAt}
          currentNoAplica={currentPopoverSlotState.noAplica}
          facturaDocumentId={popover.slot === 'justificante' ? popover.row.factura.documentId : undefined}
          onClose={() => setPopover(null)}
          onChanged={reload}
        />
      )}

      {editingRow && (
        <EditMovementModal
          row={editingRow}
          accounts={accounts}
          properties={properties}
          onClose={() => setEditingRow(null)}
          onChanged={reload}
          onDelete={(row) => {
            setEditingRow(null);
            setDeletingRow(row);
          }}
        />
      )}

      {deletingRow && (
        <DeleteConfirmDialog
          title="Eliminar movimiento"
          body={`Se eliminará "${deletingRow.concept}" y, si estaba confirmado, también su movimiento bancario y la línea de inmueble asociada.`}
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(deletingRow)}
          onCancel={() => setDeletingRow(null)}
        />
      )}

      {showAddModal && (
        <AddMovementModal
          accounts={accounts}
          properties={properties}
          defaultYear={filters.year}
          defaultMonth0={filters.month0}
          onClose={() => setShowAddModal(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
};

export default ConciliacionPageV2;
