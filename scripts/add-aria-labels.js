#!/usr/bin/env node
/**
 * Add aria-label to icon-only buttons for accessibility
 * Addresses WCAG 2.1 - 4.1.2 Name, Role, Value
 */

const fs = require('fs');
const path = require('path');

// Common icon-to-label mappings
const ICON_LABELS = {
  // Navigation and actions
  'X': 'Cerrar',
  'XCircle': 'Cerrar',
  'ArrowLeft': 'Volver',
  'ArrowRight': 'Siguiente',
  'ChevronLeft': 'Anterior',
  'ChevronRight': 'Siguiente',
  'ChevronDown': 'Expandir',
  'ChevronUp': 'Contraer',
  
  // CRUD operations
  'Edit': 'Editar',
  'Edit2': 'Editar',
  'Edit3': 'Editar',
  'Trash': 'Eliminar',
  'Trash2': 'Eliminar',
  'Plus': 'Añadir',
  'PlusCircle': 'Añadir',
  'Save': 'Guardar',
  'Check': 'Confirmar',
  'CheckCircle': 'Confirmar',
  
  // View actions
  'Eye': 'Ver',
  'EyeOff': 'Ocultar',
  'Search': 'Buscar',
  'Filter': 'Filtrar',
  'Download': 'Descargar',
  'Upload': 'Subir',
  'Copy': 'Copiar',
  'ExternalLink': 'Abrir enlace',
  
  // Media controls
  'Play': 'Reproducir',
  'Pause': 'Pausar',
  'RotateCcw': 'Reiniciar',
  'RefreshCw': 'Actualizar',
  
  // Navigation
  'Menu': 'Menú',
  'MoreVertical': 'Más opciones',
  'MoreHorizontal': 'Más opciones',
  'Settings': 'Configuración',
  'Info': 'Información',
  'HelpCircle': 'Ayuda',
  
  // Files and documents
  'File': 'Archivo',
  'FileText': 'Documento',
  'Folder': 'Carpeta',
  'FolderOpen': 'Abrir carpeta',
  
  // Calendar and time
  'Calendar': 'Calendario',
  'Clock': 'Hora',
  
  // Communication
  'Mail': 'Correo',
  'MessageCircle': 'Mensaje',
  'Bell': 'Notificaciones',
  
  // Status
  'AlertCircle': 'Alerta',
  'AlertTriangle': 'Advertencia',
  'Loader': 'Cargando',
  'Loader2': 'Cargando',
};

function findIconName(buttonContent) {
  // Try to find icon component name
  const iconMatch = buttonContent.match(/<([A-Z][a-zA-Z0-9]*)\s*[^>]*\/>/);
  if (iconMatch) {
    return iconMatch[1];
  }
  
  // Try self-closing with attributes
  const iconMatch2 = buttonContent.match(/<([A-Z][a-zA-Z0-9]*)\s+[^>]*\/>/);
  if (iconMatch2) {
    return iconMatch2[1];
  }
  
  return null;
}

function generateAriaLabel(iconName, context = '') {
  // Use predefined label if available
  if (ICON_LABELS[iconName]) {
    return ICON_LABELS[iconName];
  }
  
  // Try to infer from context (onClick handler name)
  if (context.includes('close') || context.includes('Close')) return 'Cerrar';
  if (context.includes('edit') || context.includes('Edit')) return 'Editar';
  if (context.includes('delete') || context.includes('Delete') || context.includes('remove')) return 'Eliminar';
  if (context.includes('add') || context.includes('Add') || context.includes('create')) return 'Añadir';
  if (context.includes('save') || context.includes('Save')) return 'Guardar';
  if (context.includes('cancel') || context.includes('Cancel')) return 'Cancelar';
  if (context.includes('search') || context.includes('Search')) return 'Buscar';
  if (context.includes('filter') || context.includes('Filter')) return 'Filtrar';
  if (context.includes('download') || context.includes('Download')) return 'Descargar';
  if (context.includes('upload') || context.includes('Upload')) return 'Subir';
  if (context.includes('view') || context.includes('View')) return 'Ver';
  if (context.includes('open') || context.includes('Open')) return 'Abrir';
  if (context.includes('expand') || context.includes('Expand')) return 'Expandir';
  if (context.includes('collapse') || context.includes('Collapse')) return 'Contraer';
  if (context.includes('next') || context.includes('Next')) return 'Siguiente';
  if (context.includes('prev') || context.includes('Previous') || context.includes('back')) return 'Anterior';
  
  // Default fallback
  return `Acción con ${iconName}`;
}

function addAriaLabelToButton(fileContent, filePath) {
  let modified = false;
  let count = 0;
  
  // Match button elements with icons but no aria-label
  const buttonRegex = /<button([^>]*?)>([\s\S]*?)<\/button>/g;
  
  let result = fileContent.replace(buttonRegex, (match, attributes, content) => {
    // Skip if already has aria-label or aria-labelledby
    if (attributes.includes('aria-label') || attributes.includes('aria-labelledby')) {
      return match;
    }
    
    // Check if button contains only icon (no text)
    const hasText = content.trim().split(/\s+/).some(word => 
      word.length > 2 && 
      !word.startsWith('<') && 
      !word.match(/^[{}\[\]().,;:'"]+$/)
    );
    
    if (hasText) {
      return match; // Has text, doesn't need aria-label
    }
    
    // Check if has icon
    const iconName = findIconName(content);
    if (!iconName) {
      return match; // No icon found
    }
    
    // Extract onClick handler for context
    const onClickMatch = attributes.match(/onClick=\{([^}]+)\}/);
    const context = onClickMatch ? onClickMatch[1] : '';
    
    // Generate appropriate aria-label
    const ariaLabel = generateAriaLabel(iconName, context);
    
    // Add aria-label to button
    const newAttributes = attributes.trim() 
      ? `${attributes.trim()} aria-label="${ariaLabel}"`
      : ` aria-label="${ariaLabel}"`;
    
    modified = true;
    count++;
    
    return `<button${newAttributes}>${content}</button>`;
  });
  
  return { content: result, modified, count };
}

function processFile(filePath, dryRun = false) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { file: filePath, error: 'File not found' };
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const result = addAriaLabelToButton(content, filePath);
  
  if (result.modified && !dryRun) {
    fs.writeFileSync(fullPath, result.content, 'utf8');
  }
  
  return {
    file: filePath,
    count: result.count,
    modified: result.modified
  };
}

function findFilesNeedingAriaLabels() {
  const { execSync } = require('child_process');
  const srcPath = path.join(__dirname, '..', 'src');
  
  try {
    // Find files with button elements
    const output = execSync(
      `grep -rl "<button" ${srcPath} --include="*.tsx" --include="*.ts" || true`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    return output
      .split('\n')
      .filter(Boolean)
      .map(f => path.relative(path.join(__dirname, '..'), f));
  } catch (error) {
    console.error('Error finding files:', error.message);
    return [];
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1];

console.log('♿ Add aria-label to Icon-Only Buttons');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No files will be modified\n');
}

console.log('Finding files with button elements...\n');
let files = findFilesNeedingAriaLabels();

if (limit) {
  const limitNum = parseInt(limit, 10);
  console.log(`⚠️  Limiting to first ${limitNum} files\n`);
  files = files.slice(0, limitNum);
}

console.log(`Found ${files.length} files to process\n`);

let totalLabels = 0;
let filesModified = 0;

files.forEach(file => {
  const result = processFile(file, dryRun);
  
  if (result.count > 0) {
    filesModified++;
    totalLabels += result.count;
    console.log(`✓ ${file} (${result.count} label(s) added)`);
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📊 Summary:`);
console.log(`   Files processed: ${files.length}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total aria-labels added: ${totalLabels}`);

if (dryRun) {
  console.log('\n💡 Run without --dry-run to apply changes');
} else if (filesModified > 0) {
  console.log('\n✅ aria-labels added to icon-only buttons!');
  console.log('\n💡 Next steps:');
  console.log('   1. Review changes with: git diff');
  console.log('   2. Test with screen reader');
  console.log('   3. Run accessibility test: npm run test:accessibility');
} else {
  console.log('\n✨ No buttons needed aria-labels!');
}

console.log('');
