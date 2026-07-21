// D-CRUD-ALTA · sub-tarea 9 · Pantalla catálogo proveedores
// Ruta · /configuracion/proveedores

import React, { useCallback, useEffect, useState } from 'react';
import { MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  proveedorService,
  type ProveedorConUso,
} from '../../../../services/proveedorService';
import type { Proveedor } from '../../../../services/db';

const ProveedoresPage: React.FC = () => {
  const [items, setItems] = useState<ProveedorConUso[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuNif, setOpenMenuNif] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProveedorConUso | null>(null);
  const [deleting, setDeleting] = useState<ProveedorConUso | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    proveedorService
      .listarConUso()
      .then(setItems)
      .catch((err) => {
        console.error('Error listando proveedores', err);
        toast.error('Error al cargar proveedores');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (openMenuNif === null) return;
    const close = (): void => setOpenMenuNif(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuNif]);

  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-inter)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
          Catálogo de proveedores
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
          NIFs detectados en facturas, declaraciones y movimientos. Editar nombre y tipos · borrar
          proveedores sin operaciones asociadas.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-gray)', fontSize: 13 }}>
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          color: 'var(--text-gray)', fontSize: 14,
          border: '1px dashed var(--hz-neutral-300)', borderRadius: 12,
        }}>
          Sin proveedores registrados. Se irán creando al importar declaraciones o procesar facturas.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--hz-neutral-300)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--atlas-v5-bg)' }}>
              <tr>
                {['NIF', 'Nombre', 'Tipos', 'Operaciones', ''].map((col) => (
                  <th key={col} style={{
                    padding: '10px 16px',
                    textAlign: col === 'Operaciones' ? 'right' : 'left',
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.03em', color: 'var(--text-gray)',
                    borderBottom: '1px solid var(--hz-neutral-300)',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const isOpen = openMenuNif === p.nif;
                const canDelete = p.operacionesAsociadas === 0;
                return (
                  <tr key={p.nif} style={{ borderBottom: '1px solid var(--hz-neutral-300)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--atlas-navy-1)' }}>{p.nif}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--atlas-navy-1)', fontWeight: 500 }}>{p.nombre || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-gray)' }}>{p.tipos.join(', ') || '—'}</td>
                    <td style={{
                      padding: '10px 16px', textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: p.operacionesAsociadas > 0 ? 'var(--atlas-navy-1)' : 'var(--text-gray)',
                      fontWeight: p.operacionesAsociadas > 0 ? 600 : 400,
                    }}>{p.operacionesAsociadas}</td>
                    <td style={{ padding: '10px 16px', position: 'relative', width: 40 }}>
                      <button
                        type="button"
                        aria-label={`Acciones proveedor ${p.nif}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuNif(isOpen ? null : p.nif);
                        }}
                        style={{
                          background: 'transparent', border: '1px solid transparent',
                          padding: '4px 6px', borderRadius: 6, cursor: 'pointer',
                          color: 'var(--text-gray)',
                        }}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {isOpen && (
                        <div role="menu" onClick={(e) => e.stopPropagation()} style={{
                          position: 'absolute', right: 8, top: 'calc(100% - 4px)',
                          zIndex: 50, background: 'var(--atlas-v5-card)',
                          border: '1px solid var(--hz-neutral-300)', borderRadius: 8,
                          boxShadow: 'var(--atlas-v5-shadow-card)',
                          minWidth: 200, padding: 4,
                        }}>
                          <button
                            type="button"
                            onClick={() => { setOpenMenuNif(null); setEditing(p); }}
                            style={menuItemStyle('var(--atlas-navy-1)')}
                          >
                            <Pencil size={14} /> Editar
                          </button>
                          <button
                            type="button"
                            disabled={!canDelete}
                            title={canDelete
                              ? 'Eliminar proveedor'
                              : `Este proveedor tiene ${p.operacionesAsociadas} operación(es) · no se puede eliminar`}
                            onClick={() => { setOpenMenuNif(null); if (canDelete) setDeleting(p); }}
                            style={{
                              ...menuItemStyle(canDelete ? 'var(--alert)' : 'var(--text-gray)'),
                              cursor: canDelete ? 'pointer' : 'not-allowed',
                              opacity: canDelete ? 1 : 0.6,
                            }}
                          >
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditarProveedorModal
          proveedor={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      {deleting && (
        <ConfirmEliminarProveedor
          proveedor={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); reload(); }}
        />
      )}
    </div>
  );
};

const menuItemStyle = (color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '8px 10px',
  background: 'transparent', border: 'none',
  borderRadius: 6, fontSize: 13,
  color, cursor: 'pointer', textAlign: 'left',
});

const EditarProveedorModal: React.FC<{
  proveedor: Proveedor;
  onClose: () => void;
  onSaved: () => void;
}> = ({ proveedor, onClose, onSaved }) => {
  const [nombre, setNombre] = useState(proveedor.nombre ?? '');
  const [tipos, setTipos] = useState((proveedor.tipos || []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const tiposArr = tipos
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await proveedorService.actualizar(proveedor.nif, {
        nombre: nombre.trim() || undefined,
        tipos: tiposArr,
      });
      toast.success('Proveedor actualizado');
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar proveedor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Editar proveedor ${proveedor.nif}`} onClose={() => !saving && onClose()}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--text-gray)' }}>
          Nombre
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-gray)' }}>
          Tipos (separados por coma)
          <input
            type="text"
            value={tipos}
            onChange={(e) => setTipos(e.target.value)}
            placeholder="suministros, mejoras"
            style={inputStyle}
          />
        </label>
      </div>
      <ModalActions>
        <button type="button" onClick={() => !saving && onClose()} disabled={saving} className="atlas-btn-secondary atlas-btn-sm">Cancelar</button>
        <button type="button" onClick={handleSave} disabled={saving} className="atlas-btn-primary atlas-btn-sm">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </ModalActions>
    </ModalShell>
  );
};

const ConfirmEliminarProveedor: React.FC<{
  proveedor: ProveedorConUso;
  onClose: () => void;
  onDeleted: () => void;
}> = ({ proveedor, onClose, onDeleted }) => {
  const [working, setWorking] = useState(false);

  const handleDelete = async (): Promise<void> => {
    setWorking(true);
    try {
      await proveedorService.eliminar(proveedor.nif);
      toast.success('Proveedor eliminado');
      onDeleted();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error(msg);
    } finally {
      setWorking(false);
    }
  };

  return (
    <ModalShell title="Eliminar proveedor" onClose={() => !working && onClose()}>
      <p style={{ fontSize: 13, color: 'var(--text-gray)' }}>
        Vas a eliminar el proveedor <strong>{proveedor.nombre || proveedor.nif}</strong> ({proveedor.nif}).
        Esta acción no se puede deshacer.
      </p>
      <ModalActions>
        <button type="button" onClick={() => !working && onClose()} disabled={working} className="atlas-btn-secondary atlas-btn-sm">Cancelar</button>
        <button type="button" onClick={handleDelete} disabled={working} className="atlas-btn-destructive atlas-btn-sm">
          {working ? 'Eliminando…' : 'Eliminar'}
        </button>
      </ModalActions>
    </ModalShell>
  );
};

const ModalShell: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => (
  <div role="dialog" aria-modal="true" style={{
    position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(4px)' }} />
    <div style={{ position: 'relative', background: 'var(--atlas-v5-card)', borderRadius: 8, boxShadow: 'var(--atlas-v5-shadow-modal)', maxWidth: 420, width: '100%' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hz-neutral-300)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 14, color: 'var(--atlas-navy-1)' }}>{title}</strong>
        <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  </div>
);

const ModalActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', marginTop: 4, padding: '6px 8px',
  border: '1px solid var(--hz-neutral-300)', borderRadius: 6, fontSize: 13,
};

export default ProveedoresPage;
