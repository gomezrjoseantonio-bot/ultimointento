// EditarPosicionModal · edición administrativa · PR 4 T-INVERSIONES-V5
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §L (modal-editar).
// Sin preview · zona peligrosa al pie con acción de eliminar (soft delete).
//
// Edita SOLO campos administrativos:
//   - Nombre y entidad (común a planes e inversiones)
//   - Notas (solo inversiones · planes no tienen campo notas global)
//   - Política de inversión (solo planes)
//
// NO toca valoración (ese flujo es ActualizarValoracionModal) ni
// aportaciones (ese flujo es AportarModal). NO permite cambiar tipo.

import React, { useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { PosicionInversion } from '../../../../types/inversiones';
import type { PlanPensiones, PoliticaInversion } from '../../../../types/planesPensiones';
import type { CartaItem } from '../../types/cartaItem';
import ModalAtlas, { ModalAtlasBody, ModalAtlasForm } from './ModalAtlas';
import ModalAtlasHeader from './ModalAtlasHeader';
import ModalAtlasFooter, {
  ModalAtlasButtonGhost,
  ModalAtlasButtonGold,
} from './ModalAtlasFooter';
import styles from '../../styles/atlas-inversiones.module.css';

const POLITICAS: { value: PoliticaInversion; label: string }[] = [
  { value: 'desconocido', label: 'No especificada' },
  { value: 'renta_fija_corto', label: 'Renta fija · corto plazo' },
  { value: 'renta_fija_largo', label: 'Renta fija · largo plazo' },
  { value: 'renta_variable', label: 'Renta variable' },
  { value: 'renta_mixta', label: 'Mixta' },
  { value: 'garantizado', label: 'Garantizado' },
  { value: 'ciclo_vida', label: 'Ciclo de vida' },
];

export interface EditarPosicionInput {
  nombre: string;
  entidad: string;
  notas?: string;
  politicaInversion?: PoliticaInversion;
}

export interface EditarPosicionModalProps {
  posicion: CartaItem;
  onSave: (input: EditarPosicionInput) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onClose: () => void;
}

const EditarPosicionModal: React.FC<EditarPosicionModalProps> = ({
  posicion,
  onSave,
  onDelete,
  onClose,
}) => {
  const esPlan = posicion._origen === 'planesPensiones';
  const planOrig = esPlan ? (posicion._original as PlanPensiones) : null;
  const invOrig = !esPlan ? (posicion._original as PosicionInversion) : null;

  const [nombre, setNombre] = useState(posicion.nombre);
  const [entidad, setEntidad] = useState(posicion.entidad);
  const [notas, setNotas] = useState(invOrig?.notas ?? '');
  const [politica, setPolitica] = useState<PoliticaInversion>(
    planOrig?.politicaInversion ?? 'desconocido',
  );
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      showToastV5('El nombre no puede estar vacío');
      return;
    }
    if (!entidad.trim()) {
      showToastV5(esPlan ? 'La gestora no puede estar vacía' : 'La entidad no puede estar vacía');
      return;
    }
    setLoading(true);
    try {
      await onSave({
        nombre: nombre.trim(),
        entidad: entidad.trim(),
        notas: !esPlan ? notas.trim() || undefined : undefined,
        politicaInversion: esPlan ? politica : undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} size="noPreview" ariaLabel="Editar posición">
      <ModalAtlasHeader
        icon={<Icons.Edit size={18} strokeWidth={1.7} />}
        title="Editar posición"
        subtitle={`${posicion.nombre} · ${posicion.entidad}`}
        onClose={onClose}
      />
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <ModalAtlasBody>
          <ModalAtlasForm>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Datos administrativos</div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Nombre<span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    {esPlan ? 'Gestora' : 'Entidad'}
                    <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    required
                  />
                </div>
              </div>
              {esPlan && (
                <div className={`${styles.row} ${styles.cols1}`}>
                  <div className={styles.field}>
                    <label className={styles.label}>Política de inversión</label>
                    <select
                      className={styles.select}
                      value={politica}
                      onChange={(e) => setPolitica(e.target.value as PoliticaInversion)}
                    >
                      {POLITICAS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {!esPlan && (
                <div className={`${styles.row} ${styles.cols1}`}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Notas<span className={styles.opt}>opcional</span>
                    </label>
                    <textarea
                      className={styles.textarea}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Zona peligrosa · soft delete */}
            {onDelete && (
              <div className={styles.section}>
                <div className={styles.sectionTitle} style={{ color: 'var(--atlas-v5-neg)' }}>
                  Zona peligrosa
                </div>
                {!confirmDelete ? (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={() => setConfirmDelete(true)}
                    style={{ borderColor: 'var(--atlas-v5-neg)', color: 'var(--atlas-v5-neg)' }}
                  >
                    <Icons.Delete size={13} strokeWidth={2} /> Eliminar posición
                  </button>
                ) : (
                  <div
                    style={{
                      padding: '12px 14px',
                      background: 'var(--atlas-v5-neg-wash)',
                      borderRadius: 8,
                      borderLeft: '3px solid var(--atlas-v5-neg)',
                    }}
                  >
                    <div style={{ fontSize: 12, marginBottom: 10, color: 'var(--atlas-v5-ink-2)' }}>
                      Marca la posición como inactiva. No se borra · podrás
                      recuperarla desde "Posiciones cerradas".
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <ModalAtlasButtonGhost
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        disabled={loading}
                      >
                        Cancelar
                      </ModalAtlasButtonGhost>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGold}`}
                        onClick={handleDelete}
                        disabled={loading}
                        style={{
                          background: 'var(--atlas-v5-neg)',
                          borderColor: 'var(--atlas-v5-neg)',
                        }}
                      >
                        Confirmar eliminación
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalAtlasForm>
        </ModalAtlasBody>

        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              Cambios administrativos · NO afectan valoración ni aportaciones.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Guardar cambios'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default EditarPosicionModal;
