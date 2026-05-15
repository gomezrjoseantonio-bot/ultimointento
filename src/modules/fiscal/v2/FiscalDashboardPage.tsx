/**
 * FiscalDashboardPage · F1 dashboard del módulo Fiscal v2.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2.
 * Mockup canónico · docs/audit-inputs/atlas-fiscal-v3.html#page-dashboard.
 *
 * Reemplaza la página vieja `src/modules/fiscal/pages/DashboardPage.tsx`
 * (calendario placeholder con valores 0,00 €). Standalone · no depende
 * del shell `FiscalPage` (la ruta `/fiscal` index la monta directamente
 * desde `App.tsx` y `FiscalPage` oculta su PageHead cuando estamos aquí).
 *
 * Datos · `fiscalResolverService.getResumenGlobal()` (sub-tarea 1) +
 *         `fiscalResolverService.resolverTodosLosEjercicios()` +
 *         `deudasFiscalesService.getDeudasAbiertas()` +
 *         helper local `getArrastresVivos()`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getResumenGlobal,
  resolverTodosLosEjercicios,
  type ResumenGlobalFiscal,
  type DatosFiscalesEjercicio,
} from '../../../services/fiscalResolverService';
import { getDeudasAbiertas } from '../../../services/deudasFiscalesService';
import type { DeudaFiscal } from '../../../services/db';
import { getArrastresVivos, type ArrastresVivosData } from './helpers/arrastresVivosService';
import { getParalelaInfoMultiAño, type ParalelaInfo } from './helpers/paralelaService';
import FiscalKpiStrip from './FiscalKpiStrip';
import FiscalEjerciciosTab, { type EjercicioRowVm } from './FiscalEjerciciosTab';
import FiscalDeudasTab from './FiscalDeudasTab';
import FiscalArrastresTab from './FiscalArrastresTab';
import styles from './FiscalDashboardPage.module.css';

type TabKey = 'ejercicios' | 'deudas' | 'arrastres';

const PRESCRIPCION_AÑOS = 4;

function calcularFechaPrescripcion(añoEjercicio: number): string {
  const fecha = new Date(Date.UTC(añoEjercicio + 1 + PRESCRIPCION_AÑOS, 5, 30));
  return fecha.toISOString().slice(0, 10);
}

function yaPrescrito(añoEjercicio: number, hoy: Date): boolean {
  return new Date(calcularFechaPrescripcion(añoEjercicio)) < hoy;
}

function detectarParalela(d: DatosFiscalesEjercicio): boolean {
  const fuente: any = d.fuente;
  if (fuente === 'paralela' || fuente === 'paralela_aeat') return true;
  const decl = d.declaracionCompleta as any;
  return Boolean(decl?.paralela ?? decl?.versiones?.length > 1);
}

function buildEjerciciosVm(
  ejercicios: DatosFiscalesEjercicio[],
  hoy: Date,
  paralelasByAño: Map<number, ParalelaInfo>,
): EjercicioRowVm[] {
  return ejercicios.map((d) => {
    const esPrescrito = d.estado === 'declarado' && yaPrescrito(d.año, hoy);
    const paralela = paralelasByAño.get(d.año);
    return {
      año: d.año,
      estado: d.estado,
      resultado: d.resultado,
      tieneParalela: detectarParalela(d) || Boolean(paralela?.esComplementaria),
      esComplementaria: Boolean(paralela?.esComplementaria),
      justificanteAnterior: paralela?.justificanteAnterior,
      prescribe: esPrescrito || d.estado === 'en_curso'
        ? null
        : calcularFechaPrescripcion(d.año),
      esPrescrito,
    };
  });
}

function fmtCampaña(c: ResumenGlobalFiscal['campañaActual']): string | null {
  if (!c) return null;
  const fmt = (iso: string): string => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return `Campaña IRPF ${c.ejercicio} ${c.abierta ? 'abierta' : 'próxima'} · ${fmt(c.ventana.from)} – ${fmt(c.ventana.to)}`;
}

const FiscalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<ResumenGlobalFiscal | null>(null);
  const [ejercicios, setEjercicios] = useState<DatosFiscalesEjercicio[]>([]);
  const [paralelas, setParalelas] = useState<Map<number, ParalelaInfo>>(() => new Map());
  const [deudas, setDeudas] = useState<DeudaFiscal[]>([]);
  const [arrastres, setArrastres] = useState<ArrastresVivosData>({ rows: [], totalPendiente: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('ejercicios');

  const hoy = useMemo(() => new Date(), []);
  const añoActual = hoy.getFullYear();
  const añoPendiente = añoActual - 1;

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [r, ejs, ds, ar] = await Promise.all([
        getResumenGlobal(),
        resolverTodosLosEjercicios(),
        getDeudasAbiertas(),
        getArrastresVivos(añoActual),
      ]);
      // Paralelas/complementarias se resuelven en serie sobre los años
      // efectivamente cargados (después de resolverTodosLosEjercicios).
      const par = await getParalelaInfoMultiAño(ejs.map((e) => e.año));
      setResumen(r);
      setEjercicios(ejs);
      setParalelas(par);
      setDeudas(ds);
      setArrastres(ar);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[fiscal v2] error cargando dashboard', err);
    } finally {
      setLoading(false);
    }
  }, [añoActual]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejerciciosVm = useMemo(
    () => buildEjerciciosVm(ejercicios, hoy, paralelas),
    [ejercicios, hoy, paralelas],
  );

  const goEjercicio = (año: number) => navigate(`/fiscal/ejercicio/${año}`);
  const goAcciones = () => navigate('/fiscal/configuracion');
  const goAccionesDeudas = () => navigate('/fiscal/configuracion?section=deudas');
  const goAccionesArrastres = () => navigate('/fiscal/configuracion?section=arrastres');

  const campañaText = resumen ? fmtCampaña(resumen.campañaActual) : null;

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageHeadTitle}>Fiscal</h1>
          {campañaText && (
            <div className={styles.pageHeadSub}>
              {campañaText}
            </div>
          )}
        </div>
        <button
          type="button"
          className={styles.pageActionLink}
          onClick={goAcciones}
        >
          Acciones fiscales →
        </button>
      </header>

      {loading ? (
        <div className={styles.loading}>Cargando dashboard fiscal…</div>
      ) : (
        <>
          <FiscalKpiStrip
            proyeccionAñoActual={resumen?.proyeccionAñoActual ?? null}
            borradorAñoPendiente={resumen?.borradorAñoPendiente ?? null}
            deudaAbierta={resumen?.deudaAbierta ?? 0}
            arrastresVivos={resumen?.arrastresVivos ?? 0}
            añoActual={añoActual}
            añoPendiente={añoPendiente}
            onClickProyeccion={() => goEjercicio(añoActual)}
            onClickBorrador={() => goEjercicio(añoPendiente)}
            onClickDeuda={goAccionesDeudas}
            onClickArrastres={goAccionesArrastres}
          />

          <nav className={styles.tabs} role="tablist" aria-label="Secciones del dashboard fiscal">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ejercicios'}
              className={`${styles.tab} ${activeTab === 'ejercicios' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('ejercicios')}
            >
              Ejercicios
              <span className={styles.tabCount}>{ejerciciosVm.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'deudas'}
              className={`${styles.tab} ${activeTab === 'deudas' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('deudas')}
            >
              Deudas
              <span className={styles.tabCount}>{deudas.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'arrastres'}
              className={`${styles.tab} ${activeTab === 'arrastres' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('arrastres')}
            >
              Arrastres
              <span className={styles.tabCount}>{arrastres.rows.length}</span>
            </button>
          </nav>

          {activeTab === 'ejercicios' && (
            <FiscalEjerciciosTab rows={ejerciciosVm} onSelectAño={goEjercicio} />
          )}
          {activeTab === 'deudas' && <FiscalDeudasTab deudas={deudas} />}
          {activeTab === 'arrastres' && <FiscalArrastresTab rows={arrastres.rows} />}
        </>
      )}
    </div>
  );
};

export default FiscalDashboardPage;
