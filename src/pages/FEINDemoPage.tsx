// FEIN Demo Page - QA Testing for FEIN functionality
// Simulates FEIN document processing with test data

import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import EnhancedInboxWithFEIN from '../components/inbox/EnhancedInboxWithFEIN';
import { inboxProcessingService } from '../services/inboxProcessingService';
import { InboxItem } from '../types/inboxTypes';
import toast from 'react-hot-toast';

const FEINDemoPage: React.FC = () => {
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  // Load demo FEIN documents
  const loadDemoFEINDocuments = async () => {
    setIsLoadingDemo(true);
    
    try {
      // Create demo FEIN documents with different scenarios
      const demoDocuments = [
        {
          filename: 'FEIN_Banco_Santander_Completa.pdf',
          type: 'application/pdf',
          size: 245000,
          documentType: 'fein' as const,
          subtype: 'fein_completa' as const,
          status: 'classified_ok' as const,
          summary: {
            destino: 'Financiación › Préstamos (auto-creado)',
            supplier_name: 'Banco Santander',
            total_amount: 250000
          },
          ocr: {
            status: 'succeeded' as const,
            timestamp: new Date().toISOString(),
            data: {
              raw_text: 'FICHA EUROPEA DE INFORMACIÓN NORMALIZADA...',
              supplier_name: 'Banco Santander',
              total_amount: 250000,
              metadata: {
                feinData: {
                  bancoEntidad: 'Banco Santander',
                  capitalInicial: 250000,
                  tin: 0.0345,
                  tae: 0.0368,
                  plazoAnos: 25,
                  tipo: 'VARIABLE' as const,
                  indice: 'EURIBOR',
                  diferencial: 0.015,
                  periodicidadRevision: 12,
                  cuentaCargoIban: 'ES9121000418450200051332',
                  bonificaciones: [
                    {
                      tipo: 'NOMINA' as const,
                      descripcion: 'Domiciliación de nómina',
                      descuento: 0.005,
                      condicion: 'Ingresos ≥ 2.500 €'
                    },
                    {
                      tipo: 'SEGURO_HOGAR' as const,
                      descripcion: 'Seguro del hogar',
                      descuento: 0.001,
                      condicion: 'Contratación obligatoria'
                    }
                  ],
                  comisionApertura: 0.001,
                  fechaEmisionFEIN: '2024-01-15'
                },
                processingResult: {
                  success: true,
                  errors: [],
                  warnings: [],
                  confidence: 0.95,
                  fieldsExtracted: ['bancoEntidad', 'capitalInicial', 'tin', 'tae', 'plazoAnos', 'tipo', 'indice', 'diferencial'],
                  fieldsMissing: []
                }
              }
            },
            confidence: { global: 0.95, fields: {} }
          },
          destRef: {
            kind: 'prestamo' as const,
            id: 'loan_demo_001',
            path: 'Financiación › Préstamos'
          },
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72h
          logs: [
            {
              timestamp: new Date().toISOString(),
              code: 'FEIN_PARSE_OK' as const,
              message: 'FEIN processed successfully - Auto-guardado OK (72h)',
              meta: { confidence: 0.95 }
            }
          ]
        },
        {
          filename: 'FEIN_BBVA_Revision.pdf', 
          type: 'application/pdf',
          size: 189000,
          documentType: 'fein' as const,
          subtype: 'fein_revision' as const,
          status: 'needs_review' as const,
          summary: {
            destino: 'Inbox › Revisión FEIN',
            supplier_name: 'BBVA',
            total_amount: 180000
          },
          ocr: {
            status: 'succeeded' as const,
            timestamp: new Date().toISOString(),
            data: {
              raw_text: 'FICHA EUROPEA DE INFORMACIÓN NORMALIZADA...',
              supplier_name: 'BBVA',
              total_amount: 180000,
              metadata: {
                feinData: {
                  bancoEntidad: 'BBVA',
                  capitalInicial: 180000,
                  tin: 0.029,
                  tae: 0.031,
                  // Missing plazo and tipo - triggers review
                  indice: 'EURIBOR',
                  diferencial: 0.012,
                  cuentaCargoIban: 'ES9121000418450200051332',
                  ibanMascarado: true,
                  bonificaciones: [
                    {
                      tipo: 'PLAN_PENSIONES' as const,
                      descripcion: 'Plan de pensiones',
                      descuento: 0.003
                    }
                  ]
                },
                processingResult: {
                  success: true,
                  errors: [],
                  warnings: ['IBAN de cuenta de cargo está parcialmente enmascarado'],
                  confidence: 0.75,
                  fieldsExtracted: ['bancoEntidad', 'capitalInicial', 'tin', 'tae', 'indice', 'diferencial'],
                  fieldsMissing: ['plazo', 'tipo']
                }
              }
            },
            confidence: { global: 0.75, fields: {} }
          },
          validation: {
            isValid: false,
            criticalFieldsMissing: ['plazo', 'tipo'],
            reviewReason: 'Faltan campos críticos para auto-creación'
          },
          logs: [
            {
              timestamp: new Date().toISOString(),
              code: 'FEIN_PARSE_MISSING_FIELDS' as const,
              message: 'FEIN processed but missing critical fields: plazo, tipo',
              meta: { fieldsMissing: ['plazo', 'tipo'] }
            }
          ]
        },
        {
          filename: 'FEIN_CaixaBank_Mixta.pdf',
          type: 'application/pdf', 
          size: 312000,
          documentType: 'fein' as const,
          subtype: 'fein_completa' as const,
          status: 'classified_ok' as const,
          summary: {
            destino: 'Financiación › Préstamos (auto-creado)',
            supplier_name: 'CaixaBank',
            total_amount: 300000
          },
          ocr: {
            status: 'succeeded' as const,
            timestamp: new Date().toISOString(),
            data: {
              raw_text: 'FICHA EUROPEA DE INFORMACIÓN NORMALIZADA...',
              supplier_name: 'CaixaBank',
              total_amount: 300000,
              metadata: {
                feinData: {
                  bancoEntidad: 'CaixaBank',
                  capitalInicial: 300000,
                  tin: 0.025,
                  tae: 0.0275,
                  plazoAnos: 30,
                  tipo: 'MIXTO' as const,
                  tramoFijoAnos: 5,
                  indice: 'EURIBOR',
                  diferencial: 0.009,
                  periodicidadRevision: 6,
                  cuentaCargoIban: 'ES9100491500051234567892',
                  bonificaciones: [
                    {
                      tipo: 'NOMINA' as const,
                      descripcion: 'Domiciliación de nómina',
                      descuento: 0.004,
                      condicion: 'Ingresos ≥ 3.000 €'
                    },
                    {
                      tipo: 'SEGURO_VIDA' as const,
                      descripcion: 'Seguro de vida',
                      descuento: 0.002
                    },
                    {
                      tipo: 'TARJETA' as const,
                      descripcion: 'Tarjeta de crédito',
                      descuento: 0.001,
                      condicion: '≥ 6 usos/mes'
                    }
                  ],
                  comisionApertura: 0.005,
                  comisionAmortizacionParcial: 0.005,
                  fechaEmisionFEIN: '2024-01-20'
                },
                processingResult: {
                  success: true,
                  errors: [],
                  warnings: [],
                  confidence: 0.92,
                  fieldsExtracted: ['bancoEntidad', 'capitalInicial', 'tin', 'tae', 'plazoAnos', 'tipo', 'tramoFijoAnos', 'indice', 'diferencial', 'periodicidadRevision'],
                  fieldsMissing: []
                }
              }
            },
            confidence: { global: 0.92, fields: {} }
          },
          destRef: {
            kind: 'prestamo' as const,
            id: 'loan_demo_003',
            path: 'Financiación › Préstamos'
          },
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          logs: [
            {
              timestamp: new Date().toISOString(),
              code: 'FEIN_PARSE_OK' as const,
              message: 'FEIN processed successfully - Auto-guardado OK (72h)',
              meta: { confidence: 0.92 }
            }
          ]
        }
      ];

      // Add demo documents to inbox processing service
      for (const docData of demoDocuments) {
        const docId = await inboxProcessingService.createAndEnqueue(
          `demo://fein/${docData.filename}`,
          docData.filename,
          docData.type,
          docData.size,
          'upload'
        );

        // Get the created item and update it with demo data
        const item = inboxProcessingService.getItem(docId);
        if (item) {
          // Update with demo data
          Object.assign(item, docData);
          // Keep the generated ID
          item.id = docId;
          item.fileUrl = `demo://fein/${docData.filename}`;
          item.createdAt = new Date();
        }
      }

      toast.success('Documentos FEIN de demostración cargados');
      
    } catch (error) {
      console.error('Error loading demo documents:', error);
      toast.error('Error cargando documentos de demostración');
    } finally {
      setIsLoadingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="font-semibold tracking-[-0.01em] text-[24px] leading-[32px]" 
              style={{ color: 'var(--hz-text)' }}
            >
              FEIN Demo - QA Testing
            </h1>
            <p className="text-neutral-600 text-sm leading-5 font-normal mt-1">
              Pruebas de funcionalidad FEIN con documentos simulados
            </p>
          </div>
          
          <button
            onClick={loadDemoFEINDocuments}
            disabled={isLoadingDemo}
            className="flex items-center gap-2 px-4 py-2 bg-atlas-navy-1 text-white rounded-md hover:bg-atlas-navy-2 transition-colors disabled:opacity-50"
          >
            {isLoadingDemo ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Cargando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Cargar documentos demo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Demo Status Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-gray-900">FEIN Completa</h3>
                <p className="text-sm text-gray-600">Auto-guardado OK (72h)</p>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              Préstamo variable Santander - Todos los campos extraídos correctamente
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div>
                <h3 className="font-semibold text-gray-900">FEIN Revisión</h3>
                <p className="text-sm text-gray-600">Requiere campos adicionales</p>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              BBVA - Faltan plazo y tipo de hipoteca
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">FEIN Mixta</h3>
                <p className="text-sm text-gray-600">Préstamo mixto complejo</p>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              CaixaBank - 5 años fijo + variable con múltiples bonificaciones
            </div>
          </div>
        </div>

        {/* QA Checklist */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--hz-text)' }}>
            QA Checklist - Casos de Prueba
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">✅ Funcionalidades Implementadas</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Detección automática de documentos FEIN</li>
                <li>• Extracción de campos críticos (capital, plazo, tipo)</li>
                <li>• Normalización de números en formato es-ES</li>
                <li>• Extracción de bonificaciones estructuradas</li>
                <li>• Soporte para IBAN enmascarado</li>
                <li>• Estados: Auto-guardado OK (72h) vs Revisión</li>
                <li>• Drawer para revisar/editar campos FEIN</li>
                <li>• Creación automática de borradores en Financiación</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">🧪 Casos de Prueba</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• FEIN completa → Auto-creación de préstamo</li>
                <li>• FEIN incompleta → Revisión manual</li>
                <li>• Préstamo mixto con tramo fijo</li>
                <li>• Múltiples bonificaciones con condiciones</li>
                <li>• Formateo de monedas (123.456,78 €)</li>
                <li>• Formateo de porcentajes (3,45 %)</li>
                <li>• Navegación a Financiación</li>
                <li>• Expiración de documentos (72h)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Inbox */}
      <EnhancedInboxWithFEIN />
    </div>
  );
};

export default FEINDemoPage;