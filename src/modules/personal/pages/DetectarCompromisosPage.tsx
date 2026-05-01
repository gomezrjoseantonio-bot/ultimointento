// ============================================================================
// ATLAS · TAREA 9.3 · DetectarCompromisosPage
// ============================================================================
//
// Pantalla productiva en `/personal/gastos/detectar-compromisos`.
// Permite analizar movimientos · revisar candidatos · ajustar campos clave ·
// aprobar individuales o en bulk · resultado escrito en `compromisosRecurrentes`
// vía `compromisoCreationService`.
//
// Decisión de ubicación · Opción A (sub-página de Personal/Gastos) ·
// fundamentada en mockup `atlas-personal-v3.html` líneas 1436+ que ubican
// el catálogo de compromisos en la sección Gastos del módulo Personal.
//
// NO infiere ámbito 'inmueble' (todos los candidatos salen con
// ambito='personal' por la heurística del detector · ajustable manualmente
// vía override en el modal de edición de cara a 9.4).
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  CardV5,
  EmptyState,
  Icons,
  MoneyValue,
  PageHead,
  Pill,
  showToastV5,
} from '../../../design-system/v5';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import type { PersonalOutletContext } from '../PersonalContext';
import {
  createCompromisosFromCandidatos,
  detectAndPreview,
} from '../../../services/compromisoCreationService';
import type {
  CandidatoCompromiso,
  DetectionReport,
} from '../../../services/compromisoDetectionService';
import type {
  CategoriaGastoCompromiso,
  CompromisoRecurrente,
  ResponsableCompromiso,
  TipoCompromiso,
} from '../../../types/compromisosRecurrentes';

// ─── Constantes ────────────────────────────────────────────────────────────

const TIPO_FILTROS: Array<{ value: TipoCompromiso | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'suministro', label: 'Suministros' },
  { value: 'suscripcion', label: 'Suscripciones' },
  { value: 'seguro', label: 'Seguros' },
  { value: 'cuota', label: 'Cuotas' },
  { value: 'comunidad', label: 'Comunidad' },
  { value: 'impuesto', label: 'Impuesto' },
  { value: 'otros', label: 'Otros' },
];

const TIPOS_EDITABLES: TipoCompromiso[] = [
  'suministro',
  'suscripcion',
  'seguro',
  'cuota',
  'comunidad',
  'impuesto',
  'otros',
];

const CATEGORIAS_EDITABLES: CategoriaGastoCompromiso[] = [
  'vivienda.suministros',
  'vivienda.comunidad',
  'vivienda.ibi',
  'vivienda.seguros',
  'alimentacion',
  'transporte',
  'salud',
  'educacion',
  'ocio',
  'viajes',
  'suscripciones',
  'personal',
  'regalos',
  'tecnologia',
];

const RESPONSABLES: ResponsableCompromiso[] = ['titular', 'pareja', 'hogarCompartido'];

// ─── Helpers de presentación ───────────────────────────────────────────────

function patronToText(patron: CandidatoCompromiso['patronInferido']): string {
  switch (patron.tipo) {
    case 'mensualDiaFijo':
      return `mensual · día ${patron.dia}`;
    case 'mensualDiaRelativo':
      return `mensual · ${patron.referencia}`;
    case 'cadaNMeses':
      return `cada ${patron.cadaNMeses} meses · día ${patron.dia}`;
    case 'trimestralFiscal':
      return `trimestral fiscal · día ${patron.diaPago}`;
    case 'anualMesesConcretos':
      return `anual · meses ${patron.mesesPago.join('·')} · día ${patron.diaPago}`;
    case 'pagasExtra':
      return `pagas extra · meses ${patron.mesesExtra.join('·')}`;
    case 'variablePorMes':
      return `variable por mes · ${patron.mesesPago.length} meses`;
    case 'puntual':
      return `puntual · ${patron.fecha}`;
    default:
      return JSON.stringify(patron);
  }
}

function importeToValue(importe: CandidatoCompromiso['importeInferido']): {
  value: number;
  modoLabel: string;
} {
  switch (importe.modo) {
    case 'fijo':
      return { value: importe.importe, modoLabel: 'fijo' };
    case 'variable':
      return { value: importe.importeMedio, modoLabel: 'medio' };
    case 'diferenciadoPorMes': {
      const valid = importe.importesPorMes.filter((v) => v > 0);
      const avg = valid.length === 0 ? 0 : valid.reduce((s, v) => s + v, 0) / valid.length;
      return { value: avg, modoLabel: 'medio · por mes' };
    }
    case 'porPago': {
      const values = Object.values(importe.importesPorPago ?? {});
      const avg = values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
      return { value: avg, modoLabel: 'medio · por pago' };
    }
    default:
      return { value: 0, modoLabel: '?' };
  }
}

function scoreTone(confidence: number): 'pos' | 'gold' | 'neg' {
  if (confidence >= 80) return 'pos';
  if (confidence >= 65) return 'gold';
  return 'neg';
}

function tipoToPillVariant(tipo: TipoCompromiso): 'pos' | 'gold' | 'gris' {
  if (tipo === 'suministro' || tipo === 'comunidad' || tipo === 'impuesto') return 'gold';
  if (tipo === 'seguro' || tipo === 'cuota') return 'pos';
  return 'gris';
}

// ─── Tipos UI internos ─────────────────────────────────────────────────────

interface OverrideValues {
  alias?: string;
  tipo?: TipoCompromiso;
  subtipo?: string;
  categoria?: CategoriaGastoCompromiso;
  responsable?: ResponsableCompromiso;
  proveedorNombre?: string;
}

type OverridesMap = Map<string, OverrideValues>;

// ─── Modal de edición ──────────────────────────────────────────────────────

interface EditModalProps {
  candidato: CandidatoCompromiso;
  current: OverrideValues;
  onSave: (values: OverrideValues) => void;
  onCancel: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ candidato, current, onSave, onCancel }) => {
  const baseProp = candidato.propuesta;
  const [alias, setAlias] = useState(current.alias ?? baseProp.alias);
  const [tipo, setTipo] = useState<TipoCompromiso>(current.tipo ?? baseProp.tipo);
  const [subtipo, setSubtipo] = useState(current.subtipo ?? baseProp.subtipo ?? '');
  const [categoria, setCategoria] = useState<CategoriaGastoCompromiso>(
    current.categoria ?? baseProp.categoria,
  );
  const [responsable, setResponsable] = useState<ResponsableCompromiso>(
    current.responsable ?? baseProp.responsable,
  );
  const [proveedorNombre, setProveedorNombre] = useState(
    current.proveedorNombre ?? baseProp.proveedor.nombre,
  );

  // Accesibilidad · patrón canónico del repo · `useFocusTrap` traps Tab y
  // dispara CustomEvent('modal-escape') al pulsar Escape.
  const focusTrapRef = useFocusTrap(true);
  useEffect(() => {
    const node = focusTrapRef.current;
    if (!node) return;
    const handler = () => onCancel();
    node.addEventListener('modal-escape', handler);
    return () => node.removeEventListener('modal-escape', handler);
  }, [focusTrapRef, onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      alias: alias.trim(),
      tipo,
      subtipo: subtipo.trim() || undefined,
      categoria,
      responsable,
      proveedorNombre: proveedorNombre.trim(),
    });
  };

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-candidato-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--atlas-v5-card)',
          borderRadius: 12,
          padding: 'var(--atlas-v5-sp-7)',
          maxWidth: 520,
          width: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--atlas-v5-line)',
          outline: 'none',
        }}
      >
      <form onSubmit={handleSubmit}>
        <h2
          id="edit-candidato-title"
          style={{
            fontSize: 'var(--atlas-v5-fs-h2)',
            fontWeight: 700,
            color: 'var(--atlas-v5-ink)',
            marginTop: 0,
            marginBottom: 8,
          }}
        >
          Editar candidato
        </h2>
        <p
          style={{
            fontSize: 'var(--atlas-v5-fs-sub)',
            color: 'var(--atlas-v5-ink-4)',
            marginTop: 0,
            marginBottom: 'var(--atlas-v5-sp-5)',
          }}
        >
          Concepto bancario <strong>{baseProp.conceptoBancario}</strong> · cuenta{' '}
          {baseProp.cuentaCargo} · NO editables (matching exacto contra extracto).
        </p>

        <Field label="Alias">
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Tipo">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCompromiso)}
            style={inputStyle}
          >
            {TIPOS_EDITABLES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Subtipo (opcional · ej · luz · gas · agua · móvil · internet)">
          <input
            type="text"
            value={subtipo}
            onChange={(e) => setSubtipo(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Categoría">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaGastoCompromiso)}
            style={inputStyle}
          >
            {CATEGORIAS_EDITABLES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Responsable">
          <select
            value={responsable}
            onChange={(e) => setResponsable(e.target.value as ResponsableCompromiso)}
            style={inputStyle}
          >
            {RESPONSABLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Proveedor · nombre">
          <input
            type="text"
            value={proveedorNombre}
            onChange={(e) => setProveedorNombre(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 'var(--atlas-v5-sp-5)',
          }}
        >
          <button type="button" onClick={onCancel} style={btnGhostStyle}>
            Cancelar
          </button>
          <button type="submit" style={btnGoldStyle}>
            Guardar cambios
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label
    style={{
      display: 'block',
      marginBottom: 'var(--atlas-v5-sp-4)',
      fontSize: 'var(--atlas-v5-fs-sub-sm)',
      color: 'var(--atlas-v5-ink-3)',
    }}
  >
    <span
      style={{
        display: 'block',
        textTransform: 'uppercase',
        letterSpacing: 'var(--atlas-v5-ls-tag)',
        fontFamily: 'var(--atlas-v5-font-mono-tech)',
        fontSize: 'var(--atlas-v5-fs-chip-sm)',
        fontWeight: 700,
        color: 'var(--atlas-v5-ink-4)',
        marginBottom: 4,
      }}
    >
      {label}
    </span>
    {children}
  </label>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 4,
  fontFamily: 'var(--atlas-v5-font-ui)',
  fontSize: 13,
  color: 'var(--atlas-v5-ink)',
  background: 'var(--atlas-v5-card)',
  boxSizing: 'border-box',
};

const btnGoldStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid var(--atlas-v5-gold)',
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-white)',
  borderRadius: 4,
  fontFamily: 'var(--atlas-v5-font-ui)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnGhostStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid var(--atlas-v5-ink-3)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink)',
  borderRadius: 4,
  fontFamily: 'var(--atlas-v5-font-ui)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

// ─── Componente CandidatoCard ──────────────────────────────────────────────

interface CandidatoCardProps {
  candidato: CandidatoCompromiso;
  override: OverrideValues | undefined;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}

const CandidatoCard: React.FC<CandidatoCardProps> = ({
  candidato,
  override,
  selected,
  onToggle,
  onEdit,
  onDiscard,
}) => {
  const [showOcurrencias, setShowOcurrencias] = useState(false);
  const baseProp = candidato.propuesta;
  const alias = override?.alias ?? baseProp.alias;
  const tipo = override?.tipo ?? baseProp.tipo;
  const proveedor = override?.proveedorNombre ?? baseProp.proveedor.nombre;
  const importeInfo = importeToValue(candidato.importeInferido);

  return (
    <div
      style={{
        background: 'var(--atlas-v5-card)',
        border: `1px solid ${selected ? 'var(--atlas-v5-gold)' : 'var(--atlas-v5-line)'}`,
        borderRadius: 10,
        padding: 'var(--atlas-v5-sp-5)',
        marginBottom: 'var(--atlas-v5-sp-4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Seleccionar candidato ${alias}`}
          style={{ marginTop: 4, cursor: 'pointer' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 6,
            }}
          >
            <strong style={{ fontSize: 14, color: 'var(--atlas-v5-ink)' }}>{alias}</strong>
            <Pill variant={tipoToPillVariant(tipo)} asTag>
              {tipo}
            </Pill>
            <span
              style={{
                fontFamily: 'var(--atlas-v5-font-mono-num)',
                fontSize: 12,
                color: `var(--atlas-v5-${scoreTone(candidato.confidence)})`,
                fontWeight: 700,
                marginLeft: 'auto',
              }}
            >
              score {candidato.confidence}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--atlas-v5-ink-3)',
              fontFamily: 'var(--atlas-v5-font-mono-tech)',
              marginBottom: 4,
            }}
          >
            {proveedor} · cuenta {baseProp.cuentaCargo} · {patronToText(candidato.patronInferido)}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--atlas-v5-ink-3)',
              fontFamily: 'var(--atlas-v5-font-mono-num)',
              marginBottom: 6,
            }}
          >
            <MoneyValue value={-importeInfo.value} decimals={2} showSign tone="neg" /> ·{' '}
            {importeInfo.modoLabel}
          </div>
          {candidato.razonesScore.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginBottom: 4 }}>
              {candidato.razonesScore.join(' · ')}
            </div>
          )}
          {candidato.avisos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {candidato.avisos.map((a, i) => (
                <Pill key={i} variant="gold" asTag>
                  {a}
                </Pill>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 6,
              fontSize: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setShowOcurrencias((v) => !v)}
              style={btnLinkStyle}
              aria-expanded={showOcurrencias}
            >
              {showOcurrencias ? 'Ocultar' : 'Ver'} ocurrencias ({candidato.ocurrencias.length})
            </button>
            <button type="button" onClick={onEdit} style={btnLinkStyle}>
              <Icons.Edit size={11} strokeWidth={2} style={{ marginRight: 4 }} />
              Editar
            </button>
            <button type="button" onClick={onDiscard} style={btnLinkStyle}>
              <Icons.Delete size={11} strokeWidth={2} style={{ marginRight: 4 }} />
              Descartar
            </button>
          </div>

          {showOcurrencias && (
            <div
              style={{
                marginTop: 'var(--atlas-v5-sp-4)',
                padding: 'var(--atlas-v5-sp-3)',
                border: '1px dashed var(--atlas-v5-ink-5)',
                borderRadius: 6,
                background: 'var(--atlas-v5-card-alt)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={tdSubStyle}>Fecha</th>
                    <th style={{ ...tdSubStyle, textAlign: 'right' }}>Importe</th>
                    <th style={tdSubStyle}>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {candidato.ocurrencias.map((o) => (
                    <tr key={o.movementId}>
                      <td style={tdSubStyle}>{o.fecha.slice(0, 10)}</td>
                      <td
                        style={{
                          ...tdSubStyle,
                          textAlign: 'right',
                          fontFamily: 'var(--atlas-v5-font-mono-num)',
                        }}
                      >
                        <MoneyValue value={-o.importe} decimals={2} showSign tone="neg" />
                      </td>
                      <td style={{ ...tdSubStyle, color: 'var(--atlas-v5-ink-4)' }}>
                        {o.descripcionRaw}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const btnLinkStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card-alt)',
  color: 'var(--atlas-v5-ink-3)',
  borderRadius: 4,
  fontFamily: 'var(--atlas-v5-font-ui)',
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
};

const tdSubStyle: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'left',
  borderBottom: '1px solid var(--atlas-v5-line-3)',
  color: 'var(--atlas-v5-ink-3)',
};

// ─── Página principal ─────────────────────────────────────────────────────

const DetectarCompromisosPage: React.FC = () => {
  const navigate = useNavigate();
  const ctx = useOutletContext<PersonalOutletContext>();

  const [minOcurrencias, setMinOcurrencias] = useState<number>(3);
  const [maxAntiguedadMeses, setMaxAntiguedadMeses] = useState<number>(18);
  const [report, setReport] = useState<DetectionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<TipoCompromiso | 'todos'>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<OverridesMap>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);

  const compromisosActivos = ctx.compromisos.filter((c) => c.estado === 'activo').length;

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setDiscarded(new Set());
    setOverrides(new Map());
    try {
      const r = await detectAndPreview({ minOcurrencias, maxAntiguedadMeses });
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [minOcurrencias, maxAntiguedadMeses]);

  const visibleCandidatos = useMemo(() => {
    if (!report) return [];
    return report.candidatos.filter((c) => {
      if (discarded.has(c.id)) return false;
      if (filterTipo === 'todos') return true;
      const tipo = overrides.get(c.id)?.tipo ?? c.propuesta.tipo;
      return tipo === filterTipo;
    });
  }, [report, discarded, filterTipo, overrides]);

  // Scope de la selección al filtro activo · si el usuario marca elementos
  // en "Todos" y luego cambia a "Suministros", solo cuenta y aprueba los
  // visibles. Los "fuera de filtro" se muestran como aviso textual pero NO
  // se ejecutan en bulk.
  const selectedVisibleCount = useMemo(
    () => visibleCandidatos.reduce((n, c) => n + (selected.has(c.id) ? 1 : 0), 0),
    [visibleCandidatos, selected],
  );
  const hasHiddenSelected = selected.size !== selectedVisibleCount;

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDiscard = (id: string) => {
    setDiscarded((prev) => new Set(prev).add(id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const editingCandidato =
    editingId && report ? report.candidatos.find((c) => c.id === editingId) : null;

  const handleSaveEdit = (values: OverrideValues) => {
    if (!editingId) return;
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(editingId, values);
      return next;
    });
    setEditingId(null);
  };

  const buildOverridesForCreation = (ids: string[]): Map<string, Partial<CompromisoRecurrente>> => {
    const out = new Map<string, Partial<CompromisoRecurrente>>();
    for (const id of ids) {
      const ov = overrides.get(id);
      if (!ov) continue;
      const partial: Partial<CompromisoRecurrente> = {};
      if (ov.alias !== undefined) partial.alias = ov.alias;
      if (ov.tipo !== undefined) partial.tipo = ov.tipo;
      if (ov.subtipo !== undefined) partial.subtipo = ov.subtipo;
      if (ov.categoria !== undefined) partial.categoria = ov.categoria;
      if (ov.responsable !== undefined) partial.responsable = ov.responsable;
      if (ov.proveedorNombre !== undefined) partial.proveedor = { nombre: ov.proveedorNombre };
      out.set(id, partial);
    }
    return out;
  };

  const handleApproveSelected = async () => {
    if (!report) return;
    // Solo procesa los seleccionados que actualmente están visibles bajo
    // el filtro activo. Los seleccionados "fuera del filtro" se preservan
    // en `selected` por si el usuario vuelve a "Todos" sin perder estado.
    const visibleIds = new Set(visibleCandidatos.map((c) => c.id));
    const ids = Array.from(selected).filter((id) => visibleIds.has(id));
    if (ids.length === 0) return;
    const candidatos = report.candidatos.filter((c) => ids.includes(c.id));
    setApproving(true);
    try {
      const result = await createCompromisosFromCandidatos(candidatos, {
        ajustesPorCandidato: buildOverridesForCreation(ids),
      });
      const errores = result.erroresValidacion.length;
      const omitidos = result.duplicadosOmitidos.length;
      const creados = result.creados.length;
      if (creados > 0) {
        showToastV5(
          `${creados} compromiso${creados === 1 ? '' : 's'} creado${creados === 1 ? '' : 's'}` +
            (omitidos > 0 ? ` · ${omitidos} omitido${omitidos === 1 ? '' : 's'} (duplicado)` : '') +
            (errores > 0 ? ` · ${errores} con error` : ''),
        );
      } else if (omitidos > 0) {
        showToastV5(`Todos los seleccionados ya existían en el catálogo (${omitidos} omitidos)`);
      } else {
        showToastV5(`Sin cambios · ${errores} errores de validación`);
      }
      // Refrescar contexto Personal y re-correr detección · los aprobados
      // pasarán a `porCompromisoExistente` y desaparecerán del listado.
      ctx.reload();
      await handleAnalyze();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToastV5(`Error al aprobar: ${msg}`);
    } finally {
      setApproving(false);
    }
  };

  const handleDiscardOthers = () => {
    if (!report) return;
    // "Descartar todos los demás" opera dentro del filtro activo · descarta
    // los candidatos visibles que NO están seleccionados, preservando los
    // de otros tipos. Los seleccionados visibles se mantienen.
    const next = new Set<string>(discarded);
    for (const c of visibleCandidatos) {
      if (!selected.has(c.id)) next.add(c.id);
    }
    setDiscarded(next);
  };

  // Auto-detección al entrar (UX · evita estado vacío inicial confuso si el
  // usuario ya tiene movements). El usuario puede reanalizar con otros params.
  useEffect(() => {
    void handleAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHead
        title="Detectar compromisos recurrentes"
        sub={
          <>
            ATLAS analiza tus movimientos y propone compromisos · revisa · aprueba ·
            ATLAS los usará para clasificar futuros extractos automáticamente. ·{' '}
            <strong>{compromisosActivos}</strong> compromiso
            {compromisosActivos === 1 ? '' : 's'} activo{compromisosActivos === 1 ? '' : 's'} en tu
            catálogo.
          </>
        }
        breadcrumb={[
          { label: 'Personal', onClick: () => navigate('/personal') },
          { label: 'Gastos', onClick: () => navigate('/personal/gastos') },
          { label: 'Detectar compromisos' },
        ]}
        backLabel="Volver a Gastos"
        onBack={() => navigate('/personal/gastos')}
      />

      <CardV5>
        <CardV5.Title>Configuración de detección</CardV5.Title>
        <CardV5.Body>
          <div
            style={{
              display: 'flex',
              gap: 'var(--atlas-v5-sp-5)',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            <Field label="Mínimo ocurrencias">
              <select
                value={minOcurrencias}
                onChange={(e) => setMinOcurrencias(Number(e.target.value))}
                style={{ ...inputStyle, width: 120 }}
              >
                {[3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Antigüedad analizada (meses)">
              <select
                value={maxAntiguedadMeses}
                onChange={(e) => setMaxAntiguedadMeses(Number(e.target.value))}
                style={{ ...inputStyle, width: 120 }}
              >
                {[12, 18, 24, 36].map((n) => (
                  <option key={n} value={n}>
                    {n}m
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleAnalyze()}
              style={{ ...btnGoldStyle, opacity: loading ? 0.5 : 1, cursor: loading ? 'wait' : 'pointer' }}
            >
              <Icons.Sparkles size={13} strokeWidth={2} style={{ marginRight: 6 }} />
              {loading ? 'Analizando…' : 'Analizar movimientos'}
            </button>
          </div>
          {error && (
            <p style={{ color: 'var(--atlas-v5-neg)', marginTop: 8, fontSize: 13 }}>
              Error · {error}
            </p>
          )}
        </CardV5.Body>
      </CardV5>

      {report && !loading && (
        <>
          <CardV5>
            <CardV5.Title>
              {visibleCandidatos.length} candidato{visibleCandidatos.length === 1 ? '' : 's'} ·{' '}
              {report.estadisticas.candidatosFiltrados.porViviendaHabitual +
                report.estadisticas.candidatosFiltrados.porInmuebleInversion +
                report.estadisticas.candidatosFiltrados.porScoreInsuficiente}{' '}
              descartado
              {report.estadisticas.candidatosFiltrados.porViviendaHabitual +
                report.estadisticas.candidatosFiltrados.porInmuebleInversion +
                report.estadisticas.candidatosFiltrados.porScoreInsuficiente ===
              1
                ? ''
                : 's'}
              {' · '}
              {report.estadisticas.candidatosFiltrados.porCompromisoExistente} ya existente
              {report.estadisticas.candidatosFiltrados.porCompromisoExistente === 1 ? '' : 's'}
            </CardV5.Title>
            <CardV5.Body>
              {report.candidatos.length === 0 ? (
                <EmptyState
                  icon={<Icons.Sparkles size={20} />}
                  title="Sin candidatos detectados"
                  sub="Prueba a bajar el mínimo de ocurrencias o ampliar la ventana temporal · si tu histórico tiene < 3 meses, importa más extractos en Tesorería."
                />
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginBottom: 'var(--atlas-v5-sp-5)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {TIPO_FILTROS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFilterTipo(f.value)}
                        style={chipStyle(filterTipo === f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {visibleCandidatos.length === 0 ? (
                    <p
                      style={{
                        textAlign: 'center',
                        color: 'var(--atlas-v5-ink-4)',
                        fontSize: 13,
                        padding: '24px 0',
                      }}
                    >
                      Sin candidatos en este filtro.
                    </p>
                  ) : (
                    visibleCandidatos.map((c) => (
                      <CandidatoCard
                        key={c.id}
                        candidato={c}
                        override={overrides.get(c.id)}
                        selected={selected.has(c.id)}
                        onToggle={() => toggleSelected(c.id)}
                        onEdit={() => setEditingId(c.id)}
                        onDiscard={() => handleDiscard(c.id)}
                      />
                    ))
                  )}
                </>
              )}
            </CardV5.Body>
          </CardV5>

          {visibleCandidatos.length > 0 && (
            <div
              style={{
                position: 'sticky',
                bottom: 0,
                background: 'var(--atlas-v5-card)',
                border: '1px solid var(--atlas-v5-line)',
                borderRadius: 10,
                padding: 'var(--atlas-v5-sp-5)',
                marginTop: 'var(--atlas-v5-sp-5)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--atlas-v5-ink-3)',
                  flex: 1,
                  minWidth: 200,
                }}
              >
                <strong>{selectedVisibleCount}</strong> de {visibleCandidatos.length} candidatos
                seleccionados
                {hasHiddenSelected && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--atlas-v5-warn)' }}>
                      {selected.size - selectedVisibleCount} fuera del filtro actual
                    </span>
                  </>
                )}
              </span>
              <button
                type="button"
                disabled={selectedVisibleCount === 0 || approving}
                onClick={() => void handleApproveSelected()}
                style={{
                  ...btnGoldStyle,
                  opacity: selectedVisibleCount === 0 || approving ? 0.5 : 1,
                  cursor: selectedVisibleCount === 0 || approving ? 'not-allowed' : 'pointer',
                }}
              >
                <Icons.Check size={13} strokeWidth={2} style={{ marginRight: 6 }} />
                {approving
                  ? 'Aprobando…'
                  : `Aprobar seleccionados (${selectedVisibleCount})`}
              </button>
              <button
                type="button"
                onClick={handleDiscardOthers}
                disabled={selectedVisibleCount === 0}
                style={{
                  ...btnGhostStyle,
                  opacity: selectedVisibleCount === 0 ? 0.5 : 1,
                  cursor: selectedVisibleCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Descartar todos los demás
              </button>
            </div>
          )}
        </>
      )}

      {editingCandidato && (
        <EditModal
          candidato={editingCandidato}
          current={overrides.get(editingCandidato.id) ?? {}}
          onSave={handleSaveEdit}
          onCancel={() => setEditingId(null)}
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
});

export default DetectarCompromisosPage;
