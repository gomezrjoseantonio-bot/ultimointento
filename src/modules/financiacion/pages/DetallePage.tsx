import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CardV5, Icons, MoneyValue, showToastV5 } from '../../../design-system/v5';
import { prestamosService } from '../../../services/prestamosService';
import type { FinanciacionOutletContext } from '../FinanciacionContext';
import {
  formatPct,
  getBankPalette,
  labelKind,
} from '../helpers';
import styles from './DetallePage.module.css';

const formatDateLong = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateMonthYear = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
};

type DetailTab = 'resumen' | 'cuadro' | 'movimientos' | 'documentos';

const DetallePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { rows, planes, prestamos, reload } = useOutletContext<FinanciacionOutletContext>();
  const [tab, setTab] = useState<DetailTab>('resumen');
  const [cuadroFilter, setCuadroFilter] = useState<'mes' | 'trimestre' | 'anio' | 'all'>('mes');

  const row = useMemo(() => rows.find((r) => r.id === id), [rows, id]);
  const prestamo = useMemo(() => prestamos.find((p) => p.id === id), [prestamos, id]);
  const plan = id ? planes.get(id) : null;
  const periodos = useMemo(() => plan?.periodos ?? [], [plan]);
  const referencia = useMemo(() => new Date(), []);

  const ventana = useMemo(() => {
    if (!periodos.length) return [] as typeof periodos;
    if (cuadroFilter === 'all') return periodos;
    const sorted = [...periodos].sort(
      (a, b) => new Date(a.fechaCargo).getTime() - new Date(b.fechaCargo).getTime(),
    );
    const idx = sorted.findIndex((p) => new Date(p.fechaCargo) >= referencia);
    const center = idx === -1 ? Math.max(0, sorted.length - 1) : idx;
    if (cuadroFilter === 'mes') {
      return sorted.slice(Math.max(0, center - 3), Math.min(sorted.length, center + 4));
    }
    if (cuadroFilter === 'trimestre') {
      return sorted.slice(Math.max(0, center - 5), Math.min(sorted.length, center + 6));
    }
    if (cuadroFilter === 'anio') {
      return sorted.slice(Math.max(0, center - 6), Math.min(sorted.length, center + 7));
    }
    return sorted;
  }, [periodos, cuadroFilter, referencia]);

  if (!row || !prestamo) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.notFound}>
            Préstamo no encontrado · puede haber sido eliminado.{' '}
            <span
              role="button"
              tabIndex={0}
              style={{ color: 'var(--atlas-v5-gold-ink)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => navigate('/financiacion/listado')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate('/financiacion/listado');
              }}
            >
              Volver al listado
            </span>
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  const palette = getBankPalette(row.banco);
  const plazoAnios = Math.round(prestamo.plazoMesesTotal / 12);

  // Reparto fiscal por destino · año actual.
  const currentYear = referencia.getFullYear();
  const interesActualAnual = periodos
    .filter((p) => new Date(p.fechaCargo).getFullYear() === currentYear)
    .reduce((s, p) => s + (p.interes ?? 0), 0) || (row.capitalVivo * row.tin) / 100;

  const destinos = prestamo.destinos ?? [];
  const totalDestino = destinos.reduce((s, d) => s + d.importe, 0);

  const handleAmortizar = () => {
    showToastV5('Amortización · sub-tarea follow-up');
  };

  const handleEditar = () => {
    if (id) navigate(`/financiacion/${id}/editar`);
  };

  const handleEliminar = async () => {
    if (!id) return;
    if (!window.confirm('¿Eliminar este préstamo? Esta acción no se puede deshacer.')) return;
    try {
      await prestamosService.deletePrestamo(id);
      showToastV5('Préstamo eliminado.');
      await reload();
      navigate('/financiacion/listado');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[financiacion] delete', err);
      showToastV5('Error al eliminar el préstamo.');
    }
  };

  return (
    <>
      <div className={styles.breadcrumb}>
        <span
          className={styles.backBtn}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/financiacion/listado')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate('/financiacion/listado');
          }}
        >
          <Icons.ArrowLeft size={12} strokeWidth={2} />
          Volver
        </span>
        <span
          role="link"
          tabIndex={0}
          onClick={() => navigate('/financiacion')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate('/financiacion');
          }}
        >
          Financiación
        </span>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        <span
          role="link"
          tabIndex={0}
          onClick={() => navigate('/financiacion/listado')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate('/financiacion/listado');
          }}
        >
          Listado
        </span>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        <span className={styles.current}>{row.alias}</span>
      </div>

      <div className={styles.heroRow}>
        <div className={styles.title}>Detalle del préstamo</div>
        <div className={styles.tbActions}>
          <button type="button" className={styles.tbBtn} onClick={handleAmortizar}>
            <Icons.Plus size={14} strokeWidth={1.8} />
            Amortizar
          </button>
          <button type="button" className={styles.tbBtn} onClick={handleEditar}>
            <Icons.Edit size={14} strokeWidth={1.8} />
            Editar
          </button>
          <button type="button" className={`${styles.tbBtn} ${styles.danger}`} onClick={handleEliminar}>
            <Icons.Delete size={14} strokeWidth={1.8} />
            Eliminar
          </button>
        </div>
      </div>

      <div className={styles.heroCard}>
        <div className={styles.heroLogo} style={{ background: palette.bg, color: palette.fg }}>
          {palette.abbr}
        </div>
        <div>
          <div className={styles.heroAst}>
            PREST · {String(row.id).slice(0, 8)} · {row.kind}
          </div>
          <div className={styles.heroNom}>{row.alias}</div>
          <div className={styles.heroMeta}>
            firmada <strong>{formatDateLong(prestamo.fechaFirma)}</strong>
            {' · '}TIN <strong>{formatPct(row.tin, 2)}</strong>{' '}
            {prestamo.tipo === 'FIJO' ? 'fijo' : prestamo.tipo === 'VARIABLE' ? 'variable' : 'mixto'}
            {' · '}
            <strong>{plazoAnios} años</strong> · vence{' '}
            <strong>{formatDateMonthYear(row.fechaVencimiento)}</strong>
          </div>
        </div>
        <span className={`${styles.heroBadge} ${styles[row.kind]}`}>{labelKind(row.kind)}</span>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Capital vivo</div>
          <div className={`${styles.val} ${styles.neg}`}>
            <MoneyValue value={-row.capitalVivo} decimals={0} showSign tone="neg" />
          </div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Cuota mes</div>
          <div className={styles.val}>
            <MoneyValue value={row.cuotaMensual} decimals={0} tone="ink" />
          </div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.lab}>Amortizado</div>
          <div className={`${styles.val} ${styles.pos}`}>{formatPct(row.porcentajeAmortizado, 1)}</div>
        </div>
      </div>

      <div className={styles.tabs} role="group" aria-label="Tabs detalle préstamo">
        {(
          [
            { key: 'resumen', label: 'Resumen' },
            { key: 'cuadro', label: 'Cuadro de amortización' },
            { key: 'movimientos', label: 'Movimientos' },
            { key: 'documentos', label: 'Documentos' },
          ] as { key: DetailTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? styles.active : ''}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <>
          <div className={styles.nota}>
            <div className={styles.notaIcon}>i</div>
            <div>
              <div className={styles.notaTitle}>Destino determina deducibilidad fiscal</div>
              <div className={styles.notaDesc}>
                La deducibilidad de los intereses depende del <strong>destino</strong> del capital
                · no de la garantía. Asegúrate de que cada destino tenga su inmueble vinculado y
                el porcentaje correcto · Atlas calcula la imputación fiscal automáticamente.
              </div>
            </div>
          </div>

          <div className={styles.dgGrid}>
            <div className={styles.dgCard}>
              <div className={styles.dgHd}>
                <div>
                  <div className={styles.deduTitle}>Destino del capital</div>
                  <div className={styles.deduSub}>
                    para qué se pidió el dinero · determina la deducibilidad
                  </div>
                </div>
                <span className={`${styles.dgTag} ${styles.fiscal}`}>Fiscal</span>
              </div>
              {destinos.length === 0 && (
                <div className={styles.empty}>No hay destinos definidos para este préstamo.</div>
              )}
              {destinos.map((d) => {
                const iconCls =
                  d.tipo === 'CANCELACION_DEUDA'
                    ? styles.cancel
                    : d.tipo === 'INVERSION'
                      ? styles.inversion
                      : styles.inmueble;
                return (
                  <div key={d.id} className={styles.dgItem}>
                    <div className={`${styles.dgItemIcon} ${iconCls}`}>
                      {d.tipo === 'CANCELACION_DEUDA' ? (
                        <Icons.Minus size={18} strokeWidth={1.8} />
                      ) : d.tipo === 'INVERSION' ? (
                        <Icons.Inversiones size={18} strokeWidth={1.8} />
                      ) : (
                        <Icons.Inmuebles size={18} strokeWidth={1.8} />
                      )}
                    </div>
                    <div>
                      <div className={styles.dgItemNom}>
                        {d.descripcion ?? d.tipo.toLowerCase().replace('_', ' ')}
                      </div>
                      <div className={styles.dgItemSub}>
                        {d.tipo === 'ADQUISICION' || d.tipo === 'REFORMA'
                          ? 'deducible · trazable a inmueble'
                          : 'no deducible'}
                      </div>
                    </div>
                    <div className={styles.dgItemRight}>
                      <div className={styles.dgItemImp}>
                        <MoneyValue value={d.importe} decimals={0} tone="ink" />
                      </div>
                      {d.porcentaje != null && (
                        <div className={styles.dgItemPct}>{d.porcentaje.toFixed(1)}%</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {destinos.length > 0 && (
                <div className={styles.totalDestinos}>
                  <span>Total destinado</span>
                  <span className={styles.strong}>
                    <MoneyValue value={totalDestino} decimals={0} tone="ink" /> · 100%
                  </span>
                </div>
              )}
            </div>

            <div className={styles.dgCard}>
              <div className={styles.dgHd}>
                <div>
                  <div className={styles.deduTitle}>Garantía</div>
                  <div className={styles.deduSub}>
                    qué responde si no pagas · informativo · no afecta fiscalidad
                  </div>
                </div>
                <span className={`${styles.dgTag} ${styles.info}`}>Informativo</span>
              </div>
              {(prestamo.garantias ?? []).length === 0 && (
                <div className={styles.empty}>No se ha registrado garantía.</div>
              )}
              {(prestamo.garantias ?? []).map((g, i) => (
                <div key={`${g.tipo}-${i}`} className={styles.dgItem}>
                  <div
                    className={`${styles.dgItemIcon} ${
                      g.tipo === 'PIGNORATICIA'
                        ? styles.cancel
                        : g.tipo === 'HIPOTECARIA'
                          ? styles.inmueble
                          : styles.inversion
                    }`}
                  >
                    <Icons.Lock size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className={styles.dgItemNom}>{g.descripcion ?? g.tipo.toLowerCase()}</div>
                    <div className={styles.dgItemSub}>{g.tipo.toLowerCase()}</div>
                  </div>
                  <div className={styles.dgItemRight}>
                    <div className={styles.dgItemImp}>{labelKind(row.kind)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.deduCard}>
            <div className={styles.deduHead}>
              <div>
                <div className={styles.deduTitle}>
                  Intereses deducibles · reparto por destino y año
                </div>
                <div className={styles.deduSub}>
                  {row.intDeduciblesPct.toFixed(1)}% del interés anual se imputa a destinos
                  deducibles · casilla 0105
                </div>
              </div>
            </div>
            <table className={styles.deduTable}>
              <thead>
                <tr>
                  <th>Año</th>
                  <th className={styles.right}>Intereses pagados</th>
                  <th>Destino deducible · {formatPct(row.intDeduciblesPct, 1)}</th>
                  <th className={styles.right}>Deducible</th>
                  <th>No deducible</th>
                  <th className={styles.right}>Importe no ded.</th>
                </tr>
              </thead>
              <tbody>
                {[currentYear - 3, currentYear - 2, currentYear - 1, currentYear].map((y) => {
                  const intAno = periodos
                    .filter((p) => new Date(p.fechaCargo).getFullYear() === y)
                    .reduce((s, p) => s + (p.interes ?? 0), 0);
                  const intEstim = intAno || interesActualAnual;
                  const ded = (intEstim * row.intDeduciblesPct) / 100;
                  const noDed = intEstim - ded;
                  return (
                    <tr key={y} className={y === currentYear ? styles.current : ''}>
                      <td className={styles.anio}>{y}</td>
                      <td className={styles.right}>
                        {Math.round(intEstim).toLocaleString('es-ES')} €
                      </td>
                      <td>
                        <span className={styles.deduChip}>destinos deducibles</span>
                      </td>
                      <td className={styles.right} style={{ color: 'var(--atlas-v5-pos)', fontWeight: 600 }}>
                        +{Math.round(ded).toLocaleString('es-ES')} €
                      </td>
                      <td>
                        <span className={`${styles.deduChip} ${styles.cancel}`}>no deducible</span>
                      </td>
                      <td className={styles.right} style={{ color: 'var(--atlas-v5-ink-4)' }}>
                        {Math.round(noDed).toLocaleString('es-ES')} €
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'cuadro' && (
        <div className={styles.cuadroCard}>
          <div className={styles.cuadroHd}>
            <div>
              <div className={styles.deduTitle}>
                Cuadro de amortización · {prestamo.plazoMesesTotal} cuotas
              </div>
              <div className={styles.deduSub}>
                {periodos.length === 0
                  ? 'plan no generado · usa "Editar" para regenerarlo'
                  : 'mostrando ventana actual · clic en una fila para ver detalle'}
              </div>
            </div>
            <div className={styles.cuadroFilters}>
              <button
                type="button"
                className={cuadroFilter === 'mes' ? styles.active : ''}
                onClick={() => setCuadroFilter('mes')}
              >
                Mes actual
              </button>
              <button
                type="button"
                className={cuadroFilter === 'trimestre' ? styles.active : ''}
                onClick={() => setCuadroFilter('trimestre')}
              >
                3 meses
              </button>
              <button
                type="button"
                className={cuadroFilter === 'anio' ? styles.active : ''}
                onClick={() => setCuadroFilter('anio')}
              >
                Año
              </button>
              <button
                type="button"
                className={cuadroFilter === 'all' ? styles.active : ''}
                onClick={() => setCuadroFilter('all')}
              >
                Completo
              </button>
            </div>
          </div>
          {ventana.length === 0 ? (
            <div className={styles.empty}>
              No hay periodos en el plan de pagos. Recarga desde la página de edición.
            </div>
          ) : (
            <table className={styles.cuadroTable}>
              <thead>
                <tr>
                  <th>Cuota</th>
                  <th>Fecha</th>
                  <th className={styles.right}>Cuota total</th>
                  <th className={styles.right}>Capital</th>
                  <th className={styles.right}>Interés</th>
                  <th className={styles.right}>Capital vivo</th>
                  <th className={styles.center}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ventana.map((per) => {
                  const fecha = new Date(per.fechaCargo);
                  const isCurrent =
                    fecha.getFullYear() === referencia.getFullYear() &&
                    fecha.getMonth() === referencia.getMonth();
                  const cls = per.pagado ? styles.pagada : isCurrent ? styles.actual : '';
                  const badge = per.pagado
                    ? styles.pagada
                    : isCurrent
                      ? styles.actual
                      : styles.futura;
                  const badgeLab = per.pagado ? 'Pagada' : isCurrent ? 'En curso' : 'Pendiente';
                  return (
                    <tr key={per.periodo} className={cls}>
                      <td className={styles.anio}>#{per.periodo}</td>
                      <td>{formatDateLong(per.fechaCargo)}</td>
                      <td className={styles.right}>
                        {Math.round(per.cuota).toLocaleString('es-ES')} €
                      </td>
                      <td className={styles.right}>
                        {Math.round(per.amortizacion).toLocaleString('es-ES')} €
                      </td>
                      <td className={styles.right}>
                        {Math.round(per.interes).toLocaleString('es-ES')} €
                      </td>
                      <td className={styles.right}>
                        {Math.round(per.principalFinal).toLocaleString('es-ES')} €
                      </td>
                      <td className={styles.center}>
                        <span className={`${styles.cuadroBadge} ${badge}`}>{badgeLab}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'movimientos' && (
        <CardV5>
          <CardV5.Body>
            <div className={styles.empty}>
              Movimientos vinculados en Tesorería · sub-tarea follow-up · enlazaremos los pagos
              recibidos en cuenta.
            </div>
          </CardV5.Body>
        </CardV5>
      )}

      {tab === 'documentos' && (
        <CardV5>
          <CardV5.Body>
            <div className={styles.empty}>
              Documentos del préstamo · escritura · condiciones · sellos · sub-tarea follow-up.
            </div>
          </CardV5.Body>
        </CardV5>
      )}
    </>
  );
};

export default DetallePage;
