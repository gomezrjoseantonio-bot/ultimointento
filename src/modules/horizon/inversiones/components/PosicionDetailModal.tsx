// PosicionDetailModal.tsx
// ATLAS HORIZON: Detailed modal for an investment position showing aportaciones history

import React from 'react';
import { X, Plus, RefreshCw, Edit } from 'lucide-react';
import { PosicionInversion } from '../../../../types/inversiones';

interface PosicionDetailModalProps {
  posicion: PosicionInversion;
  onClose: () => void;
  onAddAportacion: () => void;
  onActualizarValor: () => void;
  onEditarPosicion: () => void;
}

const PosicionDetailModal: React.FC<PosicionDetailModalProps> = ({
  posicion,
  onClose,
  onAddAportacion,
  onActualizarValor,
  onEditarPosicion,
}) => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatDate = (isoDate: string) =>
    new Date(isoDate).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const tipoLabels: Record<string, string> = {
    fondo_inversion: 'Fondo inversión',
    accion: 'Acción',
    etf: 'ETF',
    plan_pensiones: 'Plan pensiones',
    plan_empleo: 'Plan empleo',
    crypto: 'Crypto',
    deposito: 'Depósito',
    otro: 'Otro',
  };

  const tipoAportacionLabel: Record<string, string> = {
    aportacion: 'Aportación',
    reembolso: 'Reembolso',
    dividendo: 'Dividendo',
  };

  const tipoAportacionColor: Record<string, string> = {
    aportacion: 'var(--atlas-blue)',
    reembolso: '#f97316',
    dividendo: '#8b5cf6',
  };

  const isPositive = posicion.rentabilidad_euros >= 0;
  // Sort aportaciones by date descending
  const aportacionesOrdenadas = [...posicion.aportaciones].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(2, 30, 63, 0.56)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--surface-card, #FFFFFF)',
        border: '1px solid var(--border, #E2E5EE)',
        boxShadow: 'var(--shadow-2, 0 10px 28px rgba(2, 30, 63, 0.16))',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid var(--hz-neutral-300)',
        }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-inter)',
              fontSize: 'var(--text-h2)',
              fontWeight: 600,
              color: 'var(--atlas-navy-1)',
              margin: '0 0 0.25rem 0',
            }}>
              {posicion.nombre}
            </h2>
            <span style={{
              fontFamily: 'var(--font-inter)',
              fontSize: 'var(--text-caption)',
              color: 'var(--text-gray)',
            }}>
              {tipoLabels[posicion.tipo] || posicion.tipo} · {posicion.entidad}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--gray-500)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Valoración summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}>
            <div style={{
              background: 'var(--blue-050)',
              borderRadius: '10px',
              padding: '1rem',
            }}>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-gray)',
                marginBottom: '0.25rem',
              }}>
                Valor actual
              </div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--atlas-navy-1)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatCurrency(posicion.valor_actual)}
              </div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '0.75rem',
                color: 'var(--text-gray)',
                marginTop: '0.25rem',
              }}>
                {formatDate(posicion.fecha_valoracion)}
              </div>
            </div>

            <div style={{
              background: 'var(--gray-050)',
              borderRadius: '10px',
              padding: '1rem',
            }}>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-gray)',
                marginBottom: '0.25rem',
              }}>
                Total aportado
              </div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--atlas-navy-1)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatCurrency(posicion.total_aportado)}
              </div>
            </div>

            <div style={{
              background: isPositive ? 'var(--s-pos-bg)' : 'var(--s-neg-bg)',
              borderRadius: '10px',
              padding: '1rem',
            }}>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                color: 'var(--gray-500)',
                marginBottom: '0.25rem',
              }}>
                Rentabilidad
              </div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: isPositive ? 'var(--s-pos)' : 'var(--s-neg)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {posicion.rentabilidad_porcentaje >= 0 ? '+' : ''}
                {posicion.rentabilidad_porcentaje.toFixed(1)}%
              </div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '0.75rem',
                color: isPositive ? 'var(--s-pos)' : 'var(--s-neg)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {posicion.rentabilidad_euros >= 0 ? '+' : ''}
                {formatCurrency(posicion.rentabilidad_euros)}
              </div>
            </div>
          </div>

          {/* Aportaciones history */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}>
              <h3 style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                margin: 0,
              }}>
                Histórico de aportaciones
              </h3>
              <button
                onClick={onAddAportacion}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.5rem 1rem',
                  background: 'var(--atlas-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-inter)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                Añadir aportación
              </button>
            </div>

            {aportacionesOrdenadas.length === 0 ? (
              <p style={{
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-gray)',
                textAlign: 'center',
                padding: '1.5rem',
                background: 'var(--gray-100)',
                borderRadius: '8px',
                margin: 0,
              }}>
                No hay aportaciones registradas
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: 'var(--font-inter)',
                  fontSize: 'var(--text-caption)',
                }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Fecha', 'Tipo', 'Importe', 'Notas'].map(col => (
                        <th key={col} style={{
                          textAlign: 'left',
                          padding: '0.5rem 0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-gray)',
                        }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aportacionesOrdenadas.map(ap => (
                      <tr key={ap.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                        <td style={{ padding: '0.625rem 0.75rem', color: 'var(--atlas-navy-1)' }}>
                          {formatDate(ap.fecha)}
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '4px',
                            background: `${tipoAportacionColor[ap.tipo]}22`,
                            color: tipoAportacionColor[ap.tipo],
                            fontWeight: 500,
                          }}>
                            {tipoAportacionLabel[ap.tipo] || ap.tipo}
                          </span>
                        </td>
                        <td style={{
                          padding: '0.625rem 0.75rem',
                          color: ap.tipo === 'reembolso' ? 'var(--gray-700)' : 'var(--atlas-navy-1)',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                        }}>
                          {ap.tipo === 'reembolso' ? '-' : '+'}{formatCurrency(ap.importe)}
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-gray)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span>{ap.notas || '-'}</span>
                            {ap.tipo === 'reembolso' && typeof ap.ganancia_perdida === 'number' && (
                              <>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: 'fit-content',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '999px',
                                    background: ap.ganancia_perdida >= 0 ? '#ccfbf122' : '#dc262622',
                                    color: ap.ganancia_perdida >= 0 ? '#0d9488' : '#dc2626',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {ap.ganancia_perdida >= 0 ? 'Plusvalía' : 'Minusvalía'} {ap.ganancia_perdida >= 0 ? '+' : ''}{formatCurrency(ap.ganancia_perdida)}
                                </span>
                                <span style={{ fontSize: '0.75rem' }}>
                                  Coste FIFO: {formatCurrency(ap.coste_adquisicion_fifo ?? 0)}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan={2} style={{
                        padding: '0.625rem 0.75rem',
                        fontWeight: 600,
                        color: 'var(--atlas-navy-1)',
                      }}>
                        Total aportado
                      </td>
                      <td style={{
                        padding: '0.625rem 0.75rem',
                        fontWeight: 700,
                        color: 'var(--atlas-navy-1)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {formatCurrency(posicion.total_aportado)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            justifyContent: 'flex-end',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={onActualizarValor}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                border: '1px solid var(--atlas-blue)',
                borderRadius: '8px',
                background: 'white',
                fontFamily: 'var(--font-inter)',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--atlas-blue)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} />
              Actualizar valor
            </button>
            <button
              onClick={onEditarPosicion}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--surface-card)',
                fontFamily: 'var(--font-inter)',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                cursor: 'pointer',
              }}
            >
              <Edit size={16} />
              Editar posición
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.75rem 1.25rem',
                border: 'none',
                borderRadius: '8px',
                background: 'var(--gray-100)',
                fontFamily: 'var(--font-inter)',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--atlas-navy-1)',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosicionDetailModal;
