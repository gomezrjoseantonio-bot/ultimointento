/**
 * Ficha de tarjeta · alta, edición y baja · docs/VOCABULARIO-dinero.md §3
 *
 * Hasta ahora una tarjeta se daba de alta como si fuese una CUENTA, en el
 * wizard de cuentas. De ahí salían tres imposibles: una cuenta no podía tener
 * dos tarjetas —lo normal son dos, débito y crédito—, no se distinguía el
 * débito del crédito, y una tarjeta de fuera quedaba anclada a un banco del que
 * en realidad puede mudarse cuando quieras.
 *
 * Aquí la tarjeta se pide por lo que es: de quién es, cuándo mueve el dinero, de
 * qué cuenta sale y con qué ciclo. Las reglas de lo que se puede guardar viven
 * en `tarjetasReglas.ts` y se comprueban otra vez en `tarjetasService.ts`; esta
 * pantalla solo evita que el usuario llegue al error.
 */

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { X as IconX } from 'lucide-react';

import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { Account } from '../../services/db';
import type {
  ModalidadTarjeta,
  OrigenTarjeta,
  PeriodicidadCiclo,
  Tarjeta,
} from '../../types/tarjetas';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  type AltaTarjeta,
} from '../../services/tarjetasService';
import { cuentasQuePuedenLiquidar } from '../../services/tarjetasReglas';
import { regenerarCompromisosDeTarjeta } from '../../services/personal/compromisosConTarjeta';
import styles from './TarjetaWizard.module.css';

interface Props {
  open: boolean;
  /** `null` = alta. */
  tarjeta: Tarjeta | null;
  /** Las cuentas vivas · de aquí sale la de liquidación. */
  cuentas: Account[];
  onClose: () => void;
  onSuccess: () => void;
}

interface Form {
  alias: string;
  emisora: string;
  origen: OrigenTarjeta;
  modalidad: ModalidadTarjeta;
  cuentaLiquidacionId: string;
  periodicidad: PeriodicidadCiclo;
  corte: string;
  diaCargo: string;
  periodosHastaElCargo: string;
  limite: string;
  cashbackPorcentaje: string;
}

const VACIO: Form = {
  alias: '',
  emisora: '',
  origen: 'banco',
  modalidad: 'credito',
  cuentaLiquidacionId: '',
  periodicidad: 'mensual',
  corte: '24',
  diaCargo: '5',
  periodosHastaElCargo: '1',
  limite: '',
  cashbackPorcentaje: '',
};

const DIAS_SEMANA = [
  { v: '1', t: 'lunes' },
  { v: '2', t: 'martes' },
  { v: '3', t: 'miércoles' },
  { v: '4', t: 'jueves' },
  { v: '5', t: 'viernes' },
  { v: '6', t: 'sábado' },
  { v: '7', t: 'domingo' },
];

const numeroOpcional = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const desdeTarjeta = (t: Tarjeta): Form => ({
  alias: t.alias,
  emisora: t.emisora ?? '',
  origen: t.origen,
  modalidad: t.modalidad,
  cuentaLiquidacionId: String(t.cuentaLiquidacionId),
  periodicidad: t.ciclo?.periodicidad ?? 'mensual',
  corte: String(t.ciclo?.corte ?? 24),
  diaCargo: String(t.ciclo?.diaCargo ?? 5),
  periodosHastaElCargo: String(t.ciclo?.periodosHastaElCargo ?? 1),
  limite: t.limite != null ? String(t.limite) : '',
  cashbackPorcentaje: t.cashbackPorcentaje != null ? String(t.cashbackPorcentaje) : '',
});

const TarjetaWizard: React.FC<Props> = ({ open, tarjeta, cuentas, onClose, onSuccess }) => {
  const [form, setForm] = useState<Form>(VACIO);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const panelRef = useFocusTrap(open);

  // De qué cuentas puede colgar una tarjeta (§3.2): nunca del efectivo —el
  // colchón no domicilia recibos— ni de otra tarjeta.
  const liquidables = useMemo(() => cuentasQuePuedenLiquidar(cuentas), [cuentas]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (tarjeta) {
      setForm(desdeTarjeta(tarjeta));
      return;
    }
    setForm({ ...VACIO, cuentaLiquidacionId: String(liquidables[0]?.id ?? '') });
    // `liquidables` cambia de identidad en cada render del padre · basta con el
    // primer id para no reiniciar el formulario mientras se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarjeta, liquidables[0]?.id]);

  if (!open) return null;

  const esCredito = form.modalidad === 'credito';
  const esSemanal = form.periodicidad === 'semanal';

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const validar = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.alias.trim()) errs.alias = 'Ponle un nombre';
    if (!form.cuentaLiquidacionId) errs.cuentaLiquidacionId = 'Elige de qué cuenta sale';

    if (esCredito) {
      const tope = esSemanal ? 7 : 31;
      const corte = parseInt(form.corte, 10);
      const cargo = parseInt(form.diaCargo, 10);
      if (!Number.isFinite(corte) || corte < 1 || corte > tope) {
        errs.corte = `Entre 1 y ${tope}`;
      }
      if (!Number.isFinite(cargo) || cargo < 1 || cargo > tope) {
        errs.diaCargo = `Entre 1 y ${tope}`;
      }
      const periodos = parseInt(form.periodosHastaElCargo, 10);
      if (!Number.isFinite(periodos) || periodos < 0 || periodos > 2) {
        errs.periodosHastaElCargo = 'Entre 0 y 2';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    setSaving(true);
    try {
      const datos: AltaTarjeta = {
        alias: form.alias.trim(),
        emisora: form.emisora.trim() || undefined,
        origen: form.origen,
        modalidad: form.modalidad,
        cuentaLiquidacionId: parseInt(form.cuentaLiquidacionId, 10),
        // El débito no acumula nada: `tarjetasService` descarta el ciclo, pero
        // no se lo mandamos siquiera.
        ciclo: esCredito
          ? {
              periodicidad: form.periodicidad,
              corte: parseInt(form.corte, 10),
              diaCargo: parseInt(form.diaCargo, 10),
              periodosHastaElCargo: parseInt(form.periodosHastaElCargo, 10),
            }
          : undefined,
        limite: numeroOpcional(form.limite),
        cashbackPorcentaje: numeroOpcional(form.cashbackPorcentaje),
      };

      if (tarjeta?.id != null) {
        const seMuda = tarjeta.cuentaLiquidacionId !== datos.cuentaLiquidacionId;
        await actualizarTarjeta(tarjeta.id, datos);
        // Re-domiciliarla mueve sus cargos CON ella (§3.2). Los gastos que la
        // usan guardan su cuenta como copia, y sin esto seguirían previstos en
        // la cuenta anterior hasta que alguien los abriera uno a uno.
        if (seMuda) await regenerarCompromisosDeTarjeta(tarjeta.id);
        toast.success('Tarjeta actualizada');
      } else {
        await crearTarjeta(datos);
        toast.success('Tarjeta creada');
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setSaving(false);
    }
  };

  const borrar = async () => {
    if (tarjeta?.id == null) return;
    // eslint-disable-next-line no-restricted-globals
    if (!window.confirm(`¿Eliminar la tarjeta "${tarjeta.alias}"?`)) return;
    setSaving(true);
    try {
      await eliminarTarjeta(tarjeta.id);
      toast.success('Tarjeta eliminada');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={tarjeta ? 'Editar tarjeta' : 'Nueva tarjeta'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <div className={styles.headerKicker}>Tarjeta</div>
            <div className={styles.headerTitle}>
              {tarjeta ? tarjeta.alias : 'Nueva tarjeta'}
            </div>
          </div>
          <button
            type="button"
            className={styles.headerClose}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <IconX size={16} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={guardar} style={{ display: 'contents' }}>
          <div className={styles.body}>
            <div className={`${styles.row} ${styles.row2}`}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tj-alias">
                  Nombre <span className={styles.req}>*</span>
                </label>
                <input
                  id="tj-alias"
                  className={`${styles.input} ${errors.alias ? styles.inputError : ''}`}
                  value={form.alias}
                  placeholder="Ej. Carrefour"
                  onChange={(e) => set('alias', e.target.value)}
                />
                {errors.alias && <div className={styles.errorText}>{errors.alias}</div>}
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tj-emisora">
                  Quién la emite
                </label>
                <input
                  id="tj-emisora"
                  className={styles.input}
                  value={form.emisora}
                  placeholder="Ej. Cetelem"
                  onChange={(e) => set('emisora', e.target.value)}
                />
              </div>
            </div>

            {/* §3.2 · de ello dependen dos cosas: si su cuenta es intrínseca o
                mudable, y si su gasto bonifica una hipoteca. */}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>De quién es</span>
              <div className={styles.choice}>
                <button
                  type="button"
                  className={`${styles.choiceCard} ${form.origen === 'banco' ? styles.selected : ''}`}
                  aria-pressed={form.origen === 'banco'}
                  onClick={() => set('origen', 'banco')}
                >
                  <span className={styles.choiceLabel}>De mi banco</span>
                  <span className={styles.choiceHint}>Su gasto puede bonificar la hipoteca</span>
                </button>
                <button
                  type="button"
                  className={`${styles.choiceCard} ${form.origen === 'externa' ? styles.selected : ''}`}
                  aria-pressed={form.origen === 'externa'}
                  onClick={() => set('origen', 'externa')}
                >
                  <span className={styles.choiceLabel}>De fuera</span>
                  <span className={styles.choiceHint}>Carrefour, Cetelem… nunca bonifica</span>
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Cuándo mueve el dinero</span>
              <div className={styles.choice}>
                <button
                  type="button"
                  className={`${styles.choiceCard} ${form.modalidad === 'debito' ? styles.selected : ''}`}
                  aria-pressed={form.modalidad === 'debito'}
                  onClick={() => set('modalidad', 'debito')}
                >
                  <span className={styles.choiceLabel}>Débito</span>
                  <span className={styles.choiceHint}>Sale en el momento de la compra</span>
                </button>
                <button
                  type="button"
                  className={`${styles.choiceCard} ${form.modalidad === 'credito' ? styles.selected : ''}`}
                  aria-pressed={form.modalidad === 'credito'}
                  onClick={() => set('modalidad', 'credito')}
                >
                  <span className={styles.choiceLabel}>Crédito</span>
                  <span className={styles.choiceHint}>Se acumula y sale entero en un recibo</span>
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="tj-cuenta">
                De qué cuenta sale el dinero <span className={styles.req}>*</span>
              </label>
              <select
                id="tj-cuenta"
                className={`${styles.select} ${errors.cuentaLiquidacionId ? styles.inputError : ''}`}
                value={form.cuentaLiquidacionId}
                onChange={(e) => set('cuentaLiquidacionId', e.target.value)}
              >
                <option value="">Elige una cuenta</option>
                {liquidables.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.alias || `Cuenta #${c.id}`}
                  </option>
                ))}
              </select>
              {errors.cuentaLiquidacionId && (
                <div className={styles.errorText}>{errors.cuentaLiquidacionId}</div>
              )}
              {form.origen === 'externa' && (
                <div className={styles.note}>
                  Una tarjeta de fuera se <b>re-domicilia</b> cuando quieras: cambiar esta cuenta
                  es una edición normal, no hace falta rehacer la tarjeta.
                </div>
              )}
            </div>

            {esCredito && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="tj-periodicidad">
                    Cada cuánto corta
                  </label>
                  <select
                    id="tj-periodicidad"
                    className={styles.select}
                    value={form.periodicidad}
                    onChange={(e) => {
                      const p = e.target.value as PeriodicidadCiclo;
                      // Los días significan cosas distintas en cada periodicidad
                      // —día del mes o día de la semana—, así que arrastrar el
                      // valor anterior guardaría un ciclo que no existe.
                      setForm((prev) => ({
                        ...prev,
                        periodicidad: p,
                        corte: p === 'semanal' ? '7' : '24',
                        diaCargo: p === 'semanal' ? '1' : '5',
                        periodosHastaElCargo: '1',
                      }));
                    }}
                  >
                    <option value="mensual">Cada mes</option>
                    <option value="semanal">Cada semana</option>
                  </select>
                </div>

                <div className={`${styles.row} ${styles.row3}`}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="tj-corte">
                      Corta el
                    </label>
                    {esSemanal ? (
                      <select
                        id="tj-corte"
                        className={styles.select}
                        value={form.corte}
                        onChange={(e) => set('corte', e.target.value)}
                      >
                        {DIAS_SEMANA.map((d) => (
                          <option key={d.v} value={d.v}>{d.t}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="tj-corte"
                        type="number"
                        min={1}
                        max={31}
                        className={`${styles.input} ${errors.corte ? styles.inputError : ''}`}
                        value={form.corte}
                        onChange={(e) => set('corte', e.target.value)}
                      />
                    )}
                    {errors.corte && <div className={styles.errorText}>{errors.corte}</div>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="tj-cargo">
                      Cobra el
                    </label>
                    {esSemanal ? (
                      <select
                        id="tj-cargo"
                        className={styles.select}
                        value={form.diaCargo}
                        onChange={(e) => set('diaCargo', e.target.value)}
                      >
                        {DIAS_SEMANA.map((d) => (
                          <option key={d.v} value={d.v}>{d.t}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="tj-cargo"
                        type="number"
                        min={1}
                        max={31}
                        className={`${styles.input} ${errors.diaCargo ? styles.inputError : ''}`}
                        value={form.diaCargo}
                        onChange={(e) => set('diaCargo', e.target.value)}
                      />
                    )}
                    {errors.diaCargo && <div className={styles.errorText}>{errors.diaCargo}</div>}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="tj-periodos">
                      {esSemanal ? 'Semanas después' : 'Meses después'}
                    </label>
                    <select
                      id="tj-periodos"
                      className={styles.select}
                      value={form.periodosHastaElCargo}
                      onChange={(e) => set('periodosHastaElCargo', e.target.value)}
                    >
                      <option value="0">el mismo</option>
                      <option value="1">el siguiente</option>
                      <option value="2">dos después</option>
                    </select>
                  </div>
                </div>

                <div className={styles.note}>
                  El <b>corte</b> y el <b>cargo</b> son dos fechas distintas: «corta el 24 y cobra
                  el 5 del mes siguiente» es lo normal. Un día 31 significa <b>el último del
                  mes</b>, no se salta febrero.
                </div>
              </>
            )}

            <div className={`${styles.row} ${styles.row2}`}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tj-limite">
                  Límite del periodo (€)
                </label>
                <input
                  id="tj-limite"
                  className={styles.input}
                  inputMode="decimal"
                  value={form.limite}
                  placeholder="Ej. 4700"
                  onChange={(e) => set('limite', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="tj-cashback">
                  Cashback (%)
                </label>
                <input
                  id="tj-cashback"
                  className={styles.input}
                  inputMode="decimal"
                  value={form.cashbackPorcentaje}
                  placeholder="Ej. 1"
                  onChange={(e) => set('cashbackPorcentaje', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            {tarjeta?.id != null && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={borrar}
                disabled={saving}
              >
                Eliminar
              </button>
            )}
            <div className={styles.footerRight}>
              <button type="button" className={styles.btn} onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TarjetaWizard;
