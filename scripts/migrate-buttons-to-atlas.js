#!/usr/bin/env node
/**
 * ATLAS Button Migration Script
 * Migrates non-standard button patterns to ATLAS button classes
 * 
 * This script will:
 * 1. Detect button elements with Tailwind classes
 * 2. Replace with appropriate ATLAS button classes
 * 3. Preserve existing functionality and event handlers
 * 4. Support dry-run mode for preview
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Button pattern detection and mapping
const BUTTON_PATTERNS = [
  // Primary buttons (blue background)
  {
    regex: /className=["`]([^"`]*\b(?:bg-blue-\d+|bg-\[var\(--atlas-blue\)\]|bg-\[var\(--hz-primary\)\])[^"`]*)["`]/g,
    analyze: (match, classes) => {
      if (classes.includes('atlas-btn-')) return null; // Already ATLAS
      
      // Check if it's destructive
      if (classes.match(/\b(text-red|bg-red-)/)) {
        return { type: 'destructive', size: extractSize(classes) };
      }
      
      // Check if it's ghost/transparent
      if (classes.match(/\bbg-transparent\b/) || classes.match(/\bborder-blue\b/)) {
        return { type: 'secondary', size: extractSize(classes) };
      }
      
      return { type: 'primary', size: extractSize(classes) };
    }
  },
  // Secondary buttons (border, transparent background)
  {
    regex: /className=["`]([^"`]*\b(?:border-blue|border-\[var\(--atlas-blue\)\])[^"`]*bg-transparent[^"`]*)["`]/g,
    analyze: (match, classes) => {
      if (classes.includes('atlas-btn-')) return null;
      return { type: 'secondary', size: extractSize(classes) };
    }
  },
  // Destructive buttons (red)
  {
    regex: /className=["`]([^"`]*\b(?:bg-red-\d+|text-red-\d+)[^"`]*)["`]/g,
    analyze: (match, classes) => {
      if (classes.includes('atlas-btn-')) return null;
      if (classes.match(/\bbg-red-/)) {
        return { type: 'destructive', size: extractSize(classes) };
      }
      return null;
    }
  },
  // Success buttons (green)
  {
    regex: /className=["`]([^"`]*\b(?:bg-green-\d+|bg-\[var\(--ok\)\])[^"`]*)["`]/g,
    analyze: (match, classes) => {
      if (classes.includes('atlas-btn-')) return null;
      return { type: 'success', size: extractSize(classes) };
    }
  },
  // Ghost buttons (minimal styling)
  {
    regex: /className=["`]([^"`]*\b(?:hover:bg-gray-\d+|hover:bg-\[var\(--bg\)\])[^"`]*)["`]/g,
    analyze: (match, classes) => {
      if (classes.includes('atlas-btn-')) return null;
      if (!classes.match(/\bbg-(?!transparent)/)) {
        return { type: 'ghost', size: extractSize(classes) };
      }
      return null;
    }
  }
];

// Legacy button classes to migrate
const LEGACY_PATTERNS = [
  { pattern: /\bbtn-primary-horizon\b/g, replacement: 'atlas-btn-primary' },
  { pattern: /\bbtn-accent-horizon\b/g, replacement: 'atlas-btn-primary' },
  { pattern: /\bbtn-primary\b(?!-)/g, replacement: 'atlas-btn-primary' },
  { pattern: /\bbtn-secondary\b(?!-)/g, replacement: 'atlas-btn-secondary' },
  { pattern: /\bbtn-danger\b/g, replacement: 'atlas-btn-destructive' },
  { pattern: /\bbtn-destructive\b/g, replacement: 'atlas-btn-destructive' },
  { pattern: /\bbtn-success\b/g, replacement: 'atlas-btn-success' },
  { pattern: /\bbtn-ghost\b/g, replacement: 'atlas-btn-ghost' },
];

function extractSize(classes) {
  if (classes.match(/\b(?:text-xs|py-1|px-2)\b/)) return 'sm';
  if (classes.match(/\b(?:text-lg|py-3|px-6)\b/)) return 'lg';
  return null; // default size
}

function buildAtlasClassName(type, size, additionalClasses = '') {
  let atlasClass = `atlas-btn-${type}`;
  if (size) atlasClass += ` atlas-btn-${size}`;
  
  // Preserve non-button-specific classes
  const preserve = additionalClasses
    .split(/\s+/)
    .filter(c => {
      // Keep classes that aren't button styling
      return !c.match(/^(?:bg-|text-white|text-black|border-|rounded|px-|py-|font-|hover:|focus:|transition|shadow|cursor-pointer)/);
    })
    .join(' ');
  
  return preserve ? `${atlasClass} ${preserve}` : atlasClass;
}

function analyzeButtonElement(content, position) {
  // Extract the full button element
  const buttonStart = content.lastIndexOf('<button', position);
  const buttonEnd = content.indexOf('>', position) + 1;
  
  if (buttonStart === -1) return null;
  
  const buttonTag = content.substring(buttonStart, buttonEnd);
  
  // Check for type attribute
  const hasType = buttonTag.match(/type=/);
  const hasOnClick = buttonTag.match(/onClick=/);
  const hasDisabled = buttonTag.match(/disabled/);
  
  return { hasType, hasOnClick, hasDisabled };
}

function migrateButtonsInFile(filePath, dryRun = false) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { replaced: 0, file: filePath, error: 'File not found' };
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  let replacementCount = 0;
  const changes = [];

  // First, replace legacy button classes
  LEGACY_PATTERNS.forEach(({ pattern, replacement }) => {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      content = content.replace(pattern, replacement);
      replacementCount += matches.length;
      changes.push({ from: pattern.source, to: replacement, count: matches.length });
    }
  });

  // Then, migrate Tailwind button patterns
  BUTTON_PATTERNS.forEach(({ regex, analyze }) => {
    const matches = [...content.matchAll(regex)];
    
    matches.forEach(match => {
      const fullMatch = match[0];
      const classes = match[1];
      
      const analysis = analyze(fullMatch, classes);
      if (!analysis) return;
      
      const newClassName = buildAtlasClassName(analysis.type, analysis.size, classes);
      const replacement = fullMatch.replace(classes, newClassName);
      
      content = content.replace(fullMatch, replacement);
      replacementCount++;
      changes.push({ 
        from: classes.substring(0, 50) + '...', 
        to: newClassName,
        type: analysis.type 
      });
    });
  });

  if (!dryRun && content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  return {
    file: filePath,
    replaced: replacementCount,
    changes,
    changed: content !== originalContent
  };
}

function findFilesWithButtonPatterns() {
  const srcPath = path.join(__dirname, '..', 'src');
  
  try {
    // Find files with button elements and non-ATLAS classes
    const output = execSync(
      `grep -rl "<button" ${srcPath} --include="*.tsx" --include="*.ts" | xargs grep -l "className=" | grep -v "atlas-btn-" || true`,
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
const verbose = args.includes('--verbose');
const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1];

console.log('🔘 ATLAS Button Migration Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No files will be modified\n');
}

console.log('Finding files with button patterns...\n');
let files = findFilesWithButtonPatterns();

if (limit) {
  const limitNum = parseInt(limit, 10);
  console.log(`⚠️  Limiting to first ${limitNum} files\n`);
  files = files.slice(0, limitNum);
}

console.log(`Found ${files.length} files with potential button migrations\n`);

let totalReplacements = 0;
let filesModified = 0;

files.forEach(file => {
  const result = migrateButtonsInFile(file, dryRun);
  
  if (result.replaced > 0) {
    filesModified++;
    totalReplacements += result.replaced;
    
    if (verbose) {
      console.log(`📄 ${file}`);
      console.log(`   ${result.replaced} button(s) migrated:`);
      result.changes.forEach(c => {
        console.log(`     ${c.from} → ${c.to} ${c.type ? `(${c.type})` : ''}`);
      });
      console.log('');
    } else {
      console.log(`✓ ${file} (${result.replaced} button(s))`);
    }
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📊 Summary:`);
console.log(`   Files scanned: ${files.length}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total migrations: ${totalReplacements}`);

if (dryRun) {
  console.log('\n💡 Run without --dry-run to apply changes');
} else if (filesModified > 0) {
  console.log('\n✅ Buttons migrated to ATLAS classes!');
  console.log('\n💡 Next steps:');
  console.log('   1. Review changes with: git diff');
  console.log('   2. Test affected components visually');
  console.log('   3. Run ATLAS linter: npm run lint:atlas');
  console.log('   4. Run tests: npm test');
} else {
  console.log('\n✨ No button migrations needed - all buttons are ATLAS compliant!');
}

console.log('\n');
