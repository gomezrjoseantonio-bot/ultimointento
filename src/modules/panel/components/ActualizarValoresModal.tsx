import React, { useEffect, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import {
  getFinancialValuesSnapshot,
  saveFinancialValuesSnapshot,
} from '../../../services/financialValuesService';
import type {
  FinancialValuationItem,
  FinancialValuesSnapshot,
} from '../../../types/financialValues';
import ModalAtlas from '../../inversiones/components/modal/ModalAtlas';
import ModalAtlasHeader from '../../inversiones/components/modal/ModalAtlasHeader';
import ModalAtlasFooter, {
  ModalAtlasButtonGhost,
  ModalAtlasButtonGold,
} from '../../inversiones/components/modal/ModalAtlasFooter';
import atlasStyles from '../../inversiones/styles/atlas-inversiones.module.css';
import styles from './ActualizarValoresModal.module.css';

export interface ActualizarValoresModalProps {
  onClose: () => void;
  onSaved?: (snapshot: FinancialValuesSnapshot) => void | Promise<void>;
}

interface FormState {
  ipcMonthlyPercent: string;
  euriborPercent: string;
  effectiveDate: string;
  realEstateValuations: FinancialValuationItem[];
  investmentValuations: FinancialValuationItem[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const toInputValue = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const parseNumericField = (
  rawValue: string,
  fieldLabel: string,
  options: { allowNegative?: boolean } = {},
): number => {
  const normalized = rawValue.trim().replace(',', '.');
  if (!normalized) throw new Error(`Indica ${fieldLabel.toLowerCase()}`);
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${fieldLabel} debe ser un número válido`);
  if (!options.allowNegative && parsed < 0) {
    throw new Error(`${fieldLabel} no puede ser negativo`);
  }
  return parsed;
};

const buildFormState = (snapshot: FinancialValuesSnapshot): FormState => ({
  ipcMonthlyPercent: toInputValue(snapshot.ipcMonthlyPercent),
  euriborPercent: toInputValue(snapshot.euriborPercent),
  effectiveDate: snapshot.effectiveDate || todayISO(),
  realEstateValuations: snapshot.realEstateValuations,
  investmentValuations: snapshot.investmentValuations,
});

const updateValuationList = (
  list: FinancialValuationItem[],
  index: number,
  rawValue: string,
): FinancialValuationItem[] =>
  list.map((item, currentIndex) =>
    currentIndex === index
      ? {
          ...item,
          value: rawValue === '' ? Number.NaN : Number(rawValue.replace(',', '.')),
        }
      : item,
  );

const ValuationRows: React.FC<{
  items: FinancialValuationItem[];
  emptyLabel: string;
  inputLabelPrefix: string;
  onChange: (index: number, rawValue: string) => void;
}> = ({ items, emptyLabel, inputLabelPrefix, onChange }) => {
  if (items.length === 0) {
    return <div className={styles.listEmpty}>{emptyLabel}</div>;
  }

  return (
    <div className={styles.list}>
      {items.map((item, index) => (
        <div key={item.id} className={styles.row}>
          <div className={styles.name}>
            <div className={styles.title}>{item.name}</div>
            <div className={styles.meta}>ID {item.id}</div>
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className={`${atlasStyles.input} ${atlasStyles.mono}`}
            value={Number.isFinite(item.value) ? String(item.value) : ''}
            onChange={(event) => onChange(index, event.target.value)}
            aria-label={`${inputLabelPrefix} ${item.name}`}
          />
        </div>
      ))}
    </div>
  );
};

const ActualizarValoresModal: React.FC<ActualizarValoresModalProps> = ({
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFinancialValuesSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setForm(buildFormState(snapshot));
      })
      .catch(() => {
        if (cancelled) return;
        setError('No se pudieron cargar los valores globales');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtitle = useMemo(() => {
    if (!form) return 'Carga tus valores financieros globales';
    const totalActivos =
      form.realEstateValuations.length + form.investmentValuations.length;
    return `${totalActivos} activo${totalActivos === 1 ? '' : 's'} listos para actualizar`;
  }, [form]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);

    try {
      const ipcMonthlyPercent = parseNumericField(
        form.ipcMonthlyPercent,
        'IPC mensual (%)',
        { allowNegative: true },
      );
      const euriborPercent = parseNumericField(form.euriborPercent, 'Euríbor (%)', {
        allowNegative: true,
      });

      const realEstateValuations = form.realEstateValuations.map((item) => ({
        ...item,
        value: parseNumericField(String(item.value), `la valoración de ${item.name}`),
      }));
      const investmentValuations = form.investmentValuations.map((item) => ({
        ...item,
        value: parseNumericField(String(item.value), `la valoración de ${item.name}`),
      }));

      const snapshot = await saveFinancialValuesSnapshot({
        ipcMonthlyPercent,
        euriborPercent,
        effectiveDate: form.effectiveDate || todayISO(),
        realEstateValuations,
        investmentValuations,
      });
      await onSaved?.(snapshot);
      showToastV5('Valores globales actualizados', 'success');
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudieron guardar los valores';
      setError(message);
      showToastV5(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} size="noPreview" ariaLabel="Actualizar valores">
      <ModalAtlasHeader
        icon={<Icons.Refresh size={18} strokeWidth={1.8} />}
        title="Actualizar valores"
        subtitle={subtitle}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <div className={atlasStyles.form}>
          {error ? <div className={styles.error}>{error}</div> : null}

          {loading || !form ? (
            <div className={atlasStyles.section}>
              <div className={atlasStyles.sectionTitle}>Cargando</div>
              <div className={styles.listEmpty}>Preparando inmuebles, inversiones e indicadores…</div>
            </div>
          ) : (
            <>
              <div className={atlasStyles.section}>
                <div className={atlasStyles.sectionTitle}>Indicadores globales</div>
                <div className={`${atlasStyles.row} ${atlasStyles.cols3}`}>
                  <div className={atlasStyles.field}>
                    <label className={atlasStyles.label} htmlFor="financial-values-ipc">
                      IPC mensual (%) *
                    </label>
                    <input
                      id="financial-values-ipc"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      className={`${atlasStyles.input} ${atlasStyles.mono}`}
                      value={form.ipcMonthlyPercent}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, ipcMonthlyPercent: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className={atlasStyles.field}>
                    <label className={atlasStyles.label} htmlFor="financial-values-euribor">
                      Euríbor (%) *
                    </label>
                    <input
                      id="financial-values-euribor"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      className={`${atlasStyles.input} ${atlasStyles.mono}`}
                      value={form.euriborPercent}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, euriborPercent: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className={atlasStyles.field}>
                    <label className={atlasStyles.label} htmlFor="financial-values-effective-date">
                      Fecha efectiva (opcional)
                    </label>
                    <input
                      id="financial-values-effective-date"
                      type="date"
                      className={atlasStyles.input}
                      value={form.effectiveDate}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? { ...current, effectiveDate: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className={atlasStyles.section}>
                <div className={atlasStyles.sectionTitle}>Inmuebles</div>
                <ValuationRows
                  items={form.realEstateValuations}
                  emptyLabel="No hay inmuebles activos para actualizar."
                  inputLabelPrefix="Valoración de inmueble"
                  onChange={(index, rawValue) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            realEstateValuations: updateValuationList(
                              current.realEstateValuations,
                              index,
                              rawValue,
                            ),
                          }
                        : current,
                    )
                  }
                />
              </div>

              <div className={atlasStyles.section}>
                <div className={atlasStyles.sectionTitle}>Inversiones</div>
                <ValuationRows
                  items={form.investmentValuations}
                  emptyLabel="No hay inversiones activas para actualizar."
                  inputLabelPrefix="Valoración de inversión"
                  onChange={(index, rawValue) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            investmentValuations: updateValuationList(
                              current.investmentValuations,
                              index,
                              rawValue,
                            ),
                          }
                        : current,
                    )
                  }
                />
              </div>
            </>
          )}
        </div>

        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              Se guarda en una fuente central local lista para conectar con backend.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={saving}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading || saving || !form}>
                {saving ? 'Guardando…' : 'Guardar'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default ActualizarValoresModal;
