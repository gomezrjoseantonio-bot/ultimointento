import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, Icons, showToastV5 } from '../../../design-system/v5';
import type { FiscalOutletContext } from '../FiscalContext';
import { perdidasPatrimonialesService } from '../../../services/perdidasPatrimonialesService';
import { vinculosAccesorioService } from '../../../services/vinculosAccesorioService';
import type { PerdidaPatrimonialAhorro, VinculoAccesorio } from '../../../services/db';
import ConfirmationModal from '../../../components/common/ConfirmationModal';

const ConfiguracionPage: React.FC = () => {
  const navigate = useNavigate();
  const { ejercicios } = useOutletContext<FiscalOutletContext>();

  // Ejercicio por defecto · el más reciente que NO esté prescrito.
  const ejerciciosOrdenados = useMemo(
    () =>
      [...ejercicios]
        .filter((e) => e.estado !== 'prescrito')
        .sort((a, b) => b.ejercicio - a.ejercicio),
    [ejercicios],
  );
  const [anio, setAnio] = useState<number | ''>(
    ejerciciosOrdenados[0]?.ejercicio ?? new Date().getFullYear(),
  );

  const goImportar = () => {
    if (!anio) {
      showToastV5('Selecciona un ejercicio antes de importar.');
      return;
    }
    navigate(`/fiscal/importar/${anio}`);
  };

  const goCorreccion = () => {
    if (!anio) {
      showToastV5('Selecciona un ejercicio antes de aplicar la paralela.');
      return;
    }
    navigate(`/fiscal/correccion/${anio}`);
  };

  const yearSelector = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        background: 'var(--atlas-v5-card-alt)',
        borderRadius: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
      }}
    >
      <label
        htmlFor="anioSel"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--atlas-v5-ink-3)',
        }}
      >
        Ejercicio fiscal
      </label>
      <select
        id="anioSel"
        value={String(anio)}
        onChange={(e) => setAnio(parseInt(e.target.value, 10))}
        style={{
          padding: '6px 10px',
          border: '1px solid var(--atlas-v5-line)',
          borderRadius: 6,
          fontFamily: 'var(--atlas-v5-font-mono-num)',
          fontSize: 13,
          background: 'var(--atlas-v5-card)',
          color: 'var(--atlas-v5-ink)',
        }}
      >
        {ejerciciosOrdenados.map((e) => (
          <option key={e.ejercicio} value={e.ejercicio}>
            {e.ejercicio} · {e.estado}
          </option>
        ))}
        {ejerciciosOrdenados.length === 0 && (
          <option value={new Date().getFullYear()}>{new Date().getFullYear()} · nuevo</option>
        )}
      </select>
      <span style={{ fontSize: 11.5, color: 'var(--atlas-v5-ink-4)' }}>
        las acciones se aplican al ejercicio seleccionado
      </span>
    </div>
  );

  return (
    <>
      <CardV5 style={{ marginBottom: 14 }}>
        <CardV5.Title>Perfil fiscal</CardV5.Title>
        <CardV5.Subtitle>
          situación familiar · CCAA · obligaciones · arrastres
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '20px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-3)',
              lineHeight: 1.55,
            }}
          >
            La configuración de tu perfil fiscal vive en{' '}
            <strong>Ajustes &gt; Perfil fiscal</strong>. Allí defines situación
            familiar, CCAA de tributación, fuentes de renta y arrastres recibidos
            de ejercicios anteriores.
          </div>
          <button
            type="button"
            onClick={() => navigate('/ajustes/fiscal')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              border: 'none',
              background: 'var(--atlas-v5-ink)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icons.Ajustes size={14} strokeWidth={1.8} />
            Abrir ajustes fiscales
          </button>
        </CardV5.Body>
      </CardV5>

      <CardV5 style={{ marginBottom: 14 }}>
        <CardV5.Title>Importar declaración del Modelo 100</CardV5.Title>
        <CardV5.Subtitle>
          XML de DeclaVisor (Renta Web) · PDF · TXT · extracción automática
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '14px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-3)',
              lineHeight: 1.55,
            }}
          >
            Sube el documento oficial de la declaración (XML DeclaVisor · PDF
            del Modelo 100 · TXT exportado desde Renta Web). Atlas extrae las
            casillas automáticamente · marca el ejercicio como{' '}
            <strong>declarado</strong> y archiva el documento para
            trazabilidad.
          </div>

          {yearSelector}

          <button
            type="button"
            onClick={goImportar}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              border: 'none',
              background: 'var(--atlas-v5-gold)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icons.Upload size={14} strokeWidth={1.8} />
            Importar XML · PDF · TXT del Modelo 100
          </button>
        </CardV5.Body>
      </CardV5>

      <CardV5 style={{ marginBottom: 14 }}>
        <CardV5.Title>Aplicar paralela AEAT</CardV5.Title>
        <CardV5.Subtitle>
          liquidación firmada por Hacienda · cascada años posteriores
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '14px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-3)',
              lineHeight: 1.55,
            }}
          >
            Si Hacienda te ha enviado una propuesta de liquidación · acta · o
            liquidación y la has firmado en conformidad, aplícala en el wizard
            de 5 pasos para que Atlas registre la paralela y deje constancia
            del desfase en años posteriores.{' '}
            <strong>No apliques paralelas que estén en recurso.</strong>
          </div>

          {yearSelector}

          <button
            type="button"
            onClick={goCorreccion}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              border: '1px solid var(--atlas-v5-line)',
              background: 'var(--atlas-v5-card)',
              color: 'var(--atlas-v5-ink)',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Icons.Refresh size={14} strokeWidth={1.8} />
            Iniciar wizard de corrección · 5 pasos
          </button>
        </CardV5.Body>
      </CardV5>

      <CardV5>
        <CardV5.Title>Modelos y obligaciones</CardV5.Title>
        <CardV5.Subtitle>
          alta y baja de modelos · IVA · IRPF · informativos
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              padding: '16px 8px',
              fontSize: 13,
              color: 'var(--atlas-v5-ink-4)',
            }}
          >
            Atlas detecta automáticamente las obligaciones según tus ingresos y
            actividades. Los modelos manuales se gestionan desde el Detalle del
            ejercicio.
          </div>
        </CardV5.Body>
      </CardV5>

      <PerdidasPatrimonialesPanel />

      <VinculosAccesorioPanel />
    </>
  );
};

const VinculosAccesorioPanel: React.FC = () => {
  const [items, setItems] = useState<VinculoAccesorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VinculoAccesorio | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VinculoAccesorio | null>(null);
  const [working, setWorking] = useState(false);
  const [editForm, setEditForm] = useState<{ fechaInicio: string; fechaFin: string; estado: 'activo' | 'inactivo'; ejercicio: number }>({
    fechaInicio: '', fechaFin: '', estado: 'activo', ejercicio: new Date().getFullYear(),
  });

  const reload = useCallback(() => {
    setLoading(true);
    vinculosAccesorioService
      .listar()
      .then(setItems)
      .catch((err) => {
        console.error('Error listando vínculos accesorio', err);
        showToastV5('Error al cargar los vínculos accesorio');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const startEdit = (v: VinculoAccesorio): void => {
    setEditing(v);
    setEditForm({
      fechaInicio: v.fechaInicio,
      fechaFin: v.fechaFin ?? '',
      estado: v.estado,
      ejercicio: v.ejercicio,
    });
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (!editing?.id) return;
    setWorking(true);
    try {
      await vinculosAccesorioService.actualizar(editing.id, {
        fechaInicio: editForm.fechaInicio,
        fechaFin: editForm.fechaFin || undefined,
        estado: editForm.estado,
        ejercicio: editForm.ejercicio,
      });
      showToastV5('Vínculo actualizado');
      setEditing(null);
      reload();
    } catch (err) {
      console.error('Error actualizando vínculo', err);
      showToastV5('Error al actualizar el vínculo');
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!pendingDelete?.id) return;
    setWorking(true);
    try {
      await vinculosAccesorioService.eliminar(pendingDelete.id);
      showToastV5('Vínculo eliminado');
      setPendingDelete(null);
      reload();
    } catch (err) {
      console.error('Error eliminando vínculo', err);
      showToastV5('Error al eliminar el vínculo');
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <CardV5>
        <CardV5.Title>Vínculos accesorio (parking · trastero)</CardV5.Title>
        <CardV5.Subtitle>
          relaciones entre inmueble principal y accesorio por ejercicio · editar o borrar si la importación generó vínculos erróneos
        </CardV5.Subtitle>
        <CardV5.Body>
          {loading ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--atlas-v5-ink-4)' }}>Cargando…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--atlas-v5-ink-4)' }}>
              Sin vínculos accesorio registrados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--atlas-v5-line)', color: 'var(--atlas-v5-ink-4)' }}>
                    {['Ejercicio', 'Principal #', 'Accesorio #', 'Inicio', 'Fin', 'Estado', 'Origen', ''].map((c, i) => (
                      <th key={`${c}-${i}`} style={{
                        padding: '8px 10px', textAlign: 'left',
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--atlas-v5-line-2)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.ejercicio}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace' }}>{v.inmueblePrincipalId}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace' }}>{v.inmuebleAccesorioId}</td>
                      <td style={{ padding: '8px 10px' }}>{v.fechaInicio}</td>
                      <td style={{ padding: '8px 10px' }}>{v.fechaFin || '—'}</td>
                      <td style={{ padding: '8px 10px', color: v.estado === 'activo' ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-ink-4)' }}>{v.estado}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--atlas-v5-ink-4)' }}>{v.origenCreacion}</td>
                      <td style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          aria-label="Editar vínculo"
                          style={{
                            background: 'transparent', border: '1px solid var(--atlas-v5-line)',
                            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                            color: 'var(--atlas-v5-ink-2)', fontSize: 12, fontFamily: 'inherit',
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(v)}
                          aria-label="Eliminar vínculo"
                          style={{
                            background: 'transparent', border: '1px solid var(--atlas-v5-line)',
                            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                            color: 'var(--atlas-v5-neg)', fontSize: 12, fontFamily: 'inherit',
                          }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardV5.Body>
      </CardV5>

      {editing && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={() => !working && setEditing(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 8, boxShadow: '0 12px 36px rgba(15,23,42,.18)', maxWidth: 420, width: '100%' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--atlas-v5-line)' }}>
              <strong style={{ fontSize: 14, color: 'var(--atlas-v5-ink)' }}>
                Editar vínculo · principal #{editing.inmueblePrincipalId} ← accesorio #{editing.inmuebleAccesorioId}
              </strong>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--atlas-v5-ink-3)' }}>
                Ejercicio
                <input
                  type="number"
                  value={editForm.ejercicio}
                  onChange={(e) => setEditForm({ ...editForm, ejercicio: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--atlas-v5-line)', borderRadius: 6, fontSize: 13 }}
                />
              </label>
              <label style={{ fontSize: 12, color: 'var(--atlas-v5-ink-3)' }}>
                Fecha inicio (ISO)
                <input
                  type="date"
                  value={editForm.fechaInicio}
                  onChange={(e) => setEditForm({ ...editForm, fechaInicio: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--atlas-v5-line)', borderRadius: 6, fontSize: 13 }}
                />
              </label>
              <label style={{ fontSize: 12, color: 'var(--atlas-v5-ink-3)' }}>
                Fecha fin (ISO, opcional)
                <input
                  type="date"
                  value={editForm.fechaFin}
                  onChange={(e) => setEditForm({ ...editForm, fechaFin: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--atlas-v5-line)', borderRadius: 6, fontSize: 13 }}
                />
              </label>
              <label style={{ fontSize: 12, color: 'var(--atlas-v5-ink-3)' }}>
                Estado
                <select
                  value={editForm.estado}
                  onChange={(e) => setEditForm({ ...editForm, estado: e.target.value as 'activo' | 'inactivo' })}
                  style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--atlas-v5-line)', borderRadius: 6, fontSize: 13 }}
                >
                  <option value="activo">activo</option>
                  <option value="inactivo">inactivo</option>
                </select>
              </label>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--atlas-v5-line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => !working && setEditing(null)} disabled={working} className="atlas-btn-secondary atlas-btn-sm">Cancelar</button>
              <button type="button" onClick={handleSaveEdit} disabled={working} className="atlas-btn-primary atlas-btn-sm">
                {working ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => { if (!working) setPendingDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar vínculo accesorio"
        message={
          pendingDelete
            ? `Vas a eliminar el vínculo del ejercicio ${pendingDelete.ejercicio}: principal #${pendingDelete.inmueblePrincipalId} ← accesorio #${pendingDelete.inmuebleAccesorioId}. Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={working}
      />
    </>
  );
};

const PerdidasPatrimonialesPanel: React.FC = () => {
  const [items, setItems] = useState<PerdidaPatrimonialAhorro[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<PerdidaPatrimonialAhorro | null>(null);
  const [working, setWorking] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    perdidasPatrimonialesService
      .listar()
      .then(setItems)
      .catch((err) => {
        console.error('Error listando pérdidas patrimoniales', err);
        showToastV5('Error al cargar las pérdidas patrimoniales');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (): Promise<void> => {
    if (!pendingDelete?.id) return;
    setWorking(true);
    try {
      await perdidasPatrimonialesService.eliminar(pendingDelete.id);
      showToastV5('Pérdida patrimonial eliminada');
      setPendingDelete(null);
      reload();
    } catch (err) {
      console.error('Error eliminando pérdida', err);
      showToastV5('Error al eliminar la pérdida');
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <CardV5>
        <CardV5.Title>Pérdidas patrimoniales del ahorro</CardV5.Title>
        <CardV5.Subtitle>
          atrasos compensables · 4 ejercicios · gestiona pérdidas importadas con error
        </CardV5.Subtitle>
        <CardV5.Body>
          {loading ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--atlas-v5-ink-4)' }}>Cargando…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--atlas-v5-ink-4)' }}>
              Sin pérdidas patrimoniales registradas.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--atlas-v5-line)', color: 'var(--atlas-v5-ink-4)' }}>
                    {['Ejercicio', 'Origen', 'Estado', 'Original', 'Aplicado', 'Pendiente', 'Caduca', ''].map((c, i) => (
                      <th key={`${c}-${i}`} style={{
                        padding: '8px 10px',
                        textAlign: c === 'Original' || c === 'Aplicado' || c === 'Pendiente' ? 'right' : 'left',
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--atlas-v5-line-2)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.ejercicioOrigen}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--atlas-v5-ink-3)' }}>{p.tipoOrigen}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--atlas-v5-ink-3)' }}>{p.estado.replace('_', ' ')}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)' }}>
                        {p.importeOriginal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)' }}>
                        {p.importeAplicado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: 600 }}>
                        {p.importePendiente.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--atlas-v5-ink-4)' }}>{p.ejercicioCaducidad}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(p)}
                          aria-label={`Eliminar pérdida ${p.ejercicioOrigen}`}
                          title="Eliminar pérdida"
                          style={{
                            background: 'transparent', border: '1px solid var(--atlas-v5-line)',
                            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                            color: 'var(--atlas-v5-neg)', fontSize: 12, fontFamily: 'inherit',
                          }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardV5.Body>
      </CardV5>

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => { if (!working) setPendingDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar pérdida patrimonial"
        message={
          pendingDelete
            ? `Vas a eliminar la pérdida del ejercicio ${pendingDelete.ejercicioOrigen} (${pendingDelete.tipoOrigen}, importe original ${pendingDelete.importeOriginal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}). ${
                pendingDelete.importeAplicado > 0
                  ? 'ATENCIÓN: tiene importes ya aplicados en ejercicios posteriores · esos cálculos pueden quedar inconsistentes hasta recalcularlos. '
                  : ''
              }Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={working}
      />
    </>
  );
};

export default ConfiguracionPage;
