// T13 lote B · hot-fix · Dialog "Traspasar plan de pensiones" v5.
// Reemplaza al TraspasoForm legacy en el módulo v5.
//
// Modelo (TAREA-13 §1.2 + §5.8):
//  · Identidad estable · el plan NO se duplica · solo cambia gestoraActual /
//    isinActual / valorActual. Las aportaciones siguen apuntando al MISMO
//    planId antes y después del traspaso.
//  · El destino se introduce como texto libre (gestora destino · ISIN nuevo).
//    NO se selecciona un plan existente del usuario · eso fusionaría dos
//    fichas y rompería el modelo.
//  · Side-effects en `traspasosPlanPensionesService.registrarTraspaso`:
//    actualiza el plan + crea valoración histórica con `valorTraspaso`.

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { planesPensionesService } from '../../../services/planesPensionesService';
import { traspasosPlanPensionesService } from '../../../services/traspasosPlanPensionesService';
import type { PlanPensiones } from '../../../types/planesPensiones';
import styles from './Dialog.module.css';

interface Props {
  plan: PlanPensiones;
  onSaved: () => void;
  onClose: () => void;
}

// Unificado con el resto de dialogs v5 (AportacionPlanDialog,
// ActualizarValorPlanDialog) · ISO YYYY-MM-DD.
const today = (): string => new Date().toISOString().split('T')[0];

const fmt = (n: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const TraspasoPlanDialog: React.FC<Props> = ({ plan, onSaved, onClose }) => {
  const saldoOrigen = plan.valorActual ?? 0;

  const [gestoraDestino, setGestoraDestino] = useState('');
  const [isinDestino, setIsinDestino] = useState('');
  const [tipo, setTipo] = useState<'total' | 'parcial'>('total');
  const [valorTraspaso, setValorTraspaso] = useState<string>(
    saldoOrigen > 0 ? String(saldoOrigen) : '',
  );
  const [importeTraspasado, setImporteTraspasado] = useState<string>('');
  const [fechaSolicitud, setFechaSolicitud] = useState('');
  const [fechaEjecucion, setFechaEjecucion] = useState(today());
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const valorNum = parseFloat(valorTraspaso.replace(',', '.'));
  const importeNum =
    tipo === 'total' ? valorNum : parseFloat(importeTraspasado.replace(',', '.'));

  // Validación en tiempo real · botón "Registrar traspaso" deshabilitado
  // mientras haya error. Cubre los 2 casos de C6:
  //   · importeTraspasado ≤ valorTraspaso
  //   · importeTraspasado ≤ saldo origen del plan
  // (más coherencia básica: gestora destino, valor > 0, margen 10 % saldo).
  const validationError = useMemo<string | null>(() => {
    if (!gestoraDestino.trim()) return 'Indica la gestora destino.';
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return 'Indica el valor del plan en el momento del traspaso.';
    }
    if (saldoOrigen > 0 && valorNum > saldoOrigen * 1.1) {
      return `El valor del traspaso (${fmt(valorNum)}) supera en >10 % el saldo registrado (${fmt(saldoOrigen)}). Actualiza la valoración antes de registrar el traspaso.`;
    }
    if (tipo === 'parcial') {
      if (!Number.isFinite(importeNum) || importeNum <= 0) {
        return 'Indica el importe a traspasar.';
      }
      if (importeNum > valorNum) {
        return `El importe traspasado no puede superar el valor del traspaso (${fmt(valorNum)}).`;
      }
      if (saldoOrigen > 0 && importeNum > saldoOrigen) {
        return `El importe traspasado supera el saldo disponible del plan origen (${fmt(saldoOrigen)}).`;
      }
    }
    if (!fechaEjecucion) return 'Indica la fecha de ejecución.';
    return null;
  }, [gestoraDestino, valorNum, importeNum, tipo, saldoOrigen, fechaEjecucion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const planActual = await planesPensionesService.getPlan(plan.id);
      if (!planActual) throw new Error(`Plan ${plan.id} no encontrado`);

      await traspasosPlanPensionesService.registrarTraspaso({
        planId: plan.id,
        fechaSolicitud: fechaSolicitud || undefined,
        fechaEjecucion,
        gestoraOrigen: planActual.gestoraActual,
        gestoraDestino: gestoraDestino.trim(),
        isinOrigen: planActual.isinActual,
        isinDestino: isinDestino.trim() || undefined,
        valorTraspaso: valorNum,
        importeTraspasado: importeNum,
        esTotal: tipo === 'total',
        tipoAdministrativoOrigen: planActual.tipoAdministrativo,
        politicaInversionOrigen: planActual.politicaInversion,
        notas: notas.trim() || undefined,
      });

      onSaved();
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] traspaso plan', err);
      setSubmitError(
        err instanceof Error ? err.message : 'Error al registrar el traspaso.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={`${styles.dialog} ${styles.sizeMd}`}>
        <div className={styles.header}>
          <div>
            <h2>Traspasar plan de pensiones</h2>
            <div className={styles.sub}>{plan.nombre}</div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
            disabled={saving}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            <div className={styles.previewBox} style={{ marginBottom: 16 }}>
              <div className={styles.head}>Plan origen</div>
              <div className={styles.previewRow}>
                <span className={styles.lab}>Gestora actual</span>
                <span className={styles.val}>{plan.gestoraActual}</span>
              </div>
              {plan.isinActual && (
                <div className={styles.previewRow}>
                  <span className={styles.lab}>ISIN</span>
                  <span className={styles.val}>{plan.isinActual}</span>
                </div>
              )}
              <div className={styles.previewRow}>
                <span className={styles.lab}>Saldo registrado</span>
                <span className={`${styles.val} ${styles.strong}`}>{fmt(saldoOrigen)}</span>
              </div>
            </div>

            <div className={styles.row2} style={{ marginBottom: 14 }}>
              <div className={styles.field}>
                <label htmlFor="trd-gestora">Gestora destino *</label>
                <input
                  id="trd-gestora"
                  type="text"
                  value={gestoraDestino}
                  onChange={(e) => setGestoraDestino(e.target.value)}
                  placeholder="MyInvestor"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="trd-isin">ISIN destino</label>
                <input
                  id="trd-isin"
                  type="text"
                  value={isinDestino}
                  onChange={(e) => setIsinDestino(e.target.value)}
                  placeholder="Opcional"
                  maxLength={12}
                />
              </div>
            </div>

            <div className={styles.tabRow} style={{ marginBottom: 14 }}>
              <button
                type="button"
                className={tipo === 'total' ? styles.active : ''}
                onClick={() => setTipo('total')}
              >
                Total
              </button>
              <button
                type="button"
                className={tipo === 'parcial' ? styles.active : ''}
                onClick={() => setTipo('parcial')}
              >
                Parcial
              </button>
            </div>

            <div className={styles.field}>
              <label htmlFor="trd-valor">Valor del plan en el momento del traspaso (€) *</label>
              <input
                id="trd-valor"
                type="number"
                step="0.01"
                min="0"
                value={valorTraspaso}
                onChange={(e) => setValorTraspaso(e.target.value)}
                placeholder="0.00"
                required
              />
              {/* Solo en traspaso total · registrarTraspaso solo cierra/abre
                  bloques (y crea valoración histórica) cuando esTotal=true.
                  En parcial el plan origen sigue existiendo en la gestora
                  original · este texto sería engañoso. */}
              {tipo === 'total' && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--atlas-v5-ink-4)',
                    marginTop: 4,
                  }}
                >
                  Cierra el bloque de la gestora origen y abre el de la destino · imprescindible para la rentabilidad por bloque.
                </span>
              )}
            </div>

            {tipo === 'parcial' && (
              <div className={styles.field}>
                <label htmlFor="trd-importe">Importe efectivo traspasado (€) *</label>
                <input
                  id="trd-importe"
                  type="number"
                  step="0.01"
                  min="0"
                  max={saldoOrigen > 0 ? saldoOrigen : undefined}
                  value={importeTraspasado}
                  onChange={(e) => setImporteTraspasado(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            )}

            <div className={styles.row2}>
              <div className={styles.field}>
                <label htmlFor="trd-f-sol">Fecha solicitud</label>
                <input
                  id="trd-f-sol"
                  type="date"
                  value={fechaSolicitud}
                  onChange={(e) => setFechaSolicitud(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="trd-f-eje">Fecha ejecución *</label>
                <input
                  id="trd-f-eje"
                  type="date"
                  value={fechaEjecucion}
                  onChange={(e) => setFechaEjecucion(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="trd-notas">Notas</label>
              <textarea
                id="trd-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Opcional"
              />
            </div>

            {validationError && (
              <div className={styles.field} role="alert">
                <span className={styles.err}>{validationError}</span>
              </div>
            )}
            {submitError && (
              <div className={styles.field} role="alert">
                <span className={styles.err}>{submitError}</span>
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={saving || validationError !== null}
            >
              {saving ? 'Registrando…' : 'Registrar traspaso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TraspasoPlanDialog;
