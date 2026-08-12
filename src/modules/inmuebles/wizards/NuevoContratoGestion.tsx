// Gestión delegada · renta garantizada · alta del CONTRATO DE GESTIÓN (padre).
// Formulario de una pantalla (NO el wizard LAU de 5 pasos): un contrato de
// gestión es más simple (contraparte = agencia, sin inquilino LAU, sin fianza,
// NO-LAU). Ver docs/DISENO-gestion-delegada-agencias-V1.md.

import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { PageHead, showToastV5 } from '../../../design-system/v5';
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
import styles from './NuevoContratoGestion.module.css';

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

const NuevoContratoGestion: React.FC = () => {
  const navigate = useNavigate();
  const { properties } = useOutletContext<InmueblesOutletContext>();
  const cuentas = useCuentasCobro();

  const [form, setForm] = useState<GestionGarantizadaForm>({
    inmuebleId: null,
    agenciaNombre: '',
    agenciaNif: '',
    rentaGarantizada: '',
    indexacion: 'ipc',
    fechaInicio: hoyISO(),
    fechaFin: '',
    diaPago: '1',
    cuentaCobroId: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof GestionGarantizadaForm>(k: K, v: GestionGarantizadaForm[K]): void =>
    setForm((f) => ({ ...f, [k]: v }));

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

  return (
    <>
      <PageHead
        breadcrumb={[
          { label: 'Alquileres', onClick: () => navigate('/contratos') },
          { label: 'Renta garantizada' },
        ]}
        onBack={() => navigate('/contratos')}
        title="Nuevo contrato · renta garantizada"
        sub="gestión delegada · la agencia te paga una renta fija mensual (no LAU)"
      />

      <div className={styles.form}>
        {error && (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Inmueble</span>
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
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Agencia</span>
            <input
              className={styles.input}
              value={form.agenciaNombre}
              onChange={(e) => set('agenciaNombre', e.target.value)}
              placeholder="Nombre de la agencia"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>NIF / CIF</span>
            <input
              className={styles.input}
              value={form.agenciaNif}
              onChange={(e) => set('agenciaNif', e.target.value)}
              placeholder="B12345678"
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Renta garantizada (€/mes)</span>
            <input
              className={styles.input}
              type="number"
              inputMode="decimal"
              min={0}
              value={form.rentaGarantizada}
              onChange={(e) => set('rentaGarantizada', e.target.value)}
              placeholder="1350"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Día de cobro</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={31}
              value={form.diaPago}
              onChange={(e) => set('diaPago', e.target.value)}
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Inicio</span>
            <input
              className={styles.input}
              type="date"
              value={form.fechaInicio}
              onChange={(e) => set('fechaInicio', e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Fin (plazo pactado)</span>
            <input
              className={styles.input}
              type="date"
              value={form.fechaFin}
              onChange={(e) => set('fechaFin', e.target.value)}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Indexación</span>
          <select
            className={styles.select}
            value={form.indexacion}
            onChange={(e) => set('indexacion', e.target.value as GestionGarantizadaForm['indexacion'])}
          >
            <option value="ipc">IPC</option>
            <option value="irav">IRAV</option>
            <option value="none">Sin indexación</option>
          </select>
        </label>

        <CuentaCobroField
          cuentas={cuentas}
          value={form.cuentaCobroId}
          onChange={(id) => set('cuentaCobroId', id)}
        />

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => navigate('/contratos')}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button type="button" className={styles.primary} onClick={onSubmit} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear contrato de gestión'}
          </button>
        </div>
      </div>
    </>
  );
};

export default NuevoContratoGestion;
