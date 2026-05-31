import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MoneyValue, Pill, showToastV5 } from '../../../../design-system/v5';
import type { PillVariant } from '../../../../design-system/v5';
import type { BoteAnualSinIdentificar } from '../../../../services/db';
import {
  boteAnualService,
  type SugerenciaVinculacion,
} from '../../../../services/boteAnualService';
import ContratosDrawer from './ContratosDrawer';
import styles from './PorConciliar.module.css';

export interface DrawerConciliarBoteProps {
  bote: BoteAnualSinIdentificar & { id: number };
  inmuebleAlias?: string;
  open: boolean;
  onClose: () => void;
  /** Se invoca tras vincular/desvincular para refrescar la lista del tab. */
  onChange: () => void;
}

/** Mapea el estado del bote a una variante de Pill del design-system. */
const ESTADO_PILL: Record<BoteAnualSinIdentificar['estado'], { variant: PillVariant; label: string }> = {
  pendiente_total: { variant: 'neg', label: 'Pendiente' },
  parcial: { variant: 'warn', label: 'Parcial' },
  cerrado: { variant: 'pos', label: 'Conciliado' },
  sobre_asignado: { variant: 'gold', label: 'Sobre-asignado' },
};

/**
 * Drawer de conciliación de un bote (rentas declaradas AEAT sin contrato identificado).
 * Muestra los contratos ya vinculados (con opción de desvincular) y las sugerencias del
 * servicio (`sugerirContracts`), permitiendo vincular con un importe editable.
 *
 * Toda la lógica vive en `boteAnualService`; este componente solo orquesta UI + refresco.
 */
const DrawerConciliarBote: React.FC<DrawerConciliarBoteProps> = ({
  bote,
  inmuebleAlias,
  open,
  onClose,
  onChange,
}) => {
  const [sugerencias, setSugerencias] = useState<SugerenciaVinculacion[]>([]);
  const [importes, setImportes] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);

  const cargarSugerencias = useCallback(async () => {
    setCargando(true);
    try {
      const sugs = await boteAnualService.sugerirContracts(bote.id);
      setSugerencias(sugs);
      setImportes((prev) => {
        const next = { ...prev };
        for (const s of sugs) {
          if (next[s.contractId] === undefined) {
            next[s.contractId] = s.importeSugerido.toFixed(2);
          }
        }
        return next;
      });
    } catch (err) {
      console.error('[DrawerConciliarBote] error cargando sugerencias', err);
    } finally {
      setCargando(false);
    }
  }, [bote.id]);

  useEffect(() => {
    if (open) cargarSugerencias();
  }, [open, cargarSugerencias]);

  const vinculados = bote.contractsVinculados ?? [];

  const handleVincular = async (s: SugerenciaVinculacion): Promise<void> => {
    const importe = Number(importes[s.contractId]);
    if (!Number.isFinite(importe) || importe <= 0) {
      showToastV5('Indica un importe válido para vincular');
      return;
    }
    setGuardando(s.contractId);
    try {
      await boteAnualService.vincularContract(bote.id, s.contractId, importe, 'manual_usuario');
      showToastV5('Contrato vinculado al ejercicio declarado');
      onChange();
    } catch (err) {
      console.error('[DrawerConciliarBote] error vinculando', err);
      showToastV5('No se pudo vincular el contrato');
    } finally {
      setGuardando(null);
    }
  };

  const handleDesvincular = async (contractId: number): Promise<void> => {
    setGuardando(contractId);
    try {
      await boteAnualService.desvincularContract(bote.id, contractId);
      showToastV5('Contrato desvinculado');
      onChange();
    } catch (err) {
      console.error('[DrawerConciliarBote] error desvinculando', err);
      showToastV5('No se pudo desvincular el contrato');
    } finally {
      setGuardando(null);
    }
  };

  const estadoPill = ESTADO_PILL[bote.estado];

  const stats = useMemo(
    () => [
      { label: 'Declarado', value: <MoneyValue value={bote.importeDeclarado} decimals={0} tone="ink" /> },
      { label: 'Asignado', value: <MoneyValue value={bote.importeAsignado} decimals={0} tone="ink" /> },
      { label: 'Pendiente', value: <MoneyValue value={bote.saldoPendiente} decimals={0} tone={bote.saldoPendiente > 0 ? 'neg' : 'pos'} /> },
    ],
    [bote.importeDeclarado, bote.importeAsignado, bote.saldoPendiente],
  );

  return (
    <ContratosDrawer
      open={open}
      onClose={onClose}
      tone={bote.saldoPendiente > 0 ? 'neg' : 'muted'}
      label={`Por conciliar · ${bote.año}`}
      title={inmuebleAlias ?? `Inmueble ${bote.inmuebleId}`}
      sub="Rentas declaradas en la AEAT para este ejercicio que aún no están asociadas a un contrato. Vincula los contratos reales que las cubren."
      stats={stats}
    >
      <div style={{ marginBottom: 4 }}>
        <Pill variant={estadoPill.variant}>{estadoPill.label}</Pill>
        {bote.nifsDetectados.length > 0 && (
          <span className={styles.rowMeta} style={{ marginLeft: 10 }}>
            NIF declarados: {bote.nifsDetectados.join(' · ')}
          </span>
        )}
      </div>

      {vinculados.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Contratos vinculados</div>
          {vinculados.map((l) => (
            <div className={styles.row} key={`v-${l.contractId}`}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>Contrato #{l.contractId}</div>
                <div className={styles.rowMeta}>
                  {l.origen === 'sugerencia_atlas' ? 'Sugerido por Atlas' : 'Vinculado manualmente'}
                </div>
              </div>
              <div className={styles.rowRight}>
                <MoneyValue value={l.importeAsignado} decimals={0} tone="ink" />
                <button
                  type="button"
                  className={styles.btnUnlink}
                  onClick={() => handleDesvincular(l.contractId)}
                  disabled={guardando === l.contractId}
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className={styles.sectionTitle}>Sugerencias</div>
      {cargando ? (
        <div className={styles.emptyHint}>Buscando contratos compatibles…</div>
      ) : sugerencias.length === 0 ? (
        <div className={styles.emptyHint}>
          No hay contratos del inmueble que solapen con {bote.año} sin vincular.
        </div>
      ) : (
        sugerencias.map((s) => (
          <div className={styles.row} key={`s-${s.contractId}`}>
            <div className={styles.rowMain}>
              <div className={styles.rowTitle}>
                {`${s.contract.inquilino?.nombre ?? ''} ${s.contract.inquilino?.apellidos ?? ''}`.trim() ||
                  s.contract.inquilino?.dni ||
                  `Contrato #${s.contractId}`}
              </div>
              <div className={styles.rowMeta}>
                {s.nifCoincide && <Pill variant="pos">NIF coincide</Pill>} {s.motivos.join(' · ')}
              </div>
            </div>
            <div className={styles.rowRight}>
              <input
                className={styles.importeInput}
                type="number"
                min={0}
                step="0.01"
                value={importes[s.contractId] ?? ''}
                onChange={(e) =>
                  setImportes((prev) => ({ ...prev, [s.contractId]: e.target.value }))
                }
                aria-label={`Importe a vincular del contrato ${s.contractId}`}
              />
              <button
                type="button"
                className={styles.btnLink}
                onClick={() => handleVincular(s)}
                disabled={guardando === s.contractId}
              >
                Vincular
              </button>
            </div>
          </div>
        ))
      )}
    </ContratosDrawer>
  );
};

export default DrawerConciliarBote;
export { DrawerConciliarBote };
