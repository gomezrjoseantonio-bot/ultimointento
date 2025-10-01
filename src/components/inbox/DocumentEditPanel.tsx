// UNICORNIO PROMPT 3 - Document Edit Panel (Right Drawer)
// Implements exact UI requirements for inline editing with Atlas Horizon colors

import React, { useState, useEffect } from 'react';
import {
  X, FileText, Image, AlertTriangle, RotateCcw, Trash2,
  ZoomIn, ZoomOut
} from 'lucide-react';
import { initDB, Property } from '../../services/db';

interface DocumentEditPanelProps {
  document: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Record<string, any>) => void;
  onReprocess: () => void;
  onDelete: () => void;
}

// Atlas Horizon color scheme (ATLAS palette exact colors)
const colors = {
  primary: 'var(--atlas-blue)',    // Exact ATLAS primary
  accent: '#0B5FFF',     // Acento
  success: 'var(--ok)',    // Exact ATLAS success (status badge green)
  warning: 'var(--warn)',    // Exact ATLAS warning (status badge yellow)
  error: 'var(--error)',      // Exact ATLAS error (status badge red)
  gray50: 'var(--hz-neutral-100)',
  gray100: 'var(--hz-neutral-100)',
  gray200: 'var(--hz-neutral-300)',
  gray300: 'var(--hz-neutral-300)',
  gray400: 'var(--text-gray)',
  gray500: 'var(--text-gray)',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827'
};

const DocumentEditPanel: React.FC<DocumentEditPanelProps> = ({
  document,
  isOpen,
  onClose,
  onSave,
  onReprocess,
  onDelete
}) => {
  const [editableFields, setEditableFields] = useState<Record<string, any>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);

  // Load properties on component mount
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const db = await initDB();
        const allProperties = await db.getAll('properties');
        // Filter only active properties (not sold or inactive)
        const activeProperties = allProperties.filter(p => p.state === 'activo');
        setProperties(activeProperties);
      } catch (error) {
        console.error('Error loading properties:', error);
        setProperties([]);
      } finally {
        setPropertiesLoading(false);
      }
    };

    loadProperties();
  }, []);

  // Initialize editable fields from document
  useEffect(() => {
    if (document) {
      setEditableFields({
        // Classification & destination
        destino: document.inmueblePersonal || '',
        tipo_documento: document.tipo || '',
        
        // Provider data (invoices)
        proveedor_nombre: document.extractedFields?.proveedor_nombre || '',
        proveedor_nif: document.extractedFields?.proveedor_nif || '',
        proveedor_email: document.extractedFields?.proveedor_email || '',
        proveedor_direccion: document.extractedFields?.proveedor_direccion || '',
        
        // Invoice data
        fecha_emision: document.extractedFields?.fecha_emision || '',
        fecha_cargo: document.extractedFields?.fecha_cargo || '',
        importe_total: document.extractedFields?.total_amount || document.importe || '',
        moneda: document.extractedFields?.currency || 'EUR',
        
        // Utilities specific
        tipo_suministro: document.extractedFields?.tipo_suministro || '',
        cups: document.extractedFields?.cups || '',
        direccion_servicio: document.extractedFields?.direccion_servicio || '',
        iban_masked: document.extractedFields?.iban_masked || document.ibanDetectado || '',
        
        // Reform breakdown
        mejora: document.extractedFields?.desglose_categorias?.mejora || 0,
        mobiliario: document.extractedFields?.desglose_categorias?.mobiliario || 0,
        reparacion_conservacion: document.extractedFields?.desglose_categorias?.reparacion_conservacion || 0,
        
        // Bank statements
        cuenta_id: document.extractedFields?.cuenta_id || ''
      });
    }
  }, [document]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Guardado': { color: colors.success, label: '✅ Guardado', bgColor: 'var(--ok)' },
      'Revisión': { color: colors.warning, label: '⚠ Revisión', bgColor: 'var(--warn)' },
      'Error': { color: colors.error, label: '⛔ Error', bgColor: 'var(--error)' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.Error;
    
    return (
      <span 
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
        style={{ backgroundColor: config.bgColor }}
      >
        {config.label}
      </span>
    );
  };

  const getRequiredFields = (documentType: string): string[] => {
    switch (documentType) {
      case 'Factura':
        if (editableFields.tipo_suministro) {
          return ['destino', 'tipo_suministro', 'importe_total', 'fecha_emision'];
        } else {
          return ['destino', 'importe_total', 'fecha_emision', 'mejora', 'mobiliario', 'reparacion_conservacion'];
        }
      case 'Extracto':
        return ['cuenta_id'];
      case 'Contrato':
        return ['destino'];
      default:
        return ['destino'];
    }
  };

  const validateFields = (): boolean => {
    const required = getRequiredFields(document.tipo);
    const errors: string[] = [];
    
    for (const field of required) {
      if (!editableFields[field] || (typeof editableFields[field] === 'number' && editableFields[field] <= 0)) {
        errors.push(getFieldLabel(field));
      }
    }
    
    // Special validation for reform breakdown
    if (document.tipo === 'Factura' && !editableFields.tipo_suministro) {
      const total = (editableFields.mejora || 0) + (editableFields.mobiliario || 0) + (editableFields.reparacion_conservacion || 0);
      const expectedTotal = parseFloat(editableFields.importe_total) || 0;
      
      if (Math.abs(total - expectedTotal) > 0.01) {
        errors.push('La suma de categorías debe igualar el importe total');
      }
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      destino: 'Destino',
      proveedor_nombre: 'Proveedor nombre',
      importe_total: 'Importe total',
      fecha_emision: 'Fecha emisión',
      tipo_suministro: 'Tipo suministro',
      cuenta_id: 'Cuenta',
      mejora: 'Mejora',
      mobiliario: 'Mobiliario',
      reparacion_conservacion: 'Reparación y conservación'
    };
    return labels[field] || field;
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditableFields(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    if (validateFields()) {
      onSave(editableFields);
    }
  };

  const getDestinationPath = (): string => {
    if (!editableFields.destino) return '';
    
    switch (document.tipo) {
      case 'Factura':
        if (editableFields.destino.includes('Inmueble')) {
          return `Inmuebles › ${editableFields.destino} › Gastos`;
        }
        return 'Personal › Gastos';
      case 'Extracto':
        return 'Tesorería › Movimientos';
      case 'Contrato':
        return `Inmuebles › ${editableFields.destino} › Contratos`;
      default:
        return editableFields.destino;
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-2/3 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200" style={{ backgroundColor: colors.gray50 }}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-medium text-gray-900 truncate">
              {document.filename}
            </h2>
            <div className="mt-1 flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                {(document.size / 1024).toFixed(1)} KB • {document.type}
              </span>
              {getStatusBadge(document.status)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 h-6 w-6 flex items-center justify-center"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Preview Section */}
        {showPreview && (
          <div className="flex-1 border-r border-gray-200">
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Vista previa</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPreviewZoom(Math.max(50, previewZoom - 25))}
                      className="p-1 text-gray-400 hover:text-gray-500"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-gray-500">{previewZoom}%</span>
                    <button
                      onClick={() => setPreviewZoom(Math.min(200, previewZoom + 25))}
                      className="p-1 text-gray-400 hover:text-gray-500"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="p-1 text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
                {document.type?.includes('pdf') ? (
                  <div className="bg-white border border-gray-300 shadow-sm" style={{ transform: `scale(${previewZoom / 100})` }}>
                    <div className="w-96 h-96 flex items-center justify-center text-gray-400">
                      <FileText className="h-20 w-20" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-300 shadow-sm" style={{ transform: `scale(${previewZoom / 100})` }}>
                    <div className="w-96 h-96 flex items-center justify-center text-gray-400">
                      <Image className="h-20 w-20" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Form Section */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            
            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="p-4 border border-error-200 rounded-lg bg-error-50">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="h-5 w-5 text-error-600 mr-2" />
                  <span className="font-medium text-error-800">Campos requeridos</span>
                </div>
                <ul className="text-sm text-error-700 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Classification & Destination */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Clasificación & Destino
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destino *
                </label>
                <select
                  value={editableFields.destino}
                  onChange={(e) => handleFieldChange('destino', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar destino...</option>
                  {propertiesLoading ? (
                    <option disabled>Cargando propiedades...</option>
                  ) : (
                    <>
                      {properties.map(property => (
                        <option key={property.id} value={`Inmueble: ${property.alias}`}>
                          Inmueble: {property.alias} - {property.address}
                        </option>
                      ))}
                      <option value="Personal">Personal</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de documento
                </label>
                <input
                  type="text"
                  value={editableFields.tipo_documento}
                  onChange={(e) => handleFieldChange('tipo_documento', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ruta final
                </label>
                <input
                  type="text"
                  value={getDestinationPath()}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600"
                  readOnly
                />
              </div>
            </div>

            {/* Provider Data (for invoices) */}
            {document.tipo === 'Factura' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  Datos de Proveedor
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proveedor nombre *
                  </label>
                  <input
                    type="text"
                    value={editableFields.proveedor_nombre}
                    onChange={(e) => handleFieldChange('proveedor_nombre', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIF/CIF
                  </label>
                  <input
                    type="text"
                    value={editableFields.proveedor_nif}
                    onChange={(e) => handleFieldChange('proveedor_nif', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}

            {/* Invoice Data */}
            {document.tipo === 'Factura' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  Datos de Factura
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha emisión *
                    </label>
                    <input
                      type="date"
                      value={editableFields.fecha_emision}
                      onChange={(e) => handleFieldChange('fecha_emision', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha cargo
                    </label>
                    <input
                      type="date"
                      value={editableFields.fecha_cargo}
                      onChange={(e) => handleFieldChange('fecha_cargo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Importe total (€) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editableFields.importe_total}
                      onChange={(e) => handleFieldChange('importe_total', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Moneda
                    </label>
                    <select
                      value={editableFields.moneda}
                      onChange={(e) => handleFieldChange('moneda', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Utilities specific fields */}
            {document.tipo === 'Factura' && editableFields.tipo_suministro && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  Suministros
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de suministro
                  </label>
                  <select
                    value={editableFields.tipo_suministro}
                    onChange={(e) => handleFieldChange('tipo_suministro', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="electricidad">Luz</option>
                    <option value="agua">Agua</option>
                    <option value="gas">Gas</option>
                    <option value="internet">Internet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CUPS / Punto de suministro
                  </label>
                  <input
                    type="text"
                    value={editableFields.cups}
                    onChange={(e) => handleFieldChange('cups', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IBAN del cargo
                  </label>
                  <input
                    type="text"
                    value={editableFields.iban_masked}
                    onChange={(e) => handleFieldChange('iban_masked', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="ES12 **** **** 1234"
                  />
                </div>
              </div>
            )}

            {/* Reform breakdown */}
            {document.tipo === 'Factura' && !editableFields.tipo_suministro && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  Reformas / Compras (obra)
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mejora (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editableFields.mejora}
                      onChange={(e) => handleFieldChange('mejora', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobiliario (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editableFields.mobiliario}
                      onChange={(e) => handleFieldChange('mobiliario', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reparación y conservación (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editableFields.reparacion_conservacion}
                      onChange={(e) => handleFieldChange('reparacion_conservacion', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="text-sm text-gray-600 mt-2">
                    Suma: €{((editableFields.mejora || 0) + (editableFields.mobiliario || 0) + (editableFields.reparacion_conservacion || 0)).toFixed(2)} 
                    {editableFields.importe_total && ` / Total: €${parseFloat(editableFields.importe_total).toFixed(2)}`}
                  </div>
                </div>
              </div>
            )}

            {/* Bank statements */}
            {document.tipo === 'Extracto' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  Extractos
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuenta *
                  </label>
                  <select
                    value={editableFields.cuenta_id}
                    onChange={(e) => handleFieldChange('cuenta_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    <option value="1">BBVA - ES12 **** 1234</option>
                    <option value="2">Santander - ES34 **** 5678</option>
                    <option value="new">+ Crear cuenta</option>
                  </select>
                </div>

                {document.extractedFields?.movimientos && (
                  <div className="text-sm text-gray-600">
                    {document.extractedFields.movimientos.length} movimientos parseados
                    {document.extractedFields.rango_fechas && (
                      <> • {document.extractedFields.rango_fechas.desde} a {document.extractedFields.rango_fechas.hasta}</>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Logs */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Logs
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                {document.logs?.map((log: any, index: number) => (
                  <div key={index} className="text-xs text-gray-600 mb-1">
                    <span className="text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="ml-2">{log.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with actions */}
      <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex space-x-3">
            <button
              onClick={onReprocess}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reprocesar OCR
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center px-4 py-2 border border-error-300 rounded-md text-sm font-medium text-error-700 bg-white hover:bg-error-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </button>
          </div>
          
          <button
            onClick={handleSave}
            disabled={validationErrors.length > 0}
            className="inline-flex items-center px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ 
              backgroundColor: validationErrors.length > 0 ? 'var(--text-gray)' : colors.primary
            }}
          >
            Guardar y archivar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditPanel;