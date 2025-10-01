#!/usr/bin/env node
/**
 * Fix window.confirm() calls to use ATLAS confirmationService
 * Replaces browser alerts with ATLAS-compliant toast confirmations
 */

const fs = require('fs');
const path = require('path');

// Files that need fixing
const filesToFix = [
  'src/components/fiscalidad/PropertyImprovements.tsx',
  'src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx',
  'src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx',
  'src/modules/horizon/inmuebles/prestamos/components/PrestamosList.tsx',
  'src/modules/horizon/inmuebles/cartera/Cartera.tsx',
  'src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx',
  'src/modules/horizon/inmuebles/contratos/components/ContractsLista.tsx',
  'src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx',
  'src/modules/horizon/proyeccion/presupuesto/components/PresupuestoTablaLineas.tsx',
  'src/modules/horizon/proyeccion/presupuesto/components/WizardStepRevisionNuevo.tsx',
  'src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx',
  'src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx',
];

function addImportIfMissing(content, filePath) {
  // Determine correct import path based on file location
  const depth = filePath.split('/').length - 2; // -2 for src/ and filename
  let importPath = '../'.repeat(depth) + 'services/confirmationService';
  
  // Check if import already exists
  if (content.includes('confirmationService')) {
    return content;
  }
  
  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }
  
  // Add import after last import
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, `import { confirmDelete } from '${importPath}';`);
    return lines.join('\n');
  }
  
  return content;
}

function replaceWindowConfirm(content) {
  // Pattern 1: if (window.confirm('message'))
  content = content.replace(
    /if\s*\(\s*window\.confirm\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\)\s*{/g,
    (match, message) => {
      // Extract the question or action from message
      const simpleMessage = message
        .replace(/¿Estás seguro de que quieres eliminar /g, '')
        .replace(/¿Eliminar /g, '')
        .replace(/¿/g, '')
        .replace(/\?/g, '')
        .trim();
      
      return `const confirmed = await confirmDelete('${simpleMessage}');\n    if (confirmed) {`;
    }
  );
  
  // Pattern 2: if (!window.confirm('message'))
  content = content.replace(
    /if\s*\(\s*!\s*window\.confirm\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\)\s*{/g,
    (match, message) => {
      const simpleMessage = message
        .replace(/¿Estás seguro de que quieres eliminar /g, '')
        .replace(/¿Eliminar /g, '')
        .replace(/¿/g, '')
        .replace(/\?/g, '')
        .trim();
      
      return `const confirmed = await confirmDelete('${simpleMessage}');\n    if (!confirmed) {`;
    }
  );
  
  // Pattern 3: const result = window.confirm(...)
  content = content.replace(
    /const\s+(\w+)\s*=\s*window\.confirm\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    (match, varName, message) => {
      const simpleMessage = message
        .replace(/¿Estás seguro de que quieres eliminar /g, '')
        .replace(/¿Eliminar /g, '')
        .replace(/¿/g, '')
        .replace(/\?/g, '')
        .trim();
      
      return `const ${varName} = await confirmDelete('${simpleMessage}')`;
    }
  );
  
  return content;
}

function makeAsyncIfNeeded(content) {
  // Find function declarations that use confirmDelete and make them async if not already
  const lines = content.split('\n');
  const confirmDeleteLines = [];
  
  lines.forEach((line, index) => {
    if (line.includes('confirmDelete') && line.includes('await')) {
      confirmDeleteLines.push(index);
    }
  });
  
  if (confirmDeleteLines.length === 0) {
    return content;
  }
  
  // For each line with await confirmDelete, find its function and make it async
  confirmDeleteLines.forEach(lineIndex => {
    // Search backwards for function declaration
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];
      
      // Check for arrow function: const funcName = (
      if (line.match(/const\s+\w+\s*=\s*\(/)) {
        if (!line.includes('async')) {
          lines[i] = line.replace(/const\s+(\w+)\s*=\s*\(/, 'const $1 = async (');
        }
        break;
      }
      
      // Check for regular function: function funcName(
      if (line.match(/function\s+\w+\s*\(/)) {
        if (!line.includes('async')) {
          lines[i] = line.replace(/function\s+/, 'async function ');
        }
        break;
      }
      
      // Check for method: funcName = (
      if (line.match(/\w+\s*=\s*\(/)) {
        if (!line.includes('async')) {
          lines[i] = line.replace(/(\w+\s*=\s*)\(/, '$1async (');
        }
        break;
      }
    }
  });
  
  return lines.join('\n');
}

function processFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  console.log(`\n📄 Processing: ${filePath}`);
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Check if file has window.confirm
  if (!content.includes('window.confirm')) {
    console.log(`   ✓ No window.confirm found, skipping`);
    return;
  }
  
  // Add import if missing
  content = addImportIfMissing(content, filePath);
  
  // Replace window.confirm calls
  content = replaceWindowConfirm(content);
  
  // Make functions async if needed
  content = makeAsyncIfNeeded(content);
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`   ✅ Fixed window.confirm calls`);
  } else {
    console.log(`   ⚠️  No changes made`);
  }
}

console.log('🔧 Fixing window.confirm() calls...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

filesToFix.forEach(processFile);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Done! All window.confirm calls have been migrated to ATLAS confirmationService');
console.log('\n💡 Remember to test the confirmations to ensure they work correctly');
