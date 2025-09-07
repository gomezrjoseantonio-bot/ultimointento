#!/usr/bin/env node
/**
 * Enhanced Hex Color Normalization Script
 * Replaces hardcoded hex colors with Atlas design tokens
 */

const fs = require('fs');
const path = require('path');

// Hex color mappings to Atlas design tokens
const HEX_COLOR_MAPPINGS = {
  // Atlas Brand Colors
  '#0E2A47': 'brand-navy',        // Official ATLAS navy
  '#00B8C4': 'brand-teal',        // Official ATLAS teal (Pulse only)
  
  // Horizon Design System
  '#0F2C5C': 'hz-primary',        // Official Horizon primary
  '#1E3A8A': 'hz-primary-600',    // Official Horizon hover
  '#F7F9FC': 'hz-bg',             // Official Horizon background
  '#0B1220': 'hz-text',           // Official Horizon text
  
  // Semantic Colors
  '#16A34A': 'success-500',       // Success green
  '#059669': 'success-600',       // Success hover
  '#DC2626': 'error-500',         // Error red  
  '#EAB308': 'warning-500',       // Warning yellow
  '#F59E0B': 'warning-600',       // Warning hover
  '#2563EB': 'info-500',          // Info blue
  
  // Neutral Colors
  '#FFFFFF': 'white',
  '#F8FAFC': 'neutral-50',
  '#F1F5F9': 'neutral-100',
  '#E2E8F0': 'neutral-200',
  '#CBD5E1': 'neutral-300',
  '#94A3B8': 'neutral-400',
  '#64748B': 'neutral-500',
  '#475569': 'neutral-600',
  '#334155': 'neutral-700',
  '#1E293B': 'neutral-800',
  '#0F172A': 'neutral-900',
  '#6B7280': 'gray-500',
  '#374151': 'gray-700',
  '#111827': 'gray-900',
  '#9CA3AF': 'gray-400',
  '#D1D5DB': 'gray-300',
  
  // Legacy colors that should map to new system
  '#10B981': 'success-500',       // Old green
  '#EF4444': 'error-500',         // Old red
  '#F59E0B': 'warning-500',       // Old amber
  '#3B82F6': 'primary-500',       // Old blue
  '#6366F1': 'indigo-500',        // Indigo
  '#8B5CF6': 'purple-500',        // Purple
  
  // Common variations
  '#022D5E': 'primary-700',       // Dark blue variant
  '#0D2B52': 'primary-800',       // Very dark blue
  '#35C0CF': 'teal-400',          // Light teal variant
};

// Tailwind class patterns for hex colors
const TAILWIND_HEX_PATTERNS = [
  // Text colors
  { pattern: /text-\[#([0-9A-Fa-f]{6})\]/g, prefix: 'text-' },
  // Background colors
  { pattern: /bg-\[#([0-9A-Fa-f]{6})\]/g, prefix: 'bg-' },
  // Border colors
  { pattern: /border-\[#([0-9A-Fa-f]{6})\]/g, prefix: 'border-' },
  // Ring colors
  { pattern: /ring-\[#([0-9A-Fa-f]{6})\]/g, prefix: 'ring-' },
  // From colors (gradients)
  { pattern: /from-\[#([0-9A-Fa-f]{6})\]/g, prefix: 'from-' },
  // To colors (gradients)
  { pattern: /to-\[#([0-9A-Fa-f]{6})\]/g, prefix: 'to-' },
];

// CSS hex color patterns
const CSS_HEX_PATTERNS = [
  // CSS color properties
  { pattern: /color:\s*#([0-9A-Fa-f]{6})/g, property: 'color' },
  { pattern: /background-color:\s*#([0-9A-Fa-f]{6})/g, property: 'background-color' },
  { pattern: /border-color:\s*#([0-9A-Fa-f]{6})/g, property: 'border-color' },
  { pattern: /background:\s*#([0-9A-Fa-f]{6})/g, property: 'background' },
];

function getAllFiles(dir, extensions = ['.tsx', '.ts', '.css', '.scss']) {
  let files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files = files.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function normalizeHexColorsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  const originalContent = content;
  
  // Process Tailwind hex colors
  for (const { pattern, prefix } of TAILWIND_HEX_PATTERNS) {
    content = content.replace(pattern, (match, hex) => {
      const fullHex = `#${hex.toUpperCase()}`;
      const tokenColor = HEX_COLOR_MAPPINGS[fullHex];
      
      if (tokenColor) {
        changes++;
        console.log(`  ${path.basename(filePath)}: ${match} → ${prefix}${tokenColor}`);
        return `${prefix}${tokenColor}`;
      }
      
      return match; // Keep original if no mapping found
    });
  }
  
  // Process CSS hex colors (for CSS/SCSS files or style props)
  for (const { pattern, property } of CSS_HEX_PATTERNS) {
    content = content.replace(pattern, (match, hex) => {
      const fullHex = `#${hex.toUpperCase()}`;
      const tokenColor = HEX_COLOR_MAPPINGS[fullHex];
      
      if (tokenColor) {
        changes++;
        console.log(`  ${path.basename(filePath)}: ${match} → ${property}: var(--${tokenColor})`);
        return `${property}: var(--${tokenColor})`;
      }
      
      return match; // Keep original if no mapping found
    });
  }
  
  // Write back if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  return changes;
}

function main() {
  const srcDir = path.join(process.cwd(), 'src');
  console.log('🎨 Starting hex color normalization...');
  console.log('📁 Scanning directory:', srcDir);
  
  const files = getAllFiles(srcDir);
  console.log(`📄 Found ${files.length} files to process`);
  
  let totalChanges = 0;
  let filesChanged = 0;
  
  for (const file of files) {
    const changes = normalizeHexColorsInFile(file);
    if (changes > 0) {
      filesChanged++;
      totalChanges += changes;
    }
  }
  
  console.log('\n🎯 Hex color normalization complete!');
  console.log(`📊 Summary:`);
  console.log(`   • Files processed: ${files.length}`);
  console.log(`   • Files changed: ${filesChanged}`);
  console.log(`   • Total hex color replacements: ${totalChanges}`);
  
  if (totalChanges > 0) {
    console.log('\n✨ Next steps:');
    console.log('   1. Review the changes with: git diff');
    console.log('   2. Test the application: npm start');
    console.log('   3. Build to verify: npm run build');
  } else {
    console.log('\n✨ No hardcoded hex colors found - system already normalized!');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  HEX_COLOR_MAPPINGS,
  TAILWIND_HEX_PATTERNS,
  CSS_HEX_PATTERNS,
  normalizeHexColorsInFile,
  getAllFiles
};