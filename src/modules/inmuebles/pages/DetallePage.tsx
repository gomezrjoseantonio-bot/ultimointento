import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  PageHead,
  MoneyValue,
  DateLabel,
  EmptyState,
  Pill,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import {
  listarCompromisos,
  eliminarCompromiso,
} from '../../../services/personal/compromisosRecurrentesService';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import { computeMonthly } from '../../shared/utils/compromisoUtils';
import type { InmueblesOutletContext } from '../InmueblesContext';
import type { Contract } from '../../../services/db';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import { getTipoActivoEffective, TIPO_ACTIVO_LABELS } from '../../../types/tipoActivo';
import styles from './DetallePage.module.css';

type Tab = 'resumen' | 'contratos' | 'cobros' | 'gastos' | 'documentos' | 'fiscalidad';

const HABITACION_COLORS = [
  'var(--atlas-v5-room-green)',
  'var(--atlas-v5-room-red)',
  'var(--atlas-v5-room-yellow)',
  'var(--atlas-v5-room-blue)',
  'var(--atlas-v5-room-bw)',
];

const isContractActiveAt = (c: Contract, today: Date): boolean => {
  if (!c.fechaInicio || !c.fechaFin) return false;
  const ini = new Date(c.fechaInicio);
  const fin = new Date(c.fechaFin);
  return !Number.isNaN(ini.getTime()) && !Number.isNaN(fin.getTime()) && ini <= today && today <= fin;
};

const DetallePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);
  const { properties, contracts } = useOutletContext<InmueblesOutletContext>();
  const [tab, setTab] = useState<Tab>('resumen');
  const [gastos, setGastos] = useState<CompromisoRecurrente[]>([]);
  const [deleteGastoTarget, setDeleteGastoTarget] = useState<CompromisoRecurrente & { id: number } | null>(null);
  const [deletingGasto, setDeletingGasto] = useState(false);

  useEffect(() => {
    void listarCompromisos({ ambito: 'inmueble', inmuebleId: propertyId }).then(setGastos);
  }, [propertyId]);

  const handleDeleteGasto = useCallback(async () => {
    if (!deleteGastoTarget) return;
    setDeletingGasto(true);
    try {
      await eliminarCompromiso(deleteGastoTarget.id);
      showToastV5(`Gasto "${deleteGastoTarget.alias}" eliminado`, 'success');
      setDeleteGastoTarget(null);
      const updated = await listarCompromisos({ ambito: 'inmueble', inmuebleId: propertyId });
      setGastos(updated);
    } catch (err) {
      showToastV5(`Error al eliminar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setDeletingGasto(false);
    }
  }, [deleteGastoTarget, propertyId]);

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
  const rentaMensual = contratosActivos.reduce(
    (sum, c) => sum + (c.rentaMensual ?? 0),
    0,
  );
  const valorAdquisicion = property.acquisitionCosts?.price ?? 0;
  const rentabilidadBruta =
    valorAdquisicion > 0 ? (rentaMensual * 12 * 100) / valorAdquisicion : 0;

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'contratos', label: 'Contratos', count: propertyContracts.length },
    { key: 'cobros', label: 'Cobros' },
    { key: 'gastos', label: 'Gastos' },
    { key: 'documentos', label: 'Documentos', count: property.documents?.length },
    { key: 'fiscalidad', label: 'Fiscalidad' },
  ];

  const astId = `AST-${String(propertyId).padStart(2, '0')}`;

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
            <PageHead
              title=""
              actions={[
                {
                  label: 'Editar',
                  variant: 'ghost',
                  icon: <Icons.Edit size={14} strokeWidth={1.8} />,
                  onClick: () => navigate(`/inmuebles/${property.id}/editar`),
                },
                {
                  label: 'Nuevo contrato',
                  variant: 'gold',
                  icon: <Icons.Plus size={14} strokeWidth={2} />,
                  onClick: () =>
                    navigate(`/contratos/nuevo?inmueble=${property.id}`),
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className={styles.tabsBar} role="group" aria-label="Tabs detalle inmueble">
        {tabs.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              className={isActive ? styles.active : ''}
              onClick={() => setTab(t.key)}
              aria-pressed={isActive}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={styles.tabCount}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'resumen' && (
        <>
          <div className={styles.kpisRow}>
            <div className={`${styles.kpi} ${styles.gold}`}>
              <div className={styles.kpiLab}>Renta mensual</div>
              <div className={`${styles.kpiVal} ${styles.pos}`}>
                <MoneyValue value={rentaMensual} decimals={0} tone="pos" />
              </div>
              <div className={styles.kpiHint}>
                {esPiso
                  ? `${contratosActivos.length} de ${habitaciones} unidades activas`
                  : contratosActivos.length > 0
                    ? 'Ocupado'
                    : 'Libre'}
              </div>
            </div>
            <div className={`${styles.kpi} ${styles.pos}`}>
              <div className={styles.kpiLab}>Renta anual bruta</div>
              <div className={`${styles.kpiVal} ${styles.pos}`}>
                <MoneyValue value={rentaMensual * 12} decimals={0} tone="pos" />
              </div>
              <div className={styles.kpiHint}>
                {esPiso ? `${habitaciones} habitaciones · sin gastos` : 'sin gastos'}
              </div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLab}>Rentabilidad bruta</div>
              <div className={`${styles.kpiVal} ${styles.pos}`}>
                {rentabilidadBruta.toFixed(1)}%
              </div>
              <div className={styles.kpiHint}>
                sobre <MoneyValue value={valorAdquisicion} decimals={0} /> de adquisición
              </div>
            </div>
          </div>

          {esPiso && (
          <div className={styles.section}>
            <div className={styles.sectionHd}>
              <div>
                <div className={styles.sectionTitle}>
                  Habitaciones · {contratosActivos.length} / {habitaciones}
                </div>
                <div className={styles.sectionSub}>
                  estado actual de cada unidad arrendable
                </div>
              </div>
            </div>
            <div className={styles.habitacionesGrid}>
              {Array.from({ length: habitaciones }, (_, i) => {
                const contract = contratosActivos[i];
                const color = HABITACION_COLORS[i % HABITACION_COLORS.length];
                if (!contract) {
                  return (
                    <div key={i} className={`${styles.habCard} ${styles.vacant}`}>
                      <div className={styles.habHd}>
                        <span
                          className={styles.habNum}
                          style={{ background: 'var(--atlas-v5-line)', color: 'var(--atlas-v5-ink-4)' }}
                        >
                          {i + 1}
                        </span>
                        <span className={`${styles.habTenant} ${styles.muted}`}>
                          Habitación libre
                        </span>
                      </div>
                      <div className={styles.habMeta}>disponible</div>
                    </div>
                  );
                }
                return (
                  <div key={contract.id ?? i} className={styles.habCard}>
                    <div className={styles.habHd}>
                      <span className={styles.habNum} style={{ background: color }}>
                        {i + 1}
                      </span>
                      <div>
                        <div className={styles.habTenant}>
                          {contract.inquilino.nombre} {contract.inquilino.apellidos}
                        </div>
                        <div className={styles.habMeta}>
                          {contract.modalidad === 'habitual'
                            ? 'Largo plazo'
                            : contract.modalidad === 'temporada'
                              ? 'Temporada'
                              : 'Vacacional'}
                        </div>
                      </div>
                    </div>
                    <div className={styles.habRow}>
                      <span>Renta</span>
                      <span className="pos">
                        <MoneyValue value={contract.rentaMensual} decimals={0} tone="pos" />
                      </span>
                    </div>
                    <div className={styles.habRow}>
                      <span>Vence</span>
                      <span>
                        <DateLabel value={contract.fechaFin} format="short" size="sm" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </>
      )}

      {tab === 'contratos' && (
        <div className={styles.section}>
          <div className={styles.sectionHd}>
            <div>
              <div className={styles.sectionTitle}>
                Contratos del inmueble · {propertyContracts.length}
              </div>
              <div className={styles.sectionSub}>
                contratos activos y archivados de {property.alias}
              </div>
            </div>
          </div>
          {propertyContracts.length === 0 ? (
            <EmptyState
              icon={<Icons.Contratos size={20} />}
              title="Sin contratos asociados"
              sub="Aún no hay contratos en este inmueble."
              ctaLabel="+ nuevo contrato"
              onCtaClick={() => navigate(`/contratos/nuevo?inmueble=${property.id}`)}
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--atlas-v5-line)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Inquilino</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Modalidad</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Inicio</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fin</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Renta</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {propertyContracts.map((c) => {
                  const activo = isContractActiveAt(c, today);
                  return (
                    <tr
                      key={c.id}
                      style={{ borderBottom: '1px solid var(--atlas-v5-line-2)', cursor: 'pointer' }}
                      onClick={() => showToastV5(`Detalle contrato · ${c.inquilino.nombre}`)}
                    >
                      <td style={{ padding: '10px 8px', color: 'var(--atlas-v5-ink)', fontWeight: 600 }}>
                        {c.inquilino.nombre} {c.inquilino.apellidos}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--atlas-v5-ink-3)' }}>
                        {c.modalidad}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <DateLabel value={c.fechaInicio} format="short" size="sm" />
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <DateLabel value={c.fechaFin} format="short" size="sm" />
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <MoneyValue value={c.rentaMensual} decimals={0} />
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <Pill variant={activo ? 'pos' : 'gris'} asTag>
                          {activo ? 'Activo' : 'Inactivo'}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'gastos' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                border: '1.5px solid var(--atlas-v5-gold)',
                borderRadius: 7,
                background: 'var(--atlas-v5-gold)',
                color: 'var(--atlas-v5-white)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--atlas-v5-font-ui)',
              }}
              onClick={() => navigate(`/inmuebles/${property.id}/gastos/nuevo`)}
            >
              <Icons.Plus size={14} strokeWidth={2} />
              Nuevo gasto recurrente
            </button>
          </div>
          {gastos.length === 0 ? (
            <EmptyState
              icon={<Icons.Tesoreria size={20} />}
              title="Sin gastos recurrentes"
              sub="Da de alta los gastos de este inmueble para que ATLAS los proyecte automáticamente."
              ctaLabel="Nuevo gasto recurrente"
              onCtaClick={() => navigate(`/inmuebles/${property.id}/gastos/nuevo`)}
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--atlas-v5-font-ui)' }}>
              <thead>
                <tr>
                  {['Nombre', 'Tipo', 'Patrón', 'Mensual est.', 'Estado', 'Acciones'].map((h, i) => (
                    <th key={h} style={{ textAlign: i >= 3 ? 'right' : 'left', padding: '10px 8px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--atlas-v5-ink-4)', borderBottom: '1px solid var(--atlas-v5-line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gastos
                  .filter((g): g is CompromisoRecurrente & { id: number } => g.id != null)
                  .map((g) => {
                    const monthly = computeMonthly(g);
                    return (
                      <tr key={g.id}>
                        <td style={{ padding: '10px 8px', fontSize: 13, color: 'var(--atlas-v5-ink-2)', borderBottom: '1px solid var(--atlas-v5-line-2)' }}><strong>{g.alias}</strong></td>
                        <td style={{ padding: '10px 8px', fontSize: 13, color: 'var(--atlas-v5-ink-2)', borderBottom: '1px solid var(--atlas-v5-line-2)' }}>{g.tipo}</td>
                        <td style={{ padding: '10px 8px', fontSize: 11.5, fontFamily: 'var(--atlas-v5-font-mono-tech)', color: 'var(--atlas-v5-ink-2)', borderBottom: '1px solid var(--atlas-v5-line-2)' }}>{g.patron.tipo}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)', color: 'var(--atlas-v5-ink-2)', borderBottom: '1px solid var(--atlas-v5-line-2)' }}><MoneyValue value={-monthly} decimals={0} showSign tone="neg" /></td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--atlas-v5-line-2)' }}>
                          <Pill variant={g.estado === 'activo' ? 'pos' : 'gris'} asTag>
                            {g.estado === 'activo' ? 'Activo' : 'Baja'}
                          </Pill>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--atlas-v5-line-2)' }}>
                          <button type="button" aria-label={`Editar ${g.alias}`} title="Editar" onClick={() => navigate(`/inmuebles/${property.id}/gastos/${g.id}/editar`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 4, color: 'var(--atlas-v5-ink-3)', display: 'inline-flex', alignItems: 'center' }}>
                            <Icons.Edit size={13} strokeWidth={1.8} />
                          </button>
                          <button type="button" aria-label={`Eliminar ${g.alias}`} title="Eliminar" onClick={() => setDeleteGastoTarget(g)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 4, color: 'var(--atlas-v5-neg)', display: 'inline-flex', alignItems: 'center' }}>
                            <Icons.Delete size={13} strokeWidth={1.8} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
          {deleteGastoTarget && (
            <ConfirmationModal
              isOpen={true}
              title="Eliminar gasto recurrente"
              message={`¿Eliminar "${deleteGastoTarget.alias}"? Esta acción no se puede deshacer.`}
              confirmText="Eliminar"
              cancelText="Cancelar"
              onConfirm={handleDeleteGasto}
              onClose={() => setDeleteGastoTarget(null)}
              isLoading={deletingGasto}
              variant="danger"
            />
          )}
        </div>
      )}

      {(tab === 'cobros' || tab === 'documentos' || tab === 'fiscalidad') && (
        <div className={styles.placeholder}>
          <strong>{tabs.find((t) => t.key === tab)?.label}</strong>
          Pestaña en migración a UI v5 · funcionalidad pendiente de sub-tarea
          follow-up. Datos del usuario intactos en stores · UI consolidada en
          próxima iteración.
        </div>
      )}
    </>
  );
};

export default DetallePage;
