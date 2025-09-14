#!/usr/bin/env node
/**
 * ATLAS CI Violations Remediation Script
 * Systematically fixes the 62 identified ATLAS compliance violations
 */

const fs = require('fs');
const path = require('path');

// Specific fixes for the 62 identified violations
const VIOLATION_FIXES = [
  // Dark theme/overlay violations
  {
    pattern: /rgba\(0,\s*0,\s*0,\s*0\.\d+\)/g,
    replacement: 'rgba(156, 163, 175, 0.1)', // Replace with light gray overlay
    description: 'Replace black RGBA overlays with light gray'
  },
  {
    pattern: /bg-opacity-\d+/g,
    replacement: 'bg-opacity-10', // Use minimal light opacity
    description: 'Replace high opacity with minimal light opacity'
  },
  {
    pattern: /hover:bg-atlas-blue-dark/g,
    replacement: 'hover:bg-atlas-blue-700',
    description: 'Replace dark hover states with ATLAS tokens'
  },
  {
    pattern: /bg-atlas-blue-dark/g,
    replacement: 'bg-atlas-blue-700',
    description: 'Replace dark class with ATLAS token'
  },
  
  // Font family violations
  {
    pattern: /fontFamily:\s*'var\(--font-sans\)'/g,
    replacement: "fontFamily: 'Inter, system-ui, -apple-system, sans-serif'",
    description: 'Replace CSS variable fonts with Inter font family'
  },
  {
    pattern: /font-family:\s*var\(--font-sans\)/g,
    replacement: "font-family: 'Inter', system-ui, -apple-system, sans-serif",
    description: 'Replace CSS variable fonts with Inter font family'
  },
  
  // Other dark theme patterns that might be missed
  {
    pattern: /className="([^"]*)\s*dark(?!:)\s*([^"]*)"/g,
    replacement: 'className="$1 light $2"',
    description: 'Replace dark className with light'
  }
];

function getAllFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js']) {
  const files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      // Skip exceptions
      if (fullPath.includes('node_modules') || 
          fullPath.includes('build') || 
          fullPath.includes('dist') || 
          fullPath.includes('.git') ||
          fullPath.includes('design-bible') ||
          fullPath.includes('scripts')) {
        continue;
      }
      
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, extensions));
      } else if (stat.isFile() && extensions.some(ext => fullPath.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

function fixViolationsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const changes = [];
  let totalChanges = 0;
  
  // Apply each fix pattern
  for (const fix of VIOLATION_FIXES) {
    const matches = content.match(fix.pattern);
    if (matches) {
      content = content.replace(fix.pattern, fix.replacement);
      const changeCount = matches.length;
      totalChanges += changeCount;
      changes.push({
        description: fix.description,
        count: changeCount
      });
    }
  }
  
  // Write back if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return { changes, totalChanges };
  }
  
  return null;
}

function main() {
  console.log('🔧 ATLAS CI Violations Remediation');
  console.log('==================================');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  
  console.log(`Processing ${files.length} files...`);
  
  let totalFiles = 0;
  let totalChanges = 0;
  const processedFiles = [];
  
  for (const file of files) {
    const result = fixViolationsInFile(file);
    
    if (result) {
      const relativePath = path.relative(process.cwd(), file);
      processedFiles.push({
        file: relativePath,
        changes: result.changes,
        totalChanges: result.totalChanges
      });
      
      totalFiles++;
      totalChanges += result.totalChanges;
    }
  }
  
  // Report results
  if (processedFiles.length === 0) {
    console.log('✅ No violations found to fix!');
    return 0;
  }
  
  console.log(`\n🔧 Fixed violations in ${totalFiles} files (${totalChanges} total changes):\n`);
  
  for (const { file, changes, totalChanges: fileChanges } of processedFiles) {
    console.log(`📄 ${file} (${fileChanges} changes)`);
    
    for (const change of changes) {
      console.log(`  ✓ ${change.description} (${change.count}x)`);
    }
    
    console.log('');
  }
  
  console.log('💡 Violations fixed:');
  console.log('  - Replaced black RGBA overlays with light gray');
  console.log('  - Fixed bg-opacity classes');
  console.log('  - Replaced dark hover states with ATLAS tokens');
  console.log('  - Fixed font family declarations to use Inter');
  console.log('  - Replaced dark classNames with light alternatives');
  
  console.log(`\n✅ ATLAS violations remediation completed: ${totalChanges} fixes applied`);
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { fixViolationsInFile, VIOLATION_FIXES };