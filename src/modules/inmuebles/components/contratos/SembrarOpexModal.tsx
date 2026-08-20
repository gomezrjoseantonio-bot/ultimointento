import React, { useEffect, useMemo, useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { Account, ModoExplotacionAlquiler } from '../../../../services/db';
import { cuentasService } from '../../../../services/cuentasService';
import { cuentaParaElMetodo } from '../../../../services/cuentasPorMetodoPago';
import type { ConceptoInmuebleRef } from '../../wizards/utils/catalogoModalidadInmueble';
import {
  type Periodicidad,
  type FilaSemilla,
  conceptosASembrar,
  etiquetaConcepto,
  periodicidadPorDefecto,
  sembrarOpex,
} from '../../utils/sembrarOpexInmueble';
import styles from './SembrarOpexModal.module.css';

export interface SembrarOpexModalProps {
  inmuebleId: number;
  inmuebleAlias?: string;
  modo: ModoExplotacionAlquiler;
  cuentaCobroPorDefectoId?: number;
  onClose: () => void;
  onSembrado?: () => void;
}

interface FilaEstado {
  ref: ConceptoInmuebleRef;
  marcado: boolean;
  importe: string;
  periodicidad: Periodicidad;
  cuentaId: number | null;
}

const PERIODICIDADES: Periodicidad[] = ['mensual', 'trimestral', 'anual'];
const PERIODICIDAD_LABEL: Record<Periodicidad, string> = {
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  anual: 'Anual',
};

function etiquetaCuenta(a: Account): string {
  return a.alias || a.banco?.name || a.ibanMasked || a.iban || `Cuenta ${a.id}`;
}

const SembrarOpexModal: React.FC<SembrarOpexModalProps> = ({
  inmuebleId,
  inmuebleAlias,
  modo,
  cuentaCobroPorDefectoId,
  onClose,
  onSembrado,
}) => {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filas, setFilas] = useState<FilaEstado[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [cuentas, refs] = await Promise.all([
        cuentasService.list(),
        conceptosASembrar(inmuebleId, modo),
      ]);
      if (!vivo) return;
      const porDefecto =
        cuentaCobroPorDefectoId ?? cuentaParaElMetodo('domiciliacion', cuentas) ?? cuentas[0]?.id ?? null;
      setAccounts(cuentas);
      setFilas(
        refs.map((ref) => ({
          ref,
          marcado: true,
          importe: '',
          periodicidad: periodicidadPorDefecto(ref),
          cuentaId: porDefecto,
        })),
      );
      setCargando(false);
    })().catch(() => {
      if (vivo) setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [inmuebleId, modo, cuentaCobroPorDefectoId]);

  const marcadas = useMemo(() => filas.filter((f) => f.marcado).length, [filas]);

  const actualizar = (i: number, patch: Partial<FilaEstado>) =>
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const sembrar = async () => {
    const aCrear: FilaSemilla[] = filas
      .filter((f) => f.marcado && f.cuentaId != null)
      .map((f) => ({
        ref: f.ref,
        importe: Math.max(0, Number(f.importe.replace(',', '.')) || 0),
        periodicidad: f.periodicidad,
        cuentaCargo: f.cuentaId as number,
      }));
    if (aCrear.length === 0) return;
    setGuardando(true);
    try {
      const fechaInicio = new Date().toISOString().slice(0, 10);
      const r = await sembrarOpex(inmuebleId, aCrear, fechaInicio);
      showToastV5(
        `${r.creados} gasto(s) sembrado(s)${r.activos > 0 ? ` · ${r.activos} con previsión` : ''}`,
        'success',
      );
      onSembrado?.();
      onClose();
    } catch (e) {
      showToastV5('No se pudieron sembrar los gastos', 'error');
      setGuardando(false);
    }
  };

  const sinCuentas = !cargando && accounts.length === 0;
  const nadaQueSembrar = !cargando && accounts.length > 0 && filas.length === 0;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Sembrar gastos">
      <div className={styles.modal}>
        <div className={styles.head}>
          <div>
            <div className={styles.title}>Sembrar gastos del alquiler</div>
            <div className={styles.sub}>
              {inmuebleAlias ? `${inmuebleAlias} · ` : ''}
              Marca los que tengas, pon importe y cuenta. Lo que dejes sin importe queda
              «preparado» y no genera previsión hasta que lo completes.
            </div>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar">
            <Icons.Close size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {cargando && <div className={styles.muted}>Cargando sugerencias…</div>}
          {sinCuentas && (
            <div className={styles.muted}>
              Añade una cuenta bancaria en Cuentas antes de sembrar gastos.
            </div>
          )}
          {nadaQueSembrar && (
            <div className={styles.muted}>
              Ya tienes dados de alta los gastos sugeridos para esta modalidad.
            </div>
          )}
          {!cargando && filas.length > 0 && (
            <div className={styles.tabla} role="table">
              <div className={`${styles.fila} ${styles.filaHead}`} role="row">
                <span />
                <span>Concepto</span>
                <span>Importe (€)</span>
                <span>Periodicidad</span>
                <span>Cuenta de cargo</span>
              </div>
              {filas.map((f, i) => (
                <div className={styles.fila} role="row" key={`${f.ref.tipoId}:${f.ref.subtipoId}`}>
                  <input
                    type="checkbox"
                    checked={f.marcado}
                    onChange={(e) => actualizar(i, { marcado: e.target.checked })}
                    aria-label={`Sembrar ${etiquetaConcepto(f.ref)}`}
                  />
                  <span className={styles.concepto}>{etiquetaConcepto(f.ref)}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    className={styles.importe}
                    value={f.importe}
                    disabled={!f.marcado}
                    placeholder="0"
                    onChange={(e) => actualizar(i, { importe: e.target.value })}
                  />
                  <select
                    className={styles.select}
                    value={f.periodicidad}
                    disabled={!f.marcado}
                    onChange={(e) => actualizar(i, { periodicidad: e.target.value as Periodicidad })}
                  >
                    {PERIODICIDADES.map((p) => (
                      <option key={p} value={p}>
                        {PERIODICIDAD_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    value={f.cuentaId ?? ''}
                    disabled={!f.marcado}
                    onChange={(e) => actualizar(i, { cuentaId: Number(e.target.value) })}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {etiquetaCuenta(a)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={sembrar}
            disabled={guardando || cargando || marcadas === 0}
          >
            {guardando ? 'Sembrando…' : `Sembrar ${marcadas || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SembrarOpexModal;
export { SembrarOpexModal };
