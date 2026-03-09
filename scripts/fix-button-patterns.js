#!/usr/bin/env node
/**
 * ATLAS Button Pattern Fixer
 * Replaces non-standard button patterns with ATLAS-compliant ones
 */

const fs = require('fs');
const path = require('path');

// Map of non-ATLAS patterns to ATLAS patterns
const BUTTON_PATTERNS = [
  // Primary buttons - most common pattern
  {
    pattern: /className=["']([^"']*?)bg-primary-\d+([^"']*?)["']/g,
    replacement: 'className="btn-primary-horizon $1 $2"',
    description: 'Replace bg-primary-* with ATLAS primary button'
  },
  {
    pattern: /className=["']([^"']*?)bg-blue-\d+([^"']*?)["']/g,
    replacement: 'className="btn-primary-horizon $1 $2"',
    description: 'Replace bg-blue-* with ATLAS primary button'
  },
  {
    pattern: /className=["']([^"']*?)bg-indigo-\d+([^"']*?)["']/g,
    replacement: 'className="btn-primary-horizon $1 $2"',
    description: 'Replace bg-indigo-* with ATLAS primary button'
  },
  
  // Secondary/outline buttons
  {
    pattern: /className=["']([^"']*?)border[^"']*border-primary[^"']*?["']/g,
    replacement: 'className="btn-secondary-horizon $1"',
    description: 'Replace border-primary with ATLAS secondary button'
  },
  {
    pattern: /className=["']([^"']*?)border[^"']*border-blue[^"']*?["']/g,
    replacement: 'className="btn-secondary-horizon $1"',
    description: 'Replace border-blue with ATLAS secondary button'
  },
  
  // Success/green buttons
  {
    pattern: /className=["']([^"']*?)bg-green-\d+([^"']*?)["']/g,
    replacement: 'className="btn-accent-horizon $1 $2"',
    description: 'Replace bg-green-* with ATLAS accent button'
  },
  {
    pattern: /className=["']([^"']*?)bg-emerald-\d+([^"']*?)["']/g,
    replacement: 'className="btn-accent-horizon $1 $2"',
    description: 'Replace bg-emerald-* with ATLAS accent button'
  },
  
  // Danger/red buttons
  {
    pattern: /className=["']([^"']*?)bg-red-\d+([^"']*?)["']/g,
    replacement: 'className="btn-danger $1 $2"',
    description: 'Replace bg-red-* with ATLAS danger button'
  },
  
  // Ghost/transparent buttons
  {
    pattern: /className=["']([^"']*?)bg-transparent([^"']*?)text-primary[^"']*?["']/g,
    replacement: 'className="btn-ghost-horizon $1 $2"',
    description: 'Replace transparent primary with ATLAS ghost button'
  },
  {
    pattern: /className=["']([^"']*?)bg-transparent([^"']*?)text-blue[^"']*?["']/g,
    replacement: 'className="btn-ghost-horizon $1 $2"',
    description: 'Replace transparent blue with ATLAS ghost button'
  },
];

// Additional cleanup patterns to remove redundant classes
const CLEANUP_PATTERNS = [
  {
    pattern: /\s+text-white/g,
    replacement: '',
    description: 'Remove redundant text-white (included in ATLAS buttons)'
  },
  {
    pattern: /\s+hover:bg-[^\s]+/g,
    replacement: '',
    description: 'Remove redundant hover states (included in ATLAS buttons)'
  },
  {
    pattern: /\s+transition-colors/g,
    replacement: '',
    description: 'Remove redundant transitions (included in ATLAS buttons)'
  },
  {
    pattern: /\s+rounded-\w+/g,
    replacement: '',
    description: 'Remove redundant border radius (included in ATLAS buttons)'
  }
];

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let updatedContent = content;
  let changes = 0;

  // Apply button pattern fixes
  for (const fix of BUTTON_PATTERNS) {
    const matches = updatedContent.match(fix.pattern);
    if (matches) {
      updatedContent = updatedContent.replace(fix.pattern, fix.replacement);
      changes += matches.length;
      console.log(`  ✓ ${fix.description}: ${matches.length} replacements`);
    }
  }

  // Apply cleanup patterns
  for (const cleanup of CLEANUP_PATTERNS) {
    const beforeLength = updatedContent.length;
    updatedContent = updatedContent.replace(cleanup.pattern, cleanup.replacement);
    const afterLength = updatedContent.length;
    if (beforeLength !== afterLength) {
      console.log(`  ✓ ${cleanup.description}`);
    }
  }

  // Clean up duplicate spaces in className
  updatedContent = updatedContent.replace(/className=["']([^"']*?)\s+\s+([^"']*?)["']/g, 'className="$1 $2"');
  
  if (changes > 0) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`📝 Updated ${filePath} - ${changes} button patterns fixed`);
    return changes;
  }
  
  return 0;
}

function getAllFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js']) {
  const files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      // Skip node_modules, build dirs, etc.
      if (item === 'node_modules' || item === 'build' || item === 'dist' || item === '.git') {
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

function main() {
  console.log('🔧 ATLAS Button Pattern Fixer');
  console.log('==============================');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  
  console.log(`📁 Found ${files.length} files to check...`);
  
  let totalChanges = 0;
  let filesChanged = 0;
  
  for (const file of files) {
    const changes = fixFile(file);
    if (changes > 0) {
      totalChanges += changes;
      filesChanged++;
    }
  }
  
  console.log('\n✅ Button pattern fixing complete!');
  console.log(`📊 ${filesChanged} files updated with ${totalChanges} button pattern fixes`);
  
  if (totalChanges > 0) {
    console.log('\n💡 Next steps:');
    console.log('1. Test your application to ensure buttons still work correctly');
    console.log('2. Run the ATLAS linter: npm run lint:atlas');
    console.log('3. Commit your changes');
  }
  
  return totalChanges > 0 ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main, fixFile };