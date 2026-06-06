import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons, MoneyValue, Pill, showToastV5 } from '../../../../design-system/v5';
import type { PillVariant } from '../../../../design-system/v5';
import type { BoteAnualSinIdentificar, Contract } from '../../../../services/db';
import {
  boteAnualService,
  type SugerenciaVinculacion,
} from '../../../../services/boteAnualService';
import { contractDisplayName, getContractsMap } from '../../../../utils/contractDisplay';
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

// timeZone 'UTC' · las fechas de contrato son fechas-calendario ISO (YYYY-MM-DD).
// `new Date('2024-09-01')` es medianoche UTC; sin fijar la zona, en husos detrás
// de UTC se renderiza el día anterior ("ago 2024" en vez de "sept 2024"). Misma
// convención que formatFechaFinContrato.
const MES_AÑO = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * "feb 2023" a partir de una fecha ISO; cadena vacía si no parsea.
 * Construye el Date EXPLÍCITAMENTE en UTC desde la parte civil (YYYY-MM-DD) en
 * lugar de fiarse de `new Date(iso)` (parseo de date-only históricamente
 * inconsistente entre runtimes) · combinado con MES_AÑO en timeZone UTC, el
 * resultado es estable en cualquier huso.
 */
function formatMesAño(iso?: string): string {
  const m = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? '' : MES_AÑO.format(d).replace('.', '');
}

/** Línea de detalle de un contrato vinculado: "Hab 1 · feb 2023 - abr 2023 · vinculado manualmente". */
function metaVinculado(contract: Contract | undefined, origen: string): string {
  const partes: string[] = [];
  if (contract?.unidadTipo === 'habitacion' && contract.habitacionId) {
    partes.push(`Hab ${contract.habitacionId}`);
  }
  const desde = formatMesAño(contract?.fechaInicio);
  const hasta = formatMesAño(contract?.fechaFin);
  if (desde && hasta) partes.push(`${desde} - ${hasta}`);
  else if (desde) partes.push(desde);
  partes.push(origen === 'sugerencia_atlas' ? 'sugerido por Atlas' : 'vinculado manualmente');
  return partes.join(' · ');
}

type ResultadoBanner = { tono: 'pos' | 'neg'; titulo: string; cuerpo: string } | null;

/**
 * Drawer de conciliación de un bote (rentas declaradas AEAT sin contrato identificado).
 * Muestra los contratos ya vinculados (con nombre del inquilino y opción de desvincular) y
 * las sugerencias del servicio, con cabecera de totales y un botón para vincular todas.
 *
 * Toda la lógica de negocio vive en `boteAnualService`; este componente orquesta UI + refresco.
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
  const [vinculandoTodas, setVinculandoTodas] = useState(false);
  const [contractsVinculados, setContractsVinculados] = useState<Map<number, Contract>>(new Map());
  const [banner, setBanner] = useState<ResultadoBanner>(null);

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

  const vinculados = useMemo(() => bote.contractsVinculados ?? [], [bote.contractsVinculados]);

  // B2 · resolver los Contracts vinculados para mostrar nombre + detalle, no el id.
  useEffect(() => {
    let activo = true;
    if (vinculados.length === 0) {
      setContractsVinculados(new Map());
      return;
    }
    getContractsMap(vinculados.map((l) => l.contractId))
      .then((m) => {
        if (activo) setContractsVinculados(m);
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [vinculados]);

  /** Reacciona al estado del bote tras (des)vincular: banner + auto-cierre. */
  const procesarResultado = useCallback(
    (resultado: BoteAnualSinIdentificar): void => {
      if (resultado.estado === 'cerrado') {
        setBanner({
          tono: 'pos',
          titulo: 'Ingresos conciliados',
          cuerpo: 'Este año fiscal ha quedado completamente identificado.',
        });
        // Deja leer el banner y cierra; la lista lo oculta por el filtro de estado.
        window.setTimeout(() => onClose(), 1800);
      } else if (resultado.estado === 'sobre_asignado') {
        setBanner({
          tono: 'neg',
          titulo: 'Has asignado más que lo declarado',
          cuerpo: 'Revisa qué contrato quitar para cuadrar el ejercicio.',
        });
      } else {
        setBanner(null);
      }
    },
    [onClose],
  );

  const handleVincular = async (s: SugerenciaVinculacion): Promise<void> => {
    const importe = Number(importes[s.contractId]);
    if (!Number.isFinite(importe) || importe <= 0) {
      showToastV5('Indica un importe válido para vincular');
      return;
    }
    setGuardando(s.contractId);
    try {
      const r = await boteAnualService.vincularContract(bote.id, s.contractId, importe, 'manual_usuario');
      showToastV5('Contrato vinculado al ejercicio declarado');
      procesarResultado(r);
      onChange();
    } catch (err) {
      console.error('[DrawerConciliarBote] error vinculando', err);
      showToastV5('No se pudo vincular el contrato');
    } finally {
      setGuardando(null);
    }
  };

  // B3 / M1 · vincular todas las sugerencias con su importe actual, en bloque.
  const handleVincularTodas = async (): Promise<void> => {
    const vinculables = sugerencias
      .map((s) => ({ contractId: s.contractId, importe: Number(importes[s.contractId]) }))
      .filter((x) => Number.isFinite(x.importe) && x.importe > 0);
    if (vinculables.length === 0) {
      showToastV5('No hay sugerencias con un importe válido para vincular');
      return;
    }
    setVinculandoTodas(true);
    try {
      let ultimo: BoteAnualSinIdentificar | null = null;
      for (const v of vinculables) {
        ultimo = await boteAnualService.vincularContract(bote.id, v.contractId, v.importe, 'manual_usuario');
      }
      showToastV5(`${vinculables.length} contratos vinculados al ejercicio declarado`);
      if (ultimo) procesarResultado(ultimo);
      onChange();
    } catch (err) {
      console.error('[DrawerConciliarBote] error vinculando todas', err);
      showToastV5('No se pudieron vincular todas las sugerencias');
    } finally {
      setVinculandoTodas(false);
    }
  };

  const handleDesvincular = async (contractId: number): Promise<void> => {
    setGuardando(contractId);
    try {
      const r = await boteAnualService.desvincularContract(bote.id, contractId);
      showToastV5('Contrato desvinculado');
      procesarResultado(r);
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

  // B1 · total sugerido reactivo (recalcula al editar importes) y diferencia con el pendiente.
  const totalSugerido = useMemo(
    () =>
      sugerencias.reduce((acc, s) => {
        const n = Number(importes[s.contractId]);
        return acc + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [sugerencias, importes],
  );
  const diferencia = totalSugerido - bote.saldoPendiente;
  const diffNota =
    Math.abs(diferencia) < 0.005
      ? 'cuadra exacto'
      : diferencia < 0
        ? 'faltarían'
        : 'excederían';
  // cuadra → pos · faltan → neg · exceden → warn (sobre-asignaría)
  const diffTone: 'pos' | 'neg' | 'warn' =
    Math.abs(diferencia) < 0.005 ? 'pos' : diferencia < 0 ? 'neg' : 'warn';

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

      {banner && (
        <div className={`${styles.banner} ${banner.tono === 'pos' ? styles.bannerPos : styles.bannerNeg}`}>
          <span className={styles.bannerIcon}>
            {banner.tono === 'pos' ? <Icons.Success size={18} strokeWidth={1.8} /> : <Icons.Warning size={18} strokeWidth={1.8} />}
          </span>
          <span>
            <span className={styles.bannerTitle}>{banner.titulo}</span>
            <span className={styles.bannerBody}>{banner.cuerpo}</span>
          </span>
        </div>
      )}

      {vinculados.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Contratos vinculados</div>
          {vinculados.map((l) => {
            const c = contractsVinculados.get(l.contractId);
            return (
              <div className={styles.row} key={`v-${l.contractId}`}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{contractDisplayName(c, l.contractId)}</div>
                  <div className={styles.rowMeta}>{metaVinculado(c, l.origen)}</div>
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
            );
          })}
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
        <>
          <div className={styles.sugHeader}>
            <div className={styles.sugTotalRow}>
              <span className={styles.sugTotalLabel}>Total sugerido</span>
              <span className={styles.sugTotalValue}>
                <MoneyValue value={totalSugerido} decimals={0} tone="ink" />
              </span>
            </div>
            <div className={styles.sugTotalRow}>
              <span className={styles.sugTotalLabel}>Diferencia con pendiente</span>
              <span>
                <MoneyValue value={diferencia} decimals={0} showSign tone={diffTone} />
                <span className={styles.sugDiffNote}>{diffNota}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            className={styles.btnVincularTodas}
            onClick={handleVincularTodas}
            disabled={vinculandoTodas || guardando != null}
          >
            {vinculandoTodas ? 'Vinculando…' : 'Vincular todas las sugerencias'}
          </button>

          {sugerencias.map((s) => (
            <div className={styles.row} key={`s-${s.contractId}`}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{contractDisplayName(s.contract, s.contractId)}</div>
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
                  disabled={guardando === s.contractId || vinculandoTodas}
                >
                  Vincular
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </ContratosDrawer>
  );
};

export default DrawerConciliarBote;
export { DrawerConciliarBote };
