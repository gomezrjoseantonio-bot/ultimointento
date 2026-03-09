#!/usr/bin/env node
/**
 * Color Normalization Script
 * Systematically replaces inconsistent color usage with standardized design tokens
 */

const fs = require('fs');
const path = require('path');

// Color mapping from old inconsistent colors to new semantic colors
const COLOR_MAPPINGS = {
  // PRIMARY/BLUE STANDARDIZATION
  // Light backgrounds and subtle highlights
  'bg-blue-50': 'bg-primary-50',
  'border-blue-200': 'border-primary-200',
  
  // Medium backgrounds and borders
  'bg-blue-100': 'bg-primary-100',
  'border-blue-300': 'border-primary-300',
  
  // Default primary colors
  'bg-blue-500': 'bg-primary-500',
  'bg-blue-600': 'bg-primary-600',
  'bg-blue-700': 'bg-primary-700',
  'text-blue-500': 'text-primary-500',
  'text-blue-600': 'text-primary-600',
  'text-blue-700': 'text-primary-700',
  'border-blue-500': 'border-primary-500',
  'border-blue-600': 'border-primary-600',
  
  // Strong emphasis
  'text-blue-800': 'text-primary-800',
  'text-blue-900': 'text-primary-900',
  'border-blue-900': 'border-primary-900',
  
  // Hover and focus states (keep blue for now, but use consistent shades)
  'hover:bg-blue-700': 'hover:bg-primary-700',
  'hover:text-blue-900': 'hover:text-primary-900',
  'focus:border-blue-500': 'focus:border-primary-500',
  'focus:ring-blue-500': 'focus:ring-primary-500',
  'focus:ring-blue-200': 'focus:ring-primary-200',
  
  // SUCCESS/GREEN STANDARDIZATION
  'bg-green-50': 'bg-success-50',
  'bg-green-100': 'bg-success-100',
  'bg-green-500': 'bg-success-500',
  'bg-green-600': 'bg-success-600',
  'bg-green-700': 'bg-success-700',
  'text-green-500': 'text-success-500',
  'text-green-600': 'text-success-600',
  'text-green-700': 'text-success-700',
  'text-green-800': 'text-success-800',
  'text-green-900': 'text-success-900',
  'border-green-200': 'border-success-200',
  'border-green-500': 'border-success-500',
  'hover:text-green-900': 'hover:text-success-900',
  'hover:text-green-800': 'hover:text-success-800',
  'focus:border-green-500': 'focus:border-success-500',
  'focus:ring-green-200': 'focus:ring-success-200',
  
  // ERROR/RED STANDARDIZATION
  'bg-red-50': 'bg-error-50',
  'bg-red-100': 'bg-error-100',
  'bg-red-500': 'bg-error-500',
  'bg-red-600': 'bg-error-600',
  'bg-red-700': 'bg-error-700',
  'text-red-500': 'text-error-500',
  'text-red-600': 'text-error-600',
  'text-red-700': 'text-error-700',
  'text-red-800': 'text-error-800',
  'text-red-900': 'text-error-900',
  'border-red-200': 'border-error-200',
  'border-red-300': 'border-error-300',
  'hover:bg-red-700': 'hover:bg-error-700',
  'hover:text-red-900': 'hover:text-error-900',
  
  // WARNING/YELLOW STANDARDIZATION (for any existing yellow/orange)
  'bg-yellow-50': 'bg-warning-50',
  'bg-yellow-100': 'bg-warning-100',
  'bg-yellow-500': 'bg-warning-500',
  'bg-orange-100': 'bg-warning-100',
  'text-yellow-600': 'text-warning-600',
  'text-yellow-700': 'text-warning-700',
  'text-orange-600': 'text-warning-600',
  
  // SPECIFIC FIXES FOR COMMON PATTERNS
  // Form inputs focus states
  'focus:border-blue-300': 'focus:border-primary-300',
  'focus:ring-2 focus:ring-blue-200': 'focus:ring-2 focus:ring-primary-200',
  'focus:ring-blue-500 focus:border-blue-500': 'focus:ring-primary-500 focus:border-primary-500',
  
  // Button patterns
  'bg-blue-600 text-white': 'bg-primary-600 text-white',
  'hover:bg-blue-700': 'hover:bg-primary-700',
  
  // Status badges and indicators
  'bg-blue-100 text-blue-800': 'bg-primary-100 text-primary-800',
  'bg-green-100 text-green-800': 'bg-success-100 text-success-800',
  'bg-red-100 text-red-800': 'bg-error-100 text-error-800',
};

// Additional context-aware mappings
const CONTEXT_MAPPINGS = {
  // Status indicators
  'pagado': { 'bg-green-100 text-green-800': 'bg-success-100 text-success-800' },
  'cobrado': { 'bg-green-100 text-green-800': 'bg-success-100 text-success-800' },
  'completo': { 'bg-blue-100 text-blue-800': 'bg-success-100 text-success-800' },
  'error': { 'text-red-600': 'text-error-600' },
  'guardado_automatico': { 'text-green-600': 'text-success-600' },
  
  // Document types
  'factura': { 'text-blue-600': 'text-primary-600' },
  'recibo': { 'text-blue-700': 'text-primary-700' },
};

function getAllTsxFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files = files.concat(getAllTsxFiles(fullPath));
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function replaceColorsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  const originalContent = content;
  
  // Apply basic color mappings
  for (const [oldColor, newColor] of Object.entries(COLOR_MAPPINGS)) {
    const regex = new RegExp(oldColor.replace(/([.*+?^${}()|[\]\\])/g, '\\$1'), 'g');
    const newContent = content.replace(regex, newColor);
    if (newContent !== content) {
      const matches = (content.match(regex) || []).length;
      changes += matches;
      content = newContent;
    }
  }
  
  // Apply context-aware mappings
  for (const [context, mappings] of Object.entries(CONTEXT_MAPPINGS)) {
    if (content.toLowerCase().includes(context)) {
      for (const [oldColor, newColor] of Object.entries(mappings)) {
        const regex = new RegExp(oldColor.replace(/([.*+?^${}()|[\]\\])/g, '\\$1'), 'g');
        const newContent = content.replace(regex, newColor);
        if (newContent !== content) {
          const matches = (content.match(regex) || []).length;
          changes += matches;
          content = newContent;
        }
      }
    }
  }
  
  // Write back if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return changes;
  }
  
  return 0;
}

function main() {
  const srcDir = path.join(process.cwd(), 'src');
  console.log('🎨 Starting color normalization...');
  console.log('📁 Scanning directory:', srcDir);
  
  const files = getAllTsxFiles(srcDir);
  console.log(`📄 Found ${files.length} TypeScript/React files`);
  
  let totalChanges = 0;
  let filesChanged = 0;
  
  for (const file of files) {
    const changes = replaceColorsInFile(file);
    if (changes > 0) {
      filesChanged++;
      totalChanges += changes;
      const relativePath = path.relative(srcDir, file);
      console.log(`  ✅ ${relativePath}: ${changes} color replacements`);
    }
  }
  
  console.log('\n🎯 Color normalization complete!');
  console.log(`📊 Summary:`);
  console.log(`   • Files processed: ${files.length}`);
  console.log(`   • Files changed: ${filesChanged}`);
  console.log(`   • Total color replacements: ${totalChanges}`);
  
  if (totalChanges > 0) {
    console.log('\n✨ Next steps:');
    console.log('   1. Review the changes with: git diff');
    console.log('   2. Test the application: npm start');
    console.log('   3. Build to verify: npm run build');
    console.log('   4. Commit changes: git add . && git commit -m "Normalize color system"');
  } else {
    console.log('\n✨ No color inconsistencies found - system already normalized!');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  COLOR_MAPPINGS,
  CONTEXT_MAPPINGS,
  replaceColorsInFile,
  getAllTsxFiles
};