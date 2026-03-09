#!/usr/bin/env node
/**
 * Fix remaining dark theme violations
 * Targets the specific remaining dark theme patterns
 */

const fs = require('fs');
const path = require('path');

// Fixes for remaining dark theme patterns
const DARK_THEME_CLEANUP = [
  {
    pattern: /bg-brand-navy(-dark)?/g,
    replacement: 'btn-primary-horizon',
    description: 'Replace brand-navy buttons with ATLAS primary button'
  },
  {
    pattern: /hover:bg-brand-navy-dark/g,
    replacement: '',
    description: 'Remove dark hover states (included in ATLAS buttons)'
  },
  {
    pattern: /hover:bg-brand-navy\/90/g,
    replacement: '',
    description: 'Remove brand-navy hover states (included in ATLAS buttons)'
  },
  {
    pattern: /hover:bg-brand-navy/g,
    replacement: '',
    description: 'Remove brand-navy hover states (included in ATLAS buttons)'
  },
  {
    pattern: /text-white/g,
    replacement: '',
    description: 'Remove redundant text-white (included in ATLAS buttons)'
  },
  {
    pattern: /px-\d+ py-\d+/g,
    replacement: '',
    description: 'Remove redundant padding (included in ATLAS buttons)'
  }
];

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let updatedContent = content;
  let changes = 0;

  for (const fix of DARK_THEME_CLEANUP) {
    const matches = updatedContent.match(fix.pattern);
    if (matches) {
      updatedContent = updatedContent.replace(fix.pattern, fix.replacement);
      changes += matches.length;
      console.log(`  ✓ ${fix.description}: ${matches.length} replacements`);
    }
  }

  // Clean up extra spaces in className
  updatedContent = updatedContent.replace(/className="([^"]*?)\s+\s+([^"]*?)"/g, 'className="$1 $2"');
  updatedContent = updatedContent.replace(/className="\s+([^"]*?)"/g, 'className="$1"');
  updatedContent = updatedContent.replace(/className="([^"]*?)\s+"/g, 'className="$1"');

  if (changes > 0) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`📝 Updated ${filePath} - ${changes} dark theme patterns fixed`);
    return changes;
  }
  
  return 0;
}

function main() {
  console.log('🌞 ATLAS Dark Theme Final Cleanup');
  console.log('==================================');
  
  // Target the specific files that have dark theme errors
  const targetFiles = [
    'src/components/personal/nomina/NominaForm.tsx',
    'src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx',
    'src/modules/horizon/financiacion/components/blocks/IdentificacionBlock.tsx',
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
      }
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  }
  
  console.log('\n✅ Dark theme cleanup complete!');
  console.log(`📊 ${filesChanged} files updated with ${totalChanges} fixes`);
  
  return totalChanges > 0 ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main, fixFile };