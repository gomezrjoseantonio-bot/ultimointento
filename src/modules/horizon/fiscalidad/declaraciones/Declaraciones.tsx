import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, User, Archive } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, Property } from '../../../../services/db';
import { getFiscalSummary } from '../../../../services/fiscalSummaryService';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface ExportHistory {
  id: string;
  exerciseYear: number;
  dateTime: string;
  user: string;
  propertyScope: 'todos' | number;
  fileName: string;
}

const Declaraciones: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedProperty, setSelectedProperty] = useState<'todos' | number>('todos');
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    loadExportHistory();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await initDB();
      const propertiesData = await db.getAll('properties');
      setProperties(propertiesData.filter(p => p.state === 'activo'));
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExportHistory = () => {
    // Load from localStorage for now (in production would be from database)
    const history = localStorage.getItem('fiscalidad-export-history');
    if (history) {
      setExportHistory(JSON.parse(history));
    }
  };

  const saveExportHistory = (entry: ExportHistory) => {
    const updatedHistory = [entry, ...exportHistory].slice(0, 50); // Keep last 50 exports
    setExportHistory(updatedHistory);
    localStorage.setItem('fiscalidad-export-history', JSON.stringify(updatedHistory));
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const generatePDFContent = (propertyData: any, year: number): string => {
    return `DECLARACIÓN FISCAL - EJERCICIO ${year}

====================
DATOS DEL INMUEBLE
====================
Alias: ${propertyData.property?.alias || 'N/A'}
Dirección: ${propertyData.property?.address || 'N/A'}
Referencia Catastral: ${propertyData.property?.cadastralReference || 'N/A'}

====================
RESUMEN FISCAL
====================
Ingresos Devengados: ${formatCurrency(propertyData.ingresos || 0)}
Gastos Deducibles: ${formatCurrency(propertyData.gastos || 0)}
Amortizaciones: ${formatCurrency(propertyData.amortizaciones || 0)}
Arrastres Aplicados: ${formatCurrency(propertyData.arrastres || 0)}
NETO FISCAL: ${formatCurrency(propertyData.neto || 0)}

====================
DETALLE CASILLAS AEAT
====================
Casilla 0105 (Financiación): ${formatCurrency(propertyData.fiscalSummary?.box0105 || 0)}
Casilla 0106 (R&C): ${formatCurrency(propertyData.fiscalSummary?.box0106 || 0)}
Casilla 0109 (Comunidad): ${formatCurrency(propertyData.fiscalSummary?.box0109 || 0)}
Casilla 0112 (Servicios Personales): ${formatCurrency(propertyData.fiscalSummary?.box0112 || 0)}
Casilla 0113 (Suministros): ${formatCurrency(propertyData.fiscalSummary?.box0113 || 0)}
Casilla 0114 (Seguros): ${formatCurrency(propertyData.fiscalSummary?.box0114 || 0)}
Casilla 0115 (Tributos Locales): ${formatCurrency(propertyData.fiscalSummary?.box0115 || 0)}
Casilla 0117 (Amortización Muebles): ${formatCurrency(propertyData.fiscalSummary?.box0117 || 0)}

====================
INFORMACIÓN ADICIONAL
====================
Estado del Ejercicio: ${propertyData.fiscalSummary?.status || 'N/A'}
Fecha de Generación: ${new Date().toLocaleDateString('es-ES')}
Usuario: Sistema

Este documento ha sido generado automáticamente por el sistema.
`;
  };

  const generateExcelData = (propertyData: any, year: number) => {
    const workbook = XLSX.utils.book_new();

    // Resumen sheet
    const resumenData = [
      ['DECLARACIÓN FISCAL - EJERCICIO', year],
      [''],
      ['INMUEBLE', propertyData.property?.alias || 'N/A'],
      ['DIRECCIÓN', propertyData.property?.address || 'N/A'],
      [''],
      ['CONCEPTO', 'IMPORTE'],
      ['Ingresos Devengados', propertyData.ingresos || 0],
      ['Gastos Deducibles', propertyData.gastos || 0],
      ['Amortizaciones', propertyData.amortizaciones || 0],
      ['Arrastres Aplicados', propertyData.arrastres || 0],
      ['NETO FISCAL', propertyData.neto || 0]
    ];
    
    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');

    // AEAT Boxes sheet
    const aeatData = [
      ['CASILLA AEAT', 'DESCRIPCIÓN', 'IMPORTE'],
      ['0105', 'Intereses y Financiación', propertyData.fiscalSummary?.box0105 || 0],
      ['0106', 'Reparación y Conservación', propertyData.fiscalSummary?.box0106 || 0],
      ['0109', 'Comunidad', propertyData.fiscalSummary?.box0109 || 0],
      ['0112', 'Servicios Personales', propertyData.fiscalSummary?.box0112 || 0],
      ['0113', 'Suministros', propertyData.fiscalSummary?.box0113 || 0],
      ['0114', 'Seguros', propertyData.fiscalSummary?.box0114 || 0],
      ['0115', 'Tributos Locales', propertyData.fiscalSummary?.box0115 || 0],
      ['0117', 'Amortización Muebles', propertyData.fiscalSummary?.box0117 || 0]
    ];
    
    const aeatSheet = XLSX.utils.aoa_to_sheet(aeatData);
    XLSX.utils.book_append_sheet(workbook, aeatSheet, 'Casillas AEAT');

    return workbook;
  };

  const generateJSONData = (propertyData: any, year: number) => {
    return {
      metadata: {
        exerciseYear: year,
        generatedAt: new Date().toISOString(),
        version: '1.0',
        scope: selectedProperty === 'todos' ? 'all-properties' : 'single-property'
      },
      property: {
        id: propertyData.property?.id,
        alias: propertyData.property?.alias,
        address: propertyData.property?.address,
        cadastralReference: propertyData.property?.cadastralReference
      },
      fiscalSummary: {
        ingresos: propertyData.ingresos || 0,
        gastos: propertyData.gastos || 0,
        amortizaciones: propertyData.amortizaciones || 0,
        arrastres: propertyData.arrastres || 0,
        neto: propertyData.neto || 0
      },
      aeatBoxes: {
        box0105: propertyData.fiscalSummary?.box0105 || 0,
        box0106: propertyData.fiscalSummary?.box0106 || 0,
        box0109: propertyData.fiscalSummary?.box0109 || 0,
        box0112: propertyData.fiscalSummary?.box0112 || 0,
        box0113: propertyData.fiscalSummary?.box0113 || 0,
        box0114: propertyData.fiscalSummary?.box0114 || 0,
        box0115: propertyData.fiscalSummary?.box0115 || 0,
        box0117: propertyData.fiscalSummary?.box0117 || 0
      },
      status: propertyData.fiscalSummary?.status || 'N/A'
    };
  };

  const handleGenerateDeclaration = async () => {
    setIsGenerating(true);
    
    try {
      const zip = new JSZip();
      
      if (selectedProperty === 'todos') {
        // Generate for all properties + summary
        let totalIngresos = 0;
        let totalGastos = 0;
        let totalAmortizaciones = 0;
        let totalArrastres = 0;
        
        const allData = [];
        
        for (const property of properties) {
          if (!property.id) continue;
          
          const fiscalSummary = await getFiscalSummary(property.id, selectedYear);
          const gastos = (fiscalSummary.box0105 || 0) + (fiscalSummary.box0106 || 0) + 
                       (fiscalSummary.box0109 || 0) + (fiscalSummary.box0112 || 0) + 
                       (fiscalSummary.box0113 || 0) + (fiscalSummary.box0114 || 0) + 
                       (fiscalSummary.box0115 || 0) + (fiscalSummary.box0117 || 0);
          
          const propertyData = {
            property,
            fiscalSummary,
            ingresos: 0, // TODO: Calculate from contracts
            gastos,
            amortizaciones: fiscalSummary.annualDepreciation || 0,
            arrastres: 0, // TODO: Calculate carryforwards
            neto: 0 - gastos - (fiscalSummary.annualDepreciation || 0)
          };
          
          allData.push(propertyData);
          totalIngresos += propertyData.ingresos;
          totalGastos += propertyData.gastos;
          totalAmortizaciones += propertyData.amortizaciones;
          totalArrastres += propertyData.arrastres;
          
          // Add individual property files
          const pdfContent = generatePDFContent(propertyData, selectedYear);
          zip.file(`${property.alias}_${selectedYear}.txt`, pdfContent);
          
          const workbook = generateExcelData(propertyData, selectedYear);
          const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
          zip.file(`${property.alias}_${selectedYear}.xlsx`, excelBuffer);
          
          const jsonData = generateJSONData(propertyData, selectedYear);
          zip.file(`${property.alias}_${selectedYear}.json`, JSON.stringify(jsonData, null, 2));
        }
        
        // Add summary files
        const summaryData = {
          property: { alias: 'RESUMEN_TODOS', address: 'Todas las propiedades' },
          fiscalSummary: {},
          ingresos: totalIngresos,
          gastos: totalGastos,
          amortizaciones: totalAmortizaciones,
          arrastres: totalArrastres,
          neto: totalIngresos - totalGastos - totalAmortizaciones - totalArrastres
        };
        
        const summaryPdf = generatePDFContent(summaryData, selectedYear);
        zip.file(`RESUMEN_TODOS_${selectedYear}.txt`, summaryPdf);
        
        const summaryWorkbook = generateExcelData(summaryData, selectedYear);
        const summaryExcelBuffer = XLSX.write(summaryWorkbook, { type: 'array', bookType: 'xlsx' });
        zip.file(`RESUMEN_TODOS_${selectedYear}.xlsx`, summaryExcelBuffer);
        
        const summaryJson = generateJSONData(summaryData, selectedYear);
        zip.file(`RESUMEN_TODOS_${selectedYear}.json`, JSON.stringify(summaryJson, null, 2));
        
      } else {
        // Generate for single property
        const property = properties.find(p => p.id === selectedProperty);
        if (!property || !property.id) throw new Error('Property not found');
        
        const fiscalSummary = await getFiscalSummary(property.id, selectedYear);
        const gastos = (fiscalSummary.box0105 || 0) + (fiscalSummary.box0106 || 0) + 
                     (fiscalSummary.box0109 || 0) + (fiscalSummary.box0112 || 0) + 
                     (fiscalSummary.box0113 || 0) + (fiscalSummary.box0114 || 0) + 
                     (fiscalSummary.box0115 || 0) + (fiscalSummary.box0117 || 0);
        
        const propertyData = {
          property,
          fiscalSummary,
          ingresos: 0, // TODO: Calculate from contracts
          gastos,
          amortizaciones: fiscalSummary.annualDepreciation || 0,
          arrastres: 0, // TODO: Calculate carryforwards
          neto: 0 - gastos - (fiscalSummary.annualDepreciation || 0)
        };
        
        const pdfContent = generatePDFContent(propertyData, selectedYear);
        zip.file(`${property.alias}_${selectedYear}.txt`, pdfContent);
        
        const workbook = generateExcelData(propertyData, selectedYear);
        const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        zip.file(`${property.alias}_${selectedYear}.xlsx`, excelBuffer);
        
        const jsonData = generateJSONData(propertyData, selectedYear);
        zip.file(`${property.alias}_${selectedYear}.json`, JSON.stringify(jsonData, null, 2));
      }
      
      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      const fileName = selectedProperty === 'todos' 
        ? `Paquete_Renta_TODOS_${selectedYear}.zip`
        : `Paquete_Renta_${properties.find(p => p.id === selectedProperty)?.alias}_${selectedYear}.zip`;
      
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Save to export history
      const exportEntry: ExportHistory = {
        id: Date.now().toString(),
        exerciseYear: selectedYear,
        dateTime: new Date().toISOString(),
        user: 'Sistema',
        propertyScope: selectedProperty,
        fileName
      };
      
      saveExportHistory(exportEntry);
      
    } catch (error) {
      console.error('Error generating declaration:', error);
      alert('Error generando la declaración: ' + error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getYearRange = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 10; year--) {
      years.push(year);
    }
    return years;
  };

  const primaryAction = (
    <button
      onClick={handleGenerateDeclaration}
      disabled={isGenerating}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      <FileText className="w-4 h-4" />
      {isGenerating ? 'Generando...' : 'Generar Paquete Renta'}
    </button>
  );

  if (loading) {
    return (
      <PageLayout title="Declaraciones" subtitle="Preparación de declaraciones fiscales." primaryAction={primaryAction}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="Declaraciones" 
      subtitle="Preparación de declaraciones fiscales."
      primaryAction={primaryAction}
    >
      <div className="space-y-6">
        {/* Configuration Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración de Exportación</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ejercicio Fiscal
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getYearRange().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alcance del Inmueble
              </label>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los inmuebles</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.alias}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-blue-800">
              <Archive className="h-4 w-4" />
              <span>
                El paquete incluirá: PDF (layout AEAT), Excel/CSV (tablas base) y JSON (datos estructurados)
                {selectedProperty === 'todos' && ' + sumatorio y anexos por inmueble'}
              </span>
            </div>
          </div>
        </div>

        {/* Export History */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Histórico de Exportaciones</h3>
            <p className="text-sm text-gray-600">Últimas declaraciones generadas</p>
          </div>

          {exportHistory.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No hay exportaciones previas</p>
              <p className="text-sm text-gray-400">Las declaraciones generadas aparecerán aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ejercicio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alcance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Archivo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {exportHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.exerciseYear}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.dateTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{entry.user}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.propertyScope === 'todos' ? 'Todos los inmuebles' : 
                         properties.find(p => p.id === entry.propertyScope)?.alias || 'Inmueble eliminado'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <Download className="h-4 w-4 text-gray-400" />
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {entry.fileName}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Information Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Información del Paquete Renta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Contenido del ZIP:</h4>
              <ul className="space-y-1">
                <li>• PDF: Layout oficial AEAT por inmueble</li>
                <li>• Excel/CSV: Tablas de datos base</li>
                <li>• JSON: Datos estructurados para integración</li>
                <li>• Resumen consolidado (si selecciona "Todos")</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Datos Incluidos:</h4>
              <ul className="space-y-1">
                <li>• Ingresos devengados y estado de cobro</li>
                <li>• Gastos por casillas AEAT (0105-0117)</li>
                <li>• Amortizaciones aplicadas</li>
                <li>• Arrastres de ejercicios anteriores</li>
                <li>• Cálculo de neto fiscal</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Declaraciones;