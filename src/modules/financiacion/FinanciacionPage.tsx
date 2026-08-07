// Container del módulo Financiación.
//
// Ya no hay pestañas: Financiación es UNA sola vista sin scroll
// (`vista/VistaFinanciacionPage`, mockup atlas-financiacion-v10) más el
// Detalle, los wizards y la importación, todos colgando de este Outlet.
//
// Carga préstamos + planes una sola vez y los expone vía `useOutletContext`.
//
// OJO · `rows` (derivado de `helpers.ts`) se mantiene solo porque lo consume
// todavía el Detalle viejo. La vista nueva NO lo usa: lee del motor
// (`generarCuadro` + `services/prestamos/lecturas`). Se va con el Entregable B.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { PageHead, Icons, showToastV5 } from '../../design-system/v5';
import { EmptyState } from '../../components/common/EmptyState';
import {
  prestamosService,
  interesesTotalDeducible,
} from '../../services/prestamosService';
import type { Prestamo, PlanPagos } from '../../types/prestamos';
import { effectiveTIN, loanRowFromPrestamo } from './helpers';
import type { LoanRow } from './types';
import type { FinanciacionOutletContext } from './FinanciacionContext';
import styles from './FinanciacionPage.module.css';

const FinanciacionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [planes, setPlanes] = useState<Map<string, PlanPagos | null>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await prestamosService.getAllPrestamos();
      // Sync cached fields (cuotasPagadas / principalVivo) for data created
      // before the autoMarcarCuotasPagadas cache-recalc fix.
      const synced = await Promise.all(
        list.map((p) => prestamosService.autoMarcarCuotasPagadas(p.id).catch(() => null)),
      );
      const updatedList = synced.map((s, i) => s ?? list[i]);
      setPrestamos(updatedList);
      const planEntries = await Promise.all(
        updatedList.map(async (p) => {
          try {
            const plan = await prestamosService.getPaymentPlan(p.id);
            return [p.id, plan] as const;
          } catch {
            return [p.id, null] as const;
          }
        }),
      );
      setPlanes(new Map(planEntries));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[financiacion] error cargando datos', err);
      showToastV5('Error al cargar la financiación.');
    } finally {
      setLoading(false);
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

  const rows: LoanRow[] = useMemo(() => {
    return prestamos
      .filter((p) => p.activo !== false && p.estado !== 'cancelado')
      .map((p) => {
        // Aproximación · intereses anuales = capitalVivo · TIN efectivo.
        const interesesAnualEstim = (p.principalVivo * effectiveTIN(p)) / 100;
        let intDed = 0;
        try {
          intDed = interesesTotalDeducible(p, interesesAnualEstim);
        } catch {
          intDed = 0;
        }
        return loanRowFromPrestamo(p, intDed);
      });
  }, [prestamos]);

  const ctx: FinanciacionOutletContext = {
    prestamos,
    rows,
    planes,
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

  const showHead = !isDetail && !isWizard;
  // La vista principal manda sin scroll (guía v5): se reparte la altura del
  // main en vez de crecer hacia abajo. El resto de rutas siguen con el flujo
  // normal · un wizard sí puede ser más largo que la ventana.
  const isVistaPrincipal = location.pathname === '/financiacion';

  return (
    <div className={`${styles.page} ${isVistaPrincipal ? styles.pageSinScroll : ''}`}>
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
      ) : showHead && rows.length === 0 ? (
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
