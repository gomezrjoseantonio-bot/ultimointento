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

const InversionesGaleria: React.FC = () => {
  const navigate = useNavigate();
  const [posiciones, setPosiciones] = useState<PosicionInversion[]>([]);
  const [posicionesCerradasStore, setPosicionesCerradasStore] = useState<
    PosicionInversion[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [showWizard, setShowWizard] = useState(false);
  const [showAportar, setShowAportar] = useState(false);

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

  const openAportar = () => {
    if (activas.length === 0) {
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
        <WizardNuevaPosicion
          onSavePosicion={handleSavePosicion}
          onClose={() => setShowWizard(false)}
        />
      )}

      {showAportar && (
        <DialogAportar
          posiciones={activas}
          onSave={handleSaveAportacion}
          onClose={() => setShowAportar(false)}
        />
      )}
    </div>
  );
};

export default InversionesGaleria;
