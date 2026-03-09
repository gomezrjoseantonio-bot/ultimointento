#!/usr/bin/env node
/**
 * Replace hardcoded colors with ATLAS tokens
 * Maps common hex/rgb colors to CSS variables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color mapping: hardcoded → ATLAS token
const COLOR_MAPPINGS = {
  // ATLAS primary colors
  '#042C5E': 'var(--atlas-blue)',
  '#042c5e': 'var(--atlas-blue)',
  '#0B2B5C': 'var(--atlas-blue)',
  '#0b2b5c': 'var(--atlas-blue)',
  '#022D5E': 'var(--atlas-blue)',
  '#022d5e': 'var(--atlas-blue)',
  '#0A2A57': 'var(--atlas-blue)',
  '#0a2a57': 'var(--atlas-blue)',
  '#033A73': 'var(--atlas-blue)',
  '#033a73': 'var(--atlas-blue)',
  
  // ATLAS text and neutrals
  '#303A4C': 'var(--atlas-navy-1)',
  '#303a4c': 'var(--atlas-navy-1)',
  '#6C757D': 'var(--text-gray)',
  '#6c757d': 'var(--text-gray)',
  '#6B7280': 'var(--text-gray)',
  '#6b7280': 'var(--text-gray)',
  
  // ATLAS backgrounds
  '#F8F9FA': 'var(--bg)',
  '#f8f9fa': 'var(--bg)',
  '#FFFFFF': '#FFFFFF', // White is OK to keep
  '#ffffff': '#FFFFFF',
  
  // Grays and neutrals (map to ATLAS neutrals)
  '#F3F4F6': 'var(--hz-neutral-100)',
  '#f3f4f6': 'var(--hz-neutral-100)',
  '#F9FAFB': 'var(--hz-neutral-100)',
  '#f9fafb': 'var(--hz-neutral-100)',
  '#F0F4F9': 'var(--hz-neutral-100)',
  '#f0f4f9': 'var(--hz-neutral-100)',
  '#E5E7EB': 'var(--hz-neutral-300)',
  '#e5e7eb': 'var(--hz-neutral-300)',
  '#D7DEE7': 'var(--hz-neutral-300)',
  '#d7dee7': 'var(--hz-neutral-300)',
  '#D1D5DB': 'var(--hz-neutral-300)',
  '#d1d5db': 'var(--hz-neutral-300)',
  '#9CA3AF': 'var(--text-gray)',
  '#9ca3af': 'var(--text-gray)',
  
  // Success colors
  '#10B981': 'var(--ok)',
  '#10b981': 'var(--ok)',
  '#28A745': 'var(--ok)',
  '#28a745': 'var(--ok)',
  '#D1FAE5': 'rgba(40, 167, 69, 0.1)', // Success background
  '#d1fae5': 'rgba(40, 167, 69, 0.1)',
  
  // Warning colors
  '#F59E0B': 'var(--warn)',
  '#f59e0b': 'var(--warn)',
  '#FFC107': 'var(--warn)',
  '#ffc107': 'var(--warn)',
  
  // Error colors
  '#DC3545': 'var(--error)',
  '#dc3545': 'var(--error)',
  '#EF4444': 'var(--error)',
  '#ef4444': 'var(--error)',
  '#DC2626': 'var(--error)',
  '#dc2626': 'var(--error)',
  
  // Info colors
  '#0A84FF': 'var(--atlas-blue)',
  '#0a84ff': 'var(--atlas-blue)',
  '#F0F9FF': 'rgba(4, 44, 94, 0.05)', // Info background
  '#f0f9ff': 'rgba(4, 44, 94, 0.05)',
  '#BAE6FD': 'rgba(4, 44, 94, 0.1)',
  '#bae6fd': 'rgba(4, 44, 94, 0.1)',
  '#8CA4CE': 'rgba(4, 44, 94, 0.3)',
  '#8ca4ce': 'rgba(4, 44, 94, 0.3)',
};

// RGB mappings (less common but important)
const RGB_MAPPINGS = {
  'rgb(4, 44, 94)': 'var(--atlas-blue)',
  'rgb(4,44,94)': 'var(--atlas-blue)',
  'rgb(48, 58, 76)': 'var(--atlas-navy-1)',
  'rgb(48,58,76)': 'var(--atlas-navy-1)',
  'rgb(108, 117, 125)': 'var(--text-gray)',
  'rgb(108,117,125)': 'var(--text-gray)',
  'rgb(248, 249, 250)': 'var(--bg)',
  'rgb(248,249,250)': 'var(--bg)',
  'rgb(40, 167, 69)': 'var(--ok)',
  'rgb(40,167,69)': 'var(--ok)',
  'rgb(255, 193, 7)': 'var(--warn)',
  'rgb(255,193,7)': 'var(--warn)',
  'rgb(220, 53, 69)': 'var(--error)',
  'rgb(220,53,69)': 'var(--error)',
};

function replaceColorsInFile(filePath, dryRun = false) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { replaced: 0, file: filePath, error: 'File not found' };
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  let replacementCount = 0;
  const replacements = [];
  
  // Replace hex colors
  Object.entries(COLOR_MAPPINGS).forEach(([hex, token]) => {
    // Match hex in various contexts but avoid CSS variables
    const regex = new RegExp(
      `(['"\`])${hex.replace(/[#]/g, '\\$&')}\\1|` + // In quotes
      `(?<=[:\\s])${hex.replace(/[#]/g, '\\$&')}(?=[;\\s,})])`, // Without quotes
      'gi'
    );
    
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      replacements.push({ from: hex, to: token, count: matches.length });
      content = content.replace(regex, (match) => {
        replacementCount++;
        // Preserve quotes if present
        if (match.startsWith('"') || match.startsWith("'") || match.startsWith('`')) {
          return match[0] + token + match[0];
        }
        return token;
      });
    }
  });
  
  // Replace RGB colors
  Object.entries(RGB_MAPPINGS).forEach(([rgb, token]) => {
    const regex = new RegExp(rgb.replace(/[()]/g, '\\$&'), 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      replacements.push({ from: rgb, to: token, count: matches.length });
      content = content.replace(regex, token);
      replacementCount += matches.length;
    }
  });
  
  if (!dryRun && content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  
  return {
    file: filePath,
    replaced: replacementCount,
    replacements,
    changed: content !== originalContent
  };
}

function findFilesWithHardcodedColors() {
  const srcPath = path.join(__dirname, '..', 'src');
  const output = execSync(
    `grep -rl "#[0-9A-Fa-f]\\{6\\}\\|rgb(" ${srcPath} --include="*.tsx" --include="*.ts" || true`,
    { encoding: 'utf8' }
  );
  
  return output
    .split('\n')
    .filter(Boolean)
    .map(f => path.relative(path.join(__dirname, '..'), f));
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

console.log('🎨 ATLAS Color Token Replacer');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No files will be modified\n');
}

console.log('Finding files with hardcoded colors...\n');
const files = findFilesWithHardcodedColors();

console.log(`Found ${files.length} files with hardcoded colors\n`);

let totalReplacements = 0;
let filesModified = 0;

files.forEach(file => {
  const result = replaceColorsInFile(file, dryRun);
  
  if (result.replaced > 0) {
    filesModified++;
    totalReplacements += result.replaced;
    
    if (verbose) {
      console.log(`📄 ${file}`);
      console.log(`   ${result.replaced} replacements:`);
      result.replacements.forEach(r => {
        console.log(`     ${r.from} → ${r.to} (${r.count}x)`);
      });
      console.log('');
    } else {
      console.log(`✓ ${file} (${result.replaced} replacements)`);
    }
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📊 Summary:`);
console.log(`   Files processed: ${files.length}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);

if (dryRun) {
  console.log('\n💡 Run without --dry-run to apply changes');
} else {
  console.log('\n✅ Colors replaced with ATLAS tokens!');
  console.log('\n💡 Next steps:');
  console.log('   1. Review changes with: git diff');
  console.log('   2. Test the app visually');
  console.log('   3. Run ATLAS linter: npm run lint:atlas');
}

console.log('\n');
