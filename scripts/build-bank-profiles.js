#!/usr/bin/env node

/**
 * Bank Profiles Generator CLI Script
 * 
 * This script reads bank statement files from /profiles-input/ directory
 * and generates a bank-profiles.json file for production use.
 * 
 * Usage: yarn build:bank-profiles
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const XLSX = require('xlsx');

const PROFILES_INPUT_DIR = path.join(__dirname, '..', 'profiles-input');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'assets', 'bank-profiles.json');
const HEADER_SEARCH_ROWS = 40;

// Common noise patterns
const NOISE_PATTERNS = [
  'saldo inicial', 'saldo final', 'saldo anterior', 'saldo actual', 
  'subtotal', 'total', 'totales', 'página', 'page', 'extracto', 
  'periodo', 'desde', 'hasta', 'nº de cuenta', 'iban', 'titular', 'oficina'
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSeparator(csvText) {
  const firstLine = csvText.split('\n')[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCSVLine(line, separator) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

async function parseFile(filePath) {
  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();
  
  console.log(`\nProcesando archivo: ${fileName}`);
  
  let data;
  let sheetName;

  if (['.xlsx', '.xls'].includes(extension)) {
    // Parse Excel file
    const workbook = XLSX.readFile(filePath);
    sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error('No se encontraron hojas válidas en el archivo Excel');
    }

    data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      raw: false,
      dateNF: 'yyyy-mm-dd' 
    });
    
    console.log(`  - Hoja: ${sheetName}`);
  } else if (extension === '.csv') {
    // Parse CSV file
    const text = await fs.readFile(filePath, 'utf-8');
    const separator = detectSeparator(text);
    const lines = text.split('\n');
    
    data = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row = parseCSVLine(line, separator);
      data.push(row);
    }
    
    console.log(`  - Separador detectado: "${separator}"`);
  } else {
    throw new Error(`Formato de archivo no soportado: ${extension}`);
  }

  if (data.length === 0) {
    throw new Error('El archivo está vacío');
  }

  console.log(`  - Filas leídas: ${data.length}`);

  // Find header row
  let headerRow = -1;
  let headers = [];

  for (let i = 0; i < Math.min(HEADER_SEARCH_ROWS, data.length); i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const candidateHeaders = row.map(cell => String(cell || '').trim()).filter(h => h);
    if (candidateHeaders.length < 2) continue;

    const normalizedHeaders = candidateHeaders.map(normalizeText);
    const hasDateLike = normalizedHeaders.some(h => 
      h.includes('fecha') || h.includes('date') || h.includes('data')
    );
    const hasAmountLike = normalizedHeaders.some(h => 
      h.includes('importe') || h.includes('amount') || h.includes('cantidad') || 
      h.includes('monto') || h.includes('euros') || h.includes('import')
    );

    if (hasDateLike && hasAmountLike) {
      headerRow = i;
      headers = candidateHeaders;
      break;
    }
  }

  if (headerRow === -1) {
    throw new Error('No se pudieron detectar cabeceras válidas');
  }

  console.log(`  - Fila de cabeceras: ${headerRow + 1}`);
  console.log(`  - Cabeceras detectadas: ${headers.join(', ')}`);

  // Extract sample data (5 rows after headers)
  const sampleRows = data.slice(headerRow + 1, headerRow + 6);
  
  return {
    fileName,
    sheetName,
    headerRow,
    headers,
    sampleRows
  };
}

async function mapFields(parsedFile) {
  const { fileName, headers, sampleRows } = parsedFile;
  
  console.log(`\n--- Mapeo de campos para ${fileName} ---`);
  
  // Show preview
  console.log('\nVista previa de datos:');
  console.log(headers.map((h, i) => `${i}: ${h}`).join(' | '));
  sampleRows.forEach((row, i) => {
    const displayRow = row.map(cell => String(cell).slice(0, 10)).join(' | ');
    console.log(`${i + 1}: ${displayRow}`);
  });

  console.log('\nCampos disponibles:');
  headers.forEach((header, index) => {
    console.log(`  ${index}: ${header}`);
  });

  const fieldMapping = {};
  
  // Map required fields
  const requiredFields = [
    { key: 'date', name: 'Fecha', required: true },
    { key: 'amount', name: 'Importe', required: true },
    { key: 'description', name: 'Descripción', required: true }
  ];

  const optionalFields = [
    { key: 'valueDate', name: 'Fecha Valor', required: false },
    { key: 'counterparty', name: 'Contraparte', required: false }
  ];

  for (const field of [...requiredFields, ...optionalFields]) {
    while (true) {
      const answer = await question(
        `\n${field.name}${field.required ? ' (OBLIGATORIO)' : ''}: Introduce el número de columna (o vacío para omitir): `
      );
      
      if (!answer.trim()) {
        if (field.required) {
          console.log('Este campo es obligatorio.');
          continue;
        } else {
          break;
        }
      }

      const index = parseInt(answer.trim());
      if (isNaN(index) || index < 0 || index >= headers.length) {
        console.log('Número de columna inválido.');
        continue;
      }

      fieldMapping[field.key] = headers[index];
      console.log(`  ✓ ${field.name} → "${headers[index]}"`);
      break;
    }
  }

  return fieldMapping;
}

async function generateProfile(parsedFile, fieldMapping) {
  const bankKey = await question('\nNombre del banco/entidad: ');
  
  if (!bankKey.trim()) {
    throw new Error('El nombre del banco es obligatorio');
  }

  const profile = {
    bankKey: bankKey.trim(),
    bankVersion: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
    headerAliases: {
      date: fieldMapping.date ? [normalizeText(fieldMapping.date)] : [],
      valueDate: fieldMapping.valueDate ? [normalizeText(fieldMapping.valueDate)] : [],
      amount: fieldMapping.amount ? [normalizeText(fieldMapping.amount)] : [],
      description: fieldMapping.description ? [normalizeText(fieldMapping.description)] : [],
      counterparty: fieldMapping.counterparty ? [normalizeText(fieldMapping.counterparty)] : []
    },
    noisePatterns: NOISE_PATTERNS,
    numberFormat: {
      decimal: ',',
      thousand: '.'
    },
    dateHints: ['dd/mm/yyyy', 'dd-mm-yyyy'],
    minScore: 3
  };

  return profile;
}

async function main() {
  try {
    console.log('🏦 Generador de Perfiles de Banco');
    console.log('==================================\n');

    // Check if profiles-input directory exists
    try {
      await fs.access(PROFILES_INPUT_DIR);
    } catch (error) {
      console.log(`Creando directorio ${PROFILES_INPUT_DIR}...`);
      await fs.mkdir(PROFILES_INPUT_DIR, { recursive: true });
      console.log('Directorio creado. Coloca tus archivos de ejemplo en esta carpeta y ejecuta el script de nuevo.');
      return;
    }

    // Read files from profiles-input directory
    const files = await fs.readdir(PROFILES_INPUT_DIR);
    const supportedFiles = files.filter(file => 
      ['.csv', '.xlsx', '.xls'].includes(path.extname(file).toLowerCase())
    );

    if (supportedFiles.length === 0) {
      console.log(`No se encontraron archivos soportados en ${PROFILES_INPUT_DIR}`);
      console.log('Formatos soportados: .csv, .xlsx, .xls');
      return;
    }

    console.log(`Encontrados ${supportedFiles.length} archivo(s):`);
    supportedFiles.forEach(file => console.log(`  - ${file}`));

    const profiles = [];

    for (const file of supportedFiles) {
      const filePath = path.join(PROFILES_INPUT_DIR, file);
      
      try {
        const parsedFile = await parseFile(filePath);
        const fieldMapping = await mapFields(parsedFile);
        const profile = await generateProfile(parsedFile, fieldMapping);
        
        profiles.push(profile);
        console.log(`✓ Perfil generado para ${profile.bankKey}`);
        
      } catch (error) {
        console.error(`❌ Error procesando ${file}: ${error.message}`);
        
        const continueAnswer = await question('¿Continuar con el siguiente archivo? (s/n): ');
        if (continueAnswer.toLowerCase() !== 's') {
          break;
        }
      }
    }

    if (profiles.length === 0) {
      console.log('No se generaron perfiles.');
      return;
    }

    // Generate output
    const outputData = { profiles };
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    
    // Write to file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Archivo generado: ${OUTPUT_FILE}`);
    console.log(`📊 ${profiles.length} perfil(es) incluido(s):`);
    profiles.forEach(profile => {
      console.log(`   - ${profile.bankKey} (v${profile.bankVersion})`);
    });
    
    console.log('\n🎯 Próximos pasos:');
    console.log('   1. Verifica el archivo generado');
    console.log('   2. Haz commit de los cambios');
    console.log('   3. Los perfiles estarán disponibles en la próxima compilación');

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}