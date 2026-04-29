import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { cuentasService } from '../../../services/cuentasService';
import type { Account } from '../../../services/db';
import { calcularGananciaPerdidaFIFO } from '../../../services/inversionesFiscalService';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import styles from './Dialog.module.css';

interface Props {
  posicionNombre: string;
  posicion: PosicionInversion;
  initialAportacion?: Aportacion;
  onSave: (aportacion: Omit<Aportacion, 'id'>) => void;
  onClose: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const AportacionFormDialog: React.FC<Props> = ({
  posicionNombre,
  posicion,
  initialAportacion,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    fecha:
      initialAportacion?.fecha?.split('T')[0] ||
      new Date().toISOString().split('T')[0],
    tipo: (initialAportacion?.tipo || 'aportacion') as 'aportacion' | 'reembolso',
    importe: initialAportacion?.importe || 0,
    notas: initialAportacion?.notas || '',
    cuenta_cargo_id: initialAportacion?.cuenta_cargo_id
      ? String(initialAportacion.cuenta_cargo_id)
      : '',
    unidades_vendidas: initialAportacion?.unidades_vendidas || 0,
    unidades: initialAportacion?.unidades || 0,
    precioUnitario: initialAportacion?.precioUnitario || 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cuentas, setCuentas] = useState<Account[]>([]);

  useEffect(() => {
    cuentasService
      .list()
      .then(setCuentas)
      .catch(() => setCuentas([]));
  }, []);

  const fifoPreview = useMemo(() => {
    if (formData.tipo !== 'reembolso' || formData.importe <= 0) {
      return { costeAdquisicion: 0, gananciaOPerdida: 0 };
    }
    const reembolsoPreview: Aportacion = {
      id: -1,
      fecha: new Date(formData.fecha).toISOString(),
      tipo: 'reembolso',
      importe: formData.importe,
      unidades_vendidas:
        formData.unidades_vendidas > 0 ? formData.unidades_vendidas : undefined,
    };
    return calcularGananciaPerdidaFIFO(posicion, reembolsoPreview);
  }, [
    formData.fecha,
    formData.importe,
    formData.tipo,
    formData.unidades_vendidas,
    posicion,
  ]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (formData.importe <= 0) errs.importe = 'El importe debe ser mayor que 0.';
    if (!formData.fecha) errs.fecha = 'La fecha es obligatoria.';
    if (formData.tipo === 'reembolso' && formData.unidades_vendidas < 0) {
      errs.unidades_vendidas = 'Las unidades vendidas no pueden ser negativas.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: Omit<Aportacion, 'id'> = {
      fecha: new Date(formData.fecha).toISOString(),
      tipo: formData.tipo,
      importe: formData.importe,
      notas: formData.notas || undefined,
      cuenta_cargo_id: formData.cuenta_cargo_id
        ? Number(formData.cuenta_cargo_id)
        : undefined,
      fuente: 'manual',
      ...(formData.tipo === 'aportacion' &&
        formData.unidades > 0 && { unidades: formData.unidades }),
      ...(formData.tipo === 'aportacion' &&
        formData.precioUnitario > 0 && { precioUnitario: formData.precioUnitario }),
      ...(formData.tipo === 'reembolso' &&
        formData.unidades_vendidas > 0 && {
          unidades_vendidas: formData.unidades_vendidas,
        }),
    };
    if (formData.tipo === 'reembolso') {
      payload.coste_adquisicion_fifo = round2(fifoPreview.costeAdquisicion);
      payload.ganancia_perdida = round2(fifoPreview.gananciaOPerdida);
    }
    onSave(payload);
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={`${styles.dialog} ${styles.sizeSm}`}>
        <div className={styles.header}>
          <div>
            <h2>{initialAportacion ? 'Editar movimiento' : 'Añadir aportación'}</h2>
            <div className={styles.sub}>{posicionNombre}</div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            <div className={styles.row2}>
              <div className={`${styles.field} ${errors.fecha ? styles.error : ''}`}>
                <label htmlFor="ap-fecha">Fecha *</label>
                <input
                  id="ap-fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                />
                {errors.fecha && <span className={styles.err}>{errors.fecha}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="ap-tipo">Tipo *</label>
                <select
                  id="ap-tipo"
                  value={formData.tipo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipo: e.target.value as 'aportacion' | 'reembolso',
                    })
                  }
                >
                  <option value="aportacion">Aportación</option>
                  <option value="reembolso">Reembolso</option>
                </select>
              </div>
            </div>

            <div className={`${styles.field} ${errors.importe ? styles.error : ''}`}>
              <label htmlFor="ap-importe">Importe * · €</label>
              <input
                id="ap-importe"
                type="number"
                step="0.01"
                value={formData.importe}
                onChange={(e) =>
                  setFormData({ ...formData, importe: parseFloat(e.target.value) || 0 })
                }
                placeholder="500.00"
              />
              {errors.importe && <span className={styles.err}>{errors.importe}</span>}
            </div>

            {formData.tipo === 'aportacion' && (
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label htmlFor="ap-uni">Unidades / participaciones (opc.)</label>
                  <input
                    id="ap-uni"
                    type="number"
                    step="any"
                    min={0}
                    value={formData.unidades || ''}
                    onChange={(e) => {
                      const unidades = parseFloat(e.target.value) || 0;
                      const precioUnitario =
                        unidades > 0 && formData.importe > 0
                          ? Math.round((formData.importe / unidades) * 10000) / 10000
                          : formData.precioUnitario;
                      setFormData({ ...formData, unidades, precioUnitario });
                    }}
                    placeholder="Ej. 10, 0.5…"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="ap-pu">Precio unitario (opc.)</label>
                  <input
                    id="ap-pu"
                    type="number"
                    step="0.0001"
                    min={0}
                    value={formData.precioUnitario || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        precioUnitario: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="Calculado"
                  />
                </div>
              </div>
            )}

            {formData.tipo === 'reembolso' && (
              <>
                <div className={`${styles.field} ${errors.unidades_vendidas ? styles.error : ''}`}>
                  <label htmlFor="ap-uv">Unidades vendidas (opc.)</label>
                  <input
                    id="ap-uv"
                    type="number"
                    step="0.000001"
                    min={0}
                    value={formData.unidades_vendidas || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unidades_vendidas: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="Ej. 12.5"
                  />
                  {errors.unidades_vendidas && (
                    <span className={styles.err}>{errors.unidades_vendidas}</span>
                  )}
                </div>

                <div className={styles.previewBox}>
                  <div className={styles.head}>Estimación FIFO</div>
                  <div className={styles.previewRow}>
                    <span className="lab">Coste de adquisición</span>
                    <span className="val strong">
                      {fifoPreview.costeAdquisicion.toFixed(2)} €
                    </span>
                  </div>
                  <div className={styles.previewRow}>
                    <span className="lab">Ganancia / pérdida</span>
                    <span
                      className={`val ${fifoPreview.gananciaOPerdida >= 0 ? 'strong' : 'neg strong'}`}
                    >
                      {fifoPreview.gananciaOPerdida >= 0 ? '+' : ''}
                      {fifoPreview.gananciaOPerdida.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className={styles.field}>
              <label htmlFor="ap-cc">Cuenta de cargo</label>
              <select
                id="ap-cc"
                value={formData.cuenta_cargo_id}
                onChange={(e) =>
                  setFormData({ ...formData, cuenta_cargo_id: e.target.value })
                }
              >
                <option value="">Seleccionar cuenta…</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.alias || c.iban}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="ap-notas">Notas</label>
              <textarea
                id="ap-notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                rows={2}
                placeholder="Notas opcionales…"
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary}>
              {initialAportacion ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AportacionFormDialog;
