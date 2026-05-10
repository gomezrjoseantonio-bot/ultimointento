// T23.1+T23.2 · <InversionesGaleria>.
//
// Galería 3 columnas con cartas heterogéneas (visualización contextual por
// tipo · § Z spec) + entry-point colapsable a "Posiciones cerradas" con
// narrativa de inversor (§ 5.2 spec · prohibido lenguaje fiscal).
//
// T23.2 conecta el wizard `<WizardNuevaPosicion>` (3 caminos) y el
// `<DialogAportar>` (selector posición + form aportación) con los botones
// del page-head. La sub-página de cerradas y la ficha detalle individual
// se construyen en 23.3 y 23.4 · de momento son placeholders con TODO claro.
//
// T23.6.1 · fuente unificada (inversiones + planesPensiones) via getAllCartaItems().
// T23.6.2 · CintaResumenInversiones sticky + CartaPosicion acepta CartaItem directamente.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, PageHead, showToastV5 } from '../../design-system/v5';
import { inversionesService } from '../../services/inversionesService';
import { rendimientosService } from '../../services/rendimientosService';
import { migrateInversionesToNewModel } from '../../services/migrations/migrateInversiones';
import type { Aportacion, PosicionInversion } from '../../types/inversiones';
import CartaPosicion from './components/CartaPosicion';
import CartaAddPosicion from './components/CartaAddPosicion';
import WizardNuevaPosicion from './components/WizardNuevaPosicion';
import DialogAportar from './components/DialogAportar';
import {
  calcularKpisCerradas,
  getPosicionesCerradas,
  type KpisCerradas,
} from './adapters/posicionesCerradas';
import { getAllCartaItems } from './adapters/galeriaAdapter';
import type { CartaItem } from './types/cartaItem';
import {
  formatCurrency,
  formatDelta,
  signClass,
} from './helpers';
import styles from './InversionesGaleria.module.css';

const InversionesGaleria: React.FC = () => {
  const navigate = useNavigate();
  // T23.6.1 · galería unificada · fuente: ambos stores (inversiones + planesPensiones)
  const [cartaItems, setCartaItems] = useState<CartaItem[]>([]);
  const [resumenCerradas, setResumenCerradas] = useState<KpisCerradas>(() =>
    calcularKpisCerradas([]),
  );
  const [loading, setLoading] = useState(true);

  const [showWizard, setShowWizard] = useState(false);
  const [showAportar, setShowAportar] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Posiciones activas unificadas (inversiones + planesPensiones · dedup · ordenadas)
      const [items, cerradas] = await Promise.all([
        getAllCartaItems(),
        getPosicionesCerradas().catch(() => []),
      ]);
      setCartaItems(items);
      setResumenCerradas(calcularKpisCerradas(cerradas));
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
      // getAllCartaItems() ya devuelve items activos ordenados por valor_actual descendente
      cartaItems,
    [cartaItems],
  );

  // Posiciones nativas de inversiones (para DialogAportar · solo acepta PosicionInversion)
  const posicionesParaAportar = useMemo(
    () =>
      cartaItems
        .filter((item) => item._origen === 'inversiones')
        .map((item) => item._original as PosicionInversion),
    [cartaItems],
  );

  const handleClickCarta = (item: CartaItem) => {
    navigate(`/inversiones/${item._idOriginal}`);
  };

  const openWizardNueva = () => setShowWizard(true);

  const openAportar = () => {
    if (posicionesParaAportar.length === 0) {
      showToastV5('Aún no tienes posiciones activas. Crea una con "Nueva posición".');
      return;
    }
    setShowAportar(true);
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
      await rendimientosService.generarRendimientosPendientes();
      await load();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] save', err);
      showToastV5('Error al guardar la posición.');
      // Relanzar para que el wizard mantenga el form abierto · el usuario
      // no pierde lo que llevaba escrito si el service falla.
      throw err;
    }
  };

  const handleSaveAportacion = async (
    posicion: PosicionInversion,
    aportacion: Omit<Aportacion, 'id'>,
  ) => {
    try {
      await inversionesService.addAportacion(posicion.id, aportacion);
      showToastV5('Aportación añadida.');
      setShowAportar(false);
      await load();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] aportacion', err);
      showToastV5('Error al guardar la aportación.');
    }
  };

  return (
    <div className={styles.page}>
      {/* CintaResumenInversiones se monta desde MainLayout · ocupa el slot
          del TopbarV5 global en /inversiones/* (mockup atlas-inversiones-v2). */}
      <PageHead
        title="Inversiones"
        sub="tus posiciones activas · click en cualquier carta para ver su detalle"
        actions={[
          {
            label: 'Aportar',
            variant: 'ghost',
            icon: <Icons.Plus size={14} strokeWidth={1.8} />,
            onClick: openAportar,
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
            {/* T23.6.2 · CartaPosicion ya acepta CartaItem directamente */}
            {activas.map((item) => (
              <CartaPosicion
                key={String(item._idOriginal)}
                item={item}
                onClick={handleClickCarta}
              />
            ))}
            <CartaAddPosicion onClick={openWizardNueva} />
          </div>

          {resumenCerradas.count > 0 && (
            <>
              <div className={styles.galleryHd}>
                <div className={styles.galleryTitle}>Histórico fiscal</div>
                <div className={styles.galleryCount}>
                  {resumenCerradas.rangoAnios
                    ? `desde XML IRPF · ${resumenCerradas.rangoAnios}`
                    : 'desde XML IRPF'}
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
                      <span className={styles.cerradasTitle}>Posiciones cerradas</span>
                      <span className={styles.cerradasCount}>
                        {resumenCerradas.count}{' '}
                        {resumenCerradas.count === 1 ? 'operación' : 'operaciones'}
                      </span>
                    </div>
                    <div className={styles.cerradasSub}>
                      importadas desde declaraciones IRPF · ganancia/pérdida patrimonial declarada
                    </div>
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
                    <span className={styles.cerradasTotalLab}>
                      {resumenCerradas.resultadoNeto >= 0
                        ? 'ganancia neta declarada'
                        : 'pérdida neta declarada'}
                    </span>
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
        <WizardNuevaPosicion
          onSavePosicion={handleSavePosicion}
          onPlanSaved={load}
          onClose={() => setShowWizard(false)}
        />
      )}

      {showAportar && (
        <DialogAportar
          posiciones={posicionesParaAportar}
          onSave={handleSaveAportacion}
          onClose={() => setShowAportar(false)}
        />
      )}
    </div>
  );
};

export default InversionesGaleria;
