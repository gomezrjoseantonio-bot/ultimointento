(no base changes needed)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Check, AlertCircle, Upload, ArrowRight, ArrowLeft } from 'lucide-react';

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
    fecha: '', concepto: '', importe: '', signo: '', saldo: '', iban: '', cuenta: ''
  });
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bankTemplates: BankTemplate[] = useMemo(() => [
    { id: 'santander', bankName: 'Banco Santander', filePattern: ['santander', 'bsch'], headerRow: 0, dateFormat: 'DD/MM/YYYY', columnMappings: { fecha: 'FECHA', concepto: 'CONCEPTO', importe: 'IMPORTE', saldo: 'SALDO' }, decimalSeparator: ',', thousandsSeparator: '.', encoding: 'UTF-8' },
    { id: 'bbva', bankName: 'BBVA', filePattern: ['bbva'], headerRow: 0, dateFormat: 'DD/MM/YYYY', columnMappings: { fecha: 'FECHA', concepto: 'DESCRIPCION', importe: 'IMPORTE', saldo: 'SALDO' }, decimalSeparator: ',', thousandsSeparator: '.', encoding: 'UTF-8' },
    { id: 'caixabank', bankName: 'CaixaBank', filePattern: ['caixa', 'lacaixa'], headerRow: 0, dateFormat: 'DD/MM/YYYY', columnMappings: { fecha: 'FECHA OPERACION', concepto: 'CONCEPTO', importe: 'IMPORTE', saldo: 'SALDO' }, decimalSeparator: ',', thousandsSeparator: '.', encoding: 'UTF-8' },
    { id: 'bankinter', bankName: 'Bankinter', filePattern: ['bankinter'], headerRow: 0, dateFormat: 'DD/MM/YYYY', columnMappings: { fecha: 'FECHA', concepto: 'CONCEPTO', importe: '', cargo: 'CARGO', abono: 'ABONO', saldo: 'SALDO' }, decimalSeparator: ',', thousandsSeparator: '.', encoding: 'UTF-8' },
  ], []);

  const detectBankFromFilename = useCallback((filename: string): string | undefined => {
    const lowerName = filename.toLowerCase();
    for (const template of bankTemplates) {
      if (template.filePattern.some(pattern => lowerName.includes(pattern))) return template.id;
    }
    return undefined;
  }, [bankTemplates]);

  const parseFile = useCallback(async () => {
    if (!file) return;
    try {
      setError(null);
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      let workbook: any;
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        workbook = XLSX.read(text, { type: 'string', raw: true });
      } else {
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];
      const detectedBank = detectBankFromFilename(file.name);
      const suggestedTemplate = bankTemplates.find(t => t.id === detectedBank);
      setParsedData({ headers, rows, detectedBank, suggestedMapping: suggestedTemplate?.columnMappings });
      if (suggestedTemplate) { setSelectedTemplate(suggestedTemplate); setColumnMapping(suggestedTemplate.columnMappings); setHeaderRowIndex(suggestedTemplate.headerRow); }
      setStep(2);
    } catch (err) {
      setError('Error al procesar el archivo. Verifica que sea un CSV, XLS o XLSX válido.');
    }
  }, [file, detectBankFromFilename, bankTemplates]);

  useEffect(() => { if (isOpen && file) { parseFile(); loadAccounts(); } }, [isOpen, file, parseFile]);

  const loadAccounts = async () => {
    try {
      const { initDB } = await import('../../services/db');
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      setAccounts(allAccounts);
    } catch (error) { console.error('Error loading accounts:', error); }
  };

  const generatePreview = useCallback(() => {
    if (!parsedData || !columnMapping) return;
    const mappedRows = parsedData.rows.slice(headerRowIndex + 1, headerRowIndex + 11).map((row, index) => {
      const mappedRow: any = { originalIndex: index };
      Object.entries(columnMapping).forEach(([field, columnName]) => {
        if (columnName && parsedData.headers) {
          const columnIndex = parsedData.headers.findIndex(h => h === columnName);
          if (columnIndex >= 0) mappedRow[field] = row[columnIndex];
        }
      });
      if (mappedRow.cargo || mappedRow.abono) {
        mappedRow.importe = parseFloat(mappedRow.abono || '0') - parseFloat(mappedRow.cargo || '0');
      } else if (mappedRow.importe) {
        mappedRow.importe = parseFloat(mappedRow.importe);
      }
      return mappedRow;
    });
    setPreviewData(mappedRows);
  }, [parsedData, columnMapping, headerRowIndex]);

  useEffect(() => { if (step === 3) generatePreview(); }, [step, generatePreview]);

  const handleTemplateSelect = (template: BankTemplate) => { setSelectedTemplate(template); setColumnMapping(template.columnMappings); setHeaderRowIndex(template.headerRow); };
  const handleManualMapping = () => { setSelectedTemplate(null); setColumnMapping({ fecha: '', concepto: '', importe: '', signo: '', saldo: '', iban: '', cuenta: '' }); };

  const validateMapping = (): boolean => {
    const required = ['fecha', 'concepto'];
    const hasAmount = !!(columnMapping.importe || (columnMapping.cargo && columnMapping.abono));
    return required.every(f => !!columnMapping[f as keyof ColumnMapping]) && hasAmount;
  };

  const processImport = async () => {
    if (!parsedData || !selectedAccount) return;
    const account = accounts.find(acc => acc.id?.toString() === selectedAccount);
    if (account?.status === 'INACTIVE') { setError('No se puede importar en una cuenta inactiva. Activa la cuenta primero.'); return; }
    setIsProcessing(true);
    try {
      const { initDB } = await import('../../services/db');
      const db = await initDB();
      const dataRows = parsedData.rows.slice(headerRowIndex + 1);
      const movements = [];
      for (const row of dataRows) {
        try {
          const fecha = row[parsedData.headers.indexOf(columnMapping.fecha)];
          const concepto = row[parsedData.headers.indexOf(columnMapping.concepto)];
          let importe = 0;
          if (columnMapping.importe) {
            importe = parseFloat(row[parsedData.headers.indexOf(columnMapping.importe)]?.toString().replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
          } else if (columnMapping.cargo && columnMapping.abono) {
            const cargo = parseFloat(row[parsedData.headers.indexOf(columnMapping.cargo)]?.toString().replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            const abono = parseFloat(row[parsedData.headers.indexOf(columnMapping.abono)]?.toString().replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            importe = abono - cargo;
          }
          let saldo = 0;
          if (columnMapping.saldo) saldo = parseFloat(row[parsedData.headers.indexOf(columnMapping.saldo)]?.toString().replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
          if (!fecha || !concepto || importe === 0) continue;
          const [day, month, year] = fecha.split('/');
          const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          movements.push({ accountId: parseInt(selectedAccount), date: isoDate, amount: importe, description: concepto, type: (importe > 0 ? 'Ingreso' : 'Gasto') as 'Ingreso' | 'Gasto', origin: 'Extracto' as 'Extracto', movementState: 'Confirmado' as 'Confirmado', balance: saldo, importBatch: `inbox_${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'pendiente' as 'pendiente' });
        } catch (e) { console.warn('Error parsing row:', row, e); }
      }
      for (const movement of movements) await db.add('movements', movement);
      onComplete({ success: true, movementsCreated: movements.length, errors: dataRows.length > movements.length ? [`${dataRows.length - movements.length} filas omitidas`] : [] });
    } catch (err) {
      onComplete({ success: false, movementsCreated: 0, errors: ['Error al procesar el archivo'] });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const selectStyle = { width: '100%', border: '1.5px solid var(--n-300)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontFamily: 'var(--font-base)', fontSize: 'var(--t-sm)', color: 'var(--n-900)', background: 'var(--white)' };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: \'rgba(26,35,50,.45)\' }} style={{ background: 'rgba(26,35,50,.45)' }}>
      <div className="bg-white shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" style={{ borderRadius: 'var(--r-lg)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--n-200)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Wizard de Extractos Bancarios</h2>
            <p className="text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>
              Paso {step} de 4: {{ 1: 'Cargando archivo', 2: 'Detección de banco/plantilla', 3: 'Mapeo de columnas', 4: 'Importar movimientos' }[step]}
            </p>
          </div>
          <button onClick={onClose} className="p-2" style={{ color: 'var(--n-500)' }}><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-4 border" style={{ background: 'var(--s-neg-bg)', borderColor: 'var(--s-neg)', borderRadius: 'var(--r-md)' }}>
              <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--s-neg)' }}>
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Error</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--s-neg)' }}>{error}</p>
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div className="text-center py-8">
              <div className="animate-spin h-10 w-10 border-2 border-t-transparent mx-auto mb-3" style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
              <p className="text-sm" style={{ color: 'var(--n-500)' }}>Procesando archivo...</p>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="p-4 border" style={{ background: 'var(--n-50)', borderColor: 'var(--n-200)', borderRadius: 'var(--r-md)' }}>
                <h3 className="font-medium mb-1" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Archivo detectado</h3>
                <p className="text-sm" style={{ color: 'var(--n-700)' }}>{file?.name} ({parsedData?.headers.length} columnas, {parsedData?.rows.length} filas)</p>
                {parsedData?.detectedBank && <p className="text-sm mt-1" style={{ color: 'var(--n-700)' }}>Banco detectado: <strong>{parsedData.detectedBank}</strong></p>}
              </div>

              {!selectedTemplate && parsedData && (
                <div className="p-4 border" style={{ background: 'var(--s-warn-bg)', borderColor: 'var(--s-warn)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--s-warn)' }}>
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium text-sm">No se pudieron mapear las columnas automáticamente</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--s-warn)' }}>Selecciona una plantilla de banco o configura el mapeo manual.</p>
                </div>
              )}

              {selectedTemplate && (
                <div className="p-4 border" style={{ background: 'var(--s-pos-bg)', borderColor: 'var(--s-pos)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-center gap-2" style={{ color: 'var(--s-pos)' }}>
                    <Check className="w-4 h-4" />
                    <span className="font-medium text-sm">Plantilla encontrada: {selectedTemplate.bankName}</span>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-4" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Seleccionar plantilla de banco</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bankTemplates.map((template) => (
                    <button key={template.id} onClick={() => handleTemplateSelect(template)} className="p-4 border text-left transition-colors" style={{ borderColor: selectedTemplate?.id === template.id ? 'var(--blue)' : 'var(--n-200)', background: selectedTemplate?.id === template.id ? 'var(--n-50)' : 'var(--white)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-base)' }}>
                      <div className="font-medium text-sm" style={{ color: 'var(--n-900)' }}>{template.bankName}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--n-500)' }}>Formato: {template.dateFormat} · Separador: {template.decimalSeparator}</div>
                    </button>
                  ))}
                  <button onClick={handleManualMapping} className="p-4 border text-left transition-colors" style={{ borderColor: !selectedTemplate ? 'var(--blue)' : 'var(--n-200)', background: !selectedTemplate ? 'var(--n-50)' : 'var(--white)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-base)' }}>
                    <div className="font-medium text-sm" style={{ color: 'var(--n-900)' }}>Mapeo manual</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--n-500)' }}>Configurar columnas manualmente</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="font-medium" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Mapeo de columnas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['fecha', 'concepto', 'importe', 'abono', 'cargo', 'saldo'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--n-700)', fontFamily: 'var(--font-base)' }}>
                      {field.charAt(0).toUpperCase() + field.slice(1)}{['fecha', 'concepto'].includes(field) ? ' *' : ''}
                    </label>
                    <select value={columnMapping[field] || ''} onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })} style={selectStyle}>
                      <option value="">Seleccionar columna...</option>
                      {parsedData?.headers.map((header, idx) => <option key={idx} value={header}>{header}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {!validateMapping() && (
                <div className="p-3 border" style={{ background: 'var(--s-warn-bg)', borderColor: 'var(--s-warn)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-center gap-2" style={{ color: 'var(--s-warn)' }}>
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Se requieren: Fecha, Concepto y (Importe O Abono+Cargo)</span>
                  </div>
                </div>
              )}

              {previewData.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Vista previa (10 primeras filas)</h4>
                  <div className="overflow-x-auto border" style={{ borderColor: 'var(--n-200)', borderRadius: 'var(--r-md)' }}>
                    <table className="w-full text-sm">
                      <thead style={{ background: 'var(--n-50)' }}>
                        <tr>{['Fecha', 'Concepto', 'Importe', 'Saldo'].map(h => <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--n-700)', fontFamily: 'var(--font-base)' }}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid var(--n-100)' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--n-700)' }}>{row.fecha}</td>
                            <td className="px-3 py-2 max-w-xs truncate" style={{ color: 'var(--n-700)' }}>{row.concepto}</td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: row.importe >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                              {row.importe ? parseFloat(row.importe).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--n-500)' }}>
                              {row.saldo ? parseFloat(row.saldo).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'}
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

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-6">
              <h3 className="font-medium" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Seleccionar cuenta de destino</h3>

              {selectedAccount && accounts.find(acc => acc.id?.toString() === selectedAccount)?.status === 'INACTIVE' && (
                <div className="p-4 border" style={{ background: 'var(--s-neg-bg)', borderColor: 'var(--s-neg)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-center gap-2" style={{ color: 'var(--s-neg)' }}>
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium text-sm">Activa la cuenta para importar extractos.</span>
                  </div>
                </div>
              )}

              <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} style={selectStyle}>
                <option value="">Seleccionar cuenta...</option>
                {accounts.filter(acc => acc.activa !== false).map((account) => (
                  <option key={account.id} value={account.id?.toString()} disabled={account.status === 'INACTIVE'}>
                    {account.alias || account.name} · {account.banco?.name || account.bank} · {account.iban}{account.status === 'INACTIVE' ? ' (INACTIVA)' : ''}
                  </option>
                ))}
              </select>

              <div className="p-4" style={{ background: 'var(--n-50)', borderRadius: 'var(--r-md)' }}>
                <h4 className="font-medium mb-2 text-sm" style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}>Resumen de importación</h4>
                <div className="space-y-1 text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>
                  <div>Archivo: {file?.name}</div>
                  <div>Filas a procesar: {parsedData?.rows.length || 0}</div>
                  <div>Destino: Tesorería → Movimientos</div>
                  {selectedTemplate && <div>Plantilla: {selectedTemplate.bankName}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: 'var(--n-200)' }}>
          <div>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 px-4 py-2 text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>
                <ArrowLeft className="w-4 h-4" />Anterior
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="atlas-btn-secondary px-4 py-2">Cancelar</button>
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={(step === 2 && !selectedTemplate && !parsedData?.detectedBank) || (step === 3 && !validateMapping())}
                className="atlas-btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente<ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={processImport}
                disabled={!selectedAccount || isProcessing || accounts.find(acc => acc.id?.toString() === selectedAccount)?.status === 'INACTIVE'}
                className="atlas-btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin" style={{ borderRadius: '50%' }}></div>Importando...</>
                ) : (
                  <><Upload className="w-4 h-4" />Importar movimientos</>
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
