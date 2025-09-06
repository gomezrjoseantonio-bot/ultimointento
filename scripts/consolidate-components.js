#!/usr/bin/env node
/**
 * Component Consolidation Script
 * Merges duplicate components and updates imports across the codebase
 */

const fs = require('fs');
const path = require('path');

// Component consolidation plan
const CONSOLIDATION_PLAN = {
  // PageLayout: Keep the more feature-rich common one, remove layout one
  'PageLayout': {
    keepFile: 'src/components/common/PageLayout.tsx',
    removeFile: 'src/components/layout/PageLayout.tsx',
    newImportPath: '../../../components/common/PageLayout',
    oldImportPaths: [
      '../layout/PageLayout',
      '../../layout/PageLayout',
      '../components/layout/PageLayout',
      './layout/PageLayout'
    ]
  },
  
  // Panel: Merge into a single component with module-specific content
  'Panel': {
    keepFile: 'src/modules/horizon/panel/Panel.tsx',
    removeFile: 'src/modules/pulse/panel/Panel.tsx',
    createShared: true,
    sharedPath: 'src/components/common/ModulePanel.tsx'
  },
  
  // ProjectionChart: Keep the more feature-rich horizon one, remove simple dashboard one
  'ProjectionChart': {
    keepFile: 'src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx',
    removeFile: 'src/components/dashboard/ProjectionChart.tsx',
    newImportPath: '../../../modules/horizon/proyeccion/base/components/ProjectionChart',
    oldImportPaths: [
      './ProjectionChart',
      '../ProjectionChart',
      '../../dashboard/ProjectionChart'
    ]
  },
  
  // PropertyForm: Keep the more feature-rich horizon one, remove simple properties one
  'PropertyForm': {
    keepFile: 'src/modules/horizon/inmuebles/cartera/PropertyForm.tsx',
    removeFile: 'src/components/properties/PropertyForm.tsx',
    newImportPath: '../../../modules/horizon/inmuebles/cartera/PropertyForm',
    oldImportPaths: [
      './PropertyForm',
      '../PropertyForm',
      '../../properties/PropertyForm',
      '../properties/PropertyForm'
    ]
  }
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

function updateImportsInFile(filePath, componentName, plan) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  const originalContent = content;
  
  // Update import statements
  for (const oldImportPath of plan.oldImportPaths || []) {
    const patterns = [
      `import ${componentName} from '${oldImportPath}'`,
      `import { ${componentName} } from '${oldImportPath}'`,
      `import ${componentName} from "${oldImportPath}"`,
      `import { ${componentName} } from "${oldImportPath}"`
    ];
    
    for (const pattern of patterns) {
      if (content.includes(pattern)) {
        const newImport = pattern.replace(oldImportPath, plan.newImportPath);
        content = content.replace(pattern, newImport);
        changes++;
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

function createSharedModulePanel() {
  const sharedPanelContent = `import React from 'react';
import PageLayout from './PageLayout';

interface ModulePanelProps {
  module: 'horizon' | 'pulse';
}

const ModulePanel: React.FC<ModulePanelProps> = ({ module }) => {
  const config = {
    horizon: {
      title: "Panel",
      subtitle: "Vista general del módulo Horizon con resumen de inversiones."
    },
    pulse: {
      title: "Panel", 
      subtitle: "Vista general del módulo Pulse con resumen de finanzas personales."
    }
  };
  
  const { title, subtitle } = config[module];
  
  return (
    <PageLayout 
      title={title}
      subtitle={subtitle}
      showInfoIcon={true}
    >
      <p className="text-gray-600">En construcción. Próximo hito: funcionalidades.</p>
    </PageLayout>
  );
};

export default ModulePanel;`;

  fs.writeFileSync('src/components/common/ModulePanel.tsx', sharedPanelContent, 'utf8');
}

function updatePanelComponents() {
  // Update Horizon Panel
  const horizonPanelContent = `import React from 'react';
import ModulePanel from '../../../components/common/ModulePanel';

const Panel: React.FC = () => {
  return <ModulePanel module="horizon" />;
};

export default Panel;`;

  fs.writeFileSync('src/modules/horizon/panel/Panel.tsx', horizonPanelContent, 'utf8');
  
  // Update Pulse Panel  
  const pulsePanelContent = `import React from 'react';
import ModulePanel from '../../../components/common/ModulePanel';

const Panel: React.FC = () => {
  return <ModulePanel module="pulse" />;
};

export default Panel;`;

  fs.writeFileSync('src/modules/pulse/panel/Panel.tsx', pulsePanelContent, 'utf8');
}

function main() {
  console.log('🔧 Starting component consolidation...');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllTsxFiles(srcDir);
  
  let totalChanges = 0;
  let filesChanged = 0;
  let filesRemoved = 0;
  
  // Handle special case: Panel components with shared component
  if (CONSOLIDATION_PLAN.Panel.createShared) {
    console.log('📦 Creating shared ModulePanel component...');
    createSharedModulePanel();
    updatePanelComponents();
    console.log('  ✅ Created ModulePanel.tsx');
    console.log('  ✅ Updated Horizon Panel.tsx');
    console.log('  ✅ Updated Pulse Panel.tsx');
  }
  
  // Process each consolidation
  for (const [componentName, plan] of Object.entries(CONSOLIDATION_PLAN)) {
    if (plan.createShared) continue; // Already handled above
    
    console.log(`\n🔄 Consolidating ${componentName}...`);
    console.log(`  📁 Keeping: ${plan.keepFile}`);
    console.log(`  🗑️  Removing: ${plan.removeFile}`);
    
    // Remove duplicate file first
    if (fs.existsSync(plan.removeFile)) {
      fs.unlinkSync(plan.removeFile);
      filesRemoved++;
      console.log(`    🗑️  Removed: ${plan.removeFile}`);
    }
    
    // Update imports in all files
    for (const file of files) {
      const relativePath = path.relative(srcDir, file);
      
      // Skip the files we're removing
      if (file.endsWith(plan.removeFile) || !fs.existsSync(file)) {
        continue;
      }
      
      const changes = updateImportsInFile(file, componentName, plan);
      if (changes > 0) {
        filesChanged++;
        totalChanges += changes;
        console.log(`    ✅ ${relativePath}: ${changes} import updates`);
      }
    }
  }
  
  // Remove the simple PageLayout from layout directory
  const layoutPageLayoutFile = 'src/components/layout/PageLayout.tsx';
  if (fs.existsSync(layoutPageLayoutFile)) {
    fs.unlinkSync(layoutPageLayoutFile);
    filesRemoved++;
    console.log(`🗑️  Removed: ${layoutPageLayoutFile}`);
  }
  
  console.log('\n🎯 Component consolidation complete!');
  console.log(`📊 Summary:`);
  console.log(`   • Files processed: ${files.length}`);
  console.log(`   • Import statements updated: ${totalChanges}`);
  console.log(`   • Files with changes: ${filesChanged}`);
  console.log(`   • Duplicate files removed: ${filesRemoved}`);
  console.log(`   • Shared components created: 1 (ModulePanel)`);
  
  console.log('\n✨ Next steps:');
  console.log('   1. Review the changes with: git diff');
  console.log('   2. Test the application: npm start');
  console.log('   3. Build to verify: npm run build');
  console.log('   4. Commit changes: git add . && git commit -m "Consolidate duplicate components"');
}

if (require.main === module) {
  main();
}

module.exports = {
  CONSOLIDATION_PLAN,
  updateImportsInFile,
  getAllTsxFiles
};