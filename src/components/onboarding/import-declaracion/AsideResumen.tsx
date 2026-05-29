/**
 * AsideResumen.tsx · Wizard import XML V2 · § 5 · aside navy con resumen vivo.
 * Contenido específico por paso (1·2·3 implementados; resto genérico).
 */

import React, { useMemo } from 'react';
import type { WizardImportState } from './useWizardImportState';
import { useInmueblesDetectados } from './useInmueblesDetectados';
import styles from './WizardImportarDeclaracion.module.css';

function eur(n: number): string {
  const signo = n >= 0 ? '+' : '−';
  return `${signo}${Math.abs(Math.round(n)).toLocaleString('es-ES')} €`;
}

const Row: React.FC<{ lab: string; val: React.ReactNode; tone?: 'warn' | 'pos' | 'dim' }> = ({ lab, val, tone }) => (
  <div className={styles.asideRow}>
    <span className={styles.asideRowLab}>{lab}</span>
    <span className={`${styles.asideRowVal} ${tone ? styles[tone] : ''}`}>{val}</span>
  </div>
);

const AsideResumen: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const decls = s.declaraciones;
  const det = useInmueblesDetectados(decls);

  const metricas = useMemo(() => {
    const rcs = new Set<string>();
    let arrendamientos = 0;
    const ibanes = new Set<string>();
    const proveedores = new Set<string>();
    let planPensiones = false;
    let nomina = false;
    let autonomoDesde: number | undefined;
    for (const d of decls) {
      for (const inm of d.inmuebles) {
        if (inm.refCatastral) rcs.add(inm.refCatastral.replace(/[\s.-]/g, '').toUpperCase());
        arrendamientos += inm.arrendamientos.length;
        for (const p of inm.proveedores ?? []) if (p.nif) proveedores.add(p.nif.toUpperCase());
        for (const m of inm.mejorasEjercicio) if (m.nifProveedor) proveedores.add(m.nifProveedor.toUpperCase());
        for (const arr of inm.arrendamientos) for (const p of arr.proveedores ?? []) if (p.nif) proveedores.add(p.nif.toUpperCase());
      }
      if (d.cuentaDevolucion?.iban) ibanes.add(d.cuentaDevolucion.iban.replace(/\s+/g, ''));
      if (d.cuentaIngreso?.iban) ibanes.add(d.cuentaIngreso.iban.replace(/\s+/g, ''));
      if (d.planPensiones) planPensiones = true;
      if ((d.trabajo?.retribucionesDinerarias ?? 0) > 0) nomina = true;
      if (d.actividadEconomica) autonomoDesde = autonomoDesde === undefined ? d.meta.ejercicio : Math.min(autonomoDesde, d.meta.ejercicio);
    }
    return {
      inmuebles: rcs.size,
      arrendamientos,
      ibanes: ibanes.size,
      proveedores: proveedores.size,
      planPensiones,
      nomina,
      autonomoDesde,
    };
  }, [decls]);

  // ── Paso 1 ──
  if (s.pasoActual === 1) {
    const ejercicios = [...decls].sort((a, b) => a.meta.ejercicio - b.meta.ejercicio);
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Importación</div>
        <div className={styles.asideTitle}>{decls.length} ejercicios IRPF</div>

        {ejercicios.length > 0 && (
          <div className={styles.asideSection}>
            <div className={styles.asideSectionTitle}>Ejercicios detectados</div>
            {ejercicios.map((d) => {
              const r = d.resultado?.resultadoDeclaracion ?? 0;
              return <Row key={d.meta.ejercicio} lab={String(d.meta.ejercicio)} val={eur(r)} tone={r >= 0 ? 'pos' : 'warn'} />;
            })}
          </div>
        )}

        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>Detectado en XML</div>
          <Row lab="Inmuebles" val={metricas.inmuebles} />
          <Row lab="Arrendamientos" val={metricas.arrendamientos} />
          <Row lab="Cuentas IBAN" val={metricas.ibanes} />
          <Row lab="Proveedores" val={metricas.proveedores} />
          <Row lab="Plan pensiones" val={metricas.planPensiones ? 'sí' : 'no'} tone={metricas.planPensiones ? undefined : 'dim'} />
          <Row lab="Nómina" val={metricas.nomina ? 'sí' : 'no'} tone={metricas.nomina ? undefined : 'dim'} />
          <Row lab="Autónomo" val={metricas.autonomoDesde ? `desde ${metricas.autonomoDesde}` : 'no'} tone={metricas.autonomoDesde ? undefined : 'dim'} />
          <Row lab="Ventas inmueble" val="ninguna" tone="dim" />
        </div>

        {decls.length > 0 && (
          <div className={styles.asideStatus}>
            <div className={styles.asideStatusLab}>Listo</div>
            <div className={styles.asideStatusText}>
              Importación cronológica · los datos más recientes pisarán los anteriores cuando haya
              descuadre.
            </div>
          </div>
        )}
      </aside>
    );
  }

  // ── Paso 2 ──
  if (s.pasoActual === 2) {
    const completos = (s.opciones.inmueblesPrefill ?? []).filter((p) => p.bedrooms != null).length;
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 2 · inmuebles</div>
        <div className={styles.asideTitle}>{det.inmuebles.length} inmuebles detectados</div>

        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>Por estado</div>
          <Row lab="Nuevos" val={det.nuevos.length} tone={det.nuevos.length > 0 ? 'warn' : undefined} />
          <Row lab="Enriquecer" val={det.existentes.length} />
          <Row lab="Accesorios" val={det.accesorios.length} />
        </div>

        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>Configurados</div>
          <Row lab="Completos" val={`${completos} / ${det.nuevos.length}`} />
        </div>

        <div className={styles.asideStatus}>
          <div className={styles.asideStatusLab}>Saltable</div>
          <div className={styles.asideStatusText}>
            Puedes continuar sin completar · los inmuebles nuevos quedarán marcados "Perfil
            incompleto" en el módulo Inmuebles.
          </div>
        </div>
      </aside>
    );
  }

  // ── Paso 3 ──
  if (s.pasoActual === 3) {
    const acc = s.opciones.ibanAcciones ?? [];
    const cuenta = (a: string) => acc.filter((x) => x.accion === a).length;
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 3 · IBAN</div>
        <div className={styles.asideTitle}>{acc.length} cuentas detectadas</div>

        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>Acción seleccionada</div>
          {acc.map((a) => (
            <Row
              key={a.iban}
              lab={a.iban.slice(0, 8)}
              val={a.accion === 'crear' ? 'Crear' : a.accion === 'vincular' ? 'Vincular' : 'Ignorar'}
            />
          ))}
        </div>

        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>Resultado en Tesorería</div>
          <Row lab="Cuentas a crear" val={cuenta('crear')} tone={cuenta('crear') > 0 ? 'warn' : undefined} />
          <Row lab="A vincular" val={cuenta('vincular')} />
          <Row lab="A ignorar" val={cuenta('ignorar')} />
        </div>

        <div className={styles.asideOther}>
          <div className={styles.asideOtherTitle}>Sin uso asignado</div>
          <div className={styles.asideOtherLine}>
            Las cuentas se crearán sin alias significativo ni uso · puedes editarlas en{' '}
            <strong>Tesorería</strong> cuando quieras.
          </div>
        </div>
      </aside>
    );
  }

  // ── Genérico (pasos 4-10, pendientes de commits posteriores) ──
  const paso = s.pasosAplicables.includes(s.pasoActual) ? s.pasoActual : s.pasoActual;
  return (
    <aside className={styles.wizAside}>
      <div className={styles.asideLabel}>Paso {paso}</div>
      <div className={styles.asideTitle}>Resumen del paso</div>
      <div className={styles.asideSection}>
        <div className={styles.asideSectionTitle}>Detectado en XML</div>
        <Row lab="Inmuebles" val={metricas.inmuebles} />
        <Row lab="Proveedores" val={metricas.proveedores} />
        <Row lab="Plan pensiones" val={metricas.planPensiones ? 'sí' : 'no'} tone={metricas.planPensiones ? undefined : 'dim'} />
      </div>
    </aside>
  );
};

export default AsideResumen;
