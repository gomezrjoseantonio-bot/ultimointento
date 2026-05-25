// T-INVERSIONES-V5 PR 2 · galería rediseñada · filtros + tags + selector 6 familias.
//
// Cambios respecto a la versión T23 v4:
//   - Eliminada card "Añadir posición" del grid (§5.1) · queda solo el
//     botón "Nueva posición" en el page-head.
//   - Filtros por categoría · pills horizontales (§5.1).
//   - Sección "Posiciones cerradas" sustituye a "Histórico fiscal" (§5.4).
//   - Selector "Nueva posición" reducido a 6 familias (§5.2) · NO 12 tipos.
//     Cada familia dispatcha al wizard legacy (PlanFormV5 / PosicionFormV5)
//     con tipo preseleccionado · PR 3 reemplaza por modales de alta dedicados.
//
// Reglas inviolables · PR 2 NO toca servicios ni stores. Wizard legacy se
// retira completamente en PR 3 (cuando los nuevos modales estén). Mientras,
// CartaAddPosicion · WizardNuevaPosicion · etc. siguen vivos pero sin uso.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, PageHead, showToastV5 } from '../../design-system/v5';
import { EmptyState } from '../../components/common/EmptyState';
import { TrendingUp } from 'lucide-react';
import { inversionesService } from '../../services/inversionesService';
import { rendimientosService } from '../../services/rendimientosService';
import { migrateInversionesToNewModel } from '../../services/migrations/migrateInversiones';
import type { Aportacion, PosicionInversion } from '../../types/inversiones';
import CartaPosicion from './components/CartaPosicion';
import AportarModal from './components/modal/AportarModal';
import SelectorNuevaPosicion, { type Familia } from './components/modal/SelectorNuevaPosicion';
import AltaPlanWizard from './components/modal/AltaPlanWizard';
import AltaFondoModal from './components/modal/AltaFondoModal';
import AltaAccionModal from './components/modal/AltaAccionModal';
import AltaPrestamoModal from './components/modal/AltaPrestamoModal';
import AltaDepositoModal from './components/modal/AltaDepositoModal';
import AltaCryptoModal from './components/modal/AltaCryptoModal';
import GaleriaFiltros, { type FiltroCategoria } from './components/galeria/GaleriaFiltros';
import PosicionesCerradasSection from './components/galeria/PosicionesCerradasSection';
import {
  calcularKpisCerradas,
  getPosicionesCerradas,
  type KpisCerradas,
} from './adapters/posicionesCerradas';
import { getAllCartaItems } from './adapters/galeriaAdapter';
import type { CartaItem } from './types/cartaItem';
import { getCategoriaGaleria, type CategoriaGaleria } from './helpers';
import styles from './InversionesGaleria.module.css';

// Familia → modal componente ATLAS. PR 3 sustituye PlanFormV5/PosicionFormV5
// del wizard legacy por los 6 modales de alta dedicados. Los componentes
// legacy siguen vivos en el repo hasta PR 5 (regla "no retirar legacy hasta
// PR final"), pero ya NO se invocan desde la galería.

const InversionesGaleria: React.FC = () => {
  const navigate = useNavigate();
  const [cartaItems, setCartaItems] = useState<CartaItem[]>([]);
  const [resumenCerradas, setResumenCerradas] = useState<KpisCerradas>(() =>
    calcularKpisCerradas([]),
  );
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroCategoria>('todas');

  // Estado del flujo de alta · el selector elige familia, luego se abre
  // el modal ATLAS dedicado. Cada modal invoca el servicio correspondiente
  // (plan → planesPensionesService.createPlan; resto → onSave →
  // inversionesService.createPosicion vía handleSavePosicion del padre).
  const [showSelector, setShowSelector] = useState(false);
  const [altaModal, setAltaModal] = useState<Familia | null>(null);
  const [showAportar, setShowAportar] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
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

  // ── Conteos por categoría ──────────────────────────────────────────
  const counts = useMemo<Record<CategoriaGaleria, number>>(() => {
    const acc: Record<CategoriaGaleria, number> = {
      planes: 0,
      equity: 0,
      rentaFija: 0,
      otros: 0,
    };
    for (const item of cartaItems) {
      acc[getCategoriaGaleria(item.tipo)] += 1;
    }
    return acc;
  }, [cartaItems]);

  const itemsFiltrados = useMemo(() => {
    if (filtro === 'todas') return cartaItems;
    return cartaItems.filter((it) => getCategoriaGaleria(it.tipo) === filtro);
  }, [cartaItems, filtro]);

  const posicionesParaAportar = useMemo(
    () =>
      cartaItems
        .filter((item) => item._origen === 'inversiones')
        .map((item) => item._original as PosicionInversion),
    [cartaItems],
  );

  // ── Handlers ───────────────────────────────────────────────────────
  const handleClickCarta = (item: CartaItem) => {
    navigate(`/inversiones/${item._idOriginal}`);
  };

  const openSelector = () => setShowSelector(true);
  const closeSelector = () => setShowSelector(false);

  const handlePickFamilia = (f: Familia) => {
    setShowSelector(false);
    setAltaModal(f);
  };

  const closeAlta = () => setAltaModal(null);

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

  const handleSortClick = () => {
    showToastV5('Orden personalizado · disponible en próximos releases');
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* CintaResumenInversiones se monta desde MainLayout · ocupa el slot
          del TopbarV5 global en /inversiones/* (mockup atlas-inversiones-v3). */}
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
            onClick: openSelector,
          },
        ]}
      />

      {loading ? (
        <div className={styles.loading}>Cargando inversiones…</div>
      ) : cartaItems.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin posiciones aún"
          subtitle="Crea una posición manualmente o importa tu cartera (IndexaCapital · MyInvestor · aportaciones)."
          cta={{
            label: 'Nueva posición',
            onClick: openSelector,
          }}
        />
      ) : (
        <>
          <GaleriaFiltros
            selected={filtro}
            onSelect={setFiltro}
            counts={counts}
            onSortClick={handleSortClick}
          />

          <div className={styles.galleryHd}>
            <div className={styles.galleryTitle}>Posiciones activas</div>
            <div className={styles.galleryCount}>
              {itemsFiltrados.length}{' '}
              {itemsFiltrados.length === 1 ? 'activa' : 'activas'} ·{' '}
              {filtro === 'todas'
                ? 'ordenadas por valor'
                : `filtradas · ${filtro === 'planes' ? 'planes pensiones' : filtro === 'equity' ? 'equity / fondos' : filtro === 'rentaFija' ? 'renta fija' : 'otros'}`}
            </div>
          </div>

          <div className={styles.galleryGrid}>
            {itemsFiltrados.map((item) => (
              <CartaPosicion
                key={String(item._idOriginal)}
                item={item}
                onClick={handleClickCarta}
              />
            ))}
            {itemsFiltrados.length === 0 && (
              <div className={styles.cartaVizPlaceholder} role="status">
                Sin posiciones en esta categoría
              </div>
            )}
          </div>

          <PosicionesCerradasSection
            kpis={resumenCerradas}
            onClick={() => navigate('/inversiones/cerradas')}
          />
        </>
      )}

      {/* Selector de familia · 6 cards · usa ModalAtlas (PR 1). */}
      {showSelector && (
        <SelectorNuevaPosicion
          onPickFamilia={handlePickFamilia}
          onClose={closeSelector}
        />
      )}

      {/* Modales de alta ATLAS · uno por familia (PR 3). */}
      {altaModal === 'plan' && (
        <AltaPlanWizard
          tipoInicial="PPE"
          onSaved={() => {
            load();
            closeAlta();
          }}
          onClose={closeAlta}
        />
      )}
      {altaModal === 'fondo' && (
        <AltaFondoModal onSave={handleSavePosicion} onClose={closeAlta} />
      )}
      {altaModal === 'accion' && (
        <AltaAccionModal onSave={handleSavePosicion} onClose={closeAlta} />
      )}
      {altaModal === 'prestamo' && (
        <AltaPrestamoModal onSave={handleSavePosicion} onClose={closeAlta} />
      )}
      {altaModal === 'deposito' && (
        <AltaDepositoModal onSave={handleSavePosicion} onClose={closeAlta} />
      )}
      {altaModal === 'crypto' && (
        <AltaCryptoModal onSave={handleSavePosicion} onClose={closeAlta} />
      )}

      {showAportar && (
        <AportarModal
          posiciones={cartaItems.filter((it) => it._origen === 'inversiones')}
          onSaveInversion={async (pos, aportacion) =>
            handleSaveAportacion(pos, aportacion)
          }
          onClose={() => setShowAportar(false)}
        />
      )}
    </div>
  );
};

export default InversionesGaleria;
