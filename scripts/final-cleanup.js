#!/usr/bin/env node
/**
 * Final ATLAS Error Cleanup
 * Fixes the very last remaining errors
 */

const fs = require('fs');
const path = require('path');

// Final cleanup patterns
const FINAL_FIXES = [
  {
    pattern: /text-atlas-blue hover:text-atlas-blue-dark/g,
    replacement: 'btn-ghost-horizon',
    description: 'Replace atlas-blue-dark hover with ATLAS ghost button'
  },
  {
    pattern: /bg-atlas-blue.*hover:bg-atlas-blue-dark/g,
    replacement: 'btn-primary-horizon',
    description: 'Replace atlas-blue-dark hover with ATLAS primary button'
  },
  {
    pattern: /hover:text-atlas-blue-dark/g,
    replacement: '',
    description: 'Remove atlas-blue-dark hover states'
  },
  {
    pattern: /hover:bg-atlas-blue-dark/g,
    replacement: '',
    description: 'Remove atlas-blue-dark hover states'
  }
];

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let updatedContent = content;
  let changes = 0;

  for (const fix of FINAL_FIXES) {
    const matches = updatedContent.match(fix.pattern);
    if (matches) {
      updatedContent = updatedContent.replace(fix.pattern, fix.replacement);
      changes += matches.length;
      console.log(`  ✓ ${fix.description}: ${matches.length} replacements`);
    }
  }

  // Clean up extra spaces
  updatedContent = updatedContent.replace(/className="([^"]*?)\s+\s+([^"]*?)"/g, 'className="$1 $2"');
  updatedContent = updatedContent.replace(/className="\s+([^"]*?)"/g, 'className="$1"');
  updatedContent = updatedContent.replace(/className="([^"]*?)\s+"/g, 'className="$1"');

  if (changes > 0) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`📝 Updated ${filePath} - ${changes} patterns fixed`);
    return changes;
  }
  
  return 0;
}

function main() {
  console.log('🎯 ATLAS Final Error Cleanup');
  console.log('=============================');
  
  // Target the remaining files with errors
  const targetFiles = [
    'src/modules/horizon/inmuebles/contratos/components/ContractsNuevo.tsx',
    'src/modules/horizon/tesoreria/AccountDetailPage.tsx',
    'src/modules/horizon/tesoreria/TreasuryMainView.tsx',
    'src/modules/horizon/tesoreria/components/NewTransferModal.tsx'
  ];
  
  let totalChanges = 0;
  let filesChanged = 0;
  
  for (const file of targetFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      console.log(`\n🔧 Processing ${file}...`);
      const changes = fixFile(fullPath);
      if (changes > 0) {
        totalChanges += changes;
        filesChanged++;
      } else {
        console.log('  No changes needed');
      }
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  }
  
  console.log('\n✅ Final cleanup complete!');
  console.log(`📊 ${filesChanged} files updated with ${totalChanges} fixes`);
  
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main, fixFile };