import React from 'react';

interface DeleteConfirmDialogProps {
  title?: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  title = 'Eliminar movimiento',
  body,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  busy,
}) => (
  <div className="cv2-modal-backdrop cv2-scope" onClick={onCancel}>
    <div className="cv2-confirm-dialog" onClick={(e) => e.stopPropagation()}>
      <div className="cv2-confirm-title">{title}</div>
      <div className="cv2-confirm-body">{body}</div>
      <div className="cv2-confirm-footer">
        <button
          type="button"
          className="cv2-btn cv2-btn-secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="cv2-btn cv2-btn-primary"
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default DeleteConfirmDialog;
