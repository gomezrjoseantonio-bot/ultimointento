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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icons, PageHead, showToastV5 } from '../../design-system/v5';
import { EmptyState } from '../../components/common/EmptyState';
import { TrendingUp } from 'lucide-react';
import { inversionesService } from '../../services/inversionesService';
import { rendimientosService } from '../../services/rendimientosService';
import {
  resincronizarTesoreriaInversiones,
  conciliarAportacionInicial,
} from '../../services/inversionesTesoreriaSync';
import { migrateInversionesToNewModel } from '../../services/migrations/migrateInversiones';
import type { Aportacion, PosicionInversion } from '../../types/inversiones';
import AportarModal from './components/modal/AportarModal';
import SelectorNuevaPosicion, { type Familia } from './components/modal/SelectorNuevaPosicion';
import AltaPlanWizard from './components/modal/AltaPlanWizard';
import AltaFondoModal from './components/modal/AltaFondoModal';
import AltaAccionModal from './components/modal/AltaAccionModal';
import AltaPrestamoModal from './components/modal/AltaPrestamoModal';
import AltaDepositoModal from './components/modal/AltaDepositoModal';
import AltaCryptoModal from './components/modal/AltaCryptoModal';
import HeroInversiones from './components/galeria/HeroInversiones';
import LedgerPosiciones from './components/galeria/LedgerPosiciones';
import {
  calcularKpisCerradas,
  getPosicionesCerradas,
  type KpisCerradas,
} from './adapters/posicionesCerradas';
import { getAllCartaItems } from './adapters/galeriaAdapter';
import type { CartaItem } from './types/cartaItem';
import {
  resumenCartera,
  familiasResumen,
  rentaPasivaAnual,
  serieTrayectoria,
} from './adapters/galeriaHero';
import {
  obtenerSupuestosGaleria,
  type SupuestosGaleria,
} from './adapters/supuestosProyeccion';
import styles from './InversionesGaleria.module.css';

// Familia → modal componente ATLAS. PR 3 sustituye PlanFormV5/PosicionFormV5
// del wizard legacy por los 6 modales de alta dedicados. Los componentes
// legacy siguen vivos en el repo hasta PR 5 (regla "no retirar legacy hasta
// PR final"), pero ya NO se invocan desde la galería.

const InversionesGaleria: React.FC = () => {
  const navigate = useNavigate();
  // FIX onboarding PUNTO 7 (P1) · cuando se entra desde /empezar
  // (`?from=empezar`) la galería aprende a abrir el selector directamente y a
  // VOLVER al flujo al crear (o cancelar) · sin reescribir el modal.
  const [searchParams] = useSearchParams();
  const fromEmpezar = searchParams.get('from') === 'empezar';
  const volviendoAlFlujo = useRef(false);
  // Guard para el `load()` en segundo plano tras el alta: si el componente ya
  // se desmontó (p.ej. se volvió al flujo /empezar), no hacemos setState.
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);
  const [cartaItems, setCartaItems] = useState<CartaItem[]>([]);
  const [resumenCerradas, setResumenCerradas] = useState<KpisCerradas>(() =>
    calcularKpisCerradas([]),
  );
  const [supuestos, setSupuestos] = useState<SupuestosGaleria | null>(null);
  const [loading, setLoading] = useState(true);

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
      const [items, cerradas, sup] = await Promise.all([
        getAllCartaItems(),
        getPosicionesCerradas().catch(() => []),
        obtenerSupuestosGaleria().catch(() => null),
      ]);
      setCartaItems(items);
      setResumenCerradas(calcularKpisCerradas(cerradas));
      if (sup) setSupuestos(sup);
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

  // ── Agregados del hero (supervisión · KPIs integrados) ─────────────
  const resumen = useMemo(() => resumenCartera(cartaItems), [cartaItems]);
  const familias = useMemo(() => familiasResumen(cartaItems), [cartaItems]);
  const rentaPasiva = useMemo(() => rentaPasivaAnual(cartaItems), [cartaItems]);
  const serie = useMemo(() => {
    if (!supuestos) return null;
    return serieTrayectoria(cartaItems, supuestos, new Date().getFullYear());
  }, [cartaItems, supuestos]);

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

  // Al entrar desde el onboarding, abrir directamente el selector de familia.
  useEffect(() => {
    if (fromEmpezar) setShowSelector(true);
  }, [fromEmpezar]);

  // Cierre del bucle · al crear una posición desde /empezar se vuelve al bloque
  // con `?done` (marca el bloque · sube el % · vuelta al mapa).
  const volverAlFlujo = useCallback(() => {
    volviendoAlFlujo.current = true;
    navigate('/empezar/inversiones?done=posicion', { replace: true });
  }, [navigate]);

  const openSelector = () => setShowSelector(true);
  const closeSelector = () => {
    setShowSelector(false);
    // Cancelar desde el onboarding · vuelta al mapa SIN marcar el bloque.
    // `replace` evita dejar `/inversiones?from=empezar` en el historial (atrás
    // reabriría el selector en bucle).
    if (fromEmpezar) navigate('/empezar/inversiones', { replace: true });
  };

  const handlePickFamilia = (f: Familia) => {
    setShowSelector(false);
    setAltaModal(f);
  };

  const closeAlta = () => {
    setAltaModal(null);
    // En onboarding · cerrar el modal de alta (cancelar) reabre el selector;
    // si se creó la posición, `volverAlFlujo` ya navegó fuera (no reabrir).
    if (fromEmpezar && !volviendoAlFlujo.current) setShowSelector(true);
  };

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
      // Lo ÚNICO crítico que debe esperar el modal es persistir la posición.
      const nuevaId = await inversionesService.createPosicion(
        data as Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'> & {
          importe_inicial?: number;
        },
      );
      showToastV5('Posición creada.');
      // El resto (generar rendimientos + resync de Tesorería a 24 meses +
      // recarga de la galería) es trabajo de fondo pesado y NO debe bloquear el
      // cierre del modal · antes se quedaba "Guardando…" hasta reconstruir toda
      // la tesorería. Se lanza en segundo plano; la galería/tesorería se
      // refrescan solas al terminar (el resync tiene su propio manejo de error).
      void (async () => {
        try {
          await rendimientosService.generarRendimientosPendientes();
          await resincronizarTesoreriaInversiones('alta de posición');
          // El desembolso inicial (con cuenta de cargo y fecha ≤ hoy) se
          // registra como movimiento real → baja YA del saldo y se concilia
          // contra el extracto sin duplicar (decisión de Jose).
          await conciliarAportacionInicial(nuevaId);
          // Solo refrescamos la galería si seguimos montados y no estamos
          // saliendo al flujo /empezar (evita setState tras desmontar).
          if (montadoRef.current && !fromEmpezar) await load();
        } catch (bgErr) {
          // eslint-disable-next-line no-console
          console.error('[inversiones] post-alta background', bgErr);
        }
      })();
      if (fromEmpezar) volverAlFlujo();
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

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* INVERSIONES V1 · Fase 2 · pantalla de supervisión sin scroll: los KPIs
          viven en el hero navy, así que la CintaResumenInversiones NO se monta en
          esta ruta exacta (/inversiones · ver MainLayout). Head + hero fijos · el
          ledger hace scroll interno. */}
      <PageHead
        title="Inversiones"
        sub="tu cartera · y lo que te renta"
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
          {serie && (
            <HeroInversiones
              resumen={resumen}
              familias={familias}
              rentaPasiva={rentaPasiva}
              serie={serie}
            />
          )}

          <LedgerPosiciones
            items={cartaItems}
            valorTotal={resumen.valorTotal}
            onRowClick={handleClickCarta}
            cerradasCount={resumenCerradas.count}
            onVerCerradas={() => navigate('/inversiones/cerradas')}
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
            if (fromEmpezar) volverAlFlujo();
            else closeAlta();
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
