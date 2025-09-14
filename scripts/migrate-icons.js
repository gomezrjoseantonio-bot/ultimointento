#!/usr/bin/env node
/**
 * ATLAS Heroicons to Lucide Migration Script
 * Automatically replaces Heroicons imports with Lucide equivalents
 */

const fs = require('fs');
const path = require('path');

// Heroicons to Lucide mapping - ATLAS requires Lucide only
const ICON_MAPPING = {
  // Navigation & Actions
  'ArrowLeftIcon': 'ArrowLeft',
  'PlusIcon': 'Plus',
  'PencilIcon': 'Pencil', 
  'TrashIcon': 'Trash2',
  'EyeIcon': 'Eye',
  'MagnifyingGlassIcon': 'Search',
  'CheckIcon': 'Check',
  'CheckCircleIcon': 'CheckCircle',
  'XMarkIcon': 'X',
  
  // Documents & Content
  'DocumentIcon': 'FileText',
  'ClipboardDocumentIcon': 'Clipboard',
  'DocumentTextIcon': 'FileText',
  'DocumentChartBarIcon': 'BarChart3',
  
  // Interface Elements
  'InformationCircleIcon': 'Info',
  'ExclamationTriangleIcon': 'AlertTriangle',
  'ClockIcon': 'Clock',
  
  // Business & Finance
  'CurrencyEuroIcon': 'Euro',
  'CalculatorIcon': 'Calculator',
  
  // Location & Buildings
  'MapPinIcon': 'MapPin',
  'BuildingOfficeIcon': 'Building2',
  'HomeIcon': 'Home',
  
  // Misc
  'HashtagIcon': 'Hash',
  'CalendarIcon': 'Calendar',
};

// Files to update (from our analysis)
const TARGET_FILES = [
  'src/modules/horizon/inmuebles/cartera/PropertyDetail.tsx',
  'src/modules/horizon/inmuebles/cartera/Cartera.tsx',
  'src/components/inmuebles/Step3Coste.tsx',
  'src/components/inmuebles/InmuebleWizardLayout.tsx',
  'src/components/inmuebles/InmuebleResumen.tsx',
  'src/components/inmuebles/Step4Fiscalidad.tsx',
  'src/components/inmuebles/Step1Identificacion.tsx',
  'src/components/inmuebles/Step2Caracteristicas.tsx',
];

function migrateFile(filePath) {
  console.log(`Migrating ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  // Replace import statements
  const heroiconsImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@heroicons\/react\/24\/(outline|solid)['"];?/g;
  
  content = content.replace(heroiconsImportRegex, (match, icons, type) => {
    changes++;
    const iconList = icons.split(',').map(icon => icon.trim());
    const lucideIcons = iconList.map(icon => {
      const lucideName = ICON_MAPPING[icon];
      if (!lucideName) {
        console.warn(`  ⚠️  No mapping found for ${icon}, keeping as-is`);
        return icon;
      }
      return lucideName;
    });
    
    return `import { ${lucideIcons.join(', ')} } from 'lucide-react';`;
  });
  
  // Replace icon usages in JSX
  Object.entries(ICON_MAPPING).forEach(([heroIcon, lucideIcon]) => {
    const usageRegex = new RegExp(`<${heroIcon}([^>]*?)/>`, 'g');
    const replacementCount = (content.match(usageRegex) || []).length;
    if (replacementCount > 0) {
      content = content.replace(usageRegex, `<${lucideIcon}$1 />`);
      changes += replacementCount;
      console.log(`  ✓ Replaced ${replacementCount} usage(s) of ${heroIcon} with ${lucideIcon}`);
    }
  });
  
  // Add ATLAS-compliant default props to Lucide icons
  content = content.replace(
    /(<[A-Z][a-zA-Z]*(?:\s+[^>]*?)?)(\s*\/?>)/g,
    (match, openTag, closeTag) => {
      // Check if this looks like a Lucide icon (starts with capital letter)
      const iconName = openTag.match(/<([A-Z][a-zA-Z]*)/)?.[1];
      if (iconName && Object.values(ICON_MAPPING).includes(iconName)) {
        // Add ATLAS-compliant defaults if not already specified
        if (!openTag.includes('size=') && !openTag.includes('className=')) {
          return `${openTag} size={24} className="stroke-1.5"${closeTag}`;
        } else if (!openTag.includes('size=')) {
          return `${openTag} size={24}${closeTag}`;
        } else if (!openTag.includes('className=') && !openTag.includes('stroke')) {
          return `${openTag} className="stroke-1.5"${closeTag}`;
        }
      }
      return match;
    }
  );
  
  if (changes > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Completed: ${changes} changes made`);
  } else {
    console.log(`  ⏭️  No changes needed`);
  }
  
  return changes;
}

function main() {
  console.log('🔄 ATLAS Heroicons to Lucide Migration');
  console.log('=====================================');
  
  let totalChanges = 0;
  
  for (const filePath of TARGET_FILES) {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ File not found: ${filePath}`);
      continue;
    }
    
    try {
      const changes = migrateFile(fullPath);
      totalChanges += changes;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }
  
  console.log('\n📊 Migration Summary');
  console.log('===================');
  console.log(`Total changes made: ${totalChanges}`);
  console.log('✅ Migration completed!');
  
  if (totalChanges > 0) {
    console.log('\n💡 Next steps:');
    console.log('1. Run "npm run build" to verify no compilation errors');
    console.log('2. Run "npm run lint:atlas" to verify ATLAS compliance');
    console.log('3. Test the UI to ensure icons display correctly');
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateFile, ICON_MAPPING };