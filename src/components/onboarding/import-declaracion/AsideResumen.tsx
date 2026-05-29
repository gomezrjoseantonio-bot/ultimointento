/**
 * AsideResumen.tsx · Wizard import XML V2 · § 5 · aside navy con resumen vivo.
 * Contenido específico por paso (1·2·3 implementados; resto genérico).
 */

import React, { useMemo } from 'react';
import type { WizardImportState } from './useWizardImportState';
import { useInmueblesDetectados } from './useInmueblesDetectados';
import { detectarProveedores, detectarPlanesXml } from './deteccion';
import { sugerenciasNomina, sugerenciasAutonomo } from './prefill';
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

  // ── Paso 4 · proveedores ──
  if (s.pasoActual === 4) {
    const provs = detectarProveedores(decls);
    const total = provs.reduce((acc, p) => acc + p.total, 0);
    const porInmueble = new Map<string, number>();
    for (const p of provs) for (const inm of p.inmuebles) porInmueble.set(inm, (porInmueble.get(inm) ?? 0) + 1);
    const top = Array.from(porInmueble.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 4 · proveedores</div>
        <div className={styles.asideTitle}>{provs.length} NIFs únicos</div>
        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>A crear</div>
          <Row lab="Placeholders" val={provs.length} tone={provs.length > 0 ? 'warn' : undefined} />
          <Row lab="Total gastado" val={`${Math.round(total).toLocaleString('es-ES')} €`} />
        </div>
        {top.length > 0 && (
          <div className={styles.asideSection}>
            <div className={styles.asideSectionTitle}>Distribución por inmueble</div>
            {top.map(([inm, n]) => (
              <Row key={inm} lab={inm} val={`${n} prov`} />
            ))}
          </div>
        )}
        <div className={styles.asideOther}>
          <div className={styles.asideOtherTitle}>Sin nombre</div>
          <div className={styles.asideOtherLine}>
            Cada placeholder se marca <strong>Proveedor [NIF]</strong> con badge "sin nombre" ·
            nómbralos cuando quieras desde <strong>Inmuebles</strong>.
          </div>
        </div>
      </aside>
    );
  }

  // ── Paso 5 · planes de pensiones ──
  if (s.pasoActual === 5) {
    const planes = detectarPlanesXml(decls);
    const totalT = planes.reduce((a, p) => a + p.totalTrabajador, 0);
    const totalE = planes.reduce((a, p) => a + p.totalEmpresa, 0);
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 5 · pensiones</div>
        <div className={styles.asideTitle}>{planes.length} plan(es) detectado(s)</div>
        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>Aportado (histórico XML)</div>
          <Row lab="Trabajador" val={`${Math.round(totalT).toLocaleString('es-ES')} €`} />
          <Row lab="Empresa" val={`${Math.round(totalE).toLocaleString('es-ES')} €`} />
          <Row lab="Total" val={`${Math.round(totalT + totalE).toLocaleString('es-ES')} €`} />
        </div>
        <div className={styles.asideStatus}>
          <div className={styles.asideStatusLab}>Matching estable</div>
          <div className={styles.asideStatusText}>
            Las aportaciones se unifican por NIF empleador · ejercicios futuros con el mismo NIF se
            suman al mismo plan automáticamente.
          </div>
        </div>
      </aside>
    );
  }

  // ── Paso 6 · nómina ──
  if (s.pasoActual === 6) {
    const f = sugerenciasNomina(decls);
    const m = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`;
    const ret = f ? (f.brutoAnual * f.irpfPorcentaje) / 100 : 0;
    const ss = f ? (f.brutoAnual * f.ssPorcentaje) / 100 : 0;
    const neto = f ? f.brutoAnual - ret - ss : 0;
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 6 · nómina</div>
        <div className={styles.asideTitle}>{f ? 'Nómina detectada' : 'Sin nómina'}</div>
        {f && (
          <>
            <div className={styles.asideSection}>
              <div className={styles.asideSectionTitle}>Datos XML {f.ejercicio}</div>
              <Row lab="Bruto anual" val={m(f.brutoAnual)} />
              <Row lab="Retenciones" val={m(ret)} />
              <Row lab="SS empleado" val={m(ss)} />
              <Row lab="% IRPF efectivo" val={`${f.irpfPorcentaje.toLocaleString('es-ES')} %`} />
              <Row lab="Neto anual" val={m(neto)} tone="pos" />
              <Row lab={`Neto / paga (${f.numPagas})`} val={m(neto / Math.max(f.numPagas, 1))} tone="pos" />
            </div>
            <div className={styles.asideStatus}>
              <div className={styles.asideStatusLab}>Propagación</div>
              <div className={styles.asideStatusText}>
                Tras guardar la nómina, ATLAS proyecta cobros mes a mes en Tesorería + Mi Plan +
                Proyección.
              </div>
            </div>
          </>
        )}
      </aside>
    );
  }

  // ── Paso 7 · autónomo ──
  if (s.pasoActual === 7) {
    const a = sugerenciasAutonomo(decls);
    const m = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`;
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 7 · autónomo</div>
        <div className={styles.asideTitle}>{a ? 'Actividad detectada' : 'Sin actividad'}</div>
        {a && (
          <>
            <div className={styles.asideSection}>
              <div className={styles.asideSectionTitle}>Datos XML {a.form.ejercicio}</div>
              <Row lab="IAE" val={a.form.iae || '—'} />
              <Row lab="Modalidad" val={a.form.modalidad === 'simplificada' ? 'Simplif.' : 'Normal'} />
              <Row lab="Ingresos" val={m(a.ingresos)} />
              <Row lab="Gastos" val={m(a.gastos)} />
              <Row lab="Cuota RETA" val={m(a.totalRetaAnual)} />
              <Row lab="Rendto neto" val={m(a.rendimientoNeto)} tone="pos" />
            </div>
            <div className={styles.asideStatus}>
              <div className={styles.asideStatusLab}>Cuota RETA en Fiscal</div>
              <div className={styles.asideStatusText}>
                Las obligaciones M303/M130/M390 y el calendario fiscal se gestionan desde el módulo
                Fiscal, no en este wizard.
              </div>
            </div>
          </>
        )}
      </aside>
    );
  }

  // ── Paso 8 · ventas ──
  if (s.pasoActual === 8) {
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 8 · ventas</div>
        <div className={styles.asideTitle}>Sin ventas detectadas</div>
        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>Inmuebles vendidos</div>
          <Row lab="En los XMLs" val={0} tone="dim" />
        </div>
        <div className={styles.asideStatus}>
          <div className={styles.asideStatusLab}>Fuera de scope</div>
          <div className={styles.asideStatusText}>
            Fondos y crypto se gestionan desde Inversiones · este paso solo trata venta de
            inmuebles.
          </div>
        </div>
      </aside>
    );
  }

  // ── Paso 9 · personales ──
  if (s.pasoActual === 9) {
    const d = s.declaracionPrincipal?.declarante;
    const asalariado = decls.some((x) => (x.trabajo?.retribucionesDinerarias ?? 0) > 0);
    const autonomo = decls.some((x) => !!x.actividadEconomica);
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 9 · personales</div>
        <div className={styles.asideTitle}>Titular detectado</div>
        {d && (
          <>
            <div className={styles.asideSection}>
              <div className={styles.asideSectionTitle}>Datos del declarante</div>
              <Row lab="NIF" val={d.nif} />
              <Row lab="Estado civil" val={d.estadoCivil ?? '—'} />
              <Row lab="CCAA" val={d.nombreCCAA || d.codigoCCAA || '—'} />
              <Row lab="Tributación" val={d.tributacion === 'conjunta' ? 'Conjunta' : 'Individual'} />
            </div>
            <div className={styles.asideSection}>
              <div className={styles.asideSectionTitle}>Situación laboral</div>
              <Row lab="Asalariado" val={asalariado ? 'sí' : 'no'} tone={asalariado ? 'pos' : 'dim'} />
              <Row lab="Autónomo" val={autonomo ? 'sí' : 'no'} tone={autonomo ? 'pos' : 'dim'} />
            </div>
            <div className={styles.asideStatus}>
              <div className={styles.asideStatusLab}>Actual no versionado</div>
              <div className={styles.asideStatusText}>
                Si en un año futuro cambias CCAA o estado civil, ATLAS actualiza personalData con el
                último dato del XML.
              </div>
            </div>
          </>
        )}
      </aside>
    );
  }

  // ── Paso 10 · final ──
  if (s.pasoActual === 10) {
    return (
      <aside className={styles.wizAside}>
        <div className={styles.asideLabel}>Paso 10 · final</div>
        <div className={styles.asideTitle}>Listo para importar</div>
        <div className={styles.asideSection}>
          <div className={styles.asideSectionTitle}>Resumen total</div>
          <Row lab="Ejercicios" val={decls.length} />
          <Row lab="Inmuebles" val={det.inmuebles.length} />
          <Row lab="Proveedores" val={metricas.proveedores} />
        </div>
        <div className={styles.asideOther}>
          <div className={styles.asideOtherTitle}>Tras importar verás</div>
          <div className={styles.asideOtherLine}>
            <strong>Inmuebles</strong> · {det.inmuebles.length} fichas · {det.nuevos.length} nuevas
          </div>
          <div className={styles.asideOtherLine}>
            <strong>Contratos</strong> · arrendamientos por año · algunos sin identificar
          </div>
          <div className={styles.asideOtherLine}>
            <strong>Tesorería</strong> · {(s.opciones.ibanAcciones ?? []).filter((a) => a.accion !== 'ignorar').length} cuentas
          </div>
          <div className={styles.asideOtherLine}>
            <strong>Personal</strong> · {s.opciones.crearNominaActiva ? 'nómina ' : ''}
            {s.opciones.crearActividadAutonoma ? '+ actividad' : ''}
            {!s.opciones.crearNominaActiva && !s.opciones.crearActividadAutonoma ? 'datos del titular' : ' activas'}
          </div>
          <div className={styles.asideOtherLine}>
            <strong>Fiscal</strong> · {decls.length} ejercicios cargados
          </div>
        </div>
        <div className={styles.asideStatus}>
          <div className={styles.asideStatusLab}>Operación final</div>
          <div className={styles.asideStatusText}>
            Al pulsar Importar, ATLAS procesa cada ejercicio cronológicamente para que el dato más
            reciente gane.
          </div>
        </div>
      </aside>
    );
  }

  // ── Genérico (fallback) ──
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
