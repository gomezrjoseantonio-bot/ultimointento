// FEIN Extraction Review Drawer for Financiacion module
// Shows extracted FEIN data in read-only format with structured display

import React from 'react';
import { X, FileText, Building, CreditCard, Percent, Award, Euro, Calendar } from 'lucide-react';
import { FEINCanonicalData } from '../../types/fein';

interface FEINExtractionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  feinData: FEINCanonicalData | null;
}

const FEINExtractionDrawer: React.FC<FEINExtractionDrawerProps> = ({
  isOpen,
  onClose,
  feinData
}) => {
  if (!isOpen || !feinData) return null;

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* ATLAS light backdrop-blur-sm overlays */}
      <button className="absolute inset-0" style={{ backgroundColor: 'rgba(248, 249, 250, 0.9)' }}  / onClick={onClose}>
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl border-l border-gray-200">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--hz-neutral-300)' }}>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6" style={{ color: 'var(--atlas-blue)' }} />
              <div>
                <h2 className="atlas-h2">
                  Extracción FEIN
                </h2>
                <p className="atlas-caption">
                  Datos extraídos del documento {feinData.docMeta.sourceFile}
                </p>
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2"
            >
              <X className="h-5 w-5" style={{ color: 'var(--text-gray)' }} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Document Metadata */}
            <div className="atlas-card">
              <h3 className="atlas-body font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: 'var(--atlas-blue)' }} />
                Información del Documento
              </h3>
              <div className="grid grid-cols-2 gap-4 atlas-caption">
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Archivo:</span>
                  <p className="atlas-body">{feinData.docMeta.sourceFile}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Páginas:</span>
                  <p className="atlas-body tabular-nums">{feinData.docMeta.pages}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Procesado:</span>
                  <p className="atlas-body">{formatDate(feinData.docMeta.parsedAt)}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Versión Parser:</span>
                  <p className="atlas-body">{feinData.docMeta.parserVersion}</p>
                </div>
              </div>
            </div>

            {/* Basic Loan Info */}
            <div className="atlas-card">
              <h3 className="atlas-body font-medium mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" style={{ color: 'var(--atlas-blue)' }} />
                Información Básica del Préstamo
              </h3>
              <div className="grid grid-cols-2 gap-4 atlas-caption">
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Alias:</span>
                  <p className="atlas-body">{feinData.prestamo.alias}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Tipo:</span>
                  <p className="atlas-body font-medium" style={{ color: 'var(--atlas-blue)' }}>{feinData.prestamo.tipo}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Capital:</span>
                  <p className="atlas-kpi" style={{ color: 'var(--ok)' }}>{formatCurrency(feinData.prestamo.capitalInicial)}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Plazo:</span>
                  <p className="atlas-body tabular-nums">{feinData.prestamo.plazoMeses} meses ({Math.round(feinData.prestamo.plazoMeses / 12)} años)</p>
                </div>
              </div>
            </div>

            {/* Bank Account */}
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--atlas-navy-1)' }}>
                <Building className="h-4 w-4" />
                Cuenta de Cargo
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Banco:</span>
                  <p>{feinData.prestamo.cuentaCargo.banco || 'No identificado'}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>IBAN:</span>
                  <p className="font-mono">{feinData.prestamo.cuentaCargo.iban || 'No identificado'}</p>
                </div>
              </div>
            </div>

            {/* Interest Conditions */}
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--atlas-navy-1)' }}>
                <Percent className="h-4 w-4" />
                Condiciones de Interés
              </h3>
              
              {/* Fixed */}
              {feinData.prestamo.fijo && (
                <div className="atlas-atlas-atlas-atlas-btn-primary mb-3 p-3 rounded">
                  <h4 className="font-medium text-blue-800">Tramo Fijo</h4>
                  <p>TIN: {formatPercentage(feinData.prestamo.fijo.tinFijoPrc)}</p>
                </div>
              )}
              
              {/* Variable */}
              {feinData.prestamo.variable && (
                <div className="atlas-atlas-atlas-atlas-btn-primary mb-3 p-3 rounded">
                  <h4 className="font-medium text-green-800">Tramo Variable</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Índice: {feinData.prestamo.variable.indice}</div>
                    <div>Valor actual: {formatPercentage(feinData.prestamo.variable.valorIndiceActualPrc)}</div>
                    <div>Diferencial: {formatPercentage(feinData.prestamo.variable.diferencialPrc)}</div>
                    <div>Revisión: {feinData.prestamo.variable.revisionMeses} meses</div>
                  </div>
                </div>
              )}
              
              {/* Mixed */}
              {feinData.prestamo.mixto && (
                <div className="space-y-3">
                  <div className="atlas-atlas-atlas-atlas-btn-primary p-3 rounded">
                    <h4 className="font-medium text-blue-800">Período Fijo Initial</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Duración: {feinData.prestamo.mixto.tramoFijoAnios} años</div>
                      <div>TIN: {formatPercentage(feinData.prestamo.mixto.tinFijoTramoPrc)}</div>
                    </div>
                  </div>
                  <div className="atlas-atlas-atlas-atlas-btn-primary p-3 rounded">
                    <h4 className="font-medium text-green-800">Posterior Variable</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Índice: {feinData.prestamo.mixto.posteriorVariable.indice}</div>
                      <div>Diferencial: {formatPercentage(feinData.prestamo.mixto.posteriorVariable.diferencialPrc)}</div>
                      <div>Revisión: {feinData.prestamo.mixto.posteriorVariable.revisionMeses} meses</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Commissions */}
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--atlas-navy-1)' }}>
                <Euro className="h-4 w-4" />
                Comisiones
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Apertura:</span>
                  <p>{formatPercentage(feinData.prestamo.comisiones.aperturaPrc)}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Mantenimiento:</span>
                  <p>{formatCurrency(feinData.prestamo.comisiones.mantenimientoMes)}/mes</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Amort. Anticipada:</span>
                  <p>{formatPercentage(feinData.prestamo.comisiones.amortizacionAnticipadaPrc)}</p>
                </div>
              </div>
            </div>

            {/* Bonifications */}
            {feinData.prestamo.bonificaciones.length > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--atlas-navy-1)' }}>
                  <Award className="h-4 w-4" />
                  Bonificaciones Detectadas
                </h3>
                <div className="space-y-2">
                  {feinData.prestamo.bonificaciones.map((bonif, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                      <span className="text-sm">{bonif.tipo.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-600">{bonif.pp.toFixed(2)} p.p.</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          bonif.estado === 'CUMPLE' ? 'bg-green-100 text-green-800' :
                          bonif.estado === 'NO_CUMPLE' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {bonif.estado}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estimated Values */}
            {(feinData.prestamo.complementos.taeAproxPrc || feinData.prestamo.complementos.cuotaEstim) && (
              <div className="rounded-lg border p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--atlas-navy-1)' }}>
                  <Calendar className="h-4 w-4" />
                  Estimaciones
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {feinData.prestamo.complementos.taeAproxPrc && (
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-gray)' }}>TAE Aproximada:</span>
                      <p className="font-medium text-blue-600">{formatPercentage(feinData.prestamo.complementos.taeAproxPrc)}</p>
                    </div>
                  )}
                  {feinData.prestamo.complementos.cuotaEstim && (
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-gray)' }}>Cuota Estimada:</span>
                      <p className="font-medium text-green-600">{formatCurrency(feinData.prestamo.complementos.cuotaEstim)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-4 flex justify-end bg-white" style={{ borderColor: 'var(--hz-neutral-300)' }}>
            <button
              onClick={onClose}
              className="atlas-atlas-atlas-atlas-btn-secondary"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FEINExtractionDrawer;