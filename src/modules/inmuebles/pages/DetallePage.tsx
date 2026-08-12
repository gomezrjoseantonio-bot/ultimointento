import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import {
  EmptyState,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import pageHeadStyles from '../../../design-system/v5/PageHead.module.css';
import {
  listarCompromisos,
  eliminarCompromiso,
} from '../../../services/personal/compromisosRecurrentesService';
import { regenerateForecastsForward } from '../../../services/treasuryBootstrapService';
import type { InmueblesOutletContext } from '../InmueblesContext';
import type { Contract } from '../../../services/db';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import { getTipoActivoEffective, TIPO_ACTIVO_LABELS } from '../../../types/tipoActivo';
import { ListadoGastosRecurrentes } from '../../shared/components/ListadoGastos';
import { TIPOS_GASTO_INMUEBLE_V2 } from '../wizards/utils/tiposDeGastoInmueble';
import { catalogoSugeridoPorModalidad } from '../wizards/utils/catalogoModalidadInmueble';
import {
  deleteInmuebleWithCascade,
  previewDeleteInmuebleCascade,
  summarizeCascadeReport,
  type DeleteInmuebleCascadeReport,
} from '../../../services/inmuebleDeleteService';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import ImportValoracionesWizard from '../../../components/valoraciones/ImportValoracionesWizard';
import SeccionHistoricoFiscal from '../components/SeccionHistoricoFiscal';
import { referenciaInmueble } from '../utils/referenciaInmueble';
import GastosResumenInmueble from '../components/GastosResumenInmueble';
import GastosRegistradosInmueble from '../components/GastosRegistradosInmueble';
import EditarRegistroInmuebleModal from '../components/EditarRegistroInmuebleModal';
import RentabilidadInmueble from '../components/RentabilidadInmueble';
import PatrimonioResumenInmueble from '../components/PatrimonioResumenInmueble';
import {
  calcularResumenGastosInmueble,
  construirListaVisualGastosInmueble,
} from '../adapters/gastosInmuebleAdapter';
import {
  calcularPatrimonioInmueble,
  type FinanciacionLineaInmueble,
  type ValoracionPunto,
} from '../adapters/patrimonioInmuebleAdapter';
import { calcularRentabilidadInmueble } from '../adapters/rentabilidadInmuebleAdapter';
import { calcularRentasNetasDeclaradasAcumuladas } from '../adapters/rentasDeclaradasInmueble';
import { valoracionesService } from '../../../services/valoracionesService';
import { getFinanciacionInmueble } from '../../../services/financiacionInmuebleService';
import { estimarGastoAnualCompromiso } from '../utils/estimacionGastoCompromiso';
import { cargarIngresosCobradosAnual } from '../utils/cargarIngresosCobrados';
import { useRegistrosInmueble } from '../hooks/useRegistrosInmueble';
import styles from './DetallePage.module.css';


type Tab = 'patrimonio' | 'gastos' | 'rentabilidad' | 'fiscalidad' | 'documentos';
type GastosSubTab = 'resumen' | 'registrados' | 'recurrentes';

const isContractActiveAt = (c: Contract, today: Date): boolean => {
  if (!c.fechaInicio || !c.fechaFin) return false;
  const ini = new Date(c.fechaInicio);
  const fin = new Date(c.fechaFin);
  return !Number.isNaN(ini.getTime()) && !Number.isNaN(fin.getTime()) && ini <= today && today <= fin;
};

const resolveTab = (param: string | null): Tab => {
  if (param === 'gastos') return 'gastos';
  if (param === 'fiscalidad') return 'fiscalidad';
  if (param === 'documentos') return 'documentos';
  if (param === 'rentabilidad') return 'rentabilidad';
  return 'patrimonio';
};

const DetallePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);
  const { properties, contracts, reload } = useOutletContext<InmueblesOutletContext>();
  // Permite abrir directamente una pestaña vía `?tab=gastos` (p. ej. desde el
  // onboarding, que ya no enruta a un wizard sino a la tabla de gastos).
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tabInicial: Tab = resolveTab(tabParam);
  const [tab, setTab] = useState<Tab>(tabInicial);
  const [gastosSubTab, setGastosSubTab] = useState<GastosSubTab>('resumen');
  const [gastos, setGastos] = useState<CompromisoRecurrente[]>([]);
  const [valoraciones, setValoraciones] = useState<ValoracionPunto[]>([]);
  const [financiacion, setFinanciacion] = useState<FinanciacionLineaInmueble[]>([]);
  // Fase 7 · renta cobrada del ejercicio (Tesorería) · undefined = aún sin cargar.
  const [ingresosCobrados, setIngresosCobrados] = useState<number | undefined>(undefined);
  const [rentasDeclaradas, setRentasDeclaradas] = useState<{
    rentasNetasAcumuladas: number;
    desdeAnio: number | null;
  }>({ rentasNetasAcumuladas: 0, desdeAnio: null });
  const [pendingDelete, setPendingDelete] = useState<DeleteInmuebleCascadeReport | null>(null);
  const [isDeletingInmueble, setIsDeletingInmueble] = useState(false);
  // T-VALORACIONES PR3 · wizard de importación de histórico de valoraciones.
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Fase 8 · operativa de Registrados (carga + editar/borrar con trazabilidad).
  const registros = useRegistrosInmueble(propertyId);
  const { gastosReales, mejoras, mobiliario } = registros;

  useEffect(() => {
    void listarCompromisos({ ambito: 'inmueble', inmuebleId: propertyId }).then(setGastos);

    // Patrimonio · serie de valoraciones (última = valor actual).
    void valoracionesService
      .getEvolucionActivo('inmueble', propertyId)
      .then((serie) =>
        setValoraciones(serie.map((v) => ({ fecha: v.fecha_valoracion, valor: v.valor }))),
      )
      .catch(() => setValoraciones([]));

    // Patrimonio · financiación vinculada imputada al inmueble (deuda pendiente).
    void getFinanciacionInmueble(propertyId)
      .then(setFinanciacion)
      .catch(() => setFinanciacion([]));

    // Rentabilidad · renta cobrada del ejercicio en curso (Tesorería).
    void cargarIngresosCobradosAnual(propertyId, new Date().getFullYear())
      .then(setIngresosCobrados)
      .catch(() => setIngresosCobrados(undefined));

    // Patrimonio · rentas netas declaradas acumuladas (IRPF) para la ganancia.
    void calcularRentasNetasDeclaradasAcumuladas(propertyId)
      .then(setRentasDeclaradas)
      .catch(() => setRentasDeclaradas({ rentasNetasAcumuladas: 0, desdeAnio: null }));
  }, [propertyId]);

  const reloadGastos = useCallback(() => {
    void listarCompromisos({ ambito: 'inmueble', inmuebleId: propertyId }).then(setGastos);
  }, [propertyId]);

  const handleDeleteGasto = useCallback(
    async (c: CompromisoRecurrente) => {
      if (!c.id) return;
      await eliminarCompromiso(c.id);
      await regenerateForecastsForward({ force: true }).catch(() => {});
      const updated = await listarCompromisos({ ambito: 'inmueble', inmuebleId: propertyId });
      setGastos(updated);
    },
    [propertyId],
  );

  const property = useMemo(
    () => properties.find((p) => p.id === propertyId),
    [properties, propertyId],
  );
  const propertyContracts = useMemo(
    () => contracts.filter((c) => c.inmuebleId === propertyId),
    [contracts, propertyId],
  );
  const today = useMemo(() => new Date(), []);
  const contratosActivos = useMemo(
    () => propertyContracts.filter((c) => isContractActiveAt(c, today)),
    [propertyContracts, today],
  );

  // §3.3 · conceptos sugeridos por la modalidad del contrato (se resaltan al
  // añadir un gasto). ATLAS ya sabe la modalidad · no se pregunta.
  const conceptosSugeridos = useMemo(() => {
    const modalidad = contratosActivos[0]?.modalidad ?? propertyContracts[0]?.modalidad;
    const unidadTipo =
      property?.modoExplotacion === 'por_habitaciones' ? ('habitacion' as const) : ('vivienda' as const);
    return catalogoSugeridoPorModalidad(modalidad, unidadTipo).precargados;
  }, [contratosActivos, propertyContracts, property]);

  // Precalculados para RentabilidadInmueble — deben estar antes del early return.
  const rentaMensual = contratosActivos.reduce(
    (sum, c) => sum + (c.rentaMensual ?? 0),
    0,
  );
  const gastosVisuales = useMemo(
    () =>
      construirListaVisualGastosInmueble({
        inmuebleId: propertyId,
        compromisosRecurrentes: gastos,
        gastosReales,
        mejoras,
        mobiliario,
      }),
    [propertyId, gastos, gastosReales, mejoras, mobiliario],
  );
  const resumenGastosRentabilidad = useMemo(
    () => calcularResumenGastosInmueble(gastosVisuales, today.getFullYear()),
    [gastosVisuales, today],
  );
  const gastosPrevistosRentabilidad = useMemo(
    () =>
      gastos.reduce<number>((sum, compromiso) => {
        const estimado = estimarGastoAnualCompromiso(compromiso, rentaMensual);
        return sum + (estimado ?? 0);
      }, 0),
    [gastos, rentaMensual],
  );
  const patrimonioResumen = useMemo(
    () =>
      calcularPatrimonioInmueble({
        acquisitionCosts: property?.acquisitionCosts,
        valoraciones,
        financiacion,
        mejoras,
        mobiliario,
      }),
    [property?.acquisitionCosts, valoraciones, financiacion, mejoras, mobiliario],
  );
  const cuotaPrestamoAnual = useMemo(
    () =>
      financiacion.length > 0
        ? financiacion.reduce((sum, l) => sum + l.cuotaMensual, 0) * 12
        : undefined,
    [financiacion],
  );
  // Patrimonio · coste mensual de tener el activo (hipoteca + gastos recurrentes).
  const costePropiedadMensual = useMemo(
    () => ({
      hipoteca: financiacion.reduce((sum, l) => sum + l.cuotaMensual, 0),
      mantenimiento: (resumenGastosRentabilidad.mantener.previsto ?? 0) / 12,
      explotacion: (resumenGastosRentabilidad.explotar.previsto ?? 0) / 12,
    }),
    [financiacion, resumenGastosRentabilidad],
  );
  // Patrimonio · ganancia acumulada (rentas netas declaradas + año de arranque).
  const gananciaAcumuladaDatos = useMemo(
    () => ({
      rentasAcumuladas: rentasDeclaradas.rentasNetasAcumuladas,
      desdeAnio: rentasDeclaradas.desdeAnio,
    }),
    [rentasDeclaradas],
  );
  const rentabilidadResumen = useMemo(
    () =>
      calcularRentabilidadInmueble({
        costeAdquisicion: patrimonioResumen.costeAdquisicion,
        ejercicio: today.getFullYear(),
        ingresosPrevistosAnual: rentaMensual > 0 ? rentaMensual * 12 : undefined,
        ingresosCobradosAnual: ingresosCobrados,
        gastosPrevistosAnual: gastosPrevistosRentabilidad > 0 ? gastosPrevistosRentabilidad : undefined,
        gastosPagadosAnual: resumenGastosRentabilidad.total.realOrdinario,
        cuotaPrestamoAnual,
      }),
    [
      patrimonioResumen.costeAdquisicion,
      today,
      rentaMensual,
      ingresosCobrados,
      gastosPrevistosRentabilidad,
      resumenGastosRentabilidad,
      cuotaPrestamoAnual,
    ],
  );

  if (!property) {
    return (
      <EmptyState
        icon={<Icons.Inmuebles size={20} />}
        title="Inmueble no encontrado"
        sub={`No existe inmueble con id ${id}.`}
        ctaLabel="← volver al listado"
        onCtaClick={() => navigate('/inmuebles')}
      />
    );
  }

  const tipoActivo = getTipoActivoEffective(property);
  const esPiso = tipoActivo === 'piso';
  const habitaciones = property.bedrooms || 1;

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'patrimonio', label: 'Patrimonio' },
    { key: 'gastos', label: 'Gastos' },
    { key: 'rentabilidad', label: 'Rentabilidad' },
    { key: 'fiscalidad', label: 'Fiscalidad' },
    { key: 'documentos', label: 'Documentos', count: property.documents?.length },
  ];

  const astId = referenciaInmueble(property);

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="breadcrumb">
        <button type="button" onClick={() => navigate('/inmuebles')}>
          <Icons.ChevronLeft size={12} strokeWidth={2} />
          Volver
        </button>
        <span>·</span>
        <button type="button" onClick={() => navigate('/inmuebles')}>
          Inmuebles
        </button>
        <Icons.ChevronRight size={11} strokeWidth={2} aria-hidden />
        <span className={styles.current}>{property.alias}</span>
      </nav>

      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroLeftRow}>
            {property.foto && (
              <div className={styles.heroPhoto}>
                <img src={property.foto} alt={property.alias} />
              </div>
            )}
          <div className={styles.heroLeft}>
            <div className={styles.heroAst}>{astId}</div>
            <div className={styles.heroName}>{property.alias}</div>
            <div className={styles.heroLoc}>
              <Icons.MapPin size={13} strokeWidth={1.8} />
              {property.address} · {property.municipality} · {property.province}
            </div>
            <div className={styles.heroChips}>
              <span className={styles.heroChip}>
                {esPiso
                  ? habitaciones > 1
                    ? 'Por habitaciones'
                    : 'Piso completo'
                  : TIPO_ACTIVO_LABELS[tipoActivo]}
              </span>
              {esPiso && <span className={styles.heroChip}>{habitaciones} hab</span>}
              {property.squareMeters > 0 && (
                <span className={styles.heroChip}>{property.squareMeters} m²</span>
              )}
              {esPiso && property.bathrooms != null && property.bathrooms > 0 && (
                <span className={styles.heroChip}>{property.bathrooms} baños</span>
              )}
              {property.cadastralReference && (
                <span className={styles.heroChip}>
                  Cat · {property.cadastralReference.slice(0, 7)}…
                </span>
              )}
            </div>
          </div>
          </div>
          <div className={styles.heroActions}>
            <button
              type="button"
              className={`${pageHeadStyles.btn} ${pageHeadStyles.ghost}`}
              onClick={() => setShowImportWizard(true)}
            >
              <Icons.Upload size={14} strokeWidth={1.8} />
              Importar histórico
            </button>
            <button
              type="button"
              className={`${pageHeadStyles.btn} ${pageHeadStyles.ghost}`}
              onClick={() => navigate(`/inmuebles/${property.id}/editar`)}
            >
              <Icons.Edit size={14} strokeWidth={1.8} />
              Editar
            </button>
            <button
              type="button"
              className={`${pageHeadStyles.btn} ${pageHeadStyles.ghost}`}
              onClick={async () => {
                if (property.id == null) return;
                try {
                  const report = await previewDeleteInmuebleCascade(property.id);
                  setPendingDelete(report);
                } catch (err) {
                  console.error('Error preparing inmueble deletion', err);
                  showToastV5('No se pudo preparar el borrado del inmueble');
                }
              }}
            >
              <Icons.Delete size={14} strokeWidth={1.8} />
              Eliminar
            </button>
            {property.state !== 'vendido' && (
              <button
                type="button"
                className={`${pageHeadStyles.btn} ${pageHeadStyles.ghost}`}
                onClick={() => navigate(`/gestion/inmuebles/${property.id}/vender`)}
              >
                <Icons.HandCoins size={14} strokeWidth={1.8} />
                Vender
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabsBar} role="tablist" aria-label="Navegación ficha inmueble">
        {tabs.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? styles.active : ''}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={styles.tabCount}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'patrimonio' && (
        <>
          <div style={{ marginTop: 8, marginBottom: 20 }}>
            <PatrimonioResumenInmueble
              resumen={patrimonioResumen}
              gananciaAcumulada={gananciaAcumuladaDatos}
              costePropiedad={costePropiedadMensual}
              onImportarValoraciones={() => setShowImportWizard(true)}
              onVerFinanciacion={(prestamoId) =>
                navigate(prestamoId ? `/financiacion/${prestamoId}` : '/financiacion')
              }
            />
          </div>
        </>
      )}

      {tab === 'gastos' && (
        <div style={{ marginTop: 8 }}>
          {/* ── Selector interno de vistas ── */}
          <div
            className={styles.gastosSubTabs}
            role="tablist"
            aria-label="Vistas de gastos del inmueble"
          >
            {(
              [
                { key: 'resumen', label: 'Resumen' },
                { key: 'registrados', label: 'Registrados' },
                { key: 'recurrentes', label: 'Recurrentes' },
              ] as Array<{ key: GastosSubTab; label: string }>
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={gastosSubTab === key}
                aria-controls={`gastos-panel-${key}`}
                id={`gastos-tab-${key}`}
                className={styles.gastosSubTab}
                onClick={() => setGastosSubTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Resumen ── */}
          {gastosSubTab === 'resumen' && (
            <div
              role="tabpanel"
              id="gastos-panel-resumen"
              aria-labelledby="gastos-tab-resumen"
            >
              <GastosResumenInmueble
                inmuebleId={propertyId}
                compromisos={gastos}
                gastosReales={gastosReales}
                mejoras={mejoras}
                mobiliario={mobiliario}
              />
            </div>
          )}

          {/* ── Registrados ── */}
          {gastosSubTab === 'registrados' && (
            <div
              role="tabpanel"
              id="gastos-panel-registrados"
              aria-labelledby="gastos-tab-registrados"
            >
              <GastosRegistradosInmueble
                inmuebleId={propertyId}
                gastosReales={gastosReales}
                mejoras={mejoras}
                mobiliario={mobiliario}
                onIrARecurrentes={() => setGastosSubTab('recurrentes')}
                ejerciciosBloqueados={registros.ejerciciosBloqueados}
                onEditar={registros.abrirEdicion}
                onBorrar={registros.abrirBorrado}
                onAlta={registros.abrirAlta}
              />
            </div>
          )}

          {/* ── Recurrentes ── */}
          {gastosSubTab === 'recurrentes' && (
            <div
              role="tabpanel"
              id="gastos-panel-recurrentes"
              aria-labelledby="gastos-tab-recurrentes"
            >
              <p className={styles.gastosRecurrentesDesc}>
                Patrones que ATLAS proyecta en Tesorería
              </p>
              <ListadoGastosRecurrentes
                catalog={TIPOS_GASTO_INMUEBLE_V2}
                compromisos={gastos}
                mode="inmueble"
                inmuebleId={propertyId}
                onDelete={handleDeleteGasto}
                onReload={reloadGastos}
                contextoNombre={property.alias}
                conceptosSugeridos={conceptosSugeridos}
                inmueblesDisponibles={properties
                  .filter((p): p is typeof p & { id: number } => p.id != null)
                  .map((p) => ({ id: p.id, label: p.alias }))}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'rentabilidad' && (
        <div style={{ marginTop: 8 }}>
          <RentabilidadInmueble resumen={rentabilidadResumen} />
        </div>
      )}

      {tab === 'fiscalidad' && (
        <div style={{ marginTop: 8 }}>
          <SeccionHistoricoFiscal inmuebleId={propertyId} />
        </div>
      )}

      {tab === 'documentos' && (
        <div className={styles.placeholder}>
          <strong>Documentos</strong>
          Pestaña en migración a UI v5 · funcionalidad pendiente de sub-tarea follow-up.
          Datos del usuario intactos en stores · UI consolidada en próxima iteración.
        </div>
      )}

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => { if (!isDeletingInmueble) setPendingDelete(null); }}
        onConfirm={async () => {
          if (property.id == null) return;
          setIsDeletingInmueble(true);
          try {
            const report = await deleteInmuebleWithCascade(property.id);
            const summary = summarizeCascadeReport(report);
            const sufijo = summary.length > 0 ? ` · ${summary.join(' · ')}` : '';
            showToastV5(`Inmueble eliminado${sufijo}`);
            setPendingDelete(null);
            reload();
            navigate('/inmuebles');
          } catch (err) {
            console.error('Error deleting inmueble', err);
            showToastV5('Error al eliminar el inmueble');
          } finally {
            setIsDeletingInmueble(false);
          }
        }}
        title={`Eliminar inmueble · ${property.alias}`}
        message={
          pendingDelete
            ? (() => {
                const items = summarizeCascadeReport(pendingDelete);
                if (items.length === 0) {
                  return `Vas a eliminar el inmueble "${property.alias}". No tiene entidades dependientes. Esta acción no se puede deshacer.`;
                }
                return `Vas a eliminar el inmueble "${property.alias}". Se eliminarán también: ${items.join(' · ')}. Esta acción no se puede deshacer.`;
              })()
            : ''
        }
        confirmText="Eliminar definitivamente"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingInmueble}
      />

      {showImportWizard && property.id != null && (
        <ImportValoracionesWizard
          activoId={String(property.id)}
          tipoActivo="inmueble"
          activoNombre={property.alias || property.address || `Inmueble ${property.id}`}
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => {
            setShowImportWizard(false);
            reload();
          }}
        />
      )}

      {registros.registroEnEdicion && (
        <EditarRegistroInmuebleModal
          registro={registros.registroEnEdicion}
          guardando={registros.guardando}
          onCancel={() => { if (!registros.guardando) registros.cerrarEdicion(); }}
          onGuardar={registros.guardar}
        />
      )}

      {registros.tipoAlta && (
        <EditarRegistroInmuebleModal
          modo="crear"
          tipoCrear={registros.tipoAlta}
          guardando={registros.guardando}
          onCancel={() => { if (!registros.guardando) registros.cerrarAlta(); }}
          onGuardar={registros.crear}
        />
      )}

      <ConfirmationModal
        isOpen={registros.registroEnBorrado !== null}
        onClose={() => { if (!registros.borrando) registros.cerrarBorrado(); }}
        onConfirm={registros.confirmarBorrado}
        title="Eliminar registro"
        message={
          registros.registroEnBorrado
            ? `Vas a eliminar "${
                registros.registroEnBorrado.tipo === 'real'
                  ? registros.registroEnBorrado.registro.concepto
                  : registros.registroEnBorrado.registro.descripcion
              }". Esta acción no se puede deshacer y también retira su rastro en Tesorería.`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={registros.borrando}
      />
    </>
  );
};

export default DetallePage;
