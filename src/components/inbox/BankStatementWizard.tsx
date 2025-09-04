import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Check, AlertCircle, Upload, ArrowRight, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BankStatementWizardProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onComplete: (result: ImportResult) => void;
}

interface ImportResult {
  success: boolean;
  movementsCreated: number;
  errors: string[];
  templateSaved?: boolean;
}

interface ColumnMapping {
  fecha: string;
  concepto: string;
  importe: string;
  signo?: string;
  abono?: string;
  cargo?: string;
  saldo?: string;
  iban?: string;
  cuenta?: string;
}

interface BankTemplate {
  id: string;
  bankName: string;
  filePattern: string[];
  headerRow: number;
  dateFormat: string;
  columnMappings: ColumnMapping;
  decimalSeparator: ',' | '.';
  thousandsSeparator: '.' | ',' | '';
  encoding: 'UTF-8' | 'ISO-8859-1' | 'Windows-1252';
}

interface ParsedData {
  headers: string[];
  rows: any[][];
  detectedBank?: string;
  suggestedMapping?: ColumnMapping;
}

const BankStatementWizard: React.FC<BankStatementWizardProps> = ({
  isOpen,
  onClose,
  file,
  onComplete
}) => {
  const [step, setStep] = useState(1);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<BankTemplate | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    fecha: '',
    concepto: '',
    importe: '',
    signo: '',
    saldo: '',
    iban: '',
    cuenta: ''
  });
  const [selectedAccount, setSelectedAccount] = useState('');
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Predefined bank templates
  const bankTemplates: BankTemplate[] = useMemo(() => [
    {
      id: 'santander',
      bankName: 'Banco Santander',
      filePattern: ['santander', 'bsch'],
      headerRow: 0,
      dateFormat: 'DD/MM/YYYY',
      columnMappings: {
        fecha: 'FECHA',
        concepto: 'CONCEPTO',
        importe: 'IMPORTE',
        saldo: 'SALDO'
      },
      decimalSeparator: ',',
      thousandsSeparator: '.',
      encoding: 'UTF-8'
    },
    {
      id: 'bbva',
      bankName: 'BBVA',
      filePattern: ['bbva'],
      headerRow: 0,
      dateFormat: 'DD/MM/YYYY',
      columnMappings: {
        fecha: 'FECHA',
        concepto: 'DESCRIPCION',
        importe: 'IMPORTE',
        saldo: 'SALDO'
      },
      decimalSeparator: ',',
      thousandsSeparator: '.',
      encoding: 'UTF-8'
    },
    {
      id: 'caixabank',
      bankName: 'CaixaBank',
      filePattern: ['caixa', 'lacaixa'],
      headerRow: 0,
      dateFormat: 'DD/MM/YYYY',
      columnMappings: {
        fecha: 'FECHA OPERACION',
        concepto: 'CONCEPTO',
        importe: 'IMPORTE',
        saldo: 'SALDO'
      },
      decimalSeparator: ',',
      thousandsSeparator: '.',
      encoding: 'UTF-8'
    },
    {
      id: 'bankinter',
      bankName: 'Bankinter',
      filePattern: ['bankinter'],
      headerRow: 0,
      dateFormat: 'DD/MM/YYYY',
      columnMappings: {
        fecha: 'FECHA',
        concepto: 'CONCEPTO',
        importe: '', // Not used, using cargo/abono instead
        cargo: 'CARGO',
        abono: 'ABONO',
        saldo: 'SALDO'
      },
      decimalSeparator: ',',
      thousandsSeparator: '.',
      encoding: 'UTF-8'
    }
  ], []);

  const detectBankFromFilename = useCallback((filename: string): string | undefined => {
    const lowerName = filename.toLowerCase();
    
    for (const template of bankTemplates) {
      if (template.filePattern.some(pattern => lowerName.includes(pattern))) {
        return template.id;
      }
    }
    
    return undefined;
  }, [bankTemplates]);

  // Parse file when component opens
  const parseFile = useCallback(async () => {
    if (!file) return;

    try {
      setError(null);
      
      const arrayBuffer = await file.arrayBuffer();
      let workbook: XLSX.WorkBook;
      
      // Parse based on file type
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        workbook = XLSX.read(text, { type: 'string', raw: true });
      } else {
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

      // Extract headers and rows
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];

      // Detect bank from filename
      const detectedBank = detectBankFromFilename(file.name);
      const suggestedTemplate = bankTemplates.find(t => t.id === detectedBank);
      
      setParsedData({
        headers,
        rows,
        detectedBank,
        suggestedMapping: suggestedTemplate?.columnMappings
      });

      if (suggestedTemplate) {
        setSelectedTemplate(suggestedTemplate);
        setColumnMapping(suggestedTemplate.columnMappings);
        setHeaderRowIndex(suggestedTemplate.headerRow);
      }

      setStep(2);
    } catch (err) {
      setError('Error al procesar el archivo. Verifica que sea un CSV, XLS o XLSX válido.');
    }
  }, [file, detectBankFromFilename, bankTemplates]);

  useEffect(() => {
    if (isOpen && file) {
      parseFile();
    }
  }, [isOpen, file, parseFile]);

  const generatePreview = useCallback(() => {
    if (!parsedData || !columnMapping) return;

    const mappedRows = parsedData.rows.slice(headerRowIndex + 1, headerRowIndex + 11).map((row, index) => {
      const mappedRow: any = { originalIndex: index };
      
      Object.entries(columnMapping).forEach(([field, columnName]) => {
        if (columnName && parsedData.headers) {
          const columnIndex = parsedData.headers.findIndex(h => h === columnName);
          if (columnIndex >= 0) {
            mappedRow[field] = row[columnIndex];
          }
        }
      });

      // Process amount (combine cargo/abono or use importe)
      if (mappedRow.cargo || mappedRow.abono) {
        const cargo = parseFloat(mappedRow.cargo || '0');
        const abono = parseFloat(mappedRow.abono || '0');
        mappedRow.importe = abono - cargo;
      } else if (mappedRow.importe) {
        mappedRow.importe = parseFloat(mappedRow.importe);
      }

      return mappedRow;
    });

    setPreviewData(mappedRows);
  }, [parsedData, columnMapping, headerRowIndex]);

  useEffect(() => {
    if (step === 3) {
      generatePreview();
    }
  }, [step, generatePreview]);

  const handleTemplateSelect = (template: BankTemplate) => {
    setSelectedTemplate(template);
    setColumnMapping(template.columnMappings);
    setHeaderRowIndex(template.headerRow);
  };

  const handleManualMapping = () => {
    setSelectedTemplate(null);
    setColumnMapping({
      fecha: '',
      concepto: '',
      importe: '',
      signo: '',
      saldo: '',
      iban: '',
      cuenta: ''
    });
  };

  const validateMapping = (): boolean => {
    // Required fields
    const required = ['fecha', 'concepto'];
    
    // Need either 'importe' or both 'cargo' and 'abono'
    const hasAmount = !!(columnMapping.importe || (columnMapping.cargo && columnMapping.abono));
    
    const missingRequired = required.filter(field => !columnMapping[field as keyof ColumnMapping]);
    
    return missingRequired.length === 0 && hasAmount;
  };

  const processImport = async () => {
    if (!parsedData || !selectedAccount) return;

    setIsProcessing(true);
    try {
      // Simulate processing - in real implementation this would call the backend
      await new Promise(resolve => setTimeout(resolve, 2000));

      const totalRows = parsedData.rows.length - headerRowIndex - 1;
      const validRows = Math.floor(totalRows * 0.9); // Simulate some validation failures

      // Save template if custom mapping was used
      let templateSaved = false;
      if (!selectedTemplate && parsedData.detectedBank) {
        // Save new template
        const newTemplate: BankTemplate = {
          id: `custom_${Date.now()}`,
          bankName: parsedData.detectedBank,
          filePattern: [parsedData.detectedBank.toLowerCase()],
          headerRow: headerRowIndex,
          dateFormat: 'DD/MM/YYYY',
          columnMappings: columnMapping,
          decimalSeparator: ',',
          thousandsSeparator: '.',
          encoding: 'UTF-8'
        };
        
        // Store in localStorage for future use
        const existingTemplates = JSON.parse(localStorage.getItem('bankTemplates') || '[]');
        existingTemplates.push(newTemplate);
        localStorage.setItem('bankTemplates', JSON.stringify(existingTemplates));
        templateSaved = true;
      }

      const result: ImportResult = {
        success: true,
        movementsCreated: validRows,
        errors: totalRows > validRows ? [`${totalRows - validRows} filas con errores de formato`] : [],
        templateSaved
      };

      onComplete(result);
    } catch (err) {
      const result: ImportResult = {
        success: false,
        movementsCreated: 0,
        errors: ['Error al procesar el archivo']
      };
      onComplete(result);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Wizard de Extractos Bancarios
            </h2>
            <p className="text-sm text-neutral-600">
              Paso {step} de 4: {
                step === 1 ? 'Cargando archivo' :
                step === 2 ? 'Detección de banco/plantilla' :
                step === 3 ? 'Mapeo de columnas' :
                'Importar movimientos'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {/* Step 1: File Loading */}
          {step === 1 && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-neutral-600">Procesando archivo...</p>
            </div>
          )}

          {/* Step 2: Bank Detection */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Archivo detectado</h3>
                <p className="text-sm text-blue-700">
                  {file?.name} ({parsedData?.headers.length} columnas, {parsedData?.rows.length} filas)
                </p>
                {parsedData?.detectedBank && (
                  <p className="text-sm text-blue-700 mt-1">
                    Banco detectado: <strong>{parsedData.detectedBank}</strong>
                  </p>
                )}
              </div>

              <div>
                <h3 className="font-medium text-neutral-900 mb-4">Seleccionar plantilla de banco</h3>
                
                {selectedTemplate && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">Plantilla encontrada: {selectedTemplate.bankName}</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1">
                      Se aplicará el mapeo automático basado en extractos anteriores
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bankTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="font-medium text-neutral-900">{template.bankName}</div>
                      <div className="text-sm text-neutral-600 mt-1">
                        Formato: {template.dateFormat} · Separador: {template.decimalSeparator}
                      </div>
                    </button>
                  ))}
                  
                  <button
                    onClick={handleManualMapping}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      !selectedTemplate
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-medium text-neutral-900">Mapeo manual</div>
                    <div className="text-sm text-neutral-600 mt-1">
                      Configurar columnas manualmente
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Column Mapping */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-neutral-900 mb-4">Mapeo de columnas</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Fecha <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={columnMapping.fecha}
                      onChange={(e) => setColumnMapping({...columnMapping, fecha: e.target.value})}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Seleccionar columna...</option>
                      {parsedData?.headers.map((header, idx) => (
                        <option key={idx} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Concepto <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={columnMapping.concepto}
                      onChange={(e) => setColumnMapping({...columnMapping, concepto: e.target.value})}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Seleccionar columna...</option>
                      {parsedData?.headers.map((header, idx) => (
                        <option key={idx} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Importe
                    </label>
                    <select
                      value={columnMapping.importe}
                      onChange={(e) => setColumnMapping({...columnMapping, importe: e.target.value})}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Seleccionar columna...</option>
                      {parsedData?.headers.map((header, idx) => (
                        <option key={idx} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Abono
                    </label>
                    <select
                      value={columnMapping.abono}
                      onChange={(e) => setColumnMapping({...columnMapping, abono: e.target.value})}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Seleccionar columna...</option>
                      {parsedData?.headers.map((header, idx) => (
                        <option key={idx} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Cargo
                    </label>
                    <select
                      value={columnMapping.cargo}
                      onChange={(e) => setColumnMapping({...columnMapping, cargo: e.target.value})}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Seleccionar columna...</option>
                      {parsedData?.headers.map((header, idx) => (
                        <option key={idx} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Saldo (opcional)
                    </label>
                    <select
                      value={columnMapping.saldo}
                      onChange={(e) => setColumnMapping({...columnMapping, saldo: e.target.value})}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Seleccionar columna...</option>
                      {parsedData?.headers.map((header, idx) => (
                        <option key={idx} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!validateMapping() && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Mapeo incompleto</span>
                    </div>
                    <p className="text-sm text-yellow-700 mt-1">
                      Se requieren al menos: Fecha, Concepto y (Importe O Abono+Cargo)
                    </p>
                  </div>
                )}
              </div>

              {/* Preview */}
              {previewData.length > 0 && (
                <div>
                  <h4 className="font-medium text-neutral-900 mb-3">Vista previa (10 primeras filas)</h4>
                  <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Concepto</th>
                          <th className="px-3 py-2 text-right">Importe</th>
                          <th className="px-3 py-2 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {previewData.map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{row.fecha}</td>
                            <td className="px-3 py-2">{row.concepto}</td>
                            <td className="px-3 py-2 text-right">
                              {row.importe ? 
                                parseFloat(row.importe).toLocaleString('es-ES', { 
                                  style: 'currency', 
                                  currency: 'EUR' 
                                }) : 
                                '-'
                              }
                            </td>
                            <td className="px-3 py-2 text-right">
                              {row.saldo ? 
                                parseFloat(row.saldo).toLocaleString('es-ES', { 
                                  style: 'currency', 
                                  currency: 'EUR' 
                                }) : 
                                '-'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Account Selection and Import */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-neutral-900 mb-4">Seleccionar cuenta de destino</h3>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Seleccionar cuenta...</option>
                  <option value="santander-corriente">Santander - Cuenta Corriente (**1234)</option>
                  <option value="bbva-empresas">BBVA - Cuenta Empresas (**5678)</option>
                  <option value="caixabank-ahorro">CaixaBank - Cuenta Ahorro (**9012)</option>
                </select>
              </div>

              <div className="bg-neutral-50 p-4 rounded-lg">
                <h4 className="font-medium text-neutral-900 mb-2">Resumen de importación</h4>
                <div className="space-y-1 text-sm text-neutral-600">
                  <div>Archivo: {file?.name}</div>
                  <div>Filas a procesar: {parsedData?.rows.length || 0}</div>
                  <div>Destino: Tesorería → Movimientos</div>
                  {selectedTemplate && (
                    <div>Plantilla: {selectedTemplate.bankName}</div>
                  )}
                </div>
              </div>

              {!selectedAccount && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Cuenta requerida</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    Selecciona una cuenta para poder importar los movimientos
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-200">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:text-neutral-800"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-neutral-600 hover:text-neutral-800"
            >
              Cancelar
            </button>
            
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 2 && !selectedTemplate && !parsedData?.detectedBank) ||
                  (step === 3 && !validateMapping())
                }
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={processImport}
                disabled={!selectedAccount || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar movimientos
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankStatementWizard;