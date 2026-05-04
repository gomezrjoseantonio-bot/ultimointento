import React, { useCallback, useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  CardV5,
  MoneyValue,
  EmptyState,
  Pill,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import { eliminarCompromiso } from '../../../services/personal/compromisosRecurrentesService';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import { computeMonthly } from '../../shared/utils/compromisoUtils';
import type { PersonalOutletContext } from '../PersonalContext';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';

// ─── T38: labels y filtros por familia ──────────────────────────────────────

const FAMILIA_LABELS_PERSONAL: Record<string, string> = {
  vivienda:        'Vivienda',
  suministros:     'Suministros',
  dia_a_dia:       'Día a día',
  suscripciones:   'Suscripciones',
  seguros_cuotas:  'Seguros y cuotas',
  otros:           'Otros',
  sin_clasificar:  'Sin clasificar',
};

const FAMILIAS_PERSONAL_FILTROS = [
  'vivienda', 'suministros', 'dia_a_dia', 'suscripciones', 'seguros_cuotas', 'otros',
] as const;

/** Fallback de familia para registros sin tipoFamilia (registros pre-T38) */
function inferFamiliaFallback(tipo: string, subtipo?: string): string {
  if (tipo === 'suministro') return 'suministros';
  if (tipo === 'suscripcion') return 'suscripciones';
  if (tipo === 'seguro') return 'seguros_cuotas';
  if (tipo === 'cuota') return 'seguros_cuotas';
  if (tipo === 'impuesto') return 'otros';
  if (tipo === 'otros') {
    const s = subtipo ?? '';
    if (['alquiler', 'ibi', 'comunidad', 'seguro_hogar'].includes(s)) return 'vivienda';
    if (['supermercado', 'transporte', 'restaurantes', 'ocio', 'salud', 'ropa', 'cuidado_personal'].includes(s)) return 'dia_a_dia';
    if (['gimnasio', 'educacion', 'profesional', 'ong'].includes(s)) return 'seguros_cuotas';
  }
  return 'otros';
}

/** Devuelve la familia efectiva del compromiso (tipoFamilia o fallback) */
function getFamilia(c: CompromisoRecurrente): string {
  return c.tipoFamilia ?? inferFamiliaFallback(c.tipo, c.subtipo);
}

const GastosPage: React.FC = () => {
  const navigate = useNavigate();
  const { compromisos, reload } = useOutletContext<PersonalOutletContext>();
  const [search, setSearch] = useState('');
  const [filterFamilia, setFilterFamilia] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompromisoRecurrente & { id: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const personalCompromisos = useMemo(
    () => compromisos.filter((c) => c.ambito === 'personal'),
    [compromisos],
  );

  const filtered = useMemo(() => {
    return personalCompromisos.filter((c) => {
      if (filterFamilia) {
        const familia = getFamilia(c);
        if (familia !== filterFamilia) return false;
      }
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        c.alias.toLowerCase().includes(s) ||
        (c.categoria ?? '').toLowerCase().includes(s) ||
        c.tipo.toLowerCase().includes(s)
      );
    });
  }, [personalCompromisos, filterFamilia, search]);

  const totalMensual = filtered.reduce((sum, c) => sum + computeMonthly(c), 0);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await eliminarCompromiso(deleteTarget.id);
      showToastV5(`Gasto "${deleteTarget.alias}" eliminado`, 'success');
      setDeleteTarget(null);
      reload();
    } catch (err) {
      showToastV5(`Error al eliminar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, reload]);

  if (personalCompromisos.length === 0) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => navigate('/personal/gastos/nuevo')}
            style={{
              ...chipStyle(false),
              background: 'var(--atlas-v5-gold)',
              borderColor: 'var(--atlas-v5-gold)',
              color: 'var(--atlas-v5-white)',
              fontWeight: 600,
            }}
          >
            <Icons.Plus size={11} strokeWidth={2.5} style={{ marginRight: 4 }} />
            Nuevo gasto recurrente
          </button>
        </div>
        <EmptyState
          icon={<Icons.Tesoreria size={20} />}
          title="Sin compromisos del hogar"
          sub="Da de alta suministros, suscripciones, seguros y demás gastos recurrentes para que ATLAS los proyecte automáticamente · o deja que ATLAS los detecte desde tu histórico de movimientos."
          ctaLabel="Detectar desde histórico"
          onCtaClick={() => navigate('/personal/gastos/detectar-compromisos')}
        />
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 14,
          flexWrap: 'wrap',
          background: 'var(--atlas-v5-card)',
          border: '1px solid var(--atlas-v5-line)',
          borderRadius: 10,
          padding: '10px 12px',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 180,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 10px',
            border: '1px solid var(--atlas-v5-line)',
            borderRadius: 6,
            background: 'var(--atlas-v5-card)',
          }}
        >
          <Icons.Search size={13} strokeWidth={1.8} />
          <input
            type="search"
            placeholder="Buscar por nombre, tipo, categoría…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: 12,
              flex: 1,
              background: 'transparent',
              height: 30,
              color: 'var(--atlas-v5-ink-2)',
              fontFamily: 'var(--atlas-v5-font-ui)',
            }}
            aria-label="Buscar gastos"
          />
        </span>
        <button
          type="button"
          style={chipStyle(filterFamilia === null)}
          onClick={() => setFilterFamilia(null)}
        >
          Todos · {personalCompromisos.length}
        </button>
        {FAMILIAS_PERSONAL_FILTROS.map((f) => (
          <button
            key={f}
            type="button"
            style={chipStyle(filterFamilia === f)}
            onClick={() => setFilterFamilia(f)}
          >
            {FAMILIA_LABELS_PERSONAL[f]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate('/personal/gastos/nuevo')}
          style={{
            ...chipStyle(false),
            background: 'var(--atlas-v5-gold)',
            borderColor: 'var(--atlas-v5-gold)',
            color: 'var(--atlas-v5-white)',
            fontWeight: 600,
          }}
        >
          <Icons.Plus size={11} strokeWidth={2.5} style={{ marginRight: 4 }} />
          Nuevo gasto recurrente
        </button>
        <button
          type="button"
          onClick={() => navigate('/inmuebles/importar-contratos')}
          style={chipStyle(false)}
        >
          <Icons.Upload size={11} strokeWidth={2} style={{ marginRight: 4 }} />
          Importar
        </button>
        <button
          type="button"
          onClick={() => navigate('/personal/gastos/detectar-compromisos')}
          style={chipStyle(false)}
        >
          <Icons.Sparkles size={11} strokeWidth={2} style={{ marginRight: 4 }} />
          Detectar desde histórico
        </button>
      </div>

      <CardV5>
        <CardV5.Title>
          Compromisos personales · {filtered.length} de {personalCompromisos.length}
        </CardV5.Title>
        <CardV5.Subtitle>
          estimación mensual total · <MoneyValue value={totalMensual} decimals={0} />
        </CardV5.Subtitle>
        <CardV5.Body>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--atlas-v5-ink-4)', fontSize: 13 }}>
              Sin compromisos que coincidan con los filtros aplicados.
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Categoría</th>
                  <th style={thStyle}>Patrón</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Mensual estimado</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .filter((c): c is CompromisoRecurrente & { id: number } => c.id != null)
                  .map((c) => (
                    <tr key={c.id} style={{ cursor: 'default' }}>
                      <td style={tdStyle}>
                        <strong>{c.alias}</strong>
                      </td>
                      <td style={tdStyle}>{FAMILIA_LABELS_PERSONAL[getFamilia(c)] ?? getFamilia(c)}</td>
                      <td style={tdStyle}>{c.categoria ?? '—'}</td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--atlas-v5-font-mono-tech)', fontSize: 11.5 }}>
                        {c.patron.tipo}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'right',
                          fontFamily: 'var(--atlas-v5-font-mono-num)',
                        }}
                      >
                        <MoneyValue value={-computeMonthly(c)} decimals={0} showSign tone="neg" />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Pill variant={c.estado === 'activo' ? 'pos' : 'gris'} asTag>
                          {c.estado === 'activo' ? 'Activo' : c.estado === 'pausado' ? 'Pausado' : 'Baja'}
                        </Pill>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          aria-label={`Editar ${c.alias}`}
                          title="Editar"
                          onClick={() => navigate(`/personal/gastos/${c.id}/editar`)}
                          style={actionBtnStyle}
                        >
                          <Icons.Edit size={13} strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar ${c.alias}`}
                          title="Eliminar"
                          onClick={() => setDeleteTarget(c)}
                          style={{ ...actionBtnStyle, color: 'var(--atlas-v5-neg)' }}
                        >
                          <Icons.Delete size={13} strokeWidth={1.8} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardV5.Body>
      </CardV5>

      {deleteTarget && (
        <ConfirmationModal
          isOpen={true}
          title="Eliminar gasto recurrente"
          message={`¿Eliminar "${deleteTarget.alias}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          isLoading={deleting}
          variant="danger"
        />
      )}
    </>
  );
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px',
  borderRadius: 6,
  fontSize: 12,
  color: active ? 'var(--atlas-v5-white)' : 'var(--atlas-v5-ink-3)',
  fontWeight: 500,
  border: `1px solid ${active ? 'var(--atlas-v5-brand)' : 'var(--atlas-v5-line)'}`,
  background: active ? 'var(--atlas-v5-brand)' : 'var(--atlas-v5-card-alt)',
  cursor: 'pointer',
  fontFamily: 'var(--atlas-v5-font-ui)',
  display: 'inline-flex',
  alignItems: 'center',
});

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  fontFamily: 'var(--atlas-v5-font-ui)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--atlas-v5-ink-4)',
  borderBottom: '1px solid var(--atlas-v5-line)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 13,
  color: 'var(--atlas-v5-ink-2)',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '3px 5px',
  borderRadius: 4,
  color: 'var(--atlas-v5-ink-3)',
  display: 'inline-flex',
  alignItems: 'center',
};

export default GastosPage;
