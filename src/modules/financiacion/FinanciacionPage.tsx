// Container del módulo Financiación.
//
// Ya no hay pestañas: Financiación es UNA sola vista sin scroll
// (`vista/VistaFinanciacionPage`, mockup atlas-financiacion-v10) más el
// Detalle, los wizards y la importación, todos colgando de este Outlet.
//
// Carga los préstamos una sola vez y los expone vía `useOutletContext`.
//
// Ya no deriva `rows` con `helpers.ts`: con el Detalle nuevo no queda nadie que
// lo consuma. Las dos pantallas se generan su propio cuadro (`cuadroDe`, que ya
// memoiza) y leen de él, así que Financiación entera queda sin una sola cifra
// que venga de la capa de presentación.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { PageHead, Icons, showToastV5 } from '../../design-system/v5';
import { EmptyState } from '../../components/common/EmptyState';
import { prestamosService } from '../../services/prestamosService';
import type { Prestamo } from '../../types/prestamos';
import type { FinanciacionOutletContext } from './FinanciacionContext';
import styles from './FinanciacionPage.module.css';

const FinanciacionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Los préstamos, y la pantalla pintada en cuanto se saben.
   *
   * Antes «Cargando financiación…» tapaba la pantalla hasta que terminaba TODO,
   * y ese todo incluía dos vueltas por préstamo. Era la única entrada del menú
   * en la que se veía el cargando *(Jose · 9 ago 2026)*.
   *
   * Lo que se espera ahora es solo la lectura de los préstamos, que es lo único
   * sin lo cual no hay nada que enseñar —ni siquiera se puede decidir si toca
   * el estado vacío—. El refresco de contadores va después y no retiene nada:
   * ninguna de las dos pantallas de Financiación los lee, porque las dos
   * derivan sus cifras del cuadro. Quien sí los lee es Mi Plan, y los tendrá
   * frescos igual, unos milisegundos más tarde.
   */
  const cargaEnCurso = useRef(0);

  const load = useCallback(async () => {
    const miTurno = ++cargaEnCurso.current;
    try {
      setLoading(true);
      const list = await prestamosService.getAllPrestamos();
      if (cargaEnCurso.current !== miTurno) return;
      setPrestamos(list);
      setLoading(false);

      // Y ahora, sin bloquear · pone al día `cuotasPagadas` y `principalVivo`
      // de los datos anteriores a que se recalcularan solos.
      const synced = await Promise.all(
        list.map((p) => prestamosService.autoMarcarCuotasPagadas(p.id).catch(() => null)),
      );

      // Dos cautelas, porque al dejar de bloquear la pantalla queda viva
      // mientras esto vuela · si por el camino se amortiza o se edita, hay un
      // `reload` más nuevo en marcha y ESTE ya no manda.
      if (cargaEnCurso.current !== miTurno) return;
      const alDia = new Map(synced.filter(Boolean).map((p) => [p!.id, p!]));
      if (alDia.size === 0) return;
      // Y se fusiona POR ID contra lo que haya en pantalla, no por posición:
      // el estado pudo cambiar de orden o de tamaño, y casar por índice ahí
      // pone los contadores de un préstamo en otro.
      setPrestamos((actuales) => actuales.map((p) => alDia.get(p.id) ?? p));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[financiacion] error cargando datos', err);
      showToastV5('Error al cargar la financiación.');
    } finally {
      if (cargaEnCurso.current === miTurno) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const vivos = useMemo(
    () => prestamos.filter((p) => p.activo !== false && p.estado !== 'cancelado'),
    [prestamos],
  );

  const ctx: FinanciacionOutletContext = {
    prestamos,
    reload: load,
  };

  if (location.pathname === '/financiacion/') {
    return <Navigate to="/financiacion" replace />;
  }

  // El Detalle (`/financiacion/:id`) y los wizards traen su propia cabecera.
  const isDetail =
    /^\/financiacion\/[^/]+$/.test(location.pathname) &&
    !['/financiacion/nuevo', '/financiacion/nuevo-fein', '/financiacion/importar'].includes(
      location.pathname,
    );
  const isWizard =
    location.pathname === '/financiacion/nuevo' ||
    location.pathname === '/financiacion/nuevo-fein' ||
    /^\/financiacion\/[^/]+\/editar$/.test(location.pathname);

  // La vista principal y el detalle llevan su título DENTRO del hero, como
  // Tesorería · una cabecera aparte encima repetía el nombre del menú y se
  // comía una banda de una pantalla que no puede tener scroll.
  const isVista = location.pathname === '/financiacion';
  const showHead = !isDetail && !isWizard && !isVista;
  // La vista principal y el detalle mandan sin scroll (guía v5): se reparten la
  // altura del main en vez de crecer hacia abajo. El resto de rutas siguen con
  // el flujo normal · un wizard sí puede ser más largo que la ventana.
  const sinScroll = isVista || isDetail;

  return (
    <div className={`${styles.page} ${sinScroll ? styles.pageSinScroll : ''}`}>
      {showHead && (
        <PageHead
          title="Financiación"
          sub="tu deuda · tu cuota · cuándo te liberas"
          className={styles.head}
          actions={[
            // Solo la FEIN: «Nuevo préstamo» es ahora el botón oro del hero
            // (v10), y repetirlo aquí daría dos primarios en la misma pantalla.
            // La importación CSV sigue en /financiacion/importar.
            {
              label: 'Subir FEIN',
              variant: 'ghost',
              icon: <Icons.Upload size={14} strokeWidth={1.8} />,
              onClick: () => navigate('/financiacion/nuevo-fein'),
            },
          ]}
        />
      )}
      {loading ? (
        <div className={styles.loading}>Cargando financiación…</div>
      ) : (isVista || showHead) && vivos.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Sin préstamos aún"
          subtitle="Crea tu primer préstamo manualmente o impórtalo desde una FEIN."
          cta={{
            label: 'Nuevo préstamo',
            onClick: () => navigate('/financiacion/nuevo'),
          }}
        />
      ) : (
        <Outlet context={ctx} />
      )}
    </div>
  );
};

export default FinanciacionPage;
