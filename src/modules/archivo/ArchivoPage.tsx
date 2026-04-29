// Módulo Archivo (v5). Sustituye el redirect `/inbox` legacy con vista
// completa según mockup `docs/audit-inputs/atlas-archivo.html` ·
// KPI strip + bandeja entrada + filtros (inmueble · ejercicio · tipo)
// + tabla de documentos.
//
// Lee del store `documents` · NO toca services internos.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead, Icons, MoneyValue, showToastV5 } from '../../design-system/v5';
import { initDB } from '../../services/db';
import type { Document } from '../../services/db';
import styles from './ArchivoPage.module.css';

type EntityType = NonNullable<Document['metadata']['entityType']> | 'all' | 'sin_asignar';
type TipoFiltro = 'all' | 'fiscal' | 'contrato' | 'bancario' | 'otro';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatHaceTiempo = (ms: number): string => {
  const diff = Date.now() - ms;
  if (Number.isNaN(diff) || diff < 0) return '—';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hace segundos';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
};

// Normaliza el campo legacy `metadata.tipo` (variantes 'Factura' ·
// 'Contrato' · 'fiscal' · etc.) al set v5 coarse.
const normalizarTipoMetadata = (tipo?: string): TipoFiltro | null => {
  const n = tipo?.trim().toLowerCase() ?? '';
  if (!n) return null;
  if (n.includes('fiscal') || n.includes('factura') || n.includes('irpf') || n.includes('aeat')) {
    return 'fiscal';
  }
  if (n.includes('contrat')) return 'contrato';
  if (n.includes('banco') || n.includes('bancario') || n.includes('extracto')) return 'bancario';
  if (n === 'otro') return 'otro';
  return null;
};

const inferTipo = (d: Document): TipoFiltro => {
  const meta = d.metadata as { tipo?: string };
  const fromMeta = normalizarTipoMetadata(meta.tipo);
  if (fromMeta) return fromMeta;
  if (d.metadata.entityType === 'contract') return 'contrato';
  return 'otro';
};

const isSinClasificar = (d: Document): boolean => {
  const meta = d.metadata as { tipo?: string; status?: string };
  const status = meta.status ?? '';
  if (status === 'pendiente_vinculacion' || status === 'pendiente_asignacion') return true;
  // Sin tipo coarse válido y sin entidad vinculada · pendiente de clasificar.
  return !normalizarTipoMetadata(meta.tipo) && !d.metadata.entityType && !d.metadata.entityId;
};

const labelTipo: Record<TipoFiltro, string> = {
  all: 'Todos',
  fiscal: 'Fiscal',
  contrato: 'Contratos',
  bancario: 'Bancarios',
  otro: 'Otros',
};

const ArchivoPage: React.FC = () => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoFiltro>('all');
  const [entityFilter, setEntityFilter] = useState<EntityType>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const list = (await db.getAll('documents')) as Document[];
        if (!cancelled) setDocs(list);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[archivo] error cargando documentos', err);
        showToastV5('Error al cargar el archivo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalSize = docs.reduce((s, d) => s + (d.size ?? 0), 0);
  const sinClasificar = docs.filter(isSinClasificar);
  const ultUpload = docs.length > 0 ? Math.max(...docs.map((d) => d.lastModified ?? 0)) : 0;

  const tipoCounts = useMemo(() => {
    const counts: Record<TipoFiltro, number> = { all: docs.length, fiscal: 0, contrato: 0, bancario: 0, otro: 0 };
    docs.forEach((d) => {
      const t = inferTipo(d);
      counts[t]++;
    });
    return counts;
  }, [docs]);

  const entityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    docs.forEach((d) => {
      const k = d.metadata.entityType ?? 'sin_asignar';
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  }, [docs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs
      .filter((d) => {
        if (tipoFilter !== 'all' && inferTipo(d) !== tipoFilter) return false;
        if (entityFilter !== 'all') {
          if (entityFilter === 'sin_asignar' && d.metadata.entityType) return false;
          if (entityFilter !== 'sin_asignar' && d.metadata.entityType !== entityFilter) return false;
        }
        if (q) {
          const meta = d.metadata as { description?: string; counterpartyName?: string; proveedor?: string };
          const haystack = [
            d.filename,
            meta.description ?? '',
            meta.counterpartyName ?? '',
            meta.proveedor ?? '',
          ].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
  }, [docs, search, tipoFilter, entityFilter]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>Cargando archivo…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHead
        title="Archivo"
        sub="tus documentos organizados por inmueble · ejercicio fiscal · tipo"
        actions={[
          {
            label: 'Exportar ZIP',
            variant: 'ghost',
            icon: <Icons.Download size={14} strokeWidth={1.8} />,
            onClick: () => showToastV5('Exportar ZIP · sub-tarea follow-up'),
          },
          {
            label: 'Subir documento',
            variant: 'gold',
            icon: <Icons.Upload size={14} strokeWidth={1.8} />,
            onClick: () => navigate('/inbox?upload=1'),
          },
        ]}
      />

      <div className={styles.kpiStrip}>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Documentos totales</div>
          <div className={styles.kpiVal}>{docs.length}</div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Espacio usado</div>
          <div className={styles.kpiVal}>{formatBytes(totalSize)}</div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Sin clasificar</div>
          <div className={`${styles.kpiVal} ${sinClasificar.length > 0 ? styles.warn : ''}`}>
            {sinClasificar.length}
          </div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Última subida</div>
          <div className={styles.kpiVal} style={{ fontSize: 16 }}>
            {ultUpload > 0 ? formatHaceTiempo(ultUpload) : '—'}
          </div>
        </div>
      </div>

      {sinClasificar.length > 0 && (
        <div className={styles.entrada}>
          <div className={styles.entradaIcon}>
            <Icons.Inbox size={18} strokeWidth={1.8} />
          </div>
          <div>
            <div className={styles.entradaTitle}>
              Tienes {sinClasificar.length} documento{sinClasificar.length === 1 ? '' : 's'} sin clasificar
            </div>
            <div className={styles.entradaDesc}>
              Atlas ha detectado documentos pendientes de vincular a inmueble · ejercicio fiscal · tipo.
            </div>
          </div>
          <span className={styles.entradaCount}>{sinClasificar.length}</span>
          <button
            type="button"
            onClick={() => navigate('/inbox')}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--atlas-v5-card)',
              color: 'var(--atlas-v5-ink)',
              border: '1px solid var(--atlas-v5-line)',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Abrir bandeja →
          </button>
        </div>
      )}

      <div className={styles.layout}>
        <aside className={styles.filterPanel}>
          <input
            type="search"
            className={styles.search}
            placeholder="Buscar dentro del archivo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar documentos"
          />

          <div className={styles.fGroup}>
            <div className={styles.fGroupTitle}>Por tipo</div>
            {(['all', 'fiscal', 'contrato', 'bancario', 'otro'] as TipoFiltro[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.fItem} ${tipoFilter === t ? styles.active : ''}`}
                aria-pressed={tipoFilter === t}
                onClick={() => setTipoFilter(t)}
              >
                <span />
                <span>{labelTipo[t]}</span>
                <span className={styles.fItemCount}>{tipoCounts[t]}</span>
              </button>
            ))}
          </div>

          <div className={styles.fGroup}>
            <div className={styles.fGroupTitle}>Por inmueble</div>
            {(['all', 'property', 'contract', 'expense', 'personal', 'sin_asignar'] as EntityType[]).map((k) => {
              const labels: Record<EntityType, string> = {
                all: 'Todos',
                property: 'Inmueble',
                contract: 'Contrato',
                expense: 'Gasto',
                personal: 'Personal',
                sin_asignar: 'Sin asignar',
              };
              const count = k === 'all' ? docs.length : entityCounts[k] ?? 0;
              return (
                <button
                  key={k}
                  type="button"
                  className={`${styles.fItem} ${entityFilter === k ? styles.active : ''}`}
                  aria-pressed={entityFilter === k}
                  onClick={() => setEntityFilter(k)}
                  disabled={count === 0 && k !== 'all'}
                >
                  <span />
                  <span>{labels[k]}</span>
                  <span className={styles.fItemCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className={styles.docsZone}>
          <div className={styles.docsTop}>
            <div className={styles.docsTabs}>
              <button
                type="button"
                className={tipoFilter === 'all' ? styles.active : ''}
                aria-pressed={tipoFilter === 'all'}
                onClick={() => setTipoFilter('all')}
              >
                Todos<span className={styles.tc}>{docs.length}</span>
              </button>
              {sinClasificar.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/inbox')}
                >
                  Sin clasificar<span className={styles.tc}>{sinClasificar.length}</span>
                </button>
              )}
            </div>
          </div>

          <div className={styles.docsMeta}>
            <span>
              <span className={styles.docsMetaCount}>{filtered.length}</span> documentos ·{' '}
              {formatBytes(filtered.reduce((s, d) => s + (d.size ?? 0), 0))}
            </span>
            <span style={{ color: 'var(--atlas-v5-ink-4)' }}>
              ordenados por fecha · más recientes primero
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              {docs.length === 0
                ? 'Aún no tienes documentos registrados. Arrastra un PDF o usa el botón Subir documento.'
                : 'No hay documentos que coincidan con los filtros aplicados.'}
            </div>
          ) : (
            <table className={styles.docsTable}>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Vinculado a</th>
                  <th className={styles.right}>Tamaño</th>
                  <th className={styles.right}>Subido</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((d) => {
                  const tipo = inferTipo(d);
                  const meta = d.metadata as { contraparte?: string; counterpartyName?: string };
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className={styles.docName}>
                          <span className={styles.docIcon}>
                            <Icons.Contratos size={14} strokeWidth={1.8} />
                          </span>
                          <div>
                            <div className={styles.docFilename}>{d.filename}</div>
                            {(meta.counterpartyName || meta.contraparte) && (
                              <div className={styles.docFilemeta}>
                                {meta.counterpartyName ?? meta.contraparte}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.tipoChip} ${styles[tipo]}`}>{labelTipo[tipo]}</span>
                      </td>
                      <td style={{ color: 'var(--atlas-v5-ink-4)', fontSize: 11.5 }}>
                        {d.metadata.entityType ?? 'Sin asignar'}
                      </td>
                      <td className={styles.right}>
                        <MoneyValue value={d.size / 1024} decimals={0} tone="muted" showCurrency={false} /> KB
                      </td>
                      <td className={styles.right}>
                        {new Date(d.lastModified).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchivoPage;
