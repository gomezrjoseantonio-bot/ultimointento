#!/usr/bin/env node
/**
 * ATLAS Dark Theme Cleaner
 * Systematically removes dark theme patterns and replaces with ATLAS light themes
 */

const fs = require('fs');
const path = require('path');

// Dark theme patterns to replace with ATLAS light equivalents
const DARK_THEME_FIXES = [
  {
    pattern: /bg-black bg-opacity-50/g,
    replacement: 'bg-gray-200 bg-opacity-75',
    description: 'Replace black modal overlays with light overlays'
  },
  {
    pattern: /bg-black bg-opacity-60/g,
    replacement: 'bg-gray-200 bg-opacity-75',
    description: 'Replace black modal overlays with light overlays'
  },
  {
    pattern: /bg-black bg-opacity-70/g,
    replacement: 'bg-gray-200 bg-opacity-75',
    description: 'Replace black modal overlays with light overlays'
  },
  {
    pattern: /bg-black bg-opacity-75/g,
    replacement: 'bg-gray-200 bg-opacity-75',
    description: 'Replace black modal overlays with light overlays'
  },
  {
    pattern: /bg-black bg-opacity-80/g,
    replacement: 'bg-gray-200 bg-opacity-75',
    description: 'Replace black modal overlays with light overlays'
  },
  {
    pattern: /bg-black bg-opacity-90/g,
    replacement: 'bg-gray-200 bg-opacity-75',
    description: 'Replace black modal overlays with light overlays'
  },
  {
    pattern: /bg-gray-900 bg-opacity-50/g,
    replacement: 'bg-gray-200 bg-opacity-75',
    description: 'Replace dark overlays with light overlays'
  },
  {
    pattern: /bg-gray-800/g,
    replacement: 'bg-gray-100',
    description: 'Replace dark backgrounds with light backgrounds'
  },
  {
    pattern: /bg-gray-900/g,
    replacement: 'bg-gray-50',
    description: 'Replace darkest backgrounds with lightest backgrounds'
  },
  {
    pattern: /className="([^"]*)\s*dark:([^"]*)"(\s*>)/g,
    replacement: 'className="$1"$3',
    description: 'Remove dark: prefixed classes'
  },
  {
    pattern: /className="([^"]*\s+)dark:([^"\s]+)([^"]*)"/g,
    replacement: 'className="$1$3"',
    description: 'Remove dark: classes from className'
  }
];

function getAllFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js', '.css']) {
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
          fullPath.includes('.git')) {
        continue;
      }
      
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, extensions));
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}:`, error.message);
  }
  
  return files;
}

function fixDarkThemesInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let totalChanges = 0;
  const changes = [];
  
  for (const fix of DARK_THEME_FIXES) {
    const matches = content.match(fix.pattern);
    if (matches) {
      content = content.replace(fix.pattern, fix.replacement);
      totalChanges += matches.length;
      changes.push({
        description: fix.description,
        count: matches.length
      });
    }
  }
  
  if (totalChanges > 0) {
    fs.writeFileSync(filePath, content);
    return { changes, totalChanges };
  }
  
  return null;
}

function main() {
  console.log('🌟 ATLAS Dark Theme Cleaner');
  console.log('============================');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  
  console.log(`Checking ${files.length} files...`);
  
  let totalFiles = 0;
  let totalChanges = 0;
  const processedFiles = [];
  
  for (const file of files) {
    const result = fixDarkThemesInFile(file);
    
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
    console.log('✅ No dark theme violations found!');
    return 0;
  }
  
  console.log(`\n🔧 Fixed dark themes in ${totalFiles} files (${totalChanges} total changes):\n`);
  
  for (const { file, changes, totalChanges: fileChanges } of processedFiles) {
    console.log(`📄 ${file} (${fileChanges} changes)`);
    
    for (const change of changes) {
      console.log(`  ✓ ${change.description} (${change.count}x)`);
    }
    
    console.log('');
  }
  
  console.log('💡 Changes made:');
  console.log('  - Replaced black overlays with light gray overlays');
  console.log('  - Replaced dark backgrounds with light alternatives');
  console.log('  - Removed dark: prefixed Tailwind classes');
  
  console.log(`\n✅ Dark theme cleanup completed: ${totalChanges} violations fixed`);
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { fixDarkThemesInFile, DARK_THEME_FIXES };