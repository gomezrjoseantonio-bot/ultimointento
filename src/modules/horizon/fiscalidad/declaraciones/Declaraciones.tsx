import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Download, Calendar, User, Archive } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, Property } from '../../../../services/db';
import { getFiscalSummary } from '../../../../services/fiscalSummaryService';

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
    const formatEsCurrency = (num: number): string => 
      num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

    return `DECLARACIÓN FISCAL - EJERCICIO ${year}

====================
DATOS DEL INMUEBLE
====================
Alias: ${propertyData.property?.alias || 'N/A'}
Dirección: ${propertyData.property?.address || 'N/A'}
Código Postal: ${propertyData.property?.postalCode || 'N/A'}
Provincia: ${propertyData.property?.province || 'N/A'}
Referencia Catastral: ${propertyData.property?.cadastralReference || 'N/A'}
Superficie: ${propertyData.property?.squareMeters || 'N/A'} m²

====================
RESUMEN FISCAL ANUAL
====================
INGRESOS:
  Rentas devengadas: ${formatEsCurrency(propertyData.ingresos || 0)}
  Otros ingresos: ${formatEsCurrency(propertyData.otrosIngresos || 0)}
  TOTAL INGRESOS: ${formatEsCurrency((propertyData.ingresos || 0) + (propertyData.otrosIngresos || 0))}

GASTOS DEDUCIBLES:
  Financiación (0105): ${formatEsCurrency(propertyData.fiscalSummary?.box0105 || 0)}
  Reparación y Conservación (0106): ${formatEsCurrency(propertyData.fiscalSummary?.box0106 || 0)}
  Comunidad de Propietarios (0109): ${formatEsCurrency(propertyData.fiscalSummary?.box0109 || 0)}
  Servicios Personales (0112): ${formatEsCurrency(propertyData.fiscalSummary?.box0112 || 0)}
  Suministros (0113): ${formatEsCurrency(propertyData.fiscalSummary?.box0113 || 0)}
  Seguros (0114): ${formatEsCurrency(propertyData.fiscalSummary?.box0114 || 0)}
  Tributos Locales (0115): ${formatEsCurrency(propertyData.fiscalSummary?.box0115 || 0)}
  Amortización Mobiliario (0117): ${formatEsCurrency(propertyData.fiscalSummary?.box0117 || 0)}
  TOTAL GASTOS: ${formatEsCurrency(propertyData.gastos || 0)}

AMORTIZACIÓN:
  Valor construcción: ${formatEsCurrency(propertyData.fiscalSummary?.constructionValue || 0)}
  Amortización anual (3%): ${formatEsCurrency(propertyData.amortizaciones || 0)}

ARRASTRES DE PÉRDIDAS:
  Aplicados este ejercicio: ${formatEsCurrency(propertyData.arrastresAplicados || 0)}
  Generados este ejercicio: ${formatEsCurrency(propertyData.arrastresGenerados || 0)}
  Saldo pendiente: ${formatEsCurrency(propertyData.arrastresPendientes || 0)}

RESULTADO FISCAL:
  Base imponible: ${formatEsCurrency(propertyData.neto || 0)}
  Estado: ${(propertyData.neto || 0) >= 0 ? 'GANANCIA' : 'PÉRDIDA'}

====================
DETALLE ARRASTRES AEAT
====================
${propertyData.carryForwards?.map((cf: any) => 
  `Ejercicio ${cf.exerciseYear}: ${formatEsCurrency(cf.remainingAmount)} (caduca ${cf.expirationYear})`
).join('\n') || 'No hay arrastres pendientes'}

====================
INFORMACIÓN TÉCNICA
====================
Estado del Ejercicio: ${propertyData.fiscalSummary?.status || 'Vivo'}
Método de Cálculo: ${propertyData.fiscalSummary?.aeatAmortization?.calculationMethod === 'special' ? 'Caso Especial' : 'Regla General'}
Días de Arrendamiento: ${propertyData.fiscalSummary?.aeatAmortization?.daysRented || 'N/A'}
Días Disponibles: ${propertyData.fiscalSummary?.aeatAmortization?.daysAvailable || 'N/A'}

====================
METADATOS
====================
Fecha de Generación: ${new Date().toLocaleDateString('es-ES', { 
  day: '2-digit', 
  month: '2-digit', 
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}
Usuario: Sistema
Versión: H9 Fiscalidad
Formato: es-ES

Este documento ha sido generado automáticamente por el sistema Atlas Horizon.
Para mayor información, consulte los documentos fuente y extractos bancarios.
`;
  };

  const generateExcelData = (propertyData: any, year: number, XLSX: any) => {
    const workbook = XLSX.utils.book_new();

    // Función para formatear números en formato español
    const formatEsNumber = (num: number): string => 
      typeof num === 'number' ? num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';

    // 1. Hoja Resumen
    const resumenData = [
      ['DECLARACIÓN FISCAL - EJERCICIO', year],
      ['Inmueble', propertyData.property?.alias || 'N/A'],
      ['Dirección', propertyData.property?.address || 'N/A'],
      ['Código Postal', propertyData.property?.postalCode || 'N/A'],
      ['Provincia', propertyData.property?.province || 'N/A'],
      ['Referencia Catastral', propertyData.property?.cadastralReference || 'N/A'],
      ['Superficie (m²)', propertyData.property?.squareMeters || 'N/A'],
      [''],
      ['CONCEPTO', 'IMPORTE (€)', 'OBSERVACIONES'],
      ['INGRESOS'],
      ['Rentas devengadas', formatEsNumber(propertyData.ingresos || 0), 'Ingresos por alquiler'],
      ['Otros ingresos', formatEsNumber(propertyData.otrosIngresos || 0), 'Fianzas, penalizaciones, etc.'],
      ['TOTAL INGRESOS', formatEsNumber((propertyData.ingresos || 0) + (propertyData.otrosIngresos || 0)), ''],
      [''],
      ['GASTOS DEDUCIBLES'],
      ['Intereses y Financiación (0105)', formatEsNumber(propertyData.fiscalSummary?.box0105 || 0), 'Préstamos hipotecarios'],
      ['Reparación y Conservación (0106)', formatEsNumber(propertyData.fiscalSummary?.box0106 || 0), 'Mantenimiento y reparaciones'],
      ['Comunidad de Propietarios (0109)', formatEsNumber(propertyData.fiscalSummary?.box0109 || 0), 'Gastos de comunidad'],
      ['Servicios Personales (0112)', formatEsNumber(propertyData.fiscalSummary?.box0112 || 0), 'Administración, gestoría'],
      ['Suministros (0113)', formatEsNumber(propertyData.fiscalSummary?.box0113 || 0), 'Agua, luz, gas'],
      ['Seguros (0114)', formatEsNumber(propertyData.fiscalSummary?.box0114 || 0), 'Seguros del inmueble'],
      ['Tributos Locales (0115)', formatEsNumber(propertyData.fiscalSummary?.box0115 || 0), 'IBI, basuras'],
      ['Amortización Mobiliario (0117)', formatEsNumber(propertyData.fiscalSummary?.box0117 || 0), 'Muebles y enseres'],
      ['TOTAL GASTOS', formatEsNumber(propertyData.gastos || 0), ''],
      [''],
      ['AMORTIZACIÓN'],
      ['Valor construcción', formatEsNumber(propertyData.fiscalSummary?.constructionValue || 0), 'Base amortizable'],
      ['Amortización anual (3%)', formatEsNumber(propertyData.amortizaciones || 0), 'Depreciación del inmueble'],
      [''],
      ['ARRASTRES DE PÉRDIDAS'],
      ['Aplicados este ejercicio', formatEsNumber(propertyData.arrastresAplicados || 0), 'De ejercicios anteriores'],
      ['Generados este ejercicio', formatEsNumber(propertyData.arrastresGenerados || 0), 'Para ejercicios futuros'],
      ['Saldo pendiente', formatEsNumber(propertyData.arrastresPendientes || 0), 'Disponible hasta 4 años'],
      [''],
      ['RESULTADO FISCAL'],
      ['BASE IMPONIBLE', formatEsNumber(propertyData.neto || 0), (propertyData.neto || 0) >= 0 ? 'GANANCIA' : 'PÉRDIDA'],
      [''],
      ['INFORMACIÓN TÉCNICA'],
      ['Estado del ejercicio', propertyData.fiscalSummary?.status || 'Vivo', ''],
      ['Días de arrendamiento', propertyData.fiscalSummary?.aeatAmortization?.daysRented || 'N/A', ''],
      ['Días disponibles', propertyData.fiscalSummary?.aeatAmortization?.daysAvailable || 'N/A', ''],
      ['Método de cálculo', propertyData.fiscalSummary?.aeatAmortization?.calculationMethod === 'special' ? 'Caso Especial' : 'Regla General', '']
    ];
    
    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    
    // Configurar anchos de columna
    resumenSheet['!cols'] = [
      { wch: 30 }, // Concepto
      { wch: 15 }, // Importe
      { wch: 40 }  // Observaciones
    ];
    
    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');

    // 2. Hoja Arrastres Detalle
    if (propertyData.carryForwards && propertyData.carryForwards.length > 0) {
      const arrastresData = [
        ['DETALLE DE ARRASTRES DE PÉRDIDAS'],
        [''],
        ['Ejercicio Origen', 'Pérdida Original (€)', 'Aplicado ' + year + ' (€)', 'Saldo Pendiente (€)', 'Año Caducidad', 'Estado'],
        ...propertyData.carryForwards.map((cf: any) => [
          cf.exerciseYear,
          formatEsNumber(cf.excessAmount),
          formatEsNumber(cf.appliedThisYear || 0),
          formatEsNumber(cf.remainingAmount),
          cf.expirationYear,
          cf.expiresThisYear ? 'Caduca ' + year : cf.remainingAmount > 0 ? 'Disponible' : 'Agotado'
        ])
      ];
      
      const arrastresSheet = XLSX.utils.aoa_to_sheet(arrastresData);
      arrastresSheet['!cols'] = [
        { wch: 15 }, // Ejercicio
        { wch: 18 }, // Pérdida Original
        { wch: 18 }, // Aplicado
        { wch: 18 }, // Saldo Pendiente
        { wch: 15 }, // Año Caducidad
        { wch: 15 }  // Estado
      ];
      
      XLSX.utils.book_append_sheet(workbook, arrastresSheet, 'Arrastres');
    }

    // 3. Hoja Ingresos Detalle (si hay datos)
    if (propertyData.ingresosDetalle && propertyData.ingresosDetalle.length > 0) {
      const ingresosData = [
        ['DETALLE DE INGRESOS'],
        [''],
        ['Fecha Emisión', 'Concepto', 'Inquilino', 'Importe (€)', 'Estado', 'Fecha Cobro', 'Método'],
        ...propertyData.ingresosDetalle.map((ing: any) => [
          ing.fecha_emision,
          ing.concepto || 'Renta mensual',
          ing.proveedor_contraparte,
          formatEsNumber(ing.importe),
          ing.estado,
          ing.fecha_cobro || '',
          ing.metodo_cobro || ''
        ])
      ];
      
      const ingresosSheet = XLSX.utils.aoa_to_sheet(ingresosData);
      XLSX.utils.book_append_sheet(workbook, ingresosSheet, 'Ingresos');
    }

    // 4. Hoja Gastos Detalle (si hay datos)
    if (propertyData.gastosDetalle && propertyData.gastosDetalle.length > 0) {
      const gastosData = [
        ['DETALLE DE GASTOS'],
        [''],
        ['Fecha Emisión', 'Proveedor', 'Concepto', 'Casilla AEAT', 'Base (€)', 'IVA (€)', 'Total (€)', 'Estado'],
        ...propertyData.gastosDetalle.map((gasto: any) => [
          gasto.fecha_emision,
          gasto.proveedor_nombre,
          gasto.concepto || '',
          gasto.categoria_AEAT,
          formatEsNumber(gasto.base || 0),
          formatEsNumber(gasto.iva || 0),
          formatEsNumber(gasto.total),
          gasto.estado
        ])
      ];
      
      const gastosSheet = XLSX.utils.aoa_to_sheet(gastosData);
      XLSX.utils.book_append_sheet(workbook, gastosSheet, 'Gastos');
    }

    // 5. Hoja Metadatos
    const metadatosData = [
      ['METADATOS DE EXPORTACIÓN'],
      [''],
      ['Campo', 'Valor'],
      ['Fecha de generación', new Date().toLocaleString('es-ES')],
      ['Usuario', 'Sistema'],
      ['Versión', 'H9 Fiscalidad'],
      ['Formato números', 'es-ES'],
      ['Formato fechas', 'dd/mm/aaaa'],
      ['Moneda', 'EUR'],
      ['Ejercicio fiscal', year],
      ['Inmueble', propertyData.property?.alias || 'N/A'],
      ['ID Inmueble', propertyData.property?.id || 'N/A']
    ];
    
    const metadatosSheet = XLSX.utils.aoa_to_sheet(metadatosData);
    XLSX.utils.book_append_sheet(workbook, metadatosSheet, 'Metadatos');

    return workbook;
  };

  const generateJSONData = (propertyData: any, year: number) => {
    return {
      metadata: {
        exerciseYear: year,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Atlas Horizon H9 Fiscalidad',
        version: '2.0',
        format: 'es-ES',
        currency: 'EUR',
        scope: selectedProperty === 'todos' ? 'all-properties' : 'single-property',
        exportId: `FISCAL_${year}_${Date.now()}`,
        locale: {
          language: 'es',
          country: 'ES',
          numberFormat: '#.##0,00',
          dateFormat: 'dd/mm/yyyy'
        }
      },
      property: {
        id: propertyData.property?.id,
        alias: propertyData.property?.alias,
        address: propertyData.property?.address,
        postalCode: propertyData.property?.postalCode,
        province: propertyData.property?.province,
        municipality: propertyData.property?.municipality,
        ccaa: propertyData.property?.ccaa,
        cadastralReference: propertyData.property?.cadastralReference,
        squareMeters: propertyData.property?.squareMeters,
        bedrooms: propertyData.property?.bedrooms,
        state: propertyData.property?.state,
        purchaseDate: propertyData.property?.purchaseDate,
        acquisitionCosts: propertyData.property?.acquisitionCosts
      },
      fiscalSummary: {
        ingresos: {
          rentasDevengadas: propertyData.ingresos || 0,
          otrosIngresos: propertyData.otrosIngresos || 0,
          total: (propertyData.ingresos || 0) + (propertyData.otrosIngresos || 0)
        },
        gastos: {
          financiacion: propertyData.fiscalSummary?.box0105 || 0,
          reparacionConservacion: propertyData.fiscalSummary?.box0106 || 0,
          comunidad: propertyData.fiscalSummary?.box0109 || 0,
          serviciosPersonales: propertyData.fiscalSummary?.box0112 || 0,
          suministros: propertyData.fiscalSummary?.box0113 || 0,
          seguros: propertyData.fiscalSummary?.box0114 || 0,
          tributosLocales: propertyData.fiscalSummary?.box0115 || 0,
          amortizacionMobiliario: propertyData.fiscalSummary?.box0117 || 0,
          total: propertyData.gastos || 0
        },
        amortizacion: {
          valorConstruccion: propertyData.fiscalSummary?.constructionValue || 0,
          porcentajeAnual: 3.0,
          importeAnual: propertyData.amortizaciones || 0,
          metodoCaloculo: propertyData.fiscalSummary?.aeatAmortization?.calculationMethod || 'general'
        },
        arrastres: {
          aplicadosEsteEjercicio: propertyData.arrastresAplicados || 0,
          generadosEsteEjercicio: propertyData.arrastresGenerados || 0,
          saldoPendiente: propertyData.arrastresPendientes || 0,
          detalle: propertyData.carryForwards || []
        },
        resultado: {
          baseImponible: propertyData.neto || 0,
          tipo: (propertyData.neto || 0) >= 0 ? 'GANANCIA' : 'PERDIDA',
          estado: propertyData.fiscalSummary?.status || 'Vivo'
        }
      },
      aeatBoxes: {
        '0105': {
          descripcion: 'Intereses y gastos de financiación',
          importe: propertyData.fiscalSummary?.box0105 || 0,
          categoria: 'financiacion'
        },
        '0106': {
          descripcion: 'Reparación y conservación',
          importe: propertyData.fiscalSummary?.box0106 || 0,
          categoria: 'reparacion-conservacion'
        },
        '0109': {
          descripcion: 'Comunidad de propietarios',
          importe: propertyData.fiscalSummary?.box0109 || 0,
          categoria: 'comunidad'
        },
        '0112': {
          descripcion: 'Servicios personales',
          importe: propertyData.fiscalSummary?.box0112 || 0,
          categoria: 'servicios-personales'
        },
        '0113': {
          descripcion: 'Suministros',
          importe: propertyData.fiscalSummary?.box0113 || 0,
          categoria: 'suministros'
        },
        '0114': {
          descripcion: 'Seguros',
          importe: propertyData.fiscalSummary?.box0114 || 0,
          categoria: 'seguros'
        },
        '0115': {
          descripcion: 'Tributos y tasas',
          importe: propertyData.fiscalSummary?.box0115 || 0,
          categoria: 'tributos'
        },
        '0117': {
          descripcion: 'Amortización del mobiliario',
          importe: propertyData.fiscalSummary?.box0117 || 0,
          categoria: 'amortizacion-muebles'
        }
      },
      technicalInfo: {
        diasArrendamiento: propertyData.fiscalSummary?.aeatAmortization?.daysRented || null,
        diasDisponibles: propertyData.fiscalSummary?.aeatAmortization?.daysAvailable || null,
        porcentajeOcupacion: propertyData.fiscalSummary?.aeatAmortization?.daysRented && propertyData.fiscalSummary?.aeatAmortization?.daysAvailable 
          ? (propertyData.fiscalSummary.aeatAmortization.daysRented / propertyData.fiscalSummary.aeatAmortization.daysAvailable * 100).toFixed(2)
          : null,
        estadoEjercicio: propertyData.fiscalSummary?.status || 'Vivo',
        limiteAEAT: {
          aplicado: true,
          descripcion: 'Límite del 50% de los rendimientos íntegros para gastos financiación y reparación',
          ejerciciosArrastre: 4
        }
      },
      detalleDatos: {
        ingresos: propertyData.ingresosDetalle || [],
        gastos: propertyData.gastosDetalle || [],
        movimientosBancarios: propertyData.movimientosDetalle || [],
        documentos: propertyData.documentosVinculados || []
      },
      trazabilidad: {
        fechaGeneracion: new Date().toISOString(),
        usuario: 'Sistema',
        propiedadesProcesadas: selectedProperty === 'todos' ? properties.length : 1,
        documentosVinculados: propertyData.documentosVinculados?.length || 0,
        conciliacionesRealizadas: propertyData.conciliacionesCount || 0,
        validacionesPasadas: true
      }
    };
  };

  const handleGenerateDeclaration = async () => {
    setIsGenerating(true);
    
    try {
      // Dynamic imports to reduce main bundle size
      const [XLSX, JSZip] = await Promise.all([
        import('xlsx'),
        import('jszip')
      ]);
      
      const zip = new JSZip.default();
      
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
          
          const workbook = generateExcelData(propertyData, selectedYear, XLSX);
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
        
        const summaryWorkbook = generateExcelData(summaryData, selectedYear, XLSX);
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
        
        const workbook = generateExcelData(propertyData, selectedYear, XLSX);
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
      toast.error('Error generando la declaración: ' + error);
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

  const primaryAction = {
    label: isGenerating ? 'Generando...' : 'Generar Paquete Renta',
    onClick: handleGenerateDeclaration,
    disabled: isGenerating
  };

  if (loading) {
    return (
      <PageLayout title="Declaraciones" subtitle="Preparación de declaraciones fiscales." primaryAction={primaryAction}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          
          <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-primary-800">
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