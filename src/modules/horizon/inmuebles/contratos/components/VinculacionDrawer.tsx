import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  calcularPropostaDistribucion,
  confirmarVinculacion,
  dejarSinVincular,
  PropuestaDistribucion,
  ContratoPropuesta,
} from '../../../../../services/vinculacionFiscalService';
import { formatDate } from '../../../../../utils/formatUtils';
import toast from 'react-hot-toast';

interface VinculacionDrawerProps {
  open: boolean;
  sinIdentificadorId: number;
  ejercicio: number;
  inmuebleAlias: string;
  onClose: () => void;
  onVinculado: () => void;
}

const formatEuroMono = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const VinculacionDrawer: React.FC<VinculacionDrawerProps> = ({
  open,
  sinIdentificadorId,
  ejercicio,
  inmuebleAlias,
  onClose,
  onVinculado,
}) => {
  const navigate = useNavigate();
  const [propuesta, setPropuesta] = useState<PropuestaDistribucion | null>(null);
  const [asignaciones, setAsignaciones] = useState<Record<number, number>>({});
  const [incluidos, setIncluidos] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !sinIdentificadorId || !ejercicio) return;

    setLoading(true);
    setPropuesta(null);
    setAsignaciones({});
    setIncluidos(new Set());

    calcularPropostaDistribucion(sinIdentificadorId, ejercicio)
      .then((p) => {
        setPropuesta(p);
        const initAsig: Record<number, number> = {};
        const initIncluidos = new Set<number>();
        p.contratos.forEach((c) => {
          initAsig[c.contratoId] = c.importeAsignado;
          initIncluidos.add(c.contratoId);
        });
        setAsignaciones(initAsig);
        setIncluidos(initIncluidos);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Error al calcular la propuesta de distribución');
      })
      .finally(() => setLoading(false));
  }, [open, sinIdentificadorId, ejercicio]);

  // Only sum asignaciones for included contracts
  const totalAsignado = propuesta
    ? propuesta.contratos
        .filter((c) => incluidos.has(c.contratoId))
        .reduce((s, c) => s + (asignaciones[c.contratoId] || 0), 0)
    : 0;
  const diferencia = propuesta
    ? Math.round((propuesta.importeDeclarado - totalAsignado) * 100) / 100
    : 0;

  const handleAsignacionChange = (contratoId: number, value: string) => {
    const num = parseFloat(value.replace(',', '.')) || 0;
    setAsignaciones((prev) => ({ ...prev, [contratoId]: num }));
  };

  const handleToggleIncluido = (contratoId: number) => {
    setIncluidos((prev) => {
      const next = new Set(prev);
      if (next.has(contratoId)) {
        next.delete(contratoId);
      } else {
        next.add(contratoId);
        // Always restore the proposed amount unconditionally when re-including
        const original = propuesta?.contratos.find((c) => c.contratoId === contratoId);
        if (original) {
          setAsignaciones((a) => ({ ...a, [contratoId]: original.importePropuesto }));
        }
      }
      return next;
    });
  };

  const handleConfirmar = async () => {
    if (!propuesta) return;
    if (diferencia < 0) return;

    setSubmitting(true);
    try {
      // Only send contracts that are included (excluded ones get 0 and are skipped by the service)
      // Only send contracts that are included and have a positive amount
      const asigs = propuesta.contratos
        .filter((c) => incluidos.has(c.contratoId) && (asignaciones[c.contratoId] || 0) > 0)
        .map((c) => ({
          contratoId: c.contratoId,
          importeAsignado: asignaciones[c.contratoId] || 0,
        }));
      await confirmarVinculacion(sinIdentificadorId, ejercicio, asigs);
      toast.success('Ingresos vinculados correctamente');
      onVinculado();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Error al confirmar la vinculación');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDejarSinVincular = async () => {
    setSubmitting(true);
    try {
      await dejarSinVincular(sinIdentificadorId, ejercicio);
      toast.success('Ejercicio marcado como sin vincular');
      onVinculado();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Error al marcar como sin vincular');
    } finally {
      setSubmitting(false);
    }
  };

  const hayAlgunoIncluido = propuesta
    ? propuesta.contratos.some((c) => incluidos.has(c.contratoId))
    : false;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 199 }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 480,
          height: '100vh',
          background: 'var(--white)',
          borderLeft: '1px solid var(--grey-200)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--grey-200)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--navy-900)' }}>
                Vincular ingresos {ejercicio}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--grey-500)' }}>
                {inmuebleAlias}
                {propuesta && (
                  <>
                    {' · '}
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      {formatEuroMono(propuesta.importeDeclarado)}
                    </span>{' '}
                    declarados
                  </>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: 'var(--grey-500)',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--grey-500)' }}>
              Calculando propuesta…
            </div>
          )}

          {!loading && propuesta && (
            <>
              {/* KPIs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  background: 'var(--grey-50)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 20,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--grey-500)', marginBottom: 2 }}>
                    Declarado AEAT
                  </div>
                  <div
                    style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--navy-900)',
                    }}
                  >
                    {formatEuroMono(propuesta.importeDeclarado)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--grey-500)', marginBottom: 2 }}>
                    Asignado
                  </div>
                  <div
                    style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--navy-900)',
                    }}
                  >
                    {formatEuroMono(totalAsignado)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--grey-500)', marginBottom: 2 }}>
                    Diferencia
                  </div>
                  <div
                    style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 13,
                      fontWeight: 600,
                      color: diferencia === 0 ? 'var(--navy-900)' : 'var(--grey-500)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {diferencia === 0 && <Check size={13} />}
                    {formatEuroMono(diferencia)}
                  </div>
                </div>
              </div>

              {/* Aviso diferencia */}
              {diferencia !== 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: diferencia < 0 ? 'var(--error-50, #fff0f0)' : 'var(--grey-50)',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    color: diferencia < 0 ? 'var(--error, #dc2626)' : 'var(--grey-500)',
                  }}
                >
                  <AlertCircle size={14} />
                  {diferencia > 0
                    ? `Quedan ${formatEuroMono(diferencia)} sin asignar`
                    : `Has asignado ${formatEuroMono(Math.abs(diferencia))} de más`}
                </div>
              )}

              {/* Lista de contratos */}
              {propuesta.contratos.length === 0 ? (
                <div
                  style={{
                    border: '1px solid var(--grey-200)',
                    borderRadius: 10,
                    padding: 24,
                    textAlign: 'center',
                  }}
                >
                  <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--grey-500)' }}>
                    No hay contratos cargados para este inmueble en este período. Crea los contratos
                    primero desde Alquileres.
                  </p>
                  <button
                    onClick={() => navigate('/inmuebles/contratos')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      background: 'var(--navy-900)',
                      color: 'var(--white)',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Ir a Alquileres <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {propuesta.contratos.map((c: ContratoPropuesta) => (
                    <ContratoCard
                      key={c.contratoId}
                      contrato={c}
                      importeAsignado={asignaciones[c.contratoId] ?? c.importeAsignado}
                      incluido={incluidos.has(c.contratoId)}
                      onToggleIncluido={() => handleToggleIncluido(c.contratoId)}
                      onChange={(val) => handleAsignacionChange(c.contratoId, val)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--grey-200)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <button
            onClick={handleDejarSinVincular}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              color: 'var(--grey-500)',
              fontSize: 13,
              padding: '8px 0',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            Dejar sin vincular
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--grey-300)',
                borderRadius: 6,
                background: 'var(--white)',
                color: 'var(--navy-900)',
                fontSize: 13,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={
                submitting ||
                diferencia < 0 ||
                !propuesta ||
                propuesta.contratos.length === 0 ||
                !hayAlgunoIncluido
              }
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                background: 'var(--navy-900)',
                color: 'var(--white)',
                fontSize: 13,
                cursor:
                  submitting ||
                  diferencia < 0 ||
                  !propuesta ||
                  propuesta.contratos.length === 0 ||
                  !hayAlgunoIncluido
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  submitting ||
                  diferencia < 0 ||
                  !propuesta ||
                  propuesta.contratos.length === 0 ||
                  !hayAlgunoIncluido
                    ? 0.5
                    : 1,
              }}
            >
              Confirmar asignación
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

interface ContratoCardProps {
  contrato: ContratoPropuesta;
  importeAsignado: number;
  incluido: boolean;
  onToggleIncluido: () => void;
  onChange: (value: string) => void;
}

const ContratoCard: React.FC<ContratoCardProps> = ({
  contrato,
  importeAsignado,
  incluido,
  onToggleIncluido,
  onChange,
}) => (
  <div
    style={{
      border: '1px solid var(--grey-200)',
      borderRadius: 10,
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      opacity: incluido ? 1 : 0.45,
      transition: 'opacity 0.15s ease',
    }}
  >
    {/* Toggle checkbox */}
    <button
      type="button"
      role="checkbox"
      aria-checked={incluido}
      aria-label={incluido ? 'Excluir contrato de la vinculación' : 'Incluir contrato en la vinculación'}
      onClick={onToggleIncluido}
      style={{
        flexShrink: 0,
        width: 18,
        height: 18,
        borderRadius: 4,
        border: `2px solid ${incluido ? 'var(--navy-900)' : 'var(--grey-300)'}`,
        background: incluido ? 'var(--navy-900)' : 'var(--white)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--navy-900)'; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {incluido && <Check size={11} color="var(--white)" strokeWidth={3} />}
    </button>

    {/* Info */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-900)', marginBottom: 2 }}>
        {contrato.habitacionId ? `${contrato.habitacionId} · ` : ''}
        {contrato.inquilinoNombre.toUpperCase()}
      </div>
      <div style={{ fontSize: 12, color: 'var(--grey-500)' }}>
        {formatDate(contrato.fechaInicio)} → {formatDate(contrato.fechaFinEfectiva)} ·{' '}
        <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
            contrato.rentaMensual
          )}
        </span>
        /mes · {contrato.diasActivosEnEjercicio} días
      </div>
    </div>

    {/* Importe input */}
    <div style={{ flexShrink: 0 }}>
      <input
        type="number"
        min="0"
        step="0.01"
        value={importeAsignado}
        disabled={!incluido}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 100,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 13,
          textAlign: 'right',
          border: '1px solid var(--grey-300)',
          borderRadius: 6,
          padding: '6px 8px',
          color: 'var(--navy-900)',
          background: incluido ? 'var(--white)' : 'var(--grey-50)',
          cursor: incluido ? 'text' : 'not-allowed',
        }}
      />
    </div>
  </div>
);

export default VinculacionDrawer;
