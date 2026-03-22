import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle, ChevronDown, ChevronRight, HelpCircle, Link2, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  CampoReconciliado,
  EstadoReconciliacion,
  PropiedadReconciliable,
  ReconciliacionCompleta,
  ReconciliacionInmueble,
} from '../../../../services/reconciliacionService';
import {
  aplicarReconciliacion,
  calcularEstadisticasReconciliacion,
  vincularManualmente,
} from '../../../../services/reconciliacionService';

interface Props {
  reconciliacion: ReconciliacionCompleta;
  onComplete: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ReconciliacionPanel({ reconciliacion, onComplete, onCancel }: Props) {
  const [datos, setDatos] = useState<ReconciliacionCompleta>(reconciliacion);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [ejecutando, setEjecutando] = useState(false);
  const [vinculandoRef, setVinculandoRef] = useState<string | null>(null);
  const [seleccionManual, setSeleccionManual] = useState<Record<string, string>>({});

  const stats = useMemo(
    () => calcularEstadisticasReconciliacion(datos),
    [datos],
  );

  const candidatosManuales = useMemo(
    () => datos.inmuebles.filter((inmueble) => inmueble.tipo === 'solo_atlas' && inmueble.datosAtlas),
    [datos.inmuebles],
  );

  function toggleExpand(ref: string) {
    setExpandido((prev) => ({ ...prev, [ref]: !prev[ref] }));
  }

  function actualizarInmueble(
    inmuebleRef: string,
    updater: (inmueble: ReconciliacionInmueble) => ReconciliacionInmueble,
  ) {
    setDatos((prev) => ({
      ...prev,
      estadisticas: prev.estadisticas,
      inmuebles: prev.inmuebles.map((inmueble) => (
        inmueble.referenciaCatastral === inmuebleRef ? updater(inmueble) : inmueble
      )),
    }));
  }

  function cambiarDecisionCampo(inmRef: string, campo: string, decision: CampoReconciliado['decision']) {
    actualizarInmueble(inmRef, (inmueble) => {
      const campos = inmueble.campos.map((item) => item.campo === campo ? { ...item, decision } : item);
      return {
        ...inmueble,
        campos,
        estado: calcularEstadoInmueble(inmueble.estado, campos),
      };
    });
  }

  function aceptarTodoInmueble(inmRef: string) {
    actualizarInmueble(inmRef, (inmueble) => ({
      ...inmueble,
      estado: 'aceptado',
      campos: inmueble.campos.map((campo) => ({
        ...campo,
        decision: campo.tipo === 'difiere' || campo.tipo === 'solo_aeat' ? 'usar_aeat' : campo.decision,
      })),
    }));
  }

  function rechazarInmueble(inmRef: string) {
    actualizarInmueble(inmRef, (inmueble) => ({ ...inmueble, estado: 'rechazado' }));
  }

  async function handleVincularManual(inmueble: ReconciliacionInmueble) {
    const atlasId = seleccionManual[inmueble.referenciaCatastral];
    if (!atlasId || !inmueble.datosAeat) {
      toast.error('Selecciona primero un inmueble de ATLAS');
      return;
    }

    setVinculandoRef(inmueble.referenciaCatastral);
    try {
      const { campos, inmuebleAtlas } = await vincularManualmente(inmueble.datosAeat, atlasId);
      setDatos((prev) => {
        const actualizados = prev.inmuebles.flatMap((item) => {
          if (item.referenciaCatastral === inmueble.referenciaCatastral) {
            return [{
              ...item,
              tipo: 'match_parcial' as const,
              datosAtlas: inmuebleAtlas,
              campos,
              estado: 'vinculado_manual' as const,
            }];
          }

          if (item.tipo === 'solo_atlas' && item.datosAtlas?.id === atlasId) {
            return [];
          }

          return [item];
        });

        return {
          ...prev,
          estadisticas: prev.estadisticas,
          inmuebles: actualizados,
        };
      });
      setExpandido((prev) => ({ ...prev, [inmueble.referenciaCatastral]: true }));
      toast.success('Inmueble vinculado manualmente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo vincular el inmueble');
    } finally {
      setVinculandoRef(null);
    }
  }

  async function handleAplicar() {
    setEjecutando(true);
    try {
      const resultado = await aplicarReconciliacion({ ...datos, estadisticas: stats });
      if (resultado.errores.length > 0) {
        resultado.errores.forEach((error) => toast.error(error));
      }
      if (resultado.actualizados || resultado.creados) {
        toast.success(`Reconciliación aplicada: ${resultado.actualizados} actualizados, ${resultado.creados} creados`);
      }
      await onComplete();
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--s4)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s3)' }}>
        <StatChip Icon={CheckCircle} label="Coinciden" value={stats.coincidencias} colorVar="var(--s-pos)" bgVar="var(--s-pos-bg)" />
        <StatChip Icon={AlertTriangle} label="Diferencias" value={stats.diferencias} colorVar="var(--s-warn)" bgVar="var(--s-warn-bg)" />
        <StatChip Icon={Plus} label="Solo en AEAT" value={stats.sinDatosAtlas} colorVar="var(--blue)" bgVar="var(--n-100)" />
        <StatChip Icon={HelpCircle} label="Pendientes" value={stats.pendientesDeDecision} colorVar="var(--n-700)" bgVar="var(--n-100)" />
      </div>

      <div style={{ display: 'grid', gap: 'var(--s3)' }}>
        {datos.inmuebles.map((inmueble, index) => (
          <InmuebleReconciliado
            key={`${inmueble.referenciaCatastral}-${index}`}
            inmueble={inmueble}
            expandido={Boolean(expandido[inmueble.referenciaCatastral])}
            onToggleExpand={() => toggleExpand(inmueble.referenciaCatastral)}
            onCambiarDecision={(campo, decision) => cambiarDecisionCampo(inmueble.referenciaCatastral, campo, decision)}
            onAceptarTodo={() => aceptarTodoInmueble(inmueble.referenciaCatastral)}
            onRechazar={() => rechazarInmueble(inmueble.referenciaCatastral)}
            manualCandidates={candidatosManuales.map((item) => item.datosAtlas!).filter(Boolean)}
            selectedManualId={seleccionManual[inmueble.referenciaCatastral] ?? ''}
            onSelectManual={(atlasId) => setSeleccionManual((prev) => ({ ...prev, [inmueble.referenciaCatastral]: atlasId }))}
            onVincularManual={() => handleVincularManual(inmueble)}
            vinculando={vinculandoRef === inmueble.referenciaCatastral}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s3)', marginTop: 'var(--s2)' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={ejecutando}
          style={secondaryButtonStyle}
        >
          Solo guardar declaración
        </button>
        <button
          type="button"
          onClick={handleAplicar}
          disabled={ejecutando}
          style={primaryButtonStyle}
        >
          {ejecutando ? 'Aplicando…' : 'Aplicar cambios e importar'}
        </button>
      </div>
    </div>
  );
}

const secondaryButtonStyle = {
  padding: 'var(--s3) var(--s4)',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--n-300)',
  background: 'var(--white)',
  color: 'var(--n-700)',
  fontSize: 'var(--t-sm)',
  fontFamily: 'IBM Plex Sans, sans-serif',
  cursor: 'pointer',
} satisfies CSSProperties;

const primaryButtonStyle = {
  padding: 'var(--s3) var(--s4)',
  borderRadius: 'var(--r-md)',
  border: 'none',
  background: 'var(--blue)',
  color: 'var(--white)',
  fontSize: 'var(--t-sm)',
  fontWeight: 600,
  fontFamily: 'IBM Plex Sans, sans-serif',
  cursor: 'pointer',
} satisfies CSSProperties;

function StatChip({ Icon, label, value, colorVar, bgVar }: {
  Icon: LucideIcon;
  label: string;
  value: number;
  colorVar: string;
  bgVar: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s2)',
      padding: 'var(--s2) var(--s3)',
      borderRadius: 'var(--r-md)',
      background: bgVar,
      color: colorVar,
      fontSize: 'var(--t-xs)',
      fontWeight: 600,
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}>
      <Icon size={14} />
      <span>{value}</span>
      <span style={{ fontWeight: 400 }}>{label}</span>
    </div>
  );
}

function InmuebleReconciliado({
  inmueble,
  expandido,
  onToggleExpand,
  onCambiarDecision,
  onAceptarTodo,
  onRechazar,
  manualCandidates,
  selectedManualId,
  onSelectManual,
  onVincularManual,
  vinculando,
}: {
  inmueble: ReconciliacionInmueble;
  expandido: boolean;
  onToggleExpand: () => void;
  onCambiarDecision: (campo: string, decision: CampoReconciliado['decision']) => void;
  onAceptarTodo: () => void;
  onRechazar: () => void;
  manualCandidates: PropiedadReconciliable[];
  selectedManualId: string;
  onSelectManual: (atlasId: string) => void;
  onVincularManual: () => void;
  vinculando: boolean;
}) {
  const tipoConfig: Record<ReconciliacionInmueble['tipo'], { Icon: typeof CheckCircle; colorVar: string; label: string }> = {
    match_exacto: { Icon: CheckCircle, colorVar: 'var(--s-pos)', label: 'Coincide' },
    match_parcial: { Icon: AlertTriangle, colorVar: 'var(--s-warn)', label: 'Diferencias' },
    solo_aeat: { Icon: Plus, colorVar: 'var(--blue)', label: 'Nuevo' },
    solo_atlas: { Icon: HelpCircle, colorVar: 'var(--n-500)', label: 'Solo en ATLAS' },
  };

  const cfg = tipoConfig[inmueble.tipo];
  const rechazado = inmueble.estado === 'rechazado';

  return (
    <div style={{
      border: '1px solid var(--n-200)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      opacity: rechazado ? 0.45 : 1,
      transition: 'opacity 150ms ease',
      background: 'var(--white)',
    }}>
      <button
        type="button"
        onClick={onToggleExpand}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s3)',
          padding: 'var(--s3) var(--s4)',
          background: 'var(--n-50)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {expandido ? <ChevronDown size={16} style={{ color: 'var(--n-500)' }} /> : <ChevronRight size={16} style={{ color: 'var(--n-500)' }} />}
        <cfg.Icon size={16} style={{ color: cfg.colorVar, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--n-900)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {inmueble.direccion || inmueble.referenciaCatastral}
          </div>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--n-500)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {inmueble.referenciaCatastral}
          </div>
        </div>
        <span style={{
          fontSize: 'var(--t-xs)',
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: 'var(--r-sm)',
          background: cfg.colorVar,
          color: 'var(--white)',
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}>
          {cfg.label}
        </span>
      </button>

      {expandido && !rechazado && (
        <div style={{ display: 'grid', gap: 'var(--s3)', padding: 'var(--s3) var(--s4)' }}>
          {inmueble.tipo === 'solo_atlas' && inmueble.hipotesis && (
            <div style={{
              padding: 'var(--s2) var(--s3)',
              background: 'var(--s-warn-bg)',
              borderRadius: 'var(--r-md)',
              color: 'var(--s-warn)',
              fontSize: 'var(--t-xs)',
            }}>
              {inmueble.hipotesis === 'vendido_antes_del_ejercicio'
                ? 'Este inmueble figura como vendido o inactivo en ATLAS.'
                : 'Este inmueble no aparece en la declaración. Revisa si no estuvo arrendado o si quedó fuera del PDF.'}
            </div>
          )}

          {inmueble.campos.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-xs)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--n-200)' }}>
                  <th style={tableHeadStyleLeft}>Campo</th>
                  <th style={tableHeadStyleRight}>ATLAS</th>
                  <th style={{ width: 30 }} />
                  <th style={tableHeadStyleRight}>AEAT</th>
                  <th style={tableHeadStyleCenter}>Aplicar</th>
                </tr>
              </thead>
              <tbody>
                {inmueble.campos.map((campo) => (
                  <FilaCampo key={campo.campo} campo={campo} onCambiar={(decision) => onCambiarDecision(campo.campo, decision)} />
                ))}
              </tbody>
            </table>
          )}

          {inmueble.tipo === 'solo_aeat' && manualCandidates.length > 0 && inmueble.datosAeat && (
            <div style={{
              display: 'grid',
              gap: 'var(--s2)',
              padding: 'var(--s3)',
              borderRadius: 'var(--r-md)',
              background: 'var(--n-50)',
              border: '1px dashed var(--n-300)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', color: 'var(--n-700)', fontSize: 'var(--t-xs)', fontWeight: 600 }}>
                <Link2 size={14} />
                Vinculación manual
              </div>
              <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
                <select
                  value={selectedManualId}
                  onChange={(event) => onSelectManual(event.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    padding: 'var(--s2)',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--n-300)',
                    background: 'var(--white)',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                  }}
                >
                  <option value="">Selecciona inmueble de ATLAS</option>
                  {manualCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.direccion || candidate.referenciaCatastral || `ATLAS ${candidate.id}`}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={onVincularManual} disabled={vinculando} style={secondaryButtonStyle}>
                  {vinculando ? 'Vinculando…' : 'Vincular'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s2)', flexWrap: 'wrap' }}>
            {inmueble.tipo === 'solo_atlas' && (
              <button type="button" onClick={onRechazar} style={secondaryButtonStyle}>
                Ignorar
              </button>
            )}
            {(inmueble.tipo === 'match_parcial' || inmueble.tipo === 'solo_aeat') && (
              <button type="button" onClick={onAceptarTodo} style={primaryButtonStyle}>
                Aceptar todo de AEAT
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const tableHeadStyleLeft = {
  textAlign: 'left',
  padding: 'var(--s2)',
  color: 'var(--n-500)',
  fontWeight: 500,
} satisfies CSSProperties;

const tableHeadStyleRight = {
  textAlign: 'right',
  padding: 'var(--s2)',
  color: 'var(--n-500)',
  fontWeight: 500,
} satisfies CSSProperties;

const tableHeadStyleCenter = {
  textAlign: 'center',
  padding: 'var(--s2)',
  color: 'var(--n-500)',
  fontWeight: 500,
} satisfies CSSProperties;

function FilaCampo({ campo, onCambiar }: {
  campo: CampoReconciliado;
  onCambiar: (decision: CampoReconciliado['decision']) => void;
}) {
  const formatear = (valor: unknown): string => {
    if (valor === undefined || valor === null || valor === '') return '—';
    if (campo.formato === 'moneda') return `${Number(valor).toLocaleString('es-ES')} €`;
    if (campo.formato === 'porcentaje') return `${Number(valor).toLocaleString('es-ES')}%`;
    if (campo.formato === 'boolean') return valor ? 'Sí' : 'No';
    return String(valor);
  };

  const bgColor = campo.tipo === 'coincide'
    ? 'transparent'
    : campo.tipo === 'difiere'
      ? 'var(--s-warn-bg)'
      : 'var(--n-50)';

  return (
    <tr style={{ background: bgColor, borderBottom: '1px solid var(--n-100)' }}>
      <td style={{ padding: 'var(--s2)', color: 'var(--n-700)' }}>{campo.label}</td>
      <td style={{
        padding: 'var(--s2)',
        textAlign: 'right',
        fontFamily: 'IBM Plex Mono, monospace',
        color: campo.decision === 'mantener_atlas' ? 'var(--n-900)' : 'var(--n-500)',
        fontWeight: campo.decision === 'mantener_atlas' ? 500 : 400,
        textDecoration: campo.decision === 'usar_aeat' ? 'line-through' : 'none',
      }}>
        {formatear(campo.valorAtlas)}
      </td>
      <td style={{ textAlign: 'center', padding: 'var(--s1)' }}>
        {campo.tipo === 'difiere' && <ArrowRight size={12} style={{ color: 'var(--n-500)' }} />}
      </td>
      <td style={{
        padding: 'var(--s2)',
        textAlign: 'right',
        fontFamily: 'IBM Plex Mono, monospace',
        color: campo.decision === 'usar_aeat' ? 'var(--n-900)' : 'var(--n-500)',
        fontWeight: campo.decision === 'usar_aeat' ? 500 : 400,
        textDecoration: campo.decision === 'mantener_atlas' && campo.tipo === 'difiere' ? 'line-through' : 'none',
      }}>
        {formatear(campo.valorAeat)}
      </td>
      <td style={{ textAlign: 'center', padding: 'var(--s2)' }}>
        {campo.tipo === 'coincide' ? (
          <CheckCircle size={14} style={{ color: 'var(--s-pos)' }} />
        ) : (
          <select
            value={campo.decision}
            onChange={(event) => onCambiar(event.target.value as CampoReconciliado['decision'])}
            style={{
              fontSize: 'var(--t-xs)',
              padding: '2px 4px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--n-300)',
              background: 'var(--white)',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          >
            {campo.valorAtlas !== undefined && <option value="mantener_atlas">ATLAS</option>}
            {campo.valorAeat !== undefined && <option value="usar_aeat">AEAT</option>}
          </select>
        )}
      </td>
    </tr>
  );
}

function calcularEstadoInmueble(
  estadoActual: EstadoReconciliacion,
  campos: CampoReconciliado[],
): EstadoReconciliacion {
  if (estadoActual === 'rechazado') return 'rechazado';
  if (campos.some((campo) => campo.decision === 'pendiente')) return 'pendiente';
  return estadoActual === 'vinculado_manual' ? 'vinculado_manual' : 'aceptado';
}
