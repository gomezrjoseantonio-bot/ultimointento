/**
 * FiscalEjercicioPage · F2 detalle del ejercicio fiscal `/fiscal/ejercicio/:anio`.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3.
 * Mockup canónico · docs/audit-inputs/atlas-fiscal-v3.html#page-ejercicio.
 *
 * Reemplaza la página vieja `src/modules/fiscal/pages/DetalleEjercicioPage.tsx`
 * (consumía `FiscalOutletContext`). Esta es standalone · no depende del
 * shell FiscalPage (que ya oculta su PageHead para `/fiscal/ejercicio/:anio`
 * desde sub-tarea 2).
 *
 * Datos · `fiscalResolverService.resolverDatosEjercicio(año)` orquesta
 * `fiscalSummaryService` · `aeatAmortizationService` · `gananciaPatrimonialService` ·
 * etc · ya existentes. Componemos 8 secciones A-H + 3 tabs auxiliares
 * (Versiones · Pagos · Documentos).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  resolverDatosEjercicio,
  type DatosFiscalesEjercicio,
} from '../../../services/fiscalResolverService';
import { getEjercicio } from '../../../services/ejercicioResolverService';
import type { DeudaFiscal } from '../../../services/db';
import {
  buildSecciones,
  calcularTipoMedio,
  type SeccionesData,
  type BoxSection,
} from './helpers/ejercicioCasillasService';
import {
  getDocumentosDelEjercicio,
  getVentasDelAño,
  getDeudasDelEjercicio,
  getCuotaDiferencialDelEjercicio,
  type VentaRow,
  type CuotaDiferencialInfo,
} from './helpers/ejercicioDocumentosService';
import EjercicioHeader from './EjercicioHeader';
import EjercicioKpiStrip from './EjercicioKpiStrip';
import EjercicioBoxSection from './EjercicioBoxSection';
import InmuebleGroupCard from './InmuebleGroupCard';
import EjercicioVersionesTab, { type VersionRow } from './EjercicioVersionesTab';
import EjercicioPagosTab from './EjercicioPagosTab';
import EjercicioDocumentosTab, { type DocumentoRow } from './EjercicioDocumentosTab';
import styles from './FiscalEjercicioPage.module.css';

type TabKey = 'modelo100' | 'versiones' | 'pagos' | 'documentos';

const PRESCRIPCION_AÑOS = 4;

function calcularFechaPrescripcion(añoEjercicio: number): string {
  const fecha = new Date(Date.UTC(añoEjercicio + 1 + PRESCRIPCION_AÑOS, 5, 30));
  return fecha.toISOString().slice(0, 10);
}

function yaPrescrito(añoEjercicio: number, hoy: Date): boolean {
  return new Date(calcularFechaPrescripcion(añoEjercicio)) < hoy;
}

function detectarParalela(d: DatosFiscalesEjercicio, coordAeat: { paralela?: unknown } | null | undefined): boolean {
  const fuente = d.fuente as string;
  if (fuente === 'paralela' || fuente === 'paralela_aeat') return true;
  if (coordAeat?.paralela) return true;
  const decl = d.declaracionCompleta as unknown as { paralela?: unknown; versiones?: unknown[] } | null;
  return Boolean(decl?.paralela ?? (decl?.versiones && decl.versiones.length > 1));
}

function buildVersiones(
  d: DatosFiscalesEjercicio,
  fechaImportacion: string | undefined,
  fuente: DatosFiscalesEjercicio['fuente'],
  tieneParalela: boolean,
): VersionRow[] {
  const versiones: VersionRow[] = [];
  if (d.estado === 'declarado' || d.estado === 'pendiente') {
    versiones.push({
      version: 'v1',
      origen: fuente === 'xml_aeat'
        ? 'XML AEAT'
        : fuente === 'pdf_aeat'
          ? 'PDF AEAT'
          : 'Atlas',
      fecha: fechaImportacion?.slice(0, 10),
      resultado: d.resultado,
      nota: 'original presentada',
    });
  }
  if (tieneParalela) {
    versiones.push({
      version: 'v2',
      origen: 'Paralela AEAT',
      fecha: fechaImportacion?.slice(0, 10),
      resultado: d.resultado,
      nota: 'corrección posterior',
    });
  }
  return versiones;
}

interface VentaSeccionEProps {
  ventas: VentaRow[];
  año: number;
  onSelectVenta: (ventaId: number) => void;
}

const VentaSeccionE: React.FC<VentaSeccionEProps> = ({ ventas, año, onSelectVenta }) => {
  return (
    <div className={styles.inmueblesContainer}>
      {ventas.map((v) => (
        <div key={v.id} className={styles.inmuebleGroup}>
          <button
            type="button"
            className={styles.inmuebleGroupHd}
            onClick={() => onSelectVenta(v.id)}
            aria-label={`Abrir detalle de la venta ${v.alias} ${año}`}
          >
            <div>
              <div className={styles.inmuebleGroupName}>Venta de {v.alias}</div>
              <div className={styles.inmuebleGroupMeta}>
                {new Date(v.fechaVenta).toLocaleDateString('es-ES')}
              </div>
            </div>
            <div>
              <div className={`${styles.inmuebleGroupAmt} ${(v.ganancia ?? 0) < 0 ? styles.neg : ''}`}>
                {v.ganancia === null
                  ? '—'
                  : `${new Intl.NumberFormat('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(v.ganancia)} €`}
              </div>
              <div className={styles.inmuebleGroupAmtSub}>ganancia patrimonial</div>
            </div>
            <div className={styles.inmuebleGroupLink}>Ver →</div>
          </button>
        </div>
      ))}
    </div>
  );
};

const FiscalEjercicioPage: React.FC = () => {
  const navigate = useNavigate();
  const { anio } = useParams<{ anio: string }>();
  const año = Number(anio);

  const [datos, setDatos] = useState<DatosFiscalesEjercicio | null>(null);
  const [seccionesData, setSeccionesData] = useState<SeccionesData | null>(null);
  const [coordAeat, setCoordAeat] = useState<{
    fechaImportacion?: string;
    fuenteImportacion?: 'xml' | 'pdf' | 'manual';
    paralela?: unknown;
  } | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [deudas, setDeudas] = useState<DeudaFiscal[]>([]);
  const [cuotaInfo, setCuotaInfo] = useState<CuotaDiferencialInfo>({ cuota: null, pagos: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('modelo100');

  const hoy = useMemo(() => new Date(), []);

  const cargar = useCallback(async () => {
    if (!Number.isFinite(año)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const d = await resolverDatosEjercicio(año);
      setDatos(d);
      setSeccionesData(buildSecciones(d));

      const [coord, docs, vs, ds, cuota] = await Promise.all([
        getEjercicio(año).catch(() => null),
        getDocumentosDelEjercicio(año),
        getVentasDelAño(año),
        getDeudasDelEjercicio(año),
        getCuotaDiferencialDelEjercicio(año, d.resultado),
      ]);
      setCoordAeat(coord?.aeat ?? null);
      setDocumentos(docs);
      setVentas(vs);
      setDeudas(ds);
      setCuotaInfo(cuota);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[fiscal v2] error cargando ejercicio', año, err);
    } finally {
      setLoading(false);
    }
  }, [año]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Reset tab al cambiar de ejercicio
  useEffect(() => {
    setActiveTab('modelo100');
  }, [año]);

  if (!Number.isFinite(año)) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>Ejercicio no válido.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>Cargando ejercicio {año}…</div>
      </div>
    );
  }

  if (!datos || !seccionesData) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>No se encontraron datos para el ejercicio {año}.</div>
      </div>
    );
  }

  const esPrescrito = datos.estado === 'declarado' && yaPrescrito(año, hoy);
  const tieneParalela = detectarParalela(datos, coordAeat);
  const tipoMedio = calcularTipoMedio(datos);

  const cuotaLiquidaTotal =
    (datos.resumen.cuotaLiquidaEstatal ?? 0) + (datos.resumen.cuotaLiquidaAutonomica ?? 0)
    || datos.casillas?.['0587'] || null;

  const versiones = buildVersiones(
    datos,
    coordAeat?.fechaImportacion,
    datos.fuente,
    tieneParalela,
  );

  // Sección E con ventas · sustituimos las rows del helper por cards de venta
  const seccionEVacia = seccionesData.secciones.find((s) => s.letter === 'E');
  const seccionE: BoxSection | null = ventas.length > 0
    ? {
      letter: 'E',
      title: `Ganancias y pérdidas patrimoniales · ${ventas.length} operación${ventas.length === 1 ? '' : 'es'}`,
      total: ventas.reduce((s, v) => s + (v.ganancia ?? 0), 0),
      rows: seccionEVacia?.rows ?? [],
    }
    : seccionEVacia ?? null;

  const pageClass = `${styles.page} ${esPrescrito ? styles.pageOpacity60 : ''}`;

  return (
    <div className={pageClass}>
      <EjercicioHeader
        año={año}
        datos={datos}
        tieneParalela={tieneParalela}
        fechaPresentacion={coordAeat?.fechaImportacion}
        prescribe={esPrescrito || datos.estado === 'en_curso' ? null : calcularFechaPrescripcion(año)}
        esPrescrito={esPrescrito}
        onBack={() => navigate('/fiscal')}
        onGoDashboard={() => navigate('/fiscal')}
        onGoAcciones={() => navigate(`/fiscal/configuracion?ejercicio=${año}`)}
      />

      <EjercicioKpiStrip
        resultado={datos.resultado}
        cuotaLiquida={cuotaLiquidaTotal}
        retenciones={datos.retenciones}
        tipoMedio={tipoMedio}
        estado={datos.estado}
      />

      <nav className={styles.tabs} role="tablist" aria-label="Secciones del ejercicio">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'modelo100'}
          className={`${styles.tab} ${activeTab === 'modelo100' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('modelo100')}
        >
          Modelo 100
          <span className={styles.tabCount}>8 secciones</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'versiones'}
          className={`${styles.tab} ${activeTab === 'versiones' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('versiones')}
        >
          Versiones
          <span className={styles.tabCount}>
            {versiones.length === 0 ? '—' : versiones.length > 1 ? 'v1·v2' : 'v1'}
          </span>
        </button>
        {!esPrescrito && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pagos'}
            className={`${styles.tab} ${activeTab === 'pagos' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('pagos')}
          >
            Pagos
            <span className={styles.tabCount}>{deudas.length + cuotaInfo.pagos.length}</span>
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'documentos'}
          className={`${styles.tab} ${activeTab === 'documentos' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('documentos')}
        >
          Documentos
          <span className={styles.tabCount}>{documentos.length}</span>
        </button>
      </nav>

      {activeTab === 'modelo100' && (
        <>
          {seccionesData.secciones.map((section) => {
            if (section.letter === 'B') {
              return (
                <EjercicioBoxSection key="B" section={section}>
                  <div className={styles.inmueblesContainer}>
                    {seccionesData.inmueblesB.map((inm) => (
                      <InmuebleGroupCard
                        key={inm.inmuebleId}
                        inmueble={inm}
                        onSelect={(id) => navigate(`/fiscal/ejercicio/${año}/inmueble/${id}`)}
                      />
                    ))}
                  </div>
                </EjercicioBoxSection>
              );
            }
            if (section.letter === 'E' && seccionE) {
              return (
                <EjercicioBoxSection
                  key="E"
                  section={seccionE}
                  defaultCollapsed={ventas.length === 0}
                >
                  {ventas.length > 0 && (
                    <VentaSeccionE
                      ventas={ventas}
                      año={año}
                      onSelectVenta={(ventaId) => navigate(`/fiscal/ejercicio/${año}/venta/${ventaId}`)}
                    />
                  )}
                </EjercicioBoxSection>
              );
            }
            return (
              <EjercicioBoxSection key={section.letter} section={section} />
            );
          })}
        </>
      )}

      {activeTab === 'versiones' && <EjercicioVersionesTab versiones={versiones} />}

      {activeTab === 'pagos' && (
        <EjercicioPagosTab
          cuotaDiferencial={cuotaInfo.cuota}
          pagosCuota={cuotaInfo.pagos}
          deudasVinculadas={deudas}
        />
      )}

      {activeTab === 'documentos' && (
        <EjercicioDocumentosTab documentos={documentos} />
      )}
    </div>
  );
};

export default FiscalEjercicioPage;
