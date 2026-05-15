/**
 * FiscalInmueblePage · F3 inmueble fiscal del año
 * Ruta · `/fiscal/ejercicio/:anio/inmueble/:id`
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4.
 * Mockup canónico · docs/audit-inputs/atlas-fiscal-v3.html#page-inmueble.
 *
 * Página NUEVA (no reemplaza nada · sub-tarea 4 §6.1 pre-flight confirma
 * que no existía).
 *
 * Datos:
 *   · `calculateFiscalSummaryExtended(propertyId, año)` (sub-tarea 1)
 *   · `getAmortizacionAcumulada(propertyId, año)` (helper local)
 *   · `resolverDatosEjercicio(año)` para el estado del ejercicio
 *   · `db.get('properties', id)` para metadatos del inmueble
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { initDB } from '../../../services/db';
import type { Property } from '../../../services/db';
import {
  calculateFiscalSummaryExtended,
  type FiscalSummaryExtended,
} from '../../../services/fiscalSummaryService';
import {
  resolverDatosEjercicio,
  type DatosFiscalesEjercicio,
} from '../../../services/fiscalResolverService';
import {
  buildInmuebleSecciones,
  type InmuebleSeccionesData,
} from './helpers/inmuebleCasillasService';
import {
  getAmortizacionAcumulada,
  type AmortizacionAcumuladaData,
} from './helpers/amortizacionAcumuladaService';
import InmuebleFiscalHeader from './InmuebleFiscalHeader';
import InmuebleFiscalKpiStrip from './InmuebleFiscalKpiStrip';
import ModoDeclaracionCard from './ModoDeclaracionCard';
import OptimizacionesNote, { type OptimizacionLinea } from './OptimizacionesNote';
import EjercicioBoxSection from './EjercicioBoxSection';
import AmortizacionAcumuladaTable from './AmortizacionAcumuladaTable';
import ejercStyles from './FiscalEjercicioPage.module.css';

const PRESCRIPCION_AÑOS = 4;

function yaPrescrito(añoEjercicio: number, hoy: Date): boolean {
  const fecha = new Date(Date.UTC(añoEjercicio + 1 + PRESCRIPCION_AÑOS, 5, 30));
  const fechaIso = fecha.toISOString().slice(0, 10);
  const hoyIso = hoy.toISOString().slice(0, 10);
  return fechaIso < hoyIso;
}

function fmtEur(n: number): string {
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} €`;
}

function buildOptimizacionesLineas(
  ext: FiscalSummaryExtended,
  seccionesData: InmuebleSeccionesData,
): OptimizacionLinea[] {
  const lineas: OptimizacionLinea[] = [];

  // Reducción Ley Vivienda detectada
  if (ext.box0150 > 0 && ext.porcentajeReduccion > 0) {
    lineas.push({
      titulo: `Reducción del ${ext.porcentajeReduccion}% Ley Vivienda aplicada automáticamente.`,
      detalle: `Beneficio · ${fmtEur(ext.box0150)} sustraídos del rendimiento neto antes de tributar.`,
    });
  }

  // Aplicación máxima de arrastres entrantes
  const disp = ext.box0103 ?? 0;
  const apl = ext.box0104 ?? 0;
  if (disp > 0) {
    const pct = disp > 0 ? Math.round((apl / disp) * 100) : 0;
    lineas.push({
      titulo: 'Aplicación de arrastres entrantes.',
      detalle: `Disponible ${fmtEur(disp)} · aplicado ${fmtEur(apl)} (${pct}%).`,
    });
  }

  // Método de prorrateo en modo III
  if (seccionesData.modoDeclaracion === 'III' && seccionesData.metodoProrrateo) {
    lineas.push({
      titulo: 'Prorrateo más beneficioso escogido entre 4 métodos legales.',
      detalle: 'ATLAS evalúa días-habitación · superficie · ingresos · y aplica el que minimiza el rendimiento neto reducido.',
    });
  }

  return lineas;
}

const FiscalInmueblePage: React.FC = () => {
  const navigate = useNavigate();
  const { anio, id } = useParams<{ anio: string; id: string }>();
  const año = Number(anio);
  const propertyId = Number(id);

  const [property, setProperty] = useState<Property | null>(null);
  const [extSummary, setExtSummary] = useState<FiscalSummaryExtended | null>(null);
  const [datosEj, setDatosEj] = useState<DatosFiscalesEjercicio | null>(null);
  const [secciones, setSecciones] = useState<InmuebleSeccionesData | null>(null);
  const [amortAcum, setAmortAcum] = useState<AmortizacionAcumuladaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const hoy = useMemo(() => new Date(), []);

  const cargar = useCallback(async () => {
    if (!Number.isFinite(año) || !Number.isFinite(propertyId)) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    try {
      setLoading(true);
      const db = await initDB();
      const prop = (await db.get('properties', propertyId)) as Property | undefined;
      if (!prop) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProperty(prop);

      const [ext, datos, amort] = await Promise.all([
        calculateFiscalSummaryExtended(propertyId, año),
        resolverDatosEjercicio(año),
        getAmortizacionAcumulada(propertyId, año),
      ]);
      setExtSummary(ext);
      setDatosEj(datos);
      setSecciones(buildInmuebleSecciones(ext, prop));
      setAmortAcum(amort);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[fiscal v2] error cargando inmueble F3', propertyId, año, err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [año, propertyId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return (
      <div className={ejercStyles.page}>
        <div className={ejercStyles.empty}>Cargando ficha fiscal del inmueble…</div>
      </div>
    );
  }

  if (notFound || !property || !extSummary || !datosEj || !secciones) {
    return (
      <div className={ejercStyles.page}>
        <div className={ejercStyles.empty}>
          No se encontró el inmueble {propertyId} para el ejercicio {año}.
        </div>
      </div>
    );
  }

  const esPrescrito = datosEj.estado === 'declarado' && yaPrescrito(año, hoy);

  // KPIs · ingresos (0102) · Σ gastos aplicados · rendimiento neto reducido (0154)
  const gastos = secciones.secciones[2]?.total ?? null;
  const gastosAbs = gastos !== null ? Math.abs(gastos) : null;
  const amortInmuebleTotal = secciones.secciones[3]?.total ?? null;
  const amortAbs = amortInmuebleTotal !== null ? Math.abs(amortInmuebleTotal) : 0;
  const arrastresAplicados = extSummary.box0104 ?? 0;
  const gastosAplicadosKpi = gastosAbs !== null
    ? Math.round((gastosAbs + amortAbs + arrastresAplicados) * 100) / 100
    : null;

  const optLineas = buildOptimizacionesLineas(extSummary, secciones);

  // Contratos del año · informativo en header
  const numContratos = (() => {
    if (!datosEj.declaracionCompleta) return undefined;
    const inm = datosEj.declaracionCompleta.baseGeneral?.rendimientosInmuebles
      ?.find((i) => i.inmuebleId === propertyId);
    if (!inm) return undefined;
    // No tenemos campo directo · estimamos por días/ingresos (heurística simple)
    return undefined;
  })();

  return (
    <div className={`${ejercStyles.page} ${esPrescrito ? ejercStyles.pageOpacity60 : ''}`}>
      <InmuebleFiscalHeader
        property={property}
        año={año}
        estadoEjercicio={datosEj.estado}
        diasArrendado={secciones.diasArrendado}
        diasDisposicion={secciones.diasDisposicion}
        numContratos={numContratos}
        esPrescrito={esPrescrito}
        onBack={() => navigate(`/fiscal/ejercicio/${año}`)}
        onGoDashboard={() => navigate('/fiscal')}
        onGoEjercicio={() => navigate(`/fiscal/ejercicio/${año}`)}
      />

      <InmuebleFiscalKpiStrip
        ingresos={extSummary.box0102}
        gastosAplicados={gastosAplicadosKpi}
        rendimientoNetoReducido={extSummary.box0154}
        porcentajeReduccion={secciones.porcentajeReduccion}
        diasArrendado={secciones.diasArrendado}
        numContratos={numContratos}
      />

      <ModoDeclaracionCard
        modo={secciones.modoDeclaracion}
        metodoProrrateo={secciones.metodoProrrateo}
        habitaciones={property.alquilerPorHabitaciones?.numeroHabitaciones ?? property.bedrooms}
      />

      <OptimizacionesNote
        inmuebleId={propertyId}
        año={año}
        lineas={optLineas}
      />

      {secciones.secciones.map((section, idx) => (
        <EjercicioBoxSection
          key={`f3-section-${idx}-${section.letter}`}
          section={section}
        />
      ))}

      {amortAcum && (
        <AmortizacionAcumuladaTable
          rows={amortAcum.rows}
          acumuladoCierre={amortAcum.acumuladoCierreEjercicio}
          añoCorte={amortAcum.añoCorte}
        />
      )}
    </div>
  );
};

export default FiscalInmueblePage;
