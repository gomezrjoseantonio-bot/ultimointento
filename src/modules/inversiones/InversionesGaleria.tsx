// T23.1 · <InversionesGaleria> · sustituye `InversionesPage` (4 tabs).
//
// Galería 3 columnas con cartas heterogéneas (visualización contextual por
// tipo · § Z spec) + entry-point colapsable a "Posiciones cerradas" con
// narrativa de inversor (§ 5.2 spec · prohibido lenguaje fiscal).
//
// El wizard `[+ Nueva posición]` se construye en 23.2; aquí abre el
// `PosicionFormDialog` directo como puente. La sub-página de cerradas y la
// ficha detalle individual se construyen en 23.3 y 23.4 · de momento son
// placeholders con TODO claro.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, PageHead, showToastV5 } from '../../design-system/v5';
import { inversionesService } from '../../services/inversionesService';
import { rendimientosService } from '../../services/rendimientosService';
import { migrateInversionesToNewModel } from '../../services/migrations/migrateInversiones';
import type { Aportacion, PosicionInversion } from '../../types/inversiones';
import CartaPosicion from './components/CartaPosicion';
import CartaAddPosicion from './components/CartaAddPosicion';
import PosicionFormDialog from './components/PosicionFormDialog';
import AportacionFormDialog from './components/AportacionFormDialog';
import {
  esCerrada,
  formatCurrency,
  formatDelta,
  rangoAnios,
  signClass,
} from './helpers';
import styles from './InversionesGaleria.module.css';

type ResumenCerradas = {
  count: number;
  resultadoNeto: number;
  rango: string;
};

const SelectorPosicionDialog: React.FC<{
  posiciones: PosicionInversion[];
  onSelect: (p: PosicionInversion) => void;
  onClose: () => void;
}> = ({ posiciones, onSelect, onClose }) => {
  const [selectedId, setSelectedId] = useState<number | null>(
    posiciones[0]?.id ?? null,
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12, 18, 48, 0.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="selector-posicion-title"
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--atlas-v5-card)',
          border: '1px solid var(--atlas-v5-line)',
          borderRadius: 'var(--atlas-v5-radius-lg)',
          padding: '22px',
          minWidth: 360,
          maxWidth: 480,
          boxShadow: 'var(--atlas-v5-shadow-modal)',
          fontFamily: 'var(--atlas-v5-font-ui)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="selector-posicion-title"
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--atlas-v5-ink)',
            marginBottom: '14px',
          }}
        >
          ¿A qué posición quieres aportar?
        </h2>
        {posiciones.length === 0 ? (
          <div style={{ color: 'var(--atlas-v5-ink-4)', fontSize: 13 }}>
            No tienes posiciones activas. Crea una con "Nueva posición".
          </div>
        ) : (
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--atlas-v5-radius-md)',
              border: '1px solid var(--atlas-v5-line)',
              background: 'var(--atlas-v5-card)',
              color: 'var(--atlas-v5-ink)',
              fontFamily: 'inherit',
              fontSize: 13,
            }}
          >
            {posiciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre || p.entidad || `Posición #${p.id}`}
              </option>
            ))}
          </select>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--atlas-v5-line)',
              background: 'var(--atlas-v5-card)',
              color: 'var(--atlas-v5-ink-2)',
              borderRadius: 'var(--atlas-v5-radius-sm)',
              fontFamily: 'inherit',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedId || posiciones.length === 0}
            onClick={() => {
              const sel = posiciones.find((p) => p.id === selectedId);
              if (sel) onSelect(sel);
            }}
            style={{
              padding: '8px 14px',
              border: 'none',
              background:
                'linear-gradient(135deg, var(--atlas-v5-gold-2), var(--atlas-v5-gold))',
              color: 'var(--atlas-v5-white)',
              borderRadius: 'var(--atlas-v5-radius-sm)',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedId ? 'pointer' : 'not-allowed',
              opacity: selectedId ? 1 : 0.5,
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

const InversionesGaleria: React.FC = () => {
  const navigate = useNavigate();
  const [posiciones, setPosiciones] = useState<PosicionInversion[]>([]);
  const [posicionesCerradasStore, setPosicionesCerradasStore] = useState<
    PosicionInversion[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [showWizard, setShowWizard] = useState(false);
  const [showSelectorAportar, setShowSelectorAportar] = useState(false);
  const [posicionParaAportar, setPosicionParaAportar] = useState<
    PosicionInversion | null
  >(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { activas, cerradas } = await inversionesService.getAllPosiciones();
      setPosiciones(activas);
      setPosicionesCerradasStore(cerradas);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] error cargando datos', err);
      showToastV5('Error al cargar las inversiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await migrateInversionesToNewModel();
        await rendimientosService.generarRendimientosPendientes();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[inversiones] init', err);
      }
      if (!cancelled) await load();
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const activas = useMemo(
    () =>
      posiciones
        .filter((p) => !esCerrada(p))
        .slice()
        .sort((a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0)),
    [posiciones],
  );

  /**
   * Resumen de "Posiciones cerradas" para el entry-point colapsable de la
   * galería. En 23.1 solo usamos las posiciones del store con `activo=false`
   * (suelen ser 0 para el usuario actual). El adaptador 23.4 expandirá esto
   * con las ventas reales del XML AEAT manteniendo narrativa inversor.
   */
  const resumenCerradas: ResumenCerradas = useMemo(() => {
    const list = posicionesCerradasStore;
    const resultadoNeto = list.reduce(
      (sum, p) => sum + Number(p.rentabilidad_euros ?? 0),
      0,
    );
    const fechas = list
      .flatMap((p) => [
        p.fecha_compra ?? null,
        p.plan_liquidacion?.fecha_estimada ?? null,
        p.fecha_valoracion ?? null,
      ])
      .filter((f): f is string => Boolean(f));
    return {
      count: list.length,
      resultadoNeto,
      rango: rangoAnios(fechas),
    };
  }, [posicionesCerradasStore]);

  const handleClickCarta = (id: number) => {
    navigate(`/inversiones/${id}`);
  };

  const openWizardNueva = () => setShowWizard(true);

  const openSelectorAportar = () => {
    if (activas.length === 0) {
      showToastV5('Aún no tienes posiciones activas. Crea una con "Nueva posición".');
      return;
    }
    setShowSelectorAportar(true);
  };

  const handleSavePosicion = async (
    data: Partial<PosicionInversion> & { importe_inicial?: number },
  ) => {
    try {
      await inversionesService.createPosicion(
        data as Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'> & {
          importe_inicial?: number;
        },
      );
      showToastV5('Posición creada.');
      setShowWizard(false);
      await rendimientosService.generarRendimientosPendientes();
      await load();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] save', err);
      showToastV5('Error al guardar la posición.');
    }
  };

  const handleSaveAportacion = async (aportacion: Omit<Aportacion, 'id'>) => {
    if (!posicionParaAportar) return;
    try {
      await inversionesService.addAportacion(posicionParaAportar.id, aportacion);
      showToastV5('Aportación añadida.');
      setPosicionParaAportar(null);
      await load();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] aportacion', err);
      showToastV5('Error al guardar la aportación.');
    }
  };

  return (
    <div className={styles.page}>
      <PageHead
        title="Inversiones"
        sub="tus posiciones activas · click en cualquier carta para ver su detalle"
        actions={[
          {
            label: 'Aportar',
            variant: 'ghost',
            icon: <Icons.Plus size={14} strokeWidth={1.8} />,
            onClick: openSelectorAportar,
          },
          {
            label: 'Nueva posición',
            variant: 'gold',
            icon: <Icons.PlusSquare size={14} strokeWidth={1.8} />,
            onClick: openWizardNueva,
          },
        ]}
      />

      {loading ? (
        <div className={styles.loading}>Cargando inversiones…</div>
      ) : (
        <>
          <div className={styles.galleryHd}>
            <div className={styles.galleryTitle}>Posiciones activas</div>
            <div className={styles.galleryCount}>
              {activas.length} {activas.length === 1 ? 'activa' : 'activas'} · ordenadas por valor
            </div>
          </div>

          <div className={styles.galleryGrid}>
            {activas.map((p) => (
              <CartaPosicion key={p.id} posicion={p} onClick={handleClickCarta} />
            ))}
            <CartaAddPosicion onClick={openWizardNueva} />
          </div>

          {resumenCerradas.count > 0 && (
            <>
              <div className={styles.galleryHd}>
                <div className={styles.galleryTitle}>Posiciones cerradas</div>
                <div className={styles.galleryCount}>
                  {resumenCerradas.count} {resumenCerradas.count === 1 ? 'posición' : 'posiciones'}
                  {resumenCerradas.rango ? ` · ${resumenCerradas.rango}` : ''}
                </div>
              </div>
              <button
                type="button"
                className={styles.cerradasSec}
                onClick={() => navigate('/inversiones/cerradas')}
                aria-label="Ver posiciones cerradas"
              >
                <div className={styles.cerradasSecLeft}>
                  <div className={styles.cerradasIcon}>
                    <Icons.Fondos size={18} strokeWidth={1.8} />
                  </div>
                  <div className={styles.cerradasTextos}>
                    <div className={styles.cerradasTitleRow}>
                      <span className={styles.cerradasTitle}>Lo que ya cerraste</span>
                      <span className={styles.cerradasCount}>
                        {resumenCerradas.count}{' '}
                        {resumenCerradas.count === 1 ? 'posición' : 'posiciones'}
                      </span>
                    </div>
                    <div className={styles.cerradasSub}>tu trayectoria como inversor</div>
                  </div>
                </div>
                <div className={styles.cerradasRight}>
                  <div className={styles.cerradasTotal}>
                    <span
                      className={`${styles.cerradasTotalVal} ${styles[signClass(resumenCerradas.resultadoNeto)]}`}
                    >
                      {Math.abs(resumenCerradas.resultadoNeto) < 0.005
                        ? formatCurrency(0)
                        : formatDelta(resumenCerradas.resultadoNeto)}
                    </span>
                    <span className={styles.cerradasTotalLab}>resultado neto histórico</span>
                  </div>
                  <span className={styles.cerradasArrow} aria-hidden>
                    <Icons.ChevronRight size={16} strokeWidth={2} />
                  </span>
                </div>
              </button>
            </>
          )}
        </>
      )}

      {showWizard && (
        <PosicionFormDialog
          onSave={handleSavePosicion}
          onClose={() => setShowWizard(false)}
        />
      )}

      {showSelectorAportar && (
        <SelectorPosicionDialog
          posiciones={activas}
          onSelect={(p) => {
            setShowSelectorAportar(false);
            setPosicionParaAportar(p);
          }}
          onClose={() => setShowSelectorAportar(false)}
        />
      )}

      {posicionParaAportar && (
        <AportacionFormDialog
          posicionNombre={
            posicionParaAportar.nombre ||
            posicionParaAportar.entidad ||
            `Posición #${posicionParaAportar.id}`
          }
          posicion={posicionParaAportar}
          onSave={handleSaveAportacion}
          onClose={() => setPosicionParaAportar(null)}
        />
      )}
    </div>
  );
};

export default InversionesGaleria;
