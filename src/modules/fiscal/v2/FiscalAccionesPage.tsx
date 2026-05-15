/**
 * FiscalAccionesPage · F6 Acciones fiscales · ÚNICO sitio operativo del
 * módulo Fiscal v2. Ruta · `/fiscal/acciones`.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6.
 * Mockup canónico · docs/audit-inputs/atlas-fiscal-v3.html#page-config.
 *
 * Reemplaza la página vieja `src/modules/fiscal/pages/ConfiguracionPage.tsx`
 * (dependía de `FiscalOutletContext`) por 7 acordeones standalone:
 *   1 · Perfil fiscal (lectura · link a Ajustes general)
 *   2 · Importar declaración Modelo 100
 *   3 · Aplicar paralela AEAT
 *   4 · Re-importar o exportar ejercicio
 *   5 · Arrastres manuales
 *   6 · Histórico completo declaraciones
 *   7 · Exportar todo (JSON · ZIP · CSV)
 *
 * Compatibilidad de ruta · `/fiscal/configuracion` y query
 * `?section=deudas|arrastres|ejercicio=XXXX` apuntan aquí (App.tsx
 * redirect + esta página puede abrir un acordeón según query).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AccionAccordion from './AccionAccordion';
import PerfilFiscalSection from './acciones/PerfilFiscalSection';
import ImportarDeclaracionSection from './acciones/ImportarDeclaracionSection';
import AplicarParalelaSection from './acciones/AplicarParalelaSection';
import ReImportarExportarSection from './acciones/ReImportarExportarSection';
import ArrastresManualesSection from './acciones/ArrastresManualesSection';
import HistoricoDeclaracionesSection from './acciones/HistoricoDeclaracionesSection';
import ExportarTodoSection from './acciones/ExportarTodoSection';
import styles from './FiscalEjercicioPage.module.css';

type SectionKey =
  | 'perfil'
  | 'importar'
  | 'paralela'
  | 'reimport'
  | 'arrastres'
  | 'historico'
  | 'exportar';

function mapQueryToDefaultOpen(search: URLSearchParams): SectionKey {
  const section = search.get('section');
  if (section === 'deudas' || section === 'paralela') return 'paralela';
  if (section === 'arrastres') return 'arrastres';
  if (section === 'importar') return 'importar';
  if (section === 'exportar') return 'exportar';
  if (search.get('ejercicio')) return 'reimport';
  return 'perfil';
}

// Toast helper · usa showToastV5 si está disponible en el design system
// (lo está · ver design-system/v5/index.ts) · fallback a console.info.
function makeToast(): (msg: string) => void {
  return (msg: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ds = require('../../../design-system/v5');
      if (ds.showToastV5) {
        ds.showToastV5(msg);
        return;
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line no-console
    console.info('[fiscal acciones]', msg);
  };
}

const FiscalAccionesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultOpen = useMemo(() => mapQueryToDefaultOpen(searchParams), [searchParams]);
  const [showToast] = useState(() => makeToast());

  // Scroll hacia el acordeón abierto por query · UX suave para los
  // links de los KPIs del F1 dashboard (Deuda · Arrastres) y de los
  // headers de F2-F4 que ahora apuntan aquí.
  useEffect(() => {
    if (defaultOpen === 'perfil') return;
    const id = `acordeon-${defaultOpen}`;
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [defaultOpen]);

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="breadcrumb">
        <button type="button" className={styles.backBtn} onClick={() => navigate('/fiscal')}>
          ‹ Volver
        </button>
        <button type="button" onClick={() => navigate('/fiscal')}>Fiscal</button>
        <span className={styles.breadcrumbSep}>›</span>
        <span className={styles.breadcrumbCurrent}>Acciones fiscales</span>
      </nav>

      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageHeadTitle}>Acciones fiscales</h1>
          <div className={styles.metaLine}>
            todas las operaciones sobre tu fiscalidad · importar · aplicar
            paralela · arrastres · histórico · exportar
          </div>
        </div>
      </header>

      <div id="acordeon-perfil">
        <AccionAccordion
          title="Perfil fiscal"
          subtitle="situación familiar · CCAA · fuentes de renta · modelos activos"
          defaultOpen={defaultOpen === 'perfil'}
        >
          <PerfilFiscalSection />
        </AccionAccordion>
      </div>

      <div id="acordeon-importar">
        <AccionAccordion
          title="Importar declaración Modelo 100"
          subtitle="XML DeclaVisor · PDF · TXT · pantallazos AEAT"
          defaultOpen={defaultOpen === 'importar'}
        >
          <ImportarDeclaracionSection />
        </AccionAccordion>
      </div>

      <div id="acordeon-paralela">
        <AccionAccordion
          title="Aplicar paralela AEAT"
          subtitle="liquidación firmada · cascada años posteriores"
          defaultOpen={defaultOpen === 'paralela'}
        >
          <AplicarParalelaSection />
        </AccionAccordion>
      </div>

      <div id="acordeon-reimport">
        <AccionAccordion
          title="Re-importar o exportar un ejercicio"
          subtitle="re-importar declaración existente · exportar PDF · comparar versiones"
          defaultOpen={defaultOpen === 'reimport'}
        >
          <ReImportarExportarSection showToast={showToast} />
        </AccionAccordion>
      </div>

      <div id="acordeon-arrastres">
        <AccionAccordion
          title="Arrastres manuales"
          subtitle="añadir arrastres de años no importados"
          defaultOpen={defaultOpen === 'arrastres'}
        >
          <ArrastresManualesSection showToast={showToast} />
        </AccionAccordion>
      </div>

      <div id="acordeon-historico">
        <AccionAccordion
          title="Histórico completo de declaraciones"
          subtitle="todos los modelos presentados · 100 · 303 · 130 · 184"
          defaultOpen={defaultOpen === 'historico'}
        >
          <HistoricoDeclaracionesSection />
        </AccionAccordion>
      </div>

      <div id="acordeon-exportar">
        <AccionAccordion
          title="Exportar todo"
          subtitle="JSON configuración · ZIP declaraciones · CSV casillas"
          defaultOpen={defaultOpen === 'exportar'}
        >
          <ExportarTodoSection showToast={showToast} />
        </AccionAccordion>
      </div>
    </div>
  );
};

export default FiscalAccionesPage;
