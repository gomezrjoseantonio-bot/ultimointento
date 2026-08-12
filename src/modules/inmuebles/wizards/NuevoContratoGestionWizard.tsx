// Gestión delegada · renta garantizada · alta del CONTRATO DE GESTIÓN (padre).
// Usa el MISMO shell visual que el wizard LAU (NuevoContratoWizard.module.css)
// para verse nativo: cabecera de paso · rejilla de campos · aside de resumen ·
// footer de acciones. Un contrato de gestión es NO-LAU y más simple: contraparte
// = agencia, sin inquilino LAU, sin fianza. Ver docs/DISENO-gestion-delegada-agencias-V1.md.

import React, { useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { PageHead, Icons, showToastV5 } from '../../../design-system/v5';
import type { Contract } from '../../../services/db';
import { saveContract, getContract } from '../../../services/contractService';
import type { InmueblesOutletContext } from '../InmueblesContext';
import { CuentaCobroField } from './CuentaCobroField';
import { useCuentasCobro } from './cuentaCobro';
import { guardarAgencia } from './agenciaGestionService';
import {
  construirPayloadGestionGarantizada,
  type GestionGarantizadaForm,
} from './gestionGarantizadaPayload';
import styles from './NuevoContratoWizard.module.css';

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const INDEX_LABEL: Record<GestionGarantizadaForm['indexacion'], string> = {
  ipc: 'IPC',
  otros: 'Otros (fórmula)',
  none: 'Sin indexación',
};

interface Props {
  /** Callback para volver al paso 0 (elección de tipo). Si falta, vuelve a /contratos. */
  onBack?: () => void;
}

const NuevoContratoGestionWizard: React.FC<Props> = ({ onBack }) => {
  const navigate = useNavigate();
  const { properties } = useOutletContext<InmueblesOutletContext>();
  const cuentas = useCuentasCobro();
  const [searchParams] = useSearchParams();

  const inmuebleInicial = (() => {
    const v = searchParams.get('inmueble');
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  })();

  const [form, setForm] = useState<GestionGarantizadaForm>({
    inmuebleId: inmuebleInicial,
    agenciaNombre: '',
    agenciaNif: '',
    rentaGarantizada: '',
    fianza: '',
    indexacion: 'ipc',
    indexacionFormula: '',
    fechaInicio: hoyISO(),
    fechaFin: '',
    diaPago: '1',
    cuentaCobroId: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof GestionGarantizadaForm>(k: K, v: GestionGarantizadaForm[K]): void =>
    setForm((f) => ({ ...f, [k]: v }));

  const volver = (): void => (onBack ? onBack() : navigate('/contratos'));

  const onSubmit = async (): Promise<void> => {
    setError(null);
    const res = construirPayloadGestionGarantizada(form);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGuardando(true);
    try {
      await guardarAgencia(form.agenciaNif, form.agenciaNombre);
      const id = await saveContract(res.payload as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
      const verificado = await getContract(id);
      if (!verificado) throw new Error('No se pudo verificar el contrato');
      showToastV5('Contrato de gestión creado');
      navigate('/contratos?tab=vigentes');
    } catch {
      setError('No se pudo guardar el contrato de gestión. Inténtalo de nuevo.');
      setGuardando(false);
    }
  };

  const renta = Number(form.rentaGarantizada) || 0;
  const fianza = Number(form.fianza) || 0;

  return (
    <>
      <PageHead
        breadcrumb={[
          { label: 'Alquileres', onClick: () => navigate('/contratos') },
          { label: 'Nuevo' },
        ]}
        onBack={volver}
        title="Gestión delegada"
        sub="contrato con la agencia que gestiona el alquiler"
      />

      <div className={styles.wrap}>
        <div className={styles.main}>
          <div className={styles.stepHeader}>
            <div className={styles.stepTitle}>Datos del contrato de gestión</div>
          </div>

          <div className={styles.fields}>
            <div className={`${styles.field} ${styles.full}`}>
              <label className={styles.label}>Inmueble</label>
              <select
                className={styles.select}
                value={form.inmuebleId ?? ''}
                onChange={(e) => set('inmuebleId', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecciona un inmueble…</option>
                {properties
                  .filter((p) => p.id != null)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.alias}
                    </option>
                  ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Agencia</label>
              <input
                className={styles.input}
                value={form.agenciaNombre}
                onChange={(e) => set('agenciaNombre', e.target.value)}
                placeholder="Nombre de la agencia"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>NIF / CIF</label>
              <input
                className={styles.input}
                value={form.agenciaNif}
                onChange={(e) => set('agenciaNif', e.target.value)}
                placeholder="B12345678"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Renta garantizada (€/mes)</label>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                value={form.rentaGarantizada}
                onChange={(e) => set('rentaGarantizada', e.target.value)}
                placeholder="1350"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Día de cobro</label>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={31}
                value={form.diaPago}
                onChange={(e) => set('diaPago', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Fianza (€)</label>
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                value={form.fianza}
                onChange={(e) => set('fianza', e.target.value)}
                placeholder="0"
              />
              <span className={styles.help}>Opcional · si la agencia deja fianza.</span>
            </div>
            <div className={styles.field} aria-hidden="true" />

            <div className={styles.field}>
              <label className={styles.label}>Inicio</label>
              <input
                className={styles.input}
                type="date"
                value={form.fechaInicio}
                onChange={(e) => set('fechaInicio', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Fin (plazo pactado)</label>
              <input
                className={styles.input}
                type="date"
                value={form.fechaFin}
                onChange={(e) => set('fechaFin', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Indexación</label>
              <select
                className={styles.select}
                value={form.indexacion}
                onChange={(e) => set('indexacion', e.target.value as GestionGarantizadaForm['indexacion'])}
              >
                <option value="ipc">IPC</option>
                <option value="otros">Otros (fórmula)</option>
                <option value="none">Sin indexación</option>
              </select>
            </div>
            {form.indexacion === 'otros' ? (
              <div className={styles.field}>
                <label className={styles.label}>Fórmula / referencia</label>
                <input
                  className={styles.input}
                  value={form.indexacionFormula}
                  onChange={(e) => set('indexacionFormula', e.target.value)}
                  placeholder="p. ej. IPC + 1%"
                />
              </div>
            ) : (
              <div className={styles.field} aria-hidden="true" />
            )}

            <div className={`${styles.field} ${styles.full}`}>
              <CuentaCobroField
                cuentas={cuentas}
                value={form.cuentaCobroId}
                onChange={(id) => set('cuentaCobroId', id)}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className={styles.errorAlert}>
              {error}
            </div>
          )}

          <div className={styles.footer}>
            <span />
            <div className={styles.footerActions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={volver} disabled={guardando}>
                Atrás
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGold}`} onClick={onSubmit} disabled={guardando}>
                <Icons.Check size={14} strokeWidth={2} />
                {guardando ? 'Creando…' : 'Crear contrato de gestión'}
              </button>
            </div>
          </div>
        </div>

        <aside className={styles.aside}>
          <div className={styles.asideTitle}>Resumen</div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Renta garantizada</span>
            <span className={styles.asideVal}>{renta > 0 ? eur(renta) : '—'}</span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Renta anual</span>
            <span className={styles.asideVal}>{renta > 0 ? eur(renta * 12) : '—'}</span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Fianza</span>
            <span className={`${styles.asideVal} ${styles.muted}`}>{fianza > 0 ? eur(fianza) : '—'}</span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Indexación</span>
            <span className={`${styles.asideVal} ${styles.muted}`}>{INDEX_LABEL[form.indexacion]}</span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Plazo</span>
            <span className={`${styles.asideVal} ${styles.muted}`}>
              {form.fechaInicio || '—'} → {form.fechaFin || '—'}
            </span>
          </div>
          <div className={styles.asideRow}>
            <span className={styles.asideLab}>Agencia</span>
            <span className={`${styles.asideVal} ${styles.muted}`}>{form.agenciaNombre || '—'}</span>
          </div>
        </aside>
      </div>
    </>
  );
};

export default NuevoContratoGestionWizard;
